local simpleproposal = require"osm_importer.simpleproposal"
local nodesheights = require"osm_importer.nodesheights"
local tools = require"osm_importer.tools"
local timer = require"osm_importer.timer"
local typecache = require"osm_importer.type_cache"

local s = {}

-- Configuration
s.LOG_INTERVAL = 100  -- Log progress every N ways
s.MAX_BATCH_SIZE = 20  -- Maximum edges per batch to prevent crashes

-- Helper to get batching option (can be overridden by options)
function s.useBatching(options)
	if options and options.use_way_batching ~= nil then
		return options.use_way_batching
	end
	return true  -- Default to batching enabled
end

-- Node entity cache: node_id -> entity_id (or false if not found)
s.nodeCache = {}

-- Timing for rate calculation
s.startTime = nil
s.lastLogTime = nil
s.lastLogCount = 0

function s.SimpleProposalSeq(data, options) 
	osm_importer.options = assert(options, "Options not defined")
	s.stop = false
	s.data = data
	assert(not s.called, 'Already called, reload osm_importer before use again, enter: "m.reload()"')
	s.called = true
	s.cbLevel = options.log_level or 1
	assert(type(s.cbLevel)=="number")
	
	print("Start SimpleProposalCmdSeq (OPTIMIZED - Sequential)")
	print(os.date())
	timer.start()
	print("Options: "..toString(options))
	
	-- Initialize type cache (pre-validates all type IDs)
	print("[Optimizer] Initializing type cache...")
	typecache.initialize()
	
	-- Initialize node cache
	s.nodeCache = {}
	s.nodeCacheHits = 0
	s.nodeCacheMisses = 0
	print("[Optimizer] Node cache initialized")
	
	print("Set Nodes z height and tangents...")
	nodesheights.setAllNodesHeight(data.nodes, data.paths, data.edges)
	
	-- Collect edges that should be built
	local allEdges = {}
	for i, edge in pairs(data.edges) do
		if (options.build_streets and edge.street)
		or (options.build_tracks and edge.track 
			and (options.build_tramtracks or not edge.track.tram)
			and (options.build_subwaytracks or not edge.track.subway)) then
				table.insert(allEdges, edge)
		end
	end
	
	s.totalEdges = #allEdges
	s.nedges = {
		STREET = 0,
		TRACK = 0,
	}
	s.nosuc = {
		STREET = 0,
		TRACK = 0,
	}
	s.count = 0
	s.placed = 0  -- Successfully placed edges
	s.edgesProcessed = 0  -- Edges sent to API
	
	-- Determine batching mode from options
	s.batchingEnabled = s.useBatching(options)
	print("[Optimizer] Way batching: " .. (s.batchingEnabled and "ENABLED" or "DISABLED"))
	
	-- Group edges by way for batching
	if s.batchingEnabled then
		print("[Optimizer] Grouping edges by way for batch processing...")
		local wayGroups = {}  -- way_id -> list of edges
		local wayOrder = {}   -- ordered list of way_ids
		
		for _, edge in ipairs(allEdges) do
			local edgeId = edge.id or ""
			local wayId = edgeId:match("^(.+)_[^_]+$") or edgeId
			
			if not wayGroups[wayId] then
				wayGroups[wayId] = {}
				table.insert(wayOrder, wayId)
			end
			table.insert(wayGroups[wayId], edge)
		end
		
		-- Build way list (each item is a table of edges for one way)
		s.wayList = {}
		for _, wayId in ipairs(wayOrder) do
			table.insert(s.wayList, {
				wayId = wayId,
				edges = wayGroups[wayId]
			})
		end
		
		s.nways = #s.wayList
		s.nseq = s.nways  -- Progress based on ways, not edges
		print(string.format("[Optimizer] Grouped %d edges into %d ways (avg %.1f edges/way)", 
			s.totalEdges, s.nways, s.totalEdges / math.max(1, s.nways)))
		
		-- Estimate: ~3 ways/sec with batching vs ~10 edges/sec without
		local estimatedSeconds = s.nways / 3
		print(string.format("Estimated Time: %.0f min (%.2f h) - with way batching", 
			estimatedSeconds / 60, estimatedSeconds / 3600))
	else
		-- Single edge mode (fallback)
		s.seqlist = allEdges
		s.nseq = #s.seqlist
		
		local estimatedSeconds = s.nseq / 12
		print("Edges: " .. s.nseq)
		print(string.format("Estimated Time: %.0f min (%.2f h) - sequential mode", 
			estimatedSeconds / 60, estimatedSeconds / 3600))
	end
	
	-- Initialize timing
	s.startTime = os.time()
	s.lastLogTime = s.startTime
	s.lastLogCount = 0
	
	s.pb = s.progressWindow()
	
	if s.batchingEnabled then
		s.SimpleProposalSeqWay()
	else
		s.SimpleProposalSeqE()
	end
end

-- WAY BATCHING: Process all edges from one way in a single API call
function s.SimpleProposalSeqWay()
	if #s.wayList > 0 and not s.stop then
		local wayData = table.remove(s.wayList, 1)
		s.count = s.count + 1
		s.pb:setProgress(s.count / s.nseq)
		
		-- Calculate timing stats
		local now = os.time()
		local elapsed = now - s.startTime
		local waysRate = s.count / math.max(1, elapsed)
		local edgesRate = s.edgesProcessed / math.max(1, elapsed)
		local remainingWays = s.nseq - s.count
		local remaining = remainingWays / math.max(1, waysRate)
		local etaMin = math.floor(remaining / 60)
		local etaSec = math.floor(remaining % 60)
		
		-- Describe this way
		local firstEdge = wayData.edges[1]
		local edgeType = firstEdge.track and "Track" or firstEdge.street and "Street" or "Unknown"
		local wayDesc = string.format("%s (%d edges)", edgeType, #wayData.edges)
		
		-- Update progress bar with detailed stats
		local taskText = string.format("%d/%d edges | Way %d/%d | ETA: %dm %ds | %s", 
			s.placed, s.totalEdges, s.count, s.nseq, etaMin, etaSec, wayDesc)
		s.pb:setTask(taskText)
		
		-- Log progress at intervals
		if s.count % s.LOG_INTERVAL == 0 then
			print(string.format("[Progress] Way %d/%d (%.1f%%) | Edges: %d/%d | Rate: %.1f ways/sec (%.1f edges/sec) | ETA: %.0f min", 
				s.count, s.nseq, 100 * s.count / s.nseq,
				s.placed, s.totalEdges, 
				waysRate, edgesRate, remaining / 60))
		end
		
		s.SimpleProposalSeqWayCmd(wayData, s.cbLevel)
	else
		s.finishImport()
	end
end

-- Process a complete way (multiple edges) in one API call
-- Splits large ways into smaller batches to prevent crashes
function s.SimpleProposalSeqWayCmd(wayData, cbLevel)
	local edges = wayData.edges
	local wayId = wayData.wayId
	
	-- Split large ways into smaller batches
	if #edges > s.MAX_BATCH_SIZE then
		-- Split into smaller chunks and process the first chunk now
		-- The rest will be added back to the front of wayList
		local remainingChunks = {}
		for i = s.MAX_BATCH_SIZE + 1, #edges, s.MAX_BATCH_SIZE do
			local chunk = {}
			for j = i, math.min(i + s.MAX_BATCH_SIZE - 1, #edges) do
				table.insert(chunk, edges[j])
			end
			table.insert(remainingChunks, {
				wayId = wayId .. "_chunk" .. math.ceil(i / s.MAX_BATCH_SIZE),
				edges = chunk
			})
		end
		
		-- Add remaining chunks back to front of list
		for i = #remainingChunks, 1, -1 do
			table.insert(s.wayList, 1, remainingChunks[i])
			s.nseq = s.nseq + 1
		end
		
		-- Trim current batch to max size
		local trimmedEdges = {}
		for i = 1, s.MAX_BATCH_SIZE do
			table.insert(trimmedEdges, edges[i])
		end
		edges = trimmedEdges
		
		if cbLevel >= 2 then
			print(string.format("[Batch] Split way %s: processing %d edges, %d chunks remaining", 
				wayId, #edges, #remainingChunks))
		end
	end
	
	-- Collect all unique nodes for this way
	local nodes = {}
	for _, edge in ipairs(edges) do
		if not nodes[edge.node0] then
			nodes[edge.node0] = s.data.nodes[edge.node0]
		end
		if not nodes[edge.node1] then
			nodes[edge.node1] = s.data.nodes[edge.node1]
		end
	end
	
	-- Build the data structure for SimpleProposal
	local d2 = {
		nodes = nodes,
		edges = edges,
	}
	
	-- Apply cached node lookups for any nodes that already exist
	for nodeId, _ in pairs(nodes) do
		s.replaceNodeCached(d2, nodeId)
	end
	
	-- Verbose logging
	if cbLevel >= 2 then
		print(string.format("Cmd Way %s - %d edges, %d nodes", wayId, #edges, s.countTable(nodes)))
	end
	
	s.edgesProcessed = s.edgesProcessed + #edges
	
	-- Wrap in pcall to catch any Lua errors
	local ok, err = pcall(function()
		simpleproposal.SimpleProposalCmd(d2, context, ignoreErrors, cbLevel, function(res, success)
			-- Count results
			for _, edge in ipairs(edges) do
				local etype = edge.track and "TRACK" or edge.street and "STREET"
				s.nedges[etype] = s.nedges[etype] + 1
				if success then
					s.placed = s.placed + 1
					-- Invalidate cache for these nodes so they can be found as entities next time
					s.nodeCache[edge.node0] = nil
					s.nodeCache[edge.node1] = nil
				else
					s.nosuc[etype] = s.nosuc[etype] + 1
				end
			end
			
			-- Continue to next way
			s.SimpleProposalSeqWay()
		end, true)  -- retryWSmStreet
	end)
	
	if not ok then
		print("[ERROR] Batch failed with error: " .. tostring(err))
		print("[ERROR] Skipping way " .. wayId .. " (" .. #edges .. " edges)")
		-- Mark edges as failed and continue
		for _, edge in ipairs(edges) do
			local etype = edge.track and "TRACK" or edge.street and "STREET"
			s.nedges[etype] = s.nedges[etype] + 1
			s.nosuc[etype] = s.nosuc[etype] + 1
		end
		-- Continue to next way
		s.SimpleProposalSeqWay()
	end
end

-- Helper to count table entries
function s.countTable(t)
	local count = 0
	for _ in pairs(t) do count = count + 1 end
	return count
end

-- SINGLE EDGE MODE (fallback)
function s.SimpleProposalSeqE()
	if #s.seqlist > 0 and not s.stop then
		local edge = table.remove(s.seqlist, 1)
		s.count = s.count + 1
		s.pb:setProgress(s.count / s.nseq)
		
		-- Calculate timing stats
		local now = os.time()
		local elapsed = now - s.startTime
		local rate = s.count / math.max(1, elapsed)
		local remaining = (s.nseq - s.count) / math.max(1, rate)
		local etaMin = math.floor(remaining / 60)
		local etaSec = math.floor(remaining % 60)
		
		-- Show what's being imported with full stats in progress bar
		local edgeType = edge.track and ("Track: " .. (edge.track.type or "rail")) 
			or edge.street and ("Street: " .. (edge.street.type or "road"))
			or "Unknown"
		
		-- Update progress bar text with counts and ETA
		local taskText = string.format("%d/%d placed | ETA: %dm %ds | %s", 
			s.placed, s.totalEdges, etaMin, etaSec, edgeType)
		s.pb:setTask(taskText)
		
		-- Log progress at intervals (less frequent)
		if s.count % s.LOG_INTERVAL == 0 then
			print(string.format("[Progress] %d/%d (%.1f%%) | Placed: %d | Rate: %.1f/sec | ETA: %.0f min - %s", 
				s.count, s.nseq, 100 * s.count / s.nseq,
				s.placed, rate, remaining / 60, edgeType))
		end
		
		s.SimpleProposalSeqEdgeCmd(edge, s.cbLevel, true)
	else
		s.finishImport()
	end
end

function s.SimpleProposalSeqEdgeCmd(edge, cbLevel, retryWSmStreet)
	s.edge = edge
	local d2 = {
		nodes = {
			[edge.node0] = s.data.nodes[edge.node0],
			[edge.node1] = s.data.nodes[edge.node1],
		},
		edges = {
			edge
		},
	}
	
	-- Use cached node lookup
	s.replaceNodeCached(d2, edge.node0)
	s.replaceNodeCached(d2, edge.node1)
	
	-- Check for duplicate node entities
	if type(d2.nodes[edge.node0].id) == "number" and d2.nodes[edge.node0].id == d2.nodes[edge.node1].id then
		if cbLevel >= 2 then
			print("Node entity Id equal!", d2.nodes[edge.node1].id)
		end
		-- Skip this edge and continue
		s.SimpleProposalSeqE()
		return
	end
	
	-- Verbose logging only at high levels
	if cbLevel >= 2 then
		local edgeInfo = edge.track and "TRACK" or edge.street and ("highway=" .. edge.street.type)
		print(string.format("Cmd Edge #%d - %s  N0: %s (%s) - N1: %s (%s) - %s", 
			s.count, edge.id or "", 
			edge.node0, d2.nodes[edge.node0].id or "", 
			edge.node1, d2.nodes[edge.node1].id or "", 
			edgeInfo))
	end
	
	simpleproposal.SimpleProposalCmd(d2, context, ignoreErrors, cbLevel, function(res, success)
		local etype = edge.track and "TRACK" or edge.street and "STREET"
		s.nedges[etype] = s.nedges[etype] + 1
		if not success then
			s.nosuc[etype] = s.nosuc[etype] + 1
		else
			s.placed = s.placed + 1
			-- On success, update node cache with newly created node entities
			s.updateNodeCacheFromResult(res, edge)
		end
		s.SimpleProposalSeqE()
	end, retryWSmStreet)
end

-- Update node cache after successful edge creation
function s.updateNodeCacheFromResult(res, edge)
	-- After an edge is created, the nodes now exist as entities
	-- We need to update our cache so subsequent edges can connect to them
	
	-- Try to find the actual entity IDs for these nodes now that they exist
	local function findAndCacheNode(nodeId)
		local nodeData = s.data.nodes[nodeId]
		if not nodeData or not nodeData.pos then return end
		
		local pos = nodeData.pos
		local ents = game.interface.getEntities({pos = pos, radius = 5}, {type = "BASE_NODE"})
		local foundId = tools.getNearestNode(pos, ents, 1.0)
		
		if foundId then
			s.nodeCache[nodeId] = foundId
			if s.cbLevel >= 3 then
				print(string.format("[Cache] Node %s -> entity %d", tostring(nodeId), foundId))
			end
		else
			-- Node was created but we can't find it - clear cache so next lookup retries
			s.nodeCache[nodeId] = nil
		end
	end
	
	-- Find and cache both nodes from the edge
	findAndCacheNode(edge.node0)
	findAndCacheNode(edge.node1)
end

-- Replace node with cached entity lookup
function s.replaceNodeCached(d, node)
	-- Check cache first
	local cachedValue = s.nodeCache[node]
	if cachedValue ~= nil then
		if cachedValue then  -- Found in cache (entity ID)
			s.nodeCacheHits = s.nodeCacheHits + 1
			local basenode = api.engine.getComponent(cachedValue, api.type.ComponentType.BASE_NODE)
			d.nodes[node].id = cachedValue
			d.nodes[node].comp = basenode
		else
			-- Cached as "not found" - no entity exists yet
			s.nodeCacheHits = s.nodeCacheHits + 1
		end
		return
	end
	
	-- Cache miss - do lookup
	s.nodeCacheMisses = s.nodeCacheMisses + 1
	local id = s.getIdIfExist(node)
	
	if id then
		s.nodeCache[node] = id
		if s.cbLevel >= 3 then
			print("Node found and cached:", node, "->", id)
		end
		local basenode = api.engine.getComponent(id, api.type.ComponentType.BASE_NODE)
		d.nodes[node].id = id
		d.nodes[node].comp = basenode
	else
		s.nodeCache[node] = false  -- Cache "not found"
	end
end

-- Original node lookup (called on cache miss)
function s.getIdIfExist(node)
	local nodeData = s.data.nodes[node]
	if not nodeData or not nodeData.pos then
		return nil
	end
	local pos = nodeData.pos
	-- Search radius 5m, accept nodes within 1m for reliable connections
	-- Too strict tolerance (like 1mm) causes nodes to not be found
	local ents = game.interface.getEntities({pos = pos, radius = 5}, {type = "BASE_NODE"})
	return tools.getNearestNode(pos, ents, 1.0)  -- Accept nodes within 1 meter
end

function s.finishImport()
	print("-------------------------------------------------------------")
	local aborted = false
	if s.batchingEnabled then
		if #s.wayList ~= 0 then
			print("Process aborted!")
			print(string.format("Remaining Ways: %d", #s.wayList))
			aborted = true
		end
	else
		if #s.seqlist ~= 0 then
			print("Process aborted!")
			print(string.format("Remaining Edges: %d", #s.seqlist))
			aborted = true
		end
	end
	
	if not aborted then
		if s.batchingEnabled then
			print("Finished SimpleProposalCmdSeq (WAY BATCHING)")
		else
			print("Finished SimpleProposalCmdSeq (SEQUENTIAL)")
		end
	end
	
	print(os.date())
	local timedur = timer.stop()
	local totalEdges = s.nedges.STREET + s.nedges.TRACK
	local avgEdgeRate = totalEdges / math.max(1, timedur)
	
	print(string.format("Time: %.2f min (%.2f h)", timedur / 60, timedur / 3600))
	print(string.format("Total: %d processed, %d placed (%.1f%% success)", 
		totalEdges, s.placed, 100 * s.placed / math.max(1, totalEdges)))
	print(string.format("Average rate: %.1f edges/sec", avgEdgeRate))
	
	if s.batchingEnabled and s.nways then
		local avgWayRate = s.count / math.max(1, timedur)
		print(string.format("Way batching: %d ways in %.0f sec (%.1f ways/sec)", 
			s.count, timedur, avgWayRate))
	end
	
	-- Print statistics
	if s.nedges.STREET > 0 then
		print(string.format("Streets: %d built, %d failed (%.1f%%)", 
			s.nedges.STREET - s.nosuc.STREET, s.nosuc.STREET, 
			100 * s.nosuc.STREET / s.nedges.STREET))
	end
	if s.nedges.TRACK > 0 then
		print(string.format("Tracks: %d built, %d failed (%.1f%%)", 
			s.nedges.TRACK - s.nosuc.TRACK, s.nosuc.TRACK,
			100 * s.nosuc.TRACK / s.nedges.TRACK))
	end
	
	-- Print type cache stats
	typecache.printStats()
	
	-- Print node cache stats
	print(string.format("Node cache: %d hits, %d misses (%.1f%% hit rate)",
		s.nodeCacheHits, s.nodeCacheMisses,
		100 * s.nodeCacheHits / math.max(1, s.nodeCacheHits + s.nodeCacheMisses)))
	
	-- Cleanup
	if s.pb then
		pcall(function() s.pb:getParent():getParent():remove() end)
		s.pb = nil
	end
end

function s.progressWindow()
	local pb = api.gui.comp.ProgressBar.new()
	local title
	if s.batchingEnabled then
		title = string.format("OSM Import: %d edges in %d ways", s.totalEdges, s.nways)
	else
		title = string.format("OSM Import: %d edges", s.totalEdges)
	end
	local window = api.gui.comp.Window.new(title, pb)
	window:addHideOnCloseHandler()
	pb:setMinimumSize(api.gui.util.Size.new(600, 10))
	return pb
end

-- Legacy compatibility
function s.replaceNode(d, node)
	s.replaceNodeCached(d, node)
end

return s

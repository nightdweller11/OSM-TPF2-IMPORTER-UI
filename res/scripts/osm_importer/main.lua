-- OSM Importer Main Module
-- All variables are local to comply with TPF2's no-globals policy

local osmdata = require"osm_importer.osmdata"
local bulldoze = require "osm_importer.bulldoze"

local osm_importer = {
	simpleproposal = require"osm_importer.simpleproposal",
	simpleproposalseq = require"osm_importer.simpleproposal_seq",
	models = require"osm_importer.models",
	towns = require"osm_importer.towns",
	areas = require"osm_importer.areas",
	scriptevent = require"osm_importer.script_event",
	reload = require"osm_importer.package".reload,
	gui = require"osm_importer.gui",
	osmdata = osmdata,
	bulldoze = bulldoze,
}

print("Loaded osm_importer.main")

-- Quick access to show GUI
function osm_importer.showGUI()
	osm_importer.gui.show()
end

--------------------------------------------------------------------------------
-- Pre-flight checks - validate data and resources before import
--------------------------------------------------------------------------------
function osm_importer.preflight(options)
	local issues = {}
	local warnings = {}
	
	print("[OSM Importer] Running pre-flight checks...")
	
	-- Check map bounds
	local mapOk, mapInfo = pcall(function()
		local terrain = api.engine.terrain
		if terrain and terrain.getHeightmapSize then
			local size = terrain.getHeightmapSize()
			return { width = size.x, height = size.y }
		end
		return nil
	end)
	
	if mapOk and mapInfo then
		print("[OSM Importer] Map size: " .. mapInfo.width .. " x " .. mapInfo.height)
	end
	
	-- Check osmdata bounds vs map bounds
	if osmdata.bounds then
		print("[OSM Importer] OSM data bounds: " .. 
			osmdata.bounds.minX .. " to " .. osmdata.bounds.maxX .. " (X), " ..
			osmdata.bounds.minY .. " to " .. osmdata.bounds.maxY .. " (Y)")
		
		-- Estimate if data is larger than map
		local dataWidth = math.abs(osmdata.bounds.maxX - osmdata.bounds.minX)
		local dataHeight = math.abs(osmdata.bounds.maxY - osmdata.bounds.minY)
		print("[OSM Importer] Data extent: " .. math.floor(dataWidth) .. " x " .. math.floor(dataHeight) .. " meters")
	else
		table.insert(warnings, "OSM data has no bounds info")
	end
	
	-- Check if data is reasonable size
	local edgeCount = osmdata.edges and #osmdata.edges or 0
	if edgeCount > 200000 then
		table.insert(warnings, "Very large dataset (" .. edgeCount .. " edges) - may take hours")
	elseif edgeCount > 50000 then
		table.insert(warnings, "Large dataset (" .. edgeCount .. " edges) - may take 30+ minutes")
	end
	print("[OSM Importer] Edge count: " .. edgeCount)
	
	-- Check for common track types used in osmdata
	local trackTypesNeeded = {}
	local streetTypesNeeded = {}
	
	if osmdata.edges then
		for i = 1, math.min(100, #osmdata.edges) do  -- Sample first 100 edges
			local edge = osmdata.edges[i]
			if edge.type then
				if edge.isTrack then
					trackTypesNeeded[edge.type] = true
				else
					streetTypesNeeded[edge.type] = true
				end
			end
		end
	end
	
	-- Verify track types exist
	if options.build_tracks and api.res.trackTypeRep then
		for typeName, _ in pairs(trackTypesNeeded) do
			local ok = pcall(function()
				return api.res.trackTypeRep.find(typeName)
			end)
			if not ok then
				table.insert(issues, "Missing track type: " .. typeName)
			end
		end
	end
	
	-- Verify street types exist
	if options.build_streets and api.res.streetTypeRep then
		for typeName, _ in pairs(streetTypesNeeded) do
			local ok = pcall(function()
				return api.res.streetTypeRep.find(typeName)
			end)
			if not ok then
				table.insert(issues, "Missing street type: " .. typeName)
			end
		end
	end
	
	-- Report results
	print("[OSM Importer] Pre-flight complete:")
	print("[OSM Importer] - " .. #warnings .. " warnings")
	print("[OSM Importer] - " .. #issues .. " issues")
	
	for _, w in ipairs(warnings) do
		print("[OSM Importer] WARNING: " .. w)
	end
	for _, i in ipairs(issues) do
		print("[OSM Importer] ISSUE: " .. i)
	end
	
	return {
		ok = #issues == 0,
		issues = issues,
		warnings = warnings,
		edgeCount = edgeCount,
	}
end

--------------------------------------------------------------------------------
-- Main import function - can be called from the in-game UI
--------------------------------------------------------------------------------
function osm_importer.run(userOptions)
	print("[OSM Importer] Starting import...")
	
	local options = userOptions or {
		build_streets = true,
		build_tracks = true,
		build_subwaytracks = true,
		build_tramtracks = false,
		build_bridges = true,
		build_tunnels = false,
		build_signals = true,
		build_autobahn = true,
		build_streets_street_types = true,
		build_streets_footway_types = true,
		build_streets_water = true,
		build_streets_airport = true,
		skip_nodes_outofbounds = true,
		crash_type_not_found = false,
		log_level = 1,
	}
	
	-- Always skip missing resources to avoid crashes
	options.crash_type_not_found = false
	
	print("[OSM Importer] Options loaded, starting build sequence...")
	
	-- Helper to run steps safely
	local function safeCall(stepName, fn, skipMsg)
		print("[OSM Importer] " .. stepName .. "...")
		local ok, err = pcall(fn)
		if not ok then
			print("[OSM Importer] WARNING: " .. stepName .. " failed: " .. tostring(err))
			if skipMsg then
				print("[OSM Importer] " .. skipMsg)
			end
		else
			print("[OSM Importer] " .. stepName .. " done")
		end
		return ok
	end
	
	-- Skip dangerous steps if skip_forests/skip_surfaces is set
	local skipForests = options.skip_forests
	local skipSurfaces = options.skip_surfaces
	
	-- (1) Town labels - OPTIONAL, can cause crashes near water
	if osmdata.towns and #osmdata.towns > 0 then
		safeCall("Step 1: Creating town labels (" .. #osmdata.towns .. " towns)", function()
			osm_importer.towns.createTownLabels(osmdata.towns)
		end, "Town labels skipped - may need manual creation")
	else
		print("[OSM Importer] Step 1: No towns in data, skipping")
	end
	
	-- Disable town development (optional, may not work in all contexts)
	safeCall("Disabling town development", function()
		osm_importer.towns.setAllTownsDevActive(false)
	end)
	
	-- Clear existing content if requested
	-- Done carefully to avoid crashes - pause first, then clear
	if options.clear_existing then
		print("[OSM Importer] Clearing existing map content...")
		print("[OSM Importer] This may take a moment...")
		
		-- First remove assets (trees, etc) - less risky
		safeCall("Removing assets (trees, etc)", function()
			bulldoze.delAssets()
		end)
		
		-- Then remove edges - more risky, do after assets
		-- The crash was likely because edges were being removed 
		-- while still connected to stations/towns
		safeCall("Removing edges (streets/tracks)", function()
			-- Check if there are any edges to remove
			local entities = game.interface.getEntities({radius = math.huge}, {type = "BASE_EDGE"})
			local count = 0
			for _ in pairs(entities) do count = count + 1 end
			
			if count > 0 then
				print("[OSM Importer] Found " .. count .. " edges to remove")
				bulldoze.delEdges()
			else
				print("[OSM Importer] No existing edges to remove")
			end
		end)
	else
		print("[OSM Importer] Keeping existing map content")
	end
	
	-- (2) Areas: forests/shrubs + ground surfaces
	if not skipForests and not skipSurfaces then
		if osmdata.areas and osmdata.nodes then
			safeCall("Step 2: Building areas", function()
				osm_importer.areas.buildAreas(osmdata.areas, osmdata.nodes)
			end, "Areas skipped - Forester/Paver may be missing")
		else
			print("[OSM Importer] Step 2: No areas in data, skipping")
		end
	else
		print("[OSM Importer] Step 2: Areas skipped by option")
	end
	
	-- (3) Build edges (Streets/Tracks) - the main work
	local edgeCount = osmdata.edges and #osmdata.edges or 0
	if edgeCount > 0 then
		print("[OSM Importer] Step 3: Building streets and tracks...")
		print("[OSM Importer] Total edges to build: " .. edgeCount)
		print("[OSM Importer] Estimated time: " .. math.ceil(edgeCount / 5 / 60) .. " minutes")
		print("[OSM Importer] (Game may appear frozen - this is normal)")
		
		local edgeOk, edgeErr = pcall(function()
			osm_importer.simpleproposalseq.SimpleProposalSeq(osmdata, options)
		end)
		
		if not edgeOk then
			print("[OSM Importer] ERROR building edges: " .. tostring(edgeErr))
		else
			print("[OSM Importer] Step 3: Edges complete")
		end
	else
		print("[OSM Importer] Step 3: No edges in data, skipping")
	end
	
	-- (4) Build objects - LAST because terrain heights change
	if osmdata.objects and #osmdata.objects > 0 then
		safeCall("Step 4: Building objects (" .. #osmdata.objects .. " objects)", function()
			osm_importer.models.buildObjects(osmdata.objects)
		end, "Objects skipped - models may be missing")
	else
		print("[OSM Importer] Step 4: No objects in data, skipping")
	end
	
	print("[OSM Importer] ========================================")
	print("[OSM Importer] Import complete!")
	print("[OSM Importer] Check stdout.txt for detailed results")
	print("[OSM Importer] ========================================")
end

-- Expose to the global table for console access (using rawset to bypass restriction)
rawset(_G, "osm_importer", osm_importer)
rawset(_G, "m", osm_importer)
rawset(_G, "osmdata", osmdata)
rawset(_G, "bulldoze", bulldoze)

return osm_importer

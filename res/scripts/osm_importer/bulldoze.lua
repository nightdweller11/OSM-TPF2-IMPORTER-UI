local b = {}

-- SAFE entities to clear (won't crash the game)
-- Note: removeTown, delEdges, and terrain commands can crash the game engine
-- User should use in-game bulldoze tool or start new empty map for full clear

-- Safe clear: only remove entities that won't crash
function b.clearSafe()
	print("=== SAFE CLEAR ===")
	print("Removing vehicles, lines, animals, assets...")
	
	-- These are safe to remove
	pcall(function() b.delVehicles() end)
	pcall(function() b.delLines() end)
	pcall(function() b.delAnimals() end)
	pcall(function() b.delAssets() end)
	
	print("✓ Safe clear complete")
	print("")
	print("NOTE: To fully clear the map:")
	print("  1. Use the in-game bulldoze tool for roads/tracks")
	print("  2. Use Game > Options > 'Delete all' for industries")
	print("  3. Or start a new empty map (recommended)")
	print("")
	
	return true
end

-- Complete clear: everything including terrain flattening
-- WARNING: This can crash! Use clearSafe() instead
function b.clearEverything(flattenTerrain)
	print("=== CLEARING EVERYTHING ===")
	print("WARNING: This may crash the game!")
	
	-- Order matters! Dependencies first - safest operations first
	pcall(function() b.delVehicles() end)
	pcall(function() b.delLines() end)
	pcall(function() b.delAnimals() end)
	pcall(function() b.delAssets() end)
	
	-- These are riskier
	pcall(function() b.delSimBds() end)
	pcall(function() b.delTownBds() end)
	pcall(function() b.delStationsGroup() end)
	pcall(function() b.delCons() end)
	
	-- These often crash - skipping by default
	-- pcall(function() b.delEdges() end)
	-- pcall(function() b.delTowns() end)
	-- pcall(function() b.delNodes() end)
	
	if flattenTerrain then
		-- Terrain commands can crash - skip
		print("Terrain flattening not available (can crash)")
	end
	
	print("=== CLEAR COMPLETE ===")
end

function b.deleteAll()  -- produces crashes bec happens in the same step
	b.delVehicles()
	b.delLines()
	b.delAssets()
	b.delAnimals()
	b.delSimBds()
	b.delTownBds()
	-- b.delCons()
	-- b.delStationsGroup()
	b.delEdges()
	b.delTowns()
end


function b.delVehicles()
	for i,k in pairs(game.interface.getVehicles()) do 
		api.cmd.sendCommand(api.cmd.make.sellVehicle(k))
	end
	print("Removed all Vehicles")
end

function b.delLines()
	for i,k in pairs(game.interface.getLines()) do
		api.cmd.sendCommand(api.cmd.make.deleteLine(k))
	end
	print("Removed all Lines")
end

function b.delTowns()
	for i,k in pairs(game.interface.getEntities({ radius = math.huge }, { type = "TOWN" })) do 
		api.cmd.sendCommand(api.cmd.make.removeTown(k))
	end
	print("Removed all Towns")
end


function b.delCons(cons)
	if cons==nil then
		b.delCons(game.interface.getEntities({ radius = math.huge }, { type = "CONSTRUCTION" }))
		print("Removed all Constructions")
		return
	end
	-- local p = api.type.SimpleProposal.new()
	-- p.constructionsToRemove = cons
	-- api.cmd.sendCommand(api.cmd.make.buildProposal(p, nil, false))  -- stations game crashes...
	for i,k in pairs(cons) do
		game.interface.bulldoze(k)
	end
end

function b.delTownBds()
	local townbuildings = game.interface.getEntities({ radius = math.huge }, { type = "TOWN_BUILDING" })
	local townCons = {}
	for i,k in pairs(townbuildings) do 
		townCons[i] = game.interface.getEntity(k).personCapacity
	end
	b.delCons(townCons)
	print("Removed all TownBuildings")
end

function b.delSimBds()
	local simbuildings = game.interface.getEntities({ radius = math.huge }, { type = "SIM_BUILDING" })
	local simCons = {}
	for i,k in pairs(simbuildings) do 
		simCons[i] = game.interface.getEntity(k).stockList
	end
	b.delCons(simCons)
	print("Removed all Industries")
end


function b.remFld(id)
	api.cmd.sendCommand(api.cmd.make.removeField(id))
end

function b.remType(entitytype,bulldoze)
	for i,k in pairs(game.interface.getEntities({ radius = math.huge }, { type = entitytype })) do 
		if bulldoze then
			if game.interface.bulldoze then
				game.interface.bulldoze(k)
			else
				print("No bulldoze")
			end
		else
			b.remFld(k)
		end
	end
end

function b.delAssets()
	b.remType("ASSET_GROUP")
	print("Removed all Assets")
end

function b.delStationsGroup()
	b.remType("STATION_GROUP")
	print("Removed all Stations")
end

function b.delAnimals()
	b.remType("ANIMAL")
	print("Removed all Animals")
end

function b.delEdges()
	if not game.interface.bulldoze then
		print("Not game.interface.bulldoze - Switch to Script Thread")
		return
	end
	local ents = game.interface.getEntities({ radius = math.huge }, { type = "BASE_EDGE" })
	for i,k in pairs(ents) do 
		if api.engine.entityExists(k) then
			local stat, ret = pcall(function()
				game.interface.bulldoze(k)
				--b.remFld(k)  -- c:\build\tpf2_steam\src\game\ecs\tpnetlinksystem.cpp:60: auto __cdecl ecs::TpNetLinkSystem::{ctor}::<lambda_1bbffd24a3104f63adb0507ef0a7aecb>::operator ()(class ecs::Engine *,const class ecs::Entity &) const: Assertion `m_tnEntity2linkEntities.find(entity) == m_tnEntity2linkEntities.end()' failed.
			end)
			if not stat then
				print("Error:",ret)
			end
		end
	end
	local ents2 = game.interface.getEntities({ radius = math.huge }, { type = "BASE_EDGE" })
	if #ents2==0 then
		print("Removed all Edges")
	else
		print("Not all edges gone",#ents2)
		if #ents2<#ents then
			print("Try again ...")
			b.delEdges()
		else  -- stuck
			print("Stop trying")
		end
	end
end


function b.removePlaceholders()
	for id,asset in pairs( game.interface.getEntities({radius=1e46},{type="ASSET_GROUP", includeData = true})) do if asset.models["placeholders/missing_generic.mdl"] then api.cmd.sendCommand(api.cmd.make.removeField(id)) end   end
end

-- Remove orphaned nodes
function b.delNodes()
	local nodes = game.interface.getEntities({ radius = math.huge }, { type = "BASE_NODE" })
	local count = 0
	for i,k in pairs(nodes) do 
		pcall(function()
			if api.engine.entityExists(k) then
				game.interface.bulldoze(k)
				count = count + 1
			end
		end)
	end
	print("Removed " .. count .. " nodes")
end

-- Flatten terrain to a uniform height
function b.flattenTerrain()
	print("Flattening terrain...")
	
	-- Get map bounds
	local ok, result = pcall(function()
		local mapSize = api.engine.terrain.getHeightmapSize()
		if not mapSize then
			print("Could not get heightmap size")
			return
		end
		
		local width = mapSize.x
		local height = mapSize.y
		
		-- Get target height (water level or 0)
		local targetHeight = 0
		pcall(function()
			local terrain = api.engine.getComponent(api.engine.util.getWorld(), api.type.ComponentType.TERRAIN)
			if terrain and terrain.waterLevel then
				targetHeight = terrain.waterLevel + 1  -- Slightly above water
			end
		end)
		
		print("Flattening to height: " .. targetHeight)
		print("Map size: " .. width .. " x " .. height)
		
		-- Create terrain modification proposal
		-- Note: This uses the terrain modification API if available
		local modifications = {}
		local step = 4  -- Sample every 4th point for performance
		
		for x = 0, width - 1, step do
			for y = 0, height - 1, step do
				local worldPos = api.engine.terrain.heightmapIndexToWorldPos(api.type.Vec2i.new(x, y))
				if worldPos then
					table.insert(modifications, {
						pos = worldPos,
						height = targetHeight
					})
				end
			end
		end
		
		if #modifications > 0 then
			-- Apply terrain changes in batches
			local batchSize = 1000
			for i = 1, #modifications, batchSize do
				local batch = {}
				for j = i, math.min(i + batchSize - 1, #modifications) do
					table.insert(batch, modifications[j])
				end
				
				pcall(function()
					for _, mod in ipairs(batch) do
						api.cmd.sendCommand(api.cmd.make.setTerrainHeight(mod.pos, mod.height))
					end
				end)
			end
			print("Applied " .. #modifications .. " terrain modifications")
		end
	end)
	
	if not ok then
		print("Terrain flattening not available or failed: " .. tostring(result))
		print("Note: Terrain flattening may require starting a new map")
	end
end

-- Remove all fields/forests
function b.delFields()
	local fields = game.interface.getEntities({ radius = math.huge }, { type = "FIELD" })
	for i,k in pairs(fields) do 
		pcall(function()
			api.cmd.sendCommand(api.cmd.make.removeField(k))
		end)
	end
	print("Removed all Fields")
end

return b
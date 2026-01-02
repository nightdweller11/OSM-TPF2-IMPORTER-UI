local tools = require"osm_importer.tools"

local t = {}

function t.createTown(caps,pos,name,devactive)
	local ok, err = pcall(function()
		local town = api.type.TownInfo.new()
		town.name = name
		town.position = api.type.Vec2f.new(pos[1],pos[2])
		assert(#caps==3)
		town.initialLandUseCapacities = caps
		
		-- Set initial land use capacities properly
		-- This determines how many buildings of each type can grow
		town.initialLandUseCapacities = api.type.VectorFloat.new()
		town.initialLandUseCapacities:add(caps[1])  -- Residential
		town.initialLandUseCapacities:add(caps[2])  -- Commercial
		town.initialLandUseCapacities:add(caps[3])  -- Industrial
		
		api.cmd.sendCommand(
			api.cmd.make.createTowns({town}),
			function(res, success)
				if success then
					print("[OSM Importer] Town '" .. name .. "' created successfully")
					-- Enable town development so buildings grow
					if devactive ~= false then
						-- Town development is enabled by default
					end
				else
					print("[OSM Importer] Town creation failed: " .. tostring(name))
				end
			end
		)
	end)
	
	if not ok then
		print("[OSM Importer] Error creating town '" .. tostring(name) .. "': " .. tostring(err))
		return false
	end
	return true
end

function t.createTownLabel(pos, name)
	-- Check if position is valid on the map
	local validCoord = false
	pcall(function()
		validCoord = tools.isValidCoordinate(pos[1], pos[2])
	end)
	
	if not validCoord then
		print("[OSM Importer] Town '" .. name .. "' skipped - outside map bounds")
		return false
	end
	
	-- Check if position is over water (inverted - isOverWater returns true if NOT over water)
	local overWater = true
	pcall(function()
		overWater = not tools.isOverWater(pos[1], pos[2])
	end)
	
	if overWater then
		print("[OSM Importer] Town '" .. name .. "' skipped - over water")
		return false
	end
	
	-- Create town with proper capacities for building growth
	-- Format: {residential, commercial, industrial}
	-- Higher values = more buildings can grow
	local capacities = {100, 50, 25}  -- Residential-focused town
	return t.createTown(capacities, pos, name, true)  -- devactive=true to enable development
end

function t.createTownLabels(towns)
	print("[OSM Importer] Creating " .. #towns .. " town labels...")
	local created = 0
	local skipped = 0
	
	for i, data in pairs(towns) do
		local ok = t.createTownLabel(data.pos, data.name)
		if ok then
			created = created + 1
		else
			skipped = skipped + 1
		end
	end
	
	print("[OSM Importer] Towns: " .. created .. " created, " .. skipped .. " skipped")
end

function t.setAllTownsDevActive(active)
	-- This function may not be available in all contexts
	if not game or not game.interface or not game.interface.setTownDevelopmentActive then
		print("[OSM Importer] Warning: setTownDevelopmentActive not available, skipping")
		return
	end
	
	local ok, towns = pcall(function()
		return game.interface.getEntities({radius=math.huge},{type="TOWN"})
	end)
	
	if not ok or not towns then
		print("[OSM Importer] Warning: Could not get towns, skipping town development toggle")
		return
	end
	
	local count = 0
	for _,id in pairs(towns) do
		pcall(function()
			game.interface.setTownDevelopmentActive(id, active)
			count = count + 1
		end)
	end
	print("[OSM Importer] Set " .. count .. " towns development to " .. tostring(active))
end

return t

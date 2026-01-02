local transf = require "transf"
local vec3 = require "vec3"
local constructionutil = require "constructionutil"
local t = require"osm_importer.tools"

local m = {}

-- Model definitions with fallbacks
-- Each entry can be:
--   "model_path.mdl" - single model
--   { primary = "...", fallback = "..." } - with fallback
--   { primary = "...", fallback = "...", mod = "mod_name" } - requires specific mod

-- VERIFIED VANILLA ASSETS (from res/models/model.zip):
-- asset/ampel.mdl - Traffic light (German: Ampel)
-- asset/bench_new.mdl, asset/bench_old.mdl - Benches
-- asset/hydrant_new.mdl, asset/hydrant_old.mdl - Fire hydrants
-- asset/lamp_new.mdl, asset/lamp_old.mdl - Street lamps
-- asset/clock_wall_old.mdl - Wall clock
-- asset/park_fountain_1.mdl - Park fountain
-- asset/park_kiosk_1.mdl - Park kiosk
-- asset/ground/fountain_1.mdl - Ground fountain
-- asset/tram_pole.mdl - Tram pole (generic pole)
-- asset/antenna_01.mdl, asset/antenna_02.mdl - Antennas
-- asset/fence_wood.mdl - Wooden fence
-- asset/barrel_water_wood.mdl, asset/barrel_water_blue.mdl - Barrels

m.modelDefs = {
	-- Trees (vanilla)
	tree = {
		primary = "tree/shingle_oak.mdl",
		variations = {
			"tree/shingle_oak.mdl",
			"tree/norway_maple.mdl",
			"tree/common_lime.mdl",
			"tree/horse_chestnut.mdl",
		},
	},
	tree_conifer = {
		primary = "tree/norway_spruce.mdl",
		variations = {
			"tree/norway_spruce.mdl",
			"tree/scots_pine.mdl",
		},
	},
	
	-- VANILLA ASSETS (always available)
	fountain = {
		primary = "asset/ground/fountain_1.mdl",  -- VANILLA
	},
	bench = {
		primary = "asset/bench_new.mdl",  -- VANILLA
		fallback = "asset/bench_old.mdl",  -- VANILLA
	},
	street_lamp = {
		primary = "asset/lamp_new.mdl",  -- VANILLA
		fallback = "asset/lamp_old.mdl",  -- VANILLA
	},
	traffic_light = {
		primary = "asset/ampel.mdl",  -- VANILLA (German for traffic light)
	},
	fire_hydrant = {
		primary = "asset/hydrant_new.mdl",  -- VANILLA
		fallback = "asset/hydrant_old.mdl",  -- VANILLA
	},
	clock = {
		primary = "asset/clock_wall_old.mdl",  -- VANILLA
	},
	
	-- Objects with mod primary, vanilla fallback
	bollard = {
		primary = "asset/connum_poller_gehweg_rund_1.mdl",
		fallback = "asset/tram_pole.mdl",  -- VANILLA
		mod = "connum_traffic",
	},
	litfass = {
		primary = "asset/sab_LitV2_3.mdl",
		fallback = "asset/park_kiosk_1.mdl",  -- VANILLA
		mod = "sabon_litfass",
	},
	bus_stop = {
		primary = "station/bus/asset/shelter_new_l1.mdl",  -- VANILLA bus shelter!
		fallback = "asset/park_kiosk_1.mdl",  -- VANILLA kiosk fallback
	},
	shelter = {
		primary = "station/bus/asset/shelter_new_l1.mdl",  -- VANILLA bus shelter
		fallback = "asset/park_kiosk_1.mdl",  -- VANILLA kiosk fallback
	},
	bike_rack = {
		primary = "asset/fence_wood.mdl",  -- VANILLA fence as substitute
		fallback = "asset/fence_wood.mdl",  -- VANILLA
	},
	trash_bin = {
		primary = "station/rail/asset/trash_can_01.mdl",  -- VANILLA trash can!
		fallback = "asset/barrel_water_wood.mdl",  -- VANILLA barrel fallback
	},
	post_box = {
		primary = "asset/barrel_water_blue.mdl",  -- VANILLA blue barrel
		fallback = "asset/barrel_water_blue.mdl",  -- VANILLA
	},
	stop_sign = {
		primary = "asset/tram_pole.mdl",  -- VANILLA pole as marker
		fallback = "asset/tram_pole.mdl",  -- VANILLA
	},
	yield_sign = {
		primary = "asset/tram_pole.mdl",  -- VANILLA pole as marker
		fallback = "asset/tram_pole.mdl",  -- VANILLA
	},
	crossing = {
		primary = "asset/tram_pole.mdl",  -- VANILLA pole as marker
		fallback = "asset/tram_pole.mdl",  -- VANILLA
	},
	traffic_mirror = {
		primary = "asset/antenna_01.mdl",  -- VANILLA antenna
		fallback = "asset/antenna_01.mdl",  -- VANILLA
	},
	speed_camera = {
		primary = "asset/antenna_01.mdl",  -- VANILLA antenna
		fallback = "asset/antenna_01.mdl",  -- VANILLA
	},
	phone_booth = {
		primary = "station/rail/asset/telephone_01.mdl",  -- VANILLA telephone!
		fallback = "asset/park_kiosk_1.mdl",  -- VANILLA kiosk fallback
	},
	flagpole = {
		primary = "asset/tram_pole.mdl",  -- VANILLA pole
		fallback = "asset/tram_pole.mdl",  -- VANILLA
	},
}

-- Build the models lookup table from definitions
m.models = {}
m.availableModels = {}  -- Validated at runtime
m.unavailableModels = {}  -- Tracked for logging

-- Initialize models from definitions
function m.initModels()
	for objType, def in pairs(m.modelDefs) do
		if type(def) == "string" then
			m.models[objType] = def
		elseif type(def) == "table" then
			m.models[objType] = def.primary
		end
	end
end

-- Call init on load
m.initModels()

m.postRunFnScript = function()
	for model,mdlfile in pairs(m.models) do
		local con = api.type.ConstructionDesc.new()
		con.type = api.type.enum.ConstructionType.ASSET_DEFAULT
		con.description.name = model
		con.description.description = _("Build your construction")
		con.preProcessScript.fileName = "construction/osm_importer_models.updateFn"
		con.createTemplateScript.fileName = "construction/osm_importer_models.updateFn"
		con.upgradeScript.fileName = "construction/osm_importer_models.updateFn"
		con.updateScript.fileName = "construction/osm_importer_models.updateFn"
		con.updateScript.params = {
			model = model,
			mdl = mdlfile,
		}
		api.res.constructionRep.add("osm_importer/models/"..model, con, false)
	end
end

m.updateFnScript = function(constrParams,scriptParams)
	local result = { }
	result.models = { {
		id = scriptParams.mdl,
		transf = constructionutil.rotateTransf(constrParams, transf.scaleRotZYXTransl(
			vec3.new(1, 1, 1),
			vec3.new(math.rad(0), math.atan(0/1000), 0),
			vec3.new(0, 0, 0) 
		))
	} }
	result.terrainAlignmentLists = { {  -- otherwise BoundingBox is used
		type = "EQUAL",
		faces = {},
	} }
	-- result.groundFaces = { {  -- asset clickable
		-- face = { { 0, 0 }, { 0, 0.01 }, { 0.01, 0 } },
		-- modes = { { type = "FILL", key = "none.lua" } },
	-- } }
	return result
end

-- Validate which models are available at runtime
function m.validateModels()
	m.availableModels = {}
	m.unavailableModels = {}
	
	print("[OSM Models] Validating available models...")
	
	for objType, def in pairs(m.modelDefs) do
		local mdl = nil
		local available = false
		
		if type(def) == "string" then
			mdl = def
			available = api.res.modelRep.find(mdl) >= 0
		elseif type(def) == "table" then
			-- Try primary first
			mdl = def.primary
			available = api.res.modelRep.find(mdl) >= 0
			
			-- Try fallback if primary not available
			if not available and def.fallback then
				mdl = def.fallback
				available = api.res.modelRep.find(mdl) >= 0
			end
		end
		
		if available then
			m.availableModels[objType] = mdl
			print("[OSM Models]   ✓ " .. objType .. " -> " .. mdl)
		else
			m.unavailableModels[objType] = true
			local modNote = (type(def) == "table" and def.mod) and (" (requires: " .. def.mod .. ")") or ""
			print("[OSM Models]   ✗ " .. objType .. " - not available" .. modNote)
		end
	end
	
	local available = 0
	local unavailable = 0
	for _ in pairs(m.availableModels) do available = available + 1 end
	for _ in pairs(m.unavailableModels) do unavailable = unavailable + 1 end
	
	print("[OSM Models] Summary: " .. available .. " available, " .. unavailable .. " unavailable")
	return available, unavailable
end

-- Get a random variation for a tree type
function m.getTreeVariation(objType)
	local def = m.modelDefs[objType]
	if def and def.variations then
		-- Pick a random variation that's available
		local available = {}
		for _, mdl in ipairs(def.variations) do
			if api.res.modelRep.find(mdl) >= 0 then
				table.insert(available, mdl)
			end
		end
		if #available > 0 then
			return available[math.random(#available)]
		end
	end
	return m.availableModels[objType]
end

function m.buildObjects(objects)
	-- Validate models first
	m.validateModels()
	
	print("[OSM Models] Building " .. #objects .. " objects...")
	local built = {}
	local skipped = {}
	
	for i, data in pairs(objects) do
		local objType = data.type
		
		if m.availableModels[objType] then
			local mdl = m.availableModels[objType]
			
			-- Use variations for trees
			if objType == "tree" or objType == "tree_conifer" then
				mdl = m.getTreeVariation(objType) or mdl
			end
			
			local ok, err = pcall(function()
				-- Pass both objType (for construction name) and mdl (for model path)
				m.buildModelByType(data.pos, objType, mdl)
			end)
			
			if ok then
				built[objType] = (built[objType] or 0) + 1
			else
				print("[OSM Models] Failed to build " .. objType .. " at " .. tostring(data.pos[1]) .. "," .. tostring(data.pos[2]) .. ": " .. tostring(err))
			end
		else
			skipped[objType] = (skipped[objType] or 0) + 1
		end
	end
	
	print("[OSM Models] Built: " .. toString(built))
	if next(skipped) then
		print("[OSM Models] Skipped (missing models): " .. toString(skipped))
	end
end

-- Build model by object type (uses registered construction)
function m.buildModelByType(pos, objType, mdlPath)
	-- The construction was registered using the objType, not the mdl file path
	local conName = "osm_importer/models/" .. objType
	
	if api.res.constructionRep.find(conName) < 0 then
		-- Not registered yet, try to register it
		print("[OSM Models] Registering construction: " .. conName)
		m.registerConstructionForType(objType, mdlPath)
	end
	
	m.buildCon(pos, conName)
end

-- Register a construction for a specific object type
function m.registerConstructionForType(objType, mdlPath)
	local conName = "osm_importer/models/" .. objType
	
	local con = api.type.ConstructionDesc.new()
	con.type = api.type.enum.ConstructionType.ASSET_DEFAULT
	con.description.name = objType
	con.description.description = _("OSM Importer Object")
	con.preProcessScript.fileName = "construction/osm_importer_models.updateFn"
	con.createTemplateScript.fileName = "construction/osm_importer_models.updateFn"
	con.upgradeScript.fileName = "construction/osm_importer_models.updateFn"
	con.updateScript.fileName = "construction/osm_importer_models.updateFn"
	con.updateScript.params = {
		model = objType,
		mdl = mdlPath,
	}
	api.res.constructionRep.add(conName, con, false)
end

-- Build model directly with path
function m.buildModelDirect(pos, mdlPath)
	local con = "osm_importer/models/" .. mdlPath:gsub("/", "_"):gsub("%.mdl$", "")
	if api.res.constructionRep.find(con) < 0 then
		-- Construction not registered, register it now
		m.registerConstruction(mdlPath)
	end
	
	m.buildCon(pos, con)
end

-- Register a construction for a model
function m.registerConstruction(mdlPath)
	local conName = "osm_importer/models/" .. mdlPath:gsub("/", "_"):gsub("%.mdl$", "")
	
	local con = api.type.ConstructionDesc.new()
	con.type = api.type.enum.ConstructionType.ASSET_DEFAULT
	con.description.name = mdlPath
	con.description.description = _("OSM Importer Object")
	con.preProcessScript.fileName = "construction/osm_importer_models.updateFn"
	con.createTemplateScript.fileName = "construction/osm_importer_models.updateFn"
	con.upgradeScript.fileName = "construction/osm_importer_models.updateFn"
	con.updateScript.fileName = "construction/osm_importer_models.updateFn"
	con.updateScript.params = {
		model = mdlPath:gsub("/", "_"):gsub("%.mdl$", ""),
		mdl = mdlPath,
	}
	api.res.constructionRep.add(conName, con, false)
end

function m.buildModel(pos, modelType)
	local mdl = m.availableModels[modelType]
	if not mdl then
		print("[OSM Models] Cannot build '" .. modelType .. "' - model not available")
		return false
	end
	m.buildModelDirect(pos, mdl)
	return true
end

function m.buildCon(pos, con)
	if api.res.constructionRep.find(con) < 0 then
		print("[OSM Models] Construction not found: " .. con)
		return false
	end
	
	local c = api.type.SimpleProposal.ConstructionEntity.new()
	c.fileName = con
	-- c.playerEntity=api.engine.util.getPlayer()
	c.params = {
		seed = math.random(0, 999),  -- Random seed for variation
		paramX = 0,
		paramY = 0,
	}
	
	-- Get terrain height
	local terrainZ = t.getTerrainZ(pos[1], pos[2]) or 0
	
	-- Random rotation for natural objects like trees
	local rotation = 0
	if con:find("tree") then
		rotation = math.random() * math.pi * 2
	end
	
	-- Create transformation matrix
	local cos_r = math.cos(rotation)
	local sin_r = math.sin(rotation)
	local transform = { 
		cos_r, sin_r, 0, 0,   -- rotation X axis
		-sin_r, cos_r, 0, 0,  -- rotation Y axis
		0, 0, 1, 0,           -- Z axis
		pos[1], pos[2], terrainZ, 1  -- translation
	}
	
	for i = 1, 16 do
		c.transf[i] = transform[i]
	end
	
	local p = api.type.SimpleProposal.new()
	p.constructionsToAdd[1] = c
	
	local ok, err = pcall(function()
		api.cmd.sendCommand(api.cmd.make.buildProposal(p, nil, true))  -- ignoreErrors = true
	end)
	
	if not ok then
		print("[OSM Models] Error building construction: " .. tostring(err))
		return false
	end
	
	return true
end

-- Legacy function - now uses validateModels instead
function m.modelrestest()
	local available, unavailable = m.validateModels()
	if unavailable > 0 then
		print("[OSM Models] WARNING: " .. unavailable .. " model types unavailable - some objects will be skipped")
	end
	return available > 0
end

return m
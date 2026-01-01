local bt = {}

-- VANILLA fallback bridges (always available)
local VANILLA_BRIDGE = "stone.lua"  -- Standard vanilla bridge
local VANILLA_STREET_BRIDGE = "cement.lua"  -- Vanilla street bridge

------------- Mods (may not be installed - use with fallback!)

-- Autobahn_Kreuz_1
local autobahn = "Autobahn_aq.lua"  -- 2 thin pillars, green railing

-- 2187434173 TFMR2.0 Bridge (Transport Fever Modular Road)
local tfmr = {
	thick = "epbridge_thick.lua",
	thin = "epbridge_thin.lua",
	nopillar = "epbridge_no_pillar.lua",
}

-- 2363493916
local ped_erac = "lollo_freestyle_train_station/pedestrian_basic_no_pillars_era_c.lua"  -- flat

-- 1939805466
local ang_t1 = "angier_bridge_t1.lua"  -- grey concrete, pillar

-- ritknat_gitterbruecke_1
local greengitter = "gitterbruecke_o.lua"  -- no pillar, medium flat

-- ritknat_fachwerke_1
-- local rit_t2v3n = "angier_bridge_t2_v3_n.lua"  -- no railing, no pillar

-- 2858595053 Straßen- und Schienenbaukasten
-- local pl_cement = "plo_cement.lua" -- vanilla beton, without pillar

-- 2060132685 Vienna Fever: Bridge and Retaining Wall
local invisible = "vienna_fever_infra_leere_bruecke.lua"

-- Helper to check if a bridge type exists
local function bridgeExists(bridgeType)
	if not bridgeType then return false end
	local ok, idx = pcall(function()
		return api.res.bridgeTypeRep.find(bridgeType)
	end)
	return ok and idx and idx >= 0
end

-- Get bridge with fallback to vanilla
local function getWithFallback(preferred, fallback)
	if bridgeExists(preferred) then
		return preferred
	end
	return fallback or VANILLA_BRIDGE
end


bt.streettypes = {
	motorway = autobahn,
	trunk = autobahn,
	motorway_link = tfmr.thin,
	trunk_link = tfmr.thin,
	primary = ang_t1,
	secondary = ang_t1,
	tertiary = ang_t1,
	primary_link = tfmr.thin,
	secondary_link = tfmr.thin,
	tertiary_link = tfmr.thin,
	residential = tfmr.thick,
	living_street = tfmr.thick,
	unclassified = ang_t1,
	service = ang_t1,
	construction = tfmr.thick,
	pedestrian = ped_erac,
	track = ped_erac,
	footway = ped_erac,
	path = ped_erac,
	bridleway = ped_erac,
	cycleway = ang_t1,
}

function bt.getType(data)
	if data.track then
		-- For tracks, try invisible bridge first, fall back to vanilla stone
		local preferred = invisible
		if bridgeExists(preferred) then
			return preferred
		end
		-- Fallback to vanilla bridge for tracks
		print("[Bridge] Using vanilla fallback for track bridge (invisible bridge not installed)")
		return VANILLA_BRIDGE
	else 
		local btype = bt.streettypes[data.street.type]
		if not btype then
			print("[Bridge] No Bridge Type for street type: " .. tostring(data.street.type) .. ", using vanilla")
			return VANILLA_STREET_BRIDGE
		end
		-- Check if preferred bridge exists, fallback to vanilla
		if bridgeExists(btype) then
			return btype
		end
		print("[Bridge] Bridge type '" .. btype .. "' not found, using vanilla fallback")
		return VANILLA_STREET_BRIDGE
	end
end

return bt
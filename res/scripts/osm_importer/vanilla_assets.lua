-- Comprehensive list of VANILLA Transport Fever 2 assets
-- These are always available without any mods
-- File paths are relative to /res/config/<type>/

local vanilla = {}

-- ============================================================================
-- TRACK TYPES (relative to /res/config/track/)
-- ============================================================================
vanilla.tracks = {
    "standard.lua",           -- Standard tracks (120 km/h)
    "high_speed.lua",         -- High-speed tracks
}
vanilla.track_fallback = "standard.lua"

-- ============================================================================
-- STREET TYPES (relative to /res/config/street/)
-- ============================================================================
vanilla.streets = {
    -- Standard streets (in standard/ subdirectory)
    "standard/country_small_new.lua",
    "standard/country_small_old.lua",
    "standard/country_small_one_way_new.lua",
    "standard/country_medium_new.lua",
    "standard/country_medium_old.lua",
    "standard/country_medium_one_way_new.lua",
    "standard/country_large_new.lua",
    "standard/country_large_old.lua",
    "standard/country_large_one_way_new.lua",
    "standard/country_x_large_new.lua",
    
    "standard/town_small_new.lua",
    "standard/town_small_old.lua",
    "standard/town_small_one_way_new.lua",
    "standard/town_medium_new.lua",
    "standard/town_medium_old.lua",
    "standard/town_medium_one_way_new.lua",
    "standard/town_large_new.lua",
    "standard/town_large_old.lua",
    "standard/town_large_one_way_new.lua",
    "standard/town_x_large_new.lua",
    
    -- Airport streets
    "airport/airport_runway_large.lua",
    "airport/airport_runway_medium.lua",
    "airport/airport_runway_medium_era_b.lua",
    "airport/airport_runway_small.lua",
    "airport/airport_runway_old_grass.lua",
    "airport/airport_taxiway_medium.lua",
    "airport/airport_taxiway_medium_era_b.lua",
    "airport/airport_taxiway_small.lua",
    "airport/airport_taxiway_old_grass.lua",
    
    -- Water
    "water/ship_street.lua",
}

-- Fallbacks in order of preference (first available wins)
vanilla.street_fallbacks = {
    "standard/country_small_new.lua",  -- Small 2-lane country road
    "standard/town_small_new.lua",     -- Small town road with sidewalks
    "standard/country_medium_new.lua", -- Medium country road
}
vanilla.street_fallback = "standard/country_small_new.lua"

-- ============================================================================
-- BRIDGE TYPES (relative to /res/config/bridge/)
-- ============================================================================
vanilla.bridges = {
    "stone.lua",       -- Stone bridge (old style)
    "cement.lua",      -- Cement/concrete bridge
    "iron.lua",        -- Iron bridge
    "cable.lua",       -- Cable-stayed bridge
    "suspension.lua",  -- Suspension bridge
    "placeholder.lua", -- Invisible/placeholder bridge
}
vanilla.bridge_fallback = "stone.lua"
vanilla.bridge_fallback_street = "cement.lua"

-- ============================================================================
-- TUNNEL TYPES (relative to /res/config/tunnel/)
-- ============================================================================
vanilla.tunnels = {
    "railroad_old.lua",  -- Railroad tunnel
    "street_old.lua",    -- Street tunnel
    "placeholder.lua",   -- Placeholder tunnel
}
vanilla.tunnel_fallback_rail = "railroad_old.lua"
vanilla.tunnel_fallback_street = "street_old.lua"

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Find first available type from a list
function vanilla.findFirstAvailable(typeRep, typeList)
    for _, typeName in ipairs(typeList) do
        local id = typeRep.find(typeName)
        if id >= 0 then
            return typeName, id
        end
    end
    return nil, -1
end

-- Get a working street fallback
function vanilla.getStreetFallback()
    for _, fallback in ipairs(vanilla.street_fallbacks) do
        local id = api.res.streetTypeRep.find(fallback)
        if id >= 0 then
            print("[Vanilla] Using street fallback: " .. fallback)
            return fallback, id
        end
    end
    print("[Vanilla] ERROR: No vanilla street fallback found!")
    return nil, -1
end

-- Get a working track fallback  
function vanilla.getTrackFallback()
    local id = api.res.trackTypeRep.find(vanilla.track_fallback)
    if id >= 0 then
        return vanilla.track_fallback, id
    end
    print("[Vanilla] ERROR: No vanilla track fallback found!")
    return nil, -1
end

-- Get a working bridge fallback
function vanilla.getBridgeFallback(isStreet)
    local fallback = isStreet and vanilla.bridge_fallback_street or vanilla.bridge_fallback
    local id = api.res.bridgeTypeRep.find(fallback)
    if id >= 0 then
        return fallback, id
    end
    -- Try other bridges
    for _, bridge in ipairs(vanilla.bridges) do
        id = api.res.bridgeTypeRep.find(bridge)
        if id >= 0 then
            print("[Vanilla] Using bridge fallback: " .. bridge)
            return bridge, id
        end
    end
    print("[Vanilla] ERROR: No vanilla bridge fallback found!")
    return nil, -1
end

-- Get a working tunnel fallback
function vanilla.getTunnelFallback(isStreet)
    local fallback = isStreet and vanilla.tunnel_fallback_street or vanilla.tunnel_fallback_rail
    local id = api.res.tunnelTypeRep.find(fallback)
    if id >= 0 then
        return fallback, id
    end
    print("[Vanilla] ERROR: No vanilla tunnel fallback found!")
    return nil, -1
end

-- Debug: print all available vanilla assets
function vanilla.debugPrintAvailable()
    print("[Vanilla] Checking available vanilla assets...")
    
    print("[Vanilla] Tracks:")
    for _, t in ipairs(vanilla.tracks) do
        local id = api.res.trackTypeRep.find(t)
        print("  " .. t .. " = " .. (id >= 0 and "OK (id=" .. id .. ")" or "NOT FOUND"))
    end
    
    print("[Vanilla] Streets (sample):")
    local sample_streets = {
        "standard/country_small_new.lua",
        "standard/town_small_new.lua",
        "standard/town_medium_new.lua",
    }
    for _, s in ipairs(sample_streets) do
        local id = api.res.streetTypeRep.find(s)
        print("  " .. s .. " = " .. (id >= 0 and "OK (id=" .. id .. ")" or "NOT FOUND"))
    end
    
    print("[Vanilla] Bridges:")
    for _, b in ipairs(vanilla.bridges) do
        local id = api.res.bridgeTypeRep.find(b)
        print("  " .. b .. " = " .. (id >= 0 and "OK (id=" .. id .. ")" or "NOT FOUND"))
    end
    
    print("[Vanilla] Tunnels:")
    for _, t in ipairs(vanilla.tunnels) do
        local id = api.res.tunnelTypeRep.find(t)
        print("  " .. t .. " = " .. (id >= 0 and "OK (id=" .. id .. ")" or "NOT FOUND"))
    end
end

return vanilla


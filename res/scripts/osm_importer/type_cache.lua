-- Type Cache: Pre-validates and caches all street/track/bridge/tunnel type IDs
-- This avoids repeated api.res.*.find() calls during import

local streettypes = require"osm_importer.types_street"
local tracktypes = require"osm_importer.types_track"
local bridgetypes = require"osm_importer.types_bridge"
local tunneltypes = require"osm_importer.types_tunnel"

local tc = {}

-- Caches
tc.streetIds = {}      -- name -> id
tc.trackIds = {}       -- name -> id
tc.bridgeIds = {}      -- name -> id
tc.tunnelIds = {}      -- name -> id

-- Fallback IDs
tc.streetFallback = -1
tc.trackFallback = -1
tc.bridgeFallback = -1
tc.tunnelFallback = -1

-- Stats
tc.stats = {
    streets_found = 0,
    streets_missing = 0,
    tracks_found = 0,
    tracks_missing = 0,
    bridges_found = 0,
    bridges_missing = 0,
    tunnels_found = 0,
    tunnels_missing = 0,
}

tc.initialized = false

-- Initialize the cache - call once at import start
function tc.initialize()
    if tc.initialized then return end
    
    print("[TypeCache] Initializing type cache...")
    local startTime = os.clock()
    
    -- Reset caches
    tc.streetIds = {}
    tc.trackIds = {}
    tc.bridgeIds = {}
    tc.tunnelIds = {}
    tc.stats = {
        streets_found = 0, streets_missing = 0,
        tracks_found = 0, tracks_missing = 0,
        bridges_found = 0, bridges_missing = 0,
        tunnels_found = 0, tunnels_missing = 0,
    }
    
    -- Find fallbacks first
    tc.streetFallback = tc.findStreetFallback()
    tc.trackFallback = tc.findTrackFallback()
    tc.bridgeFallback = tc.findBridgeFallback()
    tc.tunnelFallback = tc.findTunnelFallback()
    
    local elapsed = os.clock() - startTime
    print(string.format("[TypeCache] Initialized in %.2f seconds", elapsed))
    print(string.format("[TypeCache] Fallbacks: street=%d, track=%d, bridge=%d, tunnel=%d",
        tc.streetFallback, tc.trackFallback, tc.bridgeFallback, tc.tunnelFallback))
    
    tc.initialized = true
end

-- Find street fallback
-- Prefer country roads (no sidewalks) over town roads for better connections
function tc.findStreetFallback()
    local vanillaNames = {
        "standard/country_small_new.lua",  -- Priority: country road without sidewalks
        "standard/country_medium_new.lua",
        "country_small_new.lua",
        "standard/town_small_new.lua",  -- Town roads have sidewalks (less preferred)
        "town_small_new.lua",
    }
    for _, name in ipairs(vanillaNames) do
        local id = api.res.streetTypeRep.find(name)
        if id >= 0 then
            print("[TypeCache] Street fallback: " .. name .. " (id=" .. id .. ")")
            return id
        end
    end
    -- Use first available
    if api.res.streetTypeRep.getCount() > 0 then
        print("[TypeCache] Street fallback: using first type (id=0)")
        return 0
    end
    print("[TypeCache] WARNING: No street fallback found!")
    return -1
end

-- Find track fallback
function tc.findTrackFallback()
    local vanillaNames = { "standard.lua", "high_speed.lua" }
    for _, name in ipairs(vanillaNames) do
        local id = api.res.trackTypeRep.find(name)
        if id >= 0 then
            print("[TypeCache] Track fallback: " .. name .. " (id=" .. id .. ")")
            return id
        end
    end
    if api.res.trackTypeRep.getCount() > 0 then
        return 0
    end
    return -1
end

-- Find bridge fallback
function tc.findBridgeFallback()
    local vanillaNames = { "stone.lua", "cement.lua", "iron.lua" }
    for _, name in ipairs(vanillaNames) do
        local id = api.res.bridgeTypeRep.find(name)
        if id >= 0 then
            print("[TypeCache] Bridge fallback: " .. name .. " (id=" .. id .. ")")
            return id
        end
    end
    if api.res.bridgeTypeRep.getCount() > 0 then
        return 0
    end
    return -1
end

-- Find tunnel fallback
function tc.findTunnelFallback()
    local vanillaNames = { "railroad_old.lua", "street_old.lua" }
    for _, name in ipairs(vanillaNames) do
        local id = api.res.tunnelTypeRep.find(name)
        if id >= 0 then
            print("[TypeCache] Tunnel fallback: " .. name .. " (id=" .. id .. ")")
            return id
        end
    end
    if api.res.tunnelTypeRep.getCount() > 0 then
        return 0
    end
    return -1
end

-- Get street type ID (cached)
function tc.getStreetId(name)
    if not name or name == "" then return -1 end
    
    -- Check cache first
    if tc.streetIds[name] ~= nil then
        return tc.streetIds[name]
    end
    
    -- Look up and cache
    local id = api.res.streetTypeRep.find(name)
    if id >= 0 then
        tc.streetIds[name] = id
        tc.stats.streets_found = tc.stats.streets_found + 1
    else
        tc.streetIds[name] = tc.streetFallback  -- Cache fallback for this name
        tc.stats.streets_missing = tc.stats.streets_missing + 1
    end
    
    return tc.streetIds[name]
end

-- Get track type ID (cached)
function tc.getTrackId(name)
    if not name or name == "" then return -1 end
    
    if tc.trackIds[name] ~= nil then
        return tc.trackIds[name]
    end
    
    local id = api.res.trackTypeRep.find(name)
    if id >= 0 then
        tc.trackIds[name] = id
        tc.stats.tracks_found = tc.stats.tracks_found + 1
    else
        tc.trackIds[name] = tc.trackFallback
        tc.stats.tracks_missing = tc.stats.tracks_missing + 1
    end
    
    return tc.trackIds[name]
end

-- Get bridge type ID (cached)
function tc.getBridgeId(name)
    if not name or name == "" then return -1 end
    
    if tc.bridgeIds[name] ~= nil then
        return tc.bridgeIds[name]
    end
    
    local id = api.res.bridgeTypeRep.find(name)
    if id >= 0 then
        tc.bridgeIds[name] = id
        tc.stats.bridges_found = tc.stats.bridges_found + 1
    else
        tc.bridgeIds[name] = tc.bridgeFallback
        tc.stats.bridges_missing = tc.stats.bridges_missing + 1
    end
    
    return tc.bridgeIds[name]
end

-- Get tunnel type ID (cached)
function tc.getTunnelId(name)
    if not name or name == "" then return -1 end
    
    if tc.tunnelIds[name] ~= nil then
        return tc.tunnelIds[name]
    end
    
    local id = api.res.tunnelTypeRep.find(name)
    if id >= 0 then
        tc.tunnelIds[name] = id
        tc.stats.tunnels_found = tc.stats.tunnels_found + 1
    else
        tc.tunnelIds[name] = tc.tunnelFallback
        tc.stats.tunnels_missing = tc.stats.tunnels_missing + 1
    end
    
    return tc.tunnelIds[name]
end

-- Print cache statistics
function tc.printStats()
    print("[TypeCache] Statistics:")
    print(string.format("  Streets: %d found, %d missing (using fallback)", 
        tc.stats.streets_found, tc.stats.streets_missing))
    print(string.format("  Tracks: %d found, %d missing", 
        tc.stats.tracks_found, tc.stats.tracks_missing))
    print(string.format("  Bridges: %d found, %d missing", 
        tc.stats.bridges_found, tc.stats.bridges_missing))
    print(string.format("  Tunnels: %d found, %d missing", 
        tc.stats.tunnels_found, tc.stats.tunnels_missing))
    print(string.format("  Cache sizes: streets=%d, tracks=%d, bridges=%d, tunnels=%d",
        tc.tableSize(tc.streetIds), tc.tableSize(tc.trackIds), 
        tc.tableSize(tc.bridgeIds), tc.tableSize(tc.tunnelIds)))
end

function tc.tableSize(t)
    local count = 0
    for _ in pairs(t) do count = count + 1 end
    return count
end

-- Reset cache (for reloading)
function tc.reset()
    tc.streetIds = {}
    tc.trackIds = {}
    tc.bridgeIds = {}
    tc.tunnelIds = {}
    tc.initialized = false
end

return tc


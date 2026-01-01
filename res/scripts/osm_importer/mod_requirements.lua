-- Mod Requirements Module (Simplified)
-- Just counts resources and provides helpful info
-- Core mod detection is done in osm_importer_button.lua

local mr = {}

-- Count resources from the game's repositories
function mr.countResources()
    local result = {
        tracks = 0,
        streets = 0,
        bridges = 0,
        trackList = {},
        streetList = {},
        bridgeList = {},
    }
    
    -- Count track types
    if api and api.res and api.res.trackTypeRep then
        local ok, count = pcall(function()
            return api.res.trackTypeRep.getCount()
        end)
        if ok and count then
            result.tracks = count
            -- Get some track names for detection
            for i = 0, math.min(count - 1, 50) do
                local nameOk, name = pcall(function()
                    return api.res.trackTypeRep.getName(i)
                end)
                if nameOk and name then
                    table.insert(result.trackList, name)
                end
            end
        end
    end
    
    -- Count street types
    if api and api.res and api.res.streetTypeRep then
        local ok, count = pcall(function()
            return api.res.streetTypeRep.getCount()
        end)
        if ok and count then
            result.streets = count
            for i = 0, math.min(count - 1, 50) do
                local nameOk, name = pcall(function()
                    return api.res.streetTypeRep.getName(i)
                end)
                if nameOk and name then
                    table.insert(result.streetList, name)
                end
            end
        end
    end
    
    -- Count bridge types
    if api and api.res and api.res.bridgeTypeRep then
        local ok, count = pcall(function()
            return api.res.bridgeTypeRep.getCount()
        end)
        if ok and count then
            result.bridges = count
            for i = 0, math.min(count - 1, 20) do
                local nameOk, name = pcall(function()
                    return api.res.bridgeTypeRep.getName(i)
                end)
                if nameOk and name then
                    table.insert(result.bridgeList, name)
                end
            end
        end
    end
    
    return result
end

-- Detect mod packs by looking at resource names
function mr.detectModPacks(resources)
    local packs = {}
    
    -- Patterns to look for in resource names
    local patterns = {
        { pattern = "vienna", name = "Vienna Fever" },
        { pattern = "nep", name = "NEP2" },
        { pattern = "rtp", name = "RTP Roads" },
        { pattern = "fusswege", name = "RTP Fusswege" },
        { pattern = "tfmr", name = "TFMR" },
        { pattern = "epbridge", name = "EP Bridge" },
        { pattern = "ballast", name = "Ballast Pack" },
        { pattern = "old_track", name = "Old Track Pack" },
        { pattern = "smp", name = "SMP Streets" },
        { pattern = "lollo", name = "Lollo Mods" },
    }
    
    local allResources = {}
    for _, name in ipairs(resources.trackList or {}) do
        table.insert(allResources, name:lower())
    end
    for _, name in ipairs(resources.streetList or {}) do
        table.insert(allResources, name:lower())
    end
    for _, name in ipairs(resources.bridgeList or {}) do
        table.insert(allResources, name:lower())
    end
    
    for _, p in ipairs(patterns) do
        for _, res in ipairs(allResources) do
            if res:find(p.pattern) then
                packs[p.name] = true
                break
            end
        end
    end
    
    local result = {}
    for name, _ in pairs(packs) do
        table.insert(result, name)
    end
    table.sort(result)
    
    return result
end

-- Main check function
function mr.checkRequirements(osmdata)
    local resources = mr.countResources()
    local packs = mr.detectModPacks(resources)
    
    return {
        resources = resources,
        installedPacks = packs,
        -- Legacy compatibility
        coreInstalled = {},
        coreMissing = {},
        totalInstalled = #packs,
        totalMissing = 0,
    }
end

return mr

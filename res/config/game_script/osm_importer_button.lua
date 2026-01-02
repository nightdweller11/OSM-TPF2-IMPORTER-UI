-- OSM Importer UI - Auto-checking Version
-- Runs all checks automatically when window opens

-- Global state that persists
_G.OSM_UI = _G.OSM_UI or {
    window = nil,
    trigger = nil,
    statusText = nil,
    logText = nil,
    logLines = {},
    initialized = false,
    checksComplete = false,
    readyToImport = false,
    osmDataInfo = nil,
    missingResources = {},
    availableMods = {},
    options = {
        build_streets = true,
        build_tracks = true,
        build_bridges = true,
        build_tunnels = false,
        build_signals = true,
        build_forests = true,
        build_surfaces = true,
        build_towns = true,  -- Create town labels
        build_objects = true,  -- Build decorative objects
        use_way_batching = true,  -- Batch edges for faster import (disable if roads don't connect)
    }
}

local S = _G.OSM_UI
local MAX_LOG_LINES = 12

-- Add to in-game log display
local function addLog(msg)
    local line = os.date("%H:%M:%S") .. " " .. tostring(msg)
    table.insert(S.logLines, line)
    
    while #S.logLines > MAX_LOG_LINES do
        table.remove(S.logLines, 1)
    end
    
    if S.logText then
        pcall(function()
            S.logText:setText(table.concat(S.logLines, "\n"))
        end)
    end
    
    print("[OSM-UI] " .. line)
end

local function setStatus(msg)
    if S.statusText then
        pcall(function() S.statusText:setText("Status: " .. msg) end)
    end
end

-- Check if a resource exists
local function resourceExists(repName, resourceId)
    if not resourceId then return false end
    local ok, result = pcall(function()
        local rep = api.res[repName]
        if rep and rep.find then
            local id = rep.find(resourceId)
            return id ~= nil and id >= 0
        end
        return false
    end)
    return ok and result
end

-- Scan osmdata for summary info
local function scanOsmDataResources()
    addLog("Scanning data structure...")
    
    local ok, osmdata = pcall(function()
        return require "osm_importer.osmdata"
    end)
    
    if not ok or not osmdata then
        return nil
    end
    
    local summary = {
        tracksCount = 0,
        streetsCount = 0,
        bridgesCount = 0,
        tunnelsCount = 0,
        objectsCount = 0,
        forestsCount = 0,
        groundsCount = 0,
    }
    
    -- Scan edges
    if osmdata.edges then
        for i, edge in ipairs(osmdata.edges) do
            if edge.track then
                summary.tracksCount = summary.tracksCount + 1
            elseif edge.street then
                summary.streetsCount = summary.streetsCount + 1
            end
            if edge.bridge then
                summary.bridgesCount = summary.bridgesCount + 1
            end
            if edge.tunnel then
                summary.tunnelsCount = summary.tunnelsCount + 1
            end
        end
    end
    
    -- Scan objects
    if osmdata.objects then
        summary.objectsCount = #osmdata.objects
    end
    
    -- Scan areas
    if osmdata.areas then
        if osmdata.areas.forests then
            summary.forestsCount = #osmdata.areas.forests
        end
        if osmdata.areas.grounds then
            summary.groundsCount = #osmdata.areas.grounds
        end
    end
    
    return summary
end

-- Check core required resources
local function checkCoreResources()
    local issues = {}
    
    -- Check vanilla track type
    if not resourceExists("trackTypeRep", "standard.lua") then
        table.insert(issues, "Vanilla tracks not found")
    end
    
    -- Check vanilla street type  
    if not resourceExists("streetTypeRep", "country_small_new.lua") then
        table.insert(issues, "Vanilla streets not found")
    end
    
    -- Check vanilla bridge
    if not resourceExists("bridgeTypeRep", "stone.lua") then
        table.insert(issues, "Vanilla bridges not found")
    end
    
    return issues
end

-- Check core mods
local function checkCoreMods()
    S.availableMods = {}
    S.modVersions = {}
    
    -- Forester uses: require "snowball/forester/forester"
    local hasForester = false
    local foresterOk = pcall(function()
        require "snowball/forester/forester"
    end)
    if foresterOk then
        hasForester = true
    end
    
    -- Also check if our forester module can load
    local foresterScriptOk = pcall(function()
        require "osm_importer.forester"
    end)
    S.availableMods.forester = hasForester and foresterScriptOk
    
    print("[OSM-UI] Forester: snowball/forester/forester=" .. tostring(foresterOk) .. ", script=" .. tostring(foresterScriptOk))
    
    -- Paver uses: require "paver.main"
    local hasPaver = false
    local paverOk = pcall(function()
        require "paver.main"
    end)
    if paverOk then
        hasPaver = true
    end
    
    local paverScriptOk = pcall(function()
        require "osm_importer.paver"
    end)
    S.availableMods.paver = hasPaver and paverScriptOk
    
    print("[OSM-UI] Paver: paver.main=" .. tostring(paverOk) .. ", script=" .. tostring(paverScriptOk))
    
    return S.availableMods.forester, S.availableMods.paver
end

-- Run all automatic checks
local function runAllChecks()
    S.checksComplete = false
    S.readyToImport = false
    S.logLines = {}
    
    addLog("=== AUTOMATIC CHECKS ===")
    
    -- 1. Check for osmdata
    addLog("Loading osmdata.lua...")
    local ok, osmdata = pcall(function()
        return require "osm_importer.osmdata"
    end)
    
    if not ok or not osmdata or not osmdata.edges then
        addLog("✗ osmdata.lua NOT FOUND")
        addLog("")
        addLog("Place file in mod folder:")
        addLog("res/scripts/osm_importer/")
        setStatus("NO DATA FILE")
        S.checksComplete = true
        return
    end
    
    -- 2. Data summary
    local edgeCount = #osmdata.edges
    local townCount = osmdata.towns and #osmdata.towns or 0
    local areaCount = osmdata.areas and (
        (#(osmdata.areas.forests or {})) + 
        (#(osmdata.areas.grounds or {}))
    ) or 0
    local objCount = osmdata.objects and #osmdata.objects or 0
    
    S.osmDataInfo = {
        edges = edgeCount,
        towns = townCount,
        areas = areaCount,
        objects = objCount,
        bounds = osmdata.bounds,
    }
    
    addLog("✓ Data loaded:")
    addLog("  " .. edgeCount .. " edges, " .. townCount .. " towns")
    addLog("  " .. areaCount .. " areas, " .. objCount .. " objects")
    
    -- Estimate time
    local estMinutes = math.ceil(edgeCount / 5 / 60)
    if estMinutes > 60 then
        addLog("⚠️ Est. time: " .. math.floor(estMinutes/60) .. "h " .. (estMinutes%60) .. "m")
    else
        addLog("  Est. time: ~" .. estMinutes .. " minutes")
    end
    
    -- 3. Check map bounds and show OSM vs TPF2 dimensions
    addLog("")
    addLog("Map dimensions:")
    
    -- Current TPF2 map size
    local mapOk, mapSize = pcall(function()
        return api.engine.terrain.getHeightmapSize()
    end)
    if mapOk and mapSize then
        -- TPF2 map is (heightmapSize - 1) * 16 meters
        local mapWidthM = (mapSize.x - 1) * 16
        local mapHeightM = (mapSize.y - 1) * 16
        addLog("  TPF2 map: " .. string.format("%.1f", mapWidthM/1000) .. " x " .. string.format("%.1f", mapHeightM/1000) .. " km")
    end
    
    -- OSM source dimensions (from Python conversion)
    if osmdata.bounds then
        local b = osmdata.bounds
        if b.osm_width_km and b.osm_height_km then
            addLog("  OSM source: " .. b.osm_width_km .. " x " .. b.osm_height_km .. " km")
            if b.scale then
                addLog("  Scale: 1:" .. string.format("%.0f", b.scale))
            end
        elseif b.maxX and b.minX then
            -- Old format: data extent in meters
            local w = math.abs(b.maxX - b.minX)
            local h = math.abs(b.maxY - b.minY)
            addLog("  Data extent: " .. math.floor(w) .. " x " .. math.floor(h) .. "m")
        end
        
        -- Show preprocessing stats if available
        if osmdata.preprocess_stats then
            local ps = osmdata.preprocess_stats
            if ps.filtered_edges and ps.filtered_edges > 0 then
                addLog("  Pre-filtered: " .. ps.filtered_edges .. " out-of-bounds edges removed")
            end
        end
    end
    
    -- 4. Check core mods
    addLog("")
    addLog("Checking core mods...")
    local hasForester, hasPaver = checkCoreMods()
    
    if hasForester then
        local verStr = S.modVersions.forester and (" v" .. S.modVersions.forester) or ""
        addLog("✓ Forester" .. verStr .. ": ready")
    else
        addLog("❌ Forester: NOT FOUND")
        addLog("   Need: Forester v1.4+ Interface")
        addLog("   Download from transportfever.net")
        addLog("   (forests will be skipped)")
    end
    
    if hasPaver then
        addLog("✓ Paver: ready")
    else
        addLog("❌ Paver: NOT FOUND")
        addLog("   Download from transportfever.net")
        addLog("   (surfaces will be skipped)")
    end
    
    -- 5. Scan data structure
    addLog("")
    local summary = scanOsmDataResources()
    
    if summary then
        addLog("Data breakdown:")
        addLog("  Tracks: " .. summary.tracksCount .. 
               ", Streets: " .. summary.streetsCount)
        addLog("  Bridges: " .. summary.bridgesCount .. 
               ", Tunnels: " .. summary.tunnelsCount)
        addLog("  Forests: " .. summary.forestsCount .. 
               ", Surfaces: " .. summary.groundsCount)
        addLog("  Objects: " .. summary.objectsCount)
        S.dataSummary = summary
    end
    
    -- 6. Check core resources
    addLog("")
    addLog("Checking core resources...")
    local coreIssues = checkCoreResources()
    S.missingResources = coreIssues
    
    if #coreIssues == 0 then
        addLog("✓ Core resources available")
    else
        for _, issue in ipairs(coreIssues) do
            addLog("⚠️ " .. issue)
        end
    end
    
    -- 7. Count available resources
    addLog("")
    addLog("Counting game resources...")
    
    local modReqOk, modReq = pcall(function()
        return require("osm_importer.mod_requirements")
    end)
    
    if modReqOk and modReq then
        local checkOk, result = pcall(function()
            return modReq.checkRequirements(osmdata)
        end)
        
        if checkOk and result then
            S.modRequirements = result
            
            -- Show resource counts
            if result.resources then
                addLog("Available in game:")
                addLog("  " .. result.resources.tracks .. " track types")
                addLog("  " .. result.resources.streets .. " street types")
                addLog("  " .. result.resources.bridges .. " bridge types")
            end
            
            -- Show detected mod packs
            if result.installedPacks and #result.installedPacks > 0 then
                addLog("")
                addLog("Detected mods:")
                for _, packName in ipairs(result.installedPacks) do
                    addLog("  ✓ " .. packName)
                end
            end
        else
            addLog("⚠️ Could not count resources")
        end
    end
    
    -- 8. Final status
    addLog("")
    addLog("=== CHECKS COMPLETE ===")
    
    local coreIssues = #S.missingResources
    local missingMods = S.modRequirements and S.modRequirements.totalMissing or 0
    
    if coreIssues == 0 and missingMods == 0 then
        setStatus("READY TO IMPORT ✓")
        S.readyToImport = true
    elseif coreIssues == 0 and missingMods > 0 then
        setStatus("READY (" .. missingMods .. " mods missing)")
        S.readyToImport = true
    elseif coreIssues < 5 then
        setStatus("READY (minor issues)")
        S.readyToImport = true
    else
        setStatus("⚠️ " .. coreIssues .. " missing resources")
        S.readyToImport = true  -- Still allow import
    end
    
    S.checksComplete = true
end

-- Clear map function (separate button action) - SAFE CLEAR ONLY
-- Note: Removing towns and edges via API crashes the game engine
-- User must use in-game tools or start a new empty map
local function clearMap()
    addLog("")
    addLog("=== SAFE CLEAR ===")
    setStatus("Clearing (safe mode)...")
    
    local ok, err = pcall(function()
        local bulldoze = require("osm_importer.bulldoze")
        
        -- Only safe operations that don't crash
        addLog("Removing vehicles & lines...")
        pcall(function() bulldoze.delVehicles() end)
        pcall(function() bulldoze.delLines() end)
        
        addLog("Removing animals...")
        pcall(function() bulldoze.delAnimals() end)
        
        addLog("Removing assets...")
        pcall(function() bulldoze.delAssets() end)
        
        addLog("Removing stations...")
        pcall(function() bulldoze.delStationsGroup() end)
        
        -- Note: The following operations crash the game:
        -- - delTowns() - removeTown command crashes game engine
        -- - delEdges() - bulldozing edges can crash
        -- - delNodes() - can crash if edges still reference them
        -- - setTerrainHeight() - not properly supported
        
        -- Count remaining items
        local remainingEdges = 0
        local remainingTowns = 0
        local remainingIndustries = 0
        pcall(function()
            remainingEdges = #game.interface.getEntities({ radius = math.huge }, { type = "BASE_EDGE" })
            remainingTowns = #game.interface.getEntities({ radius = math.huge }, { type = "TOWN" })
            remainingIndustries = #game.interface.getEntities({ radius = math.huge }, { type = "SIM_BUILDING" })
        end)
        
        addLog("")
        addLog("Cleared: vehicles, lines, animals, assets, stations")
        addLog("")
        addLog("Remaining (cannot clear via API):")
        addLog("  Roads/Tracks: " .. remainingEdges)
        addLog("  Towns: " .. remainingTowns)
        addLog("  Industries: " .. remainingIndustries)
        addLog("")
        addLog("To fully clear the map:")
        addLog("  1. Start a NEW EMPTY MAP")
        addLog("     (Game > New Game > Empty Map)")
        addLog("  OR")
        addLog("  2. Use in-game bulldoze tool")
        addLog("     (select roads/tracks and delete)")
    end)
    
    if ok then
        addLog("")
        addLog("✓ Safe clear complete!")
        setStatus("Cleared (items remain)")
    else
        addLog("⚠️ Error: " .. tostring(err))
        setStatus("Clear had issues")
    end
end

-- Run import with proper handling
local function runImport()
    if not S.osmDataInfo then
        addLog("ERROR: No data loaded")
        setStatus("Run checks first")
        return
    end
    
    addLog("")
    addLog("=== STARTING IMPORT ===")
    
    local edges = S.osmDataInfo.edges
    if edges > 50000 then
        addLog("⚠️ Large import: " .. edges .. " edges")
        addLog("Game WILL FREEZE - this is normal")
        addLog("Please wait patiently...")
    end
    
    setStatus("IMPORTING... DO NOT CLOSE")
    
    -- Debug: Log the current option values
    print("[OSM-UI] === OPTION VALUES ===")
    print("[OSM-UI] use_way_batching from S.options: " .. tostring(S.options.use_way_batching))
    print("[OSM-UI] build_objects from S.options: " .. tostring(S.options.build_objects))
    addLog("Batching mode: " .. (S.options.use_way_batching and "ENABLED" or "DISABLED"))
    
    local ok, err = pcall(function()
        local userOptions = {
            build_streets = S.options.build_streets,
            build_tracks = S.options.build_tracks,
            build_subwaytracks = true,
            build_tramtracks = false,
            build_bridges = S.options.build_bridges,
            build_tunnels = S.options.build_tunnels,
            build_signals = S.options.build_signals,
            build_autobahn = true,
            build_streets_street_types = true,
            build_streets_footway_types = true,
            build_streets_water = true,
            build_streets_airport = true,
            skip_nodes_outofbounds = true,
            crash_type_not_found = false,
            log_level = 1,
            skip_forests = not S.availableMods.forester,
            skip_surfaces = not S.availableMods.paver,
            build_towns = S.options.build_towns,  -- Town labels (may crash)
            build_objects = S.options.build_objects,  -- Decorative objects
            use_way_batching = S.options.use_way_batching,  -- Batch mode for performance
        }
        
        -- Debug: Confirm the value in userOptions
        print("[OSM-UI] use_way_batching in userOptions: " .. tostring(userOptions.use_way_batching))
        
        addLog("Loading modules directly...")
        
        -- Load modules directly, bypassing main.lua circular dependency
        local osmdata, bulldoze, simpleproposalseq, towns, areas, models
        
        local loadOk, loadErr = pcall(function()
            osmdata = require("osm_importer.osmdata")
            bulldoze = require("osm_importer.bulldoze")
            simpleproposalseq = require("osm_importer.simpleproposal_seq")
            towns = require("osm_importer.towns")
            areas = require("osm_importer.areas")
            models = require("osm_importer.models")
            
            -- Create minimal osm_importer global for simpleproposal_seq
            _G.osm_importer = _G.osm_importer or {}
            _G.osm_importer.options = userOptions
        end)
        
        if not loadOk then
            addLog("❌ ERROR loading modules:")
            addLog("  " .. tostring(loadErr))
            setStatus("Import failed - module error")
            return
        end
        
        print("[OSM-UI] Modules loaded, starting import...")
        addLog("Running import...")
        
        -- Run the import steps directly
        local importOk, importErr = pcall(function()
            -- Step 1: Towns (optional, can crash near water)
            if userOptions.build_towns and osmdata.towns and #osmdata.towns > 0 then
                print("[OSM-UI] Creating towns...")
                addLog("Creating " .. #osmdata.towns .. " towns...")
                pcall(function() towns.createTownLabels(osmdata.towns) end)
            end
            
            -- Note: Clear map is now a separate button action
            
            -- Step 2: Areas (forests/surfaces)
            if not userOptions.skip_forests and not userOptions.skip_surfaces then
                if osmdata.areas and osmdata.nodes then
                    print("[OSM-UI] Building areas...")
                    pcall(function() areas.buildAreas(osmdata.areas, osmdata.nodes) end)
                end
            end
            
            -- Step 4: Build edges (main work)
            if osmdata.edges and #osmdata.edges > 0 then
                print("[OSM-UI] Building edges (" .. #osmdata.edges .. ")...")
                addLog("Building " .. #osmdata.edges .. " edges...")
                if userOptions.use_way_batching then
                    addLog("Mode: Way Batching (faster)")
                else
                    addLog("Mode: Sequential (slower, better connections)")
                end
                
                -- Debug: Check if vanilla types exist
                local vanillaStreet = api.res.streetTypeRep.find("standard/country_small_new.lua")
                local vanillaTrack = api.res.trackTypeRep.find("standard.lua")
                local vanillaBridge = api.res.bridgeTypeRep.find("stone.lua")
                local vanillaTunnel = api.res.tunnelTypeRep.find("railroad_old.lua")
                
                addLog("")
                addLog("Vanilla asset check:")
                addLog("  Street (standard/country_small_new.lua): " .. (vanillaStreet >= 0 and "OK" or "NOT FOUND"))
                addLog("  Track (standard.lua): " .. (vanillaTrack >= 0 and "OK" or "NOT FOUND"))
                addLog("  Bridge (stone.lua): " .. (vanillaBridge >= 0 and "OK" or "NOT FOUND"))
                addLog("  Tunnel (railroad_old.lua): " .. (vanillaTunnel >= 0 and "OK" or "NOT FOUND"))
                
                if vanillaStreet < 0 or vanillaTrack < 0 then
                    -- Try alternative names
                    addLog("")
                    addLog("Trying alternative names...")
                    local alt1 = api.res.streetTypeRep.find("country_small_new.lua")
                    local alt2 = api.res.streetTypeRep.find("town_small_new.lua")
                    addLog("  country_small_new.lua: " .. (alt1 >= 0 and "OK (id=" .. alt1 .. ")" or "NOT FOUND"))
                    addLog("  town_small_new.lua: " .. (alt2 >= 0 and "OK (id=" .. alt2 .. ")" or "NOT FOUND"))
                    
                    -- Get count of all types
                    local streetCount = api.res.streetTypeRep.getCount()
                    local trackCount = api.res.trackTypeRep.getCount()
                    addLog("")
                    addLog("Total available types:")
                    addLog("  Streets: " .. streetCount)
                    addLog("  Tracks: " .. trackCount)
                    
                    -- List first few street types if any
                    if streetCount > 0 then
                        addLog("First 5 street types:")
                        for i = 0, math.min(4, streetCount - 1) do
                            local name = api.res.streetTypeRep.getName(i)
                            addLog("  [" .. i .. "] = " .. tostring(name))
                        end
                    end
                end
                addLog("")
                
                simpleproposalseq.SimpleProposalSeq(osmdata, userOptions)
            end
            
            -- Step 5: Objects
            if userOptions.build_objects and osmdata.objects and #osmdata.objects > 0 then
                print("[OSM-UI] Building objects (" .. #osmdata.objects .. ")...")
                addLog("Building " .. #osmdata.objects .. " objects...")
                pcall(function() models.buildObjects(osmdata.objects) end)
            elseif not userOptions.build_objects then
                addLog("Skipping objects (disabled)")
            end
        end)
        
        if importOk then
            addLog("=============================")
            addLog("IMPORT COMPLETE!")
            
            -- Report skip counts if available
            local simpleproposal = package.loaded["osm_importer.simpleproposal"]
            if simpleproposal and simpleproposal.getSkipCounts then
                local skips = simpleproposal.getSkipCounts()
                local totalSkipped = (skips.tracks or 0) + (skips.streets or 0)
                if totalSkipped > 0 then
                    addLog("")
                    addLog("⚠️ Skipped (missing types):")
                    if skips.tracks > 0 then
                        addLog("  Tracks: " .. skips.tracks)
                    end
                    if skips.streets > 0 then
                        addLog("  Streets: " .. skips.streets)
                    end
                    addLog("Install more mods for full import")
                end
            end
            
            addLog("")
            addLog("Check stdout.txt for details")
            addLog("=============================")
            setStatus("IMPORT COMPLETE ✓")
        else
            addLog("❌ IMPORT ERROR:")
            addLog("  " .. tostring(importErr))
            addLog("")
            addLog("Check stdout.txt for full error")
            setStatus("Import failed")
        end
    end)
    
    if not ok then
        addLog("❌ CRITICAL ERROR:")
        addLog("  " .. tostring(err))
        addLog("")
        addLog("This may be a Lua syntax error.")
        addLog("Check stdout.txt for details.")
        setStatus("Import failed - see log")
    end
end

-- Run import WITHOUT batching (forces sequential mode)
local function runImportNoBatch()
    if not S.osmDataInfo then
        addLog("ERROR: No data loaded")
        setStatus("Run checks first")
        return
    end
    
    addLog("")
    addLog("=== STARTING IMPORT (NO BATCHING) ===")
    addLog("Forcing SEQUENTIAL mode (slower but more reliable)")
    
    local edges = S.osmDataInfo.edges
    setStatus("IMPORTING (SEQUENTIAL)... DO NOT CLOSE")
    
    print("[OSM-UI] === FORCED NO BATCHING ===")
    print("[OSM-UI] use_way_batching FORCED to: false")
    
    local ok, err = pcall(function()
        -- FORCE use_way_batching to false regardless of saved options
        local userOptions = {
            build_streets = S.options.build_streets,
            build_tracks = S.options.build_tracks,
            build_subwaytracks = true,
            build_tramtracks = false,
            build_bridges = S.options.build_bridges,
            build_tunnels = S.options.build_tunnels,
            build_signals = S.options.build_signals,
            build_autobahn = true,
            build_streets_street_types = true,
            build_streets_footway_types = true,
            build_streets_water = true,
            build_streets_airport = true,
            skip_nodes_outofbounds = true,
            crash_type_not_found = false,
            log_level = 1,
            skip_forests = not S.availableMods.forester,
            skip_surfaces = not S.availableMods.paver,
            build_towns = S.options.build_towns,
            build_objects = S.options.build_objects,
            use_way_batching = false,  -- FORCED TO FALSE
        }
        
        print("[OSM-UI] use_way_batching in userOptions: " .. tostring(userOptions.use_way_batching))
        
        addLog("Loading modules...")
        
        local osmdata, simpleproposalseq, towns, areas, models
        
        local loadOk, loadErr = pcall(function()
            osmdata = require("osm_importer.osmdata")
            simpleproposalseq = require("osm_importer.simpleproposal_seq")
            towns = require("osm_importer.towns")
            areas = require("osm_importer.areas")
            models = require("osm_importer.models")
            
            _G.osm_importer = _G.osm_importer or {}
            _G.osm_importer.options = userOptions
        end)
        
        if not loadOk then
            addLog("❌ ERROR loading modules:")
            addLog("  " .. tostring(loadErr))
            setStatus("Import failed - module error")
            return
        end
        
        addLog("Running import (SEQUENTIAL)...")
        
        local importOk, importErr = pcall(function()
            if userOptions.build_towns and osmdata.towns and #osmdata.towns > 0 then
                addLog("Creating " .. #osmdata.towns .. " towns...")
                pcall(function() towns.createTownLabels(osmdata.towns) end)
            end
            
            if not userOptions.skip_forests and not userOptions.skip_surfaces then
                if osmdata.areas and osmdata.nodes then
                    pcall(function() areas.buildAreas(osmdata.areas, osmdata.nodes) end)
                end
            end
            
            if osmdata.edges and #osmdata.edges > 0 then
                addLog("Building " .. #osmdata.edges .. " edges (SEQUENTIAL)...")
                simpleproposalseq.SimpleProposalSeq(osmdata, userOptions)
            end
            
            if userOptions.build_objects and osmdata.objects and #osmdata.objects > 0 then
                addLog("Building " .. #osmdata.objects .. " objects...")
                pcall(function() models.buildObjects(osmdata.objects) end)
            end
        end)
        
        if importOk then
            addLog("=============================")
            addLog("IMPORT COMPLETE (SEQUENTIAL)!")
            addLog("=============================")
            setStatus("IMPORT COMPLETE ✓")
        else
            addLog("❌ IMPORT ERROR:")
            addLog("  " .. tostring(importErr))
            setStatus("Import failed")
        end
    end)
    
    if not ok then
        addLog("❌ CRITICAL ERROR:")
        addLog("  " .. tostring(err))
        setStatus("Import failed - see log")
    end
end

-- Close window
local function closeWindow()
    if S.window then
        pcall(function() S.window:setVisible(false, false) end)
    end
    if S.trigger then
        pcall(function() S.trigger:setSelected(false, false) end)
    end
end

-- Create window and run checks automatically
local function createWindow()
    if S.window then
        local ok = pcall(function()
            if not S.window:isVisible() then
                S.window:setVisible(true, false)
            end
        end)
        if ok then
            -- Re-run checks when showing window
            runAllChecks()
            return
        end
        S.window = nil
    end
    
    local ok, err = pcall(function()
        local layout = api.gui.layout.BoxLayout.new("VERTICAL")
        
        -- Header
        layout:addItem(api.gui.comp.TextView.new("══════════════════════════════"))
        layout:addItem(api.gui.comp.TextView.new("      OSM MAP IMPORTER"))
        layout:addItem(api.gui.comp.TextView.new("══════════════════════════════"))
        
        -- MAP INFO SECTION (shown at top)
        layout:addItem(api.gui.comp.TextView.new(""))
        layout:addItem(api.gui.comp.TextView.new("── MAP DATA INFO ──"))
        
        -- Get OSM data info immediately
        local mapInfoText = "Loading..."
        pcall(function()
            local osmdata = require("osm_importer.osmdata")
            if osmdata then
                local edges = osmdata.edges and #osmdata.edges or 0
                local towns = osmdata.towns and #osmdata.towns or 0
                local areas = 0
                if osmdata.areas then
                    areas = (osmdata.areas.forests and #osmdata.areas.forests or 0) +
                            (osmdata.areas.grounds and #osmdata.areas.grounds or 0)
                end
                local objects = osmdata.objects and #osmdata.objects or 0
                
                mapInfoText = string.format("Edges: %d | Towns: %d | Areas: %d | Objects: %d", 
                    edges, towns, areas, objects)
            else
                mapInfoText = "No osmdata.lua loaded"
            end
        end)
        S.mapInfoText = api.gui.comp.TextView.new(mapInfoText)
        layout:addItem(S.mapInfoText)
        
        -- OSM source dimensions
        local dimInfoText = ""
        pcall(function()
            local osmdata = require("osm_importer.osmdata")
            if osmdata and osmdata.bounds then
                local b = osmdata.bounds
                if b.osm_width_km and b.osm_height_km then
                    dimInfoText = string.format("OSM: %.1fx%.1f km | Scale: 1:%.1f", 
                        b.osm_width_km, b.osm_height_km, b.scale or 1)
                end
            end
        end)
        if dimInfoText ~= "" then
            layout:addItem(api.gui.comp.TextView.new(dimInfoText))
        end
        
        -- Current TPF2 map size
        local tpf2InfoText = ""
        pcall(function()
            local mapSize = api.engine.terrain.getHeightmapSize()
            if mapSize then
                -- Heightmap size to meters (each cell is ~4m)
                local mapWidth = mapSize.x * 4
                local mapHeight = mapSize.y * 4
                tpf2InfoText = string.format("TPF2 Map: %.1fx%.1f km", mapWidth/1000, mapHeight/1000)
            end
        end)
        if tpf2InfoText ~= "" then
            layout:addItem(api.gui.comp.TextView.new(tpf2InfoText))
        end
        
        -- Status line
        layout:addItem(api.gui.comp.TextView.new(""))
        S.statusText = api.gui.comp.TextView.new("Status: Running checks...")
        layout:addItem(S.statusText)
        
        layout:addItem(api.gui.comp.TextView.new(""))
        layout:addItem(api.gui.comp.TextView.new("── OPTIONS ──"))
        
        -- Option checkboxes
        local function addOption(label, key)
            local cb = api.gui.comp.CheckBox.new(label)
            cb:setSelected(S.options[key], false)
            cb:onToggle(function(sel)
                S.options[key] = sel
                print("[OSM-UI] Option '" .. key .. "' changed to: " .. tostring(sel))
            end)
            layout:addItem(cb)
        end
        
        addOption("Build Streets", "build_streets")
        addOption("Build Rail Tracks", "build_tracks")
        addOption("Build Bridges", "build_bridges")
        addOption("Build Tunnels", "build_tunnels")
        addOption("Place Signals", "build_signals")
        addOption("Build Forests", "build_forests")
        addOption("Build Surfaces", "build_surfaces")
        addOption("Create Towns", "build_towns")
        addOption("Build Objects", "build_objects")
        
        layout:addItem(api.gui.comp.TextView.new(""))
        layout:addItem(api.gui.comp.TextView.new("── PERFORMANCE ──"))
        addOption("Use Way Batching (faster, may disconnect)", "use_way_batching")
        
        layout:addItem(api.gui.comp.TextView.new(""))
        layout:addItem(api.gui.comp.TextView.new("── ACTIONS ──"))
        layout:addItem(api.gui.comp.TextView.new("(For full clear: start NEW EMPTY MAP)"))
        
        -- Clear Map button - using proper Button component
        local btnClear = api.gui.comp.Button.new(api.gui.comp.TextView.new("SAFE CLEAR"), true)
        btnClear:onClick(function()
            clearMap()
        end)
        layout:addItem(btnClear)
        
        -- Refresh checks button
        local btnRefresh = api.gui.comp.Button.new(api.gui.comp.TextView.new("REFRESH CHECKS"), true)
        btnRefresh:onClick(function()
            runAllChecks()
        end)
        layout:addItem(btnRefresh)
        
        -- Run Import button (uses checkbox settings)
        local btnImport = api.gui.comp.Button.new(api.gui.comp.TextView.new("▶ RUN IMPORT"), true)
        btnImport:onClick(function()
            runImport()
        end)
        layout:addItem(btnImport)
        
        -- Run Import WITHOUT batching (ignores checkbox, forces sequential)
        local btnImportNoBatch = api.gui.comp.Button.new(api.gui.comp.TextView.new("▶ RUN IMPORT (NO BATCH)"), true)
        btnImportNoBatch:onClick(function()
            runImportNoBatch()
        end)
        layout:addItem(btnImportNoBatch)
        
        -- Close button
        local btnClose = api.gui.comp.Button.new(api.gui.comp.TextView.new("CLOSE"), true)
        btnClose:onClick(function()
            closeWindow()
        end)
        layout:addItem(btnClose)
        
        -- Log display
        layout:addItem(api.gui.comp.TextView.new(""))
        layout:addItem(api.gui.comp.TextView.new("── CHECK RESULTS ──"))
        
        S.logText = api.gui.comp.TextView.new("Running automatic checks...")
        layout:addItem(S.logText)
        
        -- Create window
        S.window = api.gui.comp.Window.new("OSM Importer", layout)
        S.window:setMovable(true)
        S.window:setResizable(false)
        S.window:setPinButtonVisible(true)
        S.window:setPosition(100, 100)
        S.window:setVisible(true, false)
        
        -- Run checks automatically
        runAllChecks()
    end)
    
    if not ok then
        print("[OSM-UI] ERROR: " .. tostring(err))
        S.window = nil
    end
end

-- Toggle window
local function toggleWindow(show)
    if show then
        createWindow()
    else
        if S.window then
            pcall(function() S.window:setVisible(false, false) end)
        end
    end
end

function data()
    return {
        guiInit = function()
            print("[OSM-UI] Initializing...")
            
            if S.initialized then
                return
            end
            
            local gameInfo = api.gui.util.getById("gameInfo")
            if not gameInfo then
                print("[OSM-UI] ERROR: gameInfo not found")
                return
            end
            
            local layout = gameInfo:getLayout()
            if not layout then
                print("[OSM-UI] ERROR: layout not found")
                return
            end
            
            layout:addItem(api.gui.comp.Component.new("VerticalLine"))
            
            S.trigger = api.gui.comp.CheckBox.new("OSM")
            S.trigger:onToggle(function(selected)
                toggleWindow(selected)
            end)
            layout:addItem(S.trigger)
            
            S.initialized = true
            print("[OSM-UI] Ready! Click 'OSM' in bottom bar to open.")
        end,
        
        guiUpdate = function() end,
        
        save = function()
            print("[OSM-UI] save() called, use_way_batching = " .. tostring(S.options.use_way_batching))
            return { options = S.options }
        end,
        
        load = function(loadedData)
            print("[OSM-UI] load() called")
            if loadedData and loadedData.options then
                print("[OSM-UI] Loading saved options:")
                for k, v in pairs(loadedData.options) do
                    print("[OSM-UI]   " .. k .. " = " .. tostring(v))
                    S.options[k] = v
                end
                -- Log the final use_way_batching value
                print("[OSM-UI] After load, use_way_batching = " .. tostring(S.options.use_way_batching))
            else
                print("[OSM-UI] No saved options to load")
            end
        end,
    }
end

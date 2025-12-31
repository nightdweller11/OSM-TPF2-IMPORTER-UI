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
        clear_existing = true,  -- Clear map before import
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

-- Scan osmdata for all unique resource types used
local function scanOsmDataResources()
    addLog("Scanning data resources...")
    
    local ok, osmdata = pcall(function()
        return require "osm_importer.osmdata"
    end)
    
    if not ok or not osmdata then
        return nil
    end
    
    local resources = {
        trackTypes = {},
        streetTypes = {},
        bridgeTypes = {},
        models = {},
    }
    
    -- Scan edges for track/street types
    if osmdata.edges then
        for i, edge in ipairs(osmdata.edges) do
            if edge.type then
                if edge.trackType or edge.isTrack then
                    resources.trackTypes[edge.type] = (resources.trackTypes[edge.type] or 0) + 1
                else
                    resources.streetTypes[edge.type] = (resources.streetTypes[edge.type] or 0) + 1
                end
            end
            if edge.bridgeType then
                resources.bridgeTypes[edge.bridgeType] = (resources.bridgeTypes[edge.bridgeType] or 0) + 1
            end
        end
    end
    
    -- Scan objects for model types
    if osmdata.objects then
        for i, obj in ipairs(osmdata.objects) do
            if obj.model then
                resources.models[obj.model] = (resources.models[obj.model] or 0) + 1
            end
        end
    end
    
    return resources
end

-- Verify all resources exist in game
local function verifyResources(resources)
    local missing = {}
    local found = 0
    local total = 0
    
    -- Check track types
    for typeName, count in pairs(resources.trackTypes) do
        total = total + 1
        if resourceExists("trackTypeRep", typeName) then
            found = found + 1
        else
            table.insert(missing, {type = "track", name = typeName, count = count})
        end
    end
    
    -- Check street types
    for typeName, count in pairs(resources.streetTypes) do
        total = total + 1
        if resourceExists("streetTypeRep", typeName) then
            found = found + 1
        else
            table.insert(missing, {type = "street", name = typeName, count = count})
        end
    end
    
    -- Check bridge types
    for typeName, count in pairs(resources.bridgeTypes) do
        total = total + 1
        if resourceExists("bridgeTypeRep", typeName) then
            found = found + 1
        else
            table.insert(missing, {type = "bridge", name = typeName, count = count})
        end
    end
    
    -- Check models (less critical)
    for modelName, count in pairs(resources.models) do
        total = total + 1
        if resourceExists("modelRep", modelName) then
            found = found + 1
        else
            table.insert(missing, {type = "model", name = modelName, count = count})
        end
    end
    
    return missing, found, total
end

-- Check core mods
local function checkCoreMods()
    S.availableMods = {}
    
    -- Forester
    local hasForester = pcall(function()
        return require "osm_importer.forester"
    end)
    S.availableMods.forester = hasForester
    
    -- Paver
    local hasPaver = pcall(function()
        return require "osm_importer.paver"
    end)
    S.availableMods.paver = hasPaver
    
    return hasForester, hasPaver
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
    
    -- 3. Check map bounds
    local mapOk, mapSize = pcall(function()
        return api.engine.terrain.getHeightmapSize()
    end)
    if mapOk and mapSize then
        addLog("✓ Map size: " .. mapSize.x .. " x " .. mapSize.y)
    end
    
    -- Data bounds
    if osmdata.bounds then
        local b = osmdata.bounds
        local w = math.abs(b.maxX - b.minX)
        local h = math.abs(b.maxY - b.minY)
        addLog("  Data extent: " .. math.floor(w) .. " x " .. math.floor(h) .. "m")
    end
    
    -- 4. Check core mods
    addLog("")
    addLog("Checking mods...")
    local hasForester, hasPaver = checkCoreMods()
    
    if hasForester then
        addLog("✓ Forester: available")
    else
        addLog("○ Forester: not found (forests skipped)")
    end
    
    if hasPaver then
        addLog("✓ Paver: available")
    else
        addLog("○ Paver: not found (surfaces skipped)")
    end
    
    -- 5. Scan and verify resources in data
    addLog("")
    addLog("Verifying resources...")
    local resources = scanOsmDataResources()
    
    if resources then
        local missing, found, total = verifyResources(resources)
        S.missingResources = missing
        
        if #missing == 0 then
            addLog("✓ All " .. total .. " resource types found")
        else
            addLog("⚠️ Found " .. found .. "/" .. total .. " resources")
            addLog("  Missing " .. #missing .. " types:")
            -- Show first few missing
            for i = 1, math.min(3, #missing) do
                local m = missing[i]
                addLog("  • " .. m.type .. ": " .. m.name)
            end
            if #missing > 3 then
                addLog("  ... and " .. (#missing - 3) .. " more")
            end
        end
    end
    
    -- 6. Final status
    addLog("")
    addLog("=== CHECKS COMPLETE ===")
    
    local issues = #S.missingResources
    if issues == 0 then
        setStatus("READY TO IMPORT ✓")
        S.readyToImport = true
    elseif issues < 5 then
        setStatus("READY (minor issues)")
        S.readyToImport = true
    else
        setStatus("⚠️ " .. issues .. " missing resources")
        S.readyToImport = true  -- Still allow import
    end
    
    S.checksComplete = true
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
            clear_existing = S.options.clear_existing,
        }
        
        local main = require "osm_importer.main"
        if main and main.run then
            main.run(userOptions)
            addLog("=============================")
            addLog("IMPORT COMPLETE!")
            addLog("Check stdout.txt for details")
            addLog("=============================")
            setStatus("IMPORT COMPLETE ✓")
        else
            addLog("ERROR: main.run not found")
            setStatus("Import failed")
        end
    end)
    
    if not ok then
        addLog("ERROR: " .. tostring(err))
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
        
        -- Status line
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
        addOption("Clear Map First", "clear_existing")
        
        layout:addItem(api.gui.comp.TextView.new(""))
        layout:addItem(api.gui.comp.TextView.new("── ACTIONS ──"))
        
        -- Refresh checks button
        local btnRefresh = api.gui.comp.CheckBox.new("[ ↻ REFRESH CHECKS ]")
        btnRefresh:onToggle(function(sel)
            if sel then
                btnRefresh:setSelected(false, false)
                runAllChecks()
            end
        end)
        layout:addItem(btnRefresh)
        
        -- Run Import button
        local btnImport = api.gui.comp.CheckBox.new("[ ▶▶▶ RUN IMPORT ◀◀◀ ]")
        btnImport:onToggle(function(sel)
            if sel then
                btnImport:setSelected(false, false)
                runImport()
            end
        end)
        layout:addItem(btnImport)
        
        -- Close button
        local btnClose = api.gui.comp.CheckBox.new("[ X CLOSE ]")
        btnClose:onToggle(function(sel)
            if sel then
                btnClose:setSelected(false, false)
                closeWindow()
            end
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
            return { options = S.options }
        end,
        
        load = function(loadedData)
            if loadedData and loadedData.options then
                for k, v in pairs(loadedData.options) do
                    S.options[k] = v
                end
            end
        end,
    }
end

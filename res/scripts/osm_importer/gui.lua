-- OSM Importer GUI
-- Provides a user-friendly interface with mod detection and options

local gui = {}

-- State tracking
gui.window = nil
gui.optionsWindow = nil
gui.logWindow = nil
gui.modsWindow = nil
gui.logs = {}
gui.maxLogs = 100
gui.currentStep = 0
gui.isRunning = false

-- Import options (with defaults)
gui.options = {
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
    crash_type_not_found = true,
    log_level = 1,
}

-- Mod definitions with detection info
-- format: { name, detectFn, description, requiredFor }
gui.modDefs = {
    {
        name = "CommonAPI2",
        required = true,
        description = "Script console access",
        url = "transportfever.net/filebase/entry/4806",
        detect = function()
            local ok = pcall(function() 
                return api.res.modelRep.find("asset/icon/ui/construction/street_construction.mdl")
            end)
            return ok
        end
    },
    {
        name = "Forester (Förster)",
        required = true,
        description = "Required for forest areas",
        url = "transportfever.net/filebase/entry/4856",
        detect = function()
            local ok = pcall(function()
                return api.res.modelRep.find("forester/tree_placement.mdl") ~= nil
            end)
            return ok
        end
    },
    {
        name = "Paver (Pflasterer)",
        required = true,
        description = "Required for ground surfaces",
        url = "transportfever.net/filebase/entry/7713",
        detect = function()
            local ok = pcall(function()
                return api.res.modelRep.find("paver/ground_material.mdl") ~= nil
            end)
            return ok
        end
    },
    {
        name = "Natural Environment Pro",
        required = false,
        description = "High quality track textures",
        optionKey = "build_tracks",
        detect = function()
            local ok, result = pcall(function()
                return api.res.trackTypeRep.find("standard.lua") ~= nil
            end)
            return ok and result
        end
    },
    {
        name = "RTP Roads V2",
        required = false,
        description = "Road texture pack for streets",
        optionKey = "build_streets_street_types",
        detect = function()
            local ok, result = pcall(function()
                return api.res.streetTypeRep.find("rtp_road.lua") ~= nil
            end)
            return ok and result
        end
    },
    {
        name = "Marc26 Tram Streets",
        required = false,
        description = "Streets with tram tracks",
        optionKey = "build_tramtracks",
        detect = function()
            local ok, result = pcall(function()
                return api.res.streetTypeRep.find("marc_tram_street.lua") ~= nil
            end)
            return ok and result
        end
    },
    {
        name = "Melectro Autobahn",
        required = false,
        description = "Motorway/highway roads",
        optionKey = "build_autobahn",
        detect = function()
            local ok, result = pcall(function()
                return api.res.streetTypeRep.find("autobahn_kreuz.lua") ~= nil
            end)
            return ok and result
        end
    },
    {
        name = "Extended Roads Footpaths",
        required = false,
        description = "Pedestrian paths and footways",
        optionKey = "build_streets_footway_types",
        detect = function()
            local ok, result = pcall(function()
                return api.res.streetTypeRep.find("extended_footpath.lua") ~= nil
            end)
            return ok and result
        end
    },
    {
        name = "Relozu Water Textures",
        required = false,
        description = "Water texture streets for streams",
        optionKey = "build_streets_water",
        detect = function()
            local ok, result = pcall(function()
                return api.res.streetTypeRep.find("relozu_water.lua") ~= nil
            end)
            return ok and result
        end
    },
    {
        name = "MKH Airport Roads",
        required = false,
        description = "Airport runways and taxiways",
        optionKey = "build_streets_airport",
        detect = function()
            local ok, result = pcall(function()
                return api.res.streetTypeRep.find("mkh_airport.lua") ~= nil
            end)
            return ok and result
        end
    },
}

-- Detected mods cache
gui.installedMods = {}
gui.missingMods = {}

-- Log levels
local LOG_INFO = 1
local LOG_WARN = 2
local LOG_ERROR = 3
local LOG_SUCCESS = 4

-- Add log entry
function gui.log(message, level)
    level = level or LOG_INFO
    local prefix = ""
    if level == LOG_WARN then prefix = "[WARN] "
    elseif level == LOG_ERROR then prefix = "[ERROR] "
    elseif level == LOG_SUCCESS then prefix = "[OK] "
    end
    
    local entry = os.date("%H:%M:%S") .. " " .. prefix .. message
    table.insert(gui.logs, entry)
    
    while #gui.logs > gui.maxLogs do
        table.remove(gui.logs, 1)
    end
    
    print(entry)
    
    if gui.logText then
        gui.logText:setText(table.concat(gui.logs, "\n"))
    end
end

-- Check which mods are installed
function gui.detectMods()
    gui.log("Checking installed mods...")
    gui.installedMods = {}
    gui.missingMods = {}
    
    for _, mod in ipairs(gui.modDefs) do
        local installed = false
        
        -- Try to detect the mod
        local ok, result = pcall(mod.detect)
        if ok and result then
            installed = true
        end
        
        if installed then
            table.insert(gui.installedMods, mod)
            gui.log("  ✓ " .. mod.name, LOG_SUCCESS)
        else
            table.insert(gui.missingMods, mod)
            if mod.required then
                gui.log("  ✗ " .. mod.name .. " (REQUIRED!)", LOG_ERROR)
            else
                gui.log("  - " .. mod.name .. " (optional)", LOG_WARN)
            end
        end
    end
    
    -- Update options based on missing mods
    gui.updateOptionsFromMods()
    
    return #gui.missingMods == 0 or not gui.hasRequiredModsMissing()
end

-- Check if any required mods are missing
function gui.hasRequiredModsMissing()
    for _, mod in ipairs(gui.missingMods) do
        if mod.required then
            return true
        end
    end
    return false
end

-- Update options based on available mods
function gui.updateOptionsFromMods()
    for _, mod in ipairs(gui.missingMods) do
        if mod.optionKey and gui.options[mod.optionKey] then
            -- Disable option if mod is missing
            gui.log("Disabling " .. mod.optionKey .. " (mod not installed)")
            gui.options[mod.optionKey] = false
        end
    end
end

-- Create checkbox for option
function gui.createOptionCheckbox(container, label, optionKey, description, modName)
    local row = api.gui.comp.Component.new("HorizontalLayout")
    
    local cb = api.gui.comp.CheckBox.new()
    cb:setSelected(gui.options[optionKey] == true)
    cb:onToggle(function(selected)
        gui.options[optionKey] = selected
    end)
    row:addChild(cb)
    
    -- Check if mod is missing
    local isMissing = false
    if modName then
        for _, mod in ipairs(gui.missingMods) do
            if mod.name == modName then
                isMissing = true
                break
            end
        end
    end
    
    local labelText = label
    if isMissing then
        labelText = label .. " ⚠️"
        cb:setEnabled(false)
        cb:setSelected(false)
        gui.options[optionKey] = false
    end
    
    local lbl = api.gui.comp.TextView.new(labelText)
    if description then
        lbl:setTooltip(description .. (modName and ("\nRequires: " .. modName) or ""))
    end
    row:addChild(lbl)
    
    container:addChild(row)
    return cb
end

-- Create the main control window
function gui.createMainWindow()
    if gui.window then
        gui.window:setVisible(true)
        return
    end
    
    -- Detect mods first
    gui.detectMods()
    
    local content = api.gui.comp.Component.new("VerticalLayout")
    content:setMinimumSize(api.gui.util.Size.new(450, 0))
    
    -- Title
    local title = api.gui.comp.TextView.new("OSM-TPF2 Importer")
    title:setStyleClassList({"heading"})
    content:addChild(title)
    
    -- Mod status
    local modStatus = ""
    if gui.hasRequiredModsMissing() then
        modStatus = "⚠️ MISSING REQUIRED MODS - Click 'Show Mods'"
    else
        modStatus = "✓ All required mods installed"
    end
    gui.modStatusText = api.gui.comp.TextView.new(modStatus)
    content:addChild(gui.modStatusText)
    
    -- Status indicator
    gui.statusText = api.gui.comp.TextView.new("Ready - Pause the game before starting!")
    content:addChild(gui.statusText)
    
    -- Progress bar
    gui.progressBar = api.gui.comp.ProgressBar.new()
    gui.progressBar:setMinimumSize(api.gui.util.Size.new(430, 10))
    content:addChild(gui.progressBar)
    
    -- Step buttons
    local stepsContainer = api.gui.comp.Component.new("VerticalLayout")
    
    gui.btnInit = api.gui.comp.Button.new()
    gui.btnInit:setText("Step 0: Initialize OSM Data")
    gui.btnInit:onClick(function() gui.runStep0() end)
    stepsContainer:addChild(gui.btnInit)
    
    gui.btnTowns = api.gui.comp.Button.new()
    gui.btnTowns:setText("Step 1: Create Town Labels")
    gui.btnTowns:setEnabled(false)
    gui.btnTowns:onClick(function() gui.runStep1() end)
    stepsContainer:addChild(gui.btnTowns)
    
    gui.btnAreas = api.gui.comp.Button.new()
    gui.btnAreas:setText("Step 2: Build Forests & Surfaces")
    gui.btnAreas:setEnabled(false)
    gui.btnAreas:onClick(function() gui.runStep2() end)
    stepsContainer:addChild(gui.btnAreas)
    
    gui.btnEdges = api.gui.comp.Button.new()
    gui.btnEdges:setText("Step 3: Build Streets & Tracks")
    gui.btnEdges:setEnabled(false)
    gui.btnEdges:onClick(function() gui.runStep3() end)
    stepsContainer:addChild(gui.btnEdges)
    
    gui.btnObjects = api.gui.comp.Button.new()
    gui.btnObjects:setText("Step 4: Build Objects")
    gui.btnObjects:setEnabled(false)
    gui.btnObjects:onClick(function() gui.runStep4() end)
    stepsContainer:addChild(gui.btnObjects)
    
    content:addChild(stepsContainer)
    
    -- Separator
    local sep = api.gui.comp.Component.new("HorizontalLayout")
    sep:setMinimumSize(api.gui.util.Size.new(430, 10))
    content:addChild(sep)
    
    -- Action buttons row 1
    local actions1 = api.gui.comp.Component.new("HorizontalLayout")
    
    gui.btnRunAll = api.gui.comp.Button.new()
    gui.btnRunAll:setText("▶ Run All Steps")
    gui.btnRunAll:onClick(function() gui.runAllSteps() end)
    actions1:addChild(gui.btnRunAll)
    
    gui.btnStop = api.gui.comp.Button.new()
    gui.btnStop:setText("■ Stop")
    gui.btnStop:setEnabled(false)
    gui.btnStop:onClick(function() gui.stopImport() end)
    actions1:addChild(gui.btnStop)
    
    content:addChild(actions1)
    
    -- Action buttons row 2
    local actions2 = api.gui.comp.Component.new("HorizontalLayout")
    
    local btnOptions = api.gui.comp.Button.new()
    btnOptions:setText("⚙ Options")
    btnOptions:onClick(function() gui.showOptionsWindow() end)
    actions2:addChild(btnOptions)
    
    local btnMods = api.gui.comp.Button.new()
    btnMods:setText("📦 Mods")
    btnMods:onClick(function() gui.showModsWindow() end)
    actions2:addChild(btnMods)
    
    local btnLogs = api.gui.comp.Button.new()
    btnLogs:setText("📋 Logs")
    btnLogs:onClick(function() gui.showLogWindow() end)
    actions2:addChild(btnLogs)
    
    content:addChild(actions2)
    
    gui.window = api.gui.comp.Window.new("OSM Importer", content)
    gui.window:addHideOnCloseHandler()
    
    gui.log("OSM Importer GUI ready", LOG_SUCCESS)
    if gui.hasRequiredModsMissing() then
        gui.log("WARNING: Some required mods are missing!", LOG_ERROR)
        gui.log("Click 'Mods' button to see what's needed", LOG_WARN)
    end
end

-- Create options window
function gui.showOptionsWindow()
    if gui.optionsWindow then
        gui.optionsWindow:setVisible(true)
        return
    end
    
    local content = api.gui.comp.Component.new("VerticalLayout")
    content:setMinimumSize(api.gui.util.Size.new(400, 0))
    
    local title = api.gui.comp.TextView.new("Import Options")
    title:setStyleClassList({"heading"})
    content:addChild(title)
    
    local info = api.gui.comp.TextView.new("⚠️ = Mod not installed (option disabled)")
    content:addChild(info)
    
    -- General options section
    local genLabel = api.gui.comp.TextView.new("── General ──")
    content:addChild(genLabel)
    
    gui.createOptionCheckbox(content, "Build Streets", "build_streets", 
        "Build all street types", nil)
    gui.createOptionCheckbox(content, "Build Tracks", "build_tracks", 
        "Build railway tracks", "Natural Environment Pro")
    gui.createOptionCheckbox(content, "Build Bridges", "build_bridges", 
        "Build bridges (height interpolated)", nil)
    gui.createOptionCheckbox(content, "Build Tunnels", "build_tunnels", 
        "Build tunnels (experimental)", nil)
    
    -- Track options section
    local trackLabel = api.gui.comp.TextView.new("── Tracks ──")
    content:addChild(trackLabel)
    
    gui.createOptionCheckbox(content, "Build Subway/Light Rail", "build_subwaytracks", 
        "Build subway and light rail as tracks", nil)
    gui.createOptionCheckbox(content, "Build Tram Tracks", "build_tramtracks", 
        "Build tram as separate tracks", "Marc26 Tram Streets")
    gui.createOptionCheckbox(content, "Build Signals", "build_signals", 
        "Build German railway signals", nil)
    
    -- Street options section
    local streetLabel = api.gui.comp.TextView.new("── Streets ──")
    content:addChild(streetLabel)
    
    gui.createOptionCheckbox(content, "Build Motorways", "build_autobahn", 
        "Build motorways/highways", "Melectro Autobahn")
    gui.createOptionCheckbox(content, "Build City Streets", "build_streets_street_types", 
        "Build motorways, city streets, residential", "RTP Roads V2")
    gui.createOptionCheckbox(content, "Build Footways/Paths", "build_streets_footway_types", 
        "Build pedestrian paths, cycleways", "Extended Roads Footpaths")
    gui.createOptionCheckbox(content, "Build Streams", "build_streets_water", 
        "Build streams using water textures", "Relozu Water Textures")
    gui.createOptionCheckbox(content, "Build Airport Roads", "build_streets_airport", 
        "Build runways and taxiways", "MKH Airport Roads")
    
    -- Other options section
    local otherLabel = api.gui.comp.TextView.new("── Other ──")
    content:addChild(otherLabel)
    
    gui.createOptionCheckbox(content, "Skip Out-of-Bounds", "skip_nodes_outofbounds", 
        "Skip edges outside map bounds (recommended)", nil)
    gui.createOptionCheckbox(content, "Crash on Missing Type", "crash_type_not_found", 
        "Abort if street/track type not found", nil)
    
    -- Close button
    local btnClose = api.gui.comp.Button.new()
    btnClose:setText("Close")
    btnClose:onClick(function()
        gui.optionsWindow:setVisible(false)
    end)
    content:addChild(btnClose)
    
    gui.optionsWindow = api.gui.comp.Window.new("Import Options", content)
    gui.optionsWindow:addHideOnCloseHandler()
end

-- Create mods info window
function gui.showModsWindow()
    if gui.modsWindow then
        gui.modsWindow:setVisible(true)
        -- Refresh detection
        gui.detectMods()
        return
    end
    
    local content = api.gui.comp.Component.new("VerticalLayout")
    content:setMinimumSize(api.gui.util.Size.new(500, 0))
    
    local title = api.gui.comp.TextView.new("Required & Optional Mods")
    title:setStyleClassList({"heading"})
    content:addChild(title)
    
    -- Required mods section
    local reqLabel = api.gui.comp.TextView.new("── Required Mods ──")
    content:addChild(reqLabel)
    
    for _, mod in ipairs(gui.modDefs) do
        if mod.required then
            local installed = false
            for _, inst in ipairs(gui.installedMods) do
                if inst.name == mod.name then installed = true break end
            end
            
            local status = installed and "✓" or "✗"
            local row = api.gui.comp.TextView.new(
                status .. " " .. mod.name .. " - " .. mod.description
            )
            if not installed then
                row:setTooltip("Download from: " .. mod.url)
            end
            content:addChild(row)
        end
    end
    
    -- Optional mods section
    local optLabel = api.gui.comp.TextView.new("── Optional Mods ──")
    content:addChild(optLabel)
    
    local optInfo = api.gui.comp.TextView.new("These mods enable additional features:")
    content:addChild(optInfo)
    
    for _, mod in ipairs(gui.modDefs) do
        if not mod.required then
            local installed = false
            for _, inst in ipairs(gui.installedMods) do
                if inst.name == mod.name then installed = true break end
            end
            
            local status = installed and "✓" or "○"
            local featureText = mod.optionKey and (" → enables: " .. mod.optionKey) or ""
            local row = api.gui.comp.TextView.new(
                status .. " " .. mod.name .. featureText
            )
            row:setTooltip(mod.description .. "\nDownload: " .. mod.url)
            content:addChild(row)
        end
    end
    
    -- Refresh button
    local btnRefresh = api.gui.comp.Button.new()
    btnRefresh:setText("🔄 Refresh Detection")
    btnRefresh:onClick(function()
        gui.modsWindow:setVisible(false)
        gui.modsWindow = nil
        gui.detectMods()
        gui.showModsWindow()
    end)
    content:addChild(btnRefresh)
    
    -- Close button
    local btnClose = api.gui.comp.Button.new()
    btnClose:setText("Close")
    btnClose:onClick(function()
        gui.modsWindow:setVisible(false)
    end)
    content:addChild(btnClose)
    
    gui.modsWindow = api.gui.comp.Window.new("Mod Status", content)
    gui.modsWindow:addHideOnCloseHandler()
end

-- Create log viewer window
function gui.showLogWindow()
    if gui.logWindow then
        gui.logWindow:setVisible(true)
        return
    end
    
    local content = api.gui.comp.Component.new("VerticalLayout")
    
    gui.logText = api.gui.comp.TextView.new(table.concat(gui.logs, "\n"))
    gui.logText:setMinimumSize(api.gui.util.Size.new(600, 400))
    content:addChild(gui.logText)
    
    local btnClear = api.gui.comp.Button.new()
    btnClear:setText("Clear Logs")
    btnClear:onClick(function()
        gui.logs = {}
        gui.logText:setText("")
    end)
    content:addChild(btnClear)
    
    gui.logWindow = api.gui.comp.Window.new("OSM Importer Logs", content)
    gui.logWindow:addHideOnCloseHandler()
end

-- Update status
function gui.setStatus(text)
    if gui.statusText then
        gui.statusText:setText(text)
    end
end

-- Update progress
function gui.setProgress(percent, text)
    if gui.progressBar then
        gui.progressBar:setProgress(percent / 100)
    end
    if text then
        gui.setStatus(text)
    end
end

-- Enable/disable step buttons
function gui.updateButtons()
    if gui.btnInit then gui.btnInit:setEnabled(not gui.isRunning) end
    if gui.btnTowns then gui.btnTowns:setEnabled(not gui.isRunning and gui.currentStep >= 1) end
    if gui.btnAreas then gui.btnAreas:setEnabled(not gui.isRunning and gui.currentStep >= 1) end
    if gui.btnEdges then gui.btnEdges:setEnabled(not gui.isRunning and gui.currentStep >= 1) end
    if gui.btnObjects then gui.btnObjects:setEnabled(not gui.isRunning and gui.currentStep >= 3) end
    if gui.btnRunAll then gui.btnRunAll:setEnabled(not gui.isRunning) end
    if gui.btnStop then gui.btnStop:setEnabled(gui.isRunning) end
end

-- Step 0: Initialize
function gui.runStep0()
    gui.log("Initializing OSM data...")
    gui.isRunning = true
    gui.updateButtons()
    gui.setProgress(5, "Loading OSM data...")
    
    local ok, err = pcall(function()
        require "osm_importer.main"
        
        if not osmdata then
            error("osmdata.lua not found! Place it in mods/osm_importer/")
        end
        
        gui.log("OSM data loaded successfully", LOG_SUCCESS)
        gui.log("  Nodes: " .. (osmdata.nodes and #osmdata.nodes or "N/A"))
        gui.log("  Edges: " .. (osmdata.edges and #osmdata.edges or "N/A"))
        gui.log("  Towns: " .. (osmdata.towns and #osmdata.towns or "N/A"))
        
        gui.currentStep = 1
        gui.setProgress(10, "Ready - Select next step or Run All")
    end)
    
    if not ok then
        gui.log("Failed to load OSM data: " .. tostring(err), LOG_ERROR)
        gui.setStatus("Error loading data - check logs")
    end
    
    gui.isRunning = false
    gui.updateButtons()
end

-- Step 1: Town Labels
function gui.runStep1()
    gui.log("Creating town labels...")
    gui.isRunning = true
    gui.updateButtons()
    gui.setProgress(15, "Creating town labels...")
    
    local ok, err = pcall(function()
        m.towns.createTownLabels(osmdata.towns)
        gui.log("Town labels created", LOG_SUCCESS)
        
        m.scriptevent.ScriptEvent("setAllTownsDevActive-false")
        gui.log("Town development disabled")
        
        m.scriptevent.ScriptEvent("bulldoze.delEdges")
        bulldoze.delAssets()
        gui.log("Cleared existing streets and trees")
        
        gui.setProgress(20, "Town labels complete")
    end)
    
    if not ok then
        gui.log("Failed: " .. tostring(err), LOG_ERROR)
    end
    
    gui.isRunning = false
    gui.updateButtons()
end

-- Step 2: Forests & Surfaces
function gui.runStep2()
    gui.log("Building forests and ground surfaces...")
    gui.log("This may take a while!", LOG_WARN)
    gui.isRunning = true
    gui.updateButtons()
    gui.setProgress(25, "Building areas...")
    
    local ok, err = pcall(function()
        m.areas.buildAreas(osmdata.areas, osmdata.nodes)
        gui.log("Forests and surfaces complete", LOG_SUCCESS)
        gui.setProgress(40, "Areas complete")
    end)
    
    if not ok then
        gui.log("Failed: " .. tostring(err), LOG_ERROR)
    end
    
    gui.isRunning = false
    gui.updateButtons()
end

-- Step 3: Streets & Tracks
function gui.runStep3()
    gui.log("Building streets and tracks...")
    gui.log("This will take a long time!", LOG_WARN)
    gui.isRunning = true
    gui.updateButtons()
    gui.setProgress(45, "Building edges...")
    
    local ok, err = pcall(function()
        osm_importer.options = gui.options
        
        local edges = osmdata.edges and #osmdata.edges or 0
        gui.log("Building " .. edges .. " edges with options:")
        for k, v in pairs(gui.options) do
            if type(v) == "boolean" then
                gui.log("  " .. k .. " = " .. tostring(v))
            end
        end
        gui.log("Estimated time: " .. math.floor(edges/5/60) .. " minutes")
        
        m.simpleproposalseq.SimpleProposalSeq(osmdata, gui.options)
        
        gui.currentStep = 3
        gui.log("Streets and tracks complete", LOG_SUCCESS)
        gui.setProgress(90, "Edges complete")
    end)
    
    if not ok then
        gui.log("Failed: " .. tostring(err), LOG_ERROR)
    end
    
    gui.isRunning = false
    gui.updateButtons()
end

-- Step 4: Objects
function gui.runStep4()
    gui.log("Building objects...")
    gui.isRunning = true
    gui.updateButtons()
    gui.setProgress(95, "Building objects...")
    
    local ok, err = pcall(function()
        m.models.buildObjects(osmdata.objects)
        gui.log("Objects complete", LOG_SUCCESS)
        gui.currentStep = 4
        gui.setProgress(100, "Import complete!")
        gui.log("=== IMPORT COMPLETE ===", LOG_SUCCESS)
    end)
    
    if not ok then
        gui.log("Failed: " .. tostring(err), LOG_ERROR)
    end
    
    gui.isRunning = false
    gui.updateButtons()
end

-- Run all steps
function gui.runAllSteps()
    gui.log("=== Starting full import ===")
    gui.log("Make sure the game is paused!", LOG_WARN)
    
    gui.runStep0()
    if gui.currentStep >= 1 then
        gui.runStep1()
        gui.runStep2()
        gui.runStep3()
        gui.runStep4()
    end
end

-- Stop import
function gui.stopImport()
    gui.log("Stopping import...", LOG_WARN)
    if m and m.simpleproposalseq then
        m.simpleproposalseq.stop = true
    end
    gui.isRunning = false
    gui.updateButtons()
    gui.setStatus("Import stopped")
end

-- Show the GUI
function gui.show()
    gui.createMainWindow()
end

-- Hide the GUI
function gui.hide()
    if gui.window then gui.window:setVisible(false) end
    if gui.optionsWindow then gui.optionsWindow:setVisible(false) end
    if gui.logWindow then gui.logWindow:setVisible(false) end
    if gui.modsWindow then gui.modsWindow:setVisible(false) end
end

return gui

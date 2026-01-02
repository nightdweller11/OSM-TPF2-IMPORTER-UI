-- OSM Importer Advanced GUI Button
-- Adds a separate "OSM+" button to open the advanced GUI with more options

_G.OSM_ADV_UI = _G.OSM_ADV_UI or {
    trigger = nil,
    initialized = false,
    gui = nil,
    window = nil,
}

local S = _G.OSM_ADV_UI

-- Toggle the advanced GUI
local function toggleAdvancedGui(show)
    print("[OSM-ADV] toggleAdvancedGui called with: " .. tostring(show))
    
    if show then
        -- Load and show the advanced GUI
        print("[OSM-ADV] Attempting to load gui module...")
        
        local ok, err = pcall(function()
            -- Use require and check result
            local guiModule = require("osm_importer.gui")
            print("[OSM-ADV] require returned: " .. type(guiModule))
            
            -- Handle TPF2's require caching issue (can return true instead of table)
            if type(guiModule) ~= "table" then
                print("[OSM-ADV] require returned non-table, trying rawget...")
                guiModule = rawget(_G, "osm_importer_gui")
                print("[OSM-ADV] rawget returned: " .. type(guiModule))
            end
            
            if type(guiModule) == "table" then
                S.gui = guiModule
                print("[OSM-ADV] GUI module loaded successfully")
                
                if S.gui.show then
                    print("[OSM-ADV] Calling gui.show()...")
                    S.gui.show()
                    print("[OSM-ADV] gui.show() completed")
                else
                    print("[OSM-ADV] ERROR: gui.show function not found")
                end
            else
                print("[OSM-ADV] ERROR: Could not load gui module as table")
            end
        end)
        
        if not ok then
            print("[OSM-ADV] ERROR opening advanced GUI: " .. tostring(err))
        end
    else
        -- Hide the advanced GUI
        print("[OSM-ADV] Hiding advanced GUI...")
        if S.gui and S.gui.hide then
            local ok, err = pcall(function() S.gui.hide() end)
            if not ok then
                print("[OSM-ADV] ERROR hiding GUI: " .. tostring(err))
            end
        end
    end
end

function data()
    return {
        guiInit = function()
            print("[OSM-ADV] ========================================")
            print("[OSM-ADV] Initializing advanced GUI button...")
            
            if S.initialized then
                print("[OSM-ADV] Already initialized, skipping")
                return
            end
            
            local ok, err = pcall(function()
                local gameInfo = api.gui.util.getById("gameInfo")
                if not gameInfo then
                    print("[OSM-ADV] ERROR: gameInfo not found")
                    return
                end
                print("[OSM-ADV] gameInfo found")
                
                local layout = gameInfo:getLayout()
                if not layout then
                    print("[OSM-ADV] ERROR: layout not found")
                    return
                end
                print("[OSM-ADV] layout found")
                
                -- Add a separator and the OSM+ button
                layout:addItem(api.gui.comp.Component.new("VerticalLine"))
                print("[OSM-ADV] Added separator")
                
                S.trigger = api.gui.comp.CheckBox.new("OSM+")
                S.trigger:onToggle(function(selected)
                    print("[OSM-ADV] OSM+ button toggled: " .. tostring(selected))
                    toggleAdvancedGui(selected)
                end)
                layout:addItem(S.trigger)
                print("[OSM-ADV] Added OSM+ button")
                
                S.initialized = true
                print("[OSM-ADV] ========================================")
                print("[OSM-ADV] Ready! Click 'OSM+' in bottom bar for advanced options.")
            end)
            
            if not ok then
                print("[OSM-ADV] ERROR during initialization: " .. tostring(err))
            end
        end,
        
        guiUpdate = function() end,
        
        save = function()
            return {}
        end,
        
        load = function(loadedData)
        end,
    }
end

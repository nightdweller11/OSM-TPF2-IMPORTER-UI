# Transport Fever 2 - Debugging & Development Reference

Quick reference for file locations, logs, and API documentation when developing TPF2 mods.

---

## 📁 File Locations

### Steam Installation

| Resource | macOS | Windows | Linux |
|----------|-------|---------|-------|
| **Game Install** | `~/Library/Application Support/Steam/steamapps/common/Transport Fever 2/` | `C:\Program Files (x86)\Steam\steamapps\common\Transport Fever 2\` | `~/.steam/steam/steamapps/common/Transport Fever 2/` |
| **Workshop Mods** | `~/Library/Application Support/Steam/steamapps/workshop/content/1066780/` | `C:\Program Files (x86)\Steam\steamapps\workshop\content\1066780\` | `~/.steam/steam/steamapps/workshop/content/1066780/` |
| **Local Mods** | `<game>/mods/` | `<game>/mods/` | `<game>/mods/` |
| **User Data** | `~/Library/Application Support/Steam/userdata/<userid>/1066780/` | `C:\Program Files (x86)\Steam\userdata\<userid>\1066780\` | `~/.local/share/Steam/userdata/<userid>/1066780/` |
| **Crash Dumps** | `<userdata>/local/crash_dump/` | `<userdata>/local/crash_dump/` | `<userdata>/local/crash_dump/` |
| **Saves** | `<userdata>/local/save/` | `<userdata>/local/save/` | `<userdata>/local/save/` |
| **Screenshots** | `<userdata>/local/screenshots/` | `<userdata>/local/screenshots/` | `<userdata>/local/screenshots/` |

### GOG / Non-Steam Installation

| Resource | macOS | Windows | Linux |
|----------|-------|---------|-------|
| **Game Install** | `/Applications/Transport Fever 2.app/` | `C:\GOG Games\Transport Fever 2\` | Varies |
| **User Data** | `~/Library/Application Support/Transport Fever 2/` | `%APPDATA%\Transport Fever 2\` | `~/.local/share/Transport Fever 2/` |
| **Crash Dumps** | `<userdata>/crash_dump/` | `<userdata>/crash_dump/` | `<userdata>/crash_dump/` |
| **Local Mods** | `<game>/mods/` | `<game>/mods/` | `<game>/mods/` |

---

## 📋 Log Files

### stdout.txt
The main log file containing all `print()` output from Lua scripts.

**Location during gameplay:**
- Written to game directory while running
- Copied to crash dump folder on crash

**Location after crash:**
```
<crash_dump>/<crash_id>_stdout.txt
```

**Example (macOS Steam):**
```
~/Library/Application Support/Steam/userdata/134539820/1066780/local/crash_dump/2C4F99CE-E529-4072-94C5-E993C9FA4556_stdout.txt
```

### Crash Dump Files (.dmp)
Binary crash dump files for debugging with native tools.

```
<crash_dump>/<crash_id>.dmp
```

### Reading Logs
```bash
# macOS - View latest crash log
cat ~/Library/Application\ Support/Steam/userdata/*/1066780/local/crash_dump/*_stdout.txt | tail -200

# macOS - List crash dumps by date
ls -lt ~/Library/Application\ Support/Steam/userdata/*/1066780/local/crash_dump/*.dmp | head -10

# Windows (PowerShell)
Get-Content "$env:LOCALAPPDATA\Steam\userdata\*\1066780\local\crash_dump\*_stdout.txt" | Select-Object -Last 200
```

---

## 🎮 Game Resources (Vanilla Assets)

### Base Game Resources
Located in `<game>/res/`:

| Folder | Contents |
|--------|----------|
| `res/config/street/` | Street type definitions |
| `res/config/track/` | Track type definitions |
| `res/config/bridge/` | Bridge type definitions |
| `res/config/tunnel/` | Tunnel type definitions |
| `res/config/model/` | 3D model definitions |
| `res/config/construction/` | Construction definitions |
| `res/config/game_script/` | Game scripts (UI, events) |
| `res/scripts/` | Lua utility scripts |
| `res/models/` | 3D model files (.mdl) |
| `res/textures/` | Texture files |

### Common Vanilla Asset Paths

**Streets:**
```lua
"standard/country_small_new.lua"
"standard/town_small_new.lua"
"standard/country_medium_new.lua"
"standard/town_medium_new.lua"
"standard/country_large_new.lua"
```

**Tracks:**
```lua
"standard.lua"
"high_speed.lua"
```

**Bridges:**
```lua
"stone.lua"
"cement.lua"
"iron.lua"
"steel.lua"
```

**Tunnels:**
```lua
"railroad_old.lua"
"railroad_modern.lua"
"street_old.lua"
"street_modern.lua"
```

---

## 🔧 Mod Structure

```
mods/
└── your_mod_name_1/
    ├── mod.lua              # Mod definition (required)
    ├── res/
    │   ├── config/
    │   │   ├── game_script/ # UI scripts
    │   │   ├── street/      # Custom streets
    │   │   ├── track/       # Custom tracks
    │   │   └── ...
    │   ├── scripts/         # Lua modules
    │   │   └── your_mod/
    │   │       └── main.lua
    │   └── models/          # 3D models
    └── strings/             # Translations
        └── en.lua
```

### mod.lua Template
```lua
function data()
    return {
        info = {
            minorVersion = 1,
            severityAdd = "NONE",
            severityRemove = "NONE",
            name = _("Mod Name"),
            description = _("Description"),
            authors = {
                { name = "Author", role = "CREATOR" }
            },
            tags = { "Script Mod" },
        },
        runFn = function(settings, modParams)
            -- Called when mod loads
        end,
        postRunFn = function(settings, modParams)
            -- Called after all mods load
        end,
        -- Optional dependencies
        dependencies = { },
        optionalDependencies = { "snowball_forester_1", "paver_1" },
    }
end
```

---

## 📚 API Documentation

### Official Wiki
- **Main API Reference:** https://wiki.transportfever2.com/api/
- **Modules Index:** https://wiki.transportfever2.com/api/modules/

### Key API Modules

| Module | Description | Link |
|--------|-------------|------|
| `api.gui` | GUI components | https://wiki.transportfever2.com/api/modules/api.gui.html |
| `api.cmd` | Game commands | https://wiki.transportfever2.com/api/modules/api.cmd.html |
| `api.cmd.make` | Command builders | https://wiki.transportfever2.com/api/modules/api.cmd.make.html |
| `api.res` | Resource repositories | https://wiki.transportfever2.com/api/modules/api.res.html |
| `api.engine` | Engine utilities | https://wiki.transportfever2.com/api/modules/api.engine.html |
| `api.type` | Type definitions | https://wiki.transportfever2.com/api/modules/api.type.html |
| `game.interface` | Game interface | https://wiki.transportfever2.com/api/modules/game.interface.html |

### Common API Patterns

**Finding Resources:**
```lua
-- Get resource ID by name
local streetId = api.res.streetTypeRep.find("standard/country_small_new.lua")
local trackId = api.res.trackTypeRep.find("standard.lua")
local bridgeId = api.res.bridgeTypeRep.find("stone.lua")
local tunnelId = api.res.tunnelTypeRep.find("railroad_old.lua")

-- Get resource count
local count = api.res.streetTypeRep.getCount()

-- Get resource name by ID
local name = api.res.streetTypeRep.getName(0)
```

**Sending Commands:**
```lua
-- Build a proposal
api.cmd.sendCommand(api.cmd.make.buildProposal(proposal, nil, true))

-- Remove a town (WARNING: can crash!)
api.cmd.sendCommand(api.cmd.make.removeTown(townId))

-- Sell a vehicle
api.cmd.sendCommand(api.cmd.make.sellVehicle(vehicleId))
```

**Getting Entities:**
```lua
-- Get all entities of type
local edges = game.interface.getEntities({ radius = math.huge }, { type = "BASE_EDGE" })
local towns = game.interface.getEntities({ radius = math.huge }, { type = "TOWN" })
local vehicles = game.interface.getVehicles()
local lines = game.interface.getLines()

-- Get entity details
local entity = game.interface.getEntity(entityId)
```

**GUI Components:**
```lua
-- Create button (proper way)
local btn = api.gui.comp.Button.new(api.gui.comp.TextView.new("Click Me"), true)
btn:onClick(function()
    print("Button clicked!")
end)

-- Create checkbox
local cb = api.gui.comp.CheckBox.new("Option Label")
cb:setSelected(true, false)
cb:onToggle(function(selected)
    print("Selected:", selected)
end)

-- Create window
local layout = api.gui.layout.BoxLayout.new("VERTICAL")
layout:addItem(api.gui.comp.TextView.new("Hello"))
local window = api.gui.comp.Window.new("Window Title", layout)
window:setVisible(true, false)
```

**Terrain:**
```lua
-- Get heightmap size
local size = api.engine.terrain.getHeightmapSize()
-- size.x, size.y are dimensions

-- Get height at position
local height = api.engine.terrain.getHeightAt(vec2.new(x, y))

-- Convert heightmap index to world position
local worldPos = api.engine.terrain.heightmapIndexToWorldPos(api.type.Vec2i.new(x, y))
```

---

## ⚠️ Known Issues & Gotchas

### Commands That Can Crash
These `api.cmd.make` commands can crash the game engine when called from UI context:

| Command | Issue |
|---------|-------|
| `removeTown(id)` | Crashes game engine, deferred crash |
| `setTerrainHeight()` | Not properly supported for bulk operations |
| `buildProposal()` with invalid IDs | Assertion failures |

### Safe Entity Removal
Only these are safe from UI context:
```lua
api.cmd.make.sellVehicle(id)
api.cmd.make.deleteLine(id)
game.interface.bulldoze(assetId)  -- for ASSET_GROUP only
```

### Module Loading Issues
TPF2's `require` can cache `true` instead of the module table:
```lua
-- Problem: Can return boolean instead of table
local mymod = require("mymod")

-- Solution: Use rawget from _G after require
require("osm_importer.main")
local osm_importer = rawget(_G, "osm_importer")
```

### Resource ID Validation
Always check if resource exists before using:
```lua
local id = api.res.streetTypeRep.find("some_street.lua")
if id and id >= 0 then
    -- Safe to use
else
    -- Use fallback
end
```

---

## 🔗 Community Resources

### Forums & Support
- **Official Forum:** https://www.transportfever.net/
- **Steam Community:** https://steamcommunity.com/app/1066780/
- **Reddit:** https://www.reddit.com/r/TransportFever2/
- **Official Help Desk:** https://www.transportfever2.com/en/support/help-desk/

### Modding Guides
- **Modding Wiki:** https://wiki.transportfever2.com/wiki/
- **Lua API Reference:** https://wiki.transportfever2.com/api/
- **Model Modding:** https://wiki.transportfever2.com/wiki/Modding:Models

### Useful Mods for Development
- **Debug Mod** - Shows entity IDs and debug info
- **Console Mod** - In-game Lua console
- **CommonAPI2** - Extended API utilities

---

## 🛠️ Quick Debug Commands

### View Logs (macOS)
```bash
# Tail live stdout (while game runs)
tail -f "/Users/$USER/Library/Application Support/Steam/steamapps/common/Transport Fever 2/stdout.txt"

# View crash logs
ls -lt ~/Library/Application\ Support/Steam/userdata/*/1066780/local/crash_dump/ | head -10

# View latest crash stdout
cat ~/Library/Application\ Support/Steam/userdata/*/1066780/local/crash_dump/*_stdout.txt | tail -300
```

### Copy Mod Files (macOS)
```bash
# Copy mod to game folder
cp -r /path/to/your/mod "/Users/$USER/Library/Application Support/Steam/steamapps/common/Transport Fever 2/mods/"
```

### In-Game Lua Console
If you have a console mod installed:
```lua
-- List all street types
for i = 0, api.res.streetTypeRep.getCount() - 1 do
    print(i, api.res.streetTypeRep.getName(i))
end

-- Get entity info
print(debugPrint(game.interface.getEntity(12345)))
```

---

*Last updated: January 2026*


# OSM Data Installation Scripts

These scripts help you install your exported `osmdata.lua` file to the correct Transport Fever 2 mod folder.

## Usage

### Windows (Command Prompt)

1. Download `osmdata.lua` and `install-osmdata.bat` to the same folder
2. Double-click `install-osmdata.bat`
3. Follow the prompts

### Windows (PowerShell)

1. Download `osmdata.lua` and `install-osmdata.ps1` to the same folder
2. Right-click `install-osmdata.ps1` and select "Run with PowerShell"
3. Or open PowerShell and run:
   ```powershell
   .\install-osmdata.ps1
   ```

### macOS / Linux

1. Download `osmdata.lua` and `install-osmdata.sh` to the same folder
2. Open Terminal in that folder
3. Run:
   ```bash
   chmod +x install-osmdata.sh
   ./install-osmdata.sh
   ```

## What the Scripts Do

1. **Find `osmdata.lua`** in the same folder as the script
2. **Search for TPF2** installation (Steam and standalone locations)
3. **Find the OSM Importer UI mod** folder
4. **Check for existing file** and warn if it will be overwritten
5. **Create a backup** of any existing `osmdata.lua`
6. **Copy the new file** to the correct location

## Supported Locations

### Steam (automatically detected)

**Windows:**
- `C:\Program Files (x86)\Steam\steamapps\common\Transport Fever 2\mods`
- `C:\Program Files\Steam\steamapps\common\Transport Fever 2\mods`
- `D:\Steam\...`, `D:\SteamLibrary\...`, `E:\Steam\...`, etc.

**macOS:**
- `~/Library/Application Support/Steam/steamapps/common/Transport Fever 2/mods`

**Linux:**
- `~/.steam/steam/steamapps/common/Transport Fever 2/mods`
- `~/.local/share/Steam/steamapps/common/Transport Fever 2/mods`

### Standalone (automatically detected)

**Windows:**
- `%APPDATA%\Transport Fever 2\mods`

**macOS:**
- `~/Library/Application Support/Transport Fever 2/mods`

**Linux:**
- `~/.local/share/Transport Fever 2/mods`

## Troubleshooting

### "osmdata.lua not found"
Make sure the `osmdata.lua` file is in the same folder as the install script.

### "Transport Fever 2 mods folder not found"
The game may be installed in a non-standard location. Manually copy `osmdata.lua` to:
```
<TPF2 installation>/mods/osm_importer_ui_1/osmdata.lua
```

### "OSM Importer UI mod not found"
You need to install the OSM Importer UI mod first. Run `install-mod.sh` (macOS/Linux) or `install-mod.bat` (Windows).

## After Installation

1. Start Transport Fever 2
2. Load or create a game with the OSM Importer UI mod enabled
3. Click "OSM" in the bottom bar
4. Configure your import options
5. Click "RUN IMPORT" to start the import


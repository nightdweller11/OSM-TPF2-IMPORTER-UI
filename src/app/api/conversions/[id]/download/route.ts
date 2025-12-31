import { NextRequest, NextResponse } from "next/server";
import { getDb, conversions } from "@/lib/db";
import { eq } from "drizzle-orm";
import { filterAndWriteLua, FilterOptions } from "@/lib/lua-filter";
import fs from "fs/promises";
import path from "path";
import os from "os";
import archiver from "archiver";
import { Readable } from "stream";

// Install script contents (embedded so they're always available)
const INSTALL_SCRIPT_SH = `#!/bin/bash
# OSM Data Installer for Transport Fever 2
# This script copies your exported osmdata.lua to the correct mod folder

set -e

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

echo -e "\${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          OSM Data Installer for Transport Fever 2          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "\${NC}"

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
SOURCE_FILE=""

if [ -f "$SCRIPT_DIR/osmdata.lua" ]; then
    SOURCE_FILE="$SCRIPT_DIR/osmdata.lua"
elif [ -f "./osmdata.lua" ]; then
    SOURCE_FILE="$(pwd)/osmdata.lua"
else
    echo -e "\${RED}ERROR: osmdata.lua not found!\${NC}"
    exit 1
fi

echo -e "\${GREEN}Found:\${NC} $SOURCE_FILE"

MOD_NAME="osm_importer_ui_1"
TPF2_MODS=""

if [[ "$OSTYPE" == "darwin"* ]]; then
    STEAM_PATHS=("$HOME/Library/Application Support/Steam/steamapps/common/Transport Fever 2/mods")
    STANDALONE_PATHS=("$HOME/Library/Application Support/Transport Fever 2/mods")
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    STEAM_PATHS=("$HOME/.steam/steam/steamapps/common/Transport Fever 2/mods" "$HOME/.local/share/Steam/steamapps/common/Transport Fever 2/mods")
    STANDALONE_PATHS=("$HOME/.local/share/Transport Fever 2/mods")
else
    echo -e "\${RED}ERROR: Unsupported OS\${NC}"
    exit 1
fi

for path in "\${STEAM_PATHS[@]}"; do
    if [ -d "$path" ]; then
        TPF2_MODS="$path"
        echo -e "\${GREEN}Found Steam:\${NC} $path"
        break
    fi
done

if [ -z "$TPF2_MODS" ]; then
    for path in "\${STANDALONE_PATHS[@]}"; do
        if [ -d "$path" ]; then
            TPF2_MODS="$path"
            echo -e "\${GREEN}Found standalone:\${NC} $path"
            break
        fi
    done
fi

if [ -z "$TPF2_MODS" ]; then
    echo -e "\${RED}ERROR: Could not find Transport Fever 2!\${NC}"
    exit 1
fi

MOD_DIR="$TPF2_MODS/$MOD_NAME"
if [ ! -d "$MOD_DIR" ]; then
    echo -e "\${RED}ERROR: OSM Importer UI mod not installed!\${NC}"
    exit 1
fi

DEST_FILE="$MOD_DIR/osmdata.lua"
if [ -f "$DEST_FILE" ]; then
    echo -e "\${YELLOW}WARNING: osmdata.lua already exists!\${NC}"
    BACKUP_FILE="$MOD_DIR/osmdata.lua.backup.$(date +%Y%m%d_%H%M%S)"
    read -p "Replace it? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp "$DEST_FILE" "$BACKUP_FILE"
        echo "Backup created: $BACKUP_FILE"
    else
        exit 0
    fi
fi

cp "$SOURCE_FILE" "$DEST_FILE"
echo -e "\${GREEN}✓ Installation successful!\${NC}"
echo "Installed to: $DEST_FILE"
`;

const INSTALL_SCRIPT_BAT = `@echo off
REM OSM Data Installer for Transport Fever 2
setlocal enabledelayedexpansion

echo.
echo ================================================================
echo          OSM Data Installer for Transport Fever 2
echo ================================================================
echo.

set "MOD_NAME=osm_importer_ui_1"
set "SCRIPT_DIR=%~dp0"

if exist "%SCRIPT_DIR%osmdata.lua" (
    set "SOURCE_FILE=%SCRIPT_DIR%osmdata.lua"
) else if exist "osmdata.lua" (
    set "SOURCE_FILE=%CD%\\osmdata.lua"
) else (
    echo ERROR: osmdata.lua not found!
    pause
    exit /b 1
)

echo Found: %SOURCE_FILE%

set "STEAM_PATHS[0]=C:\\Program Files (x86)\\Steam\\steamapps\\common\\Transport Fever 2\\mods"
set "STEAM_PATHS[1]=C:\\Program Files\\Steam\\steamapps\\common\\Transport Fever 2\\mods"
set "STEAM_PATHS[2]=D:\\Steam\\steamapps\\common\\Transport Fever 2\\mods"
set "STEAM_PATHS[3]=D:\\SteamLibrary\\steamapps\\common\\Transport Fever 2\\mods"

for /L %%i in (0,1,3) do (
    if exist "!STEAM_PATHS[%%i]!" (
        set "TPF2_MODS=!STEAM_PATHS[%%i]!"
        echo Found: !TPF2_MODS!
        goto :found_mods
    )
)

if exist "%APPDATA%\\Transport Fever 2\\mods" (
    set "TPF2_MODS=%APPDATA%\\Transport Fever 2\\mods"
    echo Found: !TPF2_MODS!
    goto :found_mods
)

echo ERROR: Could not find Transport Fever 2!
pause
exit /b 1

:found_mods
set "MOD_DIR=%TPF2_MODS%\\%MOD_NAME%"

if not exist "%MOD_DIR%" (
    echo ERROR: OSM Importer UI mod not installed!
    pause
    exit /b 1
)

set "DEST_FILE=%MOD_DIR%\\osmdata.lua"

if exist "%DEST_FILE%" (
    echo WARNING: osmdata.lua already exists!
    set /p "CONFIRM=Replace it? (y/n): "
    if /i "!CONFIRM!" neq "y" exit /b 0
    for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
    copy "%DEST_FILE%" "%MOD_DIR%\\osmdata.lua.backup.%datetime:~0,8%_%datetime:~8,6%" > nul
)

copy /y "%SOURCE_FILE%" "%DEST_FILE%" > nul
echo.
echo Installation successful!
echo Installed to: %DEST_FILE%
pause
`;

const README_TXT = `OSM Data for Transport Fever 2
==============================

This package contains your exported OpenStreetMap data for TPF2.

INSTALLATION:
-------------

Windows:
  Double-click "install-osmdata.bat"

macOS/Linux:
  Open Terminal, navigate to this folder, and run:
    chmod +x install-osmdata.sh
    ./install-osmdata.sh

MANUAL INSTALLATION:
--------------------
Copy "osmdata.lua" to:
  <TPF2 installation>/mods/osm_importer_ui_1/osmdata.lua

AFTER INSTALLATION:
-------------------
1. Start Transport Fever 2
2. Load/create a game with OSM Importer UI enabled
3. Click "OSM" in the bottom bar
4. Click "RUN IMPORT"

For more info: https://github.com/Vacuum-Tube/OSM-TPF2-Importer
`;

// GET /api/conversions/[id]/download - Download conversion with optional filtering
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    const db = getDb();
    
    const result = await db
      .select()
      .from(conversions)
      .where(eq(conversions.id, id))
      .limit(1);

    const conversion = result[0];
    
    if (!conversion) {
      return NextResponse.json(
        { error: "Conversion not found" },
        { status: 404 }
      );
    }

    if (conversion.status !== "COMPLETED" || !conversion.luaFile) {
      return NextResponse.json(
        { error: "Conversion not ready for download" },
        { status: 400 }
      );
    }

    // Check download format
    const format = searchParams.get("format") || "lua";
    
    // Check if filtering is requested
    const hasFilters = 
      searchParams.has("includeRailways") ||
      searchParams.has("includeStreets") ||
      searchParams.has("includePaths") ||
      searchParams.has("includeForests") ||
      searchParams.has("includeGrounds") ||
      searchParams.has("includeObjects") ||
      searchParams.has("includeTowns") ||
      searchParams.has("includeSignals") ||
      searchParams.has("includeStreams");

    let luaFilePath = conversion.luaFile;
    let tempFile: string | null = null;

    if (hasFilters) {
      const filterOptions: Partial<FilterOptions> = {
        includeRailways: searchParams.get("includeRailways") !== "false",
        includeStreets: searchParams.get("includeStreets") !== "false",
        includePaths: searchParams.get("includePaths") !== "false",
        includeForests: searchParams.get("includeForests") !== "false",
        includeGrounds: searchParams.get("includeGrounds") !== "false",
        includeObjects: searchParams.get("includeObjects") !== "false",
        includeTowns: searchParams.get("includeTowns") !== "false",
        includeSignals: searchParams.get("includeSignals") !== "false",
        includeStreams: searchParams.get("includeStreams") !== "false",
      };

      if (searchParams.has("railTypes")) {
        filterOptions.railTypes = searchParams.get("railTypes")?.split(",");
      }
      if (searchParams.has("highwayTypes")) {
        filterOptions.highwayTypes = searchParams.get("highwayTypes")?.split(",");
      }

      tempFile = path.join(os.tmpdir(), `osmdata_filtered_${id}_${Date.now()}.lua`);
      
      const filterResult = await filterAndWriteLua(
        conversion.luaFile,
        tempFile,
        filterOptions
      );

      if (!filterResult.success) {
        return NextResponse.json(
          { error: `Failed to filter data: ${filterResult.error}` },
          { status: 500 }
        );
      }

      luaFilePath = tempFile;
    }

    const safeName = conversion.name.replace(/[^a-zA-Z0-9]/g, "_");

    // Handle different download formats
    if (format === "zip") {
      // Create ZIP with lua file and install scripts
      const zipBuffer = await createZipPackage(luaFilePath, safeName);
      
      // Clean up temp file
      if (tempFile) {
        fs.unlink(tempFile).catch(() => {});
      }

      // Increment download counter
      const currentDownloads = conversion.downloads || 0;
      await db
        .update(conversions)
        .set({ downloads: currentDownloads + 1 })
        .where(eq(conversions.id, id));

      return new NextResponse(zipBuffer, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="osmdata_${safeName}.zip"`,
          "Content-Length": zipBuffer.length.toString(),
        },
      });
    } else if (format === "script-sh") {
      // Download shell script only
      return new NextResponse(INSTALL_SCRIPT_SH, {
        headers: {
          "Content-Type": "application/x-sh",
          "Content-Disposition": `attachment; filename="install-osmdata.sh"`,
        },
      });
    } else if (format === "script-bat") {
      // Download batch script only
      return new NextResponse(INSTALL_SCRIPT_BAT, {
        headers: {
          "Content-Type": "application/x-bat",
          "Content-Disposition": `attachment; filename="install-osmdata.bat"`,
        },
      });
    } else {
      // Default: just the lua file
      const fileContent = await fs.readFile(luaFilePath);
      
      if (tempFile) {
        fs.unlink(tempFile).catch(() => {});
      }

      // Increment download counter
      const currentDownloads = conversion.downloads || 0;
      await db
        .update(conversions)
        .set({ downloads: currentDownloads + 1 })
        .where(eq(conversions.id, id));

      return new NextResponse(fileContent, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="osmdata_${safeName}.lua"`,
          "Content-Length": fileContent.length.toString(),
        },
      });
    }
  } catch (error) {
    console.error("Error downloading conversion:", error);
    return NextResponse.json(
      { error: "Failed to download conversion" },
      { status: 500 }
    );
  }
}

// Create a ZIP package with lua file and install scripts
async function createZipPackage(luaFilePath: string, name: string): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const chunks: Buffer[] = [];
    
    const archive = archiver("zip", {
      zlib: { level: 9 }
    });
    
    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    
    // Add the lua file
    const luaContent = await fs.readFile(luaFilePath);
    archive.append(luaContent, { name: "osmdata.lua" });
    
    // Add install scripts
    archive.append(INSTALL_SCRIPT_SH, { 
      name: "install-osmdata.sh",
      mode: 0o755 // Make executable
    });
    
    archive.append(INSTALL_SCRIPT_BAT, { 
      name: "install-osmdata.bat" 
    });
    
    // Add README
    archive.append(README_TXT, { 
      name: "README.txt" 
    });
    
    archive.finalize();
  });
}

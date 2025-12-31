#!/bin/bash
# OSM Data Installer for Transport Fever 2
# This script copies your exported osmdata.lua to the correct mod folder
# Works on macOS and Linux

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          OSM Data Installer for Transport Fever 2          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Find the osmdata.lua file in the same directory as this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_FILE=""

# Check for osmdata.lua in script directory
if [ -f "$SCRIPT_DIR/osmdata.lua" ]; then
    SOURCE_FILE="$SCRIPT_DIR/osmdata.lua"
elif [ -f "./osmdata.lua" ]; then
    SOURCE_FILE="$(pwd)/osmdata.lua"
else
    echo -e "${RED}ERROR: osmdata.lua not found!${NC}"
    echo ""
    echo "Please make sure osmdata.lua is in the same folder as this script,"
    echo "or run this script from the folder containing osmdata.lua."
    echo ""
    exit 1
fi

echo -e "${GREEN}Found:${NC} $SOURCE_FILE"
echo ""

# Detect OS and find TPF2 mods folder
MOD_NAME="osm_importer_ui_1"
TPF2_MODS=""

if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Detected: macOS"
    echo ""
    
    # Steam locations (macOS)
    STEAM_PATHS=(
        "$HOME/Library/Application Support/Steam/steamapps/common/Transport Fever 2/mods"
    )
    
    # Standalone locations (macOS)
    STANDALONE_PATHS=(
        "$HOME/Library/Application Support/Transport Fever 2/mods"
    )
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Detected: Linux"
    echo ""
    
    # Steam locations (Linux)
    STEAM_PATHS=(
        "$HOME/.steam/steam/steamapps/common/Transport Fever 2/mods"
        "$HOME/.local/share/Steam/steamapps/common/Transport Fever 2/mods"
    )
    
    # Standalone locations (Linux)
    STANDALONE_PATHS=(
        "$HOME/.local/share/Transport Fever 2/mods"
    )
else
    echo -e "${RED}ERROR: Unsupported OS: $OSTYPE${NC}"
    echo "This script supports macOS and Linux."
    echo "For Windows, please use install-osmdata.bat or install-osmdata.ps1"
    exit 1
fi

# Search for TPF2 mods folder
echo "Searching for Transport Fever 2..."

# Check Steam locations first
for path in "${STEAM_PATHS[@]}"; do
    if [ -d "$path" ]; then
        TPF2_MODS="$path"
        echo -e "${GREEN}Found Steam installation:${NC} $path"
        break
    fi
done

# If not found, check standalone
if [ -z "$TPF2_MODS" ]; then
    for path in "${STANDALONE_PATHS[@]}"; do
        if [ -d "$path" ]; then
            TPF2_MODS="$path"
            echo -e "${GREEN}Found standalone installation:${NC} $path"
            break
        fi
    done
fi

# Still not found?
if [ -z "$TPF2_MODS" ]; then
    echo -e "${RED}ERROR: Could not find Transport Fever 2 mods folder!${NC}"
    echo ""
    echo "Searched locations:"
    for path in "${STEAM_PATHS[@]}"; do
        echo "  - $path"
    done
    for path in "${STANDALONE_PATHS[@]}"; do
        echo "  - $path"
    done
    echo ""
    echo "Please install Transport Fever 2 first, or manually copy osmdata.lua to:"
    echo "  <TPF2 installation>/mods/$MOD_NAME/res/scripts/osm_importer/osmdata.lua"
    exit 1
fi

# Find the OSM Importer mod
MOD_DIR="$TPF2_MODS/$MOD_NAME"

if [ ! -d "$MOD_DIR" ]; then
    echo -e "${RED}ERROR: OSM Importer UI mod not found!${NC}"
    echo ""
    echo "Expected location: $MOD_DIR"
    echo ""
    echo "Please install the OSM Importer UI mod first:"
    echo "  1. Download from the mod repository"
    echo "  2. Run install-mod.sh"
    echo "  3. Then run this script again"
    exit 1
fi

echo -e "${GREEN}Found mod folder:${NC} $MOD_DIR"
echo ""

# The osmdata.lua must go in res/scripts/osm_importer/
SCRIPTS_DIR="$MOD_DIR/res/scripts/osm_importer"

if [ ! -d "$SCRIPTS_DIR" ]; then
    echo -e "${RED}ERROR: Scripts folder not found!${NC}"
    echo "Expected: $SCRIPTS_DIR"
    echo "The mod installation may be incomplete."
    exit 1
fi

# Check if osmdata.lua already exists
DEST_FILE="$SCRIPTS_DIR/osmdata.lua"

if [ -f "$DEST_FILE" ]; then
    echo -e "${YELLOW}⚠️  WARNING: osmdata.lua already exists!${NC}"
    echo ""
    echo "Existing file: $DEST_FILE"
    echo "File size: $(ls -lh "$DEST_FILE" | awk '{print $5}')"
    echo "Modified: $(stat -f '%Sm' -t '%Y-%m-%d %H:%M:%S' "$DEST_FILE" 2>/dev/null || stat -c '%y' "$DEST_FILE" 2>/dev/null | cut -d'.' -f1)"
    echo ""
    
    # Create backup
    BACKUP_FILE="$MOD_DIR/osmdata.lua.backup.$(date +%Y%m%d_%H%M%S)"
    
    read -p "Do you want to replace it? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Creating backup: $BACKUP_FILE"
        cp "$DEST_FILE" "$BACKUP_FILE"
    else
        echo "Installation cancelled."
        exit 0
    fi
fi

# Copy the file
echo ""
echo "Copying osmdata.lua..."
cp "$SOURCE_FILE" "$DEST_FILE"

# Verify
if [ -f "$DEST_FILE" ]; then
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✓ Installation successful!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "osmdata.lua has been copied to:"
    echo "  $DEST_FILE"
    echo ""
    echo "File size: $(ls -lh "$DEST_FILE" | awk '{print $5}')"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Start Transport Fever 2"
    echo "  2. Load or create a game with OSM Importer UI enabled"
    echo "  3. Click 'OSM' in the bottom bar"
    echo "  4. Click 'RUN IMPORT' to import your map data"
    echo ""
else
    echo -e "${RED}ERROR: Failed to copy file!${NC}"
    exit 1
fi


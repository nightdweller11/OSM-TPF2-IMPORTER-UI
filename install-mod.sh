#!/bin/bash
# OSM Importer UI - Mod Installation Script (macOS/Linux)
# Run this script to copy the latest mod version to TPF2

set -e

MOD_NAME="osm_importer_ui_1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect OS and set paths
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - Steam version
    STEAM_MODS="$HOME/Library/Application Support/Steam/steamapps/common/Transport Fever 2/mods"
    # Fallback to standalone version
    STANDALONE_MODS="$HOME/Library/Application Support/Transport Fever 2/mods"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - Steam version
    STEAM_MODS="$HOME/.steam/steam/steamapps/common/Transport Fever 2/mods"
    # Fallback to standalone version
    STANDALONE_MODS="$HOME/.local/share/Transport Fever 2/mods"
else
    echo "❌ Unknown OS: $OSTYPE"
    exit 1
fi

# Prefer Steam location if it exists
if [ -d "$STEAM_MODS" ]; then
    TPF2_MODS="$STEAM_MODS"
    echo "📍 Found Steam installation"
elif [ -d "$STANDALONE_MODS" ]; then
    TPF2_MODS="$STANDALONE_MODS"
    echo "📍 Found standalone installation"
else
    echo "❌ Could not find Transport Fever 2 mods folder!"
    echo "   Tried: $STEAM_MODS"
    echo "   Tried: $STANDALONE_MODS"
    exit 1
fi

MOD_DIR="$TPF2_MODS/$MOD_NAME"

echo ""
echo "🚀 OSM Importer UI - Mod Installer"
echo "=================================="
echo ""
echo "Source: $SCRIPT_DIR"
echo "Target: $MOD_DIR"
echo ""

# Create mod directory
mkdir -p "$MOD_DIR"

# Copy mod files
echo "📦 Copying mod files..."
cp "$SCRIPT_DIR/mod.lua" "$MOD_DIR/"
cp -r "$SCRIPT_DIR/res" "$MOD_DIR/"

# Check if osmdata.lua exists and preserve it
if [ -f "$MOD_DIR/osmdata.lua" ]; then
    echo "✓ Preserved existing osmdata.lua"
fi

echo ""
echo "✅ Mod installed successfully!"
echo ""
echo "Installed files:"
ls -la "$MOD_DIR"
echo ""
echo "📝 Next steps:"
echo "   1. Restart Transport Fever 2"
echo "   2. Enable 'OSM Importer UI' in Mod Manager"
echo "   3. Also enable: CommonAPI2, Forester, Paver"
echo "   4. Place your osmdata.lua in:"
echo "      $MOD_DIR/res/scripts/osm_importer/osmdata.lua"
echo ""

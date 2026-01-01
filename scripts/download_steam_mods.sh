#!/bin/bash
# Download Steam Workshop mods using SteamCMD
# You'll need to enter your Steam credentials when prompted

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_DIR/bundled_mods/steam_workshop"

mkdir -p "$OUTPUT_DIR"

echo "==========================================="
echo "Steam Workshop Mod Downloader"
echo "==========================================="
echo ""
echo "This script will download all required Steam Workshop mods."
echo "You'll need to enter your Steam username and password."
echo ""

# Check if steamcmd is installed
if ! command -v steamcmd &> /dev/null; then
    echo "SteamCMD not found. Installing via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install --cask steamcmd
    else
        echo "ERROR: Please install Homebrew first or install SteamCMD manually."
        echo "Visit: https://developer.valvesoftware.com/wiki/SteamCMD"
        exit 1
    fi
fi

# Prompt for username
read -p "Enter your Steam username: " STEAM_USER

if [ -z "$STEAM_USER" ]; then
    echo "ERROR: Username is required"
    exit 1
fi

echo ""
echo "Starting SteamCMD download..."
echo "You will be prompted for your password and possibly Steam Guard code."
echo ""

# TPF2 App ID
APP_ID=1066780

# List of mod IDs
MODS=(
    # Track types
    2060012969  # Vienna Fever: Infrastructure
    2258619623  # Berlin Stadtbahn Viaduct Construction
    1983390040  # Old Track
    2072274420  # Ballast
    
    # Street types
    1968514713  # ext.roads footpaths standalone
    2021038808  # Street fine tuning
    2363493916  # Freestyle train station
    1933747406  # Marc's Street and Trampack
    2232249704  # Airport Roads
    1943578742  # SMP 2.0
    2014569888  # Water Textures
    
    # Bridge types
    2187434173  # TFMR2.0 Bridge
    1939805466  # Bridge Type-1
    2060132685  # Vienna Fever: Bridge and Retaining Wall
    
    # Signals
    2770909719  # Signalkomponenten
    2920749928  # Ks-Signalsystem
    2770910636  # Level crossing signals
    2294246900  # Signal Distance
    
    # Objects
    1963592311  # Connum's German Traffic Assets
    
    # Forester / Trees
    2247194383  # Spacky_Trees conifers
    
    # Paver / Ground
    2763516913  # Ingo's textures - pavement
    3432184100  # Ingo's Vegetation Extended
    
    # Additional
    2161175689  # Realistic Railway Slopes
    2206802861  # Maximum Street Slopes
    2558586098  # Realistic Track Curve Speeds
)

# Build the workshop download commands
WORKSHOP_CMDS=""
for MOD_ID in "${MODS[@]}"; do
    WORKSHOP_CMDS="$WORKSHOP_CMDS +workshop_download_item $APP_ID $MOD_ID"
done

# Run steamcmd
steamcmd +login "$STEAM_USER" $WORKSHOP_CMDS +quit

# Copy downloaded mods to output directory
STEAMCMD_CONTENT="$HOME/Library/Application Support/Steam/steamapps/workshop/content/$APP_ID"

if [ -d "$STEAMCMD_CONTENT" ]; then
    echo ""
    echo "Copying downloaded mods to $OUTPUT_DIR..."
    for MOD_ID in "${MODS[@]}"; do
        if [ -d "$STEAMCMD_CONTENT/$MOD_ID" ]; then
            cp -r "$STEAMCMD_CONTENT/$MOD_ID" "$OUTPUT_DIR/"
            echo "  ✓ Mod $MOD_ID copied"
        else
            echo "  ✗ Mod $MOD_ID not found"
        fi
    done
fi

echo ""
echo "==========================================="
echo "Download complete!"
echo "Mods saved to: $OUTPUT_DIR"
echo "==========================================="

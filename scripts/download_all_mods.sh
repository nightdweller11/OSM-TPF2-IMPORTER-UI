#!/bin/bash
# Download all required mods for OSM Importer
# This script handles GitHub mods automatically and opens browser for manual downloads

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUNDLED_DIR="$PROJECT_DIR/bundled_mods"
DOWNLOAD_DIR="$BUNDLED_DIR/downloads"

mkdir -p "$DOWNLOAD_DIR"

echo "==========================================="
echo "TPF2 Mod Downloader for OSM Importer"
echo "==========================================="
echo ""

# Function to clone from GitHub
download_github() {
    local name="$1"
    local repo="$2"
    local target="$DOWNLOAD_DIR/$name"
    
    if [ -d "$target" ]; then
        echo "  ✓ $name (already exists)"
        return 0
    fi
    
    echo "  Downloading $name from GitHub..."
    if git clone --depth 1 "https://github.com/$repo.git" "$target" 2>/dev/null; then
        rm -rf "$target/.git"
        echo "  ✓ $name downloaded"
        return 0
    else
        echo "  ✗ Failed to clone $name"
        return 1
    fi
}

echo "=== STEP 1: GitHub Mods (automatic) ==="
download_github "NEP-Addon" "Vacuum-Tube/NEP-Addon"
echo ""

echo "=== STEP 2: transportfever.net Mods ==="
echo ""
echo "These mods will be opened in your browser."
echo "Download each one and extract to: $DOWNLOAD_DIR"
echo ""
read -p "Press Enter to open transportfever.net mod pages in browser..."

# transportfever.net mods - open in browser
TFNET_MODS=(
    "5942|Natural Environment Professional 2"
    "4808|Gleispaket mit 750mm 1000mm"
    "6512|Feldbahn Infrastruktur"
    "5675|Roads'n Trams Projekt (RTP)"
    "5264|Joe Fried Straßenpaket"
    "5157|Autobahnkreuz TpF2"
    "5425|Gitterträger-Fachwerkbrücke"
    "5209|H/V-Signale Einheitsbauform²"
    "6218|Litfaßsäulen"
    "7677|Hide Street Trees"
    "4856|Forester v1.4 Interface"
    "7713|Paver"
    "5852|Bodentexturen 1.0"
    "6250|Bodentexturen 4.0"
    "7446|Sidewalk Lowerer"
)

echo ""
echo "Opening transportfever.net mod pages..."
for mod in "${TFNET_MODS[@]}"; do
    IFS='|' read -r entry_id name <<< "$mod"
    echo "  Opening: $name"
    open "https://www.transportfever.net/filebase/entry/${entry_id}/" 2>/dev/null || \
    xdg-open "https://www.transportfever.net/filebase/entry/${entry_id}/" 2>/dev/null || \
    echo "    URL: https://www.transportfever.net/filebase/entry/${entry_id}/"
    sleep 0.5
done

echo ""
echo "=== STEP 3: Steam Workshop Mods ==="
echo ""
echo "Choose an option:"
echo "  A) Subscribe in Steam (recommended) - then run copy_local_mods.sh"
echo "  B) Open mod pages in browser to subscribe"
echo "  C) Skip Steam mods for now"
echo ""
read -p "Enter choice (A/B/C): " STEAM_CHOICE

STEAM_MODS=(
    "2060012969|Vienna Fever: Infrastructure"
    "2258619623|Berlin Stadtbahn Viaduct Construction"
    "1983390040|Old Track"
    "2072274420|Ballast"
    "1968514713|ext.roads footpaths standalone"
    "2021038808|Street fine tuning"
    "2363493916|Freestyle train station"
    "1933747406|Marc's Street and Trampack"
    "2232249704|Airport Roads"
    "1943578742|SMP 2.0"
    "2014569888|Water Textures"
    "2187434173|TFMR2.0 Bridge"
    "1939805466|Bridge Type-1"
    "2060132685|Vienna Fever: Bridge and Retaining Wall"
    "2770909719|Signalkomponenten"
    "2920749928|Ks-Signalsystem"
    "2770910636|Level crossing signals"
    "2294246900|Signal Distance"
    "1963592311|Connum's German Traffic Assets"
    "2247194383|Spacky_Trees conifers"
    "2763516913|Ingo's textures - pavement"
    "3432184100|Ingo's Vegetation Extended"
    "2161175689|Realistic Railway Slopes"
    "2206802861|Maximum Street Slopes"
    "2558586098|Realistic Track Curve Speeds"
)

case "$STEAM_CHOICE" in
    [Bb])
        echo ""
        echo "Opening Steam Workshop mod pages..."
        for mod in "${STEAM_MODS[@]}"; do
            IFS='|' read -r mod_id name <<< "$mod"
            echo "  Opening: $name"
            open "steam://url/CommunityFilePage/$mod_id" 2>/dev/null || \
            open "https://steamcommunity.com/sharedfiles/filedetails/?id=$mod_id" 2>/dev/null || \
            echo "    URL: https://steamcommunity.com/sharedfiles/filedetails/?id=$mod_id"
            sleep 0.5
        done
        echo ""
        echo "After subscribing, run: ./scripts/copy_local_mods.sh"
        ;;
    [Aa])
        echo ""
        echo "Opening Steam Workshop collection page..."
        echo "Subscribe to all mods, then run: ./scripts/copy_local_mods.sh"
        echo ""
        # Create a list of mod IDs
        MOD_IDS=""
        for mod in "${STEAM_MODS[@]}"; do
            IFS='|' read -r mod_id name <<< "$mod"
            MOD_IDS="$MOD_IDS $mod_id"
        done
        echo "Steam mod IDs to subscribe:"
        echo "$MOD_IDS"
        echo ""
        echo "You can create a Steam Collection with these mods for easy sharing."
        ;;
    *)
        echo "Skipping Steam mods."
        ;;
esac

echo ""
echo "==========================================="
echo "SUMMARY"
echo "==========================================="
echo ""
echo "1. GitHub mods: Downloaded to $DOWNLOAD_DIR"
echo ""
echo "2. transportfever.net mods: Download from browser, extract to $DOWNLOAD_DIR"
echo ""
echo "3. Steam mods: Subscribe in Steam, then run ./scripts/copy_local_mods.sh"
echo ""
echo "After downloading all mods, run:"
echo "  ./scripts/install_bundled_mods.sh"
echo "to install them into TPF2"
echo ""
echo "==========================================="

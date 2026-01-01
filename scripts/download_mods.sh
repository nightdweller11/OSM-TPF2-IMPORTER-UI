#!/bin/bash
# Download mods from transportfever.net and prepare Steam downloads
# Run this script from the project root

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUNDLED_DIR="$PROJECT_DIR/bundled_mods"
TFNET_DIR="$BUNDLED_DIR/transportfever_net"
GITHUB_DIR="$BUNDLED_DIR/github"

mkdir -p "$TFNET_DIR"
mkdir -p "$GITHUB_DIR"

echo "==========================================="
echo "TPF2 Mod Downloader for OSM Importer"
echo "==========================================="
echo ""

# Function to download from transportfever.net
# Note: transportfever.net requires login for downloads, so we'll just list the URLs
download_tfnet() {
    local name="$1"
    local entry_id="$2"
    local url="https://www.transportfever.net/filebase/entry/${entry_id}/"
    
    echo "  - $name"
    echo "    URL: $url"
    echo "$name|$url" >> "$TFNET_DIR/download_list.txt"
}

# Function to clone from GitHub
download_github() {
    local name="$1"
    local repo="$2"
    local target="$GITHUB_DIR/$name"
    
    if [ -d "$target" ]; then
        echo "  ✓ $name (already exists)"
    else
        echo "  Cloning $name from GitHub..."
        git clone --depth 1 "https://github.com/$repo.git" "$target" 2>/dev/null || {
            echo "  ✗ Failed to clone $name"
            return 1
        }
        echo "  ✓ $name downloaded"
    fi
}

echo "=== GitHub Mods ==="
download_github "NEP-Addon" "Vacuum-Tube/NEP-Addon"
echo ""

echo "=== transportfever.net Mods ==="
echo "These mods require manual download (login required):"
echo ""
rm -f "$TFNET_DIR/download_list.txt"

# Track types
download_tfnet "Natural Environment Professional 2" "5942-natural-environment-professional-2"
download_tfnet "Gleispaket mit 750mm 1000mm" "4808-gleispaket-mit-750mm-1000mm-für-tpf2"
download_tfnet "Feldbahn Infrastruktur" "6512-feldbahn-infrastruktur"

# Street types
download_tfnet "Roads'n Trams Projekt (RTP)" "5675-roads-n-trams-projekt-rtp"
download_tfnet "Joe Fried Straßenpaket" "5264-joe-fried-straßenpaket-straßengeschichte"
download_tfnet "Autobahnkreuz TpF2" "5157-autobahnkreuz-tpf2"

# Bridge types
download_tfnet "Gitterträger-Fachwerkbrücke" "5425-gitterträger-fachwerkbrücke"

# Signals
download_tfnet "H/V-Signale Einheitsbauform²" "5209-h-v-signale-einheitsbauform²"

# Objects
download_tfnet "Litfaßsäulen" "6218-litfaßsäulen-für-ära-b-und-c"
download_tfnet "Hide Street Trees" "7677-hide-street-trees"

# Forester
download_tfnet "Forester (v1.4 Interface)" "4856-förster"

# Paver
download_tfnet "Paver" "7713-paver-pflasterer"
download_tfnet "Bodentexturen 1.0" "5852-bodentexturen-1-0-schönbau-pinseltool"
download_tfnet "Bodentexturen 4.0" "6250-bodentexturen-4-0-schönbau-pinseltool"

# Additional
download_tfnet "Sidewalk Lowerer" "7446-gehweg-absenker"

echo ""
echo "Download list saved to: $TFNET_DIR/download_list.txt"
echo ""

echo "=== Steam Workshop Mods ==="
echo "These mods are Steam-only. Creating SteamCMD script..."

# Create SteamCMD download script
cat > "$BUNDLED_DIR/steamcmd_download.txt" << 'EOF'
// SteamCMD script to download TPF2 mods
// Run with: steamcmd +login YOUR_USERNAME +runscript steamcmd_download.txt
// Or: steamcmd +login YOUR_USERNAME YOUR_PASSWORD +runscript steamcmd_download.txt

// Track types
workshop_download_item 1066780 2060012969
workshop_download_item 1066780 2258619623
workshop_download_item 1066780 1983390040
workshop_download_item 1066780 2072274420

// Street types  
workshop_download_item 1066780 1968514713
workshop_download_item 1066780 2021038808
workshop_download_item 1066780 2363493916
workshop_download_item 1066780 1933747406
workshop_download_item 1066780 2232249704
workshop_download_item 1066780 1943578742
workshop_download_item 1066780 2014569888

// Bridge types
workshop_download_item 1066780 2187434173
workshop_download_item 1066780 1939805466
workshop_download_item 1066780 2060132685

// Signals
workshop_download_item 1066780 2770909719
workshop_download_item 1066780 2920749928
workshop_download_item 1066780 2770910636
workshop_download_item 1066780 2294246900

// Objects
workshop_download_item 1066780 1963592311

// Forester / Trees
workshop_download_item 1066780 2247194383

// Paver / Ground
workshop_download_item 1066780 2763516913
workshop_download_item 1066780 3432184100

// Additional useful mods
workshop_download_item 1066780 2161175689
workshop_download_item 1066780 2206802861
workshop_download_item 1066780 2558586098

quit
EOF

echo "SteamCMD script created: $BUNDLED_DIR/steamcmd_download.txt"
echo ""

# Create a list of Steam mod URLs for easy subscription
cat > "$BUNDLED_DIR/steam_workshop_urls.txt" << 'EOF'
Steam Workshop Mods for OSM Importer
====================================

TRACK TYPES:
Vienna Fever: Infrastructure - https://steamcommunity.com/sharedfiles/filedetails/?id=2060012969
Berlin Stadtbahn Viaduct Construction - https://steamcommunity.com/sharedfiles/filedetails/?id=2258619623
Old Track - https://steamcommunity.com/sharedfiles/filedetails/?id=1983390040
Ballast - https://steamcommunity.com/sharedfiles/filedetails/?id=2072274420

STREET TYPES:
ext.roads footpaths standalone - https://steamcommunity.com/sharedfiles/filedetails/?id=1968514713
Street fine tuning - https://steamcommunity.com/sharedfiles/filedetails/?id=2021038808
Freestyle train station - https://steamcommunity.com/sharedfiles/filedetails/?id=2363493916
Marc's Street and Trampack - https://steamcommunity.com/sharedfiles/filedetails/?id=1933747406
Airport Roads (EXPERIMENTAL) - https://steamcommunity.com/sharedfiles/filedetails/?id=2232249704
SMP 2.0 - https://steamcommunity.com/sharedfiles/filedetails/?id=1943578742
Water Textures - https://steamcommunity.com/sharedfiles/filedetails/?id=2014569888

BRIDGE TYPES:
TFMR2.0 Bridge - https://steamcommunity.com/sharedfiles/filedetails/?id=2187434173
Bridge Type-1 - https://steamcommunity.com/sharedfiles/filedetails/?id=1939805466
Vienna Fever: Bridge and Retaining Wall - https://steamcommunity.com/sharedfiles/filedetails/?id=2060132685

SIGNALS:
Signalkomponenten - https://steamcommunity.com/sharedfiles/filedetails/?id=2770909719
Ks-Signalsystem - https://steamcommunity.com/sharedfiles/filedetails/?id=2920749928
Level crossing signals - https://steamcommunity.com/sharedfiles/filedetails/?id=2770910636
Signal Distance - https://steamcommunity.com/sharedfiles/filedetails/?id=2294246900

OBJECTS:
Connum's German Traffic Assets - https://steamcommunity.com/sharedfiles/filedetails/?id=1963592311

FORESTER / TREES:
Spacky_Trees conifers - https://steamcommunity.com/sharedfiles/filedetails/?id=2247194383

PAVER / GROUND:
Ingo's textures - pavement - https://steamcommunity.com/sharedfiles/filedetails/?id=2763516913
Ingo's Vegetation Extended - https://steamcommunity.com/sharedfiles/filedetails/?id=3432184100

ADDITIONAL:
Realistic Railway Slopes - https://steamcommunity.com/sharedfiles/filedetails/?id=2161175689
Maximum Street Slopes - https://steamcommunity.com/sharedfiles/filedetails/?id=2206802861
Realistic Track Curve Speeds - https://steamcommunity.com/sharedfiles/filedetails/?id=2558586098
EOF

echo "Steam URLs list created: $BUNDLED_DIR/steam_workshop_urls.txt"
echo ""

echo "==========================================="
echo "SUMMARY"
echo "==========================================="
echo ""
echo "1. GitHub mods: Downloaded to $GITHUB_DIR"
echo ""
echo "2. transportfever.net mods: Manual download required"
echo "   - Visit each URL in $TFNET_DIR/download_list.txt"
echo "   - Login to transportfever.net"
echo "   - Download and extract to $TFNET_DIR"
echo ""
echo "3. Steam Workshop mods: Two options:"
echo ""
echo "   OPTION A - Subscribe in Steam (recommended):"
echo "   Subscribe to all mods, then run:"
echo "   ./scripts/copy_local_mods.sh"
echo ""
echo "   OPTION B - Use SteamCMD:"
echo "   steamcmd +login YOUR_USERNAME +runscript $BUNDLED_DIR/steamcmd_download.txt"
echo ""
echo "==========================================="


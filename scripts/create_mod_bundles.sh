#!/bin/bash
# Create mod bundles for distribution
# Creates: required, recommended, all bundles

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUNDLED_DIR="$PROJECT_DIR/bundled_mods"
BUNDLES_DIR="$PROJECT_DIR/public/downloads/mod-bundles"
STEAM_DIR="$BUNDLED_DIR/steam"
TFNET_DIR="$BUNDLED_DIR/downloads"

mkdir -p "$BUNDLES_DIR"

echo "==========================================="
echo "Creating Mod Bundles"
echo "==========================================="

# Define bundles based on Mods.md categories
# Format: mod_path|bundle_tier (1=required, 2=recommended, 3=all-only)
# Tier 3 = large mods (>100MB) that go only in "all" bundle

# Steam mods with sizes and tiers
# Required core mods (needed for basic import)
STEAM_REQUIRED="
2060012969|1|Vienna Fever Infrastructure
1983390040|1|Old Track
2072274420|1|Ballast
1968514713|1|ext.roads footpaths
2187434173|1|TFMR Bridge
1939805466|1|Bridge Type-1
2060132685|1|Vienna Fever Bridge
2294246900|1|Signal Distance
2161175689|1|Realistic Railway Slopes
2206802861|1|Maximum Street Slopes
2558586098|1|Realistic Track Curve Speeds
"

# Recommended mods (<100MB, enhance the experience)
STEAM_RECOMMENDED="
1933747406|2|Marc Street Trampack (32MB)
2232249704|2|Airport Roads (6MB)
1943578742|2|SMP 2.0 (64MB)
2770910636|2|Level Crossing Signals (17MB)
1963592311|2|Connum Traffic Assets (55MB)
"

# Large mods (>100MB, only in "all" bundle)
STEAM_LARGE="
2258619623|3|Berlin Stadtbahn Viaduct (119MB)
2021038808|3|Street Fine Tuning (77MB)
2363493916|3|Freestyle Station (452MB)
2014569888|3|Water Textures (139MB)
2770909719|3|Signalkomponenten (167MB)
2920749928|3|Ks-Signalsystem (480MB)
2247194383|3|Spacky Trees Conifers (317MB)
2763516913|3|Ingo Textures Pavement (215MB)
3432184100|3|Ingo Vegetation Extended (128MB)
"

# TransportFever.net mods - all go into required/recommended (they're smaller)
TFNET_REQUIRED="
unixroot_natural_environment_pro_tpf2_2|1|Natural Environment Professional 2
eis_os_trackpackage_1|1|Gleispaket 750mm 1000mm
yoshi_feldbahn_infra_1|1|Feldbahn Infrastruktur
RTP-Roads_V2_1|1|RTP Roads
joefried_roadstrassen_em_2|1|Joe Fried Strassenpaket
Autobahn_Kreuz_1|1|Autobahnkreuz
ritknat_gitterbruecke_1|1|Gittertraeger Fachwerkbruecke
sebbe_hv69signale_basis_1|1|HV Signale Basis
sebbe_hv69signale_erw1_1|1|HV Signale Erw1
sebbe_hv69signale_erw2_1|1|HV Signale Erw2
sebbe_hv69signale_erw3_1|1|HV Signale Erw3
sabon_litfass_era_c_1|1|Litfasssaeulen Era C
snowball_forester_1|1|Forester
Paver_1|1|Paver
mt_bodentexturenpaket1_1|1|Bodentexturen 1.0
mt_bodentexturenpaket4_1|1|Bodentexturen 4.0
NEP-Addon|1|NEP Addon
"

TFNET_RECOMMENDED="
Hide_Street_Trees_1|2|Hide Street Trees
wk_sidewalk_lowerer_1|2|Sidewalk Lowerer
RTP-Trams_V3.1_1|2|RTP Trams
sabon_litfass_era_b_1|2|Litfasssaeulen Era B
"

# Create install script that will be included in each bundle
create_install_script() {
    local bundle_name="$1"
    local output_file="$2"
    
    cat > "$output_file" << 'INSTALL_SCRIPT'
#!/bin/bash
# Install OSM Importer Mod Bundle
# This script copies the mod files to your TPF2 mods folder

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==========================================="
echo "OSM Importer Mod Bundle Installer"
echo "==========================================="

# Detect OS and find TPF2 mods folder
detect_tpf2_mods() {
    case "$(uname -s)" in
        Darwin)
            # macOS - check Steam first
            STEAM_MODS="$HOME/Library/Application Support/Steam/steamapps/common/Transport Fever 2/mods"
            if [ -d "$STEAM_MODS" ]; then
                echo "$STEAM_MODS"
                return 0
            fi
            # Check standalone
            STANDALONE="$HOME/Library/Application Support/Transport Fever 2/mods"
            if [ -d "$STANDALONE" ]; then
                echo "$STANDALONE"
                return 0
            fi
            ;;
        Linux)
            STEAM_MODS="$HOME/.steam/steam/steamapps/common/Transport Fever 2/mods"
            if [ -d "$STEAM_MODS" ]; then
                echo "$STEAM_MODS"
                return 0
            fi
            STEAM_MODS="$HOME/.local/share/Steam/steamapps/common/Transport Fever 2/mods"
            if [ -d "$STEAM_MODS" ]; then
                echo "$STEAM_MODS"
                return 0
            fi
            ;;
        MINGW*|MSYS*|CYGWIN*)
            # Windows paths
            for drive in "C" "D" "E"; do
                STEAM_MODS="/$drive/Program Files (x86)/Steam/steamapps/common/Transport Fever 2/mods"
                if [ -d "$STEAM_MODS" ]; then
                    echo "$STEAM_MODS"
                    return 0
                fi
            done
            ;;
    esac
    return 1
}

TPF2_MODS=$(detect_tpf2_mods)

if [ -z "$TPF2_MODS" ]; then
    echo "ERROR: Could not find TPF2 mods folder automatically."
    echo ""
    echo "Please enter the path to your TPF2 mods folder:"
    read -p "> " TPF2_MODS
    
    if [ ! -d "$TPF2_MODS" ]; then
        echo "ERROR: Directory does not exist: $TPF2_MODS"
        exit 1
    fi
fi

echo ""
echo "TPF2 mods folder: $TPF2_MODS"
echo ""

# Copy mods
copied=0
skipped=0

for mod_dir in "$SCRIPT_DIR"/mods/*/; do
    [ ! -d "$mod_dir" ] && continue
    
    mod_name=$(basename "$mod_dir")
    target="$TPF2_MODS/$mod_name"
    
    if [ -d "$target" ]; then
        echo "[SKIP] $mod_name (already installed)"
        ((skipped++))
    else
        echo "[INSTALL] $mod_name"
        cp -r "$mod_dir" "$target"
        ((copied++))
    fi
done

echo ""
echo "==========================================="
echo "Installation Complete!"
echo "  Installed: $copied mods"
echo "  Skipped:   $skipped mods (already present)"
echo ""
echo "Start TPF2 and enable the mods in the mod menu."
echo "==========================================="
INSTALL_SCRIPT
    
    chmod +x "$output_file"
}

# Create Windows batch installer
create_windows_installer() {
    local output_file="$1"
    
    cat > "$output_file" << 'BATCH_SCRIPT'
@echo off
setlocal EnableDelayedExpansion

echo ===========================================
echo OSM Importer Mod Bundle Installer
echo ===========================================
echo.

set "TPF2_MODS="

REM Check common Steam paths
for %%D in (C D E) do (
    if exist "%%D:\Program Files (x86)\Steam\steamapps\common\Transport Fever 2\mods" (
        set "TPF2_MODS=%%D:\Program Files (x86)\Steam\steamapps\common\Transport Fever 2\mods"
        goto :found
    )
    if exist "%%D:\Program Files\Steam\steamapps\common\Transport Fever 2\mods" (
        set "TPF2_MODS=%%D:\Program Files\Steam\steamapps\common\Transport Fever 2\mods"
        goto :found
    )
    if exist "%%D:\SteamLibrary\steamapps\common\Transport Fever 2\mods" (
        set "TPF2_MODS=%%D:\SteamLibrary\steamapps\common\Transport Fever 2\mods"
        goto :found
    )
)

echo ERROR: Could not find TPF2 mods folder.
echo Please enter the path manually:
set /p TPF2_MODS="> "

if not exist "%TPF2_MODS%" (
    echo ERROR: Directory does not exist.
    pause
    exit /b 1
)

:found
echo TPF2 mods folder: %TPF2_MODS%
echo.

set copied=0
set skipped=0

for /d %%M in ("%~dp0mods\*") do (
    set "mod_name=%%~nxM"
    if exist "%TPF2_MODS%\!mod_name!" (
        echo [SKIP] !mod_name! - already installed
        set /a skipped+=1
    ) else (
        echo [INSTALL] !mod_name!
        xcopy /E /I /Q "%%M" "%TPF2_MODS%\!mod_name!" >nul
        set /a copied+=1
    )
)

echo.
echo ===========================================
echo Installation Complete!
echo   Installed: %copied% mods
echo   Skipped:   %skipped% mods
echo.
echo Start TPF2 and enable the mods.
echo ===========================================
pause
BATCH_SCRIPT
}

# Function to create a bundle
create_bundle() {
    local bundle_name="$1"
    local max_tier="$2"
    local bundle_dir="$BUNDLES_DIR/$bundle_name"
    local mods_dir="$bundle_dir/mods"
    
    echo ""
    echo "Creating $bundle_name bundle (tier <= $max_tier)..."
    
    rm -rf "$bundle_dir"
    mkdir -p "$mods_dir"
    
    # Copy Steam mods based on tier
    for mods_list in "$STEAM_REQUIRED" "$STEAM_RECOMMENDED" "$STEAM_LARGE"; do
        echo "$mods_list" | while IFS='|' read -r mod_id tier name; do
            [ -z "$mod_id" ] && continue
            if [ "$tier" -le "$max_tier" ] && [ -d "$STEAM_DIR/$mod_id" ]; then
                echo "  + $name"
                cp -r "$STEAM_DIR/$mod_id" "$mods_dir/"
            fi
        done
    done
    
    # Copy TransportFever.net mods based on tier
    for mods_list in "$TFNET_REQUIRED" "$TFNET_RECOMMENDED"; do
        echo "$mods_list" | while IFS='|' read -r mod_name tier display_name; do
            [ -z "$mod_name" ] && continue
            if [ "$tier" -le "$max_tier" ] && [ -d "$TFNET_DIR/$mod_name" ]; then
                echo "  + $display_name"
                cp -r "$TFNET_DIR/$mod_name" "$mods_dir/"
            fi
        done
    done
    
    # Create install scripts
    create_install_script "$bundle_name" "$bundle_dir/install.sh"
    create_windows_installer "$bundle_dir/install.bat"
    
    # Create README
    cat > "$bundle_dir/README.txt" << EOF
OSM Importer Mod Bundle: $bundle_name
======================================

This bundle contains mods required for the OSM-TPF2 Importer.

INSTALLATION:
  macOS/Linux: Run ./install.sh
  Windows:     Double-click install.bat

The installer will:
1. Find your TPF2 mods folder
2. Copy mods that aren't already installed
3. Skip mods you already have

After installation, start TPF2 and enable the mods in Settings > Mods.

For more information, visit:
https://github.com/Vacuum-Tube/OSM-TPF2-Importer
EOF
    
    # Create zip
    echo "  Creating ZIP..."
    cd "$BUNDLES_DIR"
    zip -rq "${bundle_name}.zip" "$bundle_name"
    
    local size=$(du -sh "$bundle_dir" | cut -f1)
    local zip_size=$(du -sh "${bundle_name}.zip" | cut -f1)
    echo "  Bundle size: $size (ZIP: $zip_size)"
}

# Create the three bundles
create_bundle "osm-mods-required" 1
create_bundle "osm-mods-recommended" 2
create_bundle "osm-mods-all" 3

echo ""
echo "==========================================="
echo "Bundles created in: $BUNDLES_DIR"
echo ""
ls -lh "$BUNDLES_DIR"/*.zip
echo "==========================================="


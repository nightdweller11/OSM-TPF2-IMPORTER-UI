#!/bin/bash
# Copy subscribed Steam Workshop mods to bundled_mods folder

WORKSHOP_DIR="$HOME/Library/Application Support/Steam/steamapps/workshop/content/1066780"
BUNDLED_DIR="$(dirname "$0")/../bundled_mods/steam"

mkdir -p "$BUNDLED_DIR"

echo "========================================"
echo "Copy Steam Workshop Mods to Bundle"
echo "========================================"
echo "Source: $WORKSHOP_DIR"
echo "Target: $BUNDLED_DIR"
echo ""

# Required Steam mod IDs from Mods.md
MODS="
2060012969|vienna_fever_infrastruktur
2258619623|berlin_stadtbahn_viaduct
1983390040|old_track
2072274420|ballast
1968514713|ext_roads_footpaths
2021038808|lollo_street_fine_tuning
2363493916|lollo_freestyle_station
1933747406|marc_street_trampack
2232249704|mkh_airport_roads
1943578742|smp_2
2014569888|relozu_water_textures
2187434173|tfmr_bridge
1939805466|angier_bridge
2060132685|vienna_fever_bridge
2770909719|signalkomponenten
2920749928|ks_signalsystem
2770910636|level_crossing_signals
2294246900|signal_distance
1963592311|connum_traffic_assets
2247194383|spacky_trees_conifers
2763516913|ingo_textures_pavement
3432184100|ingo_vegetation_extended
2161175689|realistic_railway_slopes
2206802861|maximum_street_slopes
2558586098|realistic_track_curve_speeds
"

copied=0
missing=0
already=0

echo "$MODS" | while IFS='|' read -r id name; do
    # Skip empty lines
    [ -z "$id" ] && continue
    
    src="$WORKSHOP_DIR/$id"
    dst="$BUNDLED_DIR/$id"
    
    if [ -d "$dst" ] && [ "$(ls -A "$dst" 2>/dev/null)" ]; then
        echo "[SKIP] $name ($id) - already exists"
    elif [ -d "$src" ]; then
        echo "[COPY] $name ($id)"
        cp -r "$src" "$dst"
    else
        echo "[MISS] $name ($id) - not subscribed"
    fi
done

echo ""
echo "========================================"
echo "Done! Check $BUNDLED_DIR for copied mods."
echo "========================================"

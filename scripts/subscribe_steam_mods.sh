#!/bin/bash
# Subscribe to missing Steam Workshop mods one by one
# Press Enter after subscribing to each mod to open the next one

echo "==========================================="
echo "Steam Workshop Mod Subscription Helper"
echo "==========================================="
echo ""
echo "This will open each missing mod page one at a time."
echo "After subscribing, press Enter to open the next mod."
echo ""
read -p "Press Enter to start..."

MODS=(
    "2258619623|Berlin Stadtbahn Viaduct Construction"
    "1983390040|Old Track"
    "2072274420|Ballast"
    "1968514713|ext.roads footpaths standalone"
    "2021038808|Street fine tuning"
    "1933747406|Marc's Street and Trampack"
    "2232249704|Airport Roads"
    "1943578742|SMP 2.0"
    "2014569888|Water Textures"
    "1939805466|Bridge Type-1"
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

TOTAL=${#MODS[@]}
COUNT=1

for mod in "${MODS[@]}"; do
    IFS='|' read -r mod_id name <<< "$mod"
    
    echo ""
    echo "[$COUNT/$TOTAL] $name"
    echo "Opening Steam page..."
    
    open "steam://url/CommunityFilePage/$mod_id"
    
    read -p "Press Enter after subscribing to continue..."
    
    COUNT=$((COUNT + 1))
done

echo ""
echo "==========================================="
echo "All done! You've subscribed to $TOTAL mods."
echo ""
echo "Now run this to copy them to the project:"
echo "  ./scripts/copy_local_mods.sh"
echo "==========================================="


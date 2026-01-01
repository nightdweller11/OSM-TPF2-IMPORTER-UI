#!/usr/bin/env python3
"""
Download all required mods for OSM-TPF2-Importer
Downloads from Steam Workshop and transportfever.net
"""

import os
import sys
import requests
import zipfile
import io
import re
import json
from pathlib import Path
from urllib.parse import urlparse, unquote

# Output directory
MODS_DIR = Path(__file__).parent.parent / "bundled_mods"
MODS_DIR.mkdir(exist_ok=True)

# Steam Workshop mods (ID -> folder name)
STEAM_MODS = {
    # Track types
    "2060012969": "vienna_fever_infrastruktur",
    "2258619623": "berlin_stadtbahn_viaduct",
    "1983390040": "old_track",
    "2072274420": "ballast",
    
    # Street types
    "1968514713": "ext_roads_footpaths",
    "2021038808": "lollo_street_fine_tuning",
    "2363493916": "lollo_freestyle_station",
    "1933747406": "marc_street_trampack",
    "2232249704": "mkh_airport_roads",
    "1943578742": "smp_2",
    "2014569888": "relozu_water_textures",
    
    # Bridge types
    "2187434173": "tfmr_bridge",
    "1939805466": "angier_bridge",
    "2060132685": "vienna_fever_bridge",
    
    # Signals
    "2770909719": "signalkomponenten",
    "2920749928": "ks_signalsystem",
    "2770910636": "level_crossing_signals",
    "2294246900": "signal_distance",
    
    # Objects
    "1963592311": "connum_traffic_assets",
    
    # Trees
    "2247194383": "spacky_trees_conifers",
    
    # Paver textures
    "2763516913": "ingo_textures_pavement",
    "3432184100": "ingo_vegetation_extended",
    
    # Additional useful
    "2161175689": "realistic_railway_slopes",
    "2206802861": "maximum_street_slopes",
    "2558586098": "realistic_track_curve_speeds",
}

# TransportFever.net mods (need manual download info)
TFNET_MODS = {
    "forester": {
        "name": "Forester v1.4",
        "url": "https://www.transportfever.net/filebase/entry/4856-förster/",
        "filebase_id": 4856,
    },
    "paver": {
        "name": "Paver",
        "url": "https://www.transportfever.net/filebase/entry/7713-paver-pflasterer/",
        "filebase_id": 7713,
    },
    "rtp_roads": {
        "name": "Roads'n Trams Projekt (RTP)",
        "url": "https://www.transportfever.net/filebase/entry/5675-roads-n-trams-projekt-rtp/",
        "filebase_id": 5675,
    },
    "natural_environment_pro": {
        "name": "Natural Environment Professional 2",
        "url": "https://www.transportfever.net/filebase/entry/5942-natural-environment-professional-2/",
        "filebase_id": 5942,
    },
    "gleispaket_750_1000": {
        "name": "Gleispaket 750mm/1000mm",
        "url": "https://www.transportfever.net/filebase/entry/4808-gleispaket-mit-750mm-1000mm-für-tpf2/",
        "filebase_id": 4808,
    },
    "feldbahn": {
        "name": "Feldbahn Infrastruktur",
        "url": "https://www.transportfever.net/filebase/entry/6512-feldbahn-infrastruktur/",
        "filebase_id": 6512,
    },
    "joefried_roads": {
        "name": "Joe Fried Straßenpaket",
        "url": "https://www.transportfever.net/filebase/entry/5264-joe-fried-straßenpaket-straßengeschichte/",
        "filebase_id": 5264,
    },
    "autobahnkreuz": {
        "name": "Autobahnkreuz TpF2",
        "url": "https://www.transportfever.net/filebase/entry/5157-autobahnkreuz-tpf2/",
        "filebase_id": 5157,
    },
    "gitterbruecke": {
        "name": "Gitterträger-Fachwerkbrücke",
        "url": "https://www.transportfever.net/filebase/entry/5425-gitterträger-fachwerkbrücke/",
        "filebase_id": 5425,
    },
    "hv_signale": {
        "name": "H/V-Signale Einheitsbauform",
        "url": "https://www.transportfever.net/filebase/entry/5209-h-v-signale-einheitsbauform²/",
        "filebase_id": 5209,
    },
    "litfass": {
        "name": "Litfaßsäulen",
        "url": "https://www.transportfever.net/filebase/entry/6218-litfaßsäulen-für-ära-b-und-c/",
        "filebase_id": 6218,
    },
    "hide_street_trees": {
        "name": "Hide Street Trees",
        "url": "https://www.transportfever.net/filebase/entry/7677-hide-street-trees/",
        "filebase_id": 7677,
    },
    "bodentexturen_1": {
        "name": "Bodentexturen 1.0",
        "url": "https://www.transportfever.net/filebase/entry/5852-bodentexturen-1-0-schönbau-pinseltool/",
        "filebase_id": 5852,
    },
    "bodentexturen_4": {
        "name": "Bodentexturen 4.0",
        "url": "https://www.transportfever.net/filebase/entry/6250-bodentexturen-4-0-schönbau-pinseltool/",
        "filebase_id": 6250,
    },
    "gehweg_absenker": {
        "name": "Gehweg Absenker",
        "url": "https://www.transportfever.net/filebase/entry/7446-gehweg-absenker/",
        "filebase_id": 7446,
    },
}

def download_steam_mod(workshop_id: str, folder_name: str) -> bool:
    """
    Download a Steam Workshop mod
    Uses ggntw.com API (alternative to the defunct steamworkshopdownloader)
    """
    mod_dir = MODS_DIR / folder_name
    
    if mod_dir.exists() and any(mod_dir.iterdir()):
        print(f"  [SKIP] {folder_name} already exists")
        return True
    
    mod_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        print(f"  [DOWN] {folder_name} ({workshop_id})...")
        
        # Try steam-dl.com API
        api_url = "https://steam-dl.com/api/download"
        
        response = requests.post(api_url, data={
            "link": f"https://steamcommunity.com/sharedfiles/filedetails/?id={workshop_id}"
        }, timeout=60, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })
        
        if response.status_code == 200:
            # Try to get download link from response
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            
            if 'download_url' in data:
                # Download the file
                file_resp = requests.get(data['download_url'], stream=True, timeout=120)
                if file_resp.status_code == 200:
                    zip_path = mod_dir / "mod.zip"
                    with open(zip_path, 'wb') as f:
                        for chunk in file_resp.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    # Extract
                    with zipfile.ZipFile(zip_path, 'r') as z:
                        z.extractall(mod_dir)
                    zip_path.unlink()
                    print(f"  [OK] {folder_name}")
                    return True
        
        # Fallback: Create placeholder with download link
        readme = mod_dir / "README.txt"
        with open(readme, 'w') as f:
            f.write(f"# {folder_name}\n\n")
            f.write(f"Steam Workshop ID: {workshop_id}\n")
            f.write(f"Download manually from:\n")
            f.write(f"https://steamcommunity.com/sharedfiles/filedetails/?id={workshop_id}\n\n")
            f.write("After downloading, extract contents here.\n")
        
        print(f"  [MANUAL] {folder_name} - created placeholder")
        return False
        
    except Exception as e:
        print(f"  [ERR] {folder_name}: {e}")
        
        # Create placeholder anyway
        readme = mod_dir / "README.txt"
        with open(readme, 'w') as f:
            f.write(f"# {folder_name}\n\n")
            f.write(f"Download from: https://steamcommunity.com/sharedfiles/filedetails/?id={workshop_id}\n")
        
        return False


def create_download_links_file():
    """Create a file with all download links for manual download"""
    links_file = MODS_DIR / "DOWNLOAD_LINKS.md"
    
    content = """# Mod Download Links

## Steam Workshop Mods
Click each link and subscribe to download.

"""
    for steam_id, folder in STEAM_MODS.items():
        content += f"- [{folder}](https://steamcommunity.com/sharedfiles/filedetails/?id={steam_id})\n"
    
    content += """
## TransportFever.net Mods
These require manual download from the website.

"""
    for key, info in TFNET_MODS.items():
        content += f"- [{info['name']}]({info['url']})\n"
    
    content += """
## Installation
1. Download each mod
2. Extract to the bundled_mods/ folder
3. The install script will copy them to your game
"""
    
    with open(links_file, 'w') as f:
        f.write(content)
    
    print(f"Created: {links_file}")


def main():
    print("=" * 60)
    print("OSM-TPF2-Importer Mod Downloader")
    print("=" * 60)
    print(f"Output: {MODS_DIR}")
    print()
    
    # Create download links file
    create_download_links_file()
    
    print("\nDownloading Steam Workshop mods...")
    print("(This may take a while)")
    print()
    
    success = 0
    failed = 0
    
    for steam_id, folder in STEAM_MODS.items():
        if download_steam_mod(steam_id, folder):
            success += 1
        else:
            failed += 1
    
    print()
    print("=" * 60)
    print(f"Results: {success} downloaded, {failed} failed")
    print()
    print("TransportFever.net mods must be downloaded manually.")
    print(f"See: {MODS_DIR / 'DOWNLOAD_LINKS.md'}")
    print("=" * 60)


if __name__ == "__main__":
    main()


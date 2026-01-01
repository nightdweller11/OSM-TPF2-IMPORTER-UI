#!/usr/bin/env python3
"""
Test script for OSM-TPF2 conversion
Downloads Tel Aviv OSM data and tests the conversion pipeline
"""

import os
import sys
import subprocess
import urllib.request
import ssl
import time

# Test area: Tel Aviv, Israel
# Bounds: roughly the city center area
TEST_BOUNDS = {
    "minlat": 32.05,
    "minlon": 34.76,
    "maxlat": 32.12,
    "maxlon": 34.82,
}

TEST_MAP_SIZE = (8192, 8192)  # Smaller map for testing
TEST_OSM_FILE = "test_telaviv.osm"
TEST_LUA_FILE = "test_telaviv.lua"


def download_osm_data():
    """Download OSM data for Tel Aviv if not already present"""
    if os.path.exists(TEST_OSM_FILE):
        size_mb = os.path.getsize(TEST_OSM_FILE) / (1024 * 1024)
        print(f"✓ Using existing OSM file: {TEST_OSM_FILE} ({size_mb:.1f} MB)")
        return True
    
    print(f"Downloading OSM data for Tel Aviv...")
    print(f"  Bounds: {TEST_BOUNDS}")
    
    # Build Overpass API query
    bbox = f"{TEST_BOUNDS['minlat']},{TEST_BOUNDS['minlon']},{TEST_BOUNDS['maxlat']},{TEST_BOUNDS['maxlon']}"
    
    # Use Overpass API to get OSM data
    overpass_url = "https://overpass-api.de/api/map"
    query_url = f"{overpass_url}?bbox={TEST_BOUNDS['minlon']},{TEST_BOUNDS['minlat']},{TEST_BOUNDS['maxlon']},{TEST_BOUNDS['maxlat']}"
    
    print(f"  URL: {query_url}")
    
    try:
        print("  Downloading (this may take a minute)...")
        start = time.time()
        
        request = urllib.request.Request(
            query_url,
            headers={'User-Agent': 'OSM-TPF2-Importer-Test/1.0'}
        )
        
        # Create SSL context that doesn't verify certificates (for testing only)
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        with urllib.request.urlopen(request, timeout=120, context=ssl_context) as response:
            data = response.read()
            
        with open(TEST_OSM_FILE, 'wb') as f:
            f.write(data)
        
        elapsed = time.time() - start
        size_mb = len(data) / (1024 * 1024)
        print(f"✓ Downloaded {size_mb:.1f} MB in {elapsed:.1f}s")
        return True
        
    except Exception as e:
        print(f"✗ Download failed: {e}")
        return False


def run_conversion():
    """Run the main.py conversion script"""
    print("\n" + "=" * 60)
    print("Running conversion...")
    print("=" * 60)
    
    # Build command
    bounds_str = f"{TEST_BOUNDS['minlat']},{TEST_BOUNDS['minlon']},{TEST_BOUNDS['maxlat']},{TEST_BOUNDS['maxlon']}"
    size_str = f"{TEST_MAP_SIZE[0]},{TEST_MAP_SIZE[1]}"
    
    cmd = [
        sys.executable, "main.py",
        TEST_OSM_FILE,
        TEST_LUA_FILE,
        size_str,
        bounds_str,
    ]
    
    print(f"Command: {' '.join(cmd)}")
    print()
    
    start = time.time()
    result = subprocess.run(cmd, capture_output=False)
    elapsed = time.time() - start
    
    print()
    print("=" * 60)
    
    if result.returncode == 0:
        print(f"✓ Conversion completed in {elapsed:.1f}s")
        
        # Check output file
        if os.path.exists(TEST_LUA_FILE):
            size_mb = os.path.getsize(TEST_LUA_FILE) / (1024 * 1024)
            print(f"✓ Output file: {TEST_LUA_FILE} ({size_mb:.1f} MB)")
            
            # Read and check for preprocessing stats
            print()
            print("Checking output for preprocessing data...")
            check_output_file()
            
            return True
        else:
            print(f"✗ Output file not found: {TEST_LUA_FILE}")
            return False
    else:
        print(f"✗ Conversion failed with code {result.returncode}")
        return False


def check_output_file():
    """Check the output Lua file for expected content"""
    try:
        with open(TEST_LUA_FILE, 'r') as f:
            # Read last 2KB where bounds/stats are located
            f.seek(0, 2)  # Go to end
            file_size = f.tell()
            f.seek(max(0, file_size - 2000))  # Read last 2KB
            content = f.read()
        
        # Check for bounds
        if "bounds" in content:
            print("  ✓ Contains 'bounds' section")
            
            # Try to extract some values
            if "osm_width_km" in content:
                print("  ✓ Contains OSM dimension info")
            if "scale" in content:
                print("  ✓ Contains scale info")
        else:
            print("  ✗ Missing 'bounds' section")
        
        # Check for preprocess_stats
        if "preprocess_stats" in content:
            print("  ✓ Contains 'preprocess_stats' section")
        else:
            print("  ⚠ Missing 'preprocess_stats' (may be OK if no edges filtered)")
        
        # Count edges
        edge_count = content.count('"node0"')
        print(f"  ~ Approximate edge count in file: {edge_count}+")
        
    except Exception as e:
        print(f"  ✗ Error reading output: {e}")


def check_log_file():
    """Check the log file for preprocessing output"""
    log_file = "log.txt"
    if not os.path.exists(log_file):
        print("⚠ No log file found")
        return
    
    print()
    print("Checking log file for preprocessing output...")
    
    try:
        with open(log_file, 'r') as f:
            log_content = f.read()
        
        # Look for preprocessing lines
        for line in log_content.split('\n'):
            if '[EdgePreprocessor]' in line or 'Preprocessing' in line or 'Map metadata' in line:
                print(f"  {line}")
        
    except Exception as e:
        print(f"  ✗ Error reading log: {e}")


def main():
    print("=" * 60)
    print("OSM-TPF2 Conversion Test")
    print("Test area: Tel Aviv, Israel")
    print("=" * 60)
    print()
    
    # Step 1: Download OSM data
    if not download_osm_data():
        print("\n✗ Test failed: Could not get OSM data")
        return 1
    
    # Step 2: Run conversion
    if not run_conversion():
        print("\n✗ Test failed: Conversion error")
        return 1
    
    # Step 3: Check log
    check_log_file()
    
    print()
    print("=" * 60)
    print("✓ TEST PASSED")
    print("=" * 60)
    
    return 0


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    sys.exit(main())


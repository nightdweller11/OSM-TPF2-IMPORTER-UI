"""
Heightmap Generator for TPF2
Downloads elevation data and generates a 16-bit grayscale PNG heightmap
"""

import requests
import numpy as np
from PIL import Image
import math
import json
import time
import sys

# Elevation API options
ELEVATION_APIS = [
    {
        "name": "Open-Elevation",
        "url": "https://api.open-elevation.com/api/v1/lookup",
        "method": "post",
        "batch_size": 100,
    },
    {
        "name": "OpenTopoData-SRTM",
        "url": "https://api.opentopodata.org/v1/srtm30m",
        "method": "get",
        "batch_size": 100,
        "rate_limit": 1.0,  # seconds between requests
    },
    {
        "name": "OpenTopoData-ASTER",
        "url": "https://api.opentopodata.org/v1/aster30m",
        "method": "get", 
        "batch_size": 100,
        "rate_limit": 1.0,
    },
]


def get_elevation_batch(api, locations):
    """Get elevation for a batch of locations using specified API"""
    try:
        if api["method"] == "post":
            # Open-Elevation style
            payload = {"locations": [{"latitude": lat, "longitude": lon} for lat, lon in locations]}
            response = requests.post(api["url"], json=payload, timeout=30)
        else:
            # OpenTopoData style  
            locs_str = "|".join([f"{lat},{lon}" for lat, lon in locations])
            response = requests.get(f"{api['url']}?locations={locs_str}", timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if "results" in data:
                return [r.get("elevation", 0) or 0 for r in data["results"]]
        
        print(f"[Heightmap] API error: {response.status_code}", file=sys.stderr)
        return None
        
    except Exception as e:
        print(f"[Heightmap] Request error: {e}", file=sys.stderr)
        return None


def download_elevation_grid(min_lat, max_lat, min_lon, max_lon, resolution=256, progress_callback=None):
    """
    Download elevation data for a bounding box and return as numpy array.
    
    Args:
        min_lat, max_lat, min_lon, max_lon: Bounding box in WGS84
        resolution: Number of samples in each direction (default 256)
        progress_callback: Optional callback(percent, message)
    
    Returns:
        numpy array of elevation values (resolution x resolution)
    """
    
    print(f"[Heightmap] Downloading elevation grid {resolution}x{resolution}", file=sys.stderr)
    print(f"[Heightmap] Bounds: {min_lat:.4f},{min_lon:.4f} to {max_lat:.4f},{max_lon:.4f}", file=sys.stderr)
    
    # Generate sample points
    lats = np.linspace(max_lat, min_lat, resolution)  # North to south
    lons = np.linspace(min_lon, max_lon, resolution)  # West to east
    
    # Create all sample locations
    all_locations = []
    for lat in lats:
        for lon in lons:
            all_locations.append((lat, lon))
    
    total_points = len(all_locations)
    print(f"[Heightmap] Total points to fetch: {total_points}", file=sys.stderr)
    
    # Try each API until one works
    elevations = []
    for api in ELEVATION_APIS:
        print(f"[Heightmap] Trying {api['name']}...", file=sys.stderr)
        elevations = []
        batch_size = api.get("batch_size", 100)
        rate_limit = api.get("rate_limit", 0.5)
        
        success = True
        for i in range(0, total_points, batch_size):
            batch = all_locations[i:i+batch_size]
            batch_elevs = get_elevation_batch(api, batch)
            
            if batch_elevs is None:
                print(f"[Heightmap] {api['name']} failed, trying next...", file=sys.stderr)
                success = False
                break
            
            elevations.extend(batch_elevs)
            
            # Progress
            pct = min(99, int((i + len(batch)) / total_points * 100))
            if progress_callback:
                progress_callback(pct, f"Downloading elevation: {pct}%")
            
            if i + batch_size < total_points:
                time.sleep(rate_limit)
        
        if success:
            print(f"[Heightmap] {api['name']} succeeded!", file=sys.stderr)
            break
    
    if len(elevations) != total_points:
        print(f"[Heightmap] ERROR: Got {len(elevations)} elevations, expected {total_points}", file=sys.stderr)
        # Fill with zeros
        elevations = [0] * total_points
    
    # Reshape to grid
    elevation_grid = np.array(elevations).reshape((resolution, resolution))
    
    return elevation_grid


def generate_heightmap_png(elevation_grid, output_path, water_level=0):
    """
    Generate TPF2-compatible 16-bit PNG heightmap.
    
    TPF2 expects:
    - 16-bit grayscale PNG
    - Size: (256*n)+1 (e.g., 1025, 2049, 4097)
    - 0 = lowest, 65535 = highest
    
    Args:
        elevation_grid: numpy array of elevation values
        output_path: Path to save PNG
        water_level: Sea level in meters (areas below this become water)
    """
    
    # Get min/max elevation
    min_elev = np.min(elevation_grid)
    max_elev = np.max(elevation_grid)
    
    print(f"[Heightmap] Elevation range: {min_elev:.1f}m to {max_elev:.1f}m", file=sys.stderr)
    
    # Handle flat terrain
    if max_elev == min_elev:
        max_elev = min_elev + 100  # Add some range
    
    # Normalize to 0-65535 range
    # Leave some headroom for water (bottom 10%) and peaks (top 10%)
    range_scale = 0.8
    range_offset = 0.1
    
    normalized = (elevation_grid - min_elev) / (max_elev - min_elev)
    normalized = normalized * range_scale + range_offset
    normalized = np.clip(normalized, 0, 1)
    
    # Convert to 16-bit
    heightmap_16bit = (normalized * 65535).astype(np.uint16)
    
    # Resize to TPF2-compatible size
    current_size = heightmap_16bit.shape[0]
    # Find next valid size: (256*n)+1
    target_size = ((current_size // 256) + 1) * 256 + 1
    if target_size < 1025:
        target_size = 1025
    
    print(f"[Heightmap] Resizing from {current_size} to {target_size}", file=sys.stderr)
    
    # Use PIL for high-quality resize
    img = Image.fromarray(heightmap_16bit, mode='I;16')
    img_resized = img.resize((target_size, target_size), Image.BILINEAR)
    
    # Save
    img_resized.save(output_path)
    print(f"[Heightmap] Saved: {output_path}", file=sys.stderr)
    
    return {
        "path": output_path,
        "size": target_size,
        "min_elevation": float(min_elev),
        "max_elevation": float(max_elev),
    }


def generate_heightmap_for_bounds(bounds, output_path, resolution=256, progress_callback=None):
    """
    Main function to generate heightmap for given bounds.
    
    Args:
        bounds: dict with minLat, maxLat, minLon, maxLon
        output_path: Where to save the PNG
        resolution: Grid resolution (default 256, will be upsized to 1025 for TPF2)
        progress_callback: Optional progress callback
    
    Returns:
        dict with heightmap info
    """
    
    elevation_grid = download_elevation_grid(
        bounds["minLat"],
        bounds["maxLat"],
        bounds["minLon"],
        bounds["maxLon"],
        resolution=resolution,
        progress_callback=progress_callback
    )
    
    return generate_heightmap_png(elevation_grid, output_path)


if __name__ == "__main__":
    # Test with Tel Aviv area
    bounds = {
        "minLat": 32.05,
        "maxLat": 32.15,
        "minLon": 34.75,
        "maxLon": 34.85,
    }
    
    result = generate_heightmap_for_bounds(bounds, "test_heightmap.png", resolution=64)
    print(f"Result: {json.dumps(result, indent=2)}")


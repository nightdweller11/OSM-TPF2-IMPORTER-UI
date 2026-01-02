import os, sys
import luadata
from datetime import datetime

import progress
import read_osm
import convert_data
import optimize_edges
import sort_edges
import edge_preprocessor
from lua_remove_nil import lua_remove_nil

#################################################

# Initialize progress tracking
progress.init()

# Open log file for detailed output (keep stdout for log file)
log_file = open('log.txt', 'w', encoding='utf-8')
original_stdout = sys.stdout
sys.stdout = log_file

def log(message):
    """Write to both log file and emit as progress info."""
    print(message)
    sys.stdout.flush()

log("#" * 16 + "  OSM-TPF2 CONVERTER  " + "#" * 16)
log(f"Startup: {datetime.now()}")
start = datetime.now()

# Note: Download is handled by Node.js (0-15%), we start at 15%
progress.phase("init", "Initializing Python converter...", 15)
progress.step("Loading conversion modules...")

#################################################

# set Input and Output file
INFILE = "map.osm"
if len(sys.argv) > 1:
    INFILE = sys.argv[1]
OUTFILE = "osmdata.lua"
if len(sys.argv) > 2:
    OUTFILE = sys.argv[2]

# define Map Bounds
bounds_length = (24576, 24576)  # tpf2 map size
if len(sys.argv) > 3:
    bounds_length = tuple(map(int, sys.argv[3].split(',')))
    assert len(bounds_length) == 2
bounds = {  # set bounds manually
    "minlat": 49.9829, "minlon": 8.48095,
    "maxlat": 50.2037, "maxlon": 8.8260,
}
if len(sys.argv) > 4:
    coords = list(map(float, sys.argv[4].split(',')))
    bounds = dict((key, c) for key, c in zip(["minlat", "minlon", "maxlat", "maxlon"], coords))

# Heightmap output (optional)
HEIGHTMAP_FILE = None
if len(sys.argv) > 5 and sys.argv[5]:
    HEIGHTMAP_FILE = sys.argv[5]

log(f"Input file: {INFILE}")
log(f"Output file: {OUTFILE}")
log(f"Map size: {bounds_length}")
log(f"Map Bounds: {bounds}")

# Get file size for estimation
try:
    file_size_mb = os.path.getsize(INFILE) / (1024 * 1024)
    progress.info(f"Input file size: {file_size_mb:.1f} MB")
    # Rough estimation: ~1 minute per 100MB of OSM data
    estimated_total = max(60, file_size_mb * 0.6)  # seconds
    progress.estimate(estimated_total)
except:
    file_size_mb = 0
    estimated_total = 300  # default 5 minutes

progress.step(f"Input: {os.path.basename(INFILE)} ({file_size_mb:.1f} MB)")
progress.step(f"Output: {os.path.basename(OUTFILE)}")
progress.step(f"Map size: {bounds_length[0]}x{bounds_length[1]}")

#################################################

# 1. Parse osm xml data and put in dicts
log("=" * 16 + " Parse OSM XML data " + "=" * 16)
progress.phase("parsing", "Parsing OSM XML data...", 15, {
    "file": os.path.basename(INFILE),
    "size_mb": round(file_size_mb, 1)
})

# Custom read function with progress
def read_with_progress(filename):
    """Read OSM file with progress reporting."""
    from osmread import parse_file, Node, Way, Relation
    import xml.etree.ElementTree as Xmlt
    
    progress.step("Reading XML bounds...")
    bounds = read_osm.read_bounds(filename)
    log(f"Bounds of osm file: {bounds}")
    
    progress.step("Parsing OSM entities...")
    
    nodes = {}
    ways = {}
    relations = {}
    entity_count = 0
    last_report = 0
    
    # Estimate total entities based on file size (roughly 1 entity per 100 bytes)
    estimated_entities = max(100000, int(file_size_mb * 1024 * 1024 / 100))
    
    for entity in parse_file(filename):
        entity_count += 1
        
        # Report every 50,000 entities for smoother progress
        if entity_count - last_report >= 50000:
            # Progress from 15% to 35% during parsing
            parse_progress = min(35, 15 + (entity_count / estimated_entities) * 20)
            progress.step(f"Parsed {entity_count:,} entities...", 
                         percent=parse_progress)
            last_report = entity_count
        
        if isinstance(entity, Node):
            nodes[entity.id] = entity
            if not read_osm.isinbounds(bounds, entity.lat, entity.lon):
                entity.tags["outofbounds"] = True
        elif isinstance(entity, Way):
            ways[entity.id] = entity
        elif isinstance(entity, Relation):
            relations[entity.id] = entity
    
    log(f"Loaded {len(nodes)} Nodes / {len(ways)} Ways / {len(relations)} Relations")
    progress.stats(nodes=len(nodes), ways=len(ways), relations=len(relations))
    progress.step(f"Loaded {len(nodes):,} nodes, {len(ways):,} ways, {len(relations):,} relations", percent=35)
    
    return nodes, ways, relations

nodes, ways, relations = read_with_progress(INFILE)

#################################################

# 2. Convert osm data to relevant data for TPF2
log("=" * 16 + " Convert/Transform data " + "=" * 16)
progress.phase("converting", "Converting OSM data to TPF2 format...", 35, {
    "nodes": len(nodes),
    "ways": len(ways),
    "relations": len(relations)
})

# Monkey-patch convert_data to report progress
original_convert = convert_data.convert

def convert_with_progress(nodes, ways, relations, bounds, bounds_length):
    progress.step("Processing ways and extracting edges...", percent=38)
    result = original_convert(nodes, ways, relations, bounds, bounds_length)
    
    edge_count = len(result.get("edges", []))
    town_count = len(result.get("towns", []))
    area_count = sum(len(a) for a in result.get("areas", {}).values())
    object_count = len(result.get("objects", []))
    
    progress.stats(
        nodes=len(result.get("nodes", {})),
        edges=edge_count,
        towns=town_count,
        areas=area_count,
        objects=object_count
    )
    progress.step(f"Extracted {edge_count:,} edges, {town_count:,} towns, {area_count:,} areas", percent=48)
    
    return result

data = convert_with_progress(nodes, ways, relations, bounds, bounds_length)

#################################################

# 3. Do optimizations for edges (shorting, curving)
log("=" * 16 + " Optimize Edges/geometry " + "=" * 16)
progress.phase("optimizing", "Optimizing edge geometry...", 50, {
    "edges": len(data.get("edges", []))
})

progress.step("Shortening and curving edges...")
optimize_edges.optimize(data)

edge_count = len(data.get("edges", []))
progress.step(f"Optimized {edge_count:,} edges", percent=70)

#################################################

# 4. Sort edges by (street)type, so more important streets get built first
log("=" * 16 + " Sort Edges " + "=" * 16)
progress.phase("sorting", "Sorting edges by priority...", 70)

progress.step("Sorting edges by street type...")
data["edges"] = sort_edges.sort(data["edges"])
progress.step(f"Sorted {len(data['edges']):,} edges by type", percent=75)

#################################################

# 4b. Preprocess edges: filter out-of-bounds, order by continuity
log("=" * 16 + " Preprocess Edges " + "=" * 16)
progress.phase("preprocessing", "Preprocessing edges...", 75)

preprocess_stats = {}
progress.step("Filtering out-of-bounds edges...")
data["edges"] = edge_preprocessor.preprocess_edges(
    data["edges"], 
    data["nodes"],
    enable_batching=False,  # Batching handled in Lua for now
    stats=preprocess_stats
)

log(f"Preprocessing stats: {preprocess_stats}")
progress.step(f"Preprocessed: {preprocess_stats.get('final_count', 0):,} edges " +
              f"(removed {preprocess_stats.get('edges_filtered', 0):,} out-of-bounds)", 
              percent=80)

#################################################

# 5. remove nil values, makes file shorter
progress.phase("cleanup", "Cleaning up data...", 80)
progress.step("Removing nil values...")
data = lua_remove_nil(data)
progress.step("Data cleanup complete", percent=85)

#################################################

log("=" * 16 + " Write Lua file " + "=" * 16)
progress.phase("writing", "Writing Lua output file...", 85, {
    "output": os.path.basename(OUTFILE)
})

# Add map metadata to the output
import math

# Calculate real-world dimensions
lat_diff = bounds["maxlat"] - bounds["minlat"]
lon_diff = bounds["maxlon"] - bounds["minlon"]
# Approximate meters (1 degree lat ≈ 111km, lon varies with latitude)
avg_lat = (bounds["maxlat"] + bounds["minlat"]) / 2
lat_meters = lat_diff * 111000
lon_meters = lon_diff * 111000 * math.cos(math.radians(avg_lat))

data["bounds"] = {
    "minlat": bounds["minlat"],
    "maxlat": bounds["maxlat"],
    "minlon": bounds["minlon"],
    "maxlon": bounds["maxlon"],
    "osm_width_km": round(lon_meters / 1000, 2),
    "osm_height_km": round(lat_meters / 1000, 2),
    "tpf2_width": bounds_length[0],
    "tpf2_height": bounds_length[1],
    "scale": round(lon_meters / bounds_length[0], 2) if bounds_length[0] > 0 else 1,
}

# Add preprocessing stats if available
if preprocess_stats:
    data["preprocess_stats"] = {
        "original_edges": preprocess_stats.get("original_count", 0),
        "filtered_edges": preprocess_stats.get("edges_filtered", 0),
        "final_edges": preprocess_stats.get("final_count", 0),
    }

log(f"Map metadata: OSM {data['bounds']['osm_width_km']}km x {data['bounds']['osm_height_km']}km -> TPF2 {bounds_length[0]}m x {bounds_length[1]}m")
log(f"Scale: 1:{data['bounds']['scale']:.0f}")

progress.step(f"Writing to {os.path.basename(OUTFILE)}...")
progress.info("This may take a while for large datasets...")
luadata.write(OUTFILE, data, indent="\t")

# Get output file size
try:
    output_size_mb = os.path.getsize(OUTFILE) / (1024 * 1024)
    progress.step(f"Written {output_size_mb:.1f} MB", percent=90)
except:
    output_size_mb = 0

#################################################

# 6. Generate heightmap (optional)
heightmap_result = None
if HEIGHTMAP_FILE:
    log("=" * 16 + " Generate Heightmap " + "=" * 16)
    progress.phase("heightmap", "Generating heightmap...", 90)
    
    try:
        import heightmap
        
        def heightmap_progress(pct, msg):
            progress.step(msg, percent=90 + (pct * 0.08))  # 90% to 98%
        
        heightmap_bounds = {
            "minLat": bounds["minlat"],
            "maxLat": bounds["maxlat"],
            "minLon": bounds["minlon"],
            "maxLon": bounds["maxlon"],
        }
        
        progress.step("Downloading elevation data...")
        heightmap_result = heightmap.generate_heightmap_for_bounds(
            heightmap_bounds, 
            HEIGHTMAP_FILE,
            resolution=256,  # Will be upscaled to 1025
            progress_callback=heightmap_progress
        )
        
        log(f"Heightmap generated: {HEIGHTMAP_FILE}")
        log(f"  Elevation range: {heightmap_result['min_elevation']:.1f}m to {heightmap_result['max_elevation']:.1f}m")
        progress.step(f"Heightmap: {heightmap_result['size']}x{heightmap_result['size']}", percent=98)
        
    except Exception as e:
        log(f"WARNING: Heightmap generation failed: {e}")
        progress.step(f"Heightmap failed: {e}", percent=98)
        import traceback
        traceback.print_exc()

#################################################

# Calculate final stats
detailed = data.get('detailed_stats', {})

final_stats = {
    "towns": len(data['towns']),
    "nodes": len(data['nodes']),
    "edges": len(data['edges']),
    "areas": sum(len(area) for area in data['areas'].values()),
    "objects": len(data['objects']),
    "output_size_mb": round(output_size_mb, 1),
    # Detailed inventory
    "inventory": {
        "streets": detailed.get("streets", {}),
        "tracks": detailed.get("tracks", {}),
        "objects": detailed.get("objects", {}),
        "places": detailed.get("places", {}),
        "areas": {
            "forests": detailed.get("areas", {}).get("forests", 0),
            "shrubs": detailed.get("areas", {}).get("shrubs", 0),
            "grounds": detailed.get("areas", {}).get("grounds", {}),
        },
        "signals": detailed.get("signals", 0),
        "bridges": detailed.get("bridges", 0),
        "tunnels": detailed.get("tunnels", 0),
        "streams": detailed.get("streams", 0),
    }
}

log(f"Successfully converted OSM data to: '{OUTFILE}'")
log("\n  ".join([f"Data contains:",
                 f"Towns: {final_stats['towns']}",
                 f"Nodes: {final_stats['nodes']}",
                 f"Edges: {final_stats['edges']}",
                 f"Areas: {final_stats['areas']}",
                 f"Objects: {final_stats['objects']}"
                 ]))

execution_time = datetime.now() - start
log(f"Execution time: {execution_time}")

# Report completion
progress.phase("complete", "Conversion complete!", 100)
progress.complete(final_stats)
progress.info(f"Total time: {execution_time}")

# Close log file
log_file.close()

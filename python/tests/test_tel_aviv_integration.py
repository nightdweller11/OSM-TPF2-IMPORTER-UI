"""
Integration test with real Tel Aviv OSM data.

Downloads a small area of Tel Aviv, runs the full optimization pipeline,
and verifies that the output is correct and optimized.
"""

import sys
import os
import json
import tempfile
import urllib.request
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# Tel Aviv center coordinates
TEL_AVIV_LAT = 32.0853
TEL_AVIV_LON = 34.7818

# Test area size in meters (small for quick testing)
TEST_AREA_SIZE = 300  # 300m x 300m - smaller for faster download


def download_osm_data(center_lat, center_lon, size_meters, output_path):
    """Download OSM data from Overpass API."""
    import ssl
    import subprocess
    
    # Convert meters to approximate degrees
    lat_diff = size_meters / 111000  # ~111km per degree latitude
    lon_diff = size_meters / (111000 * abs(cos_deg(center_lat)))
    
    min_lat = center_lat - lat_diff / 2
    max_lat = center_lat + lat_diff / 2
    min_lon = center_lon - lon_diff / 2
    max_lon = center_lon + lon_diff / 2
    
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    
    # Overpass API query for roads and railways
    query = f"""
    [out:xml][timeout:60];
    (
      way["highway"]({bbox});
      way["railway"]({bbox});
      node(w);
    );
    out body;
    """
    
    # Try multiple Overpass API endpoints
    urls = [
        "https://lz4.overpass-api.de/api/interpreter",
        "https://z.overpass-api.de/api/interpreter",
        "https://overpass-api.de/api/interpreter",
    ]
    
    print(f"Downloading OSM data for bbox: {bbox}")
    
    for url in urls:
        print(f"  Trying {url}...")
        # Try curl with -k to skip SSL verification (macOS often has issues)
        try:
            result = subprocess.run(
                ["curl", "-k", "-s", "--max-time", "60", "-X", "POST", "-d", query, url],
                capture_output=True,
                timeout=70
            )
            if result.returncode == 0 and len(result.stdout) > 100:
                with open(output_path, 'wb') as f:
                    f.write(result.stdout)
                print(f"Downloaded {len(result.stdout)} bytes to {output_path}")
                return True
            else:
                print(f"  curl returned {result.returncode}, {len(result.stdout)} bytes")
        except subprocess.TimeoutExpired:
            print(f"  Timeout on {url}")
        except Exception as e:
            print(f"  curl failed: {e}")
    
    # Fallback to urllib with SSL workaround
    try:
        # Create unverified SSL context (for testing only)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        req = urllib.request.Request(
            url,
            data=query.encode('utf-8'),
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        with urllib.request.urlopen(req, timeout=120, context=ctx) as response:
            data = response.read()
            with open(output_path, 'wb') as f:
                f.write(data)
            print(f"Downloaded {len(data)} bytes to {output_path}")
            return True
    except Exception as e:
        print(f"Error downloading OSM data: {e}")
        return False


def cos_deg(degrees):
    """Cosine of angle in degrees."""
    import math
    return math.cos(math.radians(degrees))


def count_edges_and_nodes(data):
    """Count edges and active nodes in data."""
    edges = len(data.get("edges", {}))
    nodes = sum(1 for n in data.get("nodes", {}).values() if not n.get("removed"))
    return edges, nodes


def verify_connectivity(data):
    """Verify that all edges are connected to valid nodes."""
    nodes = data.get("nodes", {})
    edges = data.get("edges", {})
    
    issues = []
    for edge_id, edge in edges.items():
        n0 = edge.get("node0")
        n1 = edge.get("node1")
        
        if n0 not in nodes:
            issues.append(f"Edge {edge_id}: node0 {n0} not found")
        elif nodes[n0].get("removed"):
            issues.append(f"Edge {edge_id}: node0 {n0} was removed")
        
        if n1 not in nodes:
            issues.append(f"Edge {edge_id}: node1 {n1} not found")
        elif nodes[n1].get("removed"):
            issues.append(f"Edge {edge_id}: node1 {n1} was removed")
    
    return issues


def verify_edge_types(data):
    """Verify all edges have valid types."""
    edges = data.get("edges", {})
    
    street_count = 0
    track_count = 0
    invalid_count = 0
    
    street_types = {}
    track_types = {}
    
    for edge_id, edge in edges.items():
        has_street = edge.get("street") is not None
        has_track = edge.get("track") is not None
        
        if has_street:
            street_count += 1
            st = edge["street"].get("type", "unknown")
            street_types[st] = street_types.get(st, 0) + 1
        elif has_track:
            track_count += 1
            tt = edge["track"].get("type", "unknown")
            track_types[tt] = track_types.get(tt, 0) + 1
        else:
            invalid_count += 1
    
    return {
        "street_count": street_count,
        "track_count": track_count,
        "invalid_count": invalid_count,
        "street_types": street_types,
        "track_types": track_types,
    }


def run_integration_test():
    """Run the full integration test."""
    print("=" * 60)
    print("Tel Aviv OSM Integration Test")
    print("=" * 60)
    
    # Import the conversion modules
    try:
        from convert_data import convert
        from optimize_edges import optimize
    except ImportError as e:
        print(f"Failed to import required modules: {e}")
        print("Make sure you're running from the python directory")
        return False
    
    # Create temp directory for test data
    with tempfile.TemporaryDirectory() as tmpdir:
        osm_path = os.path.join(tmpdir, "tel_aviv.osm")
        
        # Download OSM data
        print("\n[1/5] Downloading OSM data...")
        if not download_osm_data(TEL_AVIV_LAT, TEL_AVIV_LON, TEST_AREA_SIZE, osm_path):
            print("Failed to download OSM data - skipping integration test")
            print("This may be due to network issues or rate limiting")
            return None  # Inconclusive
        
        # Parse OSM data using xml.etree (more reliable)
        print("\n[2/5] Parsing OSM data...")
        import xml.etree.ElementTree as ET
        
        # Create simple Node and Way classes to mimic osmread
        class SimpleNode:
            def __init__(self, id, lat, lon, tags):
                self.id = id
                self.lat = lat
                self.lon = lon
                self.tags = tags
        
        class SimpleWay:
            def __init__(self, id, nodes, tags):
                self.id = id
                self.nodes = nodes
                self.tags = tags
        
        nodes = {}
        ways = {}
        relations = {}
        
        try:
            tree = ET.parse(osm_path)
            root = tree.getroot()
            
            for node_elem in root.findall('node'):
                node_id = int(node_elem.get('id'))
                lat = float(node_elem.get('lat'))
                lon = float(node_elem.get('lon'))
                tags = {tag.get('k'): tag.get('v') for tag in node_elem.findall('tag')}
                nodes[node_id] = SimpleNode(node_id, lat, lon, tags)
            
            for way_elem in root.findall('way'):
                way_id = int(way_elem.get('id'))
                way_nodes = [int(nd.get('ref')) for nd in way_elem.findall('nd')]
                tags = {tag.get('k'): tag.get('v') for tag in way_elem.findall('tag')}
                ways[way_id] = SimpleWay(way_id, way_nodes, tags)
                
        except Exception as e:
            print(f"Failed to parse OSM file: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        print(f"  Parsed {len(nodes)} nodes, {len(ways)} ways")
        
        if len(ways) < 10:
            print("  WARNING: Very few ways found - area may be empty")
        
        # Convert to internal format
        print("\n[3/5] Converting to internal format...")
        map_bounds = {
            "min_lat": TEL_AVIV_LAT - TEST_AREA_SIZE / 222000,
            "max_lat": TEL_AVIV_LAT + TEST_AREA_SIZE / 222000,
            "min_lon": TEL_AVIV_LON - TEST_AREA_SIZE / (222000 * cos_deg(TEL_AVIV_LAT)),
            "max_lon": TEL_AVIV_LON + TEST_AREA_SIZE / (222000 * cos_deg(TEL_AVIV_LAT)),
        }
        
        try:
            data, stats = convert(nodes, ways, relations, map_bounds, TEST_AREA_SIZE)
        except Exception as e:
            print(f"Failed to convert data: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        edges_before, nodes_before = count_edges_and_nodes(data)
        print(f"  Before optimization: {edges_before} edges, {nodes_before} nodes")
        
        if edges_before == 0:
            print("  WARNING: No edges created - check conversion logic")
            return False
        
        # Run optimization
        print("\n[4/5] Running optimization (with Douglas-Peucker)...")
        try:
            optimize(data)
        except Exception as e:
            print(f"Optimization failed: {e}")
            import traceback
            traceback.print_exc()
            return False
        
        edges_after, nodes_after = count_edges_and_nodes(data)
        print(f"  After optimization: {edges_after} edges, {nodes_after} nodes")
        
        reduction_percent = (1 - edges_after / edges_before) * 100 if edges_before > 0 else 0
        print(f"  Reduction: {reduction_percent:.1f}%")
        
        # Verify results
        print("\n[5/5] Verifying results...")
        
        # Check connectivity
        connectivity_issues = verify_connectivity(data)
        if connectivity_issues:
            print(f"  ✗ Connectivity issues found: {len(connectivity_issues)}")
            for issue in connectivity_issues[:5]:
                print(f"    - {issue}")
            if len(connectivity_issues) > 5:
                print(f"    ... and {len(connectivity_issues) - 5} more")
            return False
        else:
            print("  ✓ All edges connected to valid nodes")
        
        # Check edge types
        type_info = verify_edge_types(data)
        if type_info["invalid_count"] > 0:
            print(f"  ✗ {type_info['invalid_count']} edges have no type")
            return False
        else:
            print(f"  ✓ All edges have valid types")
            print(f"    Streets: {type_info['street_count']}, Tracks: {type_info['track_count']}")
            if type_info['street_types']:
                top_types = sorted(type_info['street_types'].items(), key=lambda x: -x[1])[:5]
                print(f"    Top street types: {dict(top_types)}")
        
        # Check optimization effectiveness
        print("\n" + "=" * 60)
        print("Summary")
        print("=" * 60)
        print(f"  Original edges:  {edges_before:,}")
        print(f"  Optimized edges: {edges_after:,}")
        print(f"  Reduction:       {reduction_percent:.1f}%")
        print(f"  Original nodes:  {nodes_before:,}")
        print(f"  Active nodes:    {nodes_after:,}")
        
        # Success criteria
        success = True
        
        if reduction_percent < 10:
            print(f"\n  ⚠ Warning: Low reduction ({reduction_percent:.1f}%) - optimization may not be effective")
            # Not a failure, just a warning
        else:
            print(f"\n  ✓ Good reduction achieved ({reduction_percent:.1f}%)")
        
        if edges_after > edges_before:
            print("  ✗ FAIL: More edges after optimization!")
            success = False
        
        if len(connectivity_issues) > 0:
            success = False
        
        print("=" * 60)
        if success:
            print("TEST PASSED ✓")
        else:
            print("TEST FAILED ✗")
        print("=" * 60)
        
        return success


if __name__ == "__main__":
    result = run_integration_test()
    if result is None:
        print("\nTest inconclusive (network issues)")
        sys.exit(2)
    elif result:
        sys.exit(0)
    else:
        sys.exit(1)


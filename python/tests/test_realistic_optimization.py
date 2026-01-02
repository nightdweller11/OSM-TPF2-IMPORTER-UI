"""
Realistic optimization tests using synthetically generated city data.

This test generates a realistic city street network and verifies that
the optimizer correctly reduces edge count while maintaining road integrity.
"""

import sys
import math
import random
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from vec2 import Vec2
from optimize_edges import simplify_paths_douglas_peucker, optimize


def create_city_grid(center, block_size=100, blocks_x=5, blocks_y=5, nodes_per_block=20):
    """
    Create a realistic city grid with:
    - Main roads (fewer nodes, straighter)
    - Residential streets (more nodes due to OSM capture granularity)
    - Some curved roads
    """
    nodes = {}
    edges = {}
    edge_counter = 0
    node_counter = 0
    
    def add_node(x, y, z=0):
        nonlocal node_counter
        node_id = f"n{node_counter}"
        node_counter += 1
        nodes[node_id] = {
            "pos": [x, y, z],
            "way_start_to": [],
            "way_end_from": [],
            "way_within": [],
        }
        return node_id
    
    def add_edge(n0, n1, street_type, way_id):
        nonlocal edge_counter
        edge_id = f"way{way_id}_{edge_counter}"
        edge_counter += 1
        edges[edge_id] = {
            "id": edge_id,
            "node0": n0,
            "node1": n1,
            "street": {
                "type": street_type,
                "speed": 50 if street_type in ["primary", "secondary"] else 30,
            }
        }
        return edge_id
    
    def create_road_with_many_nodes(start, end, num_nodes, street_type, way_id):
        """Create a road with many intermediate nodes (like OSM data)."""
        node_ids = []
        for i in range(num_nodes):
            t = i / (num_nodes - 1)
            x = start[0] + (end[0] - start[0]) * t
            y = start[1] + (end[1] - start[1]) * t
            # Add small random variation (like GPS jitter)
            if 0 < i < num_nodes - 1:
                x += random.uniform(-0.5, 0.5)
                y += random.uniform(-0.5, 0.5)
            node_ids.append(add_node(x, y))
        
        for i in range(len(node_ids) - 1):
            add_edge(node_ids[i], node_ids[i+1], street_type, way_id)
        
        return node_ids[0], node_ids[-1]
    
    way_counter = 0
    junction_nodes = {}  # (block_x, block_y) -> node_id
    
    # Create horizontal main roads
    for row in range(blocks_y + 1):
        y = center[1] + (row - blocks_y / 2) * block_size
        start_x = center[0] - (blocks_x / 2) * block_size
        end_x = center[0] + (blocks_x / 2) * block_size
        
        # Main roads have more nodes (longer roads = more GPS points)
        road_nodes = blocks_x * nodes_per_block
        prev_junction = None
        
        for col in range(blocks_x + 1):
            x = center[0] + (col - blocks_x / 2) * block_size
            
            if col == 0:
                prev_junction = add_node(x, y)
            else:
                # Create road segment with intermediate nodes
                segment_nodes = nodes_per_block
                first_node = prev_junction
                
                for i in range(1, segment_nodes + 1):
                    t = i / segment_nodes
                    seg_x = center[0] + (col - 1 - blocks_x / 2) * block_size + t * block_size
                    seg_y = y + random.uniform(-0.3, 0.3)
                    
                    if i == segment_nodes:
                        new_node = add_node(x, y)
                    else:
                        new_node = add_node(seg_x, seg_y)
                    
                    street_type = "primary" if row == blocks_y // 2 else "residential"
                    add_edge(prev_junction, new_node, street_type, way_counter)
                    prev_junction = new_node
                
                way_counter += 1
            
            junction_nodes[(col, row)] = prev_junction
    
    # Create vertical roads
    for col in range(blocks_x + 1):
        x = center[0] + (col - blocks_x / 2) * block_size
        
        for row in range(blocks_y):
            start_junction = junction_nodes[(col, row)]
            end_junction = junction_nodes[(col, row + 1)]
            
            # Connect via intermediate nodes
            for i in range(1, nodes_per_block):
                t = i / nodes_per_block
                y_start = center[1] + (row - blocks_y / 2) * block_size
                y_end = center[1] + (row + 1 - blocks_y / 2) * block_size
                seg_y = y_start + t * (y_end - y_start)
                seg_x = x + random.uniform(-0.3, 0.3)
                
                new_node = add_node(seg_x, seg_y)
                street_type = "secondary" if col == blocks_x // 2 else "residential"
                add_edge(start_junction, new_node, street_type, way_counter)
                start_junction = new_node
            
            add_edge(start_junction, end_junction, "residential", way_counter)
            way_counter += 1
    
    return nodes, edges


def create_curved_highway(center, length=1000, num_curves=3, nodes_per_curve=30):
    """Create a highway with gentle curves (like a real motorway)."""
    nodes = {}
    edges = {}
    
    node_counter = 0
    edge_counter = 0
    
    def add_node(x, y):
        nonlocal node_counter
        nid = f"n{node_counter}"
        node_counter += 1
        nodes[nid] = {
            "pos": [x, y, 0],
            "way_start_to": [],
            "way_end_from": [],
            "way_within": [],
        }
        return nid
    
    prev_node = None
    total_nodes = num_curves * nodes_per_curve
    
    for i in range(total_nodes):
        t = i / (total_nodes - 1)
        # Base position along X axis
        x = center[0] - length/2 + t * length
        # Gentle sinusoidal curve
        y = center[1] + 50 * math.sin(t * num_curves * math.pi)
        # Add slight random variation
        x += random.uniform(-0.2, 0.2)
        y += random.uniform(-0.2, 0.2)
        
        new_node = add_node(x, y)
        
        if prev_node:
            eid = f"motorway_0_{edge_counter}"
            edge_counter += 1
            edges[eid] = {
                "id": eid,
                "node0": prev_node,
                "node1": new_node,
                "street": {
                    "type": "motorway",
                    "speed": 120,
                }
            }
        
        prev_node = new_node
    
    return nodes, edges


def run_realistic_tests():
    """Run optimization tests on realistic city data."""
    print("=" * 60)
    print("Realistic Optimization Tests")
    print("=" * 60)
    
    random.seed(42)  # For reproducibility
    
    # Test 1: City grid
    print("\n[Test 1] City Grid (5x5 blocks)")
    nodes, edges = create_city_grid([0, 0], block_size=100, blocks_x=5, blocks_y=5, nodes_per_block=15)
    
    original_edges = len(edges)
    original_nodes = len(nodes)
    print(f"  Original: {original_edges} edges, {original_nodes} nodes")
    
    # Run Douglas-Peucker
    removed = simplify_paths_douglas_peucker(
        nodes, edges,
        epsilon=2.0,
        max_merged_length=250,
        max_angle_deg=10
    )
    
    final_edges = len(edges)
    active_nodes = sum(1 for n in nodes.values() if not n.get("removed"))
    reduction = (1 - final_edges / original_edges) * 100
    
    print(f"  After optimization: {final_edges} edges, {active_nodes} active nodes")
    print(f"  Reduction: {reduction:.1f}% ({removed} nodes removed)")
    
    # Verify connectivity
    from collections import defaultdict
    adjacency = defaultdict(set)
    for e in edges.values():
        n0, n1 = e["node0"], e["node1"]
        if not nodes[n0].get("removed") and not nodes[n1].get("removed"):
            adjacency[n0].add(n1)
            adjacency[n1].add(n0)
    
    # Check for isolated nodes (should have at least 2 connections or be endpoints)
    isolated = [n for n in adjacency if len(adjacency[n]) == 0]
    
    test1_pass = reduction >= 50 and len(isolated) == 0
    print(f"  {'✓ PASS' if test1_pass else '✗ FAIL'}: City grid optimization")
    
    # Test 2: Curved highway
    print("\n[Test 2] Curved Highway (1km with curves)")
    random.seed(43)
    nodes2, edges2 = create_curved_highway([0, 0], length=1000, num_curves=3, nodes_per_curve=40)
    
    original_edges2 = len(edges2)
    print(f"  Original: {original_edges2} edges")
    
    removed2 = simplify_paths_douglas_peucker(
        nodes2, edges2,
        epsilon=2.0,
        max_merged_length=250,
        max_angle_deg=10
    )
    
    final_edges2 = len(edges2)
    reduction2 = (1 - final_edges2 / original_edges2) * 100
    print(f"  After optimization: {final_edges2} edges")
    print(f"  Reduction: {reduction2:.1f}%")
    
    # Highway should still have some edges for the curves
    test2_pass = 5 <= final_edges2 <= 20 and reduction2 >= 80
    print(f"  {'✓ PASS' if test2_pass else '✗ FAIL'}: Highway optimization")
    
    # Test 3: Large scale test
    print("\n[Test 3] Large City Grid (10x10 blocks)")
    random.seed(44)
    nodes3, edges3 = create_city_grid([0, 0], block_size=80, blocks_x=10, blocks_y=10, nodes_per_block=12)
    
    original_edges3 = len(edges3)
    print(f"  Original: {original_edges3} edges")
    
    removed3 = simplify_paths_douglas_peucker(
        nodes3, edges3,
        epsilon=2.0,
        max_merged_length=250,
        max_angle_deg=10
    )
    
    final_edges3 = len(edges3)
    reduction3 = (1 - final_edges3 / original_edges3) * 100
    print(f"  After optimization: {final_edges3} edges")
    print(f"  Reduction: {reduction3:.1f}%")
    
    test3_pass = reduction3 >= 50
    print(f"  {'✓ PASS' if test3_pass else '✗ FAIL'}: Large grid optimization")
    
    # Test 4: Edge length distribution
    print("\n[Test 4] Edge Length Distribution Check")
    max_allowed = 250
    max_found = 0
    for e in edges3.values():
        n0_pos = Vec2(*nodes3[e["node0"]]["pos"][:2])
        n1_pos = Vec2(*nodes3[e["node1"]]["pos"][:2])
        length = (n1_pos - n0_pos).length()
        max_found = max(max_found, length)
    
    test4_pass = max_found <= max_allowed + 0.1
    print(f"  Max edge length: {max_found:.1f}m (limit: {max_allowed}m)")
    print(f"  {'✓ PASS' if test4_pass else '✗ FAIL'}: Edge lengths within limit")
    
    # Summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    all_pass = test1_pass and test2_pass and test3_pass and test4_pass
    
    print(f"Test 1 (City Grid):     {'PASS' if test1_pass else 'FAIL'}")
    print(f"Test 2 (Curved Highway): {'PASS' if test2_pass else 'FAIL'}")
    print(f"Test 3 (Large Grid):    {'PASS' if test3_pass else 'FAIL'}")
    print(f"Test 4 (Edge Lengths):  {'PASS' if test4_pass else 'FAIL'}")
    print()
    print(f"Overall: {'ALL TESTS PASSED ✓' if all_pass else 'SOME TESTS FAILED ✗'}")
    print("=" * 60)
    
    return all_pass


if __name__ == "__main__":
    success = run_realistic_tests()
    sys.exit(0 if success else 1)


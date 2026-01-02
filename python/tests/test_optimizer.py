"""
Tests for the Douglas-Peucker path simplification and optimizer.

These tests verify that:
1. The optimizer reduces edge count while maintaining road shape
2. Roads remain connected after optimization
3. Significant curves are preserved
4. The optimization is actually beneficial for TPF2 import
"""

import sys
import os
import math
import json
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from vec2 import Vec2
from optimize_edges import simplify_paths_douglas_peucker, optimize, split_long_edges
from graph_tools import create_graph


class TestResult:
    """Simple test result container."""
    def __init__(self, name):
        self.name = name
        self.passed = False
        self.message = ""
        self.details = {}
    
    def set_passed(self, message=""):
        self.passed = True
        self.message = message
    
    def set_failed(self, message):
        self.passed = False
        self.message = message
    
    def __str__(self):
        status = "✓ PASS" if self.passed else "✗ FAIL"
        return f"{status}: {self.name} - {self.message}"


def create_straight_road(start_pos, end_pos, num_nodes, road_type="residential"):
    """Create a straight road with many intermediate nodes (simulating OSM data)."""
    nodes = {}
    edges = {}
    
    start = Vec2(*start_pos)
    end = Vec2(*end_pos)
    
    for i in range(num_nodes):
        t = i / (num_nodes - 1)
        pos = start + (end - start) * t
        node_id = f"node_{i}"
        nodes[node_id] = {
            "pos": [pos.x, pos.y, 0],
            "way_start_to": [],
            "way_end_from": [],
            "way_within": [],
        }
    
    # Create edges between consecutive nodes
    for i in range(num_nodes - 1):
        edge_id = f"way1_{i}"
        n0 = f"node_{i}"
        n1 = f"node_{i+1}"
        edges[edge_id] = {
            "id": edge_id,
            "node0": n0,
            "node1": n1,
            "street": {"type": road_type, "speed": 50},
        }
        # Update node connectivity
        if i == 0:
            nodes[n0]["way_start_to"].append(n1)
        elif i == num_nodes - 2:
            nodes[n1]["way_end_from"].append(n0)
        else:
            nodes[n0]["way_within"].append([nodes[f"node_{i-1}"] if i > 0 else None, n1])
    
    return nodes, edges


def create_curved_road(center, radius, start_angle, end_angle, num_nodes, road_type="residential"):
    """Create a curved road (arc) with many intermediate nodes."""
    nodes = {}
    edges = {}
    
    for i in range(num_nodes):
        t = i / (num_nodes - 1)
        angle = start_angle + (end_angle - start_angle) * t
        x = center[0] + radius * math.cos(angle)
        y = center[1] + radius * math.sin(angle)
        node_id = f"node_{i}"
        nodes[node_id] = {
            "pos": [x, y, 0],
            "way_start_to": [],
            "way_end_from": [],
            "way_within": [],
        }
    
    for i in range(num_nodes - 1):
        edge_id = f"way1_{i}"
        n0 = f"node_{i}"
        n1 = f"node_{i+1}"
        edges[edge_id] = {
            "id": edge_id,
            "node0": n0,
            "node1": n1,
            "street": {"type": road_type, "speed": 50},
        }
        if i == 0:
            nodes[n0]["way_start_to"].append(n1)
        elif i == num_nodes - 2:
            nodes[n1]["way_end_from"].append(n0)
    
    return nodes, edges


def create_intersection(center, arm_length, num_nodes_per_arm):
    """Create a 4-way intersection with arms."""
    nodes = {}
    edges = {}
    
    # Center node
    nodes["center"] = {
        "pos": [center[0], center[1], 0],
        "way_start_to": [],
        "way_end_from": [],
        "way_within": [],
    }
    
    directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    edge_counter = 0
    
    for arm_idx, (dx, dy) in enumerate(directions):
        for i in range(1, num_nodes_per_arm + 1):
            t = i / num_nodes_per_arm
            x = center[0] + dx * arm_length * t
            y = center[1] + dy * arm_length * t
            node_id = f"arm{arm_idx}_node_{i}"
            nodes[node_id] = {
                "pos": [x, y, 0],
                "way_start_to": [],
                "way_end_from": [],
                "way_within": [],
            }
        
        # Create edges from center outward
        prev_node = "center"
        for i in range(1, num_nodes_per_arm + 1):
            curr_node = f"arm{arm_idx}_node_{i}"
            edge_id = f"way{arm_idx}_{edge_counter}"
            edges[edge_id] = {
                "id": edge_id,
                "node0": prev_node,
                "node1": curr_node,
                "street": {"type": "residential", "speed": 50},
            }
            edge_counter += 1
            prev_node = curr_node
    
    return nodes, edges


def test_straight_road_simplification():
    """Test that a straight road with many nodes is simplified to minimal edges."""
    result = TestResult("Straight road simplification")
    
    # Create a 500m straight road with 100 nodes (every 5m, like OSM)
    nodes, edges = create_straight_road([0, 0], [500, 0], num_nodes=100)
    
    original_edge_count = len(edges)
    original_node_count = len(nodes)
    
    # Run Douglas-Peucker simplification
    removed = simplify_paths_douglas_peucker(
        nodes, edges, 
        epsilon=2.0,
        max_merged_length=250,
        max_angle_deg=10
    )
    
    final_edge_count = len(edges)
    active_nodes = sum(1 for n in nodes.values() if not n.get("removed"))
    
    result.details = {
        "original_edges": original_edge_count,
        "final_edges": final_edge_count,
        "reduction_percent": (1 - final_edge_count / original_edge_count) * 100,
        "removed_nodes": removed,
        "active_nodes": active_nodes,
    }
    
    # A 500m straight road should be reduced to ~2 edges (250m max each)
    if final_edge_count <= 3:
        result.set_passed(f"Reduced {original_edge_count} edges to {final_edge_count} ({result.details['reduction_percent']:.1f}% reduction)")
    else:
        result.set_failed(f"Expected ≤3 edges, got {final_edge_count}")
    
    return result


def test_curved_road_preserved():
    """Test that a curved road preserves its shape (nodes at curves are kept)."""
    result = TestResult("Curved road preservation")
    
    # Create a 90-degree arc with radius 100m, 50 nodes
    nodes, edges = create_curved_road(
        center=[0, 0],
        radius=100,
        start_angle=0,
        end_angle=math.pi / 2,
        num_nodes=50
    )
    
    original_edge_count = len(edges)
    
    # Run Douglas-Peucker with modest epsilon
    removed = simplify_paths_douglas_peucker(
        nodes, edges,
        epsilon=2.0,
        max_merged_length=250,
        max_angle_deg=10
    )
    
    final_edge_count = len(edges)
    
    result.details = {
        "original_edges": original_edge_count,
        "final_edges": final_edge_count,
        "reduction_percent": (1 - final_edge_count / original_edge_count) * 100,
        "removed_nodes": removed,
    }
    
    # A 90° curve should keep several nodes to maintain shape
    # But still reduce significantly (not as much as straight)
    # The arc length is ~157m, with 10° max angle, we expect ~9 segments minimum
    if 5 <= final_edge_count <= 20 and final_edge_count < original_edge_count * 0.5:
        result.set_passed(f"Reduced {original_edge_count} to {final_edge_count} edges while preserving curve")
    else:
        result.set_failed(f"Got {final_edge_count} edges (expected 5-20, less than {original_edge_count * 0.5:.0f})")
    
    return result


def test_intersection_preserved():
    """Test that intersection nodes are not removed."""
    result = TestResult("Intersection node preservation")
    
    nodes, edges = create_intersection(
        center=[0, 0],
        arm_length=100,
        num_nodes_per_arm=20
    )
    
    original_edge_count = len(edges)
    center_neighbors_before = sum(1 for e in edges.values() if e["node0"] == "center" or e["node1"] == "center")
    
    # Run simplification
    removed = simplify_paths_douglas_peucker(
        nodes, edges,
        epsilon=2.0,
        max_merged_length=250,
        max_angle_deg=10
    )
    
    # Center node should NOT be removed (it has degree 4)
    center_removed = nodes.get("center", {}).get("removed", False)
    
    # Count edges still connected to center
    center_neighbors_after = sum(1 for e in edges.values() if e["node0"] == "center" or e["node1"] == "center")
    
    result.details = {
        "original_edges": original_edge_count,
        "final_edges": len(edges),
        "center_removed": center_removed,
        "center_connections_before": center_neighbors_before,
        "center_connections_after": center_neighbors_after,
    }
    
    if not center_removed and center_neighbors_after == 4:
        result.set_passed(f"Intersection preserved with {center_neighbors_after} connections")
    else:
        result.set_failed(f"Center removed={center_removed}, connections={center_neighbors_after}")
    
    return result


def test_connectivity_maintained():
    """Test that after simplification, all endpoints remain connected."""
    result = TestResult("Connectivity maintained")
    
    # Create a simple path
    nodes, edges = create_straight_road([0, 0], [1000, 0], num_nodes=200)
    
    # Get start and end nodes
    start_node = "node_0"
    end_node = "node_199"
    
    start_pos_before = nodes[start_node]["pos"]
    end_pos_before = nodes[end_node]["pos"]
    
    # Run simplification
    removed = simplify_paths_douglas_peucker(nodes, edges, epsilon=2.0, max_merged_length=250, max_angle_deg=10)
    
    # Verify endpoints are NOT removed
    start_removed = nodes[start_node].get("removed", False)
    end_removed = nodes[end_node].get("removed", False)
    
    # Trace path from start to end
    def trace_path(start, end, edges, max_hops=100):
        current = start
        visited = {start}
        hops = 0
        while current != end and hops < max_hops:
            found_next = False
            for e in edges.values():
                if e["node0"] == current and e["node1"] not in visited:
                    visited.add(e["node1"])
                    current = e["node1"]
                    found_next = True
                    break
                elif e["node1"] == current and e["node0"] not in visited:
                    visited.add(e["node0"])
                    current = e["node0"]
                    found_next = True
                    break
            if not found_next:
                return False, hops
            hops += 1
        return current == end, hops
    
    connected, hops = trace_path(start_node, end_node, edges)
    
    result.details = {
        "start_removed": start_removed,
        "end_removed": end_removed,
        "path_connected": connected,
        "path_hops": hops,
        "final_edges": len(edges),
    }
    
    if not start_removed and not end_removed and connected:
        result.set_passed(f"Path maintained from start to end in {hops} hops")
    else:
        result.set_failed(f"Connectivity broken: start_removed={start_removed}, end_removed={end_removed}, connected={connected}")
    
    return result


def test_edge_length_limits():
    """Test that merged edges don't exceed max length."""
    result = TestResult("Edge length limits")
    
    # Create a 2km straight road
    nodes, edges = create_straight_road([0, 0], [2000, 0], num_nodes=400)
    
    max_merged_length = 250
    
    # Run simplification
    removed = simplify_paths_douglas_peucker(
        nodes, edges,
        epsilon=2.0,
        max_merged_length=max_merged_length,
        max_angle_deg=10
    )
    
    # Check all edge lengths
    max_edge_found = 0
    for e in edges.values():
        n0_pos = Vec2(*nodes[e["node0"]]["pos"][:2])
        n1_pos = Vec2(*nodes[e["node1"]]["pos"][:2])
        length = (n1_pos - n0_pos).length()
        max_edge_found = max(max_edge_found, length)
    
    result.details = {
        "max_allowed": max_merged_length,
        "max_found": max_edge_found,
        "final_edges": len(edges),
    }
    
    # Allow small tolerance for floating point
    if max_edge_found <= max_merged_length + 0.1:
        result.set_passed(f"Max edge length {max_edge_found:.1f}m (limit {max_merged_length}m)")
    else:
        result.set_failed(f"Edge too long: {max_edge_found:.1f}m exceeds {max_merged_length}m")
    
    return result


def test_angle_preservation():
    """Test that significant angle changes are preserved."""
    result = TestResult("Angle preservation")
    
    # Create a road with a 45-degree turn
    nodes = {
        "n0": {"pos": [0, 0, 0], "way_start_to": ["n1"], "way_end_from": [], "way_within": []},
        "n1": {"pos": [50, 0, 0], "way_start_to": [], "way_end_from": [], "way_within": []},
        "n2": {"pos": [100, 0, 0], "way_start_to": [], "way_end_from": [], "way_within": []},  # Turn point
        "n3": {"pos": [150, 50, 0], "way_start_to": [], "way_end_from": [], "way_within": []},  # After turn
        "n4": {"pos": [200, 100, 0], "way_start_to": [], "way_end_from": ["n3"], "way_within": []},
    }
    
    edges = {
        "e0": {"id": "e0", "node0": "n0", "node1": "n1", "street": {"type": "residential"}},
        "e1": {"id": "e1", "node0": "n1", "node1": "n2", "street": {"type": "residential"}},
        "e2": {"id": "e2", "node0": "n2", "node1": "n3", "street": {"type": "residential"}},
        "e3": {"id": "e3", "node0": "n3", "node1": "n4", "street": {"type": "residential"}},
    }
    
    # n2 is the turn point - should be preserved with 10° max angle
    removed = simplify_paths_douglas_peucker(
        nodes, edges,
        epsilon=2.0,
        max_merged_length=250,
        max_angle_deg=10  # 45° turn > 10°, so n2 should be kept
    )
    
    n2_removed = nodes["n2"].get("removed", False)
    
    result.details = {
        "turn_node_removed": n2_removed,
        "final_edges": len(edges),
        "removed_nodes": removed,
    }
    
    if not n2_removed:
        result.set_passed("45° turn node preserved with 10° threshold")
    else:
        result.set_failed("Turn node was incorrectly removed")
    
    return result


def run_all_tests():
    """Run all optimizer tests."""
    print("=" * 60)
    print("OSM Optimizer Tests")
    print("=" * 60)
    
    tests = [
        test_straight_road_simplification,
        test_curved_road_preserved,
        test_intersection_preserved,
        test_connectivity_maintained,
        test_edge_length_limits,
        test_angle_preservation,
    ]
    
    results = []
    passed = 0
    failed = 0
    
    for test_func in tests:
        try:
            result = test_func()
            results.append(result)
            print(result)
            if result.details:
                for k, v in result.details.items():
                    print(f"    {k}: {v}")
            if result.passed:
                passed += 1
            else:
                failed += 1
        except Exception as e:
            result = TestResult(test_func.__name__)
            result.set_failed(f"Exception: {e}")
            results.append(result)
            print(result)
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    
    return passed, failed, results


if __name__ == "__main__":
    passed, failed, _ = run_all_tests()
    sys.exit(0 if failed == 0 else 1)


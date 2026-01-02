import math
from math import pi
import numpy as np

from vec2 import Vec2
from cubic_spline import MyCubicSpline as CubicSpline, approx_length_arc
from graph_tools import create_graph, create_sub_graph, create_bridge_graph, create_ground_graph, \
    get_paths_to_simplify, is_node_removable, remove_node

# Try to import progress module for reporting
try:
    import progress
    _has_progress = True
except ImportError:
    _has_progress = False

def _report_step(message, percent=None):
    """Report optimization step progress."""
    if _has_progress:
        progress.step(message, percent=percent)


def simplify_paths_douglas_peucker(nodes, edges, epsilon=2.0, max_merged_length=250, max_angle_deg=10):
    """
    Aggressively simplify paths using a Douglas-Peucker-like algorithm.
    
    This merges consecutive collinear edges into longer edges where possible,
    significantly reducing the total edge count while maintaining road shape.
    
    Args:
        nodes: Dict of node_id -> node_data
        edges: Dict of edge_id -> edge_data
        epsilon: Maximum perpendicular distance from straight line to allow merging (meters)
        max_merged_length: Maximum length of a merged edge (meters)
        max_angle_deg: Maximum angle change (degrees) to allow merging
    
    Returns:
        Number of nodes removed
    """
    from collections import defaultdict
    
    removed_count = 0
    max_angle_rad = max_angle_deg * pi / 180
    
    # Build adjacency graph: node_id -> list of (neighbor_id, edge_id, edge_data)
    adjacency = defaultdict(list)
    for edge_id, edge in edges.items():
        n0, n1 = edge["node0"], edge["node1"]
        adjacency[n0].append((n1, edge_id, edge))
        adjacency[n1].append((n0, edge_id, edge))
    
    # Find nodes that can be removed:
    # - Degree 2 (exactly 2 neighbors)
    # - Both neighbors have same edge type (both street or both track)
    # - The angle change is small
    # - Removing wouldn't create an edge that's too long
    
    def get_pos(node_id):
        pos = nodes[node_id]["pos"]
        return Vec2(pos[0], pos[1])
    
    def point_to_line_distance(point, line_start, line_end):
        """Calculate perpendicular distance from point to line segment."""
        line_vec = line_end - line_start
        line_len = line_vec.length()
        if line_len < 0.001:
            return (point - line_start).length()
        # Normalize
        line_unit = Vec2(line_vec.x / line_len, line_vec.y / line_len)
        # Vector from line start to point
        point_vec = point - line_start
        # Project onto line
        proj_length = point_vec.x * line_unit.x + point_vec.y * line_unit.y
        # Perpendicular distance
        perp = Vec2(point_vec.x - proj_length * line_unit.x, 
                   point_vec.y - proj_length * line_unit.y)
        return perp.length()
    
    def get_angle(v1, v2):
        """Get angle between two vectors in radians."""
        len1 = v1.length()
        len2 = v2.length()
        if len1 < 0.001 or len2 < 0.001:
            return 0
        dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2)
        dot = max(-1, min(1, dot))  # Clamp for numerical stability
        return math.acos(dot)
    
    def edges_compatible(e1, e2):
        """Check if two edges have compatible types for merging."""
        # Both must be same type (street or track)
        if bool(e1.get("street")) != bool(e2.get("street")):
            return False
        if bool(e1.get("track")) != bool(e2.get("track")):
            return False
        # For streets, check if they have the same highway type
        if e1.get("street") and e2.get("street"):
            if e1["street"].get("type") != e2["street"].get("type"):
                return False
        # For tracks, check if they have the same railway type
        if e1.get("track") and e2.get("track"):
            if e1["track"].get("type") != e2["track"].get("type"):
                return False
        return True
    
    # Process nodes in multiple passes until no more can be removed
    nodes_to_check = set(n for n in nodes.keys() if not nodes[n].get("removed"))
    
    while True:
        removed_this_pass = 0
        
        for node_id in list(nodes_to_check):
            if node_id not in adjacency:
                continue
            
            neighbors = adjacency[node_id]
            
            # Skip if not degree 2
            if len(neighbors) != 2:
                continue
            
            # Get the two neighbors and their edges
            (n1, e1_id, e1), (n2, e2_id, e2) = neighbors
            
            # Skip if node is marked as important (intersection, signal, etc.)
            node_data = nodes.get(node_id, {})
            if node_data.get("signal") or node_data.get("switch"):
                continue
            
            # Skip if edges are not compatible
            if not edges_compatible(e1, e2):
                continue
            
            # Calculate geometry
            p0 = get_pos(n1)
            p1 = get_pos(node_id)
            p2 = get_pos(n2)
            
            # Check angle
            v1 = p1 - p0
            v2 = p2 - p1
            angle = get_angle(v1, v2)
            if angle > max_angle_rad:
                continue
            
            # Check distance from node to the straight line between neighbors
            dist = point_to_line_distance(p1, p0, p2)
            if dist > epsilon:
                continue
            
            # Check merged length
            merged_length = (p2 - p0).length()
            if merged_length > max_merged_length:
                continue
            
            # This node can be removed!
            # Create new merged edge
            new_edge_id = f"{e1_id}_merged_{e2_id}"
            
            # Copy edge properties from the longer original edge
            if (p1 - p0).length() > (p2 - p1).length():
                new_edge = e1.copy()
            else:
                new_edge = e2.copy()
            
            new_edge["node0"] = n1
            new_edge["node1"] = n2
            new_edge["merged"] = True
            
            # Remove old edges
            if e1_id in edges:
                del edges[e1_id]
            if e2_id in edges:
                del edges[e2_id]
            
            # Add new edge
            edges[new_edge_id] = new_edge
            
            # Update adjacency
            # Remove node_id from neighbors' lists
            adjacency[n1] = [(n, eid, e) for (n, eid, e) in adjacency[n1] if n != node_id]
            adjacency[n2] = [(n, eid, e) for (n, eid, e) in adjacency[n2] if n != node_id]
            
            # Add new connection
            adjacency[n1].append((n2, new_edge_id, new_edge))
            adjacency[n2].append((n1, new_edge_id, new_edge))
            
            # Remove node from adjacency
            del adjacency[node_id]
            
            # Mark node as removed
            nodes[node_id]["removed"] = True
            
            removed_count += 1
            removed_this_pass += 1
        
        if removed_this_pass == 0:
            break
        
        print(f"  Pass complete: removed {removed_this_pass} nodes")
    
    return removed_count


def optimize(data):
    # Total edge count for progress estimation
    total_edges = len(data.get("edges", {}))
    _report_step(f"Starting optimization of {total_edges:,} edges...", percent=50)
    
    # 0. First, aggressively simplify paths using Douglas-Peucker algorithm
    # This merges collinear nodes early, before any other processing
    print("=" * 16 + " Douglas-Peucker Path Simplification " + "=" * 16)
    _report_step("Simplifying paths (Douglas-Peucker)...", percent=50)
    simplified_count = simplify_paths_douglas_peucker(data["nodes"], data["edges"], 
                                                       epsilon=2.0,  # Allow 2m deviation from straight line
                                                       max_merged_length=250,  # Max merged edge length
                                                       max_angle_deg=10)  # Max angle change to merge
    print(f"Douglas-Peucker: Removed {simplified_count} redundant nodes")
    
    # 1. Avoid very long edges (can cut through terrain, and affects curve splines negatively)
    # Increased limits since we now have better simplification
    print("=" * 16 + " Split long Edges " + "=" * 16)
    _report_step("Splitting long edges...", percent=51)
    split_long_edges(data["nodes"], data["edges"], 120, etype="street")  # Was 80, now 120
    split_long_edges(data["nodes"], data["edges"], 200, etype="track")   # Was 150, now 200

    # 2. Create graph and obtain paths
    print("=" * 16 + " Create Graphs " + "=" * 16)
    _report_step("Creating graph structures...", percent=53)
    g = create_graph(data["nodes"], data["edges"])
    gs = create_sub_graph(g, "STREET")
    print("Street: ", gs)
    gt = create_sub_graph(g, "TRACK")
    print("Track: ", gt)
    gb = create_bridge_graph(g)
    print("Bridge: ", gb)
    gg = create_ground_graph(g)  # complement of bridge graph
    print("Ground: ", gg)
    
    _report_step("Extracting paths to simplify...", percent=55)
    paths_track = list(get_paths_to_simplify(gt, maxangle=45, continue_through_crossings=True))
    paths_street = list(get_paths_to_simplify(gs, maxangle=30, continue_through_crossings=True))
    paths_bridge = list(get_paths_to_simplify(gb))
    paths_ground = list(get_paths_to_simplify(gg))  # paths end at endpoints (degree!=2)
    data["paths"] = {
        "track": paths_track,
        "street": paths_street,
        "bridge": paths_bridge,
        "ground": paths_ground,
    }
    print(f"Track Paths: {len(paths_track)} , Av len: {np.array([len(p) for p in paths_track]).mean():.1f}")
    print(f"Street Paths: {len(paths_street)} , Av len: {np.array([len(p) for p in paths_street]).mean():.1f}")
    print(f"Bridge Paths: {len(paths_bridge)} , Av len: {np.array([len(p) for p in paths_bridge]).mean():.1f}")
    print(f"Ground Paths: {len(paths_ground)} , Av len: {np.array([len(p) for p in paths_ground]).mean():.1f}")
    
    _report_step(f"Found {len(paths_track):,} track paths, {len(paths_street):,} street paths", percent=56)

    # 3. Remove Nodes to improve curve geometry and reduce number of segments
    print("=" * 16 + " Remove Nodes with high curvature " + "=" * 16)
    _report_step("Removing high-curvature nodes from tracks...", percent=57)
    remove_nodes_curvature(paths_track, g, gt, gs, data["nodes"], data["edges"], maxlength=175, maxangle=30)
    _report_step("Removing high-curvature nodes from streets...", percent=59)
    remove_nodes_curvature(paths_street, g, gt, gs, data["nodes"], data["edges"], maxlength=100, maxangle=25)
    
    print("=" * 16 + " Remove unnecessary short Edges " + "=" * 16)
    _report_step("Removing unnecessary short edges from tracks...", percent=61)
    remove_short_unnecessary_edges(paths_track, g, gt, gs, data["nodes"], data["edges"], maxlength=100, maxangle=35)
    _report_step("Removing unnecessary short edges from streets...", percent=63)
    remove_short_unnecessary_edges(paths_street, g, gt, gs, data["nodes"], data["edges"], maxlength=60, maxangle=30)
    
    print("=" * 16 + " Remove short Edges " + "=" * 16)
    _report_step("Removing very short edges...", percent=65)
    remove_short_edges(paths_track, g, gt, gs, data["nodes"], data["edges"], 10, maxangle=15)
    remove_short_edges(paths_street, g, gt, gs, data["nodes"], data["edges"], 3, maxangle=15)

    # 4. Calculate tangents for curved edge paths
    print("=" * 16 + " Calculate Tangents " + "=" * 16)
    _report_step("Calculating curve tangents for tracks...", percent=66)
    add_curve_tangents(paths_track, g, method="natural", maxangle=999, warnangle=35)
    _report_step("Calculating curve tangents for streets...", percent=68)
    add_curve_tangents(paths_street, g, method="natural", maxangle=999, warnangle=50)
    add_path_info_to_nodes(paths_track, data["nodes"], "track")
    add_path_info_to_nodes(paths_street, data["nodes"], "street")
    
    print("=" * 16 + " Align Tangents of Switches " + "=" * 16)
    _report_step("Aligning switch tangents...", percent=69)
    align_switches_tangents(g, gt, data["nodes"], maxangle=40)

    # 5. Add signal information to edges
    print("=" * 16 + " Adjust Signals " + "=" * 16)
    _report_step("Adjusting signal positions...", percent=70)
    adjust_signals(data["nodes"], g)

    adjust_other_paths(paths_bridge, data["nodes"])
    adjust_other_paths(paths_ground, data["nodes"])
    
    final_edges = len(data.get("edges", {}))
    _report_step(f"Optimization complete: {total_edges:,} -> {final_edges:,} edges", percent=70)

    # remove unnecessary data
    for nid, node in data["nodes"].items():
        node["way_start_to"] = None
        node["way_end_from"] = None
        node["way_within"] = None


def split_long_edges(nodes, edges, max_edge_length, etype=None):
    add_edges = {}  # add later, RuntimeError: dictionary changed size during iteration
    remove_edges = []
    for eid, edge in edges.items():
        if etype and not edge.get(etype):
            continue
        n0 = edge["node0"]
        n1 = edge["node1"]
        p0 = Vec2(nodes[n0]["pos"])
        p1 = Vec2(nodes[n1]["pos"])
        length = (p1 - p0).length()
        if length > max_edge_length:
            print(f"Split Edge({n0},{n1}) is long ({length:.4g})")
            remove_edges.append(eid)
            nodes[n0]["long_edge"] = True
            nodes[n1]["long_edge"] = True
            num_seg = math.ceil(length / max_edge_length)
            lastnode = n0
            for i in range(1, num_seg + 1):
                if i < num_seg:
                    p = p0 + (p1 - p0) * i / num_seg  # linear interpolation
                    newnodekey = f"{eid}_n{i}"
                    newnode = {"pos": p.toArray(), "added_long": True}
                    assert newnodekey not in nodes
                    nodes[newnodekey] = newnode
                else:
                    newnodekey = n1
                newedge = edge.copy()
                newedge["node0"] = lastnode
                newedge["node1"] = newnodekey
                newedge["long_edge"] = True
                newedgekey = f"{eid}_{i}"
                assert newedgekey not in edges
                assert newedgekey not in add_edges
                add_edges[newedgekey] = newedge
                if i == 1:
                    for k, (n_pre, n_suc) in enumerate(nodes[n0]["way_within"]):
                        if n1 == n_suc:
                            nodes[n0]["way_within"][k][1] = newnodekey
                    for k, ns in enumerate(nodes[n0]["way_start_to"]):
                        if n1 == ns:
                            nodes[n0]["way_start_to"][k] = newnodekey
                if i == num_seg:
                    for k, (n_pre, n_suc) in enumerate(nodes[n1]["way_within"]):
                        if n0 == n_pre:
                            nodes[n1]["way_within"][k][0] = lastnode
                    for k, ne in enumerate(nodes[n1]["way_end_from"]):
                        if n0 == ne:
                            nodes[n1]["way_end_from"][k] = lastnode
                lastnode = newnodekey
    edges.update(add_edges)
    for key in remove_edges:
        edges.pop(key)


def remove_short_edges(paths, g, gt, gs, nodes, edges, min_edge_length, maxangle):
    for path in paths:  # node_ids
        skip_edges = set()
        while len(path) > 3:
            y = [g.nodes[n]["pos"] for n in path]
            lens = [math.inf if (path[i], path[i + 1]) in skip_edges else (y[i + 1] - y[i]).length() for i in
                    range(len(path) - 1)]
            idx = min(range(len(lens)), key=lambda x: lens[x])  # argmin, find shortest edge
            if lens[idx] > min_edge_length:
                break
            edge = g.edges[path[idx], path[idx + 1]]["data"]
            if edge["track"] and edge["track"]["type"] not in {"rail", "light_rail", "subway"}:
                break
            if edge["street"] and edge["street"]["type"] not in {"motorway", "trunk", "motorway_link", "trunk_link",
                                                                 "primary", "secondary", "tertiary", "residential",
                                                                 "unclassified", "service"}:
                break
            if idx == 0:
                succ = True
            elif idx == len(lens) - 1:
                succ = False
            # try to find the better side of the edge to adjust
            elif not is_node_removable(g, gt, gs, path[idx], exclude_bridges=True):
                succ = True
            elif not is_node_removable(g, gt, gs, path[idx + 1], exclude_bridges=True):
                succ = False
            elif lens[idx + 1] < lens[idx - 1]:  # remove node at side of shorter edge
                succ = True
            else:
                succ = False
            if succ:  # replace with successor
                node_rem = path[idx + 1]
                node_keep = path[idx]
                node_correct = path[idx + 2]
                t01 = y[idx + 1] - y[idx]
                t12 = y[idx + 2] - y[idx + 1]
            else:  # replace with predecessor
                node_rem = path[idx]
                node_keep = path[idx + 1]
                node_correct = path[idx - 1]
                t01 = y[idx] - y[idx - 1]
                t12 = y[idx + 1] - y[idx]
            if is_node_removable(g, gt, gs, node_rem, exclude_bridges=True, printt=False) \
                    and Vec2.angle(t01, t12) < maxangle / 180 * pi:
                print(f"Remove Edge({path[idx]},{path[idx + 1]}) is short ({lens[idx]:.4g})")
                if not remove_node(g, nodes, edges, path, node_rem, node_keep, node_correct):
                    break
            else:
                skip_edges.add((path[idx], path[idx + 1]))
                # print("Cannot remove", node_rem)


def remove_nodes_curvature(paths, g, gt, gs, nodes, edges, maxlength, maxangle):
    for path in paths:
        skip_nodes = set(path[i] for i in range(1, len(path) - 1)
                         if not is_node_removable(g, gt, gs, path[i]))
        maxk = 1
        while len(path) > 3 and maxk > 0:
            c = get_spline(g, path)
            x, y = c.x, c.y
            ks = [[i, c.maxk_at_node(i)] for i in range(1, len(path) - 1) if path[i] not in skip_nodes]
            if len(ks) == 0:
                break
            while True:
                kidx = max(range(len(ks)), key=lambda j: ks[j][1])  # get node with largest curvature
                (idx, maxk) = ks[kidx]
                if maxk <= 0:
                    break
                node, node_pre, node_suc = path[idx], path[idx - 1], path[idx + 1]
                edge = g.edges[node_pre, node]["data"]
                minradius = expected_minradius(edge)
                # if nodes[node].get("added_long"):  # nodes added by split edges are expected to create straights
                #     minradius=max(minradius * 2,100)
                if maxk > 1 / minradius:
                    t01 = y[idx] - y[idx - 1]
                    t12 = y[idx + 1] - y[idx]
                    l01 = t01.length()
                    l12 = t12.length()
                    if Vec2.angle(t01, t12) > maxangle / 180 * pi:
                        pass  # print(f"Dont remove, Angle too high {Vec2.angle(t01, t12)*180/pi:.3f}")
                    elif l01 + l12 > maxlength:
                        print(f"Dont remove {node} with Rmin={1 / maxk:.4g}, Edge would be too long {l01 + l12:.3g}")
                    else:
                        print(f"Remove Node({node}) CURVE "
                              f"{edge['track'] and 'track(' + edge['track']['type'] or 'street(' + edge['street']['type']},"
                              f"{(edge['track'] or edge['street']).get('speed') or ''}) too narrow Rmin={1 / maxk:.4g}")
                        # use data from longer edge
                        node_data, node_other = (node_pre, node_suc) if l01 > l12 else (node_suc, node_pre)
                        if not remove_node(g, nodes, edges, path, node, node_other, node_data):
                            skip_nodes.add(node)
                        break
                ks[kidx][1] = -1  # ignore for the rest of this loop
                skip_nodes.add(node)


def remove_short_unnecessary_edges(paths, g, gt, gs, nodes, edges, maxlength, maxangle):
    for path in paths:
        for node in path:
            assert not nodes[node].get("removed"), node
        skip_nodes = set(path[i] for i in range(1, len(path) - 1)
                         if not is_node_removable(g, gt, gs, path[i]))
        segdelnodes = [[] for _ in range(len(path) - 1)]  # for the dist condition, use to find segement to test
        while len(path) > 3:
            c = get_spline(g, path)
            x, y = c.x, c.y
            trynodes = [i for i in range(1, len(path) - 1) if path[i] not in skip_nodes]
            if len(trynodes) == 0:
                break
            for idx in trynodes:
                node = path[idx]
                t01 = y[idx] - y[idx - 1]
                t12 = y[idx + 1] - y[idx]
                l01 = t01.length()
                l12 = t12.length()
                assert l01 > 0
                assert l12 > 0
                if l01 + l12 < maxlength \
                        and c.viabs[idx] > 0 \
                        and Vec2.angle(c.vi[idx], t01) < maxangle / 180 * pi \
                        and Vec2.angle(c.vi[idx], t12) < maxangle / 180 * pi \
                        and Vec2.angle(t01, t12) < maxangle / 180 * pi:
                    # spline curve without this node
                    cwo = get_spline(g, [n for i, n in enumerate(path) if i != idx])
                    dist = cwo.dist_to_point(y[idx], idx - 1, idx)  # distance to the removed node
                    # check distance of already removed nodes
                    distothers = max((cwo.dist_to_point(Vec2(nodes[n]["pos"]), i if i < idx else i - 1, i + 1 if
                    i < idx else i) for i, seg in enumerate(segdelnodes) for n in seg), default=-1)
                    if idx == 1 and Vec2.angle(cwo.vi[0], t01) > 10 / 180 * pi:  # try preserve orig start direction
                        pass
                    elif idx == len(path) - 2 and Vec2.angle(cwo.vi[-1], t12) > 10 / 180 * pi:
                        pass
                    elif 1 < idx < len(path) - 2 and (Vec2.angle(cwo.y[idx - 1] - cwo.y[idx - 2],
                                                                 cwo.y[idx] - cwo.y[idx - 1]) > maxangle / 180 * pi
                                                      or Vec2.angle(cwo.y[idx + 1] - cwo.y[idx],
                                                                    cwo.y[idx] - cwo.y[idx - 1]) > maxangle / 180 * pi):
                        pass
                    elif dist < 1.8 and distothers < 2.2:
                        print(f"Remove Node({node}) errdist={dist:.3g} distoth={distothers:.3g} "
                              f"new edge len {l01 + l12:.4g}= {l01:.4g} + {l12:.4g}")
                        node_data, node_other = (path[idx - 1], path[idx + 1]) if l01 > l12 else (
                            path[idx + 1], path[idx - 1])
                        if remove_node(g, nodes, edges, path, node, node_other, node_data):
                            segdelnodes[idx - 1].append(node)
                            segdelnodes[idx - 1].extend(segdelnodes[idx])
                            segdelnodes.pop(idx)
                        else:
                            skip_nodes.add(node)
                        break
                skip_nodes.add(node)


def expected_minradius(edge):
    r = 1
    if edge["track"]:
        if edge["track"]["type"] == "rail":
            r = 100
            if edge["track"]["speed"]:
                r = expected_radius_speed(edge["track"]["speed"] / 3.6) / 1.1  # tolerance
        elif edge["track"]["type"] in {"light_rail", "subway"}:
            r = 50
        elif edge["track"]["type"] in {"tram", "narrow_gauge", "disused"}:
            r = 10
    if edge["street"]:
        if edge["street"]["type"] in {"motorway", "trunk"}:
            r = 40
        elif edge["street"]["type"] in {"motorway_link", "trunk_link", "primary", "secondary", "tertiary", }:
            r = 5
    return r


def expected_radius_speed(speed):
    # TPF2 tracks speedCoeffs say: curve speed limit [m/s] = a * (radius + b) ^ c
    # -> radius = (speed/a)^(1/c)-b
    a, b, c = 1.36, -40, 0.5  # from WernerK "Realistic Track Speed" Mod
    return (speed / a) ** (1 / c) - b


def get_spline(g, path, method="natural"):
    y = [g.nodes[n]["pos"].toArray() for n in path]
    return CubicSpline(y, bc_method=method)


def add_curve_tangents(paths, g, method, maxangle, warnangle):
    for path in paths:
        for n0, n1 in zip(path[:-1], path[1:]):
            e = g.edges[n0, n1]["data"]
            if e["node0"] == n1:
                e["node0"], e["node1"] = e["node1"], e["node0"]  # align edge in same direction as path
                e["nodes_reversed"] = True
        if method in {"natural"}:
            c = get_spline(g, path, method="natural")
            x, y = c.x, c.y
            cerr = c.error_spline()  # curve deviation from straight line - not considering removed nodes!
            for i in range(0, len(path) - 1):
                minv = min(c.vabs(t) for t in np.linspace(x[i], x[i + 1], 10))
                if minv < 0.1:
                    print(f"WARNING Edge({path[i]},{path[i + 1]}) low spline speed {minv}")
            cubic_tangs = [c.vi[i] if c.viabs[i] > 0 else None for i in range(1, len(path) - 1)]
            if not g.nodes[path[0]]["data"].get("long_edge") and c.viabs[0] > 0:  # path start + end
                g.edges[path[0], path[1]]["data"]["tangent0"] = (c.vi[0] * (x[1] - x[0])).toArray()
            if not g.nodes[path[-1]]["data"].get("long_edge") and c.viabs[-1] > 0:
                g.edges[path[-1], path[-2]]["data"]["tangent1"] = (c.vi[-1] * (x[-1] - x[-2])).toArray()
            for angle in [
                Vec2.angle(c.vi[0], y[1] - y[0]),
                Vec2.angle(c.vi[-1], y[-1] - y[-2])]:
                if angle > warnangle / 180 * pi:
                    print(f"WARNING start/end node {path[0]} Diff tang angle: {angle * 180 / pi:.3f}")
        for i, n0, n1, n2 in zip(range(1, len(path) - 1), path[:-2], path[1:-1], path[2:]):
            p0 = g.nodes[n0]["pos"]
            p1 = g.nodes[n1]["pos"]
            p2 = g.nodes[n2]["pos"]
            t01 = p1 - p0
            t12 = p2 - p1
            l01 = t01.length()
            l12 = t12.length()
            e01 = g.edges[n0, n1]["data"]
            e12 = g.edges[n1, n2]["data"]
            etype = (e01['street'] and 'street(' + e01['street']['type'] or 'track(' + e01['track']['type']) + ")"
            if Vec2.angle(t01, t12) < maxangle / 180 * pi:
                if method == "finite_difference":  # https://en.wikipedia.org/wiki/Cubic_Hermite_spline
                    tang = (t01.normalize() + t12.normalize()) / 2
                elif method == "Catmull–Rom":
                    tang = (p2 - p0) / 2
                elif method == "natural":
                    tang = cubic_tangs[i - 1]
                    if not tang:
                        continue
                    if not .7 < tang.length() < 1.5:
                        print(f"WARNING: at {n1} spline tang length {tang}")
                    if e01.get("long_edge") and e12.get("long_edge"):
                        if Vec2.angle(t01, t12) > 15 / 180 * pi:
                            if e01['street']:
                                continue  # skip to use straight tangent
                            else:
                                print(f"WARNING: High Angle {Vec2.angle(t01, t12) * 180 / pi:.3f} "
                                      f"between long edges {n0},{n1},{n2} {etype}")
                        # use Catmull–Rom tangent; is straight for splitted long edge to avoid curves from spline
                        tang = (p2 - p0).normalize()
                    elif e01.get("long_edge"):
                        tang = t01.normalize()  # enforce tangent from long edge
                    elif e12.get("long_edge"):
                        tang = t12.normalize()
                    else:
                        maxerr = cerr.maxerr_at_node(i)
                        # cant make this smaller because of node reductions; heuristic: adjacent short and long segments often create bad splines
                        if e01['street'] and maxerr > 8 or e01['track'] and maxerr > 15 or \
                                (e01['street'] and maxerr > 5 and not e01['street']['type'].endswith("_link") and
                                 max(l01, l12) / min(l01, l12) > 4):
                            print(f"WARNING Spline maxerr: {maxerr:.3f} at {n1} {etype}")
                            if e01['street']:
                                continue
                else:
                    raise Exception("Unknown tangent method: " + method)
                for angle in [Vec2.angle(tang, t01), Vec2.angle(tang, t12)]:
                    if angle > warnangle / 180 * pi:
                        print(f"WARNING Diff tang angle: {angle * 180 / pi:.3f} at {n1} {etype}")
                if method in {"finite_difference", "Catmull–Rom"}:
                    e01["tangent1"] = tang.normalize(approx_length_arc(l01, Vec2.angle(t01, tang))).toArray()
                    e12["tangent0"] = tang.normalize(approx_length_arc(l12, Vec2.angle(t12, tang))).toArray()
                elif method in {"natural"}:  # cubic spline was initialized with x (linear length)
                    e01["tangent1"] = (tang * l01).toArray()
                    e12["tangent0"] = (tang * l12).toArray()
            else:
                print(f"Edges({n0},{n1},{n2}) above maxangle {Vec2.angle(t01, t12) * 180 / pi}")


def add_path_info_to_nodes(paths, nodes, prefix):
    for path in paths:
        for n0, n1, n2 in zip(path[:-2], path[1:-1], path[2:]):
            if f"path_{prefix}" not in nodes[n1]:
                nodes[n1][f"path_{prefix}"] = []
            nodes[n1][f"path_{prefix}"].append([n0, n2])


def align_switches_tangents(g, gt, nodes, maxangle):
    switches = set(n for n in gt.nodes if gt.degree(n) == 3)
    for zwitch in switches:
        if "path_track" in nodes[zwitch]:
            path = nodes[zwitch]["path_track"][0]
            if "tangent1" not in g.edges[zwitch, path[0]]["data"] or "tangent0" not in g.edges[zwitch, path[1]]["data"]:
                continue
            assert Vec2.angle(Vec2(g.edges[zwitch, path[0]]["data"]["tangent1"]),
                              Vec2(g.edges[zwitch, path[1]]["data"]["tangent0"])) < 0.01, zwitch
            tang = Vec2(g.edges[zwitch, path[0]]["data"]["tangent1"]).normalize()
            # cant use gt, is outdated after node removal
            neighbors = {n for n in g.neighbors(zwitch) if g.edges[zwitch, n]["data"]["track"]}
            assert len(neighbors) == 3, zwitch
            third_node = (neighbors - set(path)).pop()
            assert g.has_edge(zwitch, third_node), f"no third edge {zwitch}"
            sw_edge = g.edges[zwitch, third_node]
            if sw_edge["data"]["node0"] == zwitch:
                tangent01 = "tangent0"
            else:
                assert sw_edge["data"]["node1"] == zwitch
                tangent01 = "tangent1"
            if tangent01 not in sw_edge["data"]:  # no path on the switch side, e.g. next node is another switch
                sw_tang = g.nodes[sw_edge["data"]["node1"]]["pos"] - g.nodes[sw_edge["data"]["node0"]]["pos"]
            else:
                sw_tang = Vec2(sw_edge["data"][tangent01])
            angle = Vec2.angle(tang, sw_tang)
            if angle * 180 / pi < maxangle:
                print(
                    f"Align tangents of Path({zwitch},{path[1] if tangent01 == 'tangent0' else path[0]}) and Switch({zwitch},{third_node})")
                sw_edge["data"][tangent01] = tang.normalize(sw_tang.length()).toArray()
            elif angle * 180 / pi > 180 - maxangle:
                print(
                    f"Align tangents of Path({zwitch},{path[1] if tangent01 == 'tangent1' else path[0]}) and Switch({zwitch},{third_node})")
                sw_edge["data"][tangent01] = (-tang).normalize(sw_tang.length()).toArray()
            else:
                print(f"Angle of switch {zwitch} too large: {angle * 180 / pi}")
        else:
            pass  # TODO align tangents of different ways heuristacally


def adjust_signals(nodes, g):
    for nid, node in nodes.items():
        if node.get("signal") and not node.get("removed"):
            if "path_track" in node:
                if len(node["path_track"]) == 1:  # assume 1 path only
                    edge = g.edges[nid, node["path_track"][0][0]]  # predecessor
                    # place signal on edge before because of Signal Distance and so that signals are right in front of poles
                    if edge["data"].get("nodes_reversed"):
                        node["signal"]["direction_backward"] = not node["signal"]["direction_backward"]
                    if node["signal"]["direction_backward"]:  # need to place on edge after, before pole
                        edge = g.edges[nid, node["path_track"][0][1]]  # successor
                    edge["data"]["objects"] = {"signal": node["signal"]}
                    node["signal"] = False
                else:
                    print("WARNING: signal on more than 1 path", nid, node)
            else:
                print(f"Node {nid} signal but no path info")


def adjust_other_paths(paths, nodes):
    for path in paths:  # remove deleted nodes
        for node in [n for n in path if nodes[n].get("removed")]:
            path.remove(node)

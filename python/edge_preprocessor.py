"""
Edge Preprocessor for OSM-TPF2 Importer

This module provides:
1. Filtering of out-of-bounds edges
2. Ordering edges by way continuity for efficient placement
3. Grouping edges for potential batching

The goal is to optimize edge processing before export to Lua.
"""

from collections import defaultdict


def filter_out_of_bounds(edges, nodes, stats=None):
    """
    Filter edges where BOTH nodes are out of bounds.
    Keeps edges that have at least one node within map bounds.
    
    Args:
        edges: List of edge dicts with node0, node1 keys
        nodes: Dict of node_id -> node data (with 'outofbounds' flag)
        stats: Optional dict to store statistics
    
    Returns:
        Filtered list of edges
    """
    if stats is None:
        stats = {}
    
    filtered = []
    skipped = 0
    kept_partial = 0  # Edges with one node out of bounds
    
    for edge in edges:
        node0_id = edge.get("node0")
        node1_id = edge.get("node1")
        
        node0 = nodes.get(node0_id, {})
        node1 = nodes.get(node1_id, {})
        
        node0_out = node0.get("outofbounds", False)
        node1_out = node1.get("outofbounds", False)
        
        if node0_out and node1_out:
            # Both nodes out of bounds - skip entirely
            skipped += 1
        else:
            if node0_out or node1_out:
                # One node out - mark edge but keep it
                edge["partial_bounds"] = True
                kept_partial += 1
            filtered.append(edge)
    
    stats["edges_filtered"] = skipped
    stats["edges_partial_bounds"] = kept_partial
    stats["edges_kept"] = len(filtered)
    
    print(f"[EdgePreprocessor] Filtered {skipped} fully out-of-bounds edges")
    print(f"[EdgePreprocessor] Kept {len(filtered)} edges ({kept_partial} with partial bounds)")
    
    return filtered


def order_by_continuity(edges, stats=None):
    """
    Order edges so that connected edges are processed consecutively.
    This improves node cache hit rate and enables potential batching.
    
    Algorithm:
    1. Group edges by their original OSM way ID (extracted from edge ID)
    2. Within each way, order edges by connectivity (node0 of edge N = node1 of edge N-1)
    3. Interleave ways based on priority (tracks first, then major roads, etc.)
    
    Args:
        edges: List of edge dicts with 'id', 'node0', 'node1' keys
        stats: Optional dict to store statistics
    
    Returns:
        Ordered list of edges
    """
    if stats is None:
        stats = {}
    
    # Group edges by way ID
    ways = defaultdict(list)
    for edge in edges:
        edge_id = edge.get("id", "")
        # Edge IDs are in format "wayId_segmentIndex"
        way_id = edge_id.rsplit("_", 1)[0] if "_" in edge_id else edge_id
        ways[way_id].append(edge)
    
    stats["ways_count"] = len(ways)
    
    # Order edges within each way by connectivity
    ordered_ways = {}
    for way_id, way_edges in ways.items():
        ordered_ways[way_id] = _order_way_edges(way_edges)
    
    # Flatten back to list, preserving way grouping
    # This keeps all edges of a way together, which helps with batching
    result = []
    
    # Separate tracks and streets for priority ordering
    track_ways = []
    street_ways = []
    
    for way_id, way_edges in ordered_ways.items():
        if way_edges and way_edges[0].get("track"):
            track_ways.append((way_id, way_edges))
        else:
            street_ways.append((way_id, way_edges))
    
    # Add tracks first (usually fewer, more important)
    for way_id, way_edges in track_ways:
        result.extend(way_edges)
    
    # Then streets
    for way_id, way_edges in street_ways:
        result.extend(way_edges)
    
    stats["track_ways"] = len(track_ways)
    stats["street_ways"] = len(street_ways)
    
    print(f"[EdgePreprocessor] Ordered {len(edges)} edges in {len(ways)} ways")
    print(f"[EdgePreprocessor] Track ways: {len(track_ways)}, Street ways: {len(street_ways)}")
    
    return result


def _order_way_edges(way_edges):
    """
    Order edges within a single way by connectivity.
    Creates a chain where node1 of edge N = node0 of edge N+1.
    """
    if len(way_edges) <= 1:
        return way_edges
    
    # Build node -> edge lookup
    edges_by_node0 = {}
    edges_by_node1 = {}
    
    for edge in way_edges:
        n0 = edge.get("node0")
        n1 = edge.get("node1")
        edges_by_node0[n0] = edge
        edges_by_node1[n1] = edge
    
    # Find starting edge (one whose node0 is not any edge's node1)
    start_edge = None
    for edge in way_edges:
        n0 = edge.get("node0")
        if n0 not in edges_by_node1:
            start_edge = edge
            break
    
    if not start_edge:
        # Circular way or complex graph - return as-is
        return way_edges
    
    # Build chain from start edge
    chain = [start_edge]
    used = {id(start_edge)}
    current_node = start_edge.get("node1")
    
    while len(chain) < len(way_edges):
        next_edge = edges_by_node0.get(current_node)
        if next_edge and id(next_edge) not in used:
            chain.append(next_edge)
            used.add(id(next_edge))
            current_node = next_edge.get("node1")
        else:
            break
    
    # If we didn't get all edges, append remaining
    if len(chain) < len(way_edges):
        for edge in way_edges:
            if id(edge) not in used:
                chain.append(edge)
    
    return chain


def order_for_batching(edges, stats=None):
    """
    Reorder edges to maximize batching potential.
    Instead of grouping by way, interleave edges from different ways
    so that consecutive edges are less likely to share nodes.
    
    Algorithm:
    1. Group edges by way (same as order_by_continuity)
    2. Order edges within each way by connectivity  
    3. Interleave: take first edge from each way, then second from each, etc.
    
    This creates an ordering where edges are more likely to be independent.
    """
    if stats is None:
        stats = {}
    
    # Group edges by way ID
    ways = defaultdict(list)
    for edge in edges:
        edge_id = edge.get("id", "")
        way_id = edge_id.rsplit("_", 1)[0] if "_" in edge_id else edge_id
        ways[way_id].append(edge)
    
    # Order edges within each way
    ordered_ways = {}
    for way_id, way_edges in ways.items():
        ordered_ways[way_id] = _order_way_edges(way_edges)
    
    # Interleave edges from all ways
    # This maximizes independence between consecutive edges
    result = []
    way_list = list(ordered_ways.values())
    max_len = max(len(w) for w in way_list) if way_list else 0
    
    for i in range(max_len):
        for way_edges in way_list:
            if i < len(way_edges):
                result.append(way_edges[i])
    
    stats["interleaved_ways"] = len(way_list)
    print(f"[EdgePreprocessor] Interleaved {len(edges)} edges from {len(way_list)} ways for batching")
    
    return result


def create_batch_groups(edges, max_batch_size=10, stats=None):
    """
    Group edges into batches that can be placed simultaneously.
    Edges in the same batch must NOT share any nodes.
    
    Args:
        edges: Ordered list of edges (from order_by_continuity)
        max_batch_size: Maximum edges per batch
        stats: Optional dict to store statistics
    
    Returns:
        List of lists, where each inner list is a batch of edges
    """
    if stats is None:
        stats = {}
    
    batches = []
    current_batch = []
    used_nodes = set()
    
    for edge in edges:
        n0 = edge.get("node0")
        n1 = edge.get("node1")
        
        # Check if this edge conflicts with current batch
        if n0 in used_nodes or n1 in used_nodes or len(current_batch) >= max_batch_size:
            # Start new batch
            if current_batch:
                batches.append(current_batch)
            current_batch = [edge]
            used_nodes = {n0, n1}
        else:
            # Add to current batch
            current_batch.append(edge)
            used_nodes.add(n0)
            used_nodes.add(n1)
    
    # Don't forget last batch
    if current_batch:
        batches.append(current_batch)
    
    # Calculate stats
    batch_sizes = [len(b) for b in batches]
    avg_batch_size = sum(batch_sizes) / len(batches) if batches else 0
    
    stats["batch_count"] = len(batches)
    stats["avg_batch_size"] = round(avg_batch_size, 2)
    stats["max_batch_size"] = max(batch_sizes) if batch_sizes else 0
    stats["single_edge_batches"] = sum(1 for b in batches if len(b) == 1)
    
    print(f"[EdgePreprocessor] Created {len(batches)} batches, avg size: {avg_batch_size:.1f}")
    print(f"[EdgePreprocessor] Single-edge batches: {stats['single_edge_batches']} ({100*stats['single_edge_batches']/max(1,len(batches)):.1f}%)")
    
    return batches


def group_edges_by_way(edges, stats=None):
    """
    Group edges by their original OSM way ID and order sequentially within each way.
    This creates "way groups" that can be batched together in TPF2.
    
    Args:
        edges: List of edge dicts
        stats: Optional dict to store statistics
    
    Returns:
        List of way groups, each group is a list of edges forming a connected chain
    """
    if stats is None:
        stats = {}
    
    # Group edges by way ID
    ways = defaultdict(list)
    for edge in edges:
        edge_id = edge.get("id", "")
        way_id = edge_id.rsplit("_", 1)[0] if "_" in edge_id else edge_id
        ways[way_id].append(edge)
    
    # Order edges within each way by connectivity
    way_groups = []
    total_edges = 0
    
    for way_id, way_edges in ways.items():
        ordered = _order_way_edges(way_edges)
        way_groups.append({
            "way_id": way_id,
            "edges": ordered,
            "edge_count": len(ordered),
        })
        total_edges += len(ordered)
    
    # Sort way groups by size (larger ways first for better progress visibility)
    way_groups.sort(key=lambda w: -w["edge_count"])
    
    stats["way_groups"] = len(way_groups)
    stats["avg_way_size"] = round(total_edges / max(1, len(way_groups)), 1)
    stats["max_way_size"] = max(w["edge_count"] for w in way_groups) if way_groups else 0
    
    # Analyze way sizes
    size_buckets = {"1-2": 0, "3-5": 0, "6-10": 0, "11-20": 0, "20+": 0}
    for wg in way_groups:
        size = wg["edge_count"]
        if size <= 2:
            size_buckets["1-2"] += 1
        elif size <= 5:
            size_buckets["3-5"] += 1
        elif size <= 10:
            size_buckets["6-10"] += 1
        elif size <= 20:
            size_buckets["11-20"] += 1
        else:
            size_buckets["20+"] += 1
    
    print(f"[EdgePreprocessor] Created {len(way_groups)} way groups")
    print(f"[EdgePreprocessor] Average way size: {stats['avg_way_size']} edges")
    print(f"[EdgePreprocessor] Way size distribution: {size_buckets}")
    
    return way_groups


def preprocess_edges(edges, nodes, enable_batching=False, stats=None):
    """
    Main preprocessing function. Applies all optimizations.
    
    Args:
        edges: List of edges from sort_edges.sort()
        nodes: Dict of nodes from convert_data
        enable_batching: If True, group edges by way for efficient batching
        stats: Optional dict to store statistics
    
    Returns:
        If enable_batching: (edges, way_groups)
        Else: edges
    """
    if stats is None:
        stats = {}
    
    print("\n" + "=" * 16 + " Edge Preprocessing " + "=" * 16)
    original_count = len(edges)
    
    # Step 1: Filter out-of-bounds
    edges = filter_out_of_bounds(edges, nodes, stats)
    
    # Step 2: Order by continuity (keeps ways together)
    edges = order_by_continuity(edges, stats)
    
    # Step 3: Group by way for batching (optional)
    way_groups = None
    if enable_batching:
        way_groups = group_edges_by_way(edges, stats)
    
    stats["original_count"] = original_count
    stats["final_count"] = len(edges)
    stats["reduction_percent"] = round(100 * (original_count - len(edges)) / max(1, original_count), 1)
    
    print(f"[EdgePreprocessor] Reduced from {original_count} to {len(edges)} edges ({stats['reduction_percent']}% reduction)")
    print("=" * 52 + "\n")
    
    if enable_batching:
        return edges, way_groups
    return edges


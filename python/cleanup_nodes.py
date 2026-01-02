"""
Cleanup unused nodes and edges from the converted data.

This module removes:
1. Nodes marked as "removed" (optimized away during conversion)
2. Nodes marked as "outofbounds" that are NOT referenced by any edge or area polygon
3. Orphan nodes that are not used by any edge, area, or path
4. Edges that connect to out-of-bounds nodes

This reduces the output file size and prevents confusion in the visualizer.
"""

import progress


def get_referenced_node_ids(data):
    """
    Find all node IDs that are actually referenced by edges, areas, or paths.
    
    Returns a set of node IDs that should NOT be removed.
    """
    referenced = set()
    
    # Nodes referenced by edges
    for edge in data.get("edges", []):
        if isinstance(edge, dict):
            if edge.get("node0"):
                referenced.add(str(edge["node0"]))
            if edge.get("node1"):
                referenced.add(str(edge["node1"]))
    
    # Nodes referenced by area polygons (forests, shrubs, grounds)
    areas = data.get("areas", {})
    for area_type in ["forests", "shrubs", "grounds"]:
        for area in areas.get(area_type, []):
            if isinstance(area, list):
                for node_id in area:
                    referenced.add(str(node_id))
            elif isinstance(area, dict):
                # Some areas might be stored as dicts with polygon field
                polygon = area.get("polygon", area.get("nodes", []))
                for node_id in polygon:
                    referenced.add(str(node_id))
    
    # Nodes referenced by paths are NOT added - they're intermediate calculation nodes
    # that don't need to be exported if not otherwise referenced
    
    return referenced


def cleanup_edges(data, remove_partial_bounds=True, stats=None):
    """
    Remove edges that connect to out-of-bounds nodes.
    
    Args:
        data: The converted OSM data dictionary
        remove_partial_bounds: If True, remove edges where ANY node is out of bounds
                              If False, only remove edges where BOTH nodes are out of bounds
        stats: Optional dict to collect cleanup statistics
    
    Returns:
        The modified data dictionary with problematic edges removed
    """
    if stats is None:
        stats = {}
    
    edges = data.get("edges", [])
    nodes = data.get("nodes", {})
    
    if not edges:
        return data
    
    original_count = len(edges)
    
    filtered_edges = []
    removed_both_out = 0
    removed_partial_out = 0
    
    for edge in edges:
        node0_id = edge.get("node0")
        node1_id = edge.get("node1")
        
        node0 = nodes.get(node0_id, {})
        node1 = nodes.get(node1_id, {})
        
        node0_out = node0.get("outofbounds", False)
        node1_out = node1.get("outofbounds", False)
        
        if node0_out and node1_out:
            # Both nodes out of bounds - always remove
            removed_both_out += 1
        elif remove_partial_bounds and (node0_out or node1_out):
            # One node out of bounds - remove if aggressive mode
            removed_partial_out += 1
        else:
            filtered_edges.append(edge)
    
    data["edges"] = filtered_edges
    final_count = len(filtered_edges)
    
    stats["edges_original"] = original_count
    stats["edges_removed_both_out"] = removed_both_out
    stats["edges_removed_partial_out"] = removed_partial_out
    stats["edges_final"] = final_count
    stats["edges_total_removed"] = removed_both_out + removed_partial_out
    
    print(f"Edge cleanup: {original_count} -> {final_count}")
    print(f"  Removed edges (both nodes out): {removed_both_out}")
    print(f"  Removed edges (one node out): {removed_partial_out}")
    
    return data


def cleanup_nodes(data, remove_removed=True, remove_outofbounds=True, remove_orphans=True, stats=None):
    """
    Remove unused nodes from the data.
    
    Args:
        data: The converted OSM data dictionary
        remove_removed: If True, remove nodes marked as "removed"
        remove_outofbounds: If True, remove nodes marked as "outofbounds" 
                           (only if not referenced by anything)
        remove_orphans: If True, remove nodes that are not referenced by anything
        stats: Optional dict to collect cleanup statistics
    
    Returns:
        The modified data dictionary with unused nodes removed
    """
    if stats is None:
        stats = {}
    
    nodes = data.get("nodes", {})
    if not nodes:
        return data
    
    original_count = len(nodes)
    stats["original_node_count"] = original_count
    
    # Get all referenced node IDs (this should be called AFTER edge cleanup)
    referenced = get_referenced_node_ids(data)
    stats["referenced_count"] = len(referenced)
    
    removed_count = 0
    outofbounds_count = 0
    orphan_count = 0
    kept_outofbounds_count = 0
    
    nodes_to_remove = []
    
    for node_id, node_data in nodes.items():
        node_id_str = str(node_id)
        
        # Check if node should be removed (in priority order)
        if remove_removed and node_data.get("removed"):
            nodes_to_remove.append(node_id)
            removed_count += 1
        elif remove_outofbounds and node_data.get("outofbounds"):
            # Only remove if NOT referenced
            if node_id_str not in referenced:
                nodes_to_remove.append(node_id)
                outofbounds_count += 1
            else:
                kept_outofbounds_count += 1
        elif remove_orphans and node_id_str not in referenced:
            # Orphan node - not used by anything
            nodes_to_remove.append(node_id)
            orphan_count += 1
    
    # Remove the nodes
    for node_id in nodes_to_remove:
        del nodes[node_id]
    
    final_count = len(nodes)
    
    stats["removed_nodes"] = removed_count
    stats["outofbounds_nodes"] = outofbounds_count
    stats["orphan_nodes"] = orphan_count
    stats["kept_outofbounds_nodes"] = kept_outofbounds_count
    stats["final_node_count"] = final_count
    stats["total_removed"] = removed_count + outofbounds_count + orphan_count
    
    print(f"Node cleanup: {original_count} -> {final_count}")
    print(f"  Removed 'removed' nodes: {removed_count}")
    print(f"  Removed 'outofbounds' nodes: {outofbounds_count}")
    print(f"  Removed orphan nodes: {orphan_count}")
    if kept_outofbounds_count > 0:
        print(f"  Kept {kept_outofbounds_count} outofbounds nodes (still referenced)")
    
    return data


def cleanup_with_progress(data, stats=None, remove_partial_bounds=True):
    """
    Cleanup nodes and edges with progress reporting.
    
    Args:
        data: The converted OSM data dictionary
        stats: Optional dict to collect cleanup statistics
        remove_partial_bounds: If True, remove edges with ANY out-of-bounds node
    """
    progress.step("Cleaning up edges...")
    
    edge_stats = {}
    data = cleanup_edges(data, remove_partial_bounds=remove_partial_bounds, stats=edge_stats)
    
    progress.step(
        f"Removed {edge_stats.get('edges_total_removed', 0):,} out-of-bounds edges"
    )
    
    progress.step("Removing unused nodes...")
    
    node_stats = {}
    data = cleanup_nodes(data, remove_removed=True, remove_outofbounds=True, remove_orphans=True, stats=node_stats)
    
    if stats is not None:
        stats.update(edge_stats)
        stats.update(node_stats)
    
    progress.step(
        f"Removed {node_stats.get('total_removed', 0):,} unused nodes " +
        f"({node_stats.get('removed_nodes', 0):,} removed, " +
        f"{node_stats.get('outofbounds_nodes', 0):,} out-of-bounds, " +
        f"{node_stats.get('orphan_nodes', 0):,} orphans)"
    )
    
    return data


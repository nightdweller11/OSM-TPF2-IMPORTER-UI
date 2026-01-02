# sorting order, edges will be build in this order by type

railtypes = [  # https://wiki.openstreetmap.org/wiki/Key:railway
    "rail",
    "light_rail",
    "subway",
    "tram",
    "narrow_gauge",
    "miniature",
    "preserved",
    "disused",
    "construction",
]

highwaytypes = [  # https://wiki.openstreetmap.org/wiki/Key:highway
    "aeroway",
    # actual streets
    "raceway",
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "residential",
    "living_street",
    "unclassified",
    "service",
    "construction",
    # paths
    "pedestrian",
    "footway",
    "cycleway",
    "path",
    "track",
    "bridleway",
    # streams
    "waterstream",
]
# move types to ignored types below to omit them from the output data

ignored_highway_types = {
    # highway types from OSM, which are not actual streets
    # place ignored types here (will not be logged)
    "steps",
    "platform",
    "corridor",
    "bus_stop",
    "escape",
    "busway",
    "bus_guideway",
    "road",
    "via_ferrata",
    "elevator",
    "emergency_bay",
    "rest_area",
    "services",
    "razed",
    "abandoned",
    "disused",
    "proposed",
    "planned",
}


def _order_edges_by_connectivity(edges_list):
    """
    Order edges within a list so connected edges are consecutive.
    This ensures that when edge N is built, edge N+1 can connect to it.
    """
    if len(edges_list) <= 1:
        return edges_list
    
    # Group edges by way ID (extracted from edge ID format "wayId_segmentIndex")
    from collections import defaultdict
    ways = defaultdict(list)
    for edge in edges_list:
        edge_id = edge.get("id", "")
        way_id = edge_id.rsplit("_", 1)[0] if "_" in edge_id else edge_id
        ways[way_id].append(edge)
    
    # Order edges within each way by connectivity (node1 of edge N = node0 of edge N+1)
    result = []
    for way_id, way_edges in ways.items():
        if len(way_edges) <= 1:
            result.extend(way_edges)
            continue
        
        # Build node lookup
        edges_by_node0 = {e.get("node0"): e for e in way_edges}
        edges_by_node1 = {e.get("node1"): e for e in way_edges}
        
        # Find starting edge (node0 not used as any edge's node1)
        start_edge = None
        for edge in way_edges:
            n0 = edge.get("node0")
            if n0 not in edges_by_node1:
                start_edge = edge
                break
        
        if not start_edge:
            # Circular way - just use first edge
            start_edge = way_edges[0]
        
        # Build chain
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
        
        # Append any remaining edges not in chain
        for edge in way_edges:
            if id(edge) not in used:
                chain.append(edge)
        
        result.extend(chain)
    
    return result


def sort(edges):
    ret = []  # convert edges from dict to a sorted list
    tracks = dict((rtype, []) for rtype in railtypes)
    streets = dict((htype, []) for htype in highwaytypes)
    for eid, edge in edges.items():
        edge["id"] = eid
        if edge["track"]:
            rtype = edge["track"]["type"]
            if rtype in tracks:
                tracks[rtype].append(edge)
            else:
                print(f"Unknown rail type: {rtype} {eid}")
        else:
            htype = edge["street"]["type"]
            if htype in streets:
                streets[htype].append(edge)
            else:
                if htype not in ignored_highway_types:
                    print(f"Unknown highway type: {htype} {eid}")
    print("\n  ".join([f"Track Edges (rail types): {sum(len(tracks[rtype]) for rtype in railtypes)}",
                       *[f"{rtype}: {len(tracks[rtype])}" for rtype in railtypes]]))
    print("\n  ".join([f"Street Edges (highway types): {sum(len(streets[htype]) for htype in highwaytypes)}",
                       *[f"{htype}: {len(streets[htype])}" for htype in highwaytypes]]))
    
    # Order edges within each type by connectivity
    # This ensures connected edges are processed consecutively
    for rtype in railtypes:
        ret.extend(_order_edges_by_connectivity(tracks[rtype]))
    for htype in highwaytypes:
        ret.extend(_order_edges_by_connectivity(streets[htype]))
    
    print(f"[Sort] Ordered {len(ret)} edges by connectivity within ways")
    return ret

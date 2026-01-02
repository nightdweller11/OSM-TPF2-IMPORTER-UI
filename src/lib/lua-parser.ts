/**
 * Simple Lua table parser for osmdata.lua visualization
 */

export type NodeCategory = 
  | 'edgeEndpoint'    // Actually used by edges (road/track segments)
  | 'pathStreet'      // Has path_street for tangent calculations
  | 'pathTrack'       // Has path_track for tangent calculations  
  | 'forestPolygon'   // Forest/shrub polygon vertices (forester.lua)
  | 'groundPolygon'   // Ground surface polygon vertices (paver.lua)
  | 'unknownPolygon'  // Orphan node - purpose unknown
  | 'outOfBounds'     // Explicitly marked as out of bounds
  | 'removed'         // Optimized away during conversion
  | 'switch'          // Railway switch
  | 'signal';         // Railway signal

export interface LuaNode {
  pos: [number, number, number];
  removed?: boolean;
  signal?: object;
  switch?: boolean;
  long_edge?: boolean;
  path_street?: boolean;
  path_track?: boolean;
  outofbounds?: boolean;
  category?: NodeCategory;
  isEdgeEndpoint?: boolean;
}

export interface LuaEdge {
  id: string;
  node0: string;
  node1: string;
  street?: {
    type: string;
    speed?: number;
    lanes?: number;
    oneway?: boolean;
  };
  track?: {
    type: string;
    speed?: number;
  };
  bridge?: boolean;
  tunnel?: boolean;
}

export interface LuaObject {
  type: string;
  pos: [number, number, number];
}

export interface LuaTown {
  name: string;
  pos: [number, number];
  population?: number;
}

export interface ParsedOsmData {
  nodes: Record<string, LuaNode>;
  edges: LuaEdge[];
  objects: LuaObject[];
  towns: LuaTown[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  stats: {
    nodeCount: number;
    activeNodeCount: number;
    removedNodeCount: number;
    nodesByCategory: Record<NodeCategory, number>;
    edgeCount: number;
    streetEdges: number;
    trackEdges: number;
    objectCount: number;
    objectsByType: Record<string, number>;
    townCount: number;
  };
}

/**
 * Extract a section from Lua content using brace matching
 * This handles arbitrary section ordering and nested braces
 */
function extractSection(content: string, sectionName: string): string | null {
  const pattern = new RegExp(sectionName + '\\s*=\\s*\\{');
  const match = pattern.exec(content);
  if (!match) return null;
  
  const startIdx = match.index + match[0].length;
  let braceCount = 1;
  let endIdx = startIdx;
  
  while (braceCount > 0 && endIdx < content.length) {
    if (content[endIdx] === '{') braceCount++;
    if (content[endIdx] === '}') braceCount--;
    endIdx++;
  }
  
  return content.substring(startIdx, endIdx - 1);
}

/**
 * Parse a Lua table string into JavaScript object
 * This is a simplified parser for the specific format of osmdata.lua
 */
export function parseLuaTable(luaContent: string): ParsedOsmData {
  // Remove the "return " prefix if present
  let content = luaContent.trim();
  if (content.startsWith('return')) {
    content = content.substring(6).trim();
  }

  // Initialize result
  const result: ParsedOsmData = {
    nodes: {},
    edges: [],
    objects: [],
    towns: [],
    bounds: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    stats: { 
      nodeCount: 0, 
      activeNodeCount: 0, 
      removedNodeCount: 0, 
      nodesByCategory: {} as Record<NodeCategory, number>,
      edgeCount: 0, 
      streetEdges: 0, 
      trackEdges: 0, 
      objectCount: 0, 
      objectsByType: {}, 
      townCount: 0 
    }
  };

  try {
    console.log('[LuaParser] Content length:', content.length);
    console.log('[LuaParser] First 200 chars:', content.substring(0, 200));
    
    // Extract sections using brace matching for reliable parsing
    const nodesContent = extractSection(content, 'nodes');
    if (nodesContent) {
      console.log('[LuaParser] Found nodes section, length:', nodesContent.length);
      parseNodes(nodesContent, result);
    } else {
      console.log('[LuaParser] No nodes section found');
    }

    const edgesContent = extractSection(content, 'edges');
    if (edgesContent) {
      console.log('[LuaParser] Found edges section, length:', edgesContent.length);
      parseEdges(edgesContent, result);
    } else {
      console.log('[LuaParser] No edges section found');
    }

    const objectsContent = extractSection(content, 'objects');
    if (objectsContent) {
      console.log('[LuaParser] Found objects section, length:', objectsContent.length);
      parseObjects(objectsContent, result);
    } else {
      console.log('[LuaParser] No objects section found');
    }

    const townsContent = extractSection(content, 'towns');
    if (townsContent) {
      console.log('[LuaParser] Found towns section, length:', townsContent.length);
      parseTowns(townsContent, result);
    } else {
      console.log('[LuaParser] No towns section found');
    }

    // Parse areas to determine which nodes are forest vs ground polygons
    const areasContent = extractSection(content, 'areas');
    const forestNodes = new Set<string>();
    const groundNodes = new Set<string>();
    
    if (areasContent) {
      // Extract forests section
      const forestsContent = extractSection(areasContent, 'forests');
      if (forestsContent) {
        const nodeIds = forestsContent.match(/\d+/g) || [];
        nodeIds.forEach(id => forestNodes.add(id));
      }
      
      // Extract shrubs section (also goes to forester)
      const shrubsContent = extractSection(areasContent, 'shrubs');
      if (shrubsContent) {
        const nodeIds = shrubsContent.match(/\d+/g) || [];
        nodeIds.forEach(id => forestNodes.add(id));
      }
      
      // Extract grounds section (goes to paver)
      const groundsContent = extractSection(areasContent, 'grounds');
      if (groundsContent) {
        const nodeIds = groundsContent.match(/\d+/g) || [];
        nodeIds.forEach(id => groundNodes.add(id));
      }
      
      console.log('[LuaParser] Forest/shrub polygon nodes:', forestNodes.size);
      console.log('[LuaParser] Ground polygon nodes:', groundNodes.size);
    }

    // Mark nodes that are edge endpoints
    for (const edge of result.edges) {
      if (result.nodes[edge.node0]) {
        result.nodes[edge.node0].isEdgeEndpoint = true;
      }
      if (result.nodes[edge.node1]) {
        result.nodes[edge.node1].isEdgeEndpoint = true;
      }
    }
    
    // Categorize each node
    for (const [nodeId, node] of Object.entries(result.nodes)) {
      let category: NodeCategory;
      
      if (node.removed) {
        category = 'removed';
      } else if (node.switch) {
        category = 'switch';
      } else if (node.signal) {
        category = 'signal';
      } else if (node.outofbounds) {
        category = 'outOfBounds';
      } else if (node.isEdgeEndpoint) {
        category = 'edgeEndpoint';
      } else if (node.path_street) {
        category = 'pathStreet';
      } else if (node.path_track) {
        category = 'pathTrack';
      } else if (forestNodes.has(nodeId)) {
        category = 'forestPolygon';
      } else if (groundNodes.has(nodeId)) {
        category = 'groundPolygon';
      } else {
        category = 'unknownPolygon'; // Orphan nodes - purpose unknown
      }
      
      node.category = category;
      result.stats.nodesByCategory[category] = (result.stats.nodesByCategory[category] || 0) + 1;
    }
    
    // Update stats
    const allNodes = Object.values(result.nodes);
    result.stats.nodeCount = allNodes.length;
    result.stats.activeNodeCount = allNodes.filter(n => !n.removed && !n.outofbounds).length;
    result.stats.removedNodeCount = allNodes.filter(n => n.removed).length;
    result.stats.edgeCount = result.edges.length;
    result.stats.streetEdges = result.edges.filter(e => e.street).length;
    result.stats.trackEdges = result.edges.filter(e => e.track).length;
    result.stats.objectCount = result.objects.length;
    result.stats.townCount = result.towns.length;
    
    // Count objects by type
    for (const obj of result.objects) {
      result.stats.objectsByType[obj.type] = (result.stats.objectsByType[obj.type] || 0) + 1;
    }
    
    console.log('[LuaParser] Node categories:', result.stats.nodesByCategory);
    console.log('[LuaParser] Bounds:', result.bounds);

  } catch (error) {
    console.error('Error parsing Lua content:', error);
  }

  return result;
}

function parseNodes(nodesContent: string, result: ParsedOsmData) {
  // Parse using regex for multi-line pos format
  // Format: [nodeId] = { pos = { x, y, }, ... }
  // The pos array spans multiple lines
  
  // Match each node block: [id] = { ... }
  // Use a more robust pattern that handles the multi-line format
  const nodeBlockPattern = /\[(\d+|"[^"]+")\]\s*=\s*\{/g;
  const content = nodesContent;
  let match;
  
  while ((match = nodeBlockPattern.exec(content)) !== null) {
    const nodeId = match[1].replace(/"/g, '').trim();
    const startIdx = match.index + match[0].length;
    
    // Find the end of this node block (matching closing brace)
    let braceCount = 1;
    let endIdx = startIdx;
    while (braceCount > 0 && endIdx < content.length) {
      if (content[endIdx] === '{') braceCount++;
      if (content[endIdx] === '}') braceCount--;
      endIdx++;
    }
    
    const nodeBlock = content.substring(startIdx, endIdx - 1);
    
    // Extract position from the block - handle both single-line and multi-line formats
    // Multi-line: pos = { -48.12, 181.42, }
    const posMatch = nodeBlock.match(/pos\s*=\s*\{[\s\n]*([-\d.eE+]+),[\s\n]*([-\d.eE+]+),?[\s\n]*([-\d.eE+]*)/);
    if (posMatch) {
      const x = parseFloat(posMatch[1]);
      const y = parseFloat(posMatch[2]);
      const z = parseFloat(posMatch[3]) || 0;
      
      const isRemoved = nodeBlock.includes('removed = true');
      
      if (!isNaN(x) && !isNaN(y)) {
        const hasSwitch = nodeBlock.includes('switch = true');
        const hasSignal = nodeBlock.includes('signal');
        const hasPathStreet = nodeBlock.includes('path_street');
        const hasPathTrack = nodeBlock.includes('path_track');
        const hasOutOfBounds = nodeBlock.includes('outofbounds = true');
        
        result.nodes[nodeId] = {
          pos: [x, y, z],
          removed: isRemoved,
          switch: hasSwitch,
          signal: hasSignal ? {} : undefined,
          long_edge: nodeBlock.includes('long_edge = true'),
          path_street: hasPathStreet,
          path_track: hasPathTrack,
          outofbounds: hasOutOfBounds,
          isEdgeEndpoint: false, // Will be set later
          category: undefined, // Will be set after edges are parsed
        };

        // Update bounds (only for non-removed, non-outofbounds nodes)
        if (!isRemoved && !hasOutOfBounds) {
          result.bounds.minX = Math.min(result.bounds.minX, x);
          result.bounds.maxX = Math.max(result.bounds.maxX, x);
          result.bounds.minY = Math.min(result.bounds.minY, y);
          result.bounds.maxY = Math.max(result.bounds.maxY, y);
        }
      }
    }
  }
  
  console.log('[LuaParser] Parsed', Object.keys(result.nodes).length, 'nodes');
}

function parseEdges(edgesContent: string, result: ParsedOsmData) {
  // Parse edge blocks using brace matching for multi-line format
  // Edges start with { and contain node0, node1, etc.
  const edgeStartPattern = /\{[\s\n]*(?:id|node0|street|track)/g;
  const content = edgesContent;
  let match;
  let edgeIndex = 0;
  
  while ((match = edgeStartPattern.exec(content)) !== null) {
    const startIdx = match.index;
    
    // Find the end of this edge block
    let braceCount = 1;
    let endIdx = content.indexOf('{', startIdx) + 1;
    while (braceCount > 0 && endIdx < content.length) {
      if (content[endIdx] === '{') braceCount++;
      if (content[endIdx] === '}') braceCount--;
      endIdx++;
    }
    
    const edgeContent = content.substring(startIdx, endIdx);
    
    // Extract node0 and node1 - handle multi-line
    const node0Match = edgeContent.match(/node0\s*=\s*([^,\s\n}]+)/);
    const node1Match = edgeContent.match(/node1\s*=\s*([^,\s\n}]+)/);
    const idMatch = edgeContent.match(/id\s*=\s*"([^"]+)"/);
    
    if (node0Match && node1Match) {
      const edge: LuaEdge = {
        id: idMatch ? idMatch[1] : `edge_${edgeIndex}`,
        node0: node0Match[1].replace(/"/g, '').trim(),
        node1: node1Match[1].replace(/"/g, '').trim(),
      };
      
      // Check for street
      if (edgeContent.includes('street')) {
        const typeMatch = edgeContent.match(/street\s*=\s*\{[\s\S]*?type\s*=\s*"([^"]+)"/);
        const speedMatch = edgeContent.match(/speed\s*=\s*(\d+)/);
        edge.street = {
          type: typeMatch ? typeMatch[1] : 'unknown',
          speed: speedMatch ? parseInt(speedMatch[1]) : undefined
        };
      }
      
      // Check for track
      if (edgeContent.includes('track')) {
        const typeMatch = edgeContent.match(/track\s*=\s*\{[\s\S]*?type\s*=\s*"([^"]+)"/);
        edge.track = {
          type: typeMatch ? typeMatch[1] : 'rail'
        };
      }
      
      edge.bridge = edgeContent.includes('bridge = true');
      edge.tunnel = edgeContent.includes('tunnel = true');
      
      result.edges.push(edge);
      edgeIndex++;
    }
  }
  
  console.log('[LuaParser] Parsed', result.edges.length, 'edges');
}

function parseObjects(objectsContent: string, result: ParsedOsmData) {
  // Parse object blocks using brace matching (multi-line format)
  const objectBlockPattern = /\{\s*[\n\t]*type\s*=\s*"([^"]+)"/g;
  const content = objectsContent;
  let match;
  
  while ((match = objectBlockPattern.exec(content)) !== null) {
    const objType = match[1];
    const startIdx = match.index;
    
    // Find the end of this object block
    let braceCount = 1;
    let endIdx = content.indexOf('{', startIdx) + 1;
    while (braceCount > 0 && endIdx < content.length) {
      if (content[endIdx] === '{') braceCount++;
      if (content[endIdx] === '}') braceCount--;
      endIdx++;
    }
    
    const objBlock = content.substring(startIdx, endIdx);
    
    // Extract position - handle multi-line format
    const posMatch = objBlock.match(/pos\s*=\s*\{[\s\n]*([-\d.eE+]+),[\s\n]*([-\d.eE+]+),?[\s\n]*([-\d.eE+]*)/);
    if (posMatch) {
      const x = parseFloat(posMatch[1]);
      const y = parseFloat(posMatch[2]);
      const z = parseFloat(posMatch[3]) || 0;
      
      if (!isNaN(x) && !isNaN(y)) {
        result.objects.push({
          type: objType,
          pos: [x, y, z]
        });
      }
    }
  }
  
  console.log('[LuaParser] Parsed', result.objects.length, 'objects');
}

function parseTowns(townsContent: string, result: ParsedOsmData) {
  // Match town entries
  const townPattern = /\{\s*name\s*=\s*"([^"]+)"\s*,\s*pos\s*=\s*\{\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\}/g;
  
  let match;
  while ((match = townPattern.exec(townsContent)) !== null) {
    result.towns.push({
      name: match[1],
      pos: [parseFloat(match[2]), parseFloat(match[3])]
    });
  }
}

// Note: For server-side file loading, use the /api/visualize endpoint
// which handles file reading on the server and returns the parsed content


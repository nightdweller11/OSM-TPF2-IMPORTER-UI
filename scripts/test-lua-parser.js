#!/usr/bin/env node

/**
 * Test script for the Lua parser
 * Run with: node scripts/test-lua-parser.js [path-to-osmdata.lua]
 */

const fs = require('fs');
const path = require('path');

/**
 * Extract a section from Lua content using brace matching
 * This handles arbitrary section ordering and nested braces
 */
function extractSection(content, sectionName) {
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

// Simple Lua parser (JavaScript version of the TypeScript parser)
function parseLuaTable(luaContent) {
  let content = luaContent.trim();
  if (content.startsWith('return')) {
    content = content.substring(6).trim();
  }

  const result = {
    nodes: {},
    edges: [],
    objects: [],
    towns: [],
    bounds: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    stats: { nodeCount: 0, edgeCount: 0, streetEdges: 0, trackEdges: 0, objectCount: 0, townCount: 0 }
  };

  try {
    // Extract sections using brace matching for reliable parsing
    const nodesContent = extractSection(content, 'nodes');
    if (nodesContent) {
      console.log('[Parser] Found nodes section, length:', nodesContent.length);
      parseNodes(nodesContent, result);
    } else {
      console.log('[Parser] No nodes section found');
    }

    const edgesContent = extractSection(content, 'edges');
    if (edgesContent) {
      console.log('[Parser] Found edges section, length:', edgesContent.length);
      parseEdges(edgesContent, result);
    } else {
      console.log('[Parser] No edges section found');
    }

    const objectsContent = extractSection(content, 'objects');
    if (objectsContent) {
      console.log('[Parser] Found objects section, length:', objectsContent.length);
      parseObjects(objectsContent, result);
    }

    const townsContent = extractSection(content, 'towns');
    if (townsContent) {
      console.log('[Parser] Found towns section, length:', townsContent.length);
      parseTowns(townsContent, result);
    }

    // Update stats
    result.stats.nodeCount = Object.keys(result.nodes).length;
    result.stats.edgeCount = result.edges.length;
    result.stats.streetEdges = result.edges.filter(e => e.street).length;
    result.stats.trackEdges = result.edges.filter(e => e.track).length;
    result.stats.objectCount = result.objects.length;
    result.stats.townCount = result.towns.length;
    
    // Count drawable edges (both nodes exist)
    let drawableEdges = 0;
    let missingNode0 = 0;
    let missingNode1 = 0;
    let missingBoth = 0;
    for (const edge of result.edges) {
      const hasNode0 = result.nodes[edge.node0] !== undefined;
      const hasNode1 = result.nodes[edge.node1] !== undefined;
      if (hasNode0 && hasNode1) {
        drawableEdges++;
      } else if (!hasNode0 && !hasNode1) {
        missingBoth++;
      } else if (!hasNode0) {
        missingNode0++;
      } else {
        missingNode1++;
      }
    }
    console.log('[Parser] Drawable edges:', drawableEdges, '/', result.edges.length);
    console.log('[Parser] Missing node0:', missingNode0, 'node1:', missingNode1, 'both:', missingBoth);
    result.stats.drawableEdges = drawableEdges;

  } catch (error) {
    console.error('[Parser] Error:', error);
  }

  return result;
}

function parseNodes(nodesContent, result) {
  console.log('[Parser] Nodes content sample:', nodesContent.substring(0, 500));
  
  // Match each node block: [id] = { ... }
  const nodeBlockPattern = /\[(\d+|"[^"]+")\]\s*=\s*\{/g;
  const content = nodesContent;
  let match;
  let count = 0;
  
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
    
    // Extract position - handle both single-line and multi-line formats
    const posMatch = nodeBlock.match(/pos\s*=\s*\{[\s\n]*([-\d.eE+]+),[\s\n]*([-\d.eE+]+),?[\s\n]*([-\d.eE+]*)/);
    if (posMatch) {
      const x = parseFloat(posMatch[1]);
      const y = parseFloat(posMatch[2]);
      const z = parseFloat(posMatch[3]) || 0;
      
      if (!isNaN(x) && !isNaN(y)) {
        result.nodes[nodeId] = {
          pos: [x, y, z],
          removed: nodeBlock.includes('removed = true'),
          switch: nodeBlock.includes('switch = true'),
          signal: nodeBlock.includes('signal') ? {} : undefined
        };

        // Update bounds
        result.bounds.minX = Math.min(result.bounds.minX, x);
        result.bounds.maxX = Math.max(result.bounds.maxX, x);
        result.bounds.minY = Math.min(result.bounds.minY, y);
        result.bounds.maxY = Math.max(result.bounds.maxY, y);
        count++;
      }
    }
  }
  console.log('[Parser] Parsed', count, 'nodes');
}

function parseEdges(edgesContent, result) {
  // Match edge entries - they are inside { }
  const edgePattern = /\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
  
  let match;
  let edgeIndex = 0;
  while ((match = edgePattern.exec(edgesContent)) !== null) {
    const edgeContent = match[1];
    
    // Extract node0 and node1
    const node0Match = edgeContent.match(/node0\s*=\s*([^,\s}]+)/);
    const node1Match = edgeContent.match(/node1\s*=\s*([^,\s}]+)/);
    const idMatch = edgeContent.match(/id\s*=\s*"([^"]+)"/);
    
    if (node0Match && node1Match) {
      const edge = {
        id: idMatch ? idMatch[1] : `edge_${edgeIndex}`,
        node0: node0Match[1].replace(/"/g, '').trim(),
        node1: node1Match[1].replace(/"/g, '').trim(),
      };
      
      // Check for street
      if (edgeContent.includes('street')) {
        const typeMatch = edgeContent.match(/street\s*=\s*\{[^}]*type\s*=\s*"([^"]+)"/);
        const speedMatch = edgeContent.match(/speed\s*=\s*(\d+)/);
        edge.street = {
          type: typeMatch ? typeMatch[1] : 'unknown',
          speed: speedMatch ? parseInt(speedMatch[1]) : undefined
        };
      }
      
      // Check for track
      if (edgeContent.includes('track')) {
        const typeMatch = edgeContent.match(/track\s*=\s*\{[^}]*type\s*=\s*"([^"]+)"/);
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
  console.log('[Parser] Parsed', result.edges.length, 'edges');
}

function parseObjects(objectsContent, result) {
  console.log('[Parser] Objects content sample:', objectsContent.substring(0, 500));
  
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
    
    // Extract position
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
  console.log('[Parser] Parsed', result.objects.length, 'objects');
}

function parseTowns(townsContent, result) {
  const townPattern = /\{\s*name\s*=\s*"([^"]+)"\s*,\s*pos\s*=\s*\{\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\}/g;
  
  let match;
  while ((match = townPattern.exec(townsContent)) !== null) {
    result.towns.push({
      name: match[1],
      pos: [parseFloat(match[2]), parseFloat(match[3])]
    });
  }
  console.log('[Parser] Parsed', result.towns.length, 'towns');
}

// Main
const args = process.argv.slice(2);
let filePath = args[0];

if (!filePath) {
  // Try to find a file in the storage directory
  const storageDir = path.join(__dirname, '..', 'storage', 'conversions');
  if (fs.existsSync(storageDir)) {
    const dirs = fs.readdirSync(storageDir);
    if (dirs.length > 0) {
      const possiblePath = path.join(storageDir, dirs[0], 'osmdata.lua');
      if (fs.existsSync(possiblePath)) {
        filePath = possiblePath;
      }
    }
  }
}

if (!filePath) {
  console.log('Usage: node scripts/test-lua-parser.js <path-to-osmdata.lua>');
  console.log('\nNo file specified. Testing with sample content...\n');
  
  // Test with sample
  const sampleContent = `return {
    nodes = {
      [12345] = { pos = { 100.5, 200.3, 5.0 } },
      [12346] = { pos = { 150.0, 250.0, 6.0 } },
    },
    edges = {
      { id = "way123_0", node0 = 12345, node1 = 12346, street = { type = "residential", speed = 50 } },
    },
    objects = {
      { type = "tree", pos = { 50.0, 100.0, 3.0 } },
    },
    towns = {
      { name = "TestTown", pos = { 150.0, 200.0 } },
    },
  }`;
  
  const result = parseLuaTable(sampleContent);
  console.log('\n=== Parse Results ===');
  console.log('Nodes:', result.stats.nodeCount);
  console.log('Edges:', result.stats.edgeCount);
  console.log('  Streets:', result.stats.streetEdges);
  console.log('  Tracks:', result.stats.trackEdges);
  console.log('Objects:', result.stats.objectCount);
  console.log('Towns:', result.stats.townCount);
  console.log('Bounds:', result.bounds);
  
  if (result.stats.nodeCount > 0) {
    console.log('\n✓ Parser working correctly!');
  } else {
    console.log('\n✗ Parser failed to parse nodes');
  }
  
  process.exit(0);
}

console.log('Parsing file:', filePath);
console.log('');

try {
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log('File size:', content.length, 'bytes');
  console.log('First 500 chars:', content.substring(0, 500));
  console.log('\n');
  
  const result = parseLuaTable(content);
  
  console.log('\n=== Parse Results ===');
  console.log('Nodes:', result.stats.nodeCount);
  console.log('Edges:', result.stats.edgeCount);
  console.log('  Streets:', result.stats.streetEdges);
  console.log('  Tracks:', result.stats.trackEdges);
  console.log('Objects:', result.stats.objectCount);
  console.log('Towns:', result.stats.townCount);
  console.log('Bounds:', result.bounds);
  
  if (result.stats.nodeCount > 0) {
    console.log('\nSample nodes:');
    const nodeKeys = Object.keys(result.nodes).slice(0, 3);
    nodeKeys.forEach(key => {
      console.log(`  [${key}]:`, result.nodes[key]);
    });
  }
  
  if (result.edges.length > 0) {
    console.log('\nSample edges:');
    result.edges.slice(0, 3).forEach(edge => {
      console.log(`  ${edge.id}:`, edge);
    });
  }
  
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}


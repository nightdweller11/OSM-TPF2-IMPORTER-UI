#!/usr/bin/env node

/**
 * Test script for the visualizer parser
 * Validates that the Lua parser correctly parses osmdata.lua files
 * 
 * Run with: node scripts/test-visualizer.js [path-to-osmdata.lua]
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ============================================================================
// PARSER FUNCTIONS (copy from lua-parser.ts for testing)
// ============================================================================

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
    const nodesContent = extractSection(content, 'nodes');
    if (nodesContent) {
      parseNodes(nodesContent, result);
    }

    const edgesContent = extractSection(content, 'edges');
    if (edgesContent) {
      parseEdges(edgesContent, result);
    }

    const objectsContent = extractSection(content, 'objects');
    if (objectsContent) {
      parseObjects(objectsContent, result);
    }

    const townsContent = extractSection(content, 'towns');
    if (townsContent) {
      parseTowns(townsContent, result);
    }

    result.stats.nodeCount = Object.keys(result.nodes).length;
    result.stats.edgeCount = result.edges.length;
    result.stats.streetEdges = result.edges.filter(e => e.street).length;
    result.stats.trackEdges = result.edges.filter(e => e.track).length;
    result.stats.objectCount = result.objects.length;
    result.stats.townCount = result.towns.length;

  } catch (error) {
    console.error('Parse error:', error);
  }

  return result;
}

function parseNodes(nodesContent, result) {
  const nodeBlockPattern = /\[(\d+|"[^"]+")\]\s*=\s*\{/g;
  let match;
  
  while ((match = nodeBlockPattern.exec(nodesContent)) !== null) {
    const nodeId = match[1].replace(/"/g, '').trim();
    const startIdx = match.index + match[0].length;
    
    let braceCount = 1;
    let endIdx = startIdx;
    while (braceCount > 0 && endIdx < nodesContent.length) {
      if (nodesContent[endIdx] === '{') braceCount++;
      if (nodesContent[endIdx] === '}') braceCount--;
      endIdx++;
    }
    
    const nodeBlock = nodesContent.substring(startIdx, endIdx - 1);
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

        result.bounds.minX = Math.min(result.bounds.minX, x);
        result.bounds.maxX = Math.max(result.bounds.maxX, x);
        result.bounds.minY = Math.min(result.bounds.minY, y);
        result.bounds.maxY = Math.max(result.bounds.maxY, y);
      }
    }
  }
}

function parseEdges(edgesContent, result) {
  const edgeStartPattern = /\{[\s\n]*(?:id|node0|street|track)/g;
  let match;
  let edgeIndex = 0;
  
  while ((match = edgeStartPattern.exec(edgesContent)) !== null) {
    const startIdx = match.index;
    
    let braceCount = 1;
    let endIdx = edgesContent.indexOf('{', startIdx) + 1;
    while (braceCount > 0 && endIdx < edgesContent.length) {
      if (edgesContent[endIdx] === '{') braceCount++;
      if (edgesContent[endIdx] === '}') braceCount--;
      endIdx++;
    }
    
    const edgeContent = edgesContent.substring(startIdx, endIdx);
    
    const node0Match = edgeContent.match(/node0\s*=\s*([^,\s\n}]+)/);
    const node1Match = edgeContent.match(/node1\s*=\s*([^,\s\n}]+)/);
    const idMatch = edgeContent.match(/id\s*=\s*"([^"]+)"/);
    
    if (node0Match && node1Match) {
      const edge = {
        id: idMatch ? idMatch[1] : `edge_${edgeIndex}`,
        node0: node0Match[1].replace(/"/g, '').trim(),
        node1: node1Match[1].replace(/"/g, '').trim(),
      };
      
      if (edgeContent.includes('street')) {
        const typeMatch = edgeContent.match(/street\s*=\s*\{[\s\S]*?type\s*=\s*"([^"]+)"/);
        const speedMatch = edgeContent.match(/speed\s*=\s*(\d+)/);
        edge.street = {
          type: typeMatch ? typeMatch[1] : 'unknown',
          speed: speedMatch ? parseInt(speedMatch[1]) : undefined
        };
      }
      
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
}

function parseObjects(objectsContent, result) {
  const objectBlockPattern = /\{\s*[\n\t]*type\s*=\s*"([^"]+)"/g;
  let match;
  
  while ((match = objectBlockPattern.exec(objectsContent)) !== null) {
    const objType = match[1];
    const startIdx = match.index;
    
    let braceCount = 1;
    let endIdx = objectsContent.indexOf('{', startIdx) + 1;
    while (braceCount > 0 && endIdx < objectsContent.length) {
      if (objectsContent[endIdx] === '{') braceCount++;
      if (objectsContent[endIdx] === '}') braceCount--;
      endIdx++;
    }
    
    const objBlock = objectsContent.substring(startIdx, endIdx);
    const posMatch = objBlock.match(/pos\s*=\s*\{[\s\n]*([-\d.eE+]+),[\s\n]*([-\d.eE+]+),?[\s\n]*([-\d.eE+]*)/);
    
    if (posMatch) {
      const x = parseFloat(posMatch[1]);
      const y = parseFloat(posMatch[2]);
      const z = parseFloat(posMatch[3]) || 0;
      
      if (!isNaN(x) && !isNaN(y)) {
        result.objects.push({ type: objType, pos: [x, y, z] });
      }
    }
  }
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
}

// ============================================================================
// TEST CASES
// ============================================================================

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${e.message}`);
      failed++;
    }
  }

  console.log('\n=== Lua Parser Tests ===\n');

  // Test: Simple inline format
  test('parses simple inline nodes', () => {
    const content = `return {
      nodes = { [12345] = { pos = { 100.5, 200.3, 5.0 } } },
      edges = {},
      objects = {},
      towns = {},
    }`;
    const result = parseLuaTable(content);
    assert.strictEqual(result.stats.nodeCount, 1);
    assert.deepStrictEqual(result.nodes['12345'].pos, [100.5, 200.3, 5.0]);
  });

  // Test: Multi-line format (actual osmdata format)
  test('parses multi-line nodes', () => {
    const content = `return {
      towns = {},
      nodes = {
        [34136052] = {
          pos = {
            -48.12393365536594,
            181.4221170328809,
          },
        },
      },
      edges = {},
      objects = {},
    }`;
    const result = parseLuaTable(content);
    assert.strictEqual(result.stats.nodeCount, 1);
    assert.ok(Math.abs(result.nodes['34136052'].pos[0] - (-48.12393365536594)) < 0.0001);
  });

  // Test: Edges with street type
  test('parses street edges', () => {
    const content = `return {
      nodes = {
        [1] = { pos = { 0, 0 } },
        [2] = { pos = { 100, 100 } },
      },
      edges = {
        {
          node0 = 1,
          node1 = 2,
          street = {
            type = "residential",
            speed = 50,
          },
        },
      },
      objects = {},
      towns = {},
    }`;
    const result = parseLuaTable(content);
    assert.strictEqual(result.stats.edgeCount, 1);
    assert.strictEqual(result.stats.streetEdges, 1);
    assert.strictEqual(result.edges[0].street.type, 'residential');
  });

  // Test: Edges with track type
  test('parses track edges', () => {
    const content = `return {
      nodes = {
        [1] = { pos = { 0, 0 } },
        [2] = { pos = { 100, 100 } },
      },
      edges = {
        {
          node0 = 1,
          node1 = 2,
          track = {
            type = "rail",
          },
        },
      },
      objects = {},
      towns = {},
    }`;
    const result = parseLuaTable(content);
    assert.strictEqual(result.stats.edgeCount, 1);
    assert.strictEqual(result.stats.trackEdges, 1);
    assert.strictEqual(result.edges[0].track.type, 'rail');
  });

  // Test: Objects
  test('parses objects in multi-line format', () => {
    const content = `return {
      nodes = {},
      edges = {},
      objects = {
        {
          type = "traffic_light",
          pos = {
            -74.93021684243324,
            25.617057985612593,
          },
        },
      },
      towns = {},
    }`;
    const result = parseLuaTable(content);
    assert.strictEqual(result.stats.objectCount, 1);
    assert.strictEqual(result.objects[0].type, 'traffic_light');
  });

  // Test: Bounds calculation
  test('calculates bounds correctly', () => {
    const content = `return {
      nodes = {
        [1] = { pos = { -100, -200 } },
        [2] = { pos = { 300, 400 } },
      },
      edges = {},
      objects = {},
      towns = {},
    }`;
    const result = parseLuaTable(content);
    assert.strictEqual(result.bounds.minX, -100);
    assert.strictEqual(result.bounds.maxX, 300);
    assert.strictEqual(result.bounds.minY, -200);
    assert.strictEqual(result.bounds.maxY, 400);
  });

  // Test: Empty content
  test('handles empty content', () => {
    const result = parseLuaTable('');
    assert.strictEqual(result.stats.nodeCount, 0);
    assert.strictEqual(result.stats.edgeCount, 0);
  });

  // Test: Drawable edges check
  test('all parsed edges should be drawable (nodes exist)', () => {
    const content = `return {
      nodes = {
        [1] = { pos = { 0, 0 } },
        [2] = { pos = { 100, 0 } },
        [3] = { pos = { 100, 100 } },
      },
      edges = {
        { node0 = 1, node1 = 2, street = { type = "residential" } },
        { node0 = 2, node1 = 3, street = { type = "residential" } },
      },
      objects = {},
      towns = {},
    }`;
    const result = parseLuaTable(content);
    
    // Count drawable edges
    let drawable = 0;
    for (const edge of result.edges) {
      if (result.nodes[edge.node0] && result.nodes[edge.node1]) {
        drawable++;
      }
    }
    assert.strictEqual(drawable, result.edges.length);
  });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  
  return failed === 0;
}

// ============================================================================
// FILE TESTING
// ============================================================================

function testWithFile(filePath) {
  console.log(`\n=== Testing with file: ${filePath} ===\n`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log(`File size: ${content.length} bytes`);
    
    const result = parseLuaTable(content);
    
    console.log('\nParse Results:');
    console.log(`  Nodes: ${result.stats.nodeCount}`);
    console.log(`  Edges: ${result.stats.edgeCount}`);
    console.log(`    Streets: ${result.stats.streetEdges}`);
    console.log(`    Tracks: ${result.stats.trackEdges}`);
    console.log(`  Objects: ${result.stats.objectCount}`);
    console.log(`  Towns: ${result.stats.townCount}`);
    console.log(`  Bounds: ${JSON.stringify(result.bounds)}`);
    
    // Count drawable edges
    let drawable = 0;
    let missing = 0;
    for (const edge of result.edges) {
      if (result.nodes[edge.node0] && result.nodes[edge.node1]) {
        drawable++;
      } else {
        missing++;
      }
    }
    console.log(`\nDrawable edges: ${drawable}/${result.edges.length}`);
    if (missing > 0) {
      console.log(`  (${missing} edges have missing nodes)`);
    }
    
    // Validation
    const allValid = result.stats.nodeCount > 0 && 
                     result.stats.edgeCount > 0 && 
                     drawable === result.edges.length;
    
    console.log(`\nValidation: ${allValid ? '✓ PASS' : '✗ FAIL'}`);
    return allValid;
    
  } catch (e) {
    console.error(`Error: ${e.message}`);
    return false;
  }
}

// ============================================================================
// MAIN
// ============================================================================

const args = process.argv.slice(2);

// Run unit tests first
const testsPass = runTests();

// If a file is provided, test with it
if (args[0]) {
  const fileValid = testWithFile(args[0]);
  process.exit(testsPass && fileValid ? 0 : 1);
} else {
  process.exit(testsPass ? 0 : 1);
}


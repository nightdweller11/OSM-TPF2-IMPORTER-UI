/**
 * Tests for the Lua parser
 */

import { parseLuaTable, type ParsedOsmData } from '../lua-parser';

// Sample osmdata.lua content - multi-line format matching actual output
const SAMPLE_LUA_CONTENT = `return {
	towns = {},
	nodes = {
		[12345] = {
			pos = {
				100.5,
				200.3,
			},
		},
		[12346] = {
			pos = {
				150.0,
				250.0,
			},
		},
		[12347] = {
			pos = {
				200.0,
				300.0,
			},
			switch = true,
		},
		["node_123"] = {
			pos = {
				250.0,
				350.0,
			},
			signal = { ref = "S1" },
		},
	},
	edges = {
		{
			id = "way123_0",
			node0 = 12345,
			node1 = 12346,
			street = {
				type = "residential",
				speed = 50,
			},
		},
		{
			id = "way123_1",
			node0 = 12346,
			node1 = 12347,
			street = {
				type = "primary",
				speed = 60,
			},
			bridge = true,
		},
		{
			node0 = 12347,
			node1 = "node_123",
			track = {
				type = "rail",
			},
		},
	},
	objects = {
		{
			type = "tree",
			pos = {
				50.0,
				100.0,
			},
		},
		{
			type = "traffic_light",
			pos = {
				75.0,
				125.0,
			},
		},
		{
			type = "fountain",
			pos = {
				100.0,
				150.0,
			},
		},
	},
	areas = {
		forests = {},
		shrubs = {},
		grounds = {},
	},
}`;

describe('Lua Parser', () => {
  let parsed: ParsedOsmData;

  beforeAll(() => {
    parsed = parseLuaTable(SAMPLE_LUA_CONTENT);
  });

  describe('Node Parsing', () => {
    it('should parse numeric node IDs', () => {
      expect(parsed.nodes['12345']).toBeDefined();
      expect(parsed.nodes['12346']).toBeDefined();
      expect(parsed.nodes['12347']).toBeDefined();
    });

    it('should parse string node IDs', () => {
      expect(parsed.nodes['node_123']).toBeDefined();
    });

    it('should parse node positions correctly', () => {
      const node = parsed.nodes['12345'];
      expect(node.pos).toEqual([100.5, 200.3, 5.0]);
    });

    it('should parse node with switch flag', () => {
      const node = parsed.nodes['12347'];
      expect(node.switch).toBe(true);
    });

    it('should parse node with signal', () => {
      const node = parsed.nodes['node_123'];
      expect(node.signal).toBeDefined();
    });

    it('should count nodes correctly', () => {
      expect(parsed.stats.nodeCount).toBe(4);
    });

    it('should calculate bounds correctly', () => {
      expect(parsed.bounds.minX).toBe(100.5);
      expect(parsed.bounds.maxX).toBe(250.0);
      expect(parsed.bounds.minY).toBe(200.3);
      expect(parsed.bounds.maxY).toBe(350.0);
    });
  });

  describe('Edge Parsing', () => {
    it('should parse all edges', () => {
      expect(parsed.edges.length).toBe(3);
    });

    it('should parse edge IDs', () => {
      expect(parsed.edges[0].id).toBe('way123_0');
    });

    it('should parse street edges', () => {
      const streetEdge = parsed.edges[0];
      expect(streetEdge.street).toBeDefined();
      expect(streetEdge.street?.type).toBe('residential');
      expect(streetEdge.street?.speed).toBe(50);
    });

    it('should parse track edges', () => {
      const trackEdge = parsed.edges[2];
      expect(trackEdge.track).toBeDefined();
      expect(trackEdge.track?.type).toBe('rail');
    });

    it('should parse bridge flag', () => {
      const bridgeEdge = parsed.edges[1];
      expect(bridgeEdge.bridge).toBe(true);
    });

    it('should count street and track edges', () => {
      expect(parsed.stats.streetEdges).toBe(2);
      expect(parsed.stats.trackEdges).toBe(1);
    });
  });

  describe('Object Parsing', () => {
    it('should parse all objects', () => {
      expect(parsed.objects.length).toBe(3);
    });

    it('should parse object types', () => {
      expect(parsed.objects[0].type).toBe('tree');
      expect(parsed.objects[1].type).toBe('traffic_light');
      expect(parsed.objects[2].type).toBe('fountain');
    });

    it('should parse object positions', () => {
      expect(parsed.objects[0].pos).toEqual([50.0, 100.0, 3.0]);
    });

    it('should count objects correctly', () => {
      expect(parsed.stats.objectCount).toBe(3);
    });
  });

  describe('Town Parsing', () => {
    it('should parse towns', () => {
      expect(parsed.towns.length).toBe(1);
    });

    it('should parse town name and position', () => {
      expect(parsed.towns[0].name).toBe('TestTown');
      expect(parsed.towns[0].pos).toEqual([150.0, 200.0]);
    });

    it('should count towns correctly', () => {
      expect(parsed.stats.townCount).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const result = parseLuaTable('');
      expect(result.stats.nodeCount).toBe(0);
      expect(result.stats.edgeCount).toBe(0);
    });

    it('should handle content without return keyword', () => {
      const content = `{
        nodes = { [1] = { pos = { 0, 0, 0 } } },
        edges = {},
        objects = {},
        towns = {},
      }`;
      const result = parseLuaTable(content);
      expect(result.stats.nodeCount).toBe(1);
    });

    it('should handle negative coordinates', () => {
      const content = `return {
        nodes = { [1] = { pos = { -100.5, -200.3, -5.0 } } },
        edges = {},
        objects = {},
        towns = {},
      }`;
      const result = parseLuaTable(content);
      expect(result.nodes['1'].pos).toEqual([-100.5, -200.3, -5.0]);
    });
  });
});

// Run tests if executed directly
if (typeof describe === 'undefined') {
  console.log('Running Lua Parser Tests...');
  const result = parseLuaTable(SAMPLE_LUA_CONTENT);
  console.log('Parsed result:');
  console.log('  Nodes:', result.stats.nodeCount);
  console.log('  Edges:', result.stats.edgeCount);
  console.log('  Objects:', result.stats.objectCount);
  console.log('  Towns:', result.stats.townCount);
  console.log('  Bounds:', result.bounds);
  console.log('\nFirst node:', Object.entries(result.nodes)[0]);
  console.log('First edge:', result.edges[0]);
  console.log('First object:', result.objects[0]);
}


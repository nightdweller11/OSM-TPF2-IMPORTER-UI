import fs from "fs/promises";

/**
 * Filter options for Lua file download
 * When a user downloads, they can choose to exclude certain data types
 */
export interface FilterOptions {
  includeRailways: boolean;
  includeStreets: boolean;
  includePaths: boolean; // footways, cycleways, etc.
  includeForests: boolean;
  includeGrounds: boolean;
  includeObjects: boolean; // trees, fountains, bollards
  includeTowns: boolean;
  includeSignals: boolean;
  includeStreams: boolean;
  
  // Specific type filters
  railTypes?: string[];     // e.g., ["rail", "tram", "subway"]
  highwayTypes?: string[];  // e.g., ["motorway", "primary", "residential"]
}

const DEFAULT_FILTER: FilterOptions = {
  includeRailways: true,
  includeStreets: true,
  includePaths: true,
  includeForests: true,
  includeGrounds: true,
  includeObjects: true,
  includeTowns: true,
  includeSignals: true,
  includeStreams: true,
};

const RAIL_TYPES = ["rail", "light_rail", "subway", "tram", "narrow_gauge", "miniature", "preserved", "disused", "construction"];
const STREET_TYPES = ["motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "living_street", "unclassified", "service", "construction", "raceway"];
const PATH_TYPES = ["pedestrian", "footway", "cycleway", "path", "track", "bridleway"];

/**
 * Read and parse a Lua data file
 * The Lua file format is essentially a Lua table that we need to parse
 */
export async function readLuaData(filePath: string): Promise<Record<string, unknown>> {
  const content = await fs.readFile(filePath, "utf-8");
  
  // Simple Lua table parser - the output format is fairly regular
  // This is a simplified parser that works for the osmdata.lua format
  return parseLuaTable(content);
}

/**
 * Simple Lua table parser
 * Handles the specific format output by luadata.write()
 */
function parseLuaTable(content: string): Record<string, unknown> {
  // The luadata library outputs valid Lua that we can parse
  // For now, we'll use a simplified approach that works with the expected format
  
  // Remove the "return" statement if present
  content = content.trim();
  if (content.startsWith("return")) {
    content = content.substring(6).trim();
  }
  
  // Use eval-like parsing (in production, use a proper Lua parser)
  // For now, we'll handle the filtering differently - by modifying during write
  
  // This is a placeholder - the actual filtering will happen at write time
  return { _raw: content };
}

/**
 * Filter and write Lua data with only the requested data types
 * This creates a new Lua file with filtered content
 */
export async function filterAndWriteLua(
  inputPath: string,
  outputPath: string,
  options: Partial<FilterOptions> = {}
): Promise<{ success: boolean; error?: string }> {
  const filter = { ...DEFAULT_FILTER, ...options };
  
  try {
    let content = await fs.readFile(inputPath, "utf-8");
    
    // Filter edges based on track/street types
    if (!filter.includeRailways) {
      // Remove all track edges
      content = removeTrackEdges(content);
    } else if (filter.railTypes && filter.railTypes.length > 0) {
      content = filterTrackTypes(content, filter.railTypes);
    }
    
    if (!filter.includeStreets && !filter.includePaths) {
      content = removeStreetEdges(content);
    } else {
      const allowedHighwayTypes: string[] = [];
      if (filter.includeStreets) {
        allowedHighwayTypes.push(...(filter.highwayTypes || STREET_TYPES));
      }
      if (filter.includePaths) {
        allowedHighwayTypes.push(...PATH_TYPES);
      }
      if (!filter.includeStreams) {
        // Remove waterstream type
        content = removeWaterstreams(content);
      }
      if (allowedHighwayTypes.length > 0) {
        content = filterHighwayTypes(content, allowedHighwayTypes);
      }
    }
    
    // Filter areas
    if (!filter.includeForests) {
      content = emptyLuaArray(content, "forests");
    }
    if (!filter.includeGrounds) {
      content = emptyLuaArray(content, "grounds");
    }
    
    // Filter objects
    if (!filter.includeObjects) {
      content = emptyLuaArray(content, "objects");
    }
    
    // Filter towns
    if (!filter.includeTowns) {
      content = emptyLuaArray(content, "towns");
    }
    
    // Filter signals (part of node data)
    if (!filter.includeSignals) {
      content = removeSignals(content);
    }
    
    await fs.writeFile(outputPath, content);
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error filtering Lua file: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

// Helper functions for Lua content manipulation

function removeTrackEdges(content: string): string {
  // Remove edges where track is not nil/false
  // This is a simplified regex-based approach
  // In the Lua format, track edges have: track = { ... }
  return content.replace(/track\s*=\s*\{[^}]+\}/g, "track = false");
}

function filterTrackTypes(content: string, allowedTypes: string[]): string {
  // Filter track edges to only include specified types
  const typePattern = allowedTypes.map(t => `"${t}"`).join("|");
  // This is simplified - a full implementation would parse the Lua properly
  return content; // TODO: Implement proper filtering
}

function removeStreetEdges(content: string): string {
  return content.replace(/street\s*=\s*\{[^}]+\}/g, "street = false");
}

function filterHighwayTypes(content: string, allowedTypes: string[]): string {
  // Filter highway types - simplified approach
  return content; // TODO: Implement proper filtering
}

function removeWaterstreams(content: string): string {
  // Remove edges with type = "waterstream"
  return content.replace(/type\s*=\s*"waterstream"/g, 'type = "removed"');
}

function emptyLuaArray(content: string, arrayName: string): string {
  // Find the array and replace its contents with empty
  const regex = new RegExp(`(${arrayName}\\s*=\\s*)\\{[^]*?\\n\\t\\}`, "g");
  return content.replace(regex, `$1{}`);
}

function removeSignals(content: string): string {
  // Remove signal data from nodes
  return content.replace(/signal\s*=\s*\{[^}]+\}/g, "signal = false");
}

/**
 * Get list of available filter options for UI
 */
export function getFilterPresets(): {
  railTypes: { value: string; label: string }[];
  highwayTypes: { value: string; label: string }[];
} {
  return {
    railTypes: RAIL_TYPES.map(t => ({
      value: t,
      label: t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    })),
    highwayTypes: [...STREET_TYPES, ...PATH_TYPES].map(t => ({
      value: t,
      label: t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    })),
  };
}


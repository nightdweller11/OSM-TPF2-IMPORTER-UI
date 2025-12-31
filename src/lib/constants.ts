// TPF2 Map Size Presets
// Exact values from: https://www.transportfever.net/lexicon/index.php?entry/297
// Standard sizes (up to 16km) are available by default
// Larger sizes require enabling "Experimental Features" in game settings
export const MAP_SIZE_PRESETS = [
  { id: "tiny", name: "Tiny", width: 2048, height: 2048, label: "2km × 2km", requiresExperimental: false },
  { id: "very_small", name: "Very Small", width: 4096, height: 4096, label: "4km × 4km", requiresExperimental: false },
  { id: "small", name: "Small", width: 8192, height: 8192, label: "8km × 8km", requiresExperimental: false },
  { id: "medium", name: "Medium", width: 12288, height: 12288, label: "12km × 12km", requiresExperimental: false },
  { id: "large", name: "Large", width: 14336, height: 14336, label: "14km × 14km", requiresExperimental: false },
  { id: "very_large", name: "Very Large", width: 16384, height: 16384, label: "16km × 16km", requiresExperimental: false },
  { id: "huge", name: "Huge", width: 20480, height: 20480, label: "20km × 20km", requiresExperimental: true },
  { id: "megalomaniac", name: "Megalomaniac", width: 24576, height: 24576, label: "24.5km × 24.5km", requiresExperimental: true },
] as const;

export type MapSizePreset = typeof MAP_SIZE_PRESETS[number];

// Instructions for enabling experimental map sizes
export const EXPERIMENTAL_MAP_INSTRUCTIONS = `To enable larger map sizes (Huge, Megalomaniac):

1. Open Transport Fever 2
2. Go to Main Menu → Settings → Game
3. Enable "Experimental Features" or "Large Maps"
4. Restart the game if prompted

⚠️ WARNING: Large maps are very demanding!
• Require 16GB+ RAM (32GB recommended)
• Significantly longer load times
• Lower FPS during gameplay
• May cause instability on some systems
• Save files will be much larger`;

// Rail Types from sort_edges.py
export const RAIL_TYPES = [
  { id: "rail", name: "Rail", description: "Standard railway tracks" },
  { id: "light_rail", name: "Light Rail", description: "Light rail/metro tracks" },
  { id: "subway", name: "Subway", description: "Underground metro tracks" },
  { id: "tram", name: "Tram", description: "Tramway/streetcar tracks" },
  { id: "narrow_gauge", name: "Narrow Gauge", description: "Narrow gauge railways" },
  { id: "miniature", name: "Miniature", description: "Miniature/heritage railways" },
  { id: "preserved", name: "Preserved", description: "Preserved/museum railways" },
  { id: "disused", name: "Disused", description: "Disused railway lines" },
  { id: "construction", name: "Under Construction", description: "Railways under construction" },
] as const;

// Highway Types from sort_edges.py
export const HIGHWAY_TYPES = [
  // Main roads
  { id: "motorway", name: "Motorway", category: "road", description: "Highways/Autobahn" },
  { id: "motorway_link", name: "Motorway Link", category: "road", description: "Highway on/off ramps" },
  { id: "trunk", name: "Trunk Road", category: "road", description: "Major arterial roads" },
  { id: "trunk_link", name: "Trunk Link", category: "road", description: "Trunk road ramps" },
  { id: "primary", name: "Primary", category: "road", description: "Primary roads" },
  { id: "primary_link", name: "Primary Link", category: "road", description: "Primary road links" },
  { id: "secondary", name: "Secondary", category: "road", description: "Secondary roads" },
  { id: "secondary_link", name: "Secondary Link", category: "road", description: "Secondary road links" },
  { id: "tertiary", name: "Tertiary", category: "road", description: "Tertiary roads" },
  { id: "tertiary_link", name: "Tertiary Link", category: "road", description: "Tertiary road links" },
  { id: "residential", name: "Residential", category: "road", description: "Residential streets" },
  { id: "living_street", name: "Living Street", category: "road", description: "Shared space streets" },
  { id: "unclassified", name: "Unclassified", category: "road", description: "Minor roads" },
  { id: "service", name: "Service", category: "road", description: "Service roads, parking" },
  // Paths
  { id: "pedestrian", name: "Pedestrian", category: "path", description: "Pedestrian zones" },
  { id: "footway", name: "Footway", category: "path", description: "Footpaths" },
  { id: "cycleway", name: "Cycleway", category: "path", description: "Bicycle paths" },
  { id: "path", name: "Path", category: "path", description: "General paths" },
  { id: "track", name: "Track", category: "path", description: "Agricultural/forestry tracks" },
  { id: "bridleway", name: "Bridleway", category: "path", description: "Horse riding paths" },
] as const;

export type RailType = typeof RAIL_TYPES[number];
export type HighwayType = typeof HIGHWAY_TYPES[number];

// Default configuration for new conversions
export const DEFAULT_CONFIG = {
  railTypes: ["rail", "light_rail", "subway", "tram"],
  highwayTypes: [
    "motorway", "motorway_link", "trunk", "trunk_link",
    "primary", "primary_link", "secondary", "secondary_link",
    "tertiary", "tertiary_link", "residential", "living_street",
    "unclassified", "service"
  ],
  includeForests: true,
  includeGrounds: true,
  includeObjects: true,
  includeTowns: true,
  includeSignals: true,
  includeStreams: true,
  includePaths: false, // Paths disabled by default (performance)
  scaleRatio: 1, // 1:1 scale by default
  includeHeightmap: false, // Heightmap is optional (requires external API)
};

// Heightmap sources
export const HEIGHTMAP_SOURCES = {
  skydark: {
    name: "Skydark Heightmap Tool",
    url: "https://heightmap.skydark.pl/",
    description: "Generate heightmaps from real elevation data",
  },
  terraining: {
    name: "Terraining (Atelier Nonta)",
    url: "https://terraining.ateliernonta.com/",
    description: "Alternative heightmap generator",
  },
};

// Heightmap instructions
export const HEIGHTMAP_INSTRUCTIONS = `Heightmaps help create realistic terrain. Without a heightmap, the map will be flat.

**How to add a heightmap:**

1. Visit one of these tools with your area coordinates:
   • Skydark: https://heightmap.skydark.pl/
   • Terraining: https://terraining.ateliernonta.com/

2. Enter the SAME coordinates as your conversion:
   • Set the map size to match your TPF2 map
   • Download the heightmap PNG

3. Place in TPF2 user maps folder:
   • Windows: %APPDATA%\\Transport Fever 2\\heightmaps\\
   • macOS: ~/Library/Application Support/Transport Fever 2/heightmaps/
   • Linux: ~/.local/share/Transport Fever 2/heightmaps/

4. When creating a new game, select your heightmap in "New Game → Map → Heightmap"

⚠️ IMPORTANT: The heightmap bounds MUST match your OSM data bounds exactly, otherwise streets/tracks won't align with the terrain!`;

// Scale ratio presets (real world : TPF2 map)
// e.g., 1:1 means 16km real world -> 16km TPF2 map
// 2:1 means 32km real world -> 16km TPF2 map (half density)
export const SCALE_RATIOS = [
  { id: "1:1", value: 1, label: "1:1 (Realistic)", description: "16km real = 16km game" },
  { id: "2:1", value: 2, label: "2:1 (Compressed)", description: "32km real = 16km game" },
  { id: "3:1", value: 3, label: "3:1 (Highly compressed)", description: "48km real = 16km game" },
  { id: "4:1", value: 4, label: "4:1 (Ultra compressed)", description: "64km real = 16km game" },
  { id: "5:1", value: 5, label: "5:1 (Maximum)", description: "80km real = 16km game" },
] as const;

export type ScaleRatio = typeof SCALE_RATIOS[number];

// Conversion status display
export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-500" },
  DOWNLOADING_OSM: { label: "Downloading OSM Data", color: "bg-blue-500" },
  PROCESSING: { label: "Processing", color: "bg-indigo-500" },
  OPTIMIZING: { label: "Optimizing", color: "bg-purple-500" },
  WRITING: { label: "Writing Output", color: "bg-cyan-500" },
  COMPLETING: { label: "Finishing Up", color: "bg-emerald-500" },
  COMPLETED: { label: "Completed", color: "bg-green-500" },
  FAILED: { label: "Failed", color: "bg-red-500" },
};


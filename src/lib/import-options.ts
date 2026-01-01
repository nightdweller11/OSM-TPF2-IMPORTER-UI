// TPF2 Lua Import Options
// These options control what gets built during the in-game import process

export interface ImportOptions {
  // General build options
  build_streets: boolean;
  build_tracks: boolean;
  build_subwaytracks: boolean;
  build_tramtracks: boolean;
  build_bridges: boolean;
  build_tunnels: boolean;
  build_signals: boolean;
  
  // Street type options
  build_autobahn: boolean;
  build_streets_street_types: boolean;
  build_streets_footway_types: boolean;
  build_streets_water: boolean;
  build_streets_airport: boolean;
  
  // Other options
  skip_nodes_outofbounds: boolean;
  crash_type_not_found: boolean;
  log_level: number;
}

export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  build_streets: true,
  build_tracks: true,
  build_subwaytracks: true,
  build_tramtracks: false,
  build_bridges: true,
  build_tunnels: false,
  build_signals: true,
  build_autobahn: true,
  build_streets_street_types: true,
  build_streets_footway_types: true,
  build_streets_water: true,
  build_streets_airport: true,
  skip_nodes_outofbounds: true,
  crash_type_not_found: true,
  log_level: 1,
};

export interface ImportOptionMeta {
  key: keyof ImportOptions;
  label: string;
  description: string;
  category: "general" | "streets" | "tracks" | "other";
  defaultValue: boolean | number;
  requiredMods?: string[];
}

export const IMPORT_OPTIONS_META: ImportOptionMeta[] = [
  // General
  {
    key: "build_streets",
    label: "Build Streets",
    description: "Build all street types (roads, paths, etc.)",
    category: "general",
    defaultValue: true,
  },
  {
    key: "build_tracks",
    label: "Build Tracks",
    description: "Build railway tracks",
    category: "general",
    defaultValue: true,
    requiredMods: ["Natural Environment Pro", "ETH Schotterbett"],
  },
  {
    key: "build_bridges",
    label: "Build Bridges",
    description: "Build bridges. Intermediate nodes are interpolated from bridge ends.",
    category: "general",
    defaultValue: true,
  },
  {
    key: "build_tunnels",
    label: "Build Tunnels",
    description: "Build tunnels. Height handling is difficult - consider building manually.",
    category: "general",
    defaultValue: false,
  },
  
  // Tracks
  {
    key: "build_subwaytracks",
    label: "Build Subway/Light Rail",
    description: "Build subway and light rail as tracks",
    category: "tracks",
    defaultValue: true,
    requiredMods: ["Vienna Fever Infrastruktur", "Eeasy Stadtbahn Construction"],
  },
  {
    key: "build_tramtracks",
    label: "Build Tram Tracks",
    description: "Build tram tracks as separate tracks. Set false to build on streets instead.",
    category: "tracks",
    defaultValue: false,
    requiredMods: ["Marc26 Tram Streets"],
  },
  {
    key: "build_signals",
    label: "Build Signals",
    description: "Build signals on tracks. Only German signals are currently supported.",
    category: "tracks",
    defaultValue: true,
  },
  
  // Streets
  {
    key: "build_autobahn",
    label: "Build Motorways",
    description: "Build motorways/highways. Disable if using melectro Autobahn mod manually.",
    category: "streets",
    defaultValue: true,
    requiredMods: ["melectro Autobahn"],
  },
  {
    key: "build_streets_street_types",
    label: "Build City Streets",
    description: "Build motorways, city streets, residential streets",
    category: "streets",
    defaultValue: true,
    requiredMods: ["RTP Roads V2", "Marc26 Tram Streets", "JoeFried Roads"],
  },
  {
    key: "build_streets_footway_types",
    label: "Build Footways/Paths",
    description: "Build pedestrian paths, cycleways, and tracks",
    category: "streets",
    defaultValue: true,
    requiredMods: ["Extended Roads Footpaths", "Lollo Street Fine Tuning", "Majuen SMP"],
  },
  {
    key: "build_streets_water",
    label: "Build Streams",
    description: "Build streams/rivers using water texture streets",
    category: "streets",
    defaultValue: true,
    requiredMods: ["Relozu Water Textures"],
  },
  {
    key: "build_streets_airport",
    label: "Build Airport Roads",
    description: "Build airport runways and taxiways",
    category: "streets",
    defaultValue: true,
    requiredMods: ["MKH Airport Roads"],
  },
  
  // Other
  {
    key: "skip_nodes_outofbounds",
    label: "Skip Out-of-Bounds",
    description: "Skip edges outside the map bounds (recommended)",
    category: "other",
    defaultValue: true,
  },
  {
    key: "crash_type_not_found",
    label: "Crash on Missing Mod",
    description: "Abort if a street/track type is not available. Disable to continue despite errors.",
    category: "other",
    defaultValue: true,
  },
];

// All required mods for the importer
export const ALL_REQUIRED_MODS = [
  // ===========================================
  // ESSENTIAL MODS (from transportfever.net)
  // ===========================================
  { name: "Forester", steamId: null, url: "https://www.transportfever.net/filebase/entry/4856-f%C3%B6rster/", required: true, description: "Required for forests (use v1.4 Interface!)", source: "tfnet" },
  { name: "Paver", steamId: null, url: "https://www.transportfever.net/filebase/entry/7713-paver-pflasterer/", required: true, description: "Required for ground surfaces", source: "tfnet" },
  { name: "RTP (Roads'n Trams Projekt)", steamId: null, url: "https://www.transportfever.net/filebase/entry/5675-roads-n-trams-projekt-rtp/", required: true, description: "Paths, farm roads, country roads", source: "tfnet" },
  
  // ESSENTIAL MODS (from Steam Workshop)
  { name: "Vienna Fever: Infrastructure", steamId: "2060012969", url: "https://steamcommunity.com/sharedfiles/filedetails/?id=2060012969", required: true, description: "Tram/metro track types", source: "steam" },
  { name: "Vienna Fever: Bridge", steamId: "2060132685", url: "https://steamcommunity.com/sharedfiles/filedetails/?id=2060132685", required: true, description: "Invisible bridges for rail crossings", source: "steam" },
  { name: "TFMR 2.0 Bridge", steamId: "2187434173", url: "https://steamcommunity.com/sharedfiles/filedetails/?id=2187434173", required: true, description: "Modern highway bridges", source: "steam" },
  
  // ===========================================
  // RECOMMENDED MODS (from transportfever.net)
  // ===========================================
  { name: "Natural Environment Pro 2", steamId: null, url: "https://www.transportfever.net/filebase/entry/5942-natural-environment-professional-2/", required: false, description: "High quality tracks & signals", source: "tfnet" },
  { name: "Joe Fried Straßenpaket", steamId: null, url: "https://www.transportfever.net/filebase/entry/5264-joe-fried-stra%C3%9Fenpaket-stra%C3%9Fengeschichte/", required: false, description: "Historical road styles", source: "tfnet" },
  { name: "Autobahnkreuz TpF2", steamId: null, url: "https://www.transportfever.net/filebase/entry/5157-autobahnkreuz-tpf2/", required: false, description: "Motorway interchanges & bridges", source: "tfnet" },
  { name: "Gleispaket 750mm/1000mm", steamId: null, url: "https://www.transportfever.net/filebase/entry/4808-gleispaket-mit-750mm-1000mm-f%C3%BCr-tpf2/", required: false, description: "Narrow gauge tracks", source: "tfnet" },
  { name: "Feldbahn Infrastruktur", steamId: null, url: "https://www.transportfever.net/filebase/entry/6512-feldbahn-infrastruktur/", required: false, description: "600mm narrow gauge", source: "tfnet" },
  
  // RECOMMENDED MODS (from Steam Workshop)
  { name: "Angier Bridge Type-1", steamId: "1939805466", url: "https://steamcommunity.com/sharedfiles/filedetails/?id=1939805466", required: false, description: "Concrete bridges", source: "steam" },
  { name: "Old Track", steamId: "1983390040", url: "https://steamcommunity.com/sharedfiles/filedetails/?id=1983390040", required: false, description: "Disused railway tracks", source: "steam" },
  { name: "Street Fine Tuning (Lollo)", steamId: "2021038808", url: "https://steamcommunity.com/sharedfiles/filedetails/?id=2021038808", required: false, description: "Narrow paths (1m wide)", source: "steam" },
  { name: "Freestyle Train Station (Lollo)", steamId: "2363493916", url: "https://steamcommunity.com/sharedfiles/filedetails/?id=2363493916", required: false, description: "Pedestrian bridges", source: "steam" },
  { name: "Extended Roads Footpaths", steamId: "1968514713", url: "https://steamcommunity.com/sharedfiles/filedetails/?id=1968514713", required: false, description: "Additional footpath styles", source: "steam" },
  { name: "SMP 2.0", steamId: "1943578742", url: "https://steamcommunity.com/workshop/filedetails/?id=1943578742", required: false, description: "Pedestrian zones, bike lanes", source: "steam" },
  { name: "Marc's Street and Trampack", steamId: "1933747406", url: "https://steamcommunity.com/sharedfiles/filedetails/?id=1933747406", required: false, description: "Streets with tram tracks", source: "steam" },
  { name: "Berlin Stadtbahn Viaduct", steamId: "2258619623", url: "https://steamcommunity.com/sharedfiles/filedetails/?id=2258619623", required: false, description: "Third rail (power rail) tracks", source: "steam" },
  { name: "Ballast", steamId: "2072274420", url: "https://steamcommunity.com/workshop/filedetails/?id=2072274420", required: false, description: "Track ballast textures", source: "steam" },
];

/**
 * Generate Lua options table string
 */
export function generateOptionsLua(options: ImportOptions): string {
  return `options = {
    build_streets = ${options.build_streets},
    build_tracks = ${options.build_tracks},
    build_subwaytracks = ${options.build_subwaytracks},
    build_tramtracks = ${options.build_tramtracks},
    build_bridges = ${options.build_bridges},
    build_tunnels = ${options.build_tunnels},
    build_signals = ${options.build_signals},
    build_autobahn = ${options.build_autobahn},
    build_streets_street_types = ${options.build_streets_street_types},
    build_streets_footway_types = ${options.build_streets_footway_types},
    build_streets_water = ${options.build_streets_water},
    build_streets_airport = ${options.build_streets_airport},
    skip_nodes_outofbounds = ${options.skip_nodes_outofbounds},
    crash_type_not_found = ${options.crash_type_not_found},
    log_level = ${options.log_level},
}`;
}

/**
 * Generate console commands for the import process
 */
export function generateConsoleCommands(conversionName: string, options: ImportOptions): string {
  const optionsLua = generateOptionsLua(options);
  
  return `-- ============================================
-- OSM-TPF2 Importer Console Commands
-- Conversion: ${conversionName}
-- Generated: ${new Date().toISOString()}
-- ============================================
-- IMPORTANT: Pause the game before starting!
-- Run each step in order, waiting for completion.
-- ============================================

-- ==================== STEP 0: Initialize ====================
-- Enter in BOTH UG Console AND Script Thread:
require "osm_importer.main"

-- Or use this workaround for Script Thread:
-- m.scriptevent.ScriptEvent("require-osm_importer.main")


-- ==================== STEP 1: Town Labels ====================
-- Enter in UG Console:
m.towns.createTownLabels(osmdata.towns)

-- Enter in Script Thread (or use workaround):
m.scriptevent.ScriptEvent("setAllTownsDevActive-false")
m.scriptevent.ScriptEvent("bulldoze.delEdges")

-- Remove leftover trees (UG Console):
bulldoze.delAssets()


-- ==================== STEP 2: Forests & Surfaces ====================
-- This may take a while - be patient!
-- Enter in Script Thread:
m.areas.buildAreas(osmdata.areas, osmdata.nodes)

-- Or use workaround in UG Console:
-- m.scriptevent.ScriptEvent("areas.buildAreas")


-- ==================== STEP 3: Streets & Tracks ====================
-- Paste this options table in UG Console:
${optionsLua}

-- Then start the construction:
m.simpleproposalseq.SimpleProposalSeq(osmdata, options)

-- To stop the process if needed:
-- m.simpleproposalseq.stop=true


-- ==================== STEP 4: Objects ====================
-- After Step 3 completes, enter in UG Console:
m.models.buildObjects(osmdata.objects)


-- ==================== DONE! ====================
-- Check stdout.txt for any errors.
-- Search for "WARNING" and "ERROR" messages.

-- To reload Lua files after changes:
-- m.reload()
`;
}

/**
 * Get required mods based on selected options
 */
export function getRequiredMods(options: ImportOptions): typeof ALL_REQUIRED_MODS {
  const required = ALL_REQUIRED_MODS.filter(mod => mod.required);
  const optional: typeof ALL_REQUIRED_MODS = [];
  
  for (const meta of IMPORT_OPTIONS_META) {
    if (options[meta.key] && meta.requiredMods) {
      for (const modName of meta.requiredMods) {
        const mod = ALL_REQUIRED_MODS.find(m => m.name === modName);
        if (mod && !required.includes(mod) && !optional.includes(mod)) {
          optional.push(mod);
        }
      }
    }
  }
  
  return [...required, ...optional];
}

/**
 * Estimate import time based on edge count
 */
export function estimateImportTime(edgeCount: number): { seconds: number; formatted: string } {
  // From the Lua code: "Estimated Time: edges / 5 / 60 minutes"
  const seconds = edgeCount / 5;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  let formatted: string;
  if (hours > 0) {
    formatted = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    formatted = `${minutes} minutes`;
  } else {
    formatted = `${Math.ceil(seconds)} seconds`;
  }
  
  return { seconds, formatted };
}


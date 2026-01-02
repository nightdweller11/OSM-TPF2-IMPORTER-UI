"use client";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MAP_SIZE_PRESETS, RAIL_TYPES, HIGHWAY_TYPES, SCALE_RATIOS, EXPERIMENTAL_MAP_INSTRUCTIONS, HEIGHTMAP_INSTRUCTIONS } from "@/lib/constants";
import { Train, Car, TreePine, Building, Signpost, Scaling, AlertTriangle, Info, ChevronDown, ChevronUp, Mountain, ExternalLink, Armchair, Bus, Umbrella, Bike, Lamp, CircleDot, Droplets, OctagonX, TriangleAlert, Cone } from "lucide-react";
import { useState } from "react";

export interface ConversionConfig {
  mapPreset: string;
  mapWidth: number;
  mapHeight: number;
  scaleRatio: number;
  railTypes: string[];
  highwayTypes: string[];
  includeForests: boolean;
  includeGrounds: boolean;
  includeObjects: boolean;
  includeTowns: boolean;
  includeSignals: boolean;
  includeStreams: boolean;
  includePaths: boolean;
  generateHeightmap: boolean;  // Auto-generate heightmap from elevation data
  // Decorative objects
  includeTrees: boolean;
  includeBenches: boolean;
  includeBusStops: boolean;
  includeShelters: boolean;
  includeBikeRacks: boolean;
  includeStreetLamps: boolean;
  includeBollards: boolean;
  includeFountains: boolean;
  // Traffic infrastructure
  includeTrafficLights: boolean;
  includeStopSigns: boolean;
  includeYieldSigns: boolean;
  includeCrossings: boolean;
}

interface ConfigPanelProps {
  config: ConversionConfig;
  onChange: (config: ConversionConfig) => void;
}

export function ConfigPanel({ config, onChange }: ConfigPanelProps) {
  const [showExperimentalInfo, setShowExperimentalInfo] = useState(false);
  const [showHeightmapInfo, setShowHeightmapInfo] = useState(false);
  
  // Check if current map size requires experimental features
  const currentPreset = MAP_SIZE_PRESETS.find((p) => p.id === config.mapPreset);
  const isExperimental = currentPreset?.requiresExperimental ?? false;
  
  const handleMapSizeChange = (presetId: string) => {
    const preset = MAP_SIZE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      onChange({
        ...config,
        mapPreset: presetId,
        mapWidth: preset.width,
        mapHeight: preset.height,
      });
    }
  };

  const handleScaleChange = (ratioId: string) => {
    const ratio = SCALE_RATIOS.find((r) => r.id === ratioId);
    if (ratio) {
      onChange({
        ...config,
        scaleRatio: ratio.value,
      });
    }
  };

  // Calculate the real-world area based on map size and scale
  const realWorldWidth = config.mapWidth * config.scaleRatio;
  const realWorldHeight = config.mapHeight * config.scaleRatio;

  const toggleRailType = (typeId: string) => {
    const newTypes = config.railTypes.includes(typeId)
      ? config.railTypes.filter((t) => t !== typeId)
      : [...config.railTypes, typeId];
    onChange({ ...config, railTypes: newTypes });
  };

  const toggleHighwayType = (typeId: string) => {
    const newTypes = config.highwayTypes.includes(typeId)
      ? config.highwayTypes.filter((t) => t !== typeId)
      : [...config.highwayTypes, typeId];
    onChange({ ...config, highwayTypes: newTypes });
  };

  const toggleAll = (category: "rail" | "highway", enable: boolean) => {
    if (category === "rail") {
      onChange({
        ...config,
        railTypes: enable ? RAIL_TYPES.map((t) => t.id) : [],
      });
    } else {
      onChange({
        ...config,
        highwayTypes: enable ? HIGHWAY_TYPES.map((t) => t.id) : [],
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Map Size */}
      <Card className={isExperimental ? "border-amber-500/50" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="h-4 w-4" />
            Map Size
            {isExperimental && (
              <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
                Experimental
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={config.mapPreset} onValueChange={handleMapSizeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select map size" />
            </SelectTrigger>
            <SelectContent>
              {MAP_SIZE_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{preset.name}</span>
                    <span className="text-muted-foreground">
                      ({preset.label})
                    </span>
                    {preset.requiresExperimental && (
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <p className="text-xs text-muted-foreground">
            TPF2 map dimensions: {config.mapWidth.toLocaleString()}m ×{" "}
            {config.mapHeight.toLocaleString()}m
          </p>
          
          {/* Experimental warning */}
          {isExperimental && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    Experimental Map Size
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This size requires enabling experimental features in TPF2 settings
                    and is very resource-intensive.
                  </p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => setShowExperimentalInfo(!showExperimentalInfo)}
                className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline"
              >
                <Info className="h-3 w-3" />
                How to enable large maps
                {showExperimentalInfo ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              
              {showExperimentalInfo && (
                <pre className="text-xs bg-background/50 rounded p-2 whitespace-pre-wrap font-mono">
                  {EXPERIMENTAL_MAP_INSTRUCTIONS}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scale Ratio */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Scaling className="h-4 w-4" />
            Scale Ratio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select 
            value={SCALE_RATIOS.find(r => r.value === config.scaleRatio)?.id || "1:1"} 
            onValueChange={handleScaleChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select scale ratio" />
            </SelectTrigger>
            <SelectContent>
              {SCALE_RATIOS.map((ratio) => (
                <SelectItem key={ratio.id} value={ratio.id}>
                  <span className="font-medium">{ratio.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground mt-2 space-y-1">
            <p>
              Real-world selection: {(realWorldWidth / 1000).toFixed(1)}km ×{" "}
              {(realWorldHeight / 1000).toFixed(1)}km
            </p>
            <p className="text-amber-600 dark:text-amber-400">
              {config.scaleRatio > 1 && (
                <>⚠️ Scale {config.scaleRatio}:1 compresses {config.scaleRatio}× more area into the map</>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Heightmap Generation */}
      <Card className="border-blue-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mountain className="h-4 w-4" />
            Terrain Heightmap
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="generateHeightmap"
              checked={config.generateHeightmap}
              onCheckedChange={(checked) =>
                onChange({ ...config, generateHeightmap: checked === true })
              }
            />
            <div className="space-y-1">
              <Label htmlFor="generateHeightmap" className="font-medium cursor-pointer">
                Generate Heightmap Automatically
              </Label>
              <p className="text-xs text-muted-foreground">
                Downloads real elevation data and creates a TPF2-compatible heightmap PNG.
                Creates realistic terrain with hills, valleys, and water areas.
              </p>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <p className="font-medium mb-1">Without heightmap:</p>
            <p>• Map will be completely flat</p>
            <p>• Streets/tracks will work but terrain won&apos;t match reality</p>
          </div>
          
          <button
            type="button"
            onClick={() => setShowHeightmapInfo(!showHeightmapInfo)}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Info className="h-3 w-3" />
            Manual heightmap alternatives
            {showHeightmapInfo ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          
          {showHeightmapInfo && (
            <div className="space-y-2 text-xs">
              <p className="text-muted-foreground">External tools for higher quality heightmaps:</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://heightmap.skydark.pl/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Skydark
                </a>
                <span className="text-muted-foreground">•</span>
                <a
                  href="https://terraining.ateliernonta.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Terraining
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rail Types */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Train className="h-4 w-4" />
              Railways
            </CardTitle>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => toggleAll("rail", true)}
                className="text-primary hover:underline"
              >
                All
              </button>
              <span className="text-muted-foreground">/</span>
              <button
                type="button"
                onClick={() => toggleAll("rail", false)}
                className="text-primary hover:underline"
              >
                None
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {RAIL_TYPES.map((type) => (
              <div key={type.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`rail-${type.id}`}
                  checked={config.railTypes.includes(type.id)}
                  onCheckedChange={() => toggleRailType(type.id)}
                />
                <Label
                  htmlFor={`rail-${type.id}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {type.name}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Highway Types */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4" />
              Streets & Roads
            </CardTitle>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => toggleAll("highway", true)}
                className="text-primary hover:underline"
              >
                All
              </button>
              <span className="text-muted-foreground">/</span>
              <button
                type="button"
                onClick={() => toggleAll("highway", false)}
                className="text-primary hover:underline"
              >
                None
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Roads */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Roads</p>
              <div className="grid grid-cols-2 gap-2">
                {HIGHWAY_TYPES.filter((t) => t.category === "road").map(
                  (type) => (
                    <div key={type.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`highway-${type.id}`}
                        checked={config.highwayTypes.includes(type.id)}
                        onCheckedChange={() => toggleHighwayType(type.id)}
                      />
                      <Label
                        htmlFor={`highway-${type.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {type.name}
                      </Label>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Paths */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Paths</p>
              <div className="grid grid-cols-2 gap-2">
                {HIGHWAY_TYPES.filter((t) => t.category === "path").map(
                  (type) => (
                    <div key={type.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`highway-${type.id}`}
                        checked={config.highwayTypes.includes(type.id)}
                        onCheckedChange={() => toggleHighwayType(type.id)}
                      />
                      <Label
                        htmlFor={`highway-${type.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {type.name}
                      </Label>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Areas & Environment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TreePine className="h-4 w-4" />
            Areas & Environment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="forests"
                checked={config.includeForests}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeForests: checked === true })
                }
              />
              <Label htmlFor="forests" className="text-sm font-normal cursor-pointer">
                Forests
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="grounds"
                checked={config.includeGrounds}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeGrounds: checked === true })
                }
              />
              <Label htmlFor="grounds" className="text-sm font-normal cursor-pointer">
                Ground Surfaces
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="streams"
                checked={config.includeStreams}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeStreams: checked === true })
                }
              />
              <Label htmlFor="streams" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <Droplets className="h-3 w-3" />
                Streams/Rivers
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="towns"
                checked={config.includeTowns}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeTowns: checked === true })
                }
              />
              <Label htmlFor="towns" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <Building className="h-3 w-3" />
                Town Labels
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="signals"
                checked={config.includeSignals}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeSignals: checked === true })
                }
              />
              <Label htmlFor="signals" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <Signpost className="h-3 w-3" />
                Railway Signals
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Decorative Objects */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Armchair className="h-4 w-4" />
              Decorative Objects
            </CardTitle>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => onChange({
                  ...config,
                  includeObjects: true,
                  includeTrees: true,
                  includeBenches: true,
                  includeBusStops: true,
                  includeShelters: true,
                  includeBikeRacks: true,
                  includeStreetLamps: true,
                  includeBollards: true,
                  includeFountains: true,
                  includeTrafficLights: true,
                  includeStopSigns: true,
                  includeYieldSigns: true,
                  includeCrossings: true,
                })}
                className="text-primary hover:underline"
              >
                All
              </button>
              <span className="text-muted-foreground">/</span>
              <button
                type="button"
                onClick={() => onChange({
                  ...config,
                  includeObjects: false,
                  includeTrees: false,
                  includeBenches: false,
                  includeBusStops: false,
                  includeShelters: false,
                  includeBikeRacks: false,
                  includeStreetLamps: false,
                  includeBollards: false,
                  includeFountains: false,
                  includeTrafficLights: false,
                  includeStopSigns: false,
                  includeYieldSigns: false,
                  includeCrossings: false,
                })}
                className="text-primary hover:underline"
              >
                None
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="trees"
                checked={config.includeTrees}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeTrees: checked === true })
                }
              />
              <Label htmlFor="trees" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <TreePine className="h-3 w-3" />
                Trees
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fountains"
                checked={config.includeFountains}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeFountains: checked === true })
                }
              />
              <Label htmlFor="fountains" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <Droplets className="h-3 w-3" />
                Fountains
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="benches"
                checked={config.includeBenches}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeBenches: checked === true })
                }
              />
              <Label htmlFor="benches" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <Armchair className="h-3 w-3" />
                Benches
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="busStops"
                checked={config.includeBusStops}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeBusStops: checked === true })
                }
              />
              <Label htmlFor="busStops" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <Bus className="h-3 w-3" />
                Bus Stops
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="shelters"
                checked={config.includeShelters}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeShelters: checked === true })
                }
              />
              <Label htmlFor="shelters" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <Umbrella className="h-3 w-3" />
                Transit Shelters
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="bikeRacks"
                checked={config.includeBikeRacks}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeBikeRacks: checked === true })
                }
              />
              <Label htmlFor="bikeRacks" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <Bike className="h-3 w-3" />
                Bike Racks
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="streetLamps"
                checked={config.includeStreetLamps}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeStreetLamps: checked === true })
                }
              />
              <Label htmlFor="streetLamps" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <Lamp className="h-3 w-3" />
                Street Lamps
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="bollards"
                checked={config.includeBollards}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeBollards: checked === true })
                }
              />
              <Label htmlFor="bollards" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <CircleDot className="h-3 w-3" />
                Bollards
              </Label>
            </div>
          </div>
          
          {/* Traffic Infrastructure subsection */}
          <div className="border-t pt-3 mt-3">
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Signpost className="h-3 w-3" />
              Traffic Infrastructure
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="trafficLights"
                  checked={config.includeTrafficLights}
                  onCheckedChange={(checked) =>
                    onChange({ ...config, includeTrafficLights: checked === true })
                  }
                />
                <Label htmlFor="trafficLights" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                  <Cone className="h-3 w-3" />
                  Traffic Lights
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="stopSigns"
                  checked={config.includeStopSigns}
                  onCheckedChange={(checked) =>
                    onChange({ ...config, includeStopSigns: checked === true })
                  }
                />
                <Label htmlFor="stopSigns" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                  <OctagonX className="h-3 w-3" />
                  Stop Signs
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="yieldSigns"
                  checked={config.includeYieldSigns}
                  onCheckedChange={(checked) =>
                    onChange({ ...config, includeYieldSigns: checked === true })
                  }
                />
                <Label htmlFor="yieldSigns" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                  <TriangleAlert className="h-3 w-3" />
                  Yield Signs
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="crossings"
                  checked={config.includeCrossings}
                  onCheckedChange={(checked) =>
                    onChange({ ...config, includeCrossings: checked === true })
                  }
                />
                <Label htmlFor="crossings" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                  <Signpost className="h-3 w-3" />
                  Crossings
                </Label>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-3">
            Some objects require additional mods to be installed in TPF2.
            Missing objects will be skipped during import.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


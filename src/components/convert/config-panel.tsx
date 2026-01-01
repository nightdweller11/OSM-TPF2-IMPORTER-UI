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
import { Train, Car, TreePine, Building, Signpost, Scaling, AlertTriangle, Info, ChevronDown, ChevronUp, Mountain, ExternalLink } from "lucide-react";
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
                onClick={() => toggleAll("rail", true)}
                className="text-primary hover:underline"
              >
                All
              </button>
              <span className="text-muted-foreground">/</span>
              <button
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
                onClick={() => toggleAll("highway", true)}
                className="text-primary hover:underline"
              >
                All
              </button>
              <span className="text-muted-foreground">/</span>
              <button
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

      {/* Other Options */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TreePine className="h-4 w-4" />
            Additional Data
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
                Ground surfaces
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="objects"
                checked={config.includeObjects}
                onCheckedChange={(checked) =>
                  onChange({ ...config, includeObjects: checked === true })
                }
              />
              <Label htmlFor="objects" className="text-sm font-normal cursor-pointer">
                Objects (trees, etc.)
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
              <Label htmlFor="towns" className="text-sm font-normal cursor-pointer">
                Town labels
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
                Signals
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
              <Label htmlFor="streams" className="text-sm font-normal cursor-pointer">
                Streams/Rivers
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


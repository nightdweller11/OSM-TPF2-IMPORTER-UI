"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ImportOptions,
  DEFAULT_IMPORT_OPTIONS,
  IMPORT_OPTIONS_META,
  generateOptionsLua,
  generateConsoleCommands,
  getRequiredMods,
  estimateImportTime,
  ALL_REQUIRED_MODS,
} from "@/lib/import-options";
import {
  Train,
  Car,
  Settings2,
  Copy,
  Check,
  ExternalLink,
  Package,
  Clock,
  Download,
  ChevronDown,
  ChevronUp,
  Building2,
  TreePine,
} from "lucide-react";

interface ImportOptionsPanelProps {
  conversionName: string;
  edgeCount?: number;
  onOptionsChange?: (options: ImportOptions) => void;
}

export function ImportOptionsPanel({
  conversionName,
  edgeCount,
  onOptionsChange,
}: ImportOptionsPanelProps) {
  const [options, setOptions] = useState<ImportOptions>(DEFAULT_IMPORT_OPTIONS);
  const [copied, setCopied] = useState<string | null>(null);
  const [showMods, setShowMods] = useState(false);
  const [showCommands, setShowCommands] = useState(true); // Show by default

  const handleOptionChange = (key: keyof ImportOptions, value: boolean) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);
    onOptionsChange?.(newOptions);
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const requiredMods = getRequiredMods(options);
  const optionsLua = generateOptionsLua(options);
  const consoleCommands = generateConsoleCommands(conversionName, options);
  const timeEstimate = edgeCount ? estimateImportTime(edgeCount) : null;

  const categorizedOptions = {
    general: IMPORT_OPTIONS_META.filter((m) => m.category === "general"),
    tracks: IMPORT_OPTIONS_META.filter((m) => m.category === "tracks"),
    streets: IMPORT_OPTIONS_META.filter((m) => m.category === "streets"),
    towns: IMPORT_OPTIONS_META.filter((m) => m.category === "towns"),
    other: IMPORT_OPTIONS_META.filter((m) => m.category === "other"),
  };

  return (
    <div className="space-y-4">
      {/* Time Estimate */}
      {timeEstimate && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium">Estimated Import Time</p>
                <p className="text-sm text-muted-foreground">
                  ~{timeEstimate.formatted} for {edgeCount?.toLocaleString()} edges
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Options */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Import Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* General Options */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              General
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              {categorizedOptions.general.map((meta) => (
                <div key={meta.key} className="flex items-start space-x-2">
                  <Checkbox
                    id={meta.key}
                    checked={options[meta.key] as boolean}
                    onCheckedChange={(checked) =>
                      handleOptionChange(meta.key, checked === true)
                    }
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label
                      htmlFor={meta.key}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {meta.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Track Options */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Train className="h-4 w-4" />
              Tracks
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              {categorizedOptions.tracks.map((meta) => (
                <div key={meta.key} className="flex items-start space-x-2">
                  <Checkbox
                    id={meta.key}
                    checked={options[meta.key] as boolean}
                    onCheckedChange={(checked) =>
                      handleOptionChange(meta.key, checked === true)
                    }
                    disabled={!options.build_tracks && meta.key !== "build_tracks"}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label
                      htmlFor={meta.key}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {meta.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Street Options */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Car className="h-4 w-4" />
              Streets
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              {categorizedOptions.streets.map((meta) => (
                <div key={meta.key} className="flex items-start space-x-2">
                  <Checkbox
                    id={meta.key}
                    checked={options[meta.key] as boolean}
                    onCheckedChange={(checked) =>
                      handleOptionChange(meta.key, checked === true)
                    }
                    disabled={!options.build_streets}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label
                      htmlFor={meta.key}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {meta.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Towns & Buildings Options */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Towns & Buildings
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              {categorizedOptions.towns.map((meta) => (
                <div key={meta.key} className="flex items-start space-x-2">
                  <Checkbox
                    id={meta.key}
                    checked={options[meta.key] as boolean}
                    onCheckedChange={(checked) =>
                      handleOptionChange(meta.key, checked === true)
                    }
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label
                      htmlFor={meta.key}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {meta.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Other Options */}
          <div>
            <h4 className="text-sm font-medium mb-3">Other</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              {categorizedOptions.other.map((meta) => (
                <div key={meta.key} className="flex items-start space-x-2">
                  <Checkbox
                    id={meta.key}
                    checked={options[meta.key] as boolean}
                    onCheckedChange={(checked) =>
                      handleOptionChange(meta.key, checked === true)
                    }
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label
                      htmlFor={meta.key}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {meta.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Required Mods */}
      <Card>
        <CardHeader className="pb-3">
          <button
            onClick={() => setShowMods(!showMods)}
            className="w-full flex items-center justify-between"
          >
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Required Mods ({requiredMods.length})
            </CardTitle>
            {showMods ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
        </CardHeader>
        {showMods && (
          <CardContent>
            <div className="space-y-2">
              {requiredMods.map((mod) => (
                <div
                  key={mod.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {mod.name}
                      {mod.required && (
                        <span className="ml-2 text-xs text-red-500">(Required)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {mod.description}
                    </p>
                  </div>
                  <a
                    href={mod.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-sm"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Console Commands */}
      <Card>
        <CardHeader className="pb-3">
          <button
            onClick={() => setShowCommands(!showCommands)}
            className="w-full flex items-center justify-between"
          >
            <CardTitle className="text-lg flex items-center gap-2">
              Console Commands
            </CardTitle>
            {showCommands ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </button>
        </CardHeader>
        {showCommands && (
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Copy these commands to run in the TPF2 console. Follow the steps in order.
            </p>
            
            <div className="relative">
              <pre className="p-4 rounded-lg bg-zinc-900 text-zinc-100 text-xs overflow-x-auto max-h-[400px] overflow-y-auto">
                {consoleCommands}
              </pre>
              <div className="absolute top-2 right-2 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(consoleCommands, "commands")}
                >
                  {copied === "commands" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    downloadFile(
                      consoleCommands,
                      `${conversionName.replace(/\s+/g, "_")}_commands.lua`
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Quick copy buttons */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Quick Copy:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard('require "osm_importer.main"', "init")
                  }
                >
                  {copied === "init" ? <Check className="h-3 w-3 mr-1" /> : null}
                  Step 0: Init
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      "m.towns.createTownLabels(osmdata.towns)",
                      "towns"
                    )
                  }
                >
                  {copied === "towns" ? <Check className="h-3 w-3 mr-1" /> : null}
                  Step 1: Towns
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      "m.areas.buildAreas(osmdata.areas, osmdata.nodes)",
                      "areas"
                    )
                  }
                >
                  {copied === "areas" ? <Check className="h-3 w-3 mr-1" /> : null}
                  Step 2: Areas
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      `${optionsLua}\nm.simpleproposalseq.SimpleProposalSeq(osmdata, options)`,
                      "edges"
                    )
                  }
                >
                  {copied === "edges" ? <Check className="h-3 w-3 mr-1" /> : null}
                  Step 3: Edges
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      "m.models.buildObjects(osmdata.objects)",
                      "objects"
                    )
                  }
                >
                  {copied === "objects" ? (
                    <Check className="h-3 w-3 mr-1" />
                  ) : null}
                  Step 4: Objects
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Download Settings */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() =>
            downloadFile(
              optionsLua,
              `${conversionName.replace(/\s+/g, "_")}_options.lua`
            )
          }
        >
          <Download className="h-4 w-4 mr-2" />
          Download Options
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() =>
            downloadFile(
              consoleCommands,
              `${conversionName.replace(/\s+/g, "_")}_commands.lua`
            )
          }
        >
          <Download className="h-4 w-4 mr-2" />
          Download Commands
        </Button>
      </div>
    </div>
  );
}


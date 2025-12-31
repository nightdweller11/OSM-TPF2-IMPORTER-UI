"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  RefreshCw,
  MapPin,
  Train,
  TreePine,
  Building,
  Car,
  Signpost,
  Clock,
  Globe,
  FileCode,
  Sparkles,
  Database,
  Wrench,
  FileOutput,
  ArrowRight,
  Terminal,
  ChevronDown,
  ChevronUp,
  Calendar,
  Ruler,
  Copy,
  Check,
} from "lucide-react";
import { formatNumber, formatCoordinate } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";
import { ImportOptionsPanel } from "@/components/import/import-options-panel";
import { 
  generateConsoleCommands, 
  DEFAULT_IMPORT_OPTIONS,
  ALL_REQUIRED_MODS,
} from "@/lib/import-options";

// Dynamic import for map (no SSR)
const ConversionMap = dynamic(
  () => import("./conversion-map").then((mod) => mod.ConversionMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] bg-muted rounded-lg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

// Phase configuration for progress display
const PHASE_CONFIG: Record<string, {
  icon: React.ReactNode;
  label: string;
  color: string;
}> = {
  init: { icon: <Wrench className="h-3 w-3" />, label: "Initializing", color: "text-gray-500" },
  downloading: { icon: <Globe className="h-3 w-3" />, label: "Downloading OSM", color: "text-blue-500" },
  parsing: { icon: <FileCode className="h-3 w-3" />, label: "Parsing XML", color: "text-purple-500" },
  converting: { icon: <Sparkles className="h-3 w-3" />, label: "Converting", color: "text-orange-500" },
  optimizing: { icon: <Wrench className="h-3 w-3" />, label: "Optimizing", color: "text-cyan-500" },
  sorting: { icon: <Database className="h-3 w-3" />, label: "Sorting", color: "text-indigo-500" },
  cleanup: { icon: <Wrench className="h-3 w-3" />, label: "Cleaning Up", color: "text-gray-500" },
  writing: { icon: <FileOutput className="h-3 w-3" />, label: "Writing Output", color: "text-green-500" },
  complete: { icon: <CheckCircle2 className="h-3 w-3" />, label: "Complete", color: "text-green-600" },
};

interface ConversionLog {
  timestamp: string;
  type: "phase" | "step" | "info" | "error" | "stats" | "estimate";
  message: string;
  percent?: number;
  details?: Record<string, unknown>;
}

interface ConversionStats {
  nodes: number;
  edges: number;
  towns: number;
  areas: number;
  objects: number;
}

interface ConversionData {
  id: string;
  name: string;
  description?: string;
  status: string;
  progress: number;
  errorMsg?: string;
  centerLat: number;
  centerLon: number;
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
  mapWidth: number;
  mapHeight: number;
  mapPreset?: string;
  config?: Record<string, unknown>;
  stats?: ConversionStats;
  downloads?: number;
  createdAt: string;
  completedAt?: string;
}

interface DownloadFilters {
  includeRailways: boolean;
  includeStreets: boolean;
  includePaths: boolean;
  includeForests: boolean;
  includeGrounds: boolean;
  includeObjects: boolean;
  includeTowns: boolean;
  includeSignals: boolean;
  includeStreams: boolean;
}

interface ConversionDetailsProps {
  conversionId: string;
  /** If true, polls for live updates during processing */
  isLive?: boolean;
  /** If true, shows minimal UI (for embedding) */
  compact?: boolean;
  /** Callback when conversion completes */
  onComplete?: () => void;
  /** Show back link to gallery */
  showBackLink?: boolean;
}

export function ConversionDetails({
  conversionId,
  isLive = false,
  compact = false,
  onComplete,
  showBackLink = false,
}: ConversionDetailsProps) {
  const [conversion, setConversion] = useState<ConversionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<ConversionLog[]>([]);
  const [currentPhase, setCurrentPhase] = useState("init");
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showLogs, setShowLogs] = useState(true);
  const [showImportOptions, setShowImportOptions] = useState(true);
  const [showCommands, setShowCommands] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [filters, setFilters] = useState<DownloadFilters>({
    includeRailways: true,
    includeStreets: true,
    includePaths: true,
    includeForests: true,
    includeGrounds: true,
    includeObjects: true,
    includeTowns: true,
    includeSignals: true,
    includeStreams: true,
  });
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Track elapsed time
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      if (conversion && conversion.status !== "COMPLETED" && conversion.status !== "FAILED") {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [conversion?.status, isLive]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch conversion details
        const convResponse = await fetch(`/api/conversions/${conversionId}`);
        if (convResponse.ok) {
          const convData = await convResponse.json();
          setConversion(convData.conversion);

          // Update phase based on status
          if (convData.conversion.status === "DOWNLOADING_OSM") {
            setCurrentPhase("downloading");
          } else if (convData.conversion.status === "PROCESSING") {
            setCurrentPhase("converting");
          } else if (convData.conversion.status === "OPTIMIZING") {
            setCurrentPhase("optimizing");
          } else if (convData.conversion.status === "COMPLETED") {
            setCurrentPhase("complete");
          }

          if (convData.conversion.status === "COMPLETED" || convData.conversion.status === "FAILED") {
            if (onComplete) onComplete();
          }
        }

        // Fetch logs if live or has logs
        if (isLive || logs.length > 0) {
          const logsResponse = await fetch(`/api/conversions/${conversionId}/logs`);
          if (logsResponse.ok) {
            const logsData = await logsResponse.json();
            if (logsData.logs && logsData.logs.length > 0) {
              setLogs(logsData.logs);

              // Extract current phase from logs
              const phaseLog = [...logsData.logs].reverse().find((l: ConversionLog) => l.type === "phase");
              if (phaseLog) {
                const phaseMatch = phaseLog.message?.toLowerCase();
                if (phaseMatch?.includes("download")) setCurrentPhase("downloading");
                else if (phaseMatch?.includes("pars")) setCurrentPhase("parsing");
                else if (phaseMatch?.includes("convert")) setCurrentPhase("converting");
                else if (phaseMatch?.includes("optim")) setCurrentPhase("optimizing");
                else if (phaseMatch?.includes("sort")) setCurrentPhase("sorting");
                else if (phaseMatch?.includes("clean")) setCurrentPhase("cleanup");
                else if (phaseMatch?.includes("writ")) setCurrentPhase("writing");
                else if (phaseMatch?.includes("complete")) setCurrentPhase("complete");
                else if (phaseMatch?.includes("python")) setCurrentPhase("converting");
              }

              // Extract time estimate
              const estimateLog = logsData.logs.find((l: ConversionLog) => l.type === "estimate");
              if (estimateLog && estimateLog.message) {
                const match = estimateLog.message.match(/(\d+)\s*minute/);
                if (match) {
                  setEstimatedTime(parseInt(match[1]) * 60);
                }
              }
            }

            // Update progress from live data
            if (logsData.progress && logsData.progress.percent) {
              setConversion((prev) =>
                prev ? { ...prev, progress: logsData.progress.percent } : prev
              );
            }
          }
        }
      } catch (error) {
        console.error("Error fetching conversion data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Poll for updates if live
    if (isLive) {
      const interval = setInterval(() => {
        if (conversion?.status !== "COMPLETED" && conversion?.status !== "FAILED") {
          fetchData();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [conversionId, conversion?.status, isLive, onComplete]);

  const buildDownloadUrl = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      params.set(key, value.toString());
    });
    return `/api/conversions/${conversionId}/download?${params.toString()}`;
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Generate console commands with default options
  const consoleCommands = conversion ? generateConsoleCommands(conversion.name, DEFAULT_IMPORT_OPTIONS) : "";

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  if (isLoading || !conversion) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[conversion.status] || { label: conversion.status, color: "bg-gray-500" };
  const isComplete = conversion.status === "COMPLETED";
  const isFailed = conversion.status === "FAILED";
  const isProcessing = !isComplete && !isFailed;
  const phaseInfo = PHASE_CONFIG[currentPhase] || PHASE_CONFIG.init;

  // Calculate real-world area
  const scaleRatio = (conversion.config?.scaleRatio as number) || 1;
  const realWorldWidth = conversion.mapWidth * scaleRatio;
  const realWorldHeight = conversion.mapHeight * scaleRatio;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            {isComplete && <CheckCircle2 className="h-6 w-6 text-green-500" />}
            {isFailed && <XCircle className="h-6 w-6 text-red-500" />}
            {isProcessing && <Loader2 className="h-6 w-6 animate-spin text-blue-500" />}
            <h1 className="font-display text-2xl font-bold">{conversion.name}</h1>
          </div>
          {conversion.description && (
            <p className="text-muted-foreground mt-1">{conversion.description}</p>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Progress section - only during processing */}
      {isProcessing && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Current phase indicator */}
            <div className="flex items-center justify-between text-sm">
              <div className={`flex items-center gap-2 ${phaseInfo.color}`}>
                <span className="animate-pulse">{phaseInfo.icon}</span>
                <span className="font-medium">{phaseInfo.label}</span>
              </div>
              <div className="flex items-center gap-4 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(elapsedTime)}</span>
                </div>
                {estimatedTime && estimatedTime > elapsedTime && (
                  <div className="flex items-center gap-1 text-xs">
                    <ArrowRight className="h-3 w-3" />
                    <span>~{formatTime(estimatedTime - elapsedTime)} left</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <Progress value={conversion.progress} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{conversion.progress}% complete</span>
                {estimatedTime && <span>Est. total: ~{formatTime(estimatedTime)}</span>}
              </div>
            </div>

            {/* Phase timeline */}
            <div className="flex items-center justify-between text-xs pt-2 overflow-x-auto">
              {Object.entries(PHASE_CONFIG).slice(0, -1).map(([phase, config], i) => {
                const isActive = phase === currentPhase;
                const isPast = Object.keys(PHASE_CONFIG).indexOf(currentPhase) > i;
                return (
                  <div
                    key={phase}
                    className={`flex flex-col items-center gap-1 px-1 ${
                      isActive ? config.color : isPast ? "text-green-500" : "text-muted-foreground/50"
                    }`}
                  >
                    <span className={isActive ? "animate-pulse" : ""}>{config.icon}</span>
                    <span className="text-[10px] whitespace-nowrap">{config.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Map */}
          <Card>
            <CardContent className="pt-6">
              <ConversionMap
                centerLat={conversion.centerLat}
                centerLon={conversion.centerLon}
                minLat={conversion.minLat}
                minLon={conversion.minLon}
                maxLat={conversion.maxLat}
                maxLon={conversion.maxLon}
              />
            </CardContent>
          </Card>

          {/* Location Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Location Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase mb-1">Center</p>
                  <p className="font-mono">
                    {formatCoordinate(conversion.centerLat, true)},{" "}
                    {formatCoordinate(conversion.centerLon, false)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase mb-1">Map Size</p>
                  <p className="flex items-center gap-1">
                    <Ruler className="h-3 w-3" />
                    {(conversion.mapWidth / 1000).toFixed(1)}km × {(conversion.mapHeight / 1000).toFixed(1)}km
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase mb-1">Real-World Area</p>
                  <p>{(realWorldWidth / 1000).toFixed(1)}km × {(realWorldHeight / 1000).toFixed(1)}km</p>
                  {scaleRatio > 1 && <p className="text-xs text-muted-foreground">1:{scaleRatio} scale</p>}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase mb-1">Created</p>
                  <p className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(conversion.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase mb-1">Northwest</p>
                  <p className="font-mono text-xs">
                    {conversion.maxLat.toFixed(4)}°, {conversion.minLon.toFixed(4)}°
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase mb-1">Southeast</p>
                  <p className="font-mono text-xs">
                    {conversion.minLat.toFixed(4)}°, {conversion.maxLon.toFixed(4)}°
                  </p>
                </div>
                {conversion.mapPreset && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase mb-1">Map Preset</p>
                    <p className="capitalize">{conversion.mapPreset.replace(/_/g, " ")}</p>
                  </div>
                )}
                {conversion.completedAt && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase mb-1">Duration</p>
                    <p className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(
                        Math.floor(
                          (new Date(conversion.completedAt).getTime() - new Date(conversion.createdAt).getTime()) / 1000
                        )
                      )}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          {conversion.stats && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Conversion Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <StatBox icon={MapPin} label="Nodes" value={formatNumber(conversion.stats.nodes)} />
                  <StatBox icon={Train} label="Edges" value={formatNumber(conversion.stats.edges)} />
                  <StatBox icon={TreePine} label="Areas" value={formatNumber(conversion.stats.areas)} />
                  <StatBox icon={Building} label="Towns" value={formatNumber(conversion.stats.towns)} />
                  <StatBox icon={Sparkles} label="Objects" value={formatNumber(conversion.stats.objects)} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Logs section */}
          {(isProcessing || logs.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="w-full flex items-center justify-between"
                >
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileCode className="h-5 w-5" />
                    Conversion Log
                    <span className="text-xs text-muted-foreground">({logs.length} entries)</span>
                  </CardTitle>
                  {showLogs ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </CardHeader>
              {showLogs && (
                <CardContent>
                  <div
                    ref={logContainerRef}
                    className="h-64 overflow-y-auto p-3 font-mono text-xs space-y-1 bg-zinc-950 rounded-lg"
                  >
                    {logs.length === 0 ? (
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Waiting for log output...</span>
                      </div>
                    ) : (
                      logs.map((log, i) => {
                        const time = new Date(log.timestamp).toLocaleTimeString();
                        let color = "text-zinc-400";
                        let prefix = "";

                        switch (log.type) {
                          case "phase":
                            color = "text-cyan-400 font-medium";
                            prefix = "▶ ";
                            break;
                          case "step":
                            color = "text-zinc-300";
                            prefix = "  → ";
                            break;
                          case "info":
                            color = "text-blue-400";
                            prefix = "  ℹ ";
                            break;
                          case "error":
                            color = "text-red-400";
                            prefix = "  ✗ ";
                            break;
                          case "stats":
                            color = "text-green-400";
                            prefix = "  📊 ";
                            break;
                          case "estimate":
                            color = "text-yellow-400";
                            prefix = "  ⏱ ";
                            break;
                        }

                        return (
                          <div key={i} className={`${color} leading-relaxed`}>
                            <span className="text-zinc-600 mr-2">[{time}]</span>
                            {prefix}
                            {log.message}
                            {log.percent !== undefined && (
                              <span className="text-zinc-500 ml-2">({log.percent}%)</span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Error message */}
          {isFailed && conversion.errorMsg && (
            <Card className="border-destructive/50">
              <CardContent className="pt-6">
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                  <p className="text-sm text-destructive font-medium">Error:</p>
                  <pre className="text-xs text-destructive whitespace-pre-wrap font-mono bg-destructive/5 p-2 rounded max-h-40 overflow-auto">
                    {conversion.errorMsg}
                  </pre>

                  {/* Error tips */}
                  {(conversion.errorMsg.toLowerCase().includes("timeout") ||
                    conversion.errorMsg.toLowerCase().includes("busy") ||
                    conversion.errorMsg.toLowerCase().includes("504")) && (
                    <div className="mt-3 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        💡 Server Overload - Try:
                      </p>
                      <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside">
                        <li>Smaller area or lower scale ratio</li>
                        <li>Wait a few minutes and retry</li>
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import Options */}
          {isComplete && (
            <Card>
              <CardHeader className="pb-3">
                <button
                  onClick={() => setShowImportOptions(!showImportOptions)}
                  className="w-full flex items-center justify-between"
                >
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    How to Import into TPF2
                  </CardTitle>
                  {showImportOptions ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </CardHeader>
              {showImportOptions && (
                <CardContent>
                  <ImportOptionsPanel conversionName={conversion.name} edgeCount={conversion.stats?.edges} />
                </CardContent>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Download Options */}
          {isComplete && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Download Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Customize what data to include in your download.
                </p>

                <div className="space-y-3">
                  <FilterCheckbox
                    id="railways"
                    label="Railways"
                    icon={Train}
                    checked={filters.includeRailways}
                    onChange={(checked) => setFilters((f) => ({ ...f, includeRailways: checked }))}
                  />
                  <FilterCheckbox
                    id="streets"
                    label="Streets & Roads"
                    icon={Car}
                    checked={filters.includeStreets}
                    onChange={(checked) => setFilters((f) => ({ ...f, includeStreets: checked }))}
                  />
                  <FilterCheckbox
                    id="paths"
                    label="Paths & Footways"
                    checked={filters.includePaths}
                    onChange={(checked) => setFilters((f) => ({ ...f, includePaths: checked }))}
                  />
                  <FilterCheckbox
                    id="forests"
                    label="Forests"
                    icon={TreePine}
                    checked={filters.includeForests}
                    onChange={(checked) => setFilters((f) => ({ ...f, includeForests: checked }))}
                  />
                  <FilterCheckbox
                    id="grounds"
                    label="Ground Surfaces"
                    checked={filters.includeGrounds}
                    onChange={(checked) => setFilters((f) => ({ ...f, includeGrounds: checked }))}
                  />
                  <FilterCheckbox
                    id="objects"
                    label="Objects (trees, etc.)"
                    checked={filters.includeObjects}
                    onChange={(checked) => setFilters((f) => ({ ...f, includeObjects: checked }))}
                  />
                  <FilterCheckbox
                    id="towns"
                    label="Town Labels"
                    icon={Building}
                    checked={filters.includeTowns}
                    onChange={(checked) => setFilters((f) => ({ ...f, includeTowns: checked }))}
                  />
                  <FilterCheckbox
                    id="signals"
                    label="Railway Signals"
                    icon={Signpost}
                    checked={filters.includeSignals}
                    onChange={(checked) => setFilters((f) => ({ ...f, includeSignals: checked }))}
                  />
                  <FilterCheckbox
                    id="streams"
                    label="Streams & Rivers"
                    checked={filters.includeStreams}
                    onChange={(checked) => setFilters((f) => ({ ...f, includeStreams: checked }))}
                  />
                </div>

                {/* Download Buttons */}
                <div className="space-y-2">
                  {/* ZIP Package - Recommended */}
                  <Button className="w-full" size="lg" asChild>
                    <a href={buildDownloadUrl() + "&format=zip"}>
                      <Download className="h-4 w-4 mr-2" />
                      Download ZIP Package
                    </a>
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Includes osmdata.lua + install scripts for all platforms
                  </p>
                </div>

                {/* Individual Downloads */}
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Or download individually:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={buildDownloadUrl()}>
                        <FileCode className="h-3 w-3 mr-1" />
                        Lua File
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/conversions/${conversionId}/download?format=script-sh`}>
                        <Terminal className="h-3 w-3 mr-1" />
                        Mac/Linux
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/conversions/${conversionId}/download?format=script-bat`}>
                        <Terminal className="h-3 w-3 mr-1" />
                        Windows
                      </a>
                    </Button>
                  </div>
                </div>

                {typeof conversion.downloads === "number" && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    {formatNumber(conversion.downloads)} downloads
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Console Commands - Quick Copy */}
          {isComplete && (
            <Card>
              <CardHeader className="pb-3">
                <button
                  onClick={() => setShowCommands(!showCommands)}
                  className="w-full flex items-center justify-between"
                >
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Console Commands
                  </CardTitle>
                  {showCommands ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
              </CardHeader>
              {showCommands && (
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Copy and paste these commands into the TPF2 console to import the map.
                  </p>
                  
                  <div className="relative">
                    <pre className="p-3 rounded-lg bg-zinc-900 text-zinc-100 text-xs overflow-x-auto max-h-[200px] overflow-y-auto font-mono">
                      {consoleCommands}
                    </pre>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(consoleCommands, "all-commands")}
                    >
                      {copied === "all-commands" ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy All
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="border-t pt-3">
                    <p className="text-xs font-medium mb-2">Required Mods:</p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {ALL_REQUIRED_MODS.filter(m => m.required).map(mod => (
                        <a
                          key={mod.name}
                          href={mod.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block hover:text-primary hover:underline"
                        >
                          • {mod.name}
                        </a>
                      ))}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              {isFailed && (
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/convert">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Link>
                </Button>
              )}
              {showBackLink && (
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/gallery">View Gallery</Link>
                </Button>
              )}
              <Button variant="outline" className="w-full" asChild>
                <Link href="/convert">Create New Conversion</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted">
      <Icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function FilterCheckbox({
  id,
  label,
  icon: Icon,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <Label htmlFor={id} className="text-sm font-normal cursor-pointer flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {label}
      </Label>
    </div>
  );
}


"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CitySearch } from "@/components/map/city-search";
import { ConfigPanel, ConversionConfig } from "@/components/convert/config-panel";
import { ConversionDetails } from "@/components/conversion/conversion-details";
import { DEFAULT_CONFIG } from "@/lib/constants";
import { useSession } from "@/hooks/use-session";
import { Loader2, MapPin, AlertCircle, Zap } from "lucide-react";
import Link from "next/link";

// Dynamic import for map component (no SSR)
const MapSelector = dynamic(
  () => import("@/components/map/map-selector").then((mod) => mod.MapSelector),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] bg-muted rounded-lg flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface Bounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export default function ConvertPage() {
  const { session, isLoading: sessionLoading } = useSession();
  const [name, setName] = useState("");
  const [center, setCenter] = useState({ lat: 50.1109, lon: 8.6821 }); // Frankfurt
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [config, setConfig] = useState<ConversionConfig>({
    mapPreset: "very_large",
    mapWidth: 16384,
    mapHeight: 16384,
    ...DEFAULT_CONFIG,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [conversionId, setConversionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  // Check if we're in dev mode (no OAuth configured)
  useEffect(() => {
    fetch("/api/auth/dev-mode")
      .then((res) => res.json())
      .then((data) => setIsDevMode(data.isDevMode))
      .catch(() => setIsDevMode(false));
  }, []);

  const handleBoundsChange = useCallback(
    (newBounds: Bounds, newCenter: { lat: number; lon: number }) => {
      setBounds(newBounds);
      setCenter(newCenter);
    },
    []
  );

  const handleCitySelect = useCallback(
    (result: {
      name: string;
      lat: number;
      lon: number;
      boundingBox: Bounds;
    }) => {
      setName(result.name);
      setCenter({ lat: result.lat, lon: result.lon });
    },
    []
  );

  // Check if user can create conversions (has session or in dev mode)
  const canCreateConversions = !!session?.user || isDevMode;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canCreateConversions) {
      setError("Please sign in to create conversions");
      return;
    }

    if (!name.trim()) {
      setError("Please enter a name for this conversion");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/conversions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          centerLat: center.lat,
          centerLon: center.lon,
          mapWidth: config.mapWidth,
          mapHeight: config.mapHeight,
          mapPreset: config.mapPreset,
          config: {
            scaleRatio: config.scaleRatio,
            railTypes: config.railTypes,
            highwayTypes: config.highwayTypes,
            includeForests: config.includeForests,
            includeGrounds: config.includeGrounds,
            includeObjects: config.includeObjects,
            includeTowns: config.includeTowns,
            includeSignals: config.includeSignals,
            includeStreams: config.includeStreams,
            includePaths: config.includePaths,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create conversion");
      }

      const data = await response.json();
      setConversionId(data.conversion.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      console.error("Conversion error:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show progress/details view if conversion started
  if (conversionId) {
    return (
      <div className="container mx-auto max-w-6xl py-8 px-4">
        <ConversionDetails 
          conversionId={conversionId} 
          isLive={true}
          showBackLink={true}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold mb-2">
          Create New Conversion
        </h1>
        <p className="text-muted-foreground">
          Select an area on the map and configure your import settings.
        </p>
      </div>

      {/* Dev mode notice */}
      {isDevMode && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
          <Zap className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-emerald-600 dark:text-emerald-400">
              Development Mode
            </p>
            <p className="text-sm text-muted-foreground">
              Running in local development mode — no authentication required.
              You can create conversions directly.
            </p>
          </div>
        </div>
      )}

      {/* Auth warning - only show if NOT in dev mode and no session */}
      {!sessionLoading && !session?.user && !isDevMode && (
        <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-600 dark:text-yellow-400">
              Sign in required
            </p>
            <p className="text-sm text-muted-foreground">
              You need to{" "}
              <Link href="/auth/signin" className="underline hover:text-foreground">
                sign in
              </Link>{" "}
              to create new conversions. Anyone can download existing conversions
              from the gallery.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column - Map */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5" />
                  Select Area
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Conversion Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Frankfurt Central"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Search Location</Label>
                    <CitySearch onSelect={handleCitySelect} />
                  </div>
                </div>

                <div className="h-[400px] rounded-lg overflow-hidden border border-border">
                  <MapSelector
                    initialCenter={[center.lat, center.lon]}
                    initialZoom={11}
                    bounds={bounds || undefined}
                    mapWidth={config.mapWidth}
                    mapHeight={config.mapHeight}
                    scaleRatio={config.scaleRatio}
                    onBoundsChange={handleBoundsChange}
                    className="h-full"
                  />
                </div>

                <p className="text-sm text-muted-foreground">
                  Click outside the selection to move the center. Drag inside
                  the rectangle to reposition it. The area shown accounts for
                  your scale ratio ({config.scaleRatio}:1).
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right column - Configuration */}
          <div className="space-y-4">
            <ConfigPanel config={config} onChange={setConfig} />

            {/* Submit */}
            <Card>
              <CardContent className="pt-6">
                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      <span className="font-medium">Center:</span>{" "}
                      {center.lat.toFixed(4)}°, {center.lon.toFixed(4)}°
                    </p>
                    <p>
                      <span className="font-medium">Map size:</span>{" "}
                      {(config.mapWidth / 1000).toFixed(1)}km ×{" "}
                      {(config.mapHeight / 1000).toFixed(1)}km
                    </p>
                    <p>
                      <span className="font-medium">Scale:</span>{" "}
                      {config.scaleRatio}:1
                      {config.scaleRatio > 1 && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {" "}(real area: {(config.mapWidth * config.scaleRatio / 1000).toFixed(1)}km)
                        </span>
                      )}
                    </p>
                    <p>
                      <span className="font-medium">Rail types:</span>{" "}
                      {config.railTypes.length} selected
                    </p>
                    <p>
                      <span className="font-medium">Highway types:</span>{" "}
                      {config.highwayTypes.length} selected
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isSubmitting || !canCreateConversions}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Starting Conversion...
                      </>
                    ) : (
                      "Start Conversion"
                    )}
                  </Button>

                  {!canCreateConversions && (
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/auth/signin">Sign In to Convert</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}


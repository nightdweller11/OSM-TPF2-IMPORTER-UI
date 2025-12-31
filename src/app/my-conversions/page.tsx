"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Download, 
  MapPin, 
  Train, 
  Loader2, 
  Plus,
  Eye,
  Trash2,
  Clock
} from "lucide-react";
import { formatNumber, formatDuration } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/constants";
import { useSession } from "@/hooks/use-session";

interface ConversionStats {
  nodes: number;
  edges: number;
  towns: number;
  areas: number;
  objects: number;
}

interface Conversion {
  id: string;
  name: string;
  status: string;
  progress: number;
  centerLat: number;
  centerLon: number;
  mapWidth: number;
  mapHeight: number;
  stats?: ConversionStats;
  downloads: number;
  createdAt: string;
  completedAt?: string;
  errorMsg?: string;
}

export default function MyConversionsPage() {
  const { session } = useSession();
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      fetchConversions();
    }
  }, [session?.user?.id]);

  const fetchConversions = async () => {
    try {
      const response = await fetch(`/api/conversions?userId=${session?.user?.id}`);
      if (response.ok) {
        const data = await response.json();
        setConversions(data.conversions);
      }
    } catch (error) {
      console.error("Error fetching conversions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold mb-2">My Conversions</h1>
          <p className="text-muted-foreground">
            Manage your OSM to TPF2 conversions.
          </p>
        </div>
        <Button asChild>
          <Link href="/convert">
            <Plus className="h-4 w-4 mr-2" />
            New Conversion
          </Link>
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && conversions.length === 0 && (
        <div className="text-center py-20">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No conversions yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first conversion to get started.
          </p>
          <Button asChild>
            <Link href="/convert">Create Conversion</Link>
          </Button>
        </div>
      )}

      {/* Conversions list */}
      {!isLoading && conversions.length > 0 && (
        <div className="space-y-4">
          {conversions.map((conversion) => (
            <ConversionRow key={conversion.id} conversion={conversion} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversionRow({ conversion }: { conversion: Conversion }) {
  const statusInfo = STATUS_LABELS[conversion.status] || { 
    label: conversion.status, 
    color: "bg-gray-500" 
  };
  const isComplete = conversion.status === "COMPLETED";
  const isFailed = conversion.status === "FAILED";
  const isProcessing = !isComplete && !isFailed;

  return (
    <Card>
      <div className="flex flex-col md:flex-row md:items-center p-4 gap-4">
        {/* Thumbnail */}
        <div className="w-full md:w-32 h-20 bg-muted rounded overflow-hidden shrink-0">
          <img
            src={`https://staticmap.openstreetmap.de/staticmap.php?center=${conversion.centerLat},${conversion.centerLon}&zoom=10&size=128x80&maptype=osmarenderer`}
            alt={conversion.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate">{conversion.name}</h3>
            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {conversion.centerLat.toFixed(2)}°, {conversion.centerLon.toFixed(2)}°
            </span>
            <span>
              {(conversion.mapWidth / 1000).toFixed(0)}km × {(conversion.mapHeight / 1000).toFixed(0)}km
            </span>
            {isComplete && conversion.stats && (
              <span className="flex items-center gap-1">
                <Train className="h-3 w-3" />
                {formatNumber(conversion.stats.edges)} edges
              </span>
            )}
            {isProcessing && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {conversion.progress}%
              </span>
            )}
          </div>

          {isFailed && conversion.errorMsg && (
            <p className="text-xs text-destructive mt-1 truncate">
              {conversion.errorMsg}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/gallery/${conversion.id}`}>
              <Eye className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">View</span>
            </Link>
          </Button>
          {isComplete && (
            <Button size="sm" asChild>
              <a href={`/api/conversions/${conversion.id}/download`}>
                <Download className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Download</span>
              </a>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}


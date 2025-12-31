"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Download,
  MapPin,
  Train,
  Loader2,
  Search,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  TreePine,
  Building,
  Eye,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";

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
  description?: string;
  centerLat: number;
  centerLon: number;
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
  mapWidth: number;
  mapHeight: number;
  mapPreset?: string;
  stats?: ConversionStats;
  downloads: number;
  createdAt: string;
  user?: {
    name?: string;
    image?: string;
  };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function GalleryPage() {
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchConversions(currentPage);
  }, [currentPage]);

  const fetchConversions = async (page: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/conversions?page=${page}&limit=12`);
      if (response.ok) {
        const data = await response.json();
        setConversions(data.conversions);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching conversions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredConversions = searchQuery
    ? conversions.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversions;

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold mb-2">Gallery</h1>
          <p className="text-muted-foreground">
            Browse and download pre-converted city maps for Transport Fever 2.
          </p>
        </div>
        <Button asChild>
          <Link href="/convert">
            Create Your Own
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredConversions.length === 0 && (
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <div className="h-24 w-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <MapPin className="h-12 w-12 text-primary/60" />
            </div>
            <h3 className="text-xl font-semibold mb-3">
              {searchQuery ? "No matching conversions" : "No conversions yet"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery
                ? `No conversions match "${searchQuery}". Try a different search term.`
                : "The gallery is waiting for its first map! Convert an area from OpenStreetMap to get started."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild>
                <Link href="/convert">
                  Create Your First Conversion
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              {searchQuery && (
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Clear Search
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gallery grid */}
      {!isLoading && filteredConversions.length > 0 && (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredConversions.map((conversion) => (
              <ConversionCard key={conversion.id} conversion={conversion} />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={currentPage === pagination.pages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ConversionCard({ conversion }: { conversion: Conversion }) {
  const [imageError, setImageError] = useState(false);

  // Generate a static map thumbnail URL using the staticmap service
  // This shows the actual area with the selection rectangle would be nice, but for now use a static map
  const thumbnailUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${conversion.centerLat},${conversion.centerLon}&zoom=10&size=400x200&maptype=osmarenderer`;

  // Calculate map dimensions in km
  const widthKm = (conversion.mapWidth / 1000).toFixed(0);
  const heightKm = (conversion.mapHeight / 1000).toFixed(0);

  return (
    <Card className="overflow-hidden card-hover group">
      <Link href={`/gallery/${conversion.id}`} className="block">
        <div className="aspect-video bg-muted relative overflow-hidden">
          {!imageError ? (
            <img
              src={thumbnailUrl}
              alt={conversion.name}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
              <MapPin className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
          {/* Overlay with area info */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-background/90 backdrop-blur rounded px-2 py-1 text-xs">
              <span className="font-mono">{widthKm}×{heightKm}km</span>
            </div>
            <div className="flex items-center gap-1 bg-background/90 backdrop-blur rounded px-2 py-1 text-xs">
              <Eye className="h-3 w-3" />
              <span>View Details</span>
            </div>
          </div>
        </div>
      </Link>

      <CardHeader className="pb-2">
        <CardTitle className="text-lg truncate" title={conversion.name}>
          <Link href={`/gallery/${conversion.id}`} className="hover:underline">
            {conversion.name}
          </Link>
        </CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {conversion.centerLat.toFixed(2)}°, {conversion.centerLon.toFixed(2)}°
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {conversion.stats && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Train className="h-3 w-3" />
              <span>{formatNumber(conversion.stats.edges)} edges</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <TreePine className="h-3 w-3" />
              <span>{formatNumber(conversion.stats.areas)}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Building className="h-3 w-3" />
              <span>{formatNumber(conversion.stats.towns)}</span>
            </div>
          </div>
        )}
        {typeof conversion.downloads === "number" && (
          <div className="text-xs text-muted-foreground mt-2">
            {formatNumber(conversion.downloads)} downloads
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 gap-2">
        <Button variant="outline" size="sm" className="flex-1" asChild>
          <Link href={`/gallery/${conversion.id}`}>
            <Eye className="h-4 w-4 mr-1" />
            Details
          </Link>
        </Button>
        <Button variant="default" size="sm" className="flex-1" asChild>
          <a href={`/api/conversions/${conversion.id}/download`}>
            <Download className="h-4 w-4 mr-1" />
            Download
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

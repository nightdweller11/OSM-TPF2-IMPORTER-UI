"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
// Leaflet CSS is imported in globals.css
import { Button } from "@/components/ui/button";
import { Crosshair, Maximize2, Move } from "lucide-react";

export interface Bounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export interface MapSelectorProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  bounds?: Bounds;
  mapWidth?: number;
  mapHeight?: number;
  scaleRatio?: number;
  onBoundsChange?: (bounds: Bounds, center: { lat: number; lon: number }) => void;
  className?: string;
}

export function MapSelector({
  initialCenter = [50.1109, 8.6821], // Frankfurt
  initialZoom = 10,
  bounds,
  mapWidth = 16384,
  mapHeight = 16384,
  scaleRatio = 1,
  onBoundsChange,
  className,
}: MapSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const rectangleRef = useRef<L.Rectangle | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ lat: number; lng: number } | null>(null);
  const rectangleCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Real-world selection size accounts for scale ratio
  const realWorldWidth = mapWidth * scaleRatio;
  const realWorldHeight = mapHeight * scaleRatio;

  // Calculate bounds from center and real-world size
  const calculateBounds = useCallback(
    (center: L.LatLng): Bounds => {
      const metersPerDegreeLat = 111320;
      const metersPerDegreeLon = 111320 * Math.cos((center.lat * Math.PI) / 180);

      const latOffset = realWorldHeight / 2 / metersPerDegreeLat;
      const lonOffset = realWorldWidth / 2 / metersPerDegreeLon;

      return {
        minLat: center.lat - latOffset,
        maxLat: center.lat + latOffset,
        minLon: center.lng - lonOffset,
        maxLon: center.lng + lonOffset,
      };
    },
    [realWorldWidth, realWorldHeight]
  );

  // Update rectangle on map
  const updateRectangle = useCallback(
    (map: L.Map, newBounds: Bounds) => {
      const latLngBounds = L.latLngBounds(
        [newBounds.minLat, newBounds.minLon],
        [newBounds.maxLat, newBounds.maxLon]
      );

      if (rectangleRef.current) {
        rectangleRef.current.setBounds(latLngBounds);
      } else {
        rectangleRef.current = L.rectangle(latLngBounds, {
          color: "#7ebc6f",
          weight: 3,
          fillOpacity: 0.15,
          dashArray: "8, 4",
          className: "selection-rectangle",
        }).addTo(map);
      }
    },
    []
  );

  // Check if a point is inside the current rectangle
  const isPointInRectangle = useCallback((latlng: L.LatLng): boolean => {
    if (!rectangleRef.current) return false;
    return rectangleRef.current.getBounds().contains(latlng);
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !mapRef.current || mapInstanceRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
    });

    // Add OSM tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Set initial bounds
    const initialBoundsCalc = bounds || calculateBounds(L.latLng(initialCenter[0], initialCenter[1]));
    updateRectangle(map, initialBoundsCalc);

    // Handle mouse down - start drag if inside rectangle
    const handleMouseDown = (e: L.LeafletMouseEvent) => {
      if (isPointInRectangle(e.latlng) && rectangleRef.current) {
        isDraggingRef.current = true;
        setIsDragging(true);
        dragStartRef.current = { lat: e.latlng.lat, lng: e.latlng.lng };
        rectangleCenterRef.current = {
          lat: rectangleRef.current.getBounds().getCenter().lat,
          lng: rectangleRef.current.getBounds().getCenter().lng,
        };
        map.dragging.disable();
        L.DomUtil.addClass(map.getContainer(), 'leaflet-dragging-rectangle');
      }
    };

    // Handle mouse move - drag rectangle
    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current || !rectangleCenterRef.current) return;

      const deltaLat = e.latlng.lat - dragStartRef.current.lat;
      const deltaLng = e.latlng.lng - dragStartRef.current.lng;

      const newCenter = L.latLng(
        rectangleCenterRef.current.lat + deltaLat,
        rectangleCenterRef.current.lng + deltaLng
      );

      const newBounds = calculateBounds(newCenter);
      updateRectangle(map, newBounds);
    };

    // Handle mouse up - finish drag or set new center
    const handleMouseUp = (e: L.LeafletMouseEvent) => {
      if (isDraggingRef.current && rectangleRef.current) {
        // Finish dragging
        isDraggingRef.current = false;
        setIsDragging(false);
        dragStartRef.current = null;
        rectangleCenterRef.current = null;
        map.dragging.enable();
        L.DomUtil.removeClass(map.getContainer(), 'leaflet-dragging-rectangle');

        const center = rectangleRef.current.getBounds().getCenter();
        const newBounds = calculateBounds(center);

        if (onBoundsChange) {
          onBoundsChange(newBounds, { lat: center.lat, lon: center.lng });
        }
      }
    };

    // Handle click outside rectangle - move center
    const handleClick = (e: L.LeafletMouseEvent) => {
      if (!isPointInRectangle(e.latlng)) {
        const newBounds = calculateBounds(e.latlng);
        updateRectangle(map, newBounds);

        if (onBoundsChange) {
          onBoundsChange(newBounds, { lat: e.latlng.lat, lon: e.latlng.lng });
        }
      }
    };

    map.on("mousedown", handleMouseDown);
    map.on("mousemove", handleMouseMove);
    map.on("mouseup", handleMouseUp);
    map.on("click", handleClick);

    // Cleanup
    return () => {
      map.off("mousedown", handleMouseDown);
      map.off("mousemove", handleMouseMove);
      map.off("mouseup", handleMouseUp);
      map.off("click", handleClick);
      map.remove();
      mapInstanceRef.current = null;
      rectangleRef.current = null;
    };
  }, [isClient, initialCenter, initialZoom, bounds, calculateBounds, updateRectangle, onBoundsChange, isPointInRectangle]);

  // Track previous map size and scale to detect when to auto-zoom
  const prevMapWidthRef = useRef(mapWidth);
  const prevMapHeightRef = useRef(mapHeight);
  const prevScaleRatioRef = useRef(scaleRatio);
  const isFirstRenderRef = useRef(true);
  
  // Update rectangle when map size or scale changes
  useEffect(() => {
    if (!mapInstanceRef.current || !rectangleRef.current) return;

    const currentCenter = rectangleRef.current.getBounds().getCenter();
    const newBounds = calculateBounds(currentCenter);
    updateRectangle(mapInstanceRef.current, newBounds);
    
    // Skip auto-zoom on first render
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevMapWidthRef.current = mapWidth;
      prevMapHeightRef.current = mapHeight;
      prevScaleRatioRef.current = scaleRatio;
      return;
    }
    
    // Calculate if the selection area grew (considering both map size and scale ratio)
    const prevArea = prevMapWidthRef.current * prevScaleRatioRef.current * 
                     prevMapHeightRef.current * prevScaleRatioRef.current;
    const newArea = realWorldWidth * realWorldHeight;
    
    // If the selection area increased, zoom out to fit it
    const areaGrew = newArea > prevArea * 1.1; // 10% threshold to avoid jitter
    
    if (areaGrew) {
      const latLngBounds = L.latLngBounds(
        [newBounds.minLat, newBounds.minLon],
        [newBounds.maxLat, newBounds.maxLon]
      );
      mapInstanceRef.current.fitBounds(latLngBounds, {
        padding: [40, 40],
        animate: true,
        duration: 0.4,
      });
    }
    
    // Update previous values
    prevMapWidthRef.current = mapWidth;
    prevMapHeightRef.current = mapHeight;
    prevScaleRatioRef.current = scaleRatio;

    if (onBoundsChange) {
      onBoundsChange(newBounds, { lat: currentCenter.lat, lon: currentCenter.lng });
    }
  }, [mapWidth, mapHeight, scaleRatio, realWorldWidth, realWorldHeight, calculateBounds, updateRectangle, onBoundsChange]);

  const centerOnLocation = useCallback(async () => {
    if (!mapInstanceRef.current) return;

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          mapInstanceRef.current?.setView([latitude, longitude], 12);
          
          const newBounds = calculateBounds(L.latLng(latitude, longitude));
          updateRectangle(mapInstanceRef.current!, newBounds);
          
          if (onBoundsChange) {
            onBoundsChange(newBounds, { lat: latitude, lon: longitude });
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
        }
      );
    }
  }, [calculateBounds, updateRectangle, onBoundsChange]);

  const fitToSelection = useCallback(() => {
    if (!mapInstanceRef.current || !rectangleRef.current) return;
    mapInstanceRef.current.fitBounds(rectangleRef.current.getBounds(), {
      padding: [50, 50],
    });
  }, []);

  if (!isClient) {
    return (
      <div className={`bg-muted rounded-lg flex items-center justify-center ${className}`}>
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <style jsx global>{`
        .selection-rectangle {
          cursor: move !important;
        }
        .leaflet-dragging-rectangle {
          cursor: grabbing !important;
        }
        .leaflet-dragging-rectangle .selection-rectangle {
          cursor: grabbing !important;
        }
      `}</style>
      <div ref={mapRef} className="h-full w-full rounded-lg" />
      
      {/* Drag indicator */}
      {isDragging && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg">
          <Move className="h-4 w-4" />
          Dragging selection...
        </div>
      )}
      
      {/* Map controls */}
      <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={centerOnLocation}
          title="Center on my location"
        >
          <Crosshair className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={fitToSelection}
          title="Fit to selection"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 left-4 z-[1000] bg-background/90 backdrop-blur rounded-lg px-3 py-2 text-xs max-w-[200px]">
        <p className="text-muted-foreground">
          <strong>Click outside</strong> the box to move center.
          <br />
          <strong>Drag inside</strong> the box to reposition.
        </p>
      </div>

      {/* Coordinates display */}
      {bounds && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-background/90 backdrop-blur rounded-lg px-3 py-2 text-xs font-mono">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">NW:</span>
            <span>{bounds.maxLat.toFixed(4)}°, {bounds.minLon.toFixed(4)}°</span>
            <span className="text-muted-foreground">SE:</span>
            <span>{bounds.minLat.toFixed(4)}°, {bounds.maxLon.toFixed(4)}°</span>
          </div>
        </div>
      )}
    </div>
  );
}

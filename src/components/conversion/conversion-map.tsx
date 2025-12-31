"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
// Leaflet CSS is imported in globals.css

interface ConversionMapProps {
  centerLat: number;
  centerLon: number;
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
  height?: string;
}

export function ConversionMap({
  centerLat,
  centerLon,
  minLat,
  minLon,
  maxLat,
  maxLon,
  height = "300px",
}: ConversionMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create the map
    const map = L.map(mapRef.current, {
      center: [centerLat, centerLon],
      zoom: 10,
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
    });

    mapInstanceRef.current = map;

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Create selection rectangle
    const bounds: L.LatLngBoundsExpression = [
      [minLat, minLon],
      [maxLat, maxLon],
    ];

    const rectangle = L.rectangle(bounds, {
      color: "#22c55e", // Green
      weight: 3,
      fillColor: "#22c55e",
      fillOpacity: 0.15,
      dashArray: "8, 4",
      className: "conversion-area-rectangle",
    }).addTo(map);

    // Add a marker at the center
    const centerMarker = L.circleMarker([centerLat, centerLon], {
      radius: 8,
      fillColor: "#3b82f6",
      color: "#1d4ed8",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.8,
    }).addTo(map);

    centerMarker.bindPopup(`
      <div class="text-sm">
        <strong>Center Point</strong><br/>
        ${centerLat.toFixed(5)}°, ${centerLon.toFixed(5)}°
      </div>
    `);

    // Fit map to show the rectangle with padding
    map.fitBounds(bounds, { padding: [30, 30] });

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [centerLat, centerLon, minLat, minLon, maxLat, maxLon]);

  return (
    <div
      ref={mapRef}
      style={{ height }}
      className="rounded-lg overflow-hidden border border-border"
    />
  );
}


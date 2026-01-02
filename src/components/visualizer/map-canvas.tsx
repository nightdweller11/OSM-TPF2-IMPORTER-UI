'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ParsedOsmData, LuaEdge } from '@/lib/lua-parser';

interface NodeCategoryVisibility {
  edgeEndpoint: boolean;
  pathStreet: boolean;
  pathTrack: boolean;
  forestPolygon: boolean;
  groundPolygon: boolean;
  unknownPolygon: boolean;
  outOfBounds: boolean;
  removed: boolean;
  switch: boolean;
  signal: boolean;
}

interface MapCanvasProps {
  data: ParsedOsmData;
  width?: number;
  height?: number;
  nodeCategories?: NodeCategoryVisibility;
  showEdges?: boolean;
  showObjects?: boolean;
  showTowns?: boolean;
  showGrid?: boolean;
  colorByType?: boolean;
  mapSize?: number; // Expected map size in meters (e.g., 500 for 0.5km)
}

// Color scheme for different road types
const STREET_COLORS: Record<string, string> = {
  motorway: '#e892a2',
  motorway_link: '#e892a2',
  trunk: '#f9b29c',
  trunk_link: '#f9b29c',
  primary: '#fcd6a4',
  primary_link: '#fcd6a4',
  secondary: '#f7fabf',
  secondary_link: '#f7fabf',
  tertiary: '#ffffff',
  tertiary_link: '#ffffff',
  residential: '#ffffff',
  unclassified: '#ffffff',
  service: '#cccccc',
  living_street: '#ededed',
  pedestrian: '#dddde8',
  footway: '#fa8072',
  cycleway: '#0000ff',
  path: '#00ff00',
  track: '#996633',
  waterstream: '#aad3df',
  aeroway: '#bbbbcc',
};

const TRACK_COLORS: Record<string, string> = {
  rail: '#666666',
  subway: '#ff6600',
  light_rail: '#66cc66',
  tram: '#cc6666',
  monorail: '#9966cc',
};

const defaultNodeCategories: NodeCategoryVisibility = {
  edgeEndpoint: true,
  pathStreet: false,
  pathTrack: false,
  forestPolygon: false,
  groundPolygon: false,
  unknownPolygon: false,
  outOfBounds: false,
  removed: false,
  switch: true,
  signal: true,
};

// Color mapping for each node category
const NODE_CATEGORY_COLORS: Record<string, string> = {
  edgeEndpoint: '#4a90d9',   // Blue - road/track junctions
  pathStreet: '#90EE90',     // Light green - street path nodes
  pathTrack: '#87CEEB',      // Light blue - track path nodes
  forestPolygon: '#228B22',  // Forest green - forest/shrub vertices
  groundPolygon: '#CD853F',  // Peru/tan - ground surface vertices
  unknownPolygon: '#9370DB', // Medium purple - unknown vertices
  outOfBounds: '#FF6347',    // Tomato red - outside map
  removed: '#808080',        // Gray - optimized away
  switch: '#ff00ff',         // Magenta - railway switches
  signal: '#ffff00',         // Yellow - railway signals
};

export function MapCanvas({
  data,
  width = 800,
  height = 600,
  nodeCategories = defaultNodeCategories,
  showEdges = true,
  showObjects = true,
  showTowns = true,
  showGrid = true,
  colorByType = true,
  mapSize = 500, // Default 0.5km
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredEdge, setHoveredEdge] = useState<LuaEdge | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<LuaEdge | null>(null);

  // Calculate initial transform to fit data
  useEffect(() => {
    if (!data || data.bounds.minX === Infinity) return;

    const padding = 50;
    const dataWidth = data.bounds.maxX - data.bounds.minX;
    const dataHeight = data.bounds.maxY - data.bounds.minY;
    
    const scaleX = (width - padding * 2) / dataWidth;
    const scaleY = (height - padding * 2) / dataHeight;
    const scale = Math.min(scaleX, scaleY);
    
    const centerX = (data.bounds.minX + data.bounds.maxX) / 2;
    const centerY = (data.bounds.minY + data.bounds.maxY) / 2;
    
    setTransform({
      x: width / 2 - centerX * scale,
      y: height / 2 + centerY * scale, // Flip Y axis
      scale
    });
  }, [data, width, height]);

  // Transform world coordinates to screen coordinates
  const worldToScreen = useCallback((x: number, y: number) => {
    return {
      x: x * transform.scale + transform.x,
      y: -y * transform.scale + transform.y, // Flip Y axis
    };
  }, [transform]);

  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Debug: count how many edges can actually be drawn
    let drawableEdges = 0;
    let missingNodeEdges = 0;
    for (const edge of data.edges) {
      const node0 = data.nodes[edge.node0];
      const node1 = data.nodes[edge.node1];
      if (node0 && node1) {
        drawableEdges++;
      } else {
        missingNodeEdges++;
      }
    }
    console.log('[MapCanvas] Drawable edges:', drawableEdges, 'Missing node edges:', missingNodeEdges);

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (showGrid) {
      drawGrid(ctx, transform, width, height);
    }

    // Draw map bounds rectangle (the expected import area centered on origin)
    if (mapSize > 0) {
      const halfSize = mapSize / 2;
      const topLeft = worldToScreen(-halfSize, halfSize);
      const bottomRight = worldToScreen(halfSize, -halfSize);
      
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y
      );
      ctx.setLineDash([]);
      
      // Label the bounds
      ctx.fillStyle = '#00ff00';
      ctx.font = '12px monospace';
      ctx.fillText(`Map bounds: ${mapSize}m × ${mapSize}m`, topLeft.x + 5, topLeft.y + 15);
    }
    
    // Draw origin marker (0,0)
    const origin = worldToScreen(0, 0);
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(origin.x - 10, origin.y);
    ctx.lineTo(origin.x + 10, origin.y);
    ctx.moveTo(origin.x, origin.y - 10);
    ctx.lineTo(origin.x, origin.y + 10);
    ctx.stroke();
    ctx.fillStyle = '#ff00ff';
    ctx.font = '10px monospace';
    ctx.fillText('(0,0)', origin.x + 12, origin.y - 5);

    // Draw edges (roads/tracks)
    if (showEdges) {
      for (const edge of data.edges) {
        const node0 = data.nodes[edge.node0];
        const node1 = data.nodes[edge.node1];
        
        if (!node0 || !node1) continue;
        if (node0.removed || node1.removed) continue;

        const start = worldToScreen(node0.pos[0], node0.pos[1]);
        const end = worldToScreen(node1.pos[0], node1.pos[1]);

        // Determine color
        let color = '#888888';
        let lineWidth = 2;
        
        if (colorByType) {
          if (edge.track) {
            color = TRACK_COLORS[edge.track.type] || '#666666';
            lineWidth = 3;
          } else if (edge.street) {
            color = STREET_COLORS[edge.street.type] || '#ffffff';
            lineWidth = edge.street.type.includes('motorway') || edge.street.type.includes('trunk') ? 4 :
                       edge.street.type.includes('primary') || edge.street.type.includes('secondary') ? 3 : 2;
          }
        }

        // Highlight selected/hovered
        if (selectedEdge === edge) {
          color = '#00ffff';
          lineWidth += 2;
        } else if (hoveredEdge === edge) {
          color = '#ffff00';
          lineWidth += 1;
        }

        // Draw bridge differently
        if (edge.bridge) {
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = lineWidth + 2;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // Draw tunnel with dashed line
        if (edge.tunnel) {
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Draw nodes by category
    const anyNodeVisible = Object.values(nodeCategories).some(v => v);
    if (anyNodeVisible) {
      for (const [nodeId, node] of Object.entries(data.nodes)) {
        // Skip if this node's category is not visible
        const category = node.category;
        if (!category || !nodeCategories[category as keyof NodeCategoryVisibility]) continue;

        const pos = worldToScreen(node.pos[0], node.pos[1]);
        const color = NODE_CATEGORY_COLORS[category] || '#888888';
        
        ctx.fillStyle = color;
        ctx.beginPath();
        
        // Different sizes for different categories
        let size = 2;
        if (category === 'switch') size = 5;
        else if (category === 'signal') size = 4;
        else if (category === 'edgeEndpoint') size = 3;
        else if (category === 'removed' || category === 'outOfBounds') size = 1.5;
        
        ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw objects (larger markers with different shapes)
    if (showObjects) {
      for (const obj of data.objects) {
        const pos = worldToScreen(obj.pos[0], obj.pos[1]);
        const color = getObjectColor(obj.type);
        const size = getObjectSize(obj.type);
        
        ctx.fillStyle = color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        
        // Draw different shapes for different object types
        if (obj.type === 'traffic_light' || obj.type === 'stop_sign') {
          // Square for traffic signals
          ctx.fillRect(pos.x - size/2, pos.y - size/2, size, size);
          ctx.strokeRect(pos.x - size/2, pos.y - size/2, size, size);
        } else if (obj.type.includes('tree')) {
          // Triangle for trees
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y - size);
          ctx.lineTo(pos.x + size * 0.7, pos.y + size * 0.5);
          ctx.lineTo(pos.x - size * 0.7, pos.y + size * 0.5);
          ctx.closePath();
          ctx.fill();
        } else if (obj.type === 'bench' || obj.type === 'bus_stop') {
          // Diamond for street furniture
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y - size);
          ctx.lineTo(pos.x + size, pos.y);
          ctx.lineTo(pos.x, pos.y + size);
          ctx.lineTo(pos.x - size, pos.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          // Circle for other objects
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // Draw towns
    if (showTowns) {
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      for (const town of data.towns) {
        const pos = worldToScreen(town.pos[0], town.pos[1]);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(pos.x - 4, pos.y - 4, 8, 8);
        ctx.fillStyle = '#ff6600';
        ctx.fillText(town.name, pos.x, pos.y - 10);
      }
    }

    // Draw info overlay
    drawInfoOverlay(ctx, data, width, height);

  }, [data, transform, nodeCategories, showEdges, showObjects, showTowns, showGrid, colorByType, mapSize, hoveredEdge, selectedEdge, worldToScreen, width, height]);

  // Mouse handlers for pan/zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setTransform(t => ({
        ...t,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = transform.scale * zoomFactor;

    // Zoom towards mouse position
    setTransform(t => ({
      scale: newScale,
      x: mouseX - (mouseX - t.x) * zoomFactor,
      y: mouseY - (mouseY - t.y) * zoomFactor,
    }));
  };

  // Reset view to fit all data
  const handleFitToView = useCallback(() => {
    if (!data || data.bounds.minX === Infinity) return;

    const padding = 50;
    const dataWidth = data.bounds.maxX - data.bounds.minX;
    const dataHeight = data.bounds.maxY - data.bounds.minY;
    
    const scaleX = (width - padding * 2) / dataWidth;
    const scaleY = (height - padding * 2) / dataHeight;
    const scale = Math.min(scaleX, scaleY);
    
    const centerX = (data.bounds.minX + data.bounds.maxX) / 2;
    const centerY = (data.bounds.minY + data.bounds.maxY) / 2;
    
    setTransform({
      x: width / 2 - centerX * scale,
      y: height / 2 + centerY * scale,
      scale
    });
  }, [data, width, height]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setTransform(t => ({
      ...t,
      scale: t.scale * 1.3,
      x: width / 2 - (width / 2 - t.x) * 1.3,
      y: height / 2 - (height / 2 - t.y) * 1.3,
    }));
  }, [width, height]);

  const handleZoomOut = useCallback(() => {
    setTransform(t => ({
      ...t,
      scale: t.scale * 0.7,
      x: width / 2 - (width / 2 - t.x) * 0.7,
      y: height / 2 - (height / 2 - t.y) * 0.7,
    }));
  }, [width, height]);

  // Center on origin (0,0)
  const handleCenterOrigin = useCallback(() => {
    setTransform(t => ({
      ...t,
      x: width / 2,
      y: height / 2,
    }));
  }, [width, height]);

  return (
    <div className="relative">
      {/* Control buttons */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 bg-slate-700 hover:bg-slate-600 text-white rounded flex items-center justify-center text-lg font-bold"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 bg-slate-700 hover:bg-slate-600 text-white rounded flex items-center justify-center text-lg font-bold"
          title="Zoom Out"
        >
          −
        </button>
        <button
          onClick={handleFitToView}
          className="w-8 h-8 bg-slate-700 hover:bg-slate-600 text-white rounded flex items-center justify-center text-xs"
          title="Fit to View"
        >
          ⊡
        </button>
        <button
          onClick={handleCenterOrigin}
          className="w-8 h-8 bg-slate-700 hover:bg-slate-600 text-white rounded flex items-center justify-center text-xs"
          title="Center on Origin (0,0)"
        >
          ⌖
        </button>
      </div>
      
      {/* Zoom level indicator */}
      <div className="absolute bottom-2 right-2 z-10 bg-slate-800/80 px-2 py-1 rounded text-xs text-slate-300">
        Zoom: {(transform.scale * 100).toFixed(0)}%
      </div>
      
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ 
          cursor: isDragging ? 'grabbing' : 'grab',
          border: '1px solid #333',
          borderRadius: '8px',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
}

function drawGrid(ctx: CanvasRenderingContext2D, transform: { x: number; y: number; scale: number }, width: number, height: number) {
  const gridSize = 100; // meters
  const screenGridSize = gridSize * transform.scale;
  
  if (screenGridSize < 10) return; // Don't draw if grid too small
  
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  
  // Calculate grid offset
  const offsetX = transform.x % screenGridSize;
  const offsetY = transform.y % screenGridSize;
  
  // Vertical lines
  for (let x = offsetX; x < width; x += screenGridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Horizontal lines
  for (let y = offsetY; y < height; y += screenGridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawInfoOverlay(ctx: CanvasRenderingContext2D, data: ParsedOsmData, width: number, height: number) {
  const padding = 10;
  const lineHeight = 16;
  
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(padding, padding, 200, 100);
  
  ctx.font = '12px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  
  let y = padding + lineHeight;
  ctx.fillText(`Nodes: ${data.stats.nodeCount}`, padding + 10, y); y += lineHeight;
  ctx.fillText(`Edges: ${data.stats.edgeCount}`, padding + 10, y); y += lineHeight;
  ctx.fillText(`  Streets: ${data.stats.streetEdges}`, padding + 10, y); y += lineHeight;
  ctx.fillText(`  Tracks: ${data.stats.trackEdges}`, padding + 10, y); y += lineHeight;
  ctx.fillText(`Objects: ${data.stats.objectCount}`, padding + 10, y); y += lineHeight;
}

function getObjectColor(type: string): string {
  const colors: Record<string, string> = {
    tree: '#228b22',
    tree_deciduous: '#32cd32',
    tree_conifer: '#006400',
    fountain: '#00bfff',
    bench: '#cd853f',
    bus_stop: '#ff6600',
    shelter: '#9370db',
    street_lamp: '#ffd700',
    traffic_light: '#ff3333',
    stop_sign: '#ff4444',
    yield_sign: '#ffcc00',
    crossing: '#ff8c00',
    fire_hydrant: '#ff0000',
    phone_booth: '#4169e1',
    clock: '#ffa500',
    flagpole: '#1e90ff',
  };
  return colors[type] || '#ff69b4'; // Pink for unknown types
}

function getObjectSize(type: string): number {
  const sizes: Record<string, number> = {
    tree: 5,
    tree_deciduous: 5,
    tree_conifer: 6,
    traffic_light: 7,
    stop_sign: 6,
    yield_sign: 6,
    crossing: 5,
    bus_stop: 6,
    street_lamp: 4,
    bench: 4,
    fountain: 6,
    fire_hydrant: 5,
  };
  return sizes[type] || 5;
}


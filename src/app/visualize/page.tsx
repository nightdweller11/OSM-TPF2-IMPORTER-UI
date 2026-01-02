'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { MapCanvas } from '@/components/visualizer/map-canvas';
import { parseLuaTable, type ParsedOsmData } from '@/lib/lua-parser';

export default function VisualizePage() {
  const searchParams = useSearchParams();
  const conversionId = searchParams.get('id');
  
  const [data, setData] = useState<ParsedOsmData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string>('');

  // Load from conversion if ID provided
  useEffect(() => {
    if (!conversionId) return;
    
    setLoading(true);
    setError(null);
    setFileName(`Conversion: ${conversionId}`);
    
    fetch(`/api/visualize?id=${conversionId}`)
      .then(res => res.json())
      .then(result => {
        console.log('[Visualize Page] API response:', { 
          hasError: !!result.error, 
          hasContent: !!result.content,
          contentLength: result.content?.length,
          path: result.path 
        });
        
        if (result.error) {
          setError(result.error);
        } else if (result.content) {
          console.log('[Visualize Page] Parsing content...');
          const parsed = parseLuaTable(result.content);
          console.log('[Visualize Page] Parsed result:', parsed.stats);
          console.log('[Visualize Page] Bounds:', parsed.bounds);
          
          if (parsed.stats.nodeCount === 0 && parsed.stats.edgeCount === 0) {
            setError('No data found in conversion output.');
          } else {
            setData(parsed);
          }
        }
      })
      .catch(err => {
        setError(`Failed to load conversion: ${err}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [conversionId]);
  
  // Display options
  const [showEdges, setShowEdges] = useState(true);
  const [showObjects, setShowObjects] = useState(true);
  const [showTowns, setShowTowns] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [colorByType, setColorByType] = useState(true);
  const [mapSize, setMapSize] = useState(500); // Default 0.5km
  
  // Node category toggles
  const [nodeCategories, setNodeCategories] = useState({
    edgeEndpoint: true,     // Road/track junction nodes
    pathStreet: false,      // Street tangent calculation nodes
    pathTrack: false,       // Track tangent calculation nodes
    forestPolygon: false,   // Forest/shrub polygon vertices (forester)
    groundPolygon: false,   // Ground surface polygon vertices (paver)
    unknownPolygon: false,  // Unknown orphan nodes
    outOfBounds: false,     // Out of bounds nodes
    removed: false,         // Optimized away nodes
    switch: true,           // Railway switches
    signal: true,           // Railway signals
  });
  
  const toggleNodeCategory = (category: string) => {
    setNodeCategories(prev => ({ ...prev, [category]: !prev[category as keyof typeof prev] }));
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const content = await file.text();
      const parsed = parseLuaTable(content);
      
      if (parsed.stats.nodeCount === 0 && parsed.stats.edgeCount === 0) {
        setError('No data found in file. Make sure this is a valid osmdata.lua file.');
      } else {
        setData(parsed);
      }
    } catch (err) {
      setError(`Failed to parse file: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const content = await file.text();
      const parsed = parseLuaTable(content);
      
      if (parsed.stats.nodeCount === 0 && parsed.stats.edgeCount === 0) {
        setError('No data found in file. Make sure this is a valid osmdata.lua file.');
      } else {
        setData(parsed);
      }
    } catch (err) {
      setError(`Failed to parse file: ${err}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">OSM Data Visualizer</h1>
          <p className="text-slate-400 text-sm">
            Upload your osmdata.lua to visualize the road network before importing into TPF2
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside className="lg:w-80 space-y-4">
            {/* File Upload */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-3">Load Data</h2>
              
              <div
                className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <input
                  type="file"
                  accept=".lua"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="text-slate-400">
                    <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm">Drop osmdata.lua here or click to browse</p>
                  </div>
                </label>
              </div>

              {loading && (
                <div className="mt-3 text-blue-400 text-sm">Loading...</div>
              )}

              {error && (
                <div className="mt-3 text-red-400 text-sm">{error}</div>
              )}

              {fileName && !error && (
                <div className="mt-3 text-green-400 text-sm">Loaded: {fileName}</div>
              )}
            </div>

            {/* Display Options */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-3">Display Options</h2>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEdges}
                    onChange={e => setShowEdges(e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600"
                  />
                  <span>Show Roads/Tracks</span>
                </label>
                
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showObjects}
                    onChange={e => setShowObjects(e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600"
                  />
                  <span>Show Objects</span>
                </label>
                
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTowns}
                    onChange={e => setShowTowns(e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600"
                  />
                  <span>Show Towns</span>
                </label>
                
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={e => setShowGrid(e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600"
                  />
                  <span>Show Grid</span>
                </label>
                
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={colorByType}
                    onChange={e => setColorByType(e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600"
                  />
                  <span>Color by Type</span>
                </label>
              </div>
              
              {/* Node Categories */}
              <div className="mt-4 pt-4 border-t border-slate-700">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Node Types</h3>
                <div className="space-y-1 text-xs">
                  {[
                    { key: 'edgeEndpoint', label: 'Road/Track Junctions', color: '#4a90d9', desc: 'Used by edges' },
                    { key: 'switch', label: 'Railway Switches', color: '#ff00ff', desc: 'Track switches' },
                    { key: 'signal', label: 'Railway Signals', color: '#ffff00', desc: 'Track signals' },
                    { key: 'pathStreet', label: 'Street Path Nodes', color: '#90EE90', desc: 'Tangent calc' },
                    { key: 'pathTrack', label: 'Track Path Nodes', color: '#87CEEB', desc: 'Tangent calc' },
                    { key: 'forestPolygon', label: 'Forest/Shrub Polygons', color: '#228B22', desc: 'Forester vertices' },
                    { key: 'groundPolygon', label: 'Ground Surfaces', color: '#CD853F', desc: 'Paver vertices' },
                    { key: 'unknownPolygon', label: 'Unknown Polygons', color: '#9370DB', desc: 'Other vertices' },
                    { key: 'outOfBounds', label: 'Out of Bounds', color: '#FF6347', desc: 'Outside map' },
                    { key: 'removed', label: 'Removed (debug)', color: '#808080', desc: 'Optimized away' },
                  ].map(({ key, label, color, desc }) => (
                    <label key={key} className="flex items-center gap-2 text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nodeCategories[key as keyof typeof nodeCategories]}
                        onChange={() => toggleNodeCategory(key)}
                        className="rounded bg-slate-700 border-slate-600 w-3 h-3"
                      />
                      <span 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: color }}
                      />
                      <span className="flex-1">{label}</span>
                      {data?.stats.nodesByCategory[key as keyof typeof nodeCategories] !== undefined && (
                        <span className="text-slate-500 font-mono">
                          {data.stats.nodesByCategory[key as keyof typeof nodeCategories] || 0}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Map Size */}
              <div className="mt-4 pt-4 border-t border-slate-700">
                <label className="text-slate-300 text-sm block mb-2">
                  Expected Map Size (meters)
                </label>
                <select
                  value={mapSize}
                  onChange={e => setMapSize(parseInt(e.target.value))}
                  className="w-full bg-slate-700 text-white rounded px-3 py-2 text-sm"
                >
                  <option value={0}>Hide bounds</option>
                  <option value={512}>512m (0.5km)</option>
                  <option value={1024}>1024m (1km)</option>
                  <option value={2048}>2048m (2km)</option>
                  <option value={4096}>4096m (4km)</option>
                  <option value={8192}>8192m (8km)</option>
                  <option value={16384}>16384m (16km)</option>
                </select>
                <p className="text-slate-500 text-xs mt-1">
                  Green dashed box shows expected import area
                </p>
              </div>
            </div>

            {/* Statistics */}
            {data && (
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-3">Statistics</h2>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-slate-300">
                    <span>Total Nodes:</span>
                    <span className="font-mono">{data.stats.nodeCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-xs pl-4">
                    <span>Active (in-bounds):</span>
                    <span className="font-mono text-green-400">{data.stats.activeNodeCount.toLocaleString()}</span>
                  </div>
                  
                  {/* Node category breakdown */}
                  {data.stats.nodesByCategory && Object.keys(data.stats.nodesByCategory).length > 0 && (
                    <div className="mt-2 mb-2">
                      <div className="text-slate-400 text-xs font-semibold mb-1">By Category:</div>
                      {Object.entries(data.stats.nodesByCategory)
                        .filter(([, count]) => (count as number) > 0)
                        .sort((a, b) => (b[1] as number) - (a[1] as number))
                        .map(([category, count]) => {
                          const colors: Record<string, string> = {
                            edgeEndpoint: '#4a90d9',
                            pathStreet: '#90EE90',
                            pathTrack: '#87CEEB',
                            forestPolygon: '#228B22',
                            groundPolygon: '#CD853F',
                            unknownPolygon: '#9370DB',
                            outOfBounds: '#FF6347',
                            removed: '#808080',
                            switch: '#ff00ff',
                            signal: '#ffff00',
                          };
                          const labels: Record<string, string> = {
                            edgeEndpoint: 'Edge Endpoints',
                            pathStreet: 'Street Path',
                            pathTrack: 'Track Path',
                            forestPolygon: 'Forest/Shrub',
                            groundPolygon: 'Ground Surface',
                            unknownPolygon: 'Orphan/Unused',
                            outOfBounds: 'Out of Bounds',
                            removed: 'Removed',
                            switch: 'Switches',
                            signal: 'Signals',
                          };
                          return (
                            <div key={category} className="flex justify-between text-xs pl-4">
                              <span style={{ color: colors[category] || '#888' }}>
                                {labels[category] || category}:
                              </span>
                              <span className="font-mono text-slate-400">{(count as number).toLocaleString()}</span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                  
                  <div className="flex justify-between text-slate-300">
                    <span>Edges:</span>
                    <span className="font-mono">{data.stats.edgeCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-xs pl-4">
                    <span>Streets:</span>
                    <span className="font-mono">{data.stats.streetEdges.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-xs pl-4">
                    <span>Tracks:</span>
                    <span className="font-mono">{data.stats.trackEdges.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Objects:</span>
                    <span className="font-mono">{data.stats.objectCount.toLocaleString()}</span>
                  </div>
                  {Object.keys(data.stats.objectsByType).length > 0 && (
                    <>
                      {Object.entries(data.stats.objectsByType)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([type, count]) => (
                          <div key={type} className="flex justify-between text-slate-400 text-xs pl-4">
                            <span>{type.replace(/_/g, ' ')}:</span>
                            <span className="font-mono">{count}</span>
                          </div>
                        ))}
                      {Object.keys(data.stats.objectsByType).length > 5 && (
                        <div className="text-slate-500 text-xs pl-4">
                          +{Object.keys(data.stats.objectsByType).length - 5} more types
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between text-slate-300">
                    <span>Towns:</span>
                    <span className="font-mono">{data.stats.townCount.toLocaleString()}</span>
                  </div>
                  
                  <hr className="border-slate-700 my-2" />
                  
                  <div className="flex justify-between text-slate-300">
                    <span>Data Width:</span>
                    <span className="font-mono">{Math.round(data.bounds.maxX - data.bounds.minX)}m</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Data Height:</span>
                    <span className="font-mono">{Math.round(data.bounds.maxY - data.bounds.minY)}m</span>
                  </div>
                  
                  {/* Out of bounds warning */}
                  {mapSize > 0 && (
                    <>
                      <hr className="border-slate-700 my-2" />
                      {(() => {
                        const halfSize = mapSize / 2;
                        const outOfBoundsNodes = Object.values(data.nodes).filter(n => 
                          Math.abs(n.pos[0]) > halfSize || Math.abs(n.pos[1]) > halfSize
                        ).length;
                        const pct = ((outOfBoundsNodes / data.stats.nodeCount) * 100).toFixed(1);
                        return outOfBoundsNodes > 0 ? (
                          <div className="text-yellow-400 text-xs">
                            ⚠️ {outOfBoundsNodes} nodes ({pct}%) outside {mapSize}m bounds
                          </div>
                        ) : (
                          <div className="text-green-400 text-xs">
                            ✓ All nodes within {mapSize}m bounds
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            )}
            
            {/* What are nodes? */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-3">Node Categories</h2>
              <div className="text-slate-400 text-xs space-y-2">
                <p>
                  <strong style={{color: '#4a90d9'}}>Edge Endpoints</strong> - Junction points where roads/tracks connect.
                  These are the ONLY nodes that form actual road segments in TPF2.
                </p>
                <p>
                  <strong style={{color: '#228B22'}}>Forest/Shrub Polygons</strong> - Vertices for forests and shrubs.
                  Used by the <em>Forester</em> module to place trees.
                </p>
                <p>
                  <strong style={{color: '#CD853F'}}>Ground Surfaces</strong> - Vertices for ground textures/surfaces.
                  Used by the <em>Paver</em> module to apply terrain materials.
                </p>
                <p>
                  <strong style={{color: '#9370DB'}}>Orphan/Unused</strong> - Nodes that exist in OSM but are NOT used by the importer.
                  These are leftover nodes from filtered ways (pedestrian paths, etc.) and can be safely ignored.
                </p>
                <p>
                  <strong style={{color: '#90EE90'}}>Path Nodes</strong> - Used for calculating smooth tangents/curves.
                  Referenced by edges but not edge endpoints themselves.
                </p>
                <p>
                  <strong style={{color: '#FF6347'}}>Out of Bounds</strong> - Nodes explicitly outside your map area.
                  These will be skipped during import.
                </p>
                <p>
                  <strong style={{color: '#808080'}}>Removed</strong> - Optimized away during conversion.
                  Not used for anything.
                </p>
              </div>
            </div>

            {/* Legend */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-3">Legend</h2>
              
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-[#e892a2]"></div>
                  <span className="text-slate-400">Motorway</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-[#f9b29c]"></div>
                  <span className="text-slate-400">Trunk</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-[#fcd6a4]"></div>
                  <span className="text-slate-400">Primary</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-[#f7fabf]"></div>
                  <span className="text-slate-400">Secondary</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-white"></div>
                  <span className="text-slate-400">Residential</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-[#666666]"></div>
                  <span className="text-slate-400">Railway</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-[#aad3df]"></div>
                  <span className="text-slate-400">Water</span>
                </div>
                
                <hr className="border-slate-700 my-2" />
                
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#4a90d9]"></div>
                  <span className="text-slate-400">Node</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff00ff]"></div>
                  <span className="text-slate-400">Switch</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#228b22]"></div>
                  <span className="text-slate-400">Tree</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff0000]"></div>
                  <span className="text-slate-400">Traffic Light</span>
                </div>
              </div>
            </div>

            {/* Controls Help */}
            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-3">Controls</h2>
              <div className="text-slate-400 text-sm space-y-1">
                <p>🖱️ <strong>Drag</strong> - Pan the view</p>
                <p>🔍 <strong>Scroll</strong> - Zoom in/out</p>
              </div>
            </div>
          </aside>

          {/* Map Canvas */}
          <div className="flex-1">
            {data ? (
              <MapCanvas
                data={data}
                width={900}
                height={700}
                nodeCategories={nodeCategories}
                showEdges={showEdges}
                showObjects={showObjects}
                showTowns={showTowns}
                showGrid={showGrid}
                colorByType={colorByType}
                mapSize={mapSize}
              />
            ) : (
              <div className="bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center" style={{ width: 900, height: 700 }}>
                <div className="text-center text-slate-400">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <p className="text-lg">No data loaded</p>
                  <p className="text-sm">Upload an osmdata.lua file to visualize</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


'use client'
import React, { useState, useEffect, useMemo, useRef } from 'react'
import Map, { Source, Layer, Marker, Popup, NavigationControl, MapRef } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ImageIcon, AlertCircle, Settings, X, Check } from 'lucide-react'

// Default Fallback Key
const DEFAULT_MAPTILER_KEY = 'DrU4I4w60NeH94av58n7';

export default function MapUI({ geoData, triggerData, imgCount, trigCount }: { 
    geoData: Array<{ lat: number, lon: number, alt: number, photo_file: string, thumbnail?: string }>,
    triggerData?: Array<{ lat: number, lon: number, alt: number }>,
    imgCount?: number,
    trigCount?: number
}) {
    const mapRef = useRef<MapRef>(null);
    const [apiKey, setApiKey] = useState(DEFAULT_MAPTILER_KEY);
    const [tempKey, setTempKey] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    
    const [viewState, setViewState] = useState({
        latitude: 0,
        longitude: 0,
        zoom: 2,
        pitch: 0,
        bearing: 0
    });
    const [is3D, setIs3D] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);

    // Load custom key from localStorage on mount
    useEffect(() => {
        const savedKey = localStorage.getItem('apogee_maptiler_key');
        if (savedKey) {
            setApiKey(savedKey);
            setTempKey(savedKey);
        } else {
            setTempKey(DEFAULT_MAPTILER_KEY);
        }
    }, []);

    const saveApiKey = () => {
        if (tempKey.trim()) {
            setApiKey(tempKey.trim());
            localStorage.setItem('apogee_maptiler_key', tempKey.trim());
            setShowSettings(false);
        }
    };

    const MAP_STYLE = useMemo(() => 
        `https://api.maptiler.com/maps/hybrid/style.json?key=${apiKey}`,
    [apiKey]);

    // Initial positioning and "Fit Bounds" logic
    useEffect(() => {
        const points: [number, number][] = [];
        if (geoData && geoData.length > 0) {
            geoData.forEach(d => points.push([d.lon, d.lat]));
        }
        if (triggerData && triggerData.length > 0) {
            triggerData.forEach(d => points.push([d.lon, d.lat]));
        }

        if (points.length > 0) {
            const lons = points.map(p => p[0]);
            const lats = points.map(p => p[1]);
            const minLon = Math.min(...lons);
            const maxLon = Math.max(...lons);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);

            if (mapRef.current) {
                mapRef.current.fitBounds(
                    [[minLon, minLat], [maxLon, maxLat]],
                    { padding: 50, duration: 1000 }
                );
            } else {
                setViewState(prev => ({
                    ...prev,
                    latitude: (minLat + maxLat) / 2,
                    longitude: (minLon + maxLon) / 2,
                    zoom: 17
                }));
            }
        }
    }, [geoData, triggerData]);

    // Toggle 3D Terrain
    const toggle3D = () => {
        const next3D = !is3D;
        setIs3D(next3D);
        if (mapRef.current) {
            mapRef.current.easeTo({
                pitch: next3D ? 60 : 0,
                duration: 800
            });
        }
    };

    // GeoJSON for Triggers
    const triggerGeoJSON = useMemo(() => ({
        type: 'FeatureCollection' as const,
        features: (triggerData || []).map((trig, idx) => ({
            type: 'Feature' as const,
            geometry: { 
                type: 'Point' as const, 
                coordinates: [trig.lon, trig.lat] as [number, number] 
            },
            properties: { id: idx, alt: trig.alt }
        }))
    }), [triggerData]);

    // GeoJSON for Flight Path
    const pathGeoJSON = useMemo(() => ({
        type: 'Feature' as const,
        properties: {},
        geometry: {
            type: 'LineString' as const,
            coordinates: geoData.map(d => [d.lon, d.lat])
        }
    }), [geoData]);

    return (
        <div className="relative w-full h-full group font-sans overflow-hidden">
            <Map
                ref={mapRef}
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                onClick={() => setSelectedPhoto(null)}
                mapStyle={MAP_STYLE}
                style={{ width: '100%', height: '100%' }}
                maxPitch={85}
                terrain={is3D ? { source: 'maptiler-terrain', exaggeration: 1.5 } : undefined}
            >
                <NavigationControl position="bottom-right" />

                {/* Terrain Source */}
                <Source
                    id="maptiler-terrain"
                    type="raster-dem"
                    url={`https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=${apiKey}`}
                    tileSize={256}
                />

                {/* Flight Path Layer */}
                {geoData.length > 1 && (
                    <Source id="flight-path" type="geojson" data={pathGeoJSON}>
                        <Layer
                            id="path-line"
                            type="line"
                            paint={{
                                'line-color': '#06b6d4',
                                'line-width': 2,
                                'line-opacity': 0.5,
                                'line-dasharray': [2, 2]
                            }}
                        />
                    </Source>
                )}

                {/* Trigger Layer */}
                <Source id="triggers" type="geojson" data={triggerGeoJSON}>
                    <Layer
                        id="trigger-circles"
                        type="circle"
                        paint={{
                            'circle-radius': 4,
                            'circle-color': '#a855f7',
                            'circle-stroke-width': 1,
                            'circle-stroke-color': '#ffffff',
                            'circle-opacity': 0.8
                        }}
                    />
                </Source>

                {/* Photo Markers */}
                {geoData.map((pos, idx) => (
                    <Marker
                        key={`photo-${idx}`}
                        longitude={pos.lon}
                        latitude={pos.lat}
                        anchor="bottom"
                        onClick={e => {
                            e.originalEvent.stopPropagation();
                            setSelectedPhoto(idx);
                        }}
                    >
                        <div className="cursor-pointer transition-transform hover:scale-110 drop-shadow-md">
                            <div className="w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-lg" />
                        </div>
                    </Marker>
                ))}

                {/* Photo Popup */}
                {selectedPhoto !== null && (
                    <Popup
                        longitude={geoData[selectedPhoto].lon}
                        latitude={geoData[selectedPhoto].lat}
                        anchor="bottom"
                        offset={15}
                        closeOnClick={true}
                        onClose={() => setSelectedPhoto(null)}
                        maxWidth="240px"
                        className="custom-popup"
                    >
                        <div className="flex flex-col gap-2 p-1">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                                    <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight truncate" title={geoData[selectedPhoto].photo_file}>
                                        {geoData[selectedPhoto].photo_file.split(/[\\/]/).pop()}
                                    </span>
                                </div>
                                <span className="text-[9px] font-mono text-slate-400">#{selectedPhoto + 1}</span>
                            </div>
                            
                            <div className="relative group overflow-hidden rounded-lg bg-slate-100 border border-slate-200 aspect-[4/3] flex items-center justify-center">
                                {geoData[selectedPhoto].thumbnail ? (
                                    <img 
                                        src={geoData[selectedPhoto].thumbnail} 
                                        alt="Thumbnail" 
                                        className="w-full h-full object-cover" 
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-slate-400">
                                        <ImageIcon size={24} />
                                        <span className="text-[9px] font-medium uppercase tracking-widest">No Preview</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex flex-col gap-1.5 mt-1 bg-slate-50 p-2 rounded-md border border-slate-100">
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Altitude</span>
                                    <span className="text-[9px] font-mono font-bold text-fuchsia-600">{geoData[selectedPhoto].alt.toFixed(2)}m</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Coords</span>
                                    <span className="text-[9px] font-mono font-bold text-slate-700">
                                        {geoData[selectedPhoto].lat.toFixed(6)}, {geoData[selectedPhoto].lon.toFixed(6)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Popup>
                )}
            </Map>

            {/* Premium 2D/3D Pill Toggle */}
            <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-3">
                <div 
                    onClick={toggle3D}
                    className={`relative w-20 h-9 rounded-full cursor-pointer transition-all duration-500 flex items-center px-[6px] shadow-2xl border border-white/10
                        ${is3D ? 'bg-emerald-600' : 'bg-slate-800'}`}
                >
                    {/* Sliding Thumb */}
                    <div 
                        className={`absolute w-7 h-7 bg-white rounded-full shadow-lg transition-all duration-500 ease-out transform
                            ${is3D ? 'translate-x-[40px]' : 'translate-x-0'}`}
                    />

                    {/* Labels */}
                    <div className="absolute inset-0 flex select-none pointer-events-none">
                        <div className={`flex-1 flex items-center justify-center text-[9px] font-black transition-all duration-500 ${is3D ? 'text-white/30' : 'text-slate-900'}`}>
                            2D
                        </div>
                        <div className={`flex-1 flex items-center justify-center pl-[1px] text-[9px] font-black transition-all duration-500 ${is3D ? 'text-emerald-950' : 'text-white/30'}`}>
                            3D
                        </div>
                    </div>
                </div>

                {/* Settings Toggle Button */}
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-9 h-9 rounded-full bg-slate-900/90 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors shadow-lg ml-0.5"
                >
                    <Settings size={16} className={showSettings ? 'animate-spin-slow' : ''} />
                </button>
            </div>

            {/* MapTiler Settings Overlay */}
            {showSettings && (
                <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                                <Settings size={14} className="text-cyan-400" />
                                Map Settings
                            </h3>
                            <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5 flex flex-col gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MapTiler API Key</label>
                                <div className="relative group">
                                    <input 
                                        type="password"
                                        value={tempKey}
                                        onChange={(e) => setTempKey(e.target.value)}
                                        placeholder="Enter MapTiler Key..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-cyan-50 text-slate-200 focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                                    />
                                    {tempKey === apiKey && (
                                        <Check size={14} className="absolute right-3 top-3 text-emerald-500" />
                                    )}
                                </div>
                                <p className="text-[9px] text-slate-500 italic">
                                    Used for high-resolution satellite imagery and 3D terrain. Get your own key at <a href="https://maptiler.com" target="_blank" className="text-cyan-500 hover:underline">maptiler.com</a>.
                                </p>
                            </div>
                            <button 
                                onClick={saveApiKey}
                                disabled={!tempKey || tempKey === apiKey}
                                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95"
                            >
                                Apply & Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Consolidated Mission Overlay */}
            <div className="absolute top-4 right-4 z-[1000] pointer-events-none select-none">
                <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden min-w-[120px]">
                    <div className="px-3 py-1.5 bg-cyan-600/20 border-b border-white/5 flex justify-between items-center gap-4">
                        <span className="text-[9px] font-bold text-cyan-300 uppercase tracking-widest">Pins</span>
                        <span className="text-sm font-black text-white font-mono">{geoData.length}</span>
                    </div>
                    {imgCount !== undefined && (
                        <div className="px-3 py-1.5 flex justify-between items-center gap-4 border-b border-white/5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Images</span>
                            <span className="text-sm font-black text-slate-200 font-mono">{imgCount}</span>
                        </div>
                    )}
                    {trigCount !== undefined && (
                        <div className="px-3 py-1.5 flex justify-between items-center gap-4">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Triggers</span>
                            <span className="text-sm font-black text-slate-200 font-mono">{trigCount}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Indrones Logo Overlay */}
            <div className="absolute bottom-4 left-4 z-[1000] pointer-events-none select-none">
                <img src="/logo.png" alt="Indrones Logo" className="h-10 w-auto opacity-80 drop-shadow-lg" />
            </div>

            <style jsx global>{`
                .maplibregl-popup-content {
                    padding: 8px !important;
                    border-radius: 12px !important;
                    background: white !important;
                    box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
                    border: 1px solid #e2e8f0 !important;
                }
                .maplibregl-popup-tip {
                    border-top-color: white !important;
                }
                .animate-spin-slow {
                    animation: spin 8s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}





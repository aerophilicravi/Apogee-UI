'use client'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect } from 'react'
import { ImageIcon, AlertCircle } from 'lucide-react'

function MapUpdater({ geoData, triggerData }: { geoData: any[], triggerData?: any[] }) {
    const map = useMap();
    useEffect(() => {
        const points: [number, number][] = [];
        if (geoData && geoData.length > 0) {
            geoData.forEach(d => points.push([d.lat, d.lon]));
        }
        if (triggerData && triggerData.length > 0) {
            triggerData.forEach(d => points.push([d.lat, d.lon]));
        }

        if (points.length > 0) {
            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [geoData, triggerData, map]);
    return null;
}

export default function MapUI({ geoData, triggerData, imgCount, trigCount }: { 
    geoData: Array<{ lat: number, lon: number, alt: number, photo_file: string, thumbnail?: string }>,
    triggerData?: Array<{ lat: number, lon: number, alt: number }>,
    imgCount?: number,
    trigCount?: number
}) {
    useEffect(() => {
        // Fix Leaflet's default icon paths statically for NextJS + Electron
        delete (L.Icon.Default.prototype as any)._getIconUrl
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        })
    }, []);

    const center = geoData && geoData.length > 0 ? [geoData[0].lat, geoData[0].lon] as [number, number] : [0, 0] as [number, number];
    const photoPositions = geoData ? geoData.map(d => [d.lat, d.lon] as [number, number]) : [];

    return (
        <div className="relative w-full h-full group">
            <MapContainer center={center} zoom={geoData.length > 0 ? 17 : 2} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
                <MapUpdater geoData={geoData} triggerData={triggerData} />
                
                {/* Raw Triggers (Log Data) - Rendered behind photos */}
                {triggerData && triggerData.map((trig, idx) => (
                    <CircleMarker
                        key={`trig-${idx}`}
                        center={[trig.lat, trig.lon]}
                        radius={3}
                        pathOptions={{
                            fillColor: '#a855f7', // purple-500
                            color: '#ffffff',
                            weight: 1,
                            opacity: 0.8,
                            fillOpacity: 0.6
                        }}
                    >
                        <Popup>
                                <div className="text-[10px] p-1">
                                    <div className="font-bold text-purple-600 mb-1">Mavlink CAM Trigger</div>
                                    <div className="font-mono text-slate-500">#{idx + 1}</div>
                                    <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">MSL Altitude: <span className="text-slate-600">{trig.alt.toFixed(2)}m</span></div>
                                </div>
                        </Popup>
                    </CircleMarker>
                ))}

                {/* Photo Pins */}
                {geoData.map((pos, idx) => (
                    <Marker 
                        key={`photo-${idx}`}
                        position={[pos.lat, pos.lon]} 
                    >
                        <Popup minWidth={220}>
                            <div className="flex flex-col gap-2 p-1">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                                            <span className="text-[10px] font-bold text-slate-800 uppercase tracking-tight truncate" title={pos.photo_file}>{pos.photo_file.split(/[\\/]/).pop()}</span>
                                        </div>
                                        <span className="text-[9px] font-mono text-slate-400">#{idx + 1}</span>
                                    </div>
                                
                                <div className="relative group overflow-hidden rounded-lg bg-slate-100 border border-slate-200 aspect-[4/3] flex items-center justify-center">
                                    {pos.thumbnail ? (
                                        <img 
                                            src={pos.thumbnail} 
                                            alt={pos.photo_file} 
                                            className="w-full h-full object-cover" 
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                            <ImageIcon size={24} />
                                            <span className="text-[9px] font-medium uppercase tracking-widest">Generating...</span>
                                        </div>
                                    )}
                                </div>
                                
                                    <div className="flex flex-col gap-1.5 mt-1 bg-slate-50 p-2 rounded-md border border-slate-100">
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Filename</span>
                                            <span className="text-[9px] font-mono text-slate-600 truncate max-w-[120px]" title={pos.photo_file}>{pos.photo_file.split(/[\\/]/).pop()}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">MSL Altitude</span>
                                            <span className="text-[9px] font-mono font-bold text-fuchsia-600">{pos.alt.toFixed(2)}m</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Coordinates</span>
                                            <span className="text-[9px] font-mono font-bold text-slate-700">{pos.lat.toFixed(6)}, {pos.lon.toFixed(6)}</span>
                                        </div>
                                    </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {photoPositions.length > 1 && (
                    <Polyline positions={photoPositions} pathOptions={{ color: '#06b6d4', weight: 2, opacity: 0.5, dashArray: '5, 10' }} />
                )}
            </MapContainer>

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
                    {imgCount !== undefined && trigCount !== undefined && imgCount !== trigCount && (
                        <div className="px-3 py-1.5 bg-amber-500/20 border-t border-amber-500/30 flex items-center gap-2">
                             <AlertCircle size={10} className="text-amber-400 animate-pulse" />
                             <span className="text-[8px] font-bold text-amber-200 uppercase tracking-tight">Mismatch Detected</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Indrones Logo Overlay */}
            <div className="absolute bottom-4 left-4 z-[1000] pointer-events-none select-none">
                <img src="/logo.png" alt="Indrones Logo" className="h-10 w-auto opacity-80 drop-shadow-lg" />
            </div>
        </div>
    )
}

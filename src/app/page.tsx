'use client';
import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { FolderOpen, Play, AlertCircle, Terminal, Map as MapIcon, Square, Plus, X, Database, Settings, Zap } from 'lucide-react';

declare global {
  interface Window {
    api?: any;
  }
}

const MapUI = dynamic(() => import('@/components/MapUI'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full text-slate-400 bg-slate-900 border border-slate-800">
      <MapIcon className="animate-pulse opacity-50" size={48} />
    </div>
  )
});

// Each flight is represented as a slot; path is '' while not yet selected
// Status defines the lifecycle of a flight folder in the app
type SlotStatus = 'idle' | 'ready' | 'processed' | 'finalized' | 'failed';

type FlightSlot = { 
  id: number; 
  path: string; 
  label: string;
  status: SlotStatus;
  imgCount?: number;
  trigCount?: number;
  triggerData?: Array<{ lat: number; lon: number; alt: number }>;
};

let slotIdCounter = 1;

function makeSlot(index: number): FlightSlot {
  return { id: Date.now() + Math.random(), path: '', label: `Flight ${index}`, status: 'idle' };
}

export default function Home() {
  const [flights, setFlights] = useState<FlightSlot[]>([makeSlot(1)]);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [processing, setProcessing] = useState(false);

  const [altThreshold, setAltThreshold] = useState<string>('40.0');
  const [autoWrite, setAutoWrite] = useState<boolean>(false);

  const [logs, setLogs] = useState<string[]>([]);
  const [geoData, setGeoData] = useState<Array<{ lat: number; lon: number; alt: number; photo_file: string; thumbnail?: string }>>([]);
  const logViewerRef = useRef<HTMLDivElement>(null);

  const api = () => (typeof window !== 'undefined' ? (window as any).api : null);

  useEffect(() => {
    if (logViewerRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = logViewerRef.current;
      if (scrollHeight - clientHeight - scrollTop < 150) {
        logViewerRef.current.scrollTop = logViewerRef.current.scrollHeight;
      }
    }
  }, [logs]);

  useEffect(() => {
    const a = api();
    if (!a) return;
    const cleanOut = a.onLogStdOut((data: string) => {
      // Intercept metadata lines
      if (data.includes('[METADATA]')) {
        const photosMatch = /photos:(\d+)/.exec(data);
        const triggersMatch = /triggers:(\d+)/.exec(data);
        if (photosMatch || triggersMatch) {
          setFlights(prev => {
            const updated = [...prev];
            if (updated[activeTab]) {
                if (photosMatch) updated[activeTab].imgCount = parseInt(photosMatch[1]);
                if (triggersMatch) updated[activeTab].trigCount = parseInt(triggersMatch[1]);
            }
            return updated;
          });
          return; // Don't log metadata lines to the console
        }
      }
      addLog(data);
    });
    const cleanErr = a.onLogStdErr((data: string) => {
      const trimmed = data.trim();
      if (trimmed) addLog(`[ERR] ${trimmed}`);
    });
    return () => { cleanOut(); cleanErr(); };
  }, [activeTab]);

  // TAB ISOLATION: Reload map whenever the active tab changes
  useEffect(() => {
    const activeFlight = flights[activeTab];
    if (activeFlight && activeFlight.path) {
      loadGeodata([activeFlight.path], true); // Force clear before loading
    } else {
      setGeoData([]);
    }
  }, [activeTab, flights.length]);

  const addLog = (msg: string) => {
    // Split by newline so multi-line chunks render as separate lines
    const lines = msg.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0);
    setLogs(prev => [...prev, ...lines]);
  };

  const handleBrowse = async (slotIndex: number) => {
    const a = api();
    if (!a) return;
    try {
      const dirs: string[] = await a.openDirectory();
      if (!dirs || dirs.length === 0) return;
      const chosen = dirs[0];
      
      // Check if KML already exists to set initial status
      const hasKml = await a.checkKmlExists(chosen);
      
      setFlights(prev => {
        const updated = [...prev];
        updated[slotIndex] = {
          ...updated[slotIndex],
          path: chosen,
          label: chosen.split(/[\\/]/).pop() || `Flight ${slotIndex + 1}`,
          status: hasKml ? 'ready' : 'idle'
        };
        return updated;
      });
      addLog(`[SYSTEM] Flight ${slotIndex + 1} folder set: ${chosen}`);
      if (hasKml && activeTab === slotIndex) {
        loadGeodata([chosen], true);
      }
    } catch (e) {
      addLog(`[ERROR] Could not open directory picker: ${e}`);
    }
  };

  const addFlight = () => {
    setFlights(prev => {
      const nextIndex = prev.length + 1;
      return [...prev, makeSlot(nextIndex)];
    });
    setActiveTab(flights.length); // switch to new tab
  };

  const removeFlight = (index: number) => {
    setFlights(prev => {
      if (prev.length === 1) return [{ ...prev[0], path: '', label: 'Flight 1' }]; // reset if last
      return prev.filter((_, i) => i !== index);
    });
    setActiveTab(prev => Math.max(0, Math.min(prev, flights.length - 2)));
  };

  const loadGeodata = async (dirs: string[], clearFirst = false) => {
    const a = api();
    if (!a) return;
    let cumulative: any[] = [];
    if (clearFirst) setGeoData([]);
    
    for (const dir of dirs) {
      const result = await a.readGeodata(dir);
      if (result && result.geoData) {
        cumulative = [...cumulative, ...result.geoData];
        // If it's a single directory load (typical case), update metadata for the active slot
        if (dirs.length === 1) {
          setFlights(prev => {
            const updated = [...prev];
            if (updated[activeTab]) {
                if (result.imgCount !== undefined) updated[activeTab].imgCount = result.imgCount;
                if (result.trigCount !== undefined) updated[activeTab].trigCount = result.trigCount;
                if (result.triggerData !== undefined) updated[activeTab].triggerData = result.triggerData;
            }
            return updated;
          });
        }
      }
    }
    
    if (cumulative.length > 0) {
      setGeoData(prev => clearFirst ? cumulative : [...prev, ...cumulative]);
      if (clearFirst) {
        addLog(`[SYSTEM] Loaded ${cumulative.length} coordinates into map for active flight.`);
      }
    }
  };

  const runProcessor = async () => {
    const a = api();
    if (!a) return;
    const validFlights = flights.filter(f => f.path !== '' && f.status !== 'finalized');
    if (validFlights.length === 0) return;

    setProcessing(true);
    addLog('\n===========================================');
    addLog(`[PROCESS] Step 1: Generating KML and Thumbnails for ${validFlights.length} flight(s)...`);

    for (const flight of validFlights) {
      addLog(`\n[PROCESS] Working on: ${flight.label}`);
      const code = await a.runGeotag({ 
        imageDir: flight.path, 
        alt: parseFloat(altThreshold), 
        auto: autoWrite // This still dictates if Python does EXIF in Step 1
      });

      if (code === 0) {
        setFlights(prev => prev.map(f => f.id === flight.id ? { ...f, status: autoWrite ? 'finalized' : 'processed' } : f));
        addLog(`[PROCESS] ${flight.label} alignment complete (Yellow status).`);
      } else {
        setFlights(prev => prev.map(f => f.id === flight.id ? { ...f, status: 'failed' } : f));
        addLog(`[PROCESS] ${flight.label} failed with code ${code}.`);
      }
    }

    addLog('[PROCESS] Batch Step 1 complete. Refreshing map...');
    const activeFlight = flights[activeTab];
    if (activeFlight && activeFlight.path) loadGeodata([activeFlight.path], true);
    setProcessing(false);
  };

  const runFinalize = async (flight: FlightSlot) => {
    const a = api();
    if (!a) return;
    if (!flight.path) return;

    setProcessing(true);
    addLog('\n===========================================');
    addLog(`[PROCESS] Step 2: Injecting EXIF for ${flight.label}...`);

    const code = await a.finalizeGeotag({ imageDir: flight.path, useMp: true });
    
    if (code === 0) {
      setFlights(prev => prev.map(f => f.id === flight.id ? { ...f, status: 'finalized' } : f));
      addLog(`[PROCESS] ${flight.label} finalized successfully (Green status).`);
    } else {
      addLog(`[PROCESS] Finalization failed for ${flight.label}.`);
    }
    setProcessing(false);
  };

  const runFinalizeAll = async () => {
    const processedFlights = flights.filter(f => f.status === 'processed' || f.status === 'ready');
    if (processedFlights.length === 0) return;

    setProcessing(true);
    addLog('\n===========================================');
    addLog(`[PROCESS] Batch Finalization for ${processedFlights.length} flight(s)...`);

    for (const f of processedFlights) {
      await runFinalize(f);
    }
    setProcessing(false);
  };

  const handleStop = async () => {
    const a = api();
    if (!a) return;
    const stopped = await a.stopGeotag();
    if (stopped) {
      addLog('[SYSTEM] Processing stopped by user.');
      setProcessing(false);
    }
  };

  const hasValidFlight = flights.some(f => f.path !== '');

  return (
    <main className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-fuchsia-500/30">

      {/* ── LEFT PANEL ── */}
      <div className="w-[420px] min-w-[420px] bg-slate-900/50 border-r border-slate-800/80 p-6 flex flex-col relative z-10 shadow-2xl overflow-y-auto">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-violet-600 flex items-center justify-center shadow-lg shadow-fuchsia-900/20">
            <MapIcon className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-cyan-400 tracking-tight">Apogee GeoTag</h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide">MAVLINK EXIF SYNCHRONIZER</p>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-rose-500/10 rounded-xl p-3 border border-rose-500/20 mb-6 flex items-start gap-3">
          <AlertCircle className="text-rose-400 shrink-0 mt-0.5" size={15} />
          <span className="text-[11px] text-rose-400/90 leading-relaxed font-medium">Delete all ground images and test shots from each flight folder before adding them here.</span>
        </div>

        <div className="space-y-6 flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar pb-6">
          
          {/* ── SECTION: DATA ── */}
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Database size={14} className="text-fuchsia-500" />
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data Management</h3>
            </div>
            
            <div className="bg-slate-950/40 rounded-xl border border-slate-800/60 backdrop-blur-md overflow-hidden">
              {/* Tab header row */}
              <div className="flex items-center border-b border-slate-800/60 bg-slate-900/30 overflow-x-auto">
                {flights.map((fl, i) => (
                  <button
                    key={fl.id}
                    onClick={() => setActiveTab(i)}
                    className={`flex flex-col items-start gap-1 px-4 py-2.5 text-[10px] whitespace-nowrap transition-all shrink-0 border-r border-slate-800/40 relative min-w-[100px] ${
                      activeTab === i
                        ? 'bg-fuchsia-600/20 text-fuchsia-300 border-b-2 border-b-fuchsia-500'
                        : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        fl.status === 'finalized' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 
                        fl.status === 'processed' || fl.status === 'ready' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]' :
                        fl.status === 'failed' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' :
                        'bg-slate-700'
                      }`} />
                      {fl.label}
                      {flights.length > 1 && (
                        <X 
                          size={10} 
                          onClick={e => { e.stopPropagation(); removeFlight(i); }}
                          className="ml-1 opacity-40 hover:opacity-100 hover:text-rose-400 transition-opacity cursor-pointer"
                        />
                      )}
                    </div>
                  </button>
                ))}
                <button
                  onClick={addFlight}
                  className="flex items-center justify-center px-4 py-2.5 text-slate-500 hover:text-fuchsia-400 hover:bg-slate-800/40 transition-colors shrink-0"
                  title="Add another flight slot"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Active tab content */}
              {flights[activeTab] && (
                <div className="p-4 bg-slate-900/10">
                  <button
                    onClick={() => handleBrowse(activeTab)}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/50 hover:border-fuchsia-500/40 text-slate-300 py-2.5 rounded-lg font-bold transition-all text-xs"
                  >
                    <FolderOpen size={14} />
                    {flights[activeTab].path ? 'Change Flight Folder' : 'Import Flight Folder'}
                  </button>
                  {flights[activeTab].path && (
                    <div className="space-y-2 mt-3">
                      <div className="text-[10px] text-slate-500 bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-800/40 break-all font-mono">
                        {flights[activeTab].path}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── SECTION: SETUP ── */}
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Settings size={14} className="text-cyan-500" />
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configuration</h3>
            </div>
            
            <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800/60 backdrop-blur-md space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2 block px-1">Airborne Altitude Threshold (m)</label>
                <div className="relative group">
                  <input
                    type="number"
                    step="1"
                    value={altThreshold}
                    onChange={e => setAltThreshold(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-lg py-2.5 px-4 text-sm text-slate-200 outline-none focus:border-cyan-500/50 transition-all font-mono"
                  />
                  <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 rounded-lg pointer-events-none transition-opacity" />
                </div>
              </div>
              
              <label className="flex items-start gap-3 p-3 bg-slate-900/30 border border-slate-800/60 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-all group">
                <input type="checkbox" checked={autoWrite} onChange={e => setAutoWrite(e.target.checked)} className="mt-1 accent-fuchsia-500 w-4 h-4" />
                <div className="flex flex-col">
                  <span className="text-xs text-slate-200 font-bold group-hover:text-fuchsia-400 transition-colors">Auto-write EXIF properties</span>
                  <span className="text-[10px] text-slate-500 mt-1 leading-relaxed">Directly inject GPS coordinates into image EXIF without manual QC Step 2.</span>
                </div>
              </label>
            </div>
          </section>

          {/* ── SECTION: PROCESS ── */}
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Zap size={14} className="text-amber-500" />
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Execution Pipeline</h3>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3">
                {processing && (
                  <button
                    onClick={handleStop}
                    className="flex-none w-12 flex items-center justify-center bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white border border-rose-500/30 rounded-xl transition-all shadow-lg"
                    title="Stop all processes"
                  >
                    <Square size={14} className="fill-current" />
                  </button>
                )}
                <button
                  disabled={processing || !hasValidFlight}
                  onClick={runProcessor}
                  className="flex-1 relative group flex items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-xl py-4 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] focus:ring-2 focus:ring-fuchsia-500/50"
                >
                  <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {processing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="ml-2 uppercase tracking-widest text-xs">Executing...</span>
                    </>
                  ) : (
                    <>
                      <Play size={18} className="fill-white" />
                      <span className="uppercase tracking-widest text-xs">
                        {flights.some(f => f.status === 'processed') ? 'Re-run Step 1' : 'Step 1: Alignment'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Step 2 Section - Appears when items are ready for EXIF */}
              {(flights.some(f => f.status === 'processed' || f.status === 'ready')) && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Step 2: Finalize EXIF
                  </h4>
                  <div className="flex flex-col gap-2">
                    <button
                      disabled={processing || (flights[activeTab].status !== 'processed' && flights[activeTab].status !== 'ready')}
                      onClick={() => runFinalize(flights[activeTab])}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold py-2.5 rounded-lg transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                      Tag Current Flight
                    </button>
                    <button
                      disabled={processing}
                      onClick={runFinalizeAll}
                      className="w-full bg-slate-800/40 hover:bg-emerald-600/20 text-emerald-300 border border-emerald-600/30 text-[10px] font-bold py-2 rounded-lg transition-all disabled:opacity-30"
                    >
                      Batch Tag All Ready Flights
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ── RIGHT PANEL: MAP + CONSOLE ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">

        {/* MAP */}
        <div className="flex-1 relative z-0">
          <MapUI 
            geoData={geoData} 
            triggerData={flights[activeTab]?.triggerData}
            imgCount={flights[activeTab]?.imgCount} 
            trigCount={flights[activeTab]?.trigCount} 
          />
        </div>

        {/* CONSOLE */}
        <div className="h-[260px] bg-[#0E1117] flex flex-col border-t border-slate-800">
          <div className="flex items-center gap-2 bg-slate-900 py-2 px-4 border-b border-slate-800 select-none">
            <Terminal size={13} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-medium tracking-widest uppercase">System Console</span>
          </div>
          <div ref={logViewerRef} className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed custom-scrollbar break-words">
            {logs.length === 0 ? (
              <span className="text-slate-600 italic">Waiting for processing to begin...</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-0.5">
                  <span className="text-slate-700 mr-2 select-none">[{i + 1}]</span>
                  {log.startsWith('[ERR]') || log.includes('Critical Error') || log.startsWith('[ERROR]')
                    ? <span className="text-amber-400">{log}</span>
                    : log.startsWith('[SYSTEM]')
                    ? <span className="text-cyan-400">{log}</span>
                    : log.startsWith('[PROCESS]')
                    ? <span className="text-fuchsia-400">{log}</span>
                    : log.startsWith('[ERR]')
                    ? <span className="text-rose-400">{log}</span>
                    : <span className="text-slate-300">{log}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

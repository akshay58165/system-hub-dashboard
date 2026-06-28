import React from 'react';
import { CalibrationNode, ClimateData } from '../types';
import { 
  Activity, Wind, Sun, Moon, Thermometer, Droplets, Compass, Shield, Terminal
} from 'lucide-react';

interface BiometricsSensorsProps {
  nodes: CalibrationNode[];
  climate: ClimateData;
  onUpdateNode: (nodeId: string, newValue: number) => void;
}

export default function BiometricsSensors({ nodes, climate, onUpdateNode }: BiometricsSensorsProps) {
  const wellbeingLabels: Record<string, string> = {
    sleep: 'Sleep quality',
    rest: 'Recovery',
    drive: 'Motivation',
    focus: 'Focus',
    fresh: 'Mental freshness',
    finance: 'Financial comfort',
    mood: 'Mood',
    energy: 'Energy',
    vibe: 'Creative confidence',
    fuel: 'Food & hydration',
    eyes: 'Eye comfort',
    body: 'Physical comfort',
    studio: 'Studio readiness',
    env: 'Workspace comfort',
  };
  
  // Calculate average biometric index
  const avgBiometric = nodes.length > 0 
    ? Math.round(nodes.reduce((sum, n) => sum + n.value, 0) / nodes.length * 10)
    : 100;

  return (
    <div className="space-y-4">
      {/* Upper core biometric score index line */}
      <div className="bg-zinc-950/80 border border-zinc-900 rounded-lg p-4 font-mono text-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 tracking-widest uppercase">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse inline-block" />
            DAILY WELLBEING CHECK
          </div>
          <h3 className="text-sm font-semibold tracking-wider text-zinc-100 flex items-center gap-2">
            OVERALL READINESS:
            <span className={`font-bold tracking-widest ${avgBiometric >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {avgBiometric}% {avgBiometric >= 75 ? 'READY TO CREATE' : 'LIGHTER WORKLOAD ADVISED'}
            </span>
          </h3>
        </div>

        {/* Big index meter block */}
        <div className="bg-zinc-900/40 border border-zinc-900/60 rounded px-4 py-2 font-mono text-center shrink-0 w-full md:w-auto">
          <span className="text-[8px] text-zinc-500 block uppercase font-bold">AVERAGE WELLBEING SCORE</span>
          <span className={`text-xl font-bold tracking-widest ${avgBiometric >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {avgBiometric}% <span className="text-xs text-zinc-600">READY</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Column 1 & 2: Biometric nodes calibration matrix */}
        <div className="lg:col-span-2 bg-zinc-950 border border-zinc-900 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">
                HOW ARE YOU FEELING TODAY?
              </span>
            </div>
            <span className="text-[8px] text-zinc-600 font-mono">RATE EACH ITEM FROM 1 TO 10</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {nodes.map(node => (
              <div 
                key={node.id}
                className="bg-zinc-900/30 border border-zinc-900 rounded p-2.5 space-y-2 font-mono text-[10px]"
              >
                <div className="flex justify-between items-center font-bold">
                  <span className="text-zinc-400 uppercase tracking-wide">{wellbeingLabels[node.id] || node.label}</span>
                  <span className="text-white bg-zinc-950 px-1.5 py-0.2 rounded border border-zinc-900 font-bold font-mono">
                    {node.value}/10
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateNode(node.id, Math.max(1, node.value - 1))}
                    className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-900 text-zinc-400 h-5 w-5 flex items-center justify-center rounded font-bold"
                  >
                    -
                  </button>

                  <div className="flex-1 h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${node.value * 10}%`,
                        backgroundColor: node.color || '#34d399'
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => onUpdateNode(node.id, Math.min(10, node.value + 1))}
                    className="bg-zinc-950 hover:bg-zinc-800 border border-zinc-900 text-zinc-400 h-5 w-5 flex items-center justify-center rounded font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Atmospheric Weather & Environmental Sensors */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 space-y-3.5 flex flex-col justify-between">
          <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
            <div className="flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">
                LOCAL CONDITIONS
              </span>
            </div>
            <span className="text-[8px] text-zinc-600 font-mono">STATION ID: {climate.stationId}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono text-[10px]">
            <div className="bg-zinc-900/20 border border-zinc-900 rounded p-2 flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-rose-400" />
              <div>
                <span className="text-zinc-600 text-[8px] block uppercase font-bold">TEMPERATURE</span>
                <span className="text-zinc-200 font-bold">{climate.temp}</span>
              </div>
            </div>

            <div className="bg-zinc-900/20 border border-zinc-900 rounded p-2 flex items-center gap-2">
              <Droplets className="h-4 w-4 text-sky-400" />
              <div>
                <span className="text-zinc-600 text-[8px] block uppercase font-bold">HUMIDITY</span>
                <span className="text-zinc-200 font-bold">{climate.humidity}</span>
              </div>
            </div>

            <div className="bg-zinc-900/20 border border-zinc-900 rounded p-2 flex items-center gap-2">
              <Wind className="h-4 w-4 text-cyan-400" />
              <div>
                <span className="text-zinc-600 text-[8px] block uppercase font-bold">WIND SPEED</span>
                <span className="text-zinc-200 font-bold">{climate.wind}</span>
              </div>
            </div>

            <div className="bg-zinc-900/20 border border-zinc-900 rounded p-2 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <div>
                <span className="text-zinc-600 text-[8px] block uppercase font-bold">AIR QUALITY</span>
                <span className="text-zinc-200 font-bold">{climate.airQuality}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-3 flex justify-between font-mono text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Sun className="h-3 w-3 text-amber-500" />
              SR: {climate.sunrise}
            </span>
            <span className="flex items-center gap-1">
              <Moon className="h-3 w-3 text-purple-400" />
              MP: {climate.moonPhase}
            </span>
            <span className="flex items-center gap-1">
              <Moon className="h-3 w-3 text-indigo-400" />
              SS: {climate.sunset}
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}

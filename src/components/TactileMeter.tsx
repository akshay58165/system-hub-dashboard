import React, { useEffect, useState } from 'react';

interface TactileMeterProps {
  id: string;
  label: string;
  subLabel?: string;
  value: number;
  max: number;
  unit: string;
  status: 'calm' | 'warning' | 'danger';
}

export default function TactileMeter({
  id,
  label,
  subLabel,
  value,
  max,
  unit,
  status
}: TactileMeterProps) {
  const [flicker, setFlicker] = useState(false);

  useEffect(() => {
    if (status === 'danger') {
      const interval = setInterval(() => {
        setFlicker(prev => !prev);
      }, 250);
      return () => clearInterval(interval);
    } else {
      setFlicker(false);
    }
  }, [status]);

  // Determine LED bar segments count. Let's use 10 segments.
  const totalSegments = 12;
  const filledSegments = Math.min(totalSegments, Math.max(0, Math.round((value / max) * totalSegments)));

  // Segment colors based on index
  const getSegmentColor = (index: number) => {
    const ratio = index / totalSegments;
    if (ratio < 0.5) return 'emerald'; // Good level
    if (ratio < 0.8) return 'amber';   // Approaching warning
    return 'red';                      // Warning/Critical
  };

  return (
    <div id={`meter-container-${id}`} className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 flex flex-col justify-between font-mono relative overflow-hidden h-full select-none shadow-[inset_0_1.5px_0_rgba(255,255,255,0.02)] min-h-[190px]">
      {/* Background illumination */}
      <div className={`absolute inset-0 bg-gradient-to-b ${
        status === 'danger' ? 'from-rose-950/15' : status === 'warning' ? 'from-amber-950/10' : 'from-emerald-950/5'
      } to-transparent opacity-40 pointer-events-none`} />

      {/* Retro hardware model stamp */}
      <div className="flex justify-between items-center text-[7px] text-zinc-600 tracking-wider mb-2 z-10">
        <span>UNIT.{id.toUpperCase()}-v4</span>
        <span className="animate-pulse">ONLINE</span>
      </div>

      {/* Main Meter Column Body */}
      <div className="flex items-center gap-4 my-2 z-10">
        {/* LED Ladder bar */}
        <div className="flex flex-col-reverse gap-1.5 p-2 bg-black border-2 border-zinc-900 rounded-md shadow-inner shrink-0 w-12">
          {Array.from({ length: totalSegments }).map((_, idx) => {
            const isFilled = idx < filledSegments;
            const segmentType = getSegmentColor(idx);
            
            let ledClass = 'bg-zinc-900/80 shadow-none border-zinc-950';
            if (isFilled) {
              if (segmentType === 'emerald') {
                ledClass = 'bg-emerald-500 shadow-[0_0_8px_#10b981] border-emerald-400/30';
              } else if (segmentType === 'amber') {
                ledClass = 'bg-amber-500 shadow-[0_0_8px_#f59e0b] border-amber-400/30';
              } else {
                ledClass = flicker 
                  ? 'bg-rose-950 border-rose-900/10 shadow-none' 
                  : 'bg-rose-500 shadow-[0_0_10px_#ef4444] border-rose-400/30';
              }
            }

            return (
              <div 
                key={idx}
                className={`h-2.5 w-full rounded-sm border transition-all duration-150 ${ledClass}`}
              />
            );
          })}
        </div>

        {/* Meter Info & Scale Details */}
        <div className="flex flex-col justify-between h-36 flex-1 text-left py-1">
          <div className="space-y-0.5">
            <span className="text-[10px] text-zinc-400 font-bold block tracking-wider uppercase">
              {label}
            </span>
            {subLabel && (
              <span className="text-[8px] text-zinc-500 block leading-tight tracking-wider uppercase">
                {subLabel}
              </span>
            )}
          </div>

          {/* Meter scale reading guides */}
          <div className="text-[8px] text-zinc-600 space-y-1.5 border-l border-zinc-900 pl-2">
            <div className="flex justify-between">
              <span>OVERFLOW</span>
              <span className={filledSegments >= 10 ? 'text-rose-500 font-bold' : ''}>100%</span>
            </div>
            <div className="flex justify-between">
              <span>MIDRANGE</span>
              <span className={filledSegments >= 6 && filledSegments < 10 ? 'text-amber-500 font-bold' : ''}>50%</span>
            </div>
            <div className="flex justify-between">
              <span>MINIMAL</span>
              <span className={filledSegments < 6 ? 'text-emerald-500 font-bold' : ''}>0%</span>
            </div>
          </div>

          {/* Segment numerical glow readout */}
          <div className="bg-black border border-zinc-900 px-2 py-1 rounded text-center w-full shadow-inner">
            <div className="text-[12px] font-bold tracking-widest text-zinc-100">
              <span className={`drop-shadow-[0_0_3px_rgba(255,255,255,0.4)] ${
                status === 'danger' ? 'text-rose-400' : status === 'warning' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {value}
              </span>
              <span className="text-[8px] text-zinc-600 ml-1 uppercase">{unit}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer warning label */}
      <div className="text-[7.5px] border-t border-zinc-900/60 pt-1.5 flex justify-between text-zinc-500 z-10">
        <span>STATUS CHECK</span>
        <span className={status === 'danger' ? 'text-rose-500 font-bold animate-pulse' : 'text-zinc-600'}>
        {status === 'danger' ? 'NEEDS ATTENTION' : 'ON TRACK'}
        </span>
      </div>
    </div>
  );
}

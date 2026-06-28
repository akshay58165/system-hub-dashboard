import React, { useEffect, useState } from 'react';

interface TactileGaugeProps {
  id: string;
  label: string;
  subLabel?: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  glowColor: 'emerald' | 'amber' | 'red' | 'cyan';
  status: 'calm' | 'warning' | 'danger';
}

export default function TactileGauge({
  id,
  label,
  subLabel,
  value,
  min,
  max,
  unit,
  glowColor,
  status
}: TactileGaugeProps) {
  // Dynamic scale maximum to prevent needle saturation
  const effectiveMax = Math.max(max, value, min + 1);

  // Clamp value
  const clampedValue = Math.min(effectiveMax, Math.max(min, value));
  
  // Calculate percentage of value within min-effectiveMax
  const percent = ((clampedValue - min) / (effectiveMax - min)) * 100;
  
  // Calculate angle for the needle:
  // -110 degrees is min, +110 degrees is max (total span 220 degrees)
  const needleAngle = -110 + (percent / 100) * 220;

  // Let's add a minor simulated electrical signal wiggle (idle jitter)
  const [wiggle, setWiggle] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      // In danger state, wiggle more! In calm, wiggle less.
      const wiggleRange = status === 'danger' ? 1.2 : status === 'warning' ? 0.6 : 0.2;
      const randomWiggle = (Math.random() - 0.5) * wiggleRange;
      setWiggle(randomWiggle);
    }, 100);

    return () => clearInterval(interval);
  }, [status]);

  const finalAngle = needleAngle + wiggle;

  // Glow color classes
  const glowClasses = {
    emerald: {
      shadow: 'shadow-[0_0_20px_rgba(16,185,129,0.12),inset_0_0_15px_rgba(16,185,129,0.08)]',
      text: 'text-emerald-500',
      backlight: 'from-emerald-950/20 to-transparent',
      led: 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
    },
    cyan: {
      shadow: 'shadow-[0_0_20px_rgba(6,182,212,0.12),inset_0_0_15px_rgba(6,182,212,0.08)]',
      text: 'text-cyan-400',
      backlight: 'from-cyan-950/20 to-transparent',
      led: 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
    },
    amber: {
      shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.18),inset_0_0_15px_rgba(245,158,11,0.1)]',
      text: 'text-amber-500',
      backlight: 'from-amber-950/25 to-transparent animate-backlight-standard',
      led: 'bg-amber-500 shadow-[0_0_8px_#f59e0b] animate-pulse'
    },
    red: {
      shadow: 'shadow-[0_0_25px_rgba(239,68,68,0.25),inset_0_0_20px_rgba(239,68,68,0.15)]',
      text: 'text-rose-500',
      backlight: 'from-rose-950/35 to-transparent animate-backlight-critical',
      led: 'bg-rose-500 shadow-[0_0_10px_#ef4444] animate-[ping_0.8s_infinite]'
    }
  }[glowColor];

  // Helper to draw scale ticks
  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const tickPercent = i / 10;
    const tickAngle = -110 + tickPercent * 220;
    ticks.push(tickAngle);
  }

  return (
    <div id={`gauge-container-${id}`} className="bg-zinc-950 border border-zinc-900 rounded-lg p-3.5 flex flex-col items-center justify-between text-center font-mono hover:border-zinc-850 transition-all duration-300 relative overflow-hidden group select-none shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      {/* Backlight background ambient bleed */}
      <div className={`absolute inset-0 bg-gradient-to-b ${glowClasses.backlight} opacity-30 pointer-events-none`} />

      {/* Retro hardware model serial stamp */}
      <div className="text-[7px] text-zinc-600 self-start tracking-widest absolute top-2 left-3">
        MOD.{id.toUpperCase()}-v4
      </div>

      <div className="text-[7px] text-zinc-600 self-end tracking-widest absolute top-2 right-3 flex items-center gap-1">
        <span>STBY</span>
        <span className={`h-1 w-1 rounded-full ${status === 'danger' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
      </div>

      {/* Main Analog Circular Housing */}
      <div className="relative w-28 h-28 mt-2 rounded-full border-2 border-zinc-850 bg-black flex items-center justify-center shadow-[inset_0_4px_10px_rgba(0,0,0,0.9),0_2px_8px_rgba(0,0,0,0.5)]">
        
        {/* Glow halo inside bezel */}
        <div className={`absolute inset-1.5 rounded-full pointer-events-none transition-all duration-500 ${glowClasses.shadow}`} />

        {/* Vintage Dial markings & grid lines (SVG) */}
        <svg className="absolute inset-0 w-full h-full p-2.5 overflow-visible pointer-events-none" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="needleGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="60%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Main track arc */}
          <path 
            d="M 18,80 A 42,42 0 1,1 82,80" 
            fill="none" 
            stroke="#27272a" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
          />
          {/* Warning sections (hash paths) */}
          {/* Red warning Zone at the top-right end (approx 75% to 100%) */}
          <path 
            d="M 68,30 A 42,42 0 0,1 82,80" 
            fill="none" 
            stroke={status === 'danger' ? '#ef4444' : '#7f1d1d'} 
            strokeWidth="2" 
            strokeDasharray="1.5,1.5"
            className="transition-colors duration-300"
          />
          {/* Yellow Warning Zone (approx 50% to 75%) */}
          <path 
            d="M 50,18 A 42,42 0 0,1 68,30" 
            fill="none" 
            stroke={status === 'warning' ? '#f59e0b' : '#78350f'} 
            strokeWidth="2" 
            strokeDasharray="1.5,1.5"
            className="transition-colors duration-300"
          />

          {/* Scale graduation lines */}
          {ticks.map((angle, idx) => {
            const rad = ((angle - 90) * Math.PI) / 180;
            const x1 = 50 + 40 * Math.cos(rad);
            const y1 = 50 + 40 * Math.sin(rad);
            const x2 = 50 + 34 * Math.cos(rad);
            const y2 = 50 + 34 * Math.sin(rad);
            const isImportantTick = idx === 0 || idx === 5 || idx === 10;
            return (
              <line 
                key={idx}
                x1={x1} y1={y1} x2={x2} y2={y2} 
                stroke={isImportantTick ? '#71717a' : '#3f3f46'} 
                strokeWidth={isImportantTick ? '1.5' : '1'} 
              />
            );
          })}

          {/* Subtly illuminated hash divisions labels */}
          <text x="18" y="86" fill="#52525b" fontSize="5.5" textAnchor="middle">MIN</text>
          <text x="50" y="14" fill="#52525b" fontSize="5.5" textAnchor="middle">MID</text>
          <text x="82" y="86" fill="#52525b" fontSize="5.5" textAnchor="middle">MAX</text>

          {/* The Indicator Needle - Inside SVG for absolute layout alignment immunity */}
          <g 
            transform={`rotate(${finalAngle}, 50, 50)`}
            style={{ 
              transition: 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {/* Soft backdrop blur glow shadow */}
            <line 
              x1="50" y1="50" x2="50" y2="15" 
              stroke="#ef4444" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              opacity="0.35"
              filter="url(#shadow)"
            />
            {/* Needle center rod */}
            <line 
              x1="50" y1="50" x2="50" y2="15" 
              stroke="url(#needleGrad)" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
            />
          </g>

          {/* Heavy Mechanical Center Cap Screw Pin */}
          <circle cx="50" cy="50" r="4.5" fill="#09090b" stroke="#52525b" strokeWidth="1" />
          <line x1="47.5" y1="47.5" x2="52.5" y2="52.5" stroke="#a1a1aa" strokeWidth="1" />
        </svg>

        {/* Vintage Gauge Glass reflection Overlay (aesthetic highlight shine) */}
        <div className="absolute inset-0 rounded-full pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-70 z-10" />

        {/* Left and Right warning micro-bulbs on dial plate */}
        <div className="absolute bottom-5 left-5 flex flex-col items-center">
          <span className="text-[5px] text-zinc-600 mb-0.5 font-bold">CALM</span>
          <span className={`h-1 w-1 rounded-full ${status === 'calm' ? 'bg-emerald-500 shadow-[0_0_4px_#10b981]' : 'bg-emerald-950'}`} />
        </div>

        <div className="absolute bottom-5 right-5 flex flex-col items-center">
          <span className="text-[5px] text-zinc-600 mb-0.5 font-bold">WARN</span>
          <span className={`h-1 w-1 rounded-full ${status === 'danger' ? 'bg-rose-500 shadow-[0_0_5px_#ef4444] animate-pulse' : status === 'warning' ? 'bg-amber-500 shadow-[0_0_4px_#f59e0b]' : 'bg-rose-950'}`} />
        </div>
      </div>

      {/* Numeric LCD Readout Module */}
      <div className="w-full mt-3 space-y-1 z-10">
        <div className="text-[9px] text-zinc-400 font-bold tracking-wider truncate uppercase">
          {label}
        </div>
        {subLabel && (
          <div className="text-[7.5px] text-zinc-500 font-medium tracking-wide uppercase leading-none">
            {subLabel}
          </div>
        )}
        
        {/* Glowing LCD Panel with dynamic units */}
        <div className="inline-flex items-center gap-1 bg-black/80 px-2 py-0.5 rounded border border-zinc-900 shadow-inner mt-1">
          <span className={`text-[11px] font-bold tracking-widest ${glowClasses.text} filter drop-shadow-[0_0_2px_currentColor]`}>
            {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}
          </span>
          <span className="text-[8px] text-zinc-600 font-bold font-mono">
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
}

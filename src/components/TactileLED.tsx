import React from 'react';

export type LEDColor = 'white' | 'red' | 'orange' | 'yellow' | 'amber' | 'emerald' | 'cyan' | 'blue' | 'zinc';
export type LEDImportance = 'critical' | 'high' | 'medium' | 'low';

interface TactileLEDProps {
  color: LEDColor;
  importance: LEDImportance;
  active?: boolean;
}

export default function TactileLED({ color, importance, active = true }: TactileLEDProps) {
  // Glow shadow colors
  const glowColors = {
    white: 'rgba(244, 244, 245, 0.9)',
    red: 'rgba(239, 68, 68, 0.95)',
    orange: 'rgba(249, 115, 22, 0.95)',
    yellow: 'rgba(234, 179, 8, 0.95)',
    amber: 'rgba(245, 158, 11, 0.95)',
    emerald: 'rgba(16, 185, 129, 0.95)',
    cyan: 'rgba(6, 182, 212, 0.95)',
    blue: 'rgba(59, 130, 246, 0.95)',
    zinc: 'rgba(113, 113, 122, 0.4)',
  };

  const centerColors = {
    white: 'bg-zinc-100',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-400',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-400',
    cyan: 'bg-cyan-400',
    blue: 'bg-blue-400',
    zinc: 'bg-zinc-600',
  };

  const animations = {
    critical: 'animate-led-critical',
    high: 'animate-led-high',
    medium: 'animate-led-medium',
    low: 'animate-led-low',
  };

  return (
    <div className="relative flex items-center justify-center h-4.5 w-4.5 rounded-full border border-zinc-800 bg-zinc-950 p-[1.5px] shadow-[inset_0_1.5px_2.5px_rgba(0,0,0,0.8),0_1px_1.5px_rgba(255,255,255,0.05)] shrink-0">
      {/* Outer metal ring */}
      <div className="absolute inset-0 rounded-full border border-zinc-700/35 pointer-events-none" />
      
      {/* LED Glass Core */}
      <div 
        className={`h-2.5 w-2.5 rounded-full ${centerColors[color]} relative transition-all duration-300 ${active ? animations[importance] : ''}`}
        style={active ? {
          boxShadow: `0 0 10px ${glowColors[color]}, 0 0 16px ${glowColors[color]}`,
        } : undefined}
      >
        {/* Reflection Highlight */}
        <div className="absolute top-0.5 left-0.5 w-[2.5px] h-[1px] bg-white/75 rounded-full rotate-[-15deg]" />
      </div>
    </div>
  );
}

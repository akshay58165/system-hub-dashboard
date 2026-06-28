import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Zap, Compass, Flame } from 'lucide-react';

interface ZoneCautionTapeProps {
  intensityMode: 'Relaxed' | 'Balanced' | 'Aggressive' | 'War mode';
}

export default function ZoneCautionTape({ intensityMode }: ZoneCautionTapeProps) {
  const getThemeDetails = (mode: typeof intensityMode) => {
    switch (mode) {
      case 'War mode':
        return {
          stripeColor: '#ef4444', // Red-500
          glowColor: 'rgba(239, 68, 68, 0.65)',
          glowShadow: '0 0 15px rgba(239, 68, 68, 0.45)',
          borderClass: 'border-red-950 bg-red-950/10',
          textClass: 'text-red-400 font-extrabold',
          accentClass: 'bg-red-500',
          badgeBorder: 'border-red-500/50',
          badgeBg: 'bg-red-950/90',
          badgeText: '⚠️ DEADLINE SPRINT ACTIVE ⚠️',
          badgeSub: 'MAXIMUM FOCUS // ESSENTIAL TASKS ONLY',
          speed: '0.7s',
          icon: <Flame className="h-4 w-4 text-red-400 animate-pulse" />,
        };
      case 'Aggressive':
        return {
          stripeColor: '#f97316', // Orange-500
          glowColor: 'rgba(249, 115, 22, 0.5)',
          glowShadow: '0 0 12px rgba(249, 115, 22, 0.35)',
          borderClass: 'border-orange-950 bg-orange-950/10',
          textClass: 'text-orange-400 font-bold',
          accentClass: 'bg-orange-500',
          badgeBorder: 'border-orange-500/40',
          badgeBg: 'bg-orange-950/90',
          badgeText: '⚡ FOCUSED SPRINT ACTIVE ⚡',
          badgeSub: 'FASTER PACE // PROTECT YOUR BREAKS',
          speed: '1.2s',
          icon: <Zap className="h-4 w-4 text-orange-400" />,
        };
      case 'Balanced':
        return {
          stripeColor: '#eab308', // Yellow-500
          glowColor: 'rgba(234, 179, 8, 0.4)',
          glowShadow: '0 0 10px rgba(234, 179, 8, 0.25)',
          borderClass: 'border-yellow-950 bg-yellow-950/5',
          textClass: 'text-yellow-400 font-bold',
          accentClass: 'bg-yellow-500',
          badgeBorder: 'border-yellow-500/30',
          badgeBg: 'bg-zinc-950/90',
          badgeText: '⚖️ BALANCED WORKFLOW ACTIVE ⚖️',
          badgeSub: 'STEADY PACE // CONSISTENT PROGRESS',
          speed: '1.9s',
          icon: <Compass className="h-4 w-4 text-yellow-400" />,
        };
      case 'Relaxed':
      default:
        return {
          stripeColor: '#10b981', // Emerald-500
          glowColor: 'rgba(16, 185, 129, 0.35)',
          glowShadow: '0 0 8px rgba(16, 185, 129, 0.2)',
          borderClass: 'border-emerald-950 bg-emerald-950/5',
          textClass: 'text-emerald-400 font-medium',
          accentClass: 'bg-emerald-500',
          badgeBorder: 'border-emerald-500/20',
          badgeBg: 'bg-zinc-950/95',
          badgeText: '☘️ RELAXED CREATIVE PACE ☘️',
          badgeSub: 'LIGHTER WORKLOAD // MORE RECOVERY TIME',
          speed: '2.8s',
          icon: <ShieldAlert className="h-4 w-4 text-emerald-400" />,
        };
    }
  };

  const theme = getThemeDetails(intensityMode);
  const displayMode = intensityMode === 'War mode' ? 'Deadline sprint' : intensityMode;

  return (
    <div className="relative w-full my-1 z-10 select-none">
      {/* Self-contained keyframes animation injected into a style tag */}
      <style>{`
        @keyframes slide-stripes-left {
          0% {
            background-position-x: 0px;
          }
          100% {
            background-position-x: -42.42px;
          }
        }
        .animate-sliding-stripes {
          animation: slide-stripes-left ${theme.speed} linear infinite;
        }
      `}</style>

      {/* Recessed caution channel layout */}
      <div className={`relative h-9 w-full rounded border flex items-center justify-between px-4 overflow-hidden ${theme.borderClass} shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]`}>
        {/* Animated Background Sliding stripes */}
        <div 
          className="absolute inset-0 opacity-80 animate-sliding-stripes transition-all duration-500"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              ${theme.stripeColor}a5,
              ${theme.stripeColor}a5 15px,
              #09090b 15px,
              #09090b 30px
            )`,
            backgroundSize: '42.42px 30px',
            boxShadow: theme.glowShadow,
          }}
        />

        {/* Diagonal high-tech glass reflection overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/30 pointer-events-none" />
        <div className="absolute top-[1px] inset-x-0 h-[0.5px] bg-white/15 pointer-events-none" />

        {/* Ambient glow bloom border lines */}
        <div className="absolute top-0 inset-x-0 h-[1.5px] opacity-60" style={{ backgroundColor: theme.stripeColor }} />
        <div className="absolute bottom-0 inset-x-0 h-[1.5px] opacity-60" style={{ backgroundColor: theme.stripeColor }} />

        {/* Left Side Blinking Indicator Light */}
        <div className="flex items-center gap-2 z-10 shrink-0">
          <div className="relative h-2 w-2 rounded-full border border-black/80 shadow-md">
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.95, 1.15, 0.95] }}
              transition={{ repeat: Infinity, duration: intensityMode === 'War mode' ? 0.4 : 1.2, ease: "easeInOut" }}
              className={`h-full w-full rounded-full ${theme.accentClass}`}
              style={{ boxShadow: `0 0 10px ${theme.glowColor}, 0 0 15px ${theme.stripeColor}` }}
            />
          </div>
          <span className="text-[7px] font-mono tracking-widest text-white/55 hidden sm:inline uppercase">
            PACE: {displayMode}
          </span>
        </div>

        {/* Centered Overlay HUD Badge */}
        <div className={`z-10 flex flex-col items-center justify-center px-6 py-0.5 rounded border ${theme.badgeBorder} ${theme.badgeBg} shadow-lg max-w-[85%] text-center transition-all duration-300`}>
          <div className="flex items-center gap-2">
            {theme.icon}
            <span className={`text-[9px] font-mono tracking-widest uppercase font-extrabold ${theme.textClass}`}>
              {theme.badgeText}
            </span>
          </div>
          <span className="text-[6.5px] font-mono tracking-widest text-zinc-400 uppercase leading-none hidden md:inline mt-0.5">
            {theme.badgeSub}
          </span>
        </div>

        {/* Right Side Blinking Indicator Light */}
        <div className="flex items-center gap-2 z-10 shrink-0">
          <span className="text-[7px] font-mono tracking-widest text-white/55 hidden sm:inline uppercase">
            WORKLOAD: {intensityMode === 'War mode' ? 'MAXIMUM' : 'PLANNED'}
          </span>
          <div className="relative h-2 w-2 rounded-full border border-black/80 shadow-md">
            <motion.div
              animate={{ opacity: [1, 0.3, 1], scale: [1.15, 0.95, 1.15] }}
              transition={{ repeat: Infinity, duration: intensityMode === 'War mode' ? 0.4 : 1.2, ease: "easeInOut" }}
              className={`h-full w-full rounded-full ${theme.accentClass}`}
              style={{ boxShadow: `0 0 10px ${theme.glowColor}, 0 0 15px ${theme.stripeColor}` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

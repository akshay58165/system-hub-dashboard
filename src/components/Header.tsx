import React, { useState, useEffect } from 'react';
import { Shield, Terminal, Cpu, CalendarRange, Sparkles, Flame, Coffee, Compass, AlertTriangle, Moon, Sun, PanelsTopLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TactileLED from './TactileLED';

interface HeaderProps {
  activeTab: 'mission' | 'health';
  setActiveTab: (tab: 'mission' | 'health') => void;
  openSetupWizard: () => void;
  isHardReset: boolean;
  selectedMonth: string;
  intensityMode: string;
  cycleStartDate: string;
  cycleEndDate: string;
  totalDays: number;
  daysRemaining: number;
  colorTheme: 'dark' | 'light';
  toggleColorTheme: () => void;
}

export default function Header({ 
  activeTab, 
  setActiveTab, 
  openSetupWizard, 
  isHardReset,
  selectedMonth,
  intensityMode,
  cycleStartDate,
  cycleEndDate,
  totalDays,
  daysRemaining,
  colorTheme,
  toggleColorTheme,
 }: HeaderProps) {
  const [time, setTime] = useState<string>('00:00:00');
  const [dateLine, setDateLine] = useState<string>('01 JAN THURSDAY 2026');
  const [countdown, setCountdown] = useState<string>('00:00:00:00');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }));
      const date = String(now.getDate()).padStart(2, '0');
      const month = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      setDateLine(`${date} ${month} ${day} ${now.getFullYear()}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const updateCountdown = () => {
      if (!cycleEndDate) return;
      
      let targetDate: Date;
      const parts = cycleEndDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        targetDate = new Date(year, month, day, 23, 59, 59);
      } else {
        targetDate = new Date(cycleEndDate);
      }

      const now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();

      if (diffMs <= 0) {
        setCountdown('00:00:00:00');
        return;
      }

      const secs = Math.floor(diffMs / 1000);
      const days = Math.floor(secs / (24 * 3600));
      const hours = Math.floor((secs % (24 * 3600)) / 3600);
      const mins = Math.floor((secs % 3600) / 60);
      const remainingSecs = secs % 60;

      const formatNum = (num: number) => String(num).padStart(2, '0');
      setCountdown(`${formatNum(days)}:${formatNum(hours)}:${formatNum(mins)}:${formatNum(remainingSecs)}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [cycleEndDate]);

  const getTheme = (mode: string) => {
    switch (mode) {
      case 'Relaxed':
        return {
          id: 'relaxed',
          borderColor: 'border-blue-900/40',
          hoverBorderColor: 'hover:border-blue-500/40',
          bgColor: 'bg-zinc-950/80 border-blue-950/20 shadow-[0_0_20px_rgba(59,130,246,0.03)]',
          accentText: 'text-blue-400',
          pulseLed: 'blue' as const,
          systemHubText: 'CREATIVE_PACE_STEADY',
          headerTitle: 'Calm Creator Workspace',
          missionStatusLabel: 'RELAXED PACE ACTIVE',
          clockBorder: 'border-blue-900/30',
          clockText: 'text-blue-400',
          clockBg: 'bg-blue-950/10',
          tabActiveClass: 'border-blue-500/40 bg-blue-950/10 text-blue-400 hover:text-blue-300',
          statusDotClass: 'bg-blue-500',
          badgeClass: 'bg-blue-950/30 text-blue-400 border-blue-900/40',
          icon: <Coffee className="h-4 w-4 text-blue-400" />,
          stripBg: 'bg-zinc-950/90 border-blue-950/40 text-blue-300/80',
          dateText: 'text-blue-400',
          gradientBg: 'radial-gradient(circle at 15% top, rgba(59, 130, 246, 0.08) 0%, transparent 45%)',
          scanlines: false,
        };
      case 'Balanced':
        return {
          id: 'balanced',
          borderColor: 'border-zinc-900/80',
          hoverBorderColor: 'hover:border-emerald-500/30',
          bgColor: 'bg-zinc-950/40 border-zinc-900',
          accentText: 'text-emerald-400',
          pulseLed: 'emerald' as const,
          systemHubText: 'CREATOR_WORKFLOW_ON_TRACK',
          headerTitle: 'Mission Control Dashboard',
          missionStatusLabel: 'MONTHLY PLAN ACTIVE',
          clockBorder: 'border-zinc-800',
          clockText: 'text-emerald-400',
          clockBg: 'bg-zinc-900/60',
          tabActiveClass: 'border-emerald-500/50 bg-emerald-950/10 text-emerald-400',
          statusDotClass: 'bg-emerald-500',
          badgeClass: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50',
          icon: <Compass className="h-4 w-4 text-emerald-400" />,
          stripBg: 'bg-zinc-950 border-zinc-900/80 text-zinc-400',
          dateText: 'text-emerald-400',
          gradientBg: 'radial-gradient(circle at 15% top, rgba(16, 185, 129, 0.04) 0%, transparent 45%)',
          scanlines: false,
        };
      case 'Aggressive':
        return {
          id: 'aggressive',
          borderColor: 'border-amber-900/40',
          hoverBorderColor: 'hover:border-amber-500/40',
          bgColor: 'bg-zinc-950/80 border-amber-950/20 shadow-[0_0_25px_rgba(245,158,11,0.04)]',
          accentText: 'text-amber-400',
          pulseLed: 'amber' as const,
          systemHubText: 'HIGH_OUTPUT_SPRINT_ACTIVE',
          headerTitle: 'High-Output Mission Board',
          missionStatusLabel: 'FOCUSED SPRINT ACTIVE',
          clockBorder: 'border-amber-900/40',
          clockText: 'text-amber-400',
          clockBg: 'bg-amber-950/10',
          tabActiveClass: 'border-amber-500/40 bg-amber-950/10 text-amber-400 hover:text-amber-300',
          statusDotClass: 'bg-amber-500',
          badgeClass: 'bg-amber-950/40 text-amber-400 border-amber-900/40',
          icon: <Flame className="h-4 w-4 text-amber-400" />,
          stripBg: 'bg-zinc-950/90 border-amber-950/30 text-amber-300/80',
          dateText: 'text-amber-400',
          gradientBg: 'radial-gradient(circle at 15% top, rgba(245, 158, 11, 0.07) 0%, transparent 45%)',
          scanlines: false,
        };
      case 'War mode':
        return {
          id: 'warmode',
          borderColor: 'border-red-900/90',
          hoverBorderColor: 'hover:border-red-500/60',
          bgColor: 'bg-red-950/10 border-red-950/30 shadow-[0_0_40px_rgba(239,68,68,0.12)]',
          accentText: 'text-red-500 font-bold',
          pulseLed: 'red' as const,
          systemHubText: 'DEADLINE_SPRINT_ACTIVE',
          headerTitle: '🚨 Deadline Sprint Dashboard',
          missionStatusLabel: 'MAXIMUM FOCUS ACTIVE',
          clockBorder: 'border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.25)]',
          clockText: 'text-red-400 font-black tracking-widest',
          clockBg: 'bg-red-950/40 border border-red-900/30',
          tabActiveClass: 'border-red-500/50 bg-red-950/30 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]',
          statusDotClass: 'bg-red-500',
          badgeClass: 'bg-red-950/60 text-red-400 border-red-900/80 animate-[pulse_1s_infinite]',
          icon: <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />,
          stripBg: 'bg-red-950/15 border-red-900/50 text-red-300',
          dateText: 'text-red-400 font-black',
          gradientBg: 'repeating-linear-gradient(45deg, rgba(153, 27, 27, 0.05) 0px, rgba(153, 27, 27, 0.05) 4px, transparent 4px, transparent 8px), radial-gradient(circle at 15% top, rgba(239, 68, 68, 0.15) 0%, transparent 45%)',
          scanlines: true,
        };
      default:
        return {
          id: 'standard',
          borderColor: 'border-zinc-900/80',
          hoverBorderColor: 'hover:border-zinc-800',
          bgColor: 'bg-zinc-950/40 border-zinc-900',
          accentText: 'text-zinc-400',
          pulseLed: 'zinc' as const,
          systemHubText: 'WORKFLOW_MONITORING',
          headerTitle: 'Mission Control Dashboard',
          missionStatusLabel: 'PLAN READY',
          clockBorder: 'border-zinc-800',
          clockText: 'text-zinc-400',
          clockBg: 'bg-zinc-900/60',
          tabActiveClass: 'border-zinc-500 bg-zinc-800 text-zinc-300',
          statusDotClass: 'bg-zinc-500',
          badgeClass: 'bg-zinc-900 text-zinc-400 border-zinc-800',
          icon: <Shield className="h-4 w-4 text-zinc-400" />,
          stripBg: 'bg-zinc-950 border-zinc-900/80 text-zinc-400',
          dateText: 'text-zinc-400',
          gradientBg: '',
          scanlines: false,
        };
    }
  };

  const theme = getTheme(intensityMode);
  const isWarMode = intensityMode === 'War mode';
  const displayMode = intensityMode === 'War mode' ? 'Deadline sprint' : intensityMode;


  return (
    <motion.header 
      key={theme.id}
      initial={{ opacity: 0.85, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      style={{ backgroundImage: theme.gradientBg }}
      className={`border-b bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 relative overflow-hidden transition-all duration-500 ${theme.borderColor}`}
    >
      {/* Dynamic Terminal Scanline Overlay (Exclusive to Warfare Vibe) */}
      {theme.scanlines && (
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] opacity-25 z-0" />
      )}

      {/* Left section: OS Branding */}
      <div className="relative z-10">
        <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
          <span>SYSTEM HUB</span>
          <span className="text-zinc-700">//</span>
          <span className="text-zinc-400 font-bold">CREATOR.OS</span>
          <span className="text-zinc-700">//</span>
          <span className={`${theme.accentText} flex items-center gap-1.5 font-bold transition-all duration-300`}>
            {theme.systemHubText}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <h1 className="text-xl font-semibold font-display tracking-tight text-white flex items-center gap-3">
            <span className="flex items-center gap-2 transition-all duration-300">
              {theme.icon}
              {theme.headerTitle}
            </span>
            <TactileLED 
              color={isHardReset ? 'red' : isWarMode ? 'red' : theme.pulseLed} 
              importance={isHardReset ? 'critical' : isWarMode ? 'critical' : 'medium'} 
            />
          </h1>
          <span className="text-[10px] font-mono bg-zinc-900/80 text-zinc-400 border border-zinc-800/80 px-2 py-0.5 rounded uppercase font-bold">
            {selectedMonth}
          </span>
          <span className={`text-[10px] font-mono border px-2 py-0.5 rounded uppercase font-bold tracking-wider transition-all duration-300 ${theme.badgeClass}`}>
            {displayMode}
          </span>
          {/* Day:Hour:Minute:Second Countdown */}
          <div className={`text-[10px] font-mono border px-2 py-0.5 rounded uppercase font-bold tracking-widest flex items-center gap-1.5 bg-zinc-950/60 transition-all duration-300 ${
            isWarMode 
              ? 'border-red-900/80 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.2)] animate-pulse' 
              : intensityMode === 'Aggressive'
              ? 'border-amber-900/60 text-amber-400'
              : 'border-emerald-900/40 text-emerald-400'
          }`}>
            <span className="text-zinc-500 text-[8px] tracking-wider uppercase">TIME LEFT:</span>
            <span className="font-mono">{countdown}</span>
          </div>
        </div>

        {/* Mission Cycle Info Strip */}
        <div className={`mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono border px-3 py-1.5 rounded-md transition-all duration-500 ${theme.stripBg}`}>
          <span className={`flex items-center gap-1.5 font-bold ${theme.accentText}`}>
            <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${theme.statusDotClass}`} />
            {theme.missionStatusLabel}
          </span>
          <span className="opacity-80">from <strong className={`${theme.dateText} font-mono`}>{cycleStartDate}</strong> to <strong className={`${theme.dateText} font-mono`}>{cycleEndDate}</strong></span>
          <span className="opacity-60">|</span>
          <span className="opacity-85">Total Duration: <strong className="text-white font-mono">{totalDays} Days</strong></span>
          <span className="opacity-60">|</span>
          <span className="opacity-85">Remaining: <strong className="text-amber-400 font-mono">{daysRemaining} Days</strong></span>
        </div>
      </div>

      {/* Middle section: Navigation Tabs resembling tactical buttons */}
      <div className="flex flex-wrap items-center gap-2 bg-zinc-950/80 p-1 rounded-lg border border-zinc-900 w-full lg:w-auto relative z-10">
        <button
          onClick={() => setActiveTab('mission')}
          className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-mono font-semibold tracking-wider transition-all duration-300 rounded-md group relative overflow-hidden ${
            activeTab === 'mission'
              ? `border ${theme.tabActiveClass}`
              : 'border border-transparent text-zinc-500 hover:text-zinc-350 hover:bg-zinc-900/40'
          }`}
        >
          <Cpu className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
          MISSION DASHBOARD
          <div className="ml-1">
            <TactileLED color={activeTab === 'mission' ? theme.pulseLed : 'zinc'} importance="low" active={activeTab === 'mission'} />
          </div>
        </button>

        <button
          onClick={() => setActiveTab('health')}
          className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-mono font-semibold tracking-wider transition-all duration-300 rounded-md group relative overflow-hidden ${
            activeTab === 'health'
              ? `border ${theme.tabActiveClass}`
              : 'border border-transparent text-zinc-500 hover:text-zinc-350 hover:bg-zinc-900/40'
          }`}
        >
          <Terminal className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
          WELLBEING & WORKSPACE
          <div className="ml-1">
            <TactileLED color={activeTab === 'health' ? theme.pulseLed : 'zinc'} importance="low" active={activeTab === 'health'} />
          </div>
        </button>

      </div>

      {/* Right section: Active workspace, setup trigger, digital clock */}
      <div className="flex items-center gap-4 self-stretch lg:self-auto justify-between lg:justify-end relative z-10">
        <button
          type="button"
          onClick={toggleColorTheme}
          className={`bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800/60 text-zinc-300 px-3 py-2 rounded flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider transition-all uppercase ${theme.hoverBorderColor}`}
          title={colorTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-label={colorTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {colorTheme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {colorTheme === 'dark' ? 'LIGHT' : 'DARK'}
        </button>

        <button
          onClick={openSetupWizard}
          className={`bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800/60 text-zinc-300 hover:text-emerald-400 px-3 py-2 rounded flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider transition-all uppercase hover:shadow-[0_0_12px_rgba(16,185,129,0.15)] group ${theme.hoverBorderColor}`}
          title="Set up monthly goals and working limits"
        >
          <CalendarRange className={`h-3.5 w-3.5 group-hover:scale-110 transition-transform animate-pulse ${theme.accentText}`} />
          SET ZONE
        </button>

        <div className="hidden sm:block text-right font-mono text-xs">
          <div className="text-[9px] tracking-widest text-zinc-500 uppercase">CREATOR WORKSPACE</div>
          <div className="font-semibold tracking-wider text-zinc-300 flex items-center justify-end gap-1.5">
            <Shield className={`h-3 w-3 ${theme.accentText}`} />
            PERSONAL_DASHBOARD
          </div>
        </div>

        <div className={`border px-4 py-2 rounded font-mono font-semibold tracking-wider transition-all duration-300 shadow-inner min-w-[150px] text-center ${theme.clockBorder} ${theme.clockBg} ${theme.clockText}`}>
          <div className="text-sm md:text-base">{time}</div>
          <div className="mt-1 border-t border-current/15 pt-1 text-[7px] tracking-widest opacity-70 whitespace-nowrap">{dateLine}</div>
        </div>
      </div>
    </motion.header>
  );
}

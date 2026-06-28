import React, { useState, useEffect } from 'react';
import { MonthlyGoals, VideoItem } from '../types';
import { 
  ShieldAlert, Clock, RefreshCw, Eye, Star, Compass, CheckCircle2, Sliders, AlertTriangle
} from 'lucide-react';
import TactileLED from './TactileLED';
import { getLocalDateString } from '../videoLogic';

interface SidePanelProps {
  goals: MonthlyGoals;
  videos: VideoItem[];
  todayDay: number;
  totalDays: number;
  onUpdateGoals: (goals: MonthlyGoals) => void;
  requiredEffortToday: number;
  pressureLevel: 'Low' | 'Stable' | 'Pressure' | 'Critical';
}

export default function SidePanel({
  goals,
  videos,
  todayDay,
  totalDays,
  onUpdateGoals,
  requiredEffortToday,
  pressureLevel
}: SidePanelProps) {
  // Let the user adjust a simulated time to watch the workday meter react dynamically!
  const [simulatedTime, setSimulatedTime] = useState('14:30'); // Default to 2:30 PM (simulate middle of day)
  
  // Custom states for work window adjustments
  const [editingWindow, setEditingWindow] = useState(false);
  const [winStart, setWinStart] = useState(goals.workWindowStart || '11:00');
  const [winEnd, setWinEnd] = useState(goals.workWindowEnd || '20:00');

  const handleSaveWindow = () => {
    onUpdateGoals({
      ...goals,
      workWindowStart: winStart,
      workWindowEnd: winEnd
    });
    setEditingWindow(false);
  };

  // Helper to convert time strings (HH:MM) into minute integers
  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTimeStr = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const pad = (v: number) => String(v).padStart(2, '0');
    return `${pad(h)}:${pad(m)}`;
  };

  const simMins = timeToMinutes(simulatedTime);
  const startMins = timeToMinutes(goals.workWindowStart || '11:00');
  const endMins = timeToMinutes(goals.workWindowEnd || '20:00');
  const windowLength = endMins - startMins;

  // Calculate elapsed workday %
  let elapsedPercent = 0;
  let remainingPercent = 100;
  let workDayStatus = 'NOT STARTED';
  let timeRemainingStr = '';

  if (simMins < startMins) {
    elapsedPercent = 0;
    remainingPercent = 100;
    workDayStatus = 'BEFORE WORK WINDOW';
    const minsToStart = startMins - simMins;
    timeRemainingStr = `${Math.floor(minsToStart / 60)}h ${minsToStart % 60}m until your work window starts`;
  } else if (simMins > endMins) {
    elapsedPercent = 100;
    remainingPercent = 0;
    workDayStatus = 'WORK WINDOW COMPLETE';
    timeRemainingStr = 'Your planned work window has ended';
  } else {
    const elapsedMins = simMins - startMins;
    elapsedPercent = Math.round((elapsedMins / windowLength) * 100);
    remainingPercent = 100 - elapsedPercent;
    workDayStatus = 'WITHIN WORK WINDOW';
    const minsLeft = endMins - simMins;
    timeRemainingStr = `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m remaining`;
  }

  // Formatting hours for user display
  const formatHourString = (timeStr: string) => {
    const [h, m] = timeStr.split(':');
    const hr = Number(h);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const displayHr = hr % 12 === 0 ? 12 : hr % 12;
    return `${displayHr}:${m} ${ampm}`;
  };

  // Lane separation metrics for Buffer and alerts
  const todayStr = getLocalDateString();
  const filterLaneVids = (lane: string) => videos.filter(v => v.contentLane === lane);
  const getBufferForLane = (lane: string) => {
    return filterLaneVids(lane).filter(v => 
      v.currentStage === 'Done' && v.actualScheduledDate && v.actualScheduledDate > todayStr
    ).length;
  };

  const ldsBuf = getBufferForLane('LearnDriven Shorts');
  const ldlBuf = getBufferForLane('LearnDriven Long Videos');
  const ldmBuf = getBufferForLane('LearnDriven Members-only Videos');
  const dwsBuf = getBufferForLane('DecodeWorthy Shorts');

  // Today's pressure guidance
  const getPressureGuidance = () => {
    if (requiredEffortToday === 0) {
      return { 
        advice: 'You can relax completely today! Take a breather.',
        intensity: 'text-emerald-400',
        badge: 'bg-emerald-950/20 text-emerald-400 border-emerald-900/50'
      };
    }
    if (requiredEffortToday <= 2) {
      return { 
        advice: 'One small, straightforward edit task is enough today.',
        intensity: 'text-sky-400',
        badge: 'bg-sky-950/20 text-sky-400 border-sky-900/50'
      };
    }
    if (requiredEffortToday <= 5) {
      return { 
        advice: 'Deep focused work recommended. Turn off distractions.',
        intensity: 'text-amber-400',
        badge: 'bg-amber-950/20 text-amber-400 border-amber-900/50'
      };
    }
    return { 
      advice: 'Today\'s workload is too high. Reduce the plan or batch similar recording and editing tasks.',
      intensity: 'text-rose-400 animate-pulse font-bold',
      badge: 'bg-rose-950/20 text-rose-400 border-rose-900/50'
    };
  };

  const guidance = getPressureGuidance();

  // Create active system alerts dynamically
  const alerts: { type: 'red' | 'amber' | 'blue' | 'white'; msg: string }[] = [];

  // Red Alerts
  const activeBlockers = videos.filter(v => v.isBlocked).length;
  if (activeBlockers > 0) {
    alerts.push({ type: 'red', msg: `${activeBlockers} video status${activeBlockers === 1 ? '' : 'es'} need attention` });
  }
  if (requiredEffortToday > 6) {
    alerts.push({ type: 'red', msg: 'Today\'s required workload is above the recommended limit' });
  }
  if (dwsBuf === 0 && goals.dwShortsTarget > 0) {
    alerts.push({ type: 'red', msg: 'DecodeWorthy has no Short scheduled ahead' });
  }

  // Amber Alerts
  if (ldsBuf === 0 && goals.ldShortsTarget > 0) {
    alerts.push({ type: 'amber', msg: 'LearnDriven has no Short scheduled ahead' });
  }
  if (ldlBuf === 0 && goals.ldLongTarget > 0) {
    alerts.push({ type: 'amber', msg: 'LearnDriven has no long video scheduled ahead' });
  }
  
  // Blue/White notifications
  if (ldsBuf > 1 || dwsBuf > 1) {
    alerts.push({ type: 'blue', msg: 'You have more than one video scheduled ahead' });
  }

  return (
    <div className="space-y-4">
      
      {/* 1. Tactical Alerts Hub with LED indicators */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
          <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">
            WORKFLOW UPDATES
          </span>
          <span className="text-[8px] text-zinc-600 font-mono">BASED ON YOUR CURRENT PLAN</span>
        </div>

        <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
          {alerts.length === 0 ? (
            <div className="p-3 text-center border border-dashed border-zinc-900 rounded text-zinc-600 font-mono text-[9px] flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              NO WORKFLOW ISSUES FOUND
            </div>
          ) : (
            alerts.map((al, idx) => (
              <div 
                key={idx}
                className="bg-zinc-900/30 border border-zinc-900 rounded p-2 flex items-start gap-2.5 font-mono text-[10px]"
              >
                {/* Tactical glowing LEDs */}
                <div className="pt-0.5 select-none">
                  {al.type === 'red' && (
                    <TactileLED color="red" importance="critical" />
                  )}
                  {al.type === 'amber' && (
                    <TactileLED color="amber" importance="high" />
                  )}
                  {al.type === 'blue' && (
                    <TactileLED color="cyan" importance="medium" />
                  )}
                  {al.type === 'white' && (
                    <TactileLED color="blue" importance="low" />
                  )}
                </div>
                <span className="text-zinc-300 font-normal leading-tight">
                  {al.msg}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Creator Workday Window Slider & Meter */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
          <span className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">
            DAILY WORK WINDOW
          </span>
          <button
            onClick={() => setEditingWindow(!editingWindow)}
            className="text-[9px] text-emerald-400 hover:underline font-mono uppercase"
          >
            {editingWindow ? 'Lock' : 'Set Window'}
          </button>
        </div>

        {/* Editing Workspace Window Form */}
        {editingWindow ? (
          <div className="space-y-3 bg-zinc-900/30 p-2.5 rounded border border-zinc-900 text-[10px] font-mono">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-zinc-500 text-[9px] uppercase">Work Start</span>
                <input
                  type="time"
                  value={winStart}
                  onChange={e => setWinStart(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-zinc-300 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <span className="text-zinc-500 text-[9px] uppercase">Work End</span>
                <input
                  type="time"
                  value={winEnd}
                  onChange={e => setWinEnd(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-zinc-300 focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={handleSaveWindow}
              className="w-full bg-emerald-500 text-zinc-950 font-bold py-1 rounded text-center uppercase tracking-wide text-[9px]"
            >
              Save Work Window
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Shift hours details */}
            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>PLANNED WORK HOURS:</span>
              <span className="text-white font-bold uppercase tracking-wider">
                {formatHourString(goals.workWindowStart || '11:00')} - {formatHourString(goals.workWindowEnd || '20:00')}
              </span>
            </div>

            {/* Simulated Time Slider (Interactive preview) */}
            <div className="bg-zinc-900/20 border border-zinc-900/80 p-2.5 rounded space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-zinc-500 uppercase">Simulated Time:</span>
                <span className="text-emerald-400 font-bold tracking-wider">{formatHourString(simulatedTime)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1439"
                step="15"
                value={timeToMinutes(simulatedTime)}
                onChange={e => setSimulatedTime(minutesToTimeStr(Number(e.target.value)))}
                className="w-full accent-emerald-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[8px] text-zinc-600 font-mono uppercase">
                <span>00:00 MID</span>
                <span>12:00 NOON</span>
                <span>23:45 PM</span>
              </div>
            </div>

            {/* Shift Progress Meters */}
            <div className="space-y-1.5 font-mono text-[10px]">
              <div className="flex justify-between text-zinc-500">
                <span>WORKDAY STATUS:</span>
                <span className="text-zinc-300 font-bold">{workDayStatus}</span>
              </div>
              <div className="relative h-2 bg-zinc-900 rounded overflow-hidden">
                <div 
                  className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-300"
                  style={{ width: `${elapsedPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-zinc-600">
                <span>ELAPSED: {elapsedPercent}%</span>
                <span>REMAINING: {remainingPercent}%</span>
              </div>
              <div className="text-[10px] text-zinc-400 text-center bg-zinc-900/10 p-1 border border-zinc-900 rounded">
                {timeRemainingStr}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

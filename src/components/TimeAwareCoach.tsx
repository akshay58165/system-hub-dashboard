import React, { useEffect, useMemo, useState } from 'react';
import { BellRing, ChevronLeft, ChevronRight, Clock3, Droplets, Moon, Sandwich, StretchHorizontal } from 'lucide-react';
import { CalibrationNode, DashboardActionTarget, MonthlyGoals, WellbeingEntry } from '../types';

interface Props {
  goals: MonthlyGoals;
  nodes: CalibrationNode[];
  wellbeingHistory: WellbeingEntry[];
  onNavigate: (target: DashboardActionTarget) => void;
}

interface CoachNotice { id: string; label: string; message: string; reason: string; tone: string; icon: React.ReactNode }

export default function TimeAwareCoach({ goals, nodes, wellbeingHistory, onNavigate }: Props) {
  const [now, setNow] = useState(new Date());
  const [index, setIndex] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const notices = useMemo<CoachNotice[]>(() => {
    const value = (id: string) => nodes.find(node => node.id === id)?.value ?? 0;
    const hour = now.getHours();
    const items: CoachNotice[] = [];
    if (hour >= 11 && hour < 14) items.push({ id: 'lunch', label: 'MEAL WINDOW', message: 'Pause for lunch instead of working through it.', reason: value('nutrition') <= 6 ? 'Your nutrition score is not strong enough to skip a proper meal.' : 'A planned meal protects afternoon focus.', tone: 'text-amber-400 border-amber-900/50', icon: <Sandwich className="h-4 w-4" /> });
    if (hour >= 20 || hour < 2) items.push({ id: 'sleep', label: 'RECOVERY WINDOW', message: value('sleep') <= 5 ? 'Start winding down now and aim for an early night.' : 'Protect tomorrow by closing the workday deliberately.', reason: value('sleep') <= 5 ? `Last recorded sleep is ${value('sleep')}/10.` : 'Late work can erode tomorrow’s available energy.', tone: 'text-indigo-300 border-indigo-900/50', icon: <Moon className="h-4 w-4" /> });
    if (value('hydration') <= 6 || (hour >= 9 && hour <= 21)) items.push({ id: 'water', label: 'HYDRATION CHECK', message: 'Drink water now, then update hydration if it changes.', reason: value('hydration') <= 6 ? `Hydration is currently ${value('hydration')}/10.` : 'A small scheduled check prevents a late-day deficit.', tone: 'text-cyan-400 border-cyan-900/50', icon: <Droplets className="h-4 w-4" /> });
    const [startHour] = goals.workWindowStart.split(':').map(Number); const [endHour] = goals.workWindowEnd.split(':').map(Number);
    if (hour >= startHour && hour <= endHour) items.push({ id: 'break', label: 'WORKLOAD PACER', message: 'Take a five-minute eye and movement break before the next deep block.', reason: value('eyeComfort') <= 6 || value('physicalComfort') <= 6 ? 'Your comfort signals show that recovery is already useful.' : 'Short breaks protect accuracy across a long work window.', tone: 'text-emerald-400 border-emerald-900/50', icon: <StretchHorizontal className="h-4 w-4" /> });
    if (value('energy') <= 4) items.unshift({ id: 'energy', label: 'LOW ENERGY MODE', message: 'Choose one short, concrete task; avoid opening a new deep-work thread.', reason: `Recorded energy is ${value('energy')}/10.`, tone: 'text-rose-400 border-rose-900/50', icon: <BellRing className="h-4 w-4" /> });
    return items;
  }, [now, nodes, goals, wellbeingHistory.length]);
  useEffect(() => { setIndex(current => Math.min(current, Math.max(0, notices.length - 1))); }, [notices.length]);
  useEffect(() => { if (notices.length <= 1) return; const timer = window.setInterval(() => setIndex(current => (current + 1) % notices.length), 12_000); return () => window.clearInterval(timer); }, [notices.length]);
  if (!notices.length) return null;
  const notice = notices[index];
  const move = (direction: number) => setIndex(current => (current + direction + notices.length) % notices.length);
  return <div className="border-b border-zinc-900 bg-zinc-950/95 px-4 py-2 font-mono">
    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
      <div className={`flex items-center gap-2 rounded border px-2.5 py-1.5 shrink-0 ${notice.tone}`}>{notice.icon}<span className="text-[9px] font-bold tracking-wider">{notice.label}</span></div>
      <button type="button" onClick={() => onNavigate({ type: 'health' })} className="min-w-0 flex-1 text-left"><div className="text-[10px] font-bold text-zinc-200">{notice.message}</div><div className="text-[9px] text-zinc-500 mt-0.5">WHY NOW: {notice.reason}</div></button>
      <div className="flex items-center gap-2 shrink-0"><Clock3 className="h-3 w-3 text-zinc-600" /><span className="text-[9px] text-zinc-500">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span className="text-[9px] text-zinc-600">{index + 1}/{notices.length}</span><button onClick={() => move(-1)} className="p-1 border border-zinc-800 rounded text-zinc-500 hover:text-white"><ChevronLeft className="h-3 w-3" /></button><button onClick={() => move(1)} className="p-1 border border-zinc-800 rounded text-zinc-500 hover:text-white"><ChevronRight className="h-3 w-3" /></button></div>
    </div>
  </div>;
}

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Clock3, Pause, Play, RotateCcw, X } from 'lucide-react';
import type { WorkdaySession } from '../types';

interface WorkdayTimerProps {
  session: WorkdaySession | null;
  setSession: React.Dispatch<React.SetStateAction<WorkdaySession | null>>;
}

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const todayKey = () => new Date().toLocaleDateString('en-CA');

export default function WorkdayTimer({ session, setSession }: WorkdayTimerProps) {
  const [now, setNow] = useState(Date.now());
  const [showSetup, setShowSetup] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [selectedHours, setSelectedHours] = useState<number | 'custom'>(5);
  const [customHours, setCustomHours] = useState('6');

  useEffect(() => {
    if (!session || session.status === 'completed') return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session?.status]);

  const metrics = useMemo(() => {
    if (!session) return { active: 0, paused: 0, target: 0, remaining: 0, progress: 0 };
    const active = session.accumulatedActiveMs + (session.status === 'running' && session.activeSince ? Math.max(0, now - new Date(session.activeSince).getTime()) : 0);
    const paused = session.accumulatedPausedMs + (session.status === 'paused' && session.pausedAt ? Math.max(0, now - new Date(session.pausedAt).getTime()) : 0);
    const target = session.targetMinutes * 60_000;
    return { active, paused, target, remaining: Math.max(0, target - active), progress: target ? Math.min(100, (active / target) * 100) : 0 };
  }, [session, now]);

  const startDay = () => {
    const hours = selectedHours === 'custom' ? Number(customHours) : selectedHours;
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return;
    const stamp = new Date().toISOString();
    setSession({ dateKey: todayKey(), targetMinutes: Math.round(hours * 60), startedAt: stamp, activeSince: stamp, pausedAt: null, accumulatedActiveMs: 0, accumulatedPausedMs: 0, status: 'running', updatedAt: stamp });
    setNow(Date.now());
    setShowSetup(false);
    setShowPanel(true);
  };

  const pause = () => setSession(current => {
    if (!current || current.status !== 'running' || !current.activeSince) return current;
    const stamp = new Date();
    return { ...current, accumulatedActiveMs: current.accumulatedActiveMs + Math.max(0, stamp.getTime() - new Date(current.activeSince).getTime()), activeSince: null, pausedAt: stamp.toISOString(), status: 'paused', updatedAt: stamp.toISOString() };
  });

  const resume = () => setSession(current => {
    if (!current || current.status !== 'paused') return current;
    const stamp = new Date();
    return { ...current, accumulatedPausedMs: current.accumulatedPausedMs + (current.pausedAt ? Math.max(0, stamp.getTime() - new Date(current.pausedAt).getTime()) : 0), activeSince: stamp.toISOString(), pausedAt: null, status: 'running', updatedAt: stamp.toISOString() };
  });

  const reset = () => {
    if (window.confirm('Reset today\'s work timer and clear its recorded time?')) {
      setSession(null);
      setShowPanel(false);
    }
  };

  return (
    <>
      {session ? (
        <div className={`relative flex shrink-0 items-stretch overflow-hidden rounded-lg border font-mono text-[10px] font-bold transition ${session.status === 'paused' ? 'border-amber-800/60 bg-amber-950/25 text-amber-300' : 'border-emerald-800/60 bg-emerald-950/25 text-emerald-300'}`}>
          <button type="button" onClick={() => setShowPanel(value => !value)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5" title="Open workday details">
            <Clock3 className="h-3.5 w-3.5" />
            <span>{formatDuration(metrics.active)} / {Math.round(session.targetMinutes / 60 * 10) / 10}h</span>
          </button>
          <button type="button" onClick={session.status === 'paused' ? resume : pause} className={`flex min-w-9 items-center justify-center border-l transition ${session.status === 'paused' ? 'border-amber-800/60 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'border-emerald-800/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'}`} title={session.status === 'paused' ? 'Resume work' : 'Pause work'} aria-label={session.status === 'paused' ? 'Resume workday timer' : 'Pause workday timer'}>
            {session.status === 'paused' ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
          </button>
          <span className="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 overflow-hidden rounded-full bg-neutral-900"><span className="block h-full bg-emerald-400" style={{ width: `${metrics.progress}%` }} /></span>
        </div>
      ) : (
        <button type="button" onClick={() => setShowSetup(true)} className="flex shrink-0 items-center gap-2 rounded-lg border border-cyan-900/60 bg-cyan-950/20 px-3 py-1.5 font-mono text-[10px] font-bold text-cyan-300 transition hover:border-cyan-700">
          <Clock3 className="h-3.5 w-3.5" /><span>Start the day</span>
        </button>
      )}

      <AnimatePresence>
        {showSetup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} className="w-full max-w-md rounded-2xl border border-cyan-900/50 bg-neutral-950 p-5 shadow-[0_0_50px_rgba(6,182,212,.12)]">
              <div className="flex items-center justify-between"><div><h2 className="text-base font-bold text-white">Start the day</h2><p className="mt-1 text-[10px] text-neutral-500">Set today&apos;s active work quota.</p></div><button onClick={() => setShowSetup(false)} className="p-1 text-neutral-500 hover:text-white"><X className="h-4 w-4" /></button></div>
              <div className="mt-5 grid grid-cols-4 gap-2">{([5, 8, 10, 'custom'] as const).map(value => <button key={value} onClick={() => setSelectedHours(value)} className={`rounded-lg border px-2 py-3 font-mono text-[10px] font-bold uppercase ${selectedHours === value ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300' : 'border-neutral-800 bg-neutral-900/50 text-neutral-500'}`}>{value === 'custom' ? 'Custom' : `${value}h`}</button>)}</div>
              {selectedHours === 'custom' && <label className="mt-4 block text-[9px] uppercase text-neutral-500">Hours<input type="number" min="0.25" max="24" step="0.25" value={customHours} onChange={event => setCustomHours(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white" /></label>}
              <button onClick={startDay} className="mt-5 w-full rounded-lg bg-cyan-500 py-2.5 text-xs font-bold text-black hover:bg-cyan-400">Start timer</button>
            </motion.div>
          </div>
        )}

        {session && showPanel && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="fixed right-4 top-28 z-[90] w-[min(380px,calc(100vw-2rem))] rounded-2xl border border-neutral-800 bg-neutral-950/98 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-sm font-bold text-white"><span className={`h-2 w-2 rounded-full ${session.status === 'paused' ? 'bg-amber-400' : 'animate-pulse bg-emerald-400'}`} />Workday timer</div><div className="mt-1 text-[9px] uppercase text-neutral-600">Started {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div><button onClick={() => setShowPanel(false)} className="text-neutral-600 hover:text-white"><X className="h-4 w-4" /></button></div>
            <div className="mt-4 text-center font-mono text-3xl font-black text-white">{formatDuration(metrics.active)}</div>
            <div className="mt-1 text-center text-[9px] uppercase text-neutral-500">active work recorded</div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-900"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all" style={{ width: `${metrics.progress}%` }} /></div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-neutral-900/60 p-2"><div className="text-xs font-bold text-emerald-300">{metrics.progress.toFixed(1)}%</div><div className="mt-1 text-[7px] uppercase text-neutral-600">quota filled</div></div><div className="rounded-lg bg-neutral-900/60 p-2"><div className="text-xs font-bold text-cyan-300">{formatDuration(metrics.remaining)}</div><div className="mt-1 text-[7px] uppercase text-neutral-600">remaining</div></div><div className="rounded-lg bg-neutral-900/60 p-2"><div className="text-xs font-bold text-amber-300">{formatDuration(metrics.paused)}</div><div className="mt-1 text-[7px] uppercase text-neutral-600">paused</div></div></div>
            <div className="mt-4 flex gap-2"><button onClick={session.status === 'paused' ? resume : pause} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[10px] font-bold ${session.status === 'paused' ? 'bg-emerald-500 text-black' : 'bg-amber-500 text-black'}`}>{session.status === 'paused' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}{session.status === 'paused' ? 'Resume work' : 'Pause work'}</button><button onClick={reset} title="Reset day" className="rounded-lg border border-neutral-800 px-3 text-neutral-500 hover:border-rose-900 hover:text-rose-400"><RotateCcw className="h-4 w-4" /></button></div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

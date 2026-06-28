import React from 'react';
import { Activity, Apple, BatteryCharging, Brain, CircleMinus, CirclePlus, Droplets, Dumbbell, Eye, Heart, Home, Lightbulb, LockKeyhole, Moon, ScanLine, Smile, Sparkles, WalletCards } from 'lucide-react';
import { CalibrationNode, WellbeingEntry } from '../types';
import { formatEntryTime, getReadiness, getWellbeingInsights, isToday } from '../wellbeingLogic';

interface Props {
  nodes: CalibrationNode[];
  history: WellbeingEntry[];
  onUpdateNode: (nodeId: string, newValue: number, record?: boolean) => void;
}

const META: Record<string, { group: 'BODY' | 'MIND' | 'CONTEXT'; icon: React.ComponentType<{ className?: string }>; hint: string }> = {
  sleep: { group: 'BODY', icon: Moon, hint: 'How restorative last night felt' },
  freshness: { group: 'MIND', icon: Sparkles, hint: 'Mental clarity and alertness' },
  eyeComfort: { group: 'BODY', icon: Eye, hint: 'Screen comfort and eye strain' },
  pleasantness: { group: 'MIND', icon: Smile, hint: 'How pleasant this moment feels' },
  nutrition: { group: 'BODY', icon: Apple, hint: 'Quality and sufficiency of food' },
  hydration: { group: 'BODY', icon: Droplets, hint: 'Current hydration feeling' },
  physicalComfort: { group: 'BODY', icon: Heart, hint: 'Posture, pain and body comfort' },
  mood: { group: 'MIND', icon: Smile, hint: 'Current emotional tone' },
  mindfulness: { group: 'MIND', icon: Brain, hint: 'Presence without mental clutter' },
  energy: { group: 'MIND', icon: BatteryCharging, hint: 'Usable energy for action' },
  finances: { group: 'CONTEXT', icon: WalletCards, hint: 'Financial ease and safety' },
  environment: { group: 'CONTEXT', icon: Home, hint: 'Workspace and surroundings' },
  endorphins: { group: 'BODY', icon: Dumbbell, hint: 'Movement-related uplift' },
};

function stateFor(value: number) {
  if (value <= 3) return { label: 'Needs care', text: 'text-rose-400', bg: 'bg-rose-500', border: 'border-rose-900/60' };
  if (value <= 5) return { label: 'Low', text: 'text-amber-400', bg: 'bg-amber-400', border: 'border-amber-900/50' };
  if (value <= 7) return { label: 'Steady', text: 'text-cyan-400', bg: 'bg-cyan-400', border: 'border-cyan-900/50' };
  return { label: 'Strong', text: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-900/50' };
}

function SignalGraph({ node, entries }: { node: CalibrationNode; entries: WellbeingEntry[] }) {
  const today = entries.filter(entry => entry.nodeId === node.id && isToday(entry.timestamp)).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const data = today.length ? today : [];
  const points: string[] = [];
  data.forEach((entry, index) => {
    const date = new Date(entry.timestamp);
    const x = Math.max(2, ((date.getHours() * 60 + date.getMinutes()) / 1440) * 100);
    const y = 34 - ((entry.value - 1) / 9) * 27;
    if (index > 0) points.push(`${x},${points.at(-1)?.split(',')[1]}`);
    points.push(`${x},${y}`);
  });
  const currentY = 34 - ((node.value - 1) / 9) * 27;
  return <div className="relative h-12 rounded-md border border-zinc-900 bg-black/30 overflow-hidden">
    <svg viewBox="0 0 100 38" preserveAspectRatio="none" className="h-full w-full">
      {[8, 20, 32].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#27272a" strokeWidth="0.45" strokeDasharray="2 3" />)}
      {[25, 50, 75].map(x => <line key={x} x1={x} y1="0" x2={x} y2="38" stroke="#18181b" strokeWidth="0.4" />)}
      {points.length > 1 ? <polyline points={points.join(' ')} fill="none" stroke={node.color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" /> : <line x1="2" y1={currentY} x2="98" y2={currentY} stroke={node.color} strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />}
      <circle cx={points.length ? Number(points.at(-1)?.split(',')[0]) : 98} cy={points.length ? Number(points.at(-1)?.split(',')[1]) : currentY} r="1.6" fill={node.color} />
    </svg>
    <div className="absolute inset-x-2 bottom-0.5 flex justify-between text-[6px] font-mono text-zinc-700"><span>12 AM</span><span>NOON</span><span>NOW</span></div>
  </div>;
}

export default function DailyStateDashboard({ nodes, history, onUpdateNode }: Props) {
  const readiness = getReadiness(nodes);
  const insights = getWellbeingInsights(nodes, history);
  const todayHistory = history.filter(entry => isToday(entry.timestamp)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const sleepRecorded = todayHistory.some(entry => entry.nodeId === 'sleep');
  const averageFor = (group: 'BODY' | 'MIND' | 'CONTEXT') => {
    const values = nodes.filter(node => META[node.id]?.group === group).map(node => node.value);
    return Math.round((values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)) * 10);
  };
  const sorted = [...nodes].sort((a, b) => a.value - b.value);
  const latestByNode = todayHistory.filter((entry, index, all) => all.findIndex(item => item.nodeId === entry.nodeId) === index);

  return <div id="wellbeing-dashboard" className="space-y-4 scroll-mt-4">
    <header className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-center relative overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-400 via-emerald-400 to-purple-500" />
      <div className="pl-2"><div className="flex items-center gap-2 text-[10px] text-cyan-400 font-mono font-bold tracking-widest"><ScanLine className="h-4 w-4 animate-pulse" />LIVE DAILY STATE</div><h2 className="text-base font-bold text-white mt-1">Record what changed—not how the entire day felt.</h2><p className="text-[10px] text-zinc-500 mt-1">Each adjustment starts a new time segment. Your dashboard uses the latest state until you change it again.</p></div>
      <div className="flex gap-2 font-mono"><div className="min-w-28 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-center"><span className="text-[7px] text-zinc-500 block">READINESS NOW</span><strong className={`text-xl ${stateFor(Math.round(readiness / 10)).text}`}>{readiness}%</strong></div><div className="min-w-28 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-center"><span className="text-[7px] text-zinc-500 block">UPDATED TODAY</span><strong className="text-xl text-cyan-400">{latestByNode.length}<span className="text-[9px] text-zinc-600">/{nodes.length}</span></strong></div></div>
    </header>

    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(340px,0.8fr)] gap-4 items-start">
      <section className="bg-zinc-950 border border-zinc-900 rounded-xl p-4">
        <div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-3"><div><h3 className="text-xs font-mono font-bold text-white tracking-wider">HOW ARE YOU FEELING NOW?</h3><p className="text-[8px] text-zinc-600 mt-1">Drag for speed • use − / + for precision</p></div><div className="flex items-center gap-3 text-[7px] font-mono text-zinc-600"><span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-rose-500" />CARE</span><span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-cyan-400" />STEADY</span><span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-emerald-400" />STRONG</span></div></div>
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">{nodes.map(node => {
          const meta = META[node.id]; const Icon = meta?.icon || Activity; const state = stateFor(node.value); const locked = node.id === 'sleep' && sleepRecorded; const latest = todayHistory.find(entry => entry.nodeId === node.id);
          const change = (value: number) => onUpdateNode(node.id, Math.max(1, Math.min(10, value)), true);
          return <article key={node.id} className={`rounded-lg border ${state.border} bg-zinc-900/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] hover:bg-zinc-900/35 transition-colors`}>
            <div className="flex items-start justify-between gap-3"><div className="flex gap-2.5"><div className={`h-9 w-9 rounded-md border ${state.border} bg-black/30 grid place-items-center shadow-inner`}><Icon className={`h-4 w-4 ${state.text}`} /></div><div><div className="flex items-center gap-2"><h4 className="text-[10px] font-mono font-bold text-zinc-200">{node.label}</h4><span className={`text-[7px] font-mono ${state.text}`}>{state.label.toUpperCase()}</span></div><p className="text-[7px] text-zinc-600 mt-0.5">{meta?.hint}</p></div></div><div className="text-right"><strong className={`text-xl font-mono ${state.text}`}>{node.value}</strong><span className="text-[8px] text-zinc-700">/10</span></div></div>
            <div className="grid grid-cols-[28px_1fr_28px] gap-2 items-center mt-3"><button disabled={locked} onClick={() => change(node.value - 1)} className="h-7 rounded border border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-white hover:border-zinc-600 disabled:opacity-30 grid place-items-center"><CircleMinus className="h-3.5 w-3.5" /></button><div><input aria-label={`${node.label} rating`} type="range" min="1" max="10" step="1" value={node.value} disabled={locked} onChange={event => onUpdateNode(node.id, Number(event.target.value), false)} onPointerUp={event => onUpdateNode(node.id, Number(event.currentTarget.value), true)} onKeyUp={event => onUpdateNode(node.id, Number(event.currentTarget.value), true)} className="w-full h-2 accent-cyan-400 cursor-pointer disabled:opacity-30" /><div className="flex justify-between px-0.5 mt-0.5">{Array.from({ length: 10 }).map((_, index) => <i key={index} className={`h-1 w-px ${index < node.value ? state.bg : 'bg-zinc-800'}`} />)}</div></div><button disabled={locked} onClick={() => change(node.value + 1)} className="h-7 rounded border border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-white hover:border-zinc-600 disabled:opacity-30 grid place-items-center"><CirclePlus className="h-3.5 w-3.5" /></button></div>
            <div className="mt-2"><SignalGraph node={node} entries={history} /></div>
            <div className="flex justify-between mt-2 text-[7px] font-mono text-zinc-600"><span>{latest ? `UPDATED ${formatEntryTime(latest.timestamp)}` : 'NOT UPDATED TODAY'}</span>{locked && <span className="text-indigo-400 flex items-center gap-1"><LockKeyhole className="h-2.5 w-2.5" />LOCKED TODAY</span>}</div>
          </article>;
        })}</div>
      </section>

      <aside className="space-y-4 xl:sticky xl:top-4">
        <section className="bg-zinc-950 border border-zinc-900 rounded-xl p-4"><div className="flex items-center gap-2 border-b border-zinc-900 pb-3 mb-3"><Lightbulb className="h-4 w-4 text-amber-400" /><div><h3 className="text-xs font-mono font-bold text-white">WHAT MATTERS RIGHT NOW</h3><p className="text-[8px] text-zinc-600">Ordered by immediate usefulness</p></div></div><div className="space-y-2">{insights.map((insight, index) => <div key={insight.title} className={`relative rounded-lg border p-3 pl-4 ${insight.tone === 'act' ? 'border-rose-900/60 bg-rose-950/10' : insight.tone === 'watch' ? 'border-amber-900/50 bg-amber-950/10' : 'border-emerald-900/50 bg-emerald-950/10'}`}><span className={`absolute inset-y-2 left-0 w-0.5 rounded ${insight.tone === 'act' ? 'bg-rose-500 animate-pulse' : insight.tone === 'watch' ? 'bg-amber-400' : 'bg-emerald-400'}`} /><div className="flex gap-2"><span className="text-[8px] text-zinc-600 font-mono">0{index + 1}</span><div><strong className="text-[10px] text-zinc-200 block">{insight.title}</strong><p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">{insight.detail}</p></div></div></div>)}</div></section>

        <section className="bg-zinc-950 border border-zinc-900 rounded-xl p-4"><div className="flex items-center gap-2 border-b border-zinc-900 pb-3 mb-3"><Brain className="h-4 w-4 text-purple-400" /><h3 className="text-xs font-mono font-bold text-white">STATE BALANCE</h3></div><div className="space-y-3">{(['BODY','MIND','CONTEXT'] as const).map(group => { const value = averageFor(group); const state = stateFor(Math.round(value / 10)); return <div key={group}><div className="flex justify-between text-[8px] font-mono mb-1"><span className="text-zinc-500">{group}</span><strong className={state.text}>{value}% · {state.label}</strong></div><div className="h-2 rounded-full bg-zinc-900 overflow-hidden"><div className={`h-full rounded-full ${state.bg}`} style={{ width: `${value}%` }} /></div></div>; })}</div><div className="grid grid-cols-2 gap-2 mt-4"><div className="rounded border border-rose-900/40 bg-rose-950/10 p-2"><span className="text-[7px] text-zinc-600 block">LOWEST NOW</span><strong className="text-[9px] text-rose-400">{sorted[0]?.label} {sorted[0]?.value}/10</strong></div><div className="rounded border border-emerald-900/40 bg-emerald-950/10 p-2"><span className="text-[7px] text-zinc-600 block">STRONGEST NOW</span><strong className="text-[9px] text-emerald-400">{sorted.at(-1)?.label} {sorted.at(-1)?.value}/10</strong></div></div></section>

        <section className="bg-zinc-950 border border-zinc-900 rounded-xl p-4"><div className="flex items-center justify-between border-b border-zinc-900 pb-3 mb-3"><h3 className="text-xs font-mono font-bold text-white">TODAY’S TIMELINE</h3><span className="text-[7px] text-zinc-600">LATEST PER SIGNAL</span></div><div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">{latestByNode.length ? latestByNode.map(entry => { const node = nodes.find(item => item.id === entry.nodeId); const meta = node ? META[node.id] : null; const Icon = meta?.icon || Activity; return <div key={entry.id} className="grid grid-cols-[24px_1fr_auto_auto] items-center gap-2 rounded border border-zinc-900 bg-zinc-900/20 p-2"><div className="h-6 w-6 rounded bg-zinc-950 grid place-items-center"><Icon className="h-3 w-3 text-cyan-400" /></div><span className="text-[8px] font-mono text-zinc-400">{node?.label}</span><span className="text-[7px] text-zinc-600 font-mono">{formatEntryTime(entry.timestamp)}</span><strong className="text-[9px] text-cyan-400 font-mono">{entry.value}/10</strong></div>; }) : <div className="text-center py-6 text-[9px] text-zinc-600">Your first slider update will start the timeline.</div>}</div></section>
      </aside>
    </div>
  </div>;
}

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Pause, Play, Plus, Target, Trash2 } from 'lucide-react';
import type { Topic, WorkdaySession } from '../types';

interface TodayGoalsViewProps {
  topics: Topic[];
  session: WorkdaySession | null;
  setSession: React.Dispatch<React.SetStateAction<WorkdaySession | null>>;
}

const goalStages = ['scripted', 'shot', 'edited', 'scheduled', 'posted'] as const;
const stageOrder = ['topic', ...goalStages] as const;
const formatDuration = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export default function TodayGoalsView({ topics, session, setSession }: TodayGoalsViewProps) {
  const [now, setNow] = useState(Date.now());
  const [topicId, setTopicId] = useState('');
  const [target, setTarget] = useState<typeof goalStages[number]>('scripted');
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const metrics = useMemo(() => {
    if (!session) return { active: 0, paused: 0, remaining: 0, progress: 0 };
    const active = session.accumulatedActiveMs + (session.status === 'running' && session.activeSince ? Math.max(0, now - new Date(session.activeSince).getTime()) : 0);
    const paused = session.accumulatedPausedMs + (session.status === 'paused' && session.pausedAt ? Math.max(0, now - new Date(session.pausedAt).getTime()) : 0);
    const budget = session.targetMinutes * 60_000;
    return { active, paused, remaining: Math.max(0, budget - active), progress: budget ? Math.min(100, active / budget * 100) : 0 };
  }, [session, now]);

  const complete = (goal: NonNullable<WorkdaySession['goals']>[number]) => {
    const topic = topics.find(item => item.id === goal.topicId);
    return Boolean(topic && stageOrder.indexOf(topic.status) >= stageOrder.indexOf(goal.targetStatus));
  };
  // Only ever treat a goal as real if its topic still exists — topicId is
  // the sole reference; a goal for a deleted topic isn't a goal anymore.
  const goals = (session?.goals || []).filter(goal => topics.some(t => t.id === goal.topicId));
  const completed = goals.filter(complete).length;
  const ranked = useMemo(() => [...topics]
    .filter(topic => topic.status !== 'scheduled' && topic.status !== 'posted' && !goals.some(goal => goal.topicId === topic.id))
    .sort((a, b) => {
      const urgency = (topic: Topic) => topic.blockedReason ? 0 : topic.dueDate && new Date(topic.dueDate).getTime() < Date.now() ? 1 : topic.dueDate ? 2 : 3;
      const due = (topic: Topic) => topic.dueDate ? new Date(topic.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return urgency(a) - urgency(b) || due(a) - due(b) || a.priority - b.priority;
    }), [topics, goals]);
  const selected = ranked.find(topic => topic.id === topicId);
  const targets = selected ? goalStages.filter(stage => stageOrder.indexOf(stage) > stageOrder.indexOf(selected.status)) : goalStages;
  const chooseTopic = (id: string) => {
    setTopicId(id);
    const item = ranked.find(topic => topic.id === id);
    const next = item && goalStages.find(stage => stageOrder.indexOf(stage) > stageOrder.indexOf(item.status));
    if (next) setTarget(next);
  };
  const addGoal = () => {
    if (!session || !selected || !targets.includes(target)) return;
    const stamp = new Date().toISOString();
    setSession({ ...session, goals: [...goals, { id: `goal-${Date.now()}`, topicId: selected.id, targetStatus: target, addedAt: stamp }], updatedAt: stamp });
    setTopicId('');
  };
  const removeGoal = (id: string) => setSession(current => current ? { ...current, goals: (current.goals || []).filter(goal => goal.id !== id), updatedAt: new Date().toISOString() } : current);
  const pauseResume = () => setSession(current => {
    if (!current) return current;
    const stamp = new Date();
    if (current.status === 'running' && current.activeSince) return { ...current, accumulatedActiveMs: current.accumulatedActiveMs + Math.max(0, stamp.getTime() - new Date(current.activeSince).getTime()), activeSince: null, pausedAt: stamp.toISOString(), status: 'paused', updatedAt: stamp.toISOString() };
    if (current.status === 'paused') return { ...current, accumulatedPausedMs: current.accumulatedPausedMs + (current.pausedAt ? Math.max(0, stamp.getTime() - new Date(current.pausedAt).getTime()) : 0), pausedAt: null, activeSince: stamp.toISOString(), status: 'running', updatedAt: stamp.toISOString() };
    return current;
  });

  if (!session) return <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-8 text-center"><Target className="mx-auto h-8 w-8 text-purple-400" /><h1 className="mt-3 text-xl font-bold text-white">Today&apos;s Goals</h1><p className="mt-2 text-sm text-neutral-500">Start the day from the header to create today&apos;s time budget and topic goals.</p></div>;

  return <div className="space-y-5 pb-10">
    <section className="rounded-2xl border border-purple-900/35 bg-[linear-gradient(120deg,rgba(20,10,32,.95),rgba(4,16,20,.95))] p-5 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-purple-400"><Target className="h-4 w-4" />Daily execution</div><h1 className="mt-2 text-2xl font-bold text-white">Today&apos;s Goals</h1><p className="mt-1 text-sm text-neutral-500">Started {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p></div><button onClick={pauseResume} className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-bold ${session.status === 'paused' ? 'bg-emerald-500 text-black' : 'bg-amber-500 text-black'}`}>{session.status === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{session.status === 'paused' ? 'Resume work' : 'Pause work'}</button></div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-900"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400" style={{ width: `${metrics.progress}%` }} /></div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">{[
        ['Active', formatDuration(metrics.active), 'text-emerald-300'], ['Remaining', formatDuration(metrics.remaining), 'text-cyan-300'], ['Paused', formatDuration(metrics.paused), 'text-amber-300'], ['Quota', `${metrics.progress.toFixed(1)}%`, 'text-purple-300'], ['Goals', `${completed}/${goals.length}`, 'text-white']
      ].map(([label, value, color]) => <div key={label} className="rounded-xl border border-neutral-900 bg-neutral-950/60 p-3"><div className={`text-lg font-black ${color}`}>{value}</div><div className="mt-1 text-[8px] uppercase text-neutral-600">{label}</div></div>)}</div>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold text-white">Execution list</h2><p className="mt-1 text-[10px] text-neutral-500">Live progress from current stage to today&apos;s milestone.</p></div><span className="font-mono text-[10px] text-purple-300">{completed}/{goals.length} complete</span></div>
        {goals.length ? <div className="space-y-3">{goals.map((goal, index) => { const topic = topics.find(item => item.id === goal.topicId); if (!topic) return null; const done = complete(goal); return <div key={goal.id} className={`rounded-xl border p-4 ${done ? 'border-emerald-900/40 bg-emerald-950/10' : 'border-neutral-850 bg-neutral-900/25'}`}><div className="flex items-start gap-3"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${done ? 'bg-emerald-500 text-black' : 'bg-neutral-950 text-neutral-500'}`}>{done ? <Check className="h-4 w-4" /> : String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><div className={`truncate text-sm font-bold ${done ? 'text-emerald-300' : 'text-white'}`}>{topic.name}</div><div className="mt-1 flex flex-wrap gap-1.5 text-[8px] uppercase"><span className="rounded bg-blue-950/35 px-2 py-1 text-blue-300">Current {topic.status}</span><span className="rounded bg-purple-950/35 px-2 py-1 text-purple-300">Target {goal.targetStatus}</span>{topic.dueDate && <span className="rounded bg-rose-950/35 px-2 py-1 text-rose-300">Due {new Date(topic.dueDate).toLocaleDateString()}</span>}<span className="rounded bg-cyan-950/35 px-2 py-1 text-cyan-300">P{topic.priority}</span></div></div><button onClick={() => removeGoal(goal.id)} className="text-neutral-700 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button></div></div>; })}</div> : <div className="rounded-xl border border-dashed border-neutral-800 py-12 text-center text-sm text-neutral-600">No topic goals set for today.</div>}
      </div>

      <div className="h-fit rounded-2xl border border-purple-900/30 bg-neutral-950/70 p-5"><div className="flex items-center gap-2 text-sm font-bold text-white"><Plus className="h-4 w-4 text-purple-400" />Add a goal</div><p className="mt-1 text-[9px] text-neutral-600">Scheduled and posted topics are excluded.</p><div className="mt-4 space-y-3"><label className="block text-[8px] font-bold uppercase text-neutral-500">Ranked topic<select value={topicId} onChange={event => chooseTopic(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-[10px] font-semibold text-white"><option value="">Select topic</option>{ranked.map(topic => <option key={topic.id} value={topic.id}>P{topic.priority} - {topic.name} - {topic.status}</option>)}</select></label>{selected && <div className="rounded-lg bg-neutral-900/60 p-3"><div className="truncate text-[10px] font-semibold text-white">{selected.name}</div><div className="mt-1 text-[8px] uppercase text-neutral-600">{selected.channel} - current {selected.status}{selected.dueDate ? ` - due ${new Date(selected.dueDate).toLocaleDateString()}` : ''}</div></div>}<label className="block text-[8px] font-bold uppercase text-neutral-500">Milestone<select disabled={!selected} value={target} onChange={event => setTarget(event.target.value as typeof goalStages[number])} className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-[10px] capitalize text-white disabled:opacity-40">{targets.map(stage => <option key={stage}>{stage}</option>)}</select></label><button disabled={!selected} onClick={addGoal} className="w-full rounded-lg bg-purple-500 py-2.5 text-[10px] font-bold text-black hover:bg-purple-400 disabled:opacity-40">Add today&apos;s goal</button></div></div>
    </section>
  </div>;
}

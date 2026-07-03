import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Clock3, Pause, Play, Plus, RotateCcw, Target, Trash2, X } from 'lucide-react';
import type { Topic, WorkdaySession } from '../types';
import { useDismissOnOutsideClick } from '../hooks/useDismissOnOutsideClick';

interface WorkdayTimerProps {
  session: WorkdaySession | null;
  setSession: React.Dispatch<React.SetStateAction<WorkdaySession | null>>;
  topics: Topic[];
}

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const todayKey = () => new Date().toLocaleDateString('en-CA');

const goalStages = ['scripted', 'shot', 'edited', 'scheduled', 'posted'] as const;
const stageOrder = ['topic', ...goalStages] as const;

export default function WorkdayTimer({ session, setSession, topics }: WorkdayTimerProps) {
  const [now, setNow] = useState(Date.now());
  const [showSetup, setShowSetup] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [selectedHours, setSelectedHours] = useState<number | 'custom'>(5);
  const [customHours, setCustomHours] = useState('6');
  const [showGoals, setShowGoals] = useState(false);
  const [goalTopicId, setGoalTopicId] = useState('');
  const [goalTarget, setGoalTarget] = useState<typeof goalStages[number]>('scripted');
  const [lastGoalAdded, setLastGoalAdded] = useState('');

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
    setSession({ dateKey: todayKey(), targetMinutes: Math.round(hours * 60), startedAt: stamp, activeSince: stamp, pausedAt: null, accumulatedActiveMs: 0, accumulatedPausedMs: 0, status: 'running', updatedAt: stamp, goals: [] });
    setNow(Date.now());
    setShowSetup(false);
    setShowPanel(true);
  };

  // Clicking anywhere outside the setup card dismisses it — unless the user
  // is actively typing a custom hour value, in which case only the visible
  // X button (already rendered above) can close it.
  const setupCardRef = useDismissOnOutsideClick<HTMLDivElement>(
    showSetup,
    selectedHours !== 'custom',
    () => setShowSetup(false)
  );

  // The workday panel itself holds no editable input, but its nested "Set
  // goal" sub-form does once a topic is picked — block outside-dismiss only
  // while that's in progress.
  const panelRef = useDismissOnOutsideClick<HTMLDivElement>(
    showPanel,
    !(showGoals && goalTopicId),
    () => setShowPanel(false)
  );

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

  const rankedTopics = useMemo(() => [...topics]
    .filter(topic => topic.status !== 'posted' && topic.status !== 'scheduled' && !(session?.goals || []).some(goal => goal.topicId === topic.id))
    .sort((a, b) => {
      const nowTime = Date.now();
      const urgency = (topic: Topic) => topic.blockedReason ? 0 : topic.dueDate && new Date(topic.dueDate).getTime() < nowTime ? 1 : topic.dueDate ? 2 : 3;
      const due = (topic: Topic) => topic.dueDate ? new Date(topic.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return urgency(a) - urgency(b) || due(a) - due(b) || a.priority - b.priority;
    }), [topics, session?.goals]);

  const selectedTopic = rankedTopics.find(topic => topic.id === goalTopicId);
  const availableTargets = selectedTopic ? goalStages.filter(stage => stageOrder.indexOf(stage) > stageOrder.indexOf(selectedTopic.status)) : goalStages;
  const chooseTopic = (topicId: string) => {
    setLastGoalAdded('');
    setGoalTopicId(topicId);
    const topic = rankedTopics.find(item => item.id === topicId);
    const nextTarget = topic ? goalStages.find(stage => stageOrder.indexOf(stage) > stageOrder.indexOf(topic.status)) : undefined;
    if (nextTarget) setGoalTarget(nextTarget);
  };
  const addGoal = () => {
    if (!selectedTopic || !availableTargets.includes(goalTarget)) return;
    const stamp = new Date().toISOString();
    setSession(current => current ? { ...current, goals: [...(current.goals || []), { id: `goal-${Date.now()}`, topicId: selectedTopic.id, targetStatus: goalTarget, addedAt: stamp }], updatedAt: stamp } : current);
    setLastGoalAdded(selectedTopic.name);
    setGoalTopicId('');
  };
  const removeGoal = (goalId: string) => setSession(current => current ? { ...current, goals: (current.goals || []).filter(goal => goal.id !== goalId), updatedAt: new Date().toISOString() } : current);
  const goalComplete = (topicId: string, targetStatus: typeof goalStages[number]) => {
    const topic = topics.find(item => item.id === topicId);
    return Boolean(topic && stageOrder.indexOf(topic.status) >= stageOrder.indexOf(targetStatus));
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
            <motion.div ref={setupCardRef} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} className="w-full max-w-md rounded-2xl border border-cyan-900/50 bg-neutral-950 p-5 shadow-[0_0_50px_rgba(6,182,212,.12)]">
              <div className="flex items-center justify-between"><div><h2 className="text-base font-bold text-white">Start the day</h2><p className="mt-1 text-[10px] text-neutral-500">Set today&apos;s active work quota.</p></div><button onClick={() => setShowSetup(false)} className="p-1 text-neutral-500 hover:text-white"><X className="h-4 w-4" /></button></div>
              <div className="mt-5 grid grid-cols-4 gap-2">{([5, 8, 10, 'custom'] as const).map(value => <button key={value} onClick={() => setSelectedHours(value)} className={`rounded-lg border px-2 py-3 font-mono text-[10px] font-bold uppercase ${selectedHours === value ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300' : 'border-neutral-800 bg-neutral-900/50 text-neutral-500'}`}>{value === 'custom' ? 'Custom' : `${value}h`}</button>)}</div>
              {selectedHours === 'custom' && <label className="mt-4 block text-[9px] uppercase text-neutral-500">Hours<input type="number" min="0.25" max="24" step="0.25" value={customHours} onChange={event => setCustomHours(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white" /></label>}
              <button onClick={startDay} className="mt-5 w-full rounded-lg bg-cyan-500 py-2.5 text-xs font-bold text-black hover:bg-cyan-400">Start timer</button>
            </motion.div>
          </div>
        )}

        {session && showPanel && (
          <motion.div ref={panelRef} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="fixed right-4 top-28 z-[90] max-h-[calc(100vh-8rem)] w-[min(380px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950/98 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-sm font-bold text-white"><span className={`h-2 w-2 rounded-full ${session.status === 'paused' ? 'bg-amber-400' : 'animate-pulse bg-emerald-400'}`} />Workday timer</div><div className="mt-1 text-[9px] uppercase text-neutral-600">Started {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div><button onClick={() => setShowPanel(false)} className="text-neutral-600 hover:text-white"><X className="h-4 w-4" /></button></div>
            <div className="mt-4 text-center font-mono text-3xl font-black text-white">{formatDuration(metrics.active)}</div>
            <div className="mt-1 text-center text-[9px] uppercase text-neutral-500">active work recorded</div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-900"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all" style={{ width: `${metrics.progress}%` }} /></div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-neutral-900/60 p-2"><div className="text-xs font-bold text-emerald-300">{metrics.progress.toFixed(1)}%</div><div className="mt-1 text-[7px] uppercase text-neutral-600">quota filled</div></div><div className="rounded-lg bg-neutral-900/60 p-2"><div className="text-xs font-bold text-cyan-300">{formatDuration(metrics.remaining)}</div><div className="mt-1 text-[7px] uppercase text-neutral-600">remaining</div></div><div className="rounded-lg bg-neutral-900/60 p-2"><div className="text-xs font-bold text-amber-300">{formatDuration(metrics.paused)}</div><div className="mt-1 text-[7px] uppercase text-neutral-600">paused</div></div></div>
            <div className="mt-4 rounded-xl border border-neutral-900 bg-neutral-900/25 p-3">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[10px] font-bold text-neutral-300"><Target className="h-3.5 w-3.5 text-purple-400" />Today&apos;s topic goals</div><button onClick={() => setShowGoals(value => !value)} className="flex items-center gap-1 rounded-md border border-purple-900/50 bg-purple-950/25 px-2 py-1 text-[8px] font-bold text-purple-300 hover:border-purple-700">{showGoals ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{showGoals ? 'Close' : 'Set goal'}</button></div>
              {(session.goals || []).filter(goal => topics.some(t => t.id === goal.topicId)).length ? <div className="mt-2 space-y-2">{(session.goals || []).map(goal => {
                const topic = topics.find(t => t.id === goal.topicId);
                if (!topic) return null;
                const complete = goalComplete(goal.topicId, goal.targetStatus);
                return <div key={goal.id} className="flex items-center gap-2 rounded-lg bg-neutral-950/70 px-2.5 py-2"><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${complete ? 'border-emerald-500 bg-emerald-500 text-black' : 'border-neutral-700 text-transparent'}`}><Check className="h-3 w-3" /></span><span className="min-w-0 flex-1"><span className={`block truncate text-[9px] font-semibold ${complete ? 'text-neutral-500 line-through' : 'text-neutral-200'}`}>{topic.name}</span><span className="block text-[7px] uppercase text-neutral-600">Reach {goal.targetStatus}</span></span><button onClick={() => removeGoal(goal.id)} className="text-neutral-700 hover:text-rose-400" aria-label={`Remove goal for ${topic.name}`}><Trash2 className="h-3 w-3" /></button></div>;
              })}</div> : <div className="mt-2 text-[8px] text-neutral-600">Optional - no topic goal set.</div>}
              <AnimatePresence initial={false}>
                {showGoals && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="mt-3 space-y-3 border-t border-purple-900/30 pt-3">
                  {lastGoalAdded && <div className="flex items-center gap-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-2.5 py-2 text-[8px] text-emerald-300"><Check className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0"><strong className="font-bold">{lastGoalAdded}</strong> added. Select another topic or close.</span></div>}
                  <label className="block text-[7px] font-bold uppercase tracking-wider text-neutral-500">Topic<select value={goalTopicId} onChange={event => chooseTopic(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-2 text-[9px] font-semibold text-white"><option value="">Select a ranked topic</option>{rankedTopics.map(topic => <option key={topic.id} value={topic.id}>P{topic.priority} - {topic.name} - {topic.status}{topic.dueDate ? ` - due ${new Date(topic.dueDate).toLocaleDateString()}` : ''}</option>)}</select></label>
                  {selectedTopic && <div className="rounded-lg border border-neutral-900 bg-neutral-950/70 p-2.5"><div className="truncate text-[9px] font-semibold text-white">{selectedTopic.name}</div><div className="mt-1 flex flex-wrap gap-1 text-[7px] uppercase"><span className="rounded bg-blue-950/40 px-1.5 py-0.5 text-blue-300">Current {selectedTopic.status}</span><span className="rounded bg-cyan-950/40 px-1.5 py-0.5 text-cyan-300">Priority {selectedTopic.priority}</span>{selectedTopic.dueDate && <span className="rounded bg-rose-950/40 px-1.5 py-0.5 text-rose-300">Due {new Date(selectedTopic.dueDate).toLocaleDateString()}</span>}{selectedTopic.blockedReason && <span className="rounded bg-rose-950/50 px-1.5 py-0.5 text-rose-300">Blocked</span>}</div></div>}
                  <label className="block text-[7px] font-bold uppercase tracking-wider text-neutral-500">Milestone to reach today<select disabled={!selectedTopic} value={goalTarget} onChange={event => setGoalTarget(event.target.value as typeof goalStages[number])} className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-2.5 py-2 text-[9px] font-semibold capitalize text-white disabled:opacity-40">{availableTargets.map(stage => <option key={stage} value={stage}>{stage}</option>)}</select></label>
                  <button disabled={!selectedTopic} onClick={addGoal} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-500 py-2 text-[9px] font-bold text-black hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-3 w-3" />Add today&apos;s goal</button>
                  {!rankedTopics.length && <div className="text-center text-[8px] text-neutral-600">No unfinished topics available.</div>}
                </div></motion.div>}
              </AnimatePresence>
            </div>
            <div className="mt-4 flex gap-2"><button onClick={session.status === 'paused' ? resume : pause} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[10px] font-bold ${session.status === 'paused' ? 'bg-emerald-500 text-black' : 'bg-amber-500 text-black'}`}>{session.status === 'paused' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}{session.status === 'paused' ? 'Resume work' : 'Pause work'}</button><button onClick={reset} title="Reset day" className="rounded-lg border border-neutral-800 px-3 text-neutral-500 hover:border-rose-900 hover:text-rose-400"><RotateCcw className="h-4 w-4" /></button></div>
          </motion.div>
        )}

      </AnimatePresence>
    </>
  );
}

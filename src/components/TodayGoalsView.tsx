import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Pause, Play, Plus, RotateCcw, SlidersHorizontal, Square, Target, Trash2 } from 'lucide-react';
import type { TaskTimerRecord, TaskTimerStage, Topic, WorkdaySession } from '../types';

interface TodayGoalsViewProps {
  topics: Topic[];
  session: WorkdaySession | null;
  setSession: React.Dispatch<React.SetStateAction<WorkdaySession | null>>;
  onEndSession: () => void;
  taskTimers: TaskTimerRecord[];
  onStartTaskTimer: (topicId: string, stage: TaskTimerStage) => void;
  onPauseTaskTimer: () => void;
  onResumeTaskTimer: () => void;
  onStopTaskTimer: (endReason: 'done' | 'deferred', productivityScore?: number) => void;
  onPauseMainTimer: () => void;
  onResumeMainTimer: () => void;
}

const goalStages = ['scripted', 'shot', 'edited', 'scheduled', 'posted'] as const;
const stageOrder = ['topic', ...goalStages] as const;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const taskStageLabels: Record<TaskTimerStage, string> = { script: 'Scripting', shoot: 'Shooting', edit: 'Editing', schedule: 'Scheduling', post: 'Publishing' };
const nextTaskStage: Record<Topic['status'], TaskTimerStage | null> = { topic: 'script', scripted: 'shoot', shot: 'edit', edited: 'schedule', scheduled: 'post', posted: null };
const formatDuration = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

const priorityDetails = (priority: Topic['priority']) => ({
  1: { label: 'Neutral', style: 'border-neutral-700 bg-neutral-900 text-neutral-300' },
  2: { label: 'Attention', style: 'border-yellow-800/60 bg-yellow-950/30 text-yellow-300' },
  3: { label: 'Hot topic', style: 'border-orange-800/60 bg-orange-950/30 text-orange-300' },
  4: { label: 'Important', style: 'border-blue-800/60 bg-blue-950/30 text-blue-300' },
  5: { label: 'Automatic', style: 'border-purple-800/60 bg-purple-950/30 text-purple-300' }
} as const)[priority];

export default function TodayGoalsView({ topics, session, setSession, onEndSession, taskTimers, onStartTaskTimer, onPauseTaskTimer, onResumeTaskTimer, onStopTaskTimer, onPauseMainTimer, onResumeMainTimer }: TodayGoalsViewProps) {
  const [now, setNow] = useState(Date.now());
  const [topicId, setTopicId] = useState('');
  const [target, setTarget] = useState<typeof goalStages[number]>('scripted');
  const [sortBy, setSortBy] = useState<'priority' | 'due' | 'stage'>('priority');
  const [channelFilter, setChannelFilter] = useState<'All' | 'LearnDriven' | 'DecodeWorthy'>('All');

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

  // Live countdown to a topic's due date/time, matching WorkdayTimer's
  // guidance logic so both views read the same "how much attention does
  // this need right now" signal.
  const topicUrgency = (topic: Topic) => {
    if (topic.blockedReason) return { label: 'Blocked', tone: 'border-rose-800/60 bg-rose-950/25 text-rose-300', dot: 'bg-rose-400 animate-pulse', rank: 0 };
    if (!topic.dueDate) return { label: 'No deadline', tone: 'border-neutral-800 bg-neutral-900/50 text-neutral-400', dot: 'bg-neutral-600', rank: 3 };
    const datePart = topic.dueDate.split('T')[0];
    const embeddedTime = topic.dueDate.includes('T') ? topic.dueDate.split('T')[1]?.slice(0, 5) : '';
    const due = new Date(`${datePart}T${topic.scheduledTime || embeddedTime || '23:59'}:00`).getTime();
    const hours = (due - now) / 36e5;
    const label = hours <= 0 ? `${Math.max(1, Math.ceil(Math.abs(hours)))}h overdue` : hours < 1 ? `${Math.max(1, Math.ceil(hours * 60))}m left` : hours < 48 ? `${Math.ceil(hours)}h left` : `${Math.ceil(hours / 24)}d left`;
    if (hours <= 8) return { label, tone: 'border-rose-800/60 bg-rose-950/25 text-rose-300', dot: 'bg-rose-400 animate-pulse', rank: 1 };
    if (hours <= 24) return { label, tone: 'border-amber-800/60 bg-amber-950/20 text-amber-300', dot: 'bg-amber-400', rank: 2 };
    return { label, tone: 'border-cyan-900/50 bg-cyan-950/15 text-cyan-300', dot: 'bg-cyan-500', rank: 2 };
  };

  // Only ever treat a goal as real if its topic still exists — topicId is
  // the sole reference; a goal for a deleted topic isn't a goal anymore.
  const liveGoals = (session?.goals || []).filter(goal => topics.some(t => t.id === goal.topicId));
  const completedCount = liveGoals.filter(complete).length;

  const goals = useMemo(() => {
    const filtered = liveGoals.filter(goal => {
      if (channelFilter === 'All') return true;
      const topic = topics.find(t => t.id === goal.topicId);
      return topic?.channel === channelFilter;
    });
    return [...filtered].sort((a, b) => {
      const topicA = topics.find(t => t.id === a.topicId)!;
      const topicB = topics.find(t => t.id === b.topicId)!;
      if (sortBy === 'priority') return topicB.priority - topicA.priority;
      if (sortBy === 'stage') return stageOrder.indexOf(topicA.status) - stageOrder.indexOf(topicB.status);
      // due
      const urgencyRank = (t: Topic) => topicUrgency(t).rank;
      const dueRank = urgencyRank(topicA) - urgencyRank(topicB);
      if (dueRank !== 0) return dueRank;
      const dueTime = (t: Topic) => t.dueDate ? new Date(t.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return dueTime(topicA) - dueTime(topicB);
    });
  }, [liveGoals, topics, sortBy, channelFilter, now]);

  const ranked = useMemo(() => [...topics]
    .filter(topic => topic.status !== 'scheduled' && topic.status !== 'posted' && !liveGoals.some(goal => goal.topicId === topic.id))
    .sort((a, b) => {
      const urgency = (topic: Topic) => topic.blockedReason ? 0 : topic.dueDate && new Date(topic.dueDate).getTime() < Date.now() ? 1 : topic.dueDate ? 2 : 3;
      const due = (topic: Topic) => topic.dueDate ? new Date(topic.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return urgency(a) - urgency(b) || due(a) - due(b) || a.priority - b.priority;
    }), [topics, liveGoals]);
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
    setSession({ ...session, goals: [...(session.goals || []), { id: `goal-${Date.now()}`, topicId: selected.id, targetStatus: target, addedAt: stamp }], updatedAt: stamp });
    setTopicId('');
  };
  const removeGoal = (id: string) => setSession(current => {
    if (!current) return current;
    const goal = (current.goals || []).find(g => g.id === id);
    const topic = goal ? topics.find(t => t.id === goal.topicId) : undefined;
    const droppedEntry = goal && topic ? [{
      id: goal.id, topicId: goal.topicId, topicName: topic.name,
      targetStatus: goal.targetStatus, droppedAt: new Date().toISOString()
    }] : [];
    return {
      ...current,
      goals: (current.goals || []).filter(g => g.id !== id),
      droppedGoals: [...(current.droppedGoals || []), ...droppedEntry],
      updatedAt: new Date().toISOString()
    };
  });
  const pauseResume = () => session?.status === 'paused' ? onResumeMainTimer() : onPauseMainTimer();
  const extendSession = (minutes: number) => setSession(current => current ? {
    ...current,
    targetMinutes: current.targetMinutes + minutes,
    extensionMinutes: (current.extensionMinutes || 0) + minutes,
    updatedAt: new Date().toISOString()
  } : current);
  const endSession = () => {
    if (window.confirm('End today\'s work session? It will be saved to Sessions with everything achieved, dropped, or still open.')) {
      onEndSession();
    }
  };
  const timerActiveMs = (timer: TaskTimerRecord) => timer.accumulatedActiveMs + (
    timer.status === 'running' && timer.activeSince ? Math.max(0, now - new Date(timer.activeSince).getTime()) : 0
  );
  const timerPausedMs = (timer: TaskTimerRecord) => timer.accumulatedPausedMs + (
    timer.status === 'paused' && timer.pausedAt ? Math.max(0, now - new Date(timer.pausedAt).getTime()) : 0
  );

  if (!session) return <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-8 text-center"><Target className="mx-auto h-8 w-8 text-purple-400" /><h1 className="mt-3 text-xl font-bold text-white">Today&apos;s Goals</h1><p className="mt-2 text-sm text-neutral-500">Start the day from the header to create today&apos;s time budget and topic goals.</p></div>;

  return <div className="space-y-5 pb-10">
    <section className="rounded-2xl border border-purple-900/35 bg-[linear-gradient(120deg,rgba(20,10,32,.95),rgba(4,16,20,.95))] p-5 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-purple-400"><Target className="h-4 w-4" />Daily execution</div>
          <h1 className="mt-2 text-2xl font-bold text-white">Today&apos;s Goals</h1>
          <p className="mt-1 text-sm text-neutral-500">Started {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={pauseResume} className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-bold ${session.status === 'paused' ? 'bg-emerald-500 text-black' : 'bg-amber-500 text-black'}`}>{session.status === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{session.status === 'paused' ? 'Resume work' : 'Pause work'}</button>
          <button onClick={endSession} title="End session" className="flex items-center justify-center rounded-xl border border-neutral-700 px-3 py-3 text-neutral-400 hover:border-rose-800 hover:text-rose-400"><RotateCcw className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-900"><div className="h-full rounded-full bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400" style={{ width: `${metrics.progress}%` }} /></div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">{[
        ['Active', formatDuration(metrics.active), 'text-emerald-300'], ['Remaining', formatDuration(metrics.remaining), 'text-cyan-300'], ['Paused', formatDuration(metrics.paused), 'text-amber-300'], ['Quota', `${metrics.progress.toFixed(1)}%`, 'text-purple-300'], ['Goals', `${completedCount}/${liveGoals.length}`, 'text-white']
      ].map(([label, value, color]) => <div key={label} className="rounded-xl border border-neutral-900 bg-neutral-950/60 p-3"><div className={`text-lg font-black ${color}`}>{value}</div><div className="mt-1 text-[8px] uppercase text-neutral-600">{label}</div></div>)}</div>
      {metrics.remaining > 0 && metrics.remaining < TWO_HOURS_MS && (
        <div className="mt-4 rounded-xl border border-amber-800/50 bg-amber-950/15 p-3">
          <div className="text-[9px] font-bold uppercase text-amber-300">Less than 2h left in this session — extend it?</div>
          <div className="mt-2 flex gap-2">
            {[30, 60, 120].map(minutes => (
              <button key={minutes} onClick={() => extendSession(minutes)} className="rounded-lg border border-amber-700/60 bg-amber-500/10 px-4 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/20">
                +{minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>

    <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">Execution list</h2>
            <p className="mt-1 text-[10px] text-neutral-500">Live progress from current stage to today&apos;s milestone.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-purple-300">{completedCount}/{liveGoals.length} complete</span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-900 bg-neutral-950/60 p-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-neutral-500 shrink-0 ml-1" />
          <div className="flex items-center gap-1">
            <span className="text-[8px] uppercase text-neutral-600 mr-1">Sort</span>
            {(['priority', 'due', 'stage'] as const).map(option => (
              <button key={option} onClick={() => setSortBy(option)} className={`rounded px-2 py-1 text-[9px] font-bold uppercase transition ${sortBy === option ? 'bg-purple-500 text-black' : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'}`}>{option}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[8px] uppercase text-neutral-600 mr-1">Channel</span>
            {(['All', 'LearnDriven', 'DecodeWorthy'] as const).map(option => (
              <button key={option} onClick={() => setChannelFilter(option)} className={`rounded px-2 py-1 text-[9px] font-bold uppercase transition ${channelFilter === option ? 'bg-cyan-500 text-black' : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'}`}>{option}</button>
            ))}
          </div>
        </div>

        {goals.length ? <div className="space-y-3">{goals.map((goal, index) => {
          const topic = topics.find(item => item.id === goal.topicId);
          if (!topic) return null;
          const done = complete(goal);
          const urgency = topicUrgency(topic);
          const priority = priorityDetails(topic.priority);
          const topicTimers = taskTimers.filter(timer => timer.topicId === topic.id && (!timer.workdaySessionId || timer.workdaySessionId === session.startedAt));
          const activeTopicTimer = topicTimers.find(timer => timer.status === 'running' || timer.status === 'paused');
          const totalTaskActive = topicTimers.reduce((total, timer) => total + timerActiveMs(timer), 0);
          const totalTaskPaused = topicTimers.reduce((total, timer) => total + timerPausedMs(timer), 0);
          const totalBreaks = topicTimers.reduce((total, timer) => total + timer.breaksCount, 0);
          const completedTimers = topicTimers.filter(timer => timer.status === 'completed' && timer.endReason === 'done');
          const ratedTimers = topicTimers.filter(timer => timer.productivityScore);
          const averageProductivity = ratedTimers.length ? ratedTimers.reduce((total, timer) => total + (timer.productivityScore || 0), 0) / ratedTimers.length * 10 : null;
          const suggestedStage = nextTaskStage[topic.status];
          return <div key={goal.id} className={`rounded-xl border p-4 ${done ? 'border-emerald-900/40 bg-emerald-950/10' : 'border-neutral-850 bg-neutral-900/25'}`}>
            <div className="flex items-start gap-3">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${done ? 'bg-emerald-500 text-black' : 'bg-neutral-950 text-neutral-500'}`}>{done ? <Check className="h-4 w-4" /> : String(index + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`relative flex h-2 w-2 shrink-0 rounded-full ${urgency.dot}`} />
                  <div className={`truncate text-sm font-bold ${done ? 'text-emerald-300' : 'text-white'}`}>{topic.name}</div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[8px] uppercase">
                  <span className="rounded bg-neutral-950 px-2 py-1 text-neutral-400 border border-neutral-800">{topic.channel}</span>
                  <span className="rounded bg-blue-950/35 px-2 py-1 text-blue-300">{topic.status} → {goal.targetStatus}</span>
                  <span className={`rounded border px-2 py-1 font-bold ${priority.style}`}>P{topic.priority} · {priority.label}</span>
                  <span className={`rounded border px-2 py-1 font-bold ${urgency.tone}`}>{urgency.label}</span>
                  {topic.blockedReason && <span className="rounded bg-rose-950/40 px-2 py-1 text-rose-300 border border-rose-900/40">Blocked: {topic.blockedReason}</span>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                  {[
                    ['Task active', formatDuration(totalTaskActive), 'text-emerald-300'],
                    ['Task paused', formatDuration(totalTaskPaused), 'text-amber-300'],
                    ['Breaks', String(totalBreaks), 'text-cyan-300'],
                    ['Stages done', String(completedTimers.length), 'text-purple-300'],
                    ['Productivity', averageProductivity === null ? '--' : `${averageProductivity.toFixed(0)}%`, 'text-rose-300']
                  ].map(([label, value, color]) => <div key={label} className="rounded-lg border border-neutral-900 bg-neutral-950/70 p-2"><div className={`font-mono text-xs font-black ${color}`}>{value}</div><div className="mt-1 text-[7px] uppercase text-neutral-600">{label}</div></div>)}
                </div>

                <div className="mt-3 rounded-xl border border-neutral-900 bg-neutral-950/55 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[9px] font-bold uppercase text-neutral-400"><Clock3 className="h-3.5 w-3.5 text-emerald-400" />Goal sessions</div>
                    {activeTopicTimer ? (
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-[9px] font-bold ${activeTopicTimer.status === 'running' ? 'text-emerald-300' : 'text-amber-300'}`}>{taskStageLabels[activeTopicTimer.stage]} {formatDuration(timerActiveMs(activeTopicTimer))}</span>
                        <button onClick={activeTopicTimer.status === 'running' ? onPauseTaskTimer : onResumeTaskTimer} className="rounded border border-neutral-800 p-1.5 text-amber-300 hover:bg-neutral-900" title={activeTopicTimer.status === 'running' ? 'Pause this goal timer only' : 'Resume this goal timer'}>{activeTopicTimer.status === 'running' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}</button>
                        <button onClick={() => onStopTaskTimer('deferred')} className="rounded border border-neutral-800 p-1.5 text-rose-300 hover:bg-neutral-900" title="Stop and defer this goal timer only"><Square className="h-3 w-3" /></button>
                      </div>
                    ) : suggestedStage && !done ? (
                      <button disabled={session.status !== 'running'} onClick={() => onStartTaskTimer(topic.id, suggestedStage)} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[9px] font-bold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"><Play className="h-3 w-3 fill-current" />Start {taskStageLabels[suggestedStage]}</button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {(['script', 'shoot', 'edit', 'schedule', 'post'] as TaskTimerStage[]).map(stage => {
                      const sessions = topicTimers.filter(timer => timer.stage === stage);
                      const activeMs = sessions.reduce((total, timer) => total + timerActiveMs(timer), 0);
                      const pausedMs = sessions.reduce((total, timer) => total + timerPausedMs(timer), 0);
                      const latest = [...sessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
                      return <div key={stage} className={`rounded-lg border p-2.5 ${latest?.status === 'running' ? 'border-emerald-700/60 bg-emerald-950/20' : latest?.status === 'paused' ? 'border-amber-800/60 bg-amber-950/15' : 'border-neutral-900 bg-neutral-950/60'}`}>
                        <div className="flex items-center justify-between"><span className="text-[8px] font-bold uppercase text-neutral-300">{taskStageLabels[stage]}</span><span className="text-[7px] uppercase text-neutral-600">{sessions.length} session{sessions.length === 1 ? '' : 's'}</span></div>
                        <div className="mt-1.5 font-mono text-xs font-black text-emerald-300">{formatDuration(activeMs)}</div>
                        <div className="mt-1 text-[7px] text-neutral-600">Paused {formatDuration(pausedMs)} · {sessions.reduce((total, timer) => total + timer.breaksCount, 0)} breaks</div>
                        {latest?.completedAt && <div className="mt-1 text-[7px] text-neutral-600">Last completed {new Date(latest.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                      </div>;
                    })}
                  </div>
                </div>
              </div>
              <button onClick={() => removeGoal(goal.id)} className="text-neutral-700 hover:text-rose-400 shrink-0"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>;
        })}</div> : <div className="rounded-xl border border-dashed border-neutral-800 py-12 text-center text-sm text-neutral-600">{liveGoals.length ? 'No goals match this filter.' : 'No topic goals set for today.'}</div>}
      </div>

      <div className="h-fit rounded-2xl border border-purple-900/30 bg-neutral-950/70 p-5"><div className="flex items-center gap-2 text-sm font-bold text-white"><Plus className="h-4 w-4 text-purple-400" />Add a goal</div><p className="mt-1 text-[9px] text-neutral-600">Scheduled and posted topics are excluded.</p><div className="mt-4 space-y-3"><label className="block text-[8px] font-bold uppercase text-neutral-500">Ranked topic<select value={topicId} onChange={event => chooseTopic(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-[10px] font-semibold text-white"><option value="">Select topic</option>{ranked.map(topic => <option key={topic.id} value={topic.id}>P{topic.priority} - {topic.name} - {topic.status}</option>)}</select></label>{selected && <div className="rounded-lg bg-neutral-900/60 p-3"><div className="truncate text-[10px] font-semibold text-white">{selected.name}</div><div className="mt-1 text-[8px] uppercase text-neutral-600">{selected.channel} - current {selected.status}{selected.dueDate ? ` - due ${new Date(selected.dueDate).toLocaleDateString()}` : ''}</div></div>}<label className="block text-[8px] font-bold uppercase text-neutral-500">Milestone<select disabled={!selected} value={target} onChange={event => setTarget(event.target.value as typeof goalStages[number])} className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-[10px] capitalize text-white disabled:opacity-40">{targets.map(stage => <option key={stage}>{stage}</option>)}</select></label><button disabled={!selected} onClick={addGoal} className="w-full rounded-lg bg-purple-500 py-2.5 text-[10px] font-bold text-black hover:bg-purple-400 disabled:opacity-40">Add today&apos;s goal</button></div></div>
    </section>
  </div>;
}

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Clock3, Pause, Pencil, Play, Plus, RotateCcw, Target, Trash2, X } from 'lucide-react';
import type { Topic, WorkdaySession } from '../types';
import { useDismissOnOutsideClick } from '../hooks/useDismissOnOutsideClick';
import EndSessionModal from './EndSessionModal';

interface WorkdayTimerProps {
  session: WorkdaySession | null;
  setSession: React.Dispatch<React.SetStateAction<WorkdaySession | null>>;
  topics: Topic[];
  onEndSession: () => void;
  onExternalPause?: () => void;
  onExternalResume?: () => void;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const PRODUCTIVITY_PROMPT_THRESHOLD_MS = 10 * 60 * 1000;

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
const stageLabel: Record<string, string> = { topic: 'topic', scripted: 'script', shot: 'shoot', edited: 'edit', scheduled: 'schedule', posted: 'post' };
const stagesBetween = (from: string, to: string) => {
  const start = stageOrder.indexOf(from as typeof stageOrder[number]);
  const end = stageOrder.indexOf(to as typeof stageOrder[number]);
  if (start < 0 || end < 0 || end <= start) return [];
  return stageOrder.slice(start + 1, end + 1).map(s => stageLabel[s] || s);
};

export default function WorkdayTimer({ session, setSession, topics, onEndSession, onExternalPause, onExternalResume }: WorkdayTimerProps) {
  const [now, setNow] = useState(Date.now());
  const [showSetup, setShowSetup] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [selectedHours, setSelectedHours] = useState<number | 'custom'>(5);
  const [customHours, setCustomHours] = useState('6');
  const [setupStep, setSetupStep] = useState<'budget' | 'goals'>('budget');
  const [draftGoals, setDraftGoals] = useState<NonNullable<WorkdaySession['goals']>>([]);
  const [showGoals, setShowGoals] = useState(false);
  const [goalTopicId, setGoalTopicId] = useState('');
  const [goalTarget, setGoalTarget] = useState<typeof goalStages[number]>('scripted');
  const [lastGoalAdded, setLastGoalAdded] = useState('');
  const [topicPickerOpen, setTopicPickerOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [showProductivityPrompt, setShowProductivityPrompt] = useState(false);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);

  useEffect(() => {
    if (!session || session.status === 'completed') return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session?.status]);

  const metrics = useMemo(() => {
    if (!session) return { active: 0, productive: 0, productivePercent: 100, paused: 0, target: 0, remaining: 0, progress: 0 };
    const currentSegment = session.status === 'running' && session.activeSince ? Math.max(0, now - new Date(session.activeSince).getTime()) : 0;
    const active = session.accumulatedActiveMs + currentSegment;
    const productive = (session.productiveActiveMs ?? session.accumulatedActiveMs) + currentSegment;
    const paused = session.accumulatedPausedMs + (session.status === 'paused' && session.pausedAt ? Math.max(0, now - new Date(session.pausedAt).getTime()) : 0);
    const target = session.targetMinutes * 60_000;
    return { active, productive, productivePercent: active ? Math.min(100, (productive / active) * 100) : 100, paused, target, remaining: Math.max(0, target - active), progress: target ? Math.min(100, (active / target) * 100) : 0 };
  }, [session, now]);

  const openSetup = () => {
    setSetupStep('budget');
    setDraftGoals([]);
    setGoalTopicId('');
    setLastGoalAdded('');
    setShowSetup(true);
  };

  const startDay = (goals: NonNullable<WorkdaySession['goals']>) => {
    const hours = selectedHours === 'custom' ? Number(customHours) : selectedHours;
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return;
    const stamp = new Date().toISOString();
    setSession({ dateKey: todayKey(), targetMinutes: Math.round(hours * 60), startedAt: stamp, activeSince: stamp, pausedAt: null, accumulatedActiveMs: 0, productiveActiveMs: 0, productivityRatings: [], accumulatedPausedMs: 0, status: 'running', updatedAt: stamp, goals });
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

  useEffect(() => {
    if (showSetup) setupCardRef.current?.scrollTo({ top: 0 });
  }, [showSetup, setupStep]);

  // The workday panel itself holds no editable input, but its nested "Set
  // goal" sub-form does once a topic is picked — block outside-dismiss only
  // while that's in progress.
  const panelRef = useDismissOnOutsideClick<HTMLDivElement>(
    showPanel,
    !(showGoals && goalTopicId),
    () => setShowPanel(false)
  );

  const commitPause = (productivityScore: number) => {
    setSession(current => {
      if (!current || current.status !== 'running' || !current.activeSince) return current;
      const stamp = new Date();
      const segmentActiveMs = Math.max(0, stamp.getTime() - new Date(current.activeSince).getTime());
      return {
        ...current,
        accumulatedActiveMs: current.accumulatedActiveMs + segmentActiveMs,
        productiveActiveMs: (current.productiveActiveMs ?? current.accumulatedActiveMs) + segmentActiveMs * (productivityScore / 10),
        productivityRatings: segmentActiveMs > PRODUCTIVITY_PROMPT_THRESHOLD_MS
          ? [...(current.productivityRatings || []), { recordedAt: stamp.toISOString(), segmentActiveMs, score: productivityScore }]
          : current.productivityRatings,
        activeSince: null,
        pausedAt: stamp.toISOString(),
        status: 'paused',
        updatedAt: stamp.toISOString(),
        breaksCount: (current.breaksCount || 0) + 1
      };
    });
    onExternalPause?.();
  };

  const pause = () => {
    if (!session || session.status !== 'running' || !session.activeSince) return;
    const segmentActiveMs = Math.max(0, Date.now() - new Date(session.activeSince).getTime());
    if (segmentActiveMs > PRODUCTIVITY_PROMPT_THRESHOLD_MS) {
      setShowProductivityPrompt(true);
      return;
    }
    commitPause(10);
  };

  const resume = () => {
    if (onExternalResume) { onExternalResume(); return; }
    setSession(current => {
      if (!current || current.status !== 'paused') return current;
      const stamp = new Date();
      return { ...current, accumulatedPausedMs: current.accumulatedPausedMs + (current.pausedAt ? Math.max(0, stamp.getTime() - new Date(current.pausedAt).getTime()) : 0), activeSince: stamp.toISOString(), pausedAt: null, status: 'running', updatedAt: stamp.toISOString() };
    });
  };

  const endSession = () => {
    setShowEndConfirmation(true);
  };

  const extendSession = (minutes: number) => {
    setSession(current => current ? {
      ...current,
      targetMinutes: current.targetMinutes + minutes,
      extensionMinutes: (current.extensionMinutes || 0) + minutes,
      updatedAt: new Date().toISOString()
    } : current);
  };

  const assignedGoals = session?.goals || draftGoals;
  const rankedTopics = useMemo(() => [...topics]
    .filter(topic => topic.status !== 'posted' && topic.status !== 'scheduled' && !assignedGoals.some(goal => goal.topicId === topic.id))
    .sort((a, b) => {
      const nowTime = Date.now();
      const urgency = (topic: Topic) => topic.blockedReason ? 0 : topic.dueDate && new Date(topic.dueDate).getTime() < nowTime ? 1 : topic.dueDate ? 2 : 3;
      const due = (topic: Topic) => topic.dueDate ? new Date(topic.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return urgency(a) - urgency(b) || due(a) - due(b) || a.priority - b.priority;
    }), [topics, assignedGoals]);

  const selectedTopic = topics.find(topic => topic.id === goalTopicId);
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
    const goal = { id: `goal-${Date.now()}`, topicId: selectedTopic.id, targetStatus: goalTarget, addedAt: stamp };
    if (session) setSession(current => current ? { ...current, goals: editingGoalId
      ? (current.goals || []).map(existing => existing.id === editingGoalId ? { ...existing, topicId: goal.topicId, targetStatus: goal.targetStatus } : existing)
      : [...(current.goals || []), goal], updatedAt: stamp } : current);
    else setDraftGoals(current => [...current, goal]);
    setLastGoalAdded(selectedTopic.name);
    setGoalTopicId('');
    setEditingGoalId(null);
  };
  const removeGoal = (goalId: string) => {
    setSession(current => {
      if (!current) return current;
      const goal = (current.goals || []).find(g => g.id === goalId);
      const topic = goal ? topics.find(t => t.id === goal.topicId) : undefined;
      const droppedEntry = goal && topic ? [{
        id: goal.id, topicId: goal.topicId, topicName: topic.name,
        targetStatus: goal.targetStatus, droppedAt: new Date().toISOString()
      }] : [];
      return {
        ...current,
        goals: (current.goals || []).filter(g => g.id !== goalId),
        droppedGoals: [...(current.droppedGoals || []), ...droppedEntry],
        updatedAt: new Date().toISOString()
      };
    });
    if (editingGoalId === goalId) { setEditingGoalId(null); setGoalTopicId(''); }
  };
  const editGoal = (goal: NonNullable<WorkdaySession['goals']>[number]) => {
    setEditingGoalId(goal.id);
    setGoalTopicId(goal.topicId);
    setGoalTarget(goal.targetStatus);
    setLastGoalAdded('');
    setShowGoals(true);
  };
  const goalComplete = (topicId: string, targetStatus: typeof goalStages[number]) => {
    const topic = topics.find(item => item.id === topicId);
    return Boolean(topic && stageOrder.indexOf(topic.status) >= stageOrder.indexOf(targetStatus));
  };

  const topicGuidance = (topic: Topic) => {
    const nextAction = ({ topic: 'Start scripting', scripted: 'Record the video', shot: 'Begin editing', edited: 'Set the release schedule', scheduled: 'Ready to publish', posted: 'Complete' } as const)[topic.status];
    if (topic.blockedReason) return { label: 'Blocked now', detail: topic.blockedReason, action: `Unblock, then ${nextAction.toLowerCase()}`, tone: 'border-rose-800/60 bg-rose-950/25 text-rose-300', dot: 'bg-rose-400 animate-pulse' };
    if (!topic.dueDate) return { label: 'No deadline', detail: `${workRemaining(topic)} stages remain`, action: nextAction, tone: 'border-neutral-800 bg-neutral-900/50 text-neutral-400', dot: 'bg-neutral-600' };
    const datePart = topic.dueDate.split('T')[0];
    const embeddedTime = topic.dueDate.includes('T') ? topic.dueDate.split('T')[1]?.slice(0, 5) : '';
    const due = new Date(`${datePart}T${topic.scheduledTime || embeddedTime || '23:59'}:00`).getTime();
    const hours = (due - now) / 36e5;
    const timeLabel = hours <= 0 ? `${Math.max(1, Math.ceil(Math.abs(hours)))}h overdue` : hours < 1 ? `${Math.max(1, Math.ceil(hours * 60))}m left` : hours < 48 ? `${Math.ceil(hours)}h left` : `${Math.ceil(hours / 24)}d left`;
    if (hours <= 8) return { label: timeLabel, detail: `${workRemaining(topic)} stages remain`, action: nextAction, tone: 'border-rose-800/60 bg-rose-950/25 text-rose-300', dot: 'bg-rose-400 animate-pulse' };
    if (hours <= 24) return { label: timeLabel, detail: `${workRemaining(topic)} stages remain`, action: nextAction, tone: 'border-amber-800/60 bg-amber-950/20 text-amber-300', dot: 'bg-amber-400' };
    return { label: timeLabel, detail: `${workRemaining(topic)} stages remain`, action: nextAction, tone: 'border-cyan-900/50 bg-cyan-950/15 text-cyan-300', dot: 'bg-cyan-500' };
  };

  function workRemaining(topic: Topic) {
    return ({ topic: 5, scripted: 4, shot: 3, edited: 2, scheduled: 1, posted: 0 } as const)[topic.status];
  }

  const priorityDetails = (priority: Topic['priority']) => ({
    1: { label: 'Neutral', style: 'border-neutral-700 bg-neutral-900 text-neutral-300' },
    2: { label: 'Attention', style: 'border-yellow-800/60 bg-yellow-950/30 text-yellow-300' },
    3: { label: 'Hot topic', style: 'border-orange-800/60 bg-orange-950/30 text-orange-300' },
    4: { label: 'Important', style: 'border-blue-800/60 bg-blue-950/30 text-blue-300' },
    5: { label: 'Automatic', style: 'border-purple-800/60 bg-purple-950/30 text-purple-300' }
  } as const)[priority];

  const renderTopicPicker = () => (
    <div className="relative mt-1">
      <button type="button" onClick={() => setTopicPickerOpen(open => !open)} aria-expanded={topicPickerOpen} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${topicPickerOpen ? 'border-purple-600 bg-purple-950/20 shadow-[0_0_18px_rgba(168,85,247,.12)]' : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'}`}>
        {selectedTopic ? <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{selectedTopic.name}</span><span className="mt-1 block text-[10px] uppercase text-neutral-500">{selectedTopic.channel} · current {selectedTopic.status}</span></span> : <span className="text-sm font-semibold text-neutral-400">Select a ranked topic</span>}
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-purple-400 transition ${topicPickerOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>{topicPickerOpen && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="absolute inset-x-0 top-full z-[120] mt-1.5 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,.75)] [scrollbar-color:#52525b_#09090b] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-700 [&::-webkit-scrollbar-track]:bg-neutral-950 [&::-webkit-scrollbar]:w-1.5">
        {rankedTopics.map((topic, index) => { const guidance = topicGuidance(topic); const remainingStages = goalStages.filter(stage => stageOrder.indexOf(stage) > stageOrder.indexOf(topic.status)); return <div key={topic.id} className="group rounded-lg border border-transparent bg-neutral-900/45 p-3 transition hover:border-purple-800/60 hover:bg-purple-950/20"><button type="button" onClick={() => { chooseTopic(topic.id); setTopicPickerOpen(false); }} className="w-full text-left">
          <div className="flex items-start gap-3"><span className="mt-0.5 font-mono text-[10px] text-neutral-600">{String(index + 1).padStart(2, '0')}</span><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_8px_currentColor] ${guidance.dot}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-snug text-neutral-100 group-hover:text-white">{topic.name}</span><span className="mt-1.5 flex flex-wrap gap-1"><span className="rounded border border-blue-900/40 bg-blue-950/20 px-2 py-0.5 text-[9px] uppercase text-blue-300">{topic.status}</span><span className="rounded border border-emerald-900/40 bg-emerald-950/20 px-2 py-0.5 text-[9px] uppercase text-emerald-300">{topic.revenueLevel || `P${topic.priority}`}</span><span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase ${guidance.tone}`}>{guidance.label}</span></span><span className="mt-2 block text-[10px] leading-relaxed text-neutral-500"><span className="text-purple-300">Next:</span> {guidance.action} · {guidance.detail}</span></span></div>
        </button><div className="ml-10 mt-2 border-t border-neutral-800/70 pt-2"><span className="mb-1.5 block text-[9px] uppercase tracking-wider text-neutral-600">Choose a remaining finish stage</span><div className="flex flex-wrap gap-1.5">{remainingStages.map(stage => <button key={stage} type="button" onClick={() => { chooseTopic(topic.id); setGoalTarget(stage); setTopicPickerOpen(false); }} className="rounded border border-purple-900/50 bg-purple-950/20 px-2.5 py-1.5 text-[9px] font-bold capitalize text-purple-300 transition hover:border-purple-500 hover:bg-purple-500/20 hover:text-white">{stageLabel[stage] || stage}</button>)}</div></div></div>; })}
        {!rankedTopics.length && <div className="px-3 py-5 text-center text-[9px] text-neutral-600">No unfinished topics available.</div>}
      </motion.div>}</AnimatePresence>
    </div>
  );

  const renderMilestonePicker = () => { const targetIdx = stageOrder.indexOf(goalTarget as typeof stageOrder[number]); return <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{availableTargets.map(stage => { const idx = stageOrder.indexOf(stage as typeof stageOrder[number]); const isTarget = goalTarget === stage; const isIncluded = idx > 0 && idx <= targetIdx && idx > stageOrder.indexOf((selectedTopic?.status || 'topic') as typeof stageOrder[number]); return <button key={stage} type="button" disabled={!selectedTopic} onClick={() => setGoalTarget(stage)} className={`rounded-lg border px-3 py-2.5 text-xs font-bold capitalize transition disabled:opacity-30 ${isTarget ? 'border-purple-500 bg-purple-500/20 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,.12)]' : isIncluded ? 'border-purple-800/60 bg-purple-950/30 text-purple-400' : 'border-neutral-800 bg-neutral-950 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'}`}>{stageLabel[stage] || stage}</button>; })}</div>; };

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
        <button type="button" onClick={openSetup} className="flex shrink-0 items-center gap-2 rounded-lg border border-cyan-900/60 bg-cyan-950/20 px-3 py-1.5 font-mono text-[10px] font-bold text-cyan-300 transition hover:border-cyan-700">
          <Clock3 className="h-3.5 w-3.5" /><span>Start the day</span>
        </button>
      )}

      {createPortal(
        <AnimatePresence>
          {showSetup && (
            <motion.div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/80 px-4 py-5 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div ref={setupCardRef} initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} className="max-h-[calc(100dvh-2.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-cyan-900/50 bg-neutral-950 p-5 shadow-[0_0_50px_rgba(6,182,212,.12)] sm:p-6">
                <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-white">{setupStep === 'budget' ? 'Set work budget' : 'Set today\'s goals'}</h2><p className="mt-1 text-xs leading-relaxed text-neutral-400">{setupStep === 'budget' ? 'Choose today\'s active work quota. The timer will not start yet.' : 'Optional. Add topic milestones, or begin without goals.'}</p></div><button onClick={() => setShowSetup(false)} className="rounded-lg border border-neutral-800 p-2 text-neutral-500 hover:text-white"><X className="h-4 w-4" /></button></div>
                {setupStep === 'budget' ? <>
                  <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">{([5, 8, 10, 'custom'] as const).map(value => <button key={value} onClick={() => setSelectedHours(value)} className={`rounded-xl border px-3 py-3 font-mono text-xs font-bold uppercase ${selectedHours === value ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300' : 'border-neutral-800 bg-neutral-900/50 text-neutral-400'}`}>{value === 'custom' ? 'Custom' : `${value}h`}</button>)}</div>
                  {selectedHours === 'custom' && <label className="mt-4 block text-[9px] uppercase text-neutral-500">Hours<input type="number" min="0.25" max="24" step="0.25" value={customHours} onChange={event => setCustomHours(event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white" /></label>}
                  <button onClick={() => setSetupStep('goals')} className="mt-5 w-full rounded-xl bg-cyan-500 py-3 text-sm font-bold text-black hover:bg-cyan-400">Continue to goals</button>
                </> : <>
                  {draftGoals.length > 0 && <div className="mt-4 space-y-2">{draftGoals.map(goal => { const topic = topics.find(item => item.id === goal.topicId); return topic ? <div key={goal.id} className="flex items-center gap-2 rounded-lg border border-purple-900/30 bg-purple-950/15 px-3 py-2"><Target className="h-3.5 w-3.5 text-purple-400" /><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-white">{topic.name}</span><span className="block text-[8px] uppercase text-neutral-500">{(() => { const topic = topics.find(t => t.id === goal.topicId); const steps = topic ? stagesBetween(topic.status, goal.targetStatus) : [stageLabel[goal.targetStatus] || goal.targetStatus]; return steps.join(' → '); })()}</span></span><button onClick={() => setDraftGoals(current => current.filter(item => item.id !== goal.id))} className="text-neutral-600 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button></div> : null; })}</div>}
                  <div className="mt-5 space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900/30 p-5">
                    {lastGoalAdded && <div className="text-[9px] text-emerald-300"><Check className="mr-1 inline h-3 w-3" />{lastGoalAdded} added. You can add another.</div>}
                    <div className="block text-xs font-bold uppercase tracking-wider text-neutral-400">Topic{renderTopicPicker()}</div>
                    {selectedTopic && <div className="rounded-lg bg-neutral-950 p-2.5"><div className="truncate text-[10px] font-semibold text-white">{selectedTopic.name}</div><div className="mt-1 text-[8px] uppercase text-cyan-300">Current {selectedTopic.status} · Priority {selectedTopic.priority}</div></div>}
                    <div className="block text-xs font-bold uppercase tracking-wider text-neutral-400">Milestone to reach today{renderMilestonePicker()}</div>
                    <button disabled={!selectedTopic} onClick={addGoal} className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-700 bg-purple-950/40 py-3 text-sm font-bold text-purple-200 disabled:opacity-40"><Plus className="h-4 w-4" />Add goal</button>
                    {!rankedTopics.length && <div className="text-center text-[8px] text-neutral-600">No unfinished topics available.</div>}
                  </div>
                  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"><button onClick={() => startDay([])} className="rounded-xl border border-neutral-700 bg-neutral-900 py-3.5 text-sm font-bold text-neutral-200 hover:border-neutral-500">Start without goals</button><button disabled={!draftGoals.length} onClick={() => startDay(draftGoals)} className="rounded-xl bg-cyan-500 py-3.5 text-sm font-bold text-black hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-35">Start with {draftGoals.length || ''} goal{draftGoals.length === 1 ? '' : 's'}</button></div>
                  <button onClick={() => setSetupStep('budget')} className="mt-4 w-full py-2 text-xs text-neutral-400 hover:text-white">Back to work budget</button>
                </>}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <AnimatePresence>
        {session && showPanel && (
          <motion.div ref={panelRef} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="fixed right-4 top-28 z-[90] max-h-[calc(100vh-8rem)] w-[min(380px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950/98 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-sm font-bold text-white"><span className={`h-2 w-2 rounded-full ${session.status === 'paused' ? 'bg-amber-400' : 'animate-pulse bg-emerald-400'}`} />Workday timer</div><div className="mt-1 text-[9px] uppercase text-neutral-600">Started {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div><button onClick={() => setShowPanel(false)} className="text-neutral-600 hover:text-white"><X className="h-4 w-4" /></button></div>
            <div className="mt-4 text-center font-mono text-3xl font-black text-white">{formatDuration(metrics.active)}</div>
            <div className="mt-1 text-center text-[9px] uppercase text-neutral-500">active work recorded</div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-900"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all" style={{ width: `${metrics.progress}%` }} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4"><div className="rounded-lg bg-neutral-900/60 p-2"><div className="text-xs font-bold text-emerald-300">{metrics.progress.toFixed(1)}%</div><div className="mt-1 text-[7px] uppercase text-neutral-600">quota filled</div></div><div className="rounded-lg bg-neutral-900/60 p-2"><div className="text-xs font-bold text-cyan-300">{formatDuration(metrics.remaining)}</div><div className="mt-1 text-[7px] uppercase text-neutral-600">remaining</div></div><div className="rounded-lg bg-neutral-900/60 p-2"><div className="text-xs font-bold text-purple-300">{metrics.productivePercent.toFixed(0)}%</div><div className="mt-1 text-[7px] uppercase text-neutral-600">productive</div></div><div className="rounded-lg bg-neutral-900/60 p-2"><div className="text-xs font-bold text-amber-300">{formatDuration(metrics.paused)}</div><div className="mt-1 text-[7px] uppercase text-neutral-600">paused</div></div></div>
            <div className="mt-4 rounded-xl border border-neutral-900 bg-neutral-900/25 p-3">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[10px] font-bold text-neutral-300"><Target className="h-3.5 w-3.5 text-purple-400" />Today&apos;s topic goals</div><button onClick={() => setShowGoals(value => !value)} className="flex items-center gap-1 rounded-md border border-purple-900/50 bg-purple-950/25 px-2 py-1 text-[8px] font-bold text-purple-300 hover:border-purple-700">{showGoals ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{showGoals ? 'Close' : 'Set goal'}</button></div>
              {(session.goals || []).filter(goal => topics.some(t => t.id === goal.topicId)).length ? <div className="mt-2 space-y-2">{(session.goals || []).map(goal => {
                const topic = topics.find(t => t.id === goal.topicId);
                if (!topic) return null;
                const complete = goalComplete(goal.topicId, goal.targetStatus);
                const priority = priorityDetails(topic.priority);
                const guidance = topicGuidance(topic);
                return <div key={goal.id} className={`rounded-lg border p-2.5 ${editingGoalId === goal.id ? 'border-purple-600 bg-purple-950/15 shadow-[0_0_16px_rgba(168,85,247,.12)]' : 'border-neutral-900 bg-neutral-950/70'}`}><div className="flex items-start gap-2"><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${complete ? 'border-emerald-500 bg-emerald-500 text-black' : 'border-neutral-700 text-transparent'}`}><Check className="h-3 w-3" /></span><span className="min-w-0 flex-1"><span className={`block text-[9px] font-semibold ${complete ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>{topic.name}</span><span className="mt-1 flex flex-wrap items-center gap-1"><span className="rounded border border-cyan-900/50 bg-cyan-950/20 px-1.5 py-0.5 text-[7px] font-bold uppercase text-cyan-300">{stagesBetween(topic.status, goal.targetStatus).join(' → ')}</span><span className={`rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase ${priority.style}`}>P{topic.priority} · {priority.label}</span><span className={`rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase ${guidance.tone}`}>{guidance.label}</span></span><span className="mt-1.5 block text-[7px] text-neutral-500">Goal: {stagesBetween(topic.status, goal.targetStatus).map((s, i, arr) => <span key={s}>{i > 0 && ' → '}<strong className={i === arr.length - 1 ? 'text-purple-300' : 'text-neutral-300'}>{s}</strong></span>)} · {guidance.detail}</span></span><span className="flex shrink-0 gap-1"><button onClick={() => editGoal(goal)} className="rounded border border-neutral-800 p-1 text-neutral-500 hover:border-purple-700 hover:text-purple-300" aria-label={`Edit goal for ${topic.name}`}><Pencil className="h-3 w-3" /></button><button onClick={() => removeGoal(goal.id)} className="rounded border border-neutral-800 p-1 text-neutral-600 hover:border-rose-800 hover:text-rose-400" aria-label={`Remove goal for ${topic.name}`}><Trash2 className="h-3 w-3" /></button></span></div></div>;
              })}</div> : <div className="mt-2 text-[8px] text-neutral-600">Optional - no topic goal set.</div>}
              <AnimatePresence initial={false}>
                {showGoals && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="mt-3 space-y-3 border-t border-purple-900/30 pt-3">
                  {lastGoalAdded && <div className="flex items-center gap-2 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-2.5 py-2 text-[8px] text-emerald-300"><Check className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0"><strong className="font-bold">{lastGoalAdded}</strong> added. Select another topic or close.</span></div>}
                  <div className="block text-[7px] font-bold uppercase tracking-wider text-neutral-500">Topic{renderTopicPicker()}</div>
                  {selectedTopic && <div className="rounded-lg border border-neutral-900 bg-neutral-950/70 p-2.5"><div className="truncate text-[9px] font-semibold text-white">{selectedTopic.name}</div><div className="mt-1 flex flex-wrap gap-1 text-[7px] uppercase"><span className="rounded bg-blue-950/40 px-1.5 py-0.5 text-blue-300">Current {selectedTopic.status}</span><span className="rounded bg-cyan-950/40 px-1.5 py-0.5 text-cyan-300">Priority {selectedTopic.priority}</span>{selectedTopic.dueDate && <span className="rounded bg-rose-950/40 px-1.5 py-0.5 text-rose-300">Due {new Date(selectedTopic.dueDate).toLocaleDateString()}</span>}{selectedTopic.blockedReason && <span className="rounded bg-rose-950/50 px-1.5 py-0.5 text-rose-300">Blocked</span>}</div></div>}
                  <div className="block text-[7px] font-bold uppercase tracking-wider text-neutral-500">Milestone to reach today{renderMilestonePicker()}</div>
                  <button disabled={!selectedTopic} onClick={addGoal} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-500 py-2 text-[9px] font-bold text-black hover:bg-purple-400 disabled:cursor-not-allowed disabled:opacity-40">{editingGoalId ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{editingGoalId ? 'Save goal changes' : 'Add today\'s goal'}</button>
                  {editingGoalId && <button onClick={() => { setEditingGoalId(null); setGoalTopicId(''); }} className="w-full text-center text-[8px] text-neutral-500 hover:text-white">Cancel editing</button>}
                  {!rankedTopics.length && <div className="text-center text-[8px] text-neutral-600">No unfinished topics available.</div>}
                </div></motion.div>}
              </AnimatePresence>
            </div>
            {metrics.remaining > 0 && metrics.remaining < TWO_HOURS_MS && (
              <div className="mt-3 rounded-lg border border-amber-800/50 bg-amber-950/15 p-2.5">
                <div className="text-[8px] font-bold uppercase text-amber-300">Less than 2h left — extend the session?</div>
                <div className="mt-2 flex gap-1.5">
                  {[30, 60, 120].map(minutes => (
                    <button key={minutes} onClick={() => extendSession(minutes)} className="flex-1 rounded-md border border-amber-700/60 bg-amber-500/10 py-1.5 text-[9px] font-bold text-amber-200 hover:bg-amber-500/20">
                      +{minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-2"><button onClick={session.status === 'paused' ? resume : pause} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[10px] font-bold ${session.status === 'paused' ? 'bg-emerald-500 text-black' : 'bg-amber-500 text-black'}`}>{session.status === 'paused' ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}{session.status === 'paused' ? 'Resume work' : 'Pause work'}</button><button onClick={endSession} title="End session" className="rounded-lg border border-rose-900/60 px-3 py-2 text-[10px] font-bold text-rose-400 hover:border-rose-700 hover:bg-rose-950/30">Stop</button></div>
          </motion.div>
        )}

        {session && showProductivityPrompt && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} className="w-full max-w-md rounded-2xl border border-purple-800/60 bg-neutral-950 p-5 shadow-[0_0_50px_rgba(168,85,247,.16)]">
              <h2 className="text-base font-bold text-white">How productive was this session?</h2>
              <p className="mt-1 text-[10px] text-neutral-500">Choose once to record this work segment and pause the timer.</p>
              <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-10">
                {Array.from({ length: 10 }, (_, index) => index + 1).map(score => (
                  <button key={score} type="button" onClick={() => { setShowProductivityPrompt(false); commitPause(score); }} className="flex aspect-square items-center justify-center rounded-lg border border-purple-800/60 bg-purple-950/25 font-mono text-sm font-black text-purple-200 transition hover:border-purple-400 hover:bg-purple-500 hover:text-black" title={`${score * 10}% productive`}>
                    {score}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex justify-between font-mono text-[8px] uppercase text-neutral-600"><span>1 = 10%</span><span>10 = 100%</span></div>
              <button type="button" onClick={() => setShowProductivityPrompt(false)} className="mt-4 w-full text-center text-[9px] text-neutral-500 hover:text-white">Keep timer running</button>
            </motion.div>
          </div>
        )}

      </AnimatePresence>
      {createPortal(
        <EndSessionModal
          isOpen={showEndConfirmation}
          activeMs={metrics.active}
          pausedMs={metrics.paused}
          completedGoals={(session?.goals || []).filter(goal => goalComplete(goal.topicId, goal.targetStatus)).length}
          totalGoals={(session?.goals || []).length}
          onCancel={() => setShowEndConfirmation(false)}
          onConfirm={() => {
            setShowEndConfirmation(false);
            onEndSession();
            setShowPanel(false);
          }}
          onDiscard={() => {
            setShowEndConfirmation(false);
            setSession(null);
            setShowPanel(false);
          }}
        />,
        document.body
      )}
    </>
  );
}

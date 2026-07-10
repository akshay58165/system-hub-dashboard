import { useMemo, useState, useEffect } from 'react';
import { Clock, ChevronDown, Trash2, Pencil } from 'lucide-react';
import type { Topic, TaskTimerRecord, TaskTimerStage, TopicSortMode } from '../types';

const STAGES: TaskTimerStage[] = ['hook', 'script', 'shoot', 'edit'];
const STAGE_LABEL: Record<TaskTimerStage, string> = {
  hook: 'Hook', script: 'Script', shoot: 'Shoot', edit: 'Edit', schedule: 'Schedule', post: 'Post'
};

function formatHMS(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function formatShort(ms: number) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function parseTimeInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':').map(p => p.trim());
  if (parts.some(p => p === '' || !/^\d+$/.test(p))) return null;
  const nums = parts.map(p => parseInt(p, 10));
  let h = 0, m = 0, s = 0;
  if (nums.length === 1) m = nums[0];
  else if (nums.length === 2) { m = nums[0]; s = nums[1]; }
  else if (nums.length === 3) { h = nums[0]; m = nums[1]; s = nums[2]; }
  else return null;
  return ((h * 60 + m) * 60 + s) * 1000;
}

interface TimeViewProps {
  topics: Topic[];
  taskTimers: TaskTimerRecord[];
  onStartTimer: (topicId: string, stage: TaskTimerStage) => void;
  onPauseTimer: () => void;
  onCompleteStage: (topicId: string, stage: TaskTimerStage) => void;
  onAddManualTime: (topicId: string, stage: TaskTimerStage, ms: number) => void;
  onReplaceTime: (topicId: string, stage: TaskTimerStage, ms: number) => void;
  onSetStageTotals: (topicId: string, stage: TaskTimerStage, totalMs: number, sittings: number) => void;
  onUpdateTimer: (timerId: string, patch: Partial<TaskTimerRecord>) => void;
  onDeleteTimer: (timerId: string) => void;
}

type SortMode = TopicSortMode | 'newest' | 'time-desc' | 'time-asc' | 'running-first' | 'last-worked-on' | 'posted-first' | 'default-due-desc-last-worked';

const SORT_LABELS: Partial<Record<SortMode, string>> = {
  'default-due-desc-last-worked': 'Default (last-worked, then latest due)',
  'newest': 'Newest first',
  'due-date': 'First due',
  'running-first': 'Running first',
  'last-created': 'Recently created',
  'level': 'By stage progress',
  'progress-most': 'Most progress',
  'progress-least': 'Least progress',
  'workload': 'Highest workload',
  'time-desc': 'Most time spent',
  'time-asc': 'Least time spent',
  'last-worked-on': 'Last worked on',
  'posted-first': 'Posted first',
};

const STATUS_LEVEL: Record<Topic['status'], number> = {
  topic: 0, hooked: 1, scripted: 2, shot: 3, edited: 4, scheduled: 5, posted: 6,
};

function stageTotals(timers: TaskTimerRecord[], nowMs: number, stage: TaskTimerStage) {
  const relevant = timers.filter(t => t.stage === stage);
  const ms = relevant.reduce((sum, t) => sum + t.accumulatedActiveMs + (
    t.status === 'running' && t.activeSince ? Math.max(0, nowMs - new Date(t.activeSince).getTime()) : 0
  ), 0);
  const sittings = relevant.reduce((sum, t) => {
    if (t.segments && t.segments.length > 0) return sum + t.segments.length;
    if (t.status === 'paused') return sum + t.breaksCount;
    if (t.status === 'running' || t.status === 'completed') return sum + t.breaksCount + 1;
    return sum;
  }, 0);
  const running = relevant.some(t => t.status === 'running');
  const paused = relevant.some(t => t.status === 'paused');
  const done = relevant.some(t => t.status === 'completed' && t.endReason === 'done');
  return { ms, sittings: relevant.length ? sittings : 0, running, paused, done, entries: relevant };
}

export default function TimeView({
  topics, taskTimers,
  onStartTimer, onPauseTimer, onCompleteStage, onAddManualTime, onReplaceTime, onSetStageTotals, onUpdateTimer, onDeleteTimer
}: TimeViewProps) {
  const [sortMode, setSortMode] = useState<SortMode>('default-due-desc-last-worked');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'paused' | 'in-progress' | 'scheduled' | 'posted' | 'idea' | 'has-time' | 'no-time'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [entriesOpen, setEntriesOpen] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [editingStageKey, setEditingStageKey] = useState<string | null>(null);
  const [editingStageValue, setEditingStageValue] = useState('');
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const perTopic = useMemo(() => {
    return topics.map(topic => {
      const topicTimers = taskTimers.filter(t => t.topicId === topic.id);
      const perStage = STAGES.reduce((acc, s) => {
        acc[s] = stageTotals(topicTimers, now, s);
        return acc;
      }, {} as Record<TaskTimerStage, ReturnType<typeof stageTotals>>);
      const totalMs = STAGES.reduce((sum, s) => sum + perStage[s].ms, 0);
      const totalSittings = STAGES.reduce((sum, s) => sum + perStage[s].sittings, 0);
      const anyRunning = STAGES.some(s => perStage[s].running);
      const anyPaused = STAGES.some(s => perStage[s].paused);
      return { topic, perStage, totalMs, totalSittings, anyRunning, anyPaused, timers: topicTimers };
    });
  }, [topics, taskTimers, now]);

  const filtered = useMemo(() => {
    return perTopic.filter(row => {
      switch (filterMode) {
        case 'all': return true;
        case 'active': return row.anyRunning;
        case 'paused': return row.anyPaused && !row.anyRunning;
        case 'in-progress': return row.topic.status !== 'topic' && row.topic.status !== 'posted';
        case 'scheduled': return row.topic.status === 'scheduled';
        case 'posted': return row.topic.status === 'posted';
        case 'idea': return row.topic.status === 'topic';
        case 'has-time': return row.totalMs > 0;
        case 'no-time': return row.totalMs === 0;
      }
    });
  }, [perTopic, filterMode]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    switch (sortMode) {
      case 'newest':
        rows.sort((a, b) => new Date(b.topic.createdDate).getTime() - new Date(a.topic.createdDate).getTime());
        break;
      case 'due-date':
        rows.sort((a, b) => {
          const av = a.topic.dueDate ? new Date(a.topic.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          const bv = b.topic.dueDate ? new Date(b.topic.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          return av - bv;
        });
        break;
      case 'running-first':
        rows.sort((a, b) => {
          const rank = (r: typeof a) => r.anyRunning ? 0 : r.anyPaused ? 1 : 2;
          return rank(a) - rank(b) || (b.totalMs - a.totalMs);
        });
        break;
      case 'level':
        rows.sort((a, b) => STATUS_LEVEL[b.topic.status] - STATUS_LEVEL[a.topic.status]);
        break;
      case 'progress-most':
        rows.sort((a, b) => STATUS_LEVEL[b.topic.status] - STATUS_LEVEL[a.topic.status]);
        break;
      case 'progress-least':
        rows.sort((a, b) => STATUS_LEVEL[a.topic.status] - STATUS_LEVEL[b.topic.status]);
        break;
      case 'time-desc':
        rows.sort((a, b) => b.totalMs - a.totalMs);
        break;
      case 'time-asc':
        rows.sort((a, b) => a.totalMs - b.totalMs);
        break;
      case 'last-created':
        rows.sort((a, b) => new Date(b.topic.createdDate).getTime() - new Date(a.topic.createdDate).getTime());
        break;
      case 'workload':
        rows.sort((a, b) => (6 - STATUS_LEVEL[a.topic.status]) - (6 - STATUS_LEVEL[b.topic.status]));
        break;
      case 'posted-first':
        rows.sort((a, b) => (b.topic.status === 'posted' ? 1 : 0) - (a.topic.status === 'posted' ? 1 : 0));
        break;
      default:
        rows.sort((a, b) => new Date(b.topic.createdDate).getTime() - new Date(a.topic.createdDate).getTime());
    }
    return rows;
  }, [filtered, sortMode]);

  const lastWorkedOnMs = (row: typeof perTopic[number]) => {
    return row.timers.reduce((max, t) => {
      const stamps = [t.completedAt, t.pausedAt, t.activeSince, t.startedAt].filter(Boolean) as string[];
      return stamps.reduce((m, s) => Math.max(m, new Date(s).getTime()), max);
    }, 0);
  };
  // Extra sort case handled via post-process for "last-worked-on"
  const finalSorted = useMemo(() => {
    if (sortMode === 'last-worked-on' as SortMode) {
      return [...sorted].sort((a, b) => lastWorkedOnMs(b) - lastWorkedOnMs(a));
    }
    if (sortMode === 'default-due-desc-last-worked' as SortMode) {
      return [...filtered].sort((a, b) => {
        // Primary: any topic currently active (running > paused) climbs to the top.
        const activityRank = (r: typeof a) => r.anyRunning ? 0 : r.anyPaused ? 1 : 2;
        const ar = activityRank(a);
        const br = activityRank(b);
        if (ar !== br) return ar - br;
        // Secondary: within the same activity rank, the most-recently-worked
        // topic wins (overrides the due-date order per your spec).
        const aLast = lastWorkedOnMs(a);
        const bLast = lastWorkedOnMs(b);
        if (aLast !== bLast) return bLast - aLast;
        // Tertiary: descending due date (latest due first). Topics with no
        // due date fall to the bottom.
        const aDue = a.topic.dueDate ? new Date(a.topic.dueDate).getTime() : -Infinity;
        const bDue = b.topic.dueDate ? new Date(b.topic.dueDate).getTime() : -Infinity;
        return bDue - aDue;
      });
    }
    return sorted;
  }, [sorted, filtered, sortMode]);

  // Aggregate insights — total time per stage across all topics
  const stageAggregate = useMemo(() => {
    return STAGES.map(stage => {
      const ms = taskTimers.filter(t => t.stage === stage).reduce((sum, t) => sum + t.accumulatedActiveMs + (
        t.status === 'running' && t.activeSince ? Math.max(0, now - new Date(t.activeSince).getTime()) : 0
      ), 0);
      const sittings = taskTimers.filter(t => t.stage === stage).reduce((sum, t) => {
        if (t.segments && t.segments.length > 0) return sum + t.segments.length;
        if (t.status === 'paused') return sum + t.breaksCount;
        if (t.status === 'running' || t.status === 'completed') return sum + t.breaksCount + 1;
        return sum;
      }, 0);
      const uniqueTopics = new Set(taskTimers.filter(t => t.stage === stage).map(t => t.topicId)).size;
      return { stage, ms, sittings, uniqueTopics };
    });
  }, [taskTimers, now]);

  const grandTotalMs = stageAggregate.reduce((sum, s) => sum + s.ms, 0);

  // Weekly aggregate — time logged in the last 7 days
  const weeklyByStage = useMemo(() => {
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    return STAGES.map(stage => {
      const ms = taskTimers.filter(t => t.stage === stage && new Date(t.startedAt).getTime() >= cutoff)
        .reduce((sum, t) => sum + t.accumulatedActiveMs + (
          t.status === 'running' && t.activeSince ? Math.max(0, now - new Date(t.activeSince).getTime()) : 0
        ), 0);
      return { stage, ms };
    });
  }, [taskTimers, now]);

  const busiestStage = [...stageAggregate].sort((a, b) => b.ms - a.ms)[0];
  const avgPerTopicMs = perTopic.length ? grandTotalMs / perTopic.length : 0;

  const handleEditEntry = (timer: TaskTimerRecord) => {
    const current = formatHMS(timer.accumulatedActiveMs);
    const raw = window.prompt(`Edit time for this ${timer.stage} entry (HH:MM:SS):`, current);
    if (raw === null) return;
    const ms = parseTimeInput(raw);
    if (ms === null) { window.alert('Could not parse time.'); return; }
    onUpdateTimer(timer.id, { accumulatedActiveMs: ms });
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-400" />
            Time
          </h1>
          <p className="text-[10px] text-neutral-500 mt-1">Per-stage stopwatches, sittings, and insights across every topic.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => { setFilterOpen(o => !o); setSortOpen(false); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-800 bg-neutral-950 text-[11px] text-neutral-200 hover:border-neutral-700"
            >
              <span>Filter: {({ all: 'All', active: 'Active (running)', paused: 'Paused', 'in-progress': 'In progress', scheduled: 'Scheduled', posted: 'Posted', idea: 'Idea only', 'has-time': 'Has time', 'no-time': 'No time yet' } as const)[filterMode]}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {filterOpen && (
              <div className="absolute right-0 mt-1 z-10 w-44 rounded border border-neutral-800 bg-neutral-950 shadow-xl py-1">
                {(['all', 'active', 'paused', 'in-progress', 'idea', 'scheduled', 'posted', 'has-time', 'no-time'] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setFilterMode(opt); setFilterOpen(false); }}
                    className={`block w-full text-left px-2 py-1 text-[11px] hover:bg-neutral-900 ${filterMode === opt ? 'text-purple-300' : 'text-neutral-200'}`}
                  >{({ all: 'All', active: 'Active (running)', paused: 'Paused', 'in-progress': 'In progress', scheduled: 'Scheduled', posted: 'Posted', idea: 'Idea only', 'has-time': 'Has time', 'no-time': 'No time yet' } as const)[opt]}</button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => { setSortOpen(o => !o); setFilterOpen(false); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-800 bg-neutral-950 text-[11px] text-neutral-200 hover:border-neutral-700"
            >
              <span>Sort: {SORT_LABELS[sortMode]}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {sortOpen && (
              <div className="absolute right-0 mt-1 z-10 w-44 rounded border border-neutral-800 bg-neutral-950 shadow-xl py-1">
                {(['default-due-desc-last-worked', 'newest', 'due-date', 'last-worked-on', 'running-first', 'time-desc', 'time-asc', 'progress-most', 'progress-least', 'workload', 'posted-first'] as SortMode[]).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setSortMode(opt); setSortOpen(false); }}
                    className={`block w-full text-left px-2 py-1 text-[11px] hover:bg-neutral-900 ${sortMode === opt ? 'text-purple-300' : 'text-neutral-200'}`}
                  >{SORT_LABELS[opt]}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Insights strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
          <div className="text-[9px] uppercase text-neutral-500 tracking-wider">Total tracked</div>
          <div className="text-lg font-bold text-white mt-1">{formatShort(grandTotalMs)}</div>
          <div className="text-[9px] text-neutral-500 mt-0.5">across {perTopic.length} topics</div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
          <div className="text-[9px] uppercase text-neutral-500 tracking-wider">Busiest stage</div>
          <div className="text-lg font-bold text-purple-300 mt-1">{busiestStage && busiestStage.ms > 0 ? STAGE_LABEL[busiestStage.stage] : '—'}</div>
          <div className="text-[9px] text-neutral-500 mt-0.5">{busiestStage ? formatShort(busiestStage.ms) : '0m'}</div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
          <div className="text-[9px] uppercase text-neutral-500 tracking-wider">Avg per topic</div>
          <div className="text-lg font-bold text-emerald-300 mt-1">{formatShort(avgPerTopicMs)}</div>
          <div className="text-[9px] text-neutral-500 mt-0.5">including archived stages</div>
        </div>
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
          <div className="text-[9px] uppercase text-neutral-500 tracking-wider">Last 7 days</div>
          <div className="text-lg font-bold text-cyan-300 mt-1">{formatShort(weeklyByStage.reduce((s, x) => s + x.ms, 0))}</div>
          <div className="text-[9px] text-neutral-500 mt-0.5">{weeklyByStage.map(w => `${STAGE_LABEL[w.stage][0]} ${formatShort(w.ms)}`).join(' · ')}</div>
        </div>
      </div>

      {/* Per-stage aggregate bars */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
        <div className="text-[9px] uppercase text-neutral-500 tracking-wider mb-3">Total time by stage</div>
        <div className="space-y-2">
          {stageAggregate.map(s => {
            const pct = grandTotalMs > 0 ? (s.ms / grandTotalMs) * 100 : 0;
            return (
              <div key={s.stage} className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-300 font-bold">{STAGE_LABEL[s.stage]}</span>
                  <span className="text-neutral-400">{formatShort(s.ms)} · {s.uniqueTopics} topics · {s.sittings} sittings</span>
                </div>
                <div className="h-1.5 rounded bg-neutral-900 overflow-hidden">
                  <div className="h-full bg-purple-500/70" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Topic list */}
      <div className="space-y-2">
        {finalSorted.length === 0 && (
          <div className="text-center py-6 text-neutral-500 text-[10px] border border-dashed border-neutral-800 rounded-lg">
            No topics yet. Add one from the Pipeline.
          </div>
        )}
        {finalSorted.map(row => {
          const t = row.topic;
          const isOpen = expanded === t.id;
          return (
            <div key={t.id} className="rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : t.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-neutral-900/40 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-100 truncate">{t.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] border border-neutral-800 text-neutral-400">{t.channel}</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] border border-blue-900/40 text-blue-400 bg-blue-950/20 uppercase">{t.status}</span>
                    {row.anyRunning && <span className="text-[8px] text-emerald-400 font-bold">● LIVE</span>}
                    {!row.anyRunning && row.anyPaused && <span className="text-[8px] text-amber-400 font-bold">◐ PAUSED</span>}
                  </div>
                  <div className="text-[9px] text-neutral-500 mt-0.5">
                    Created {new Date(t.createdDate).toLocaleDateString()} · Due {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'None'}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 font-sans">
                  {STAGES.map(s => (
                    <div key={s} className="text-center min-w-[3.5rem]">
                      <div className="text-[10px] uppercase text-neutral-200 font-semibold tracking-wide">{STAGE_LABEL[s]}</div>
                      <div className={`text-[12px] font-mono font-semibold ${row.perStage[s].running ? 'text-emerald-300' : row.perStage[s].paused ? 'text-amber-300' : row.perStage[s].done ? 'text-neutral-100' : 'text-neutral-500'}`}>
                        {row.perStage[s].ms > 0 ? formatShort(row.perStage[s].ms) : '—'}
                      </div>
                      <div className="text-[10px] font-mono text-cyan-300 font-semibold">
                        {row.perStage[s].sittings > 0 ? `×${row.perStage[s].sittings}` : ''}
                      </div>
                    </div>
                  ))}
                  <div className="text-center min-w-[3.5rem] pl-2 border-l border-neutral-800">
                    <div className="text-[10px] uppercase text-neutral-200 font-semibold tracking-wide">Total</div>
                    <div className="text-[13px] font-mono font-bold text-white">{row.totalMs > 0 ? formatShort(row.totalMs) : '—'}</div>
                    <div className="text-[10px] text-neutral-400">{row.totalSittings} sittings</div>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-neutral-300 transition ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isOpen && (() => {
                const activeStage = STAGES.find(s => row.perStage[s].running)
                  || STAGES.find(s => row.perStage[s].paused)
                  || STAGES.find(s => row.perStage[s].done)
                  || STAGES[0];
                const activeInfo = row.perStage[activeStage];
                const activeTone = activeInfo.running
                  ? 'border-emerald-500/70 bg-gradient-to-br from-emerald-950/35 via-neutral-950 to-neutral-950'
                  : activeInfo.paused
                    ? 'border-amber-500/70 bg-gradient-to-br from-amber-950/30 via-neutral-950 to-neutral-950'
                    : 'border-neutral-800 bg-gradient-to-br from-neutral-950 via-neutral-950 to-neutral-900/40';
                return (
                <div className="border-t border-neutral-800 bg-neutral-950/70 p-3 space-y-3">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                    <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-[0_0_30px_rgba(0,0,0,0.22)] ${activeTone}`}>
                      <div className={`absolute inset-0 pointer-events-none ${activeInfo.running ? 'bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_55%)]' : activeInfo.paused ? 'bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_55%)]' : 'bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.04),transparent_55%)]'}`} />
                      <div className="relative flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.28em] ${activeInfo.running ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : activeInfo.paused ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-neutral-700 bg-neutral-900 text-neutral-300'}`}>
                              {STAGE_LABEL[activeStage]}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.28em] ${activeInfo.running ? 'bg-emerald-500/15 text-emerald-300' : activeInfo.paused ? 'bg-amber-500/15 text-amber-300' : 'bg-neutral-800 text-neutral-400'}`}>
                              {activeInfo.running ? 'Live stopwatch' : activeInfo.paused ? 'Paused' : 'Stopped'}
                            </span>
                          </div>
                          <div className="mt-4 flex items-end gap-3">
                            <div className={`tabular-nums font-black tracking-tighter leading-none ${activeInfo.running ? 'text-6xl sm:text-7xl lg:text-[7rem]' : 'text-5xl sm:text-6xl lg:text-[6.25rem]'} ${activeInfo.running ? 'text-white' : activeInfo.paused ? 'text-amber-100' : 'text-neutral-100'}`}>
                              {formatHMS(activeInfo.ms)}
                            </div>
                            <div className="pb-3 text-xs text-neutral-400">
                              <div className="font-semibold text-neutral-200">{activeInfo.sittings} sittings</div>
                              <div className="mt-1 max-w-[12rem] leading-relaxed">
                                {activeInfo.running ? 'This stage is currently recording live time.' : activeInfo.paused ? 'Resume it or switch to a different stage.' : 'Ready for a fresh start or a manual time edit.'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const stageKey = `${t.id}-${activeStage}`;
                            setEditingStageKey(stageKey);
                            setEditingStageValue(formatHMS(activeInfo.ms));
                          }}
                          title="Edit time"
                          className="shrink-0 rounded-full border border-neutral-700 bg-neutral-950/70 p-2 text-neutral-400 hover:border-blue-500/40 hover:text-blue-300"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="relative mt-5 flex flex-wrap gap-2">
                        {!activeInfo.running && (
                          <button
                            type="button"
                            onClick={() => onStartTimer(t.id, activeStage)}
                            className="rounded-full border border-emerald-700/60 bg-emerald-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-500/15"
                          >
                            {activeInfo.paused ? 'Resume' : 'Start'} {STAGE_LABEL[activeStage]}
                          </button>
                        )}
                        {activeInfo.running && (
                          <button
                            type="button"
                            onClick={onPauseTimer}
                            className="rounded-full border border-amber-700/60 bg-amber-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200 hover:bg-amber-500/15"
                          >
                            Pause {STAGE_LABEL[activeStage]}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={activeInfo.ms === 0 && !activeInfo.running && !activeInfo.paused}
                          onClick={() => onCompleteStage(t.id, activeStage)}
                          className="rounded-full border border-blue-700/60 bg-blue-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Done
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {STAGES.map(s => {
                        const info = row.perStage[s];
                        const isActive = activeStage === s;
                        return (
                          <div
                            key={s}
                            className={`rounded-2xl border p-3 transition-all duration-300 ${isActive ? info.running ? 'border-emerald-500/60 bg-emerald-950/25 shadow-[0_0_20px_rgba(16,185,129,0.08)]' : info.paused ? 'border-amber-500/60 bg-amber-950/20 shadow-[0_0_20px_rgba(245,158,11,0.08)]' : 'border-neutral-700 bg-neutral-900/70' : 'border-neutral-800 bg-neutral-950/85 hover:border-neutral-700'}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className={`font-bold uppercase tracking-[0.2em] ${isActive ? 'text-[11px] text-neutral-100' : 'text-[9px] text-neutral-400'}`}>
                                  {STAGE_LABEL[s]}
                                  {isActive && info.running && <span className="ml-2 text-emerald-300">LIVE</span>}
                                  {isActive && info.paused && <span className="ml-2 text-amber-300">PAUSED</span>}
                                </div>
                                <div className={`mt-1 tabular-nums font-black tracking-tight ${isActive ? 'text-2xl sm:text-3xl text-white' : 'text-lg sm:text-xl text-neutral-200'}`}>
                                  {editingStageKey === `${t.id}-${s}` ? (
                                    <input
                                      type="text"
                                      autoFocus
                                      value={editingStageValue}
                                      onChange={(e) => setEditingStageValue(e.target.value)}
                                      onBlur={() => {
                                        const ms = parseTimeInput(editingStageValue);
                                        if (ms !== null) onReplaceTime(t.id, s, ms);
                                        setEditingStageKey(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const ms = parseTimeInput(editingStageValue);
                                          if (ms !== null) onReplaceTime(t.id, s, ms);
                                          setEditingStageKey(null);
                                        }
                                        if (e.key === 'Escape') setEditingStageKey(null);
                                      }}
                                      className="w-full rounded border border-blue-600 bg-neutral-900 px-2 py-1 text-[11px] font-mono text-white outline-none"
                                      placeholder="HH:MM:SS"
                                    />
                                  ) : (
                                    formatHMS(info.ms)
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const stageKey = `${t.id}-${s}`;
                                  setEditingStageKey(stageKey);
                                  setEditingStageValue(formatHMS(info.ms));
                                }}
                                title="Edit time"
                                className="shrink-0 rounded border border-neutral-800 p-1.5 text-neutral-500 hover:text-blue-300"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-neutral-500">
                              <span>{info.sittings} sittings</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const raw = window.prompt(`Set sittings count for ${STAGE_LABEL[s]} (current: ${info.sittings}). Total time stays the same and is split evenly across the new count.`, String(Math.max(1, info.sittings)));
                                  if (raw === null) return;
                                  const n = parseInt(raw.trim(), 10);
                                  if (!Number.isFinite(n) || n < 1) { window.alert('Enter a whole number ≥ 1.'); return; }
                                  onSetStageTotals(t.id, s, info.ms, n);
                                }}
                                title="Edit sittings count"
                                className="rounded border border-neutral-800 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-400 hover:border-cyan-500/40 hover:text-cyan-300"
                              >
                                Split
                              </button>
                            </div>

                            <div className="mt-2 flex gap-1.5">
                              {!info.running && (
                                <button
                                  type="button"
                                  onClick={() => onStartTimer(t.id, s)}
                                  className="flex-1 rounded-lg border border-emerald-800/60 bg-emerald-500/10 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-200 hover:bg-emerald-500/15"
                                >
                                  {info.paused ? 'Resume' : 'Start'}
                                </button>
                              )}
                              {info.running && (
                                <button
                                  type="button"
                                  onClick={onPauseTimer}
                                  className="flex-1 rounded-lg border border-amber-800/60 bg-amber-500/10 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-200 hover:bg-amber-500/15"
                                >
                                  Pause
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={info.ms === 0 && !info.running && !info.paused}
                                onClick={() => onCompleteStage(t.id, s)}
                                className="rounded-lg border border-blue-800/60 bg-blue-500/10 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-blue-200 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Individual entries — collapsed by default. Click the header
                      to reveal the full audit list of every timer row. */}
                  {row.timers.length > 0 && (
                    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/90">
                      <button
                        type="button"
                        onClick={() => setEntriesOpen(prev => prev === t.id ? null : t.id)}
                        className="flex w-full items-center justify-between border-b border-neutral-800/80 px-3 py-2 text-[10px] uppercase tracking-[0.22em] text-neutral-500 hover:text-neutral-200"
                        aria-expanded={entriesOpen === t.id}
                      >
                        <span>Time entries ({row.timers.length})</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${entriesOpen === t.id ? 'rotate-180' : ''}`} />
                      </button>
                      {entriesOpen === t.id ? (
                      <div className="divide-y divide-neutral-900">
                        {row.timers.slice().sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).map(timer => (
                          <div key={timer.id} className="flex items-start justify-between gap-3 px-3 py-2 text-[10px]">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-neutral-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-300">{STAGE_LABEL[timer.stage]}</span>
                                <span className="font-mono text-sm font-semibold text-neutral-100 tabular-nums">{formatHMS(timer.accumulatedActiveMs)}</span>
                                <span className="text-neutral-600">·</span>
                                {(() => {
                                  const n = timer.segments && timer.segments.length > 0
                                    ? timer.segments.length
                                    : timer.status === 'paused' ? timer.breaksCount : timer.breaksCount + 1;
                                  return <span className="text-neutral-500 text-[9px]">{new Date(timer.startedAt).toLocaleDateString()} · {n} sitting{n === 1 ? '' : 's'}</span>;
                                })()}
                                <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] ${timer.status === 'running' ? 'border-emerald-900 text-emerald-300' : timer.status === 'paused' ? 'border-amber-900 text-amber-300' : 'border-neutral-800 text-neutral-500'}`}>{timer.status}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleEditEntry(timer)}
                                title="Edit time"
                                className="rounded border border-neutral-800 p-1.5 text-neutral-400 hover:text-blue-300"
                              ><Pencil className="h-2.5 w-2.5" /></button>
                              <button
                                type="button"
                                onClick={() => { if (window.confirm('Delete this time entry?')) onDeleteTimer(timer.id); }}
                                title="Delete entry"
                                className="rounded border border-neutral-800 p-1.5 text-neutral-400 hover:text-rose-400"
                              ><Trash2 className="h-2.5 w-2.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

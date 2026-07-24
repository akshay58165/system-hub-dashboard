import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
import { Clock, ChevronDown, Trash2, Pencil, GitBranch, FileText, Video, Sparkles, Zap, Layers, Timer, TrendingUp, Flame, Play, Filter, ArrowUpDown } from 'lucide-react';
import type { Topic, TaskTimerRecord, TaskTimerStage, TopicSortMode } from '../types';

const STAGES: TaskTimerStage[] = ['hook', 'script', 'shoot', 'edit'];
const STAGE_LABEL: Record<TaskTimerStage, string> = {
  hook: 'Hook', script: 'Script', shoot: 'Shoot', edit: 'Edit', schedule: 'Schedule', post: 'Post'
};

const STAGE_ICON: Record<TaskTimerStage, ReactNode> = {
  hook: <GitBranch className="h-4 w-4" />,
  script: <FileText className="h-4 w-4" />,
  shoot: <Video className="h-4 w-4" />,
  edit: <Pencil className="h-4 w-4" />,
  schedule: <Clock className="h-4 w-4" />,
  post: <Clock className="h-4 w-4" />,
};

// Each authoring stage owns its own signature palette so every
// insight card, bar, and highlight can be color-coded consistently.
const STAGE_PALETTE: Record<TaskTimerStage, {
  text: string; softText: string; ring: string; bar: string; glowVar: string; tintBg: string; iconBg: string;
}> = {
  hook: {
    text: 'text-sky-300', softText: 'text-sky-200/70', ring: 'ring-sky-400/25',
    bar: 'from-sky-500 to-sky-300', glowVar: 'rgba(56,189,248,0.35)',
    tintBg: 'bg-gradient-to-br from-sky-500/10 via-transparent to-transparent', iconBg: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30',
  },
  script: {
    text: 'text-violet-300', softText: 'text-violet-200/70', ring: 'ring-violet-400/25',
    bar: 'from-violet-500 to-violet-300', glowVar: 'rgba(167,139,250,0.35)',
    tintBg: 'bg-gradient-to-br from-violet-500/10 via-transparent to-transparent', iconBg: 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30',
  },
  shoot: {
    text: 'text-amber-300', softText: 'text-amber-200/70', ring: 'ring-amber-400/25',
    bar: 'from-amber-500 to-amber-300', glowVar: 'rgba(251,191,36,0.35)',
    tintBg: 'bg-gradient-to-br from-amber-500/10 via-transparent to-transparent', iconBg: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30',
  },
  edit: {
    text: 'text-emerald-300', softText: 'text-emerald-200/70', ring: 'ring-emerald-400/25',
    bar: 'from-emerald-500 to-emerald-300', glowVar: 'rgba(52,211,153,0.35)',
    tintBg: 'bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent', iconBg: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30',
  },
  schedule: {
    text: 'text-pink-300', softText: 'text-pink-200/70', ring: 'ring-pink-400/25',
    bar: 'from-pink-500 to-pink-300', glowVar: 'rgba(244,114,182,0.35)',
    tintBg: 'bg-gradient-to-br from-pink-500/10 via-transparent to-transparent', iconBg: 'bg-pink-500/15 text-pink-300 ring-1 ring-pink-400/30',
  },
  post: {
    text: 'text-rose-300', softText: 'text-rose-200/70', ring: 'ring-rose-400/25',
    bar: 'from-rose-500 to-rose-300', glowVar: 'rgba(244,63,94,0.35)',
    tintBg: 'bg-gradient-to-br from-rose-500/10 via-transparent to-transparent', iconBg: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30',
  },
};

// Compact fractional formatter for "sittings avg" — trims trailing zero
// so 4.0 reads as "4" and 1.7 stays as "1.7".
function formatAvgSittings(n: number) {
  if (!Number.isFinite(n) || n <= 0) return '0';
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
}

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
  const [editingSittingsKey, setEditingSittingsKey] = useState<string | null>(null);
  const [editingSittingsValue, setEditingSittingsValue] = useState('');
  const autoExpandedLiveId = useRef<string | null>(null);
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

  useEffect(() => {
    const liveRow = finalSorted.find(row => row.anyRunning);
    if (!liveRow) {
      autoExpandedLiveId.current = null;
      return;
    }

    if (autoExpandedLiveId.current !== liveRow.topic.id) {
      autoExpandedLiveId.current = liveRow.topic.id;
      setExpanded(liveRow.topic.id);
    }
  }, [finalSorted]);

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

  // Only average over topics where every authoring stage has time logged.
  // A topic with just script tracked skews the mean downward and doesn't
  // represent "time it takes to make one video". Half-tracked topics are
  // disclosed alongside so the number stays honest.
  const fullyTrackedTopics = perTopic.filter(row =>
    STAGES.every(s => row.perStage[s].ms > 0)
  );
  const avgPerTopicMs = fullyTrackedTopics.length
    ? fullyTrackedTopics.reduce((sum, row) => sum + row.totalMs, 0) / fullyTrackedTopics.length
    : 0;
  const partialTopicsCount = perTopic.length - fullyTrackedTopics.length;
  // A topic is "started" the moment any of its authoring stages has more
  // than a second of time logged — anything below is treated as an accidental
  // tap or a runaway that got zeroed out.
  const startedTopicsCount = perTopic.filter(row =>
    STAGES.some(s => row.perStage[s].ms > 1000)
  ).length;
  // Per-stage averages across only fully tracked topics so a lone tracked
  // stage doesn't flatten the mean. Sittings averages come from the same
  // sample so the two rows read as apples-to-apples.
  const perStageAveragesFull = STAGES.map(stage => {
    if (fullyTrackedTopics.length === 0) return { stage, avgMs: 0, avgSittings: 0 };
    const totalMs = fullyTrackedTopics.reduce((sum, row) => sum + row.perStage[stage].ms, 0);
    const totalSittings = fullyTrackedTopics.reduce((sum, row) => sum + row.perStage[stage].sittings, 0);
    return {
      stage,
      avgMs: totalMs / fullyTrackedTopics.length,
      avgSittings: totalSittings / fullyTrackedTopics.length,
    };
  });
  const busiestStage = [...perStageAveragesFull].sort((a, b) => b.avgMs - a.avgMs)[0];

  const handleEditEntry = (timer: TaskTimerRecord) => {
    const current = formatHMS(timer.accumulatedActiveMs);
    const raw = window.prompt(`Edit time for this ${timer.stage} entry (HH:MM:SS):`, current);
    if (raw === null) return;
    const ms = parseTimeInput(raw);
    if (ms === null) { window.alert('Could not parse time.'); return; }
    onUpdateTimer(timer.id, { accumulatedActiveMs: ms });
  };

  const filterLabels = { all: 'All', active: 'Active (running)', paused: 'Paused', 'in-progress': 'In progress', scheduled: 'Scheduled', posted: 'Posted', idea: 'Idea only', 'has-time': 'Has time', 'no-time': 'No time yet' } as const;

  return (
    <div className="space-y-8 font-sans">
      {/* Hero header */}
      <section className="relative overflow-hidden rounded-3xl border border-neutral-800/70 bg-[linear-gradient(135deg,rgba(15,10,30,0.95),rgba(6,10,20,0.98))] p-5 md:p-6 shadow-[0_25px_70px_rgba(0,0,0,0.35)]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-purple-500/30 to-cyan-500/25 text-purple-100 ring-1 ring-white/10 shadow-[0_0_25px_rgba(168,85,247,0.35)]">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-mono text-[14px] uppercase tracking-[.28em] text-purple-300">
                <Sparkles className="h-3 w-3 animate-pulse" /> Time telemetry
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Every second, every stage.</h1>
              <p className="mt-1 text-[14px] text-neutral-400">Per-stage stopwatches, sittings, and averages across every topic in flight.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start lg:self-auto font-mono">
            <div className="relative">
              <button
                type="button"
                onClick={() => { setFilterOpen(o => !o); setSortOpen(false); }}
                className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[14px] text-neutral-200 backdrop-blur-md transition hover:border-white/25 hover:bg-white/10"
              >
                <Filter className="h-3 w-3 text-purple-300" />
                <span className="text-neutral-500">Filter</span>
                <span className="text-neutral-100">{filterLabels[filterMode]}</span>
                <ChevronDown className={`h-3 w-3 text-neutral-500 transition ${filterOpen ? 'rotate-180 text-purple-300' : ''}`} />
              </button>
              {filterOpen && (
                <div className="absolute right-0 mt-1 z-20 w-48 rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur-xl shadow-2xl py-1">
                  {(['all', 'active', 'paused', 'in-progress', 'idea', 'scheduled', 'posted', 'has-time', 'no-time'] as const).map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setFilterMode(opt); setFilterOpen(false); }}
                      className={`block w-full text-left px-3 py-1.5 text-[14px] transition ${filterMode === opt ? 'bg-purple-500/15 text-purple-200' : 'text-neutral-300 hover:bg-white/5 hover:text-white'}`}
                    >{filterLabels[opt]}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setSortOpen(o => !o); setFilterOpen(false); }}
                className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[14px] text-neutral-200 backdrop-blur-md transition hover:border-white/25 hover:bg-white/10"
              >
                <ArrowUpDown className="h-3 w-3 text-cyan-300" />
                <span className="text-neutral-500">Sort</span>
                <span className="text-neutral-100 max-w-[160px] truncate">{SORT_LABELS[sortMode]}</span>
                <ChevronDown className={`h-3 w-3 text-neutral-500 transition ${sortOpen ? 'rotate-180 text-cyan-300' : ''}`} />
              </button>
              {sortOpen && (
                <div className="absolute right-0 mt-1 z-20 w-56 rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur-xl shadow-2xl py-1">
                  {(['default-due-desc-last-worked', 'newest', 'due-date', 'last-worked-on', 'running-first', 'time-desc', 'time-asc', 'progress-most', 'progress-least', 'workload', 'posted-first'] as SortMode[]).map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setSortMode(opt); setSortOpen(false); }}
                      className={`block w-full text-left px-3 py-1.5 text-[14px] transition ${sortMode === opt ? 'bg-cyan-500/15 text-cyan-200' : 'text-neutral-300 hover:bg-white/5 hover:text-white'}`}
                    >{SORT_LABELS[opt]}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* KPI grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Topics listed', value: perTopic.length, sub: 'visible in this view', Icon: Layers, tint: 'from-neutral-500/15 to-transparent', accent: 'text-neutral-100', chip: 'bg-white/5 text-neutral-300 ring-1 ring-white/10' },
          { label: 'Started', value: startedTopicsCount, sub: 'at least one stage timed > 1s', Icon: Play, tint: 'from-amber-500/15 to-transparent', accent: 'text-amber-200', chip: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/30' },
          { label: 'Avg per topic', value: fullyTrackedTopics.length ? formatShort(avgPerTopicMs) : '—', sub: fullyTrackedTopics.length ? `${fullyTrackedTopics.length} fully tracked · ${partialTopicsCount} partial excluded` : partialTopicsCount > 0 ? `${partialTopicsCount} partial · none fully tracked` : 'track every stage on one topic', Icon: TrendingUp, tint: 'from-emerald-500/15 to-transparent', accent: 'text-emerald-200', chip: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/30' },
          { label: 'Total hours worked', value: formatShort(grandTotalMs), sub: 'across every stage and topic', Icon: Clock, tint: 'from-cyan-500/15 to-transparent', accent: 'text-cyan-200', chip: 'bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/30' },
        ].map(tile => (
          <div
            key={tile.label}
            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/60 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 hover:border-white/25"
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tile.tint} opacity-90`} />
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-[13px] uppercase tracking-[.24em] text-neutral-500">{tile.label}</div>
                <div className={`mt-2 text-2xl font-bold tracking-tight ${tile.accent}`}>{tile.value}</div>
                <div className="mt-1 text-[14px] text-neutral-500 leading-snug">{tile.sub}</div>
              </div>
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tile.chip}`}>
                <tile.Icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Busiest stage — hero card */}
      {(() => {
        const busy = busiestStage && busiestStage.avgMs > 0 ? busiestStage : null;
        const palette = busy ? STAGE_PALETTE[busy.stage] : null;
        return (
          <section
            className={`relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_15px_50px_rgba(0,0,0,0.35)]`}
            style={busy ? { boxShadow: `0 15px 50px rgba(0,0,0,0.35), 0 0 60px ${palette!.glowVar}` } : undefined}
          >
            {busy && palette && <div className={`pointer-events-none absolute inset-0 ${palette.tintBg}`} />}
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl" style={busy ? { background: palette!.glowVar } : undefined} />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className={`grid h-14 w-14 place-items-center rounded-2xl ${busy && palette ? palette.iconBg : 'bg-white/5 text-neutral-500 ring-1 ring-white/10'}`}>
                  {busy ? STAGE_ICON[busy.stage] : <Flame className="h-5 w-5" />}
                </div>
                <div>
                  <div className="font-mono text-[14px] uppercase tracking-[.28em] text-neutral-500 flex items-center gap-1.5">
                    <Flame className="h-3 w-3" /> Busiest stage
                  </div>
                  <div className={`mt-1 text-3xl font-bold tracking-tight ${busy && palette ? palette.text : 'text-neutral-400'}`}>
                    {busy ? STAGE_LABEL[busy.stage] : '—'}
                  </div>
                  <div className="mt-1 text-[14px] text-neutral-400">
                    {busy
                      ? <>Averages <span className={`font-semibold ${palette!.text}`}>{formatShort(busy.avgMs)}</span> per topic over the tracked sample.</>
                      : 'Need at least one topic with every stage tracked.'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 min-w-[128px] backdrop-blur-md">
                  <div className="font-mono text-[13px] uppercase tracking-[.22em] text-neutral-500">Sample size</div>
                  <div className="mt-1 text-lg font-bold text-white tabular-nums">{fullyTrackedTopics.length} <span className="text-[14px] font-normal text-neutral-500">/ {perTopic.length}</span></div>
                  <div className="text-[14px] text-neutral-500">fully tracked</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 min-w-[128px] backdrop-blur-md">
                  <div className="font-mono text-[13px] uppercase tracking-[.22em] text-neutral-500">Avg sittings</div>
                  <div className={`mt-1 text-lg font-bold ${busy && palette ? palette.text : 'text-neutral-400'} tabular-nums`}>{busy ? formatAvgSittings(busy.avgSittings) : '—'}</div>
                  <div className="text-[14px] text-neutral-500">on this stage</div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* Per-stage averages — one video */}
      <section className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
        <div className="flex items-baseline justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-500/10 text-purple-300 ring-1 ring-purple-400/25">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <div className="font-mono text-[14px] uppercase tracking-[.28em] text-purple-300">Avg per stage · one video</div>
              <div className="text-[14px] text-neutral-500 mt-0.5">only topics with every stage tracked contribute</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[14px] text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
            {fullyTrackedTopics.length} sample
          </div>
        </div>
        {fullyTrackedTopics.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-[14px] rounded-xl border border-dashed border-white/10">
            No topic has all {STAGES.length} stages tracked yet.
            {partialTopicsCount > 0 && ` ${partialTopicsCount} partial topic${partialTopicsCount === 1 ? '' : 's'} excluded.`}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {perStageAveragesFull.map(s => {
              const palette = STAGE_PALETTE[s.stage];
              const isBusy = busiestStage?.stage === s.stage && busiestStage.avgMs > 0;
              return (
                <div
                  key={s.stage}
                  className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/70 p-4 transition hover:-translate-y-0.5 hover:border-white/25`}
                  style={isBusy ? { boxShadow: `0 0 25px ${palette.glowVar}` } : undefined}
                >
                  <div className={`pointer-events-none absolute inset-0 ${palette.tintBg}`} />
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`grid h-8 w-8 place-items-center rounded-xl ${palette.iconBg}`}>{STAGE_ICON[s.stage]}</div>
                      <span className={`font-mono text-[14px] uppercase tracking-[.22em] ${palette.text}`}>{STAGE_LABEL[s.stage]}</span>
                    </div>
                    {isBusy && <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[13px] uppercase tracking-wider text-neutral-300">Busiest</span>}
                  </div>
                  <div className="relative z-10 mt-3 text-2xl font-bold tracking-tight text-white tabular-nums">{formatShort(s.avgMs)}</div>
                  <div className={`relative z-10 mt-1 text-[14px] ${palette.softText} tabular-nums`}>
                    {formatAvgSittings(s.avgSittings)} sittings avg
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Total time by stage — gradient bars */}
      <section className="rounded-2xl border border-white/10 bg-neutral-950/60 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.25)]">
        <div className="flex items-baseline justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/25">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <div className="font-mono text-[14px] uppercase tracking-[.28em] text-cyan-300">Total time by stage</div>
              <div className="text-[14px] text-neutral-500 mt-0.5">every topic, every sitting</div>
            </div>
          </div>
          <div className="hidden md:block font-mono text-[14px] text-neutral-500">{formatShort(grandTotalMs)} total</div>
        </div>
        <div className="space-y-3">
          {stageAggregate.map(s => {
            const pct = grandTotalMs > 0 ? (s.ms / grandTotalMs) * 100 : 0;
            const palette = STAGE_PALETTE[s.stage];
            return (
              <div key={s.stage} className="space-y-1.5">
                <div className="flex justify-between items-center text-[14px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full`} style={{ background: palette.glowVar, boxShadow: `0 0 8px ${palette.glowVar}` }} />
                    <span className={`${palette.text} font-semibold`}>{STAGE_LABEL[s.stage]}</span>
                  </div>
                  <span className="text-neutral-400 tabular-nums">
                    <span className="text-neutral-200 font-semibold">{formatShort(s.ms)}</span>
                    <span className="text-neutral-600"> · </span>
                    {s.uniqueTopics} topics
                    <span className="text-neutral-600"> · </span>
                    {s.sittings} sittings
                  </span>
                </div>
                <div className="h-2 rounded-full bg-neutral-900/80 overflow-hidden ring-1 ring-white/5">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${palette.bar} transition-[width] duration-500 ease-out`}
                    style={{ width: `${pct}%`, boxShadow: `0 0 12px ${palette.glowVar}` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Topic list */}
      <div className="space-y-2">
        {finalSorted.length === 0 && (
          <div className="text-center py-6 text-neutral-500 text-[14px] border border-dashed border-neutral-800 rounded-lg">
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
                    <span className="px-1.5 py-0.5 rounded text-[13px] border border-neutral-800 text-neutral-400">{t.channel}</span>
                    <span className="px-1.5 py-0.5 rounded text-[13px] border border-blue-900/40 text-blue-400 bg-blue-950/20 uppercase">{t.status}</span>
                    {row.anyRunning && <span className="text-[13px] text-emerald-400 font-bold">● LIVE</span>}
                    {!row.anyRunning && row.anyPaused && <span className="text-[13px] text-amber-400 font-bold">◐ PAUSED</span>}
                  </div>
                  <div className="text-[13px] text-neutral-500 mt-0.5">
                    Created {new Date(t.createdDate).toLocaleDateString()} · Due {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'None'}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 font-sans">
                  {STAGES.map(s => (
                    <div key={s} className="text-center min-w-[3.5rem]">
                      <div className="text-[14px] uppercase text-neutral-200 font-semibold tracking-wide">{STAGE_LABEL[s]}</div>
                      <div className={`text-[15px] font-mono font-semibold ${row.perStage[s].running ? 'text-emerald-300' : row.perStage[s].paused ? 'text-amber-300' : row.perStage[s].done ? 'text-neutral-100' : 'text-neutral-500'}`}>
                        {row.perStage[s].ms > 0 ? formatShort(row.perStage[s].ms) : '—'}
                      </div>
                      <div className="text-[14px] font-mono text-cyan-300 font-semibold">
                        {row.perStage[s].sittings > 0 ? `×${row.perStage[s].sittings}` : ''}
                      </div>
                    </div>
                  ))}
                  <div className="text-center min-w-[3.5rem] pl-2 border-l border-neutral-800">
                    <div className="text-[14px] uppercase text-neutral-200 font-semibold tracking-wide">Total</div>
                    <div className="text-[15px] font-mono font-bold text-white">{row.totalMs > 0 ? formatShort(row.totalMs) : '—'}</div>
                    <div className="text-[14px] text-neutral-400">{row.totalSittings} sittings</div>
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
                    <div className={`relative overflow-hidden rounded-2xl border px-8 py-7 shadow-[0_0_30px_rgba(0,0,0,0.22)] ${activeTone}`}>
                      <div className={`absolute inset-0 pointer-events-none ${activeInfo.running ? 'bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_55%)]' : activeInfo.paused ? 'bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_55%)]' : 'bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.04),transparent_55%)]'}`} />
                      <div className="relative flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[14px] font-bold uppercase tracking-[0.28em] ${activeInfo.running ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : activeInfo.paused ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-neutral-700 bg-neutral-900 text-neutral-300'}`}>
                              {STAGE_LABEL[activeStage]}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[14px] font-bold uppercase tracking-[0.28em] ${activeInfo.running ? 'bg-emerald-500/15 text-emerald-300' : activeInfo.paused ? 'bg-amber-500/15 text-amber-300' : 'bg-neutral-800 text-neutral-400'}`}>
                              {activeInfo.running ? 'Live stopwatch' : activeInfo.paused ? 'Paused' : 'Stopped'}
                            </span>
                          </div>
                          <div className="mt-5 flex items-end gap-4">
                            <div className={`tabular-nums font-black tracking-tighter leading-none ${activeInfo.running ? 'text-6xl sm:text-7xl lg:text-[7rem]' : 'text-5xl sm:text-6xl lg:text-[6.25rem]'} ${activeInfo.running ? 'text-white' : activeInfo.paused ? 'text-amber-100' : 'text-neutral-100'}`}>
                              {formatHMS(activeInfo.ms)}
                            </div>
                            <div className="pb-4 text-xs text-neutral-400">
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
                            className="rounded-full border border-emerald-700/60 bg-emerald-500/10 px-4 py-2 text-[14px] font-bold uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-500/15"
                          >
                            {activeInfo.paused ? 'Resume' : 'Start'} {STAGE_LABEL[activeStage]}
                          </button>
                        )}
                        {activeInfo.running && (
                          <button
                            type="button"
                            onClick={onPauseTimer}
                            className="rounded-full border border-amber-700/60 bg-amber-500/10 px-4 py-2 text-[14px] font-bold uppercase tracking-[0.2em] text-amber-200 hover:bg-amber-500/15"
                          >
                            Pause {STAGE_LABEL[activeStage]}
                          </button>
                        )}
                      <button
                          type="button"
                          disabled={activeInfo.ms === 0 && !activeInfo.running && !activeInfo.paused}
                          onClick={() => onCompleteStage(t.id, activeStage)}
                          className="rounded-full border border-blue-700/60 bg-blue-500/10 px-4 py-2 text-[14px] font-bold uppercase tracking-[0.2em] text-blue-200 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Done
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const stageKey = `${t.id}-${activeStage}`;
                            setEditingStageKey(stageKey);
                            setEditingStageValue(formatHMS(activeInfo.ms));
                          }}
                          className="rounded-full border border-neutral-800 bg-neutral-950/60 px-2.5 py-1 text-[13px] font-bold uppercase tracking-[0.18em] text-neutral-400 hover:border-blue-500/40 hover:text-blue-300"
                        >
                          Edit time
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const stageKey = `${t.id}-${activeStage}`;
                            setEditingSittingsKey(stageKey);
                            setEditingSittingsValue(String(Math.max(1, activeInfo.sittings || 1)));
                          }}
                          className="rounded-full border border-neutral-800 bg-neutral-950/60 px-2.5 py-1 text-[13px] font-bold uppercase tracking-[0.18em] text-neutral-400 hover:border-cyan-500/40 hover:text-cyan-300"
                        >
                          Edit sittings
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
                            className={`rounded-2xl border p-4 transition-all duration-300 ${isActive ? info.running ? 'border-emerald-500/60 bg-emerald-950/25 shadow-[0_0_20px_rgba(16,185,129,0.08)]' : info.paused ? 'border-amber-500/60 bg-amber-950/20 shadow-[0_0_20px_rgba(245,158,11,0.08)]' : 'border-neutral-700 bg-neutral-900/70' : 'border-neutral-800 bg-neutral-950/85 hover:border-neutral-700'}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className={`font-bold uppercase tracking-[0.2em] ${isActive ? 'text-[14px] text-neutral-100' : 'text-[13px] text-neutral-400'}`}>
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
                                      className="w-full rounded border border-blue-600 bg-neutral-900 px-2 py-1 text-[14px] font-mono text-white outline-none"
                                      placeholder="HH:MM:SS"
                                    />
                                  ) : (
                                    formatHMS(info.ms)
                                  )}
                                </div>
                              </div>
                              <div className={`shrink-0 grid h-11 w-11 place-items-center rounded-full border ${isActive ? info.running ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : info.paused ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-neutral-700 bg-neutral-900 text-neutral-300' : 'border-neutral-800 bg-neutral-950 text-neutral-500'}`}>
                                {STAGE_ICON[s]}
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2 text-[13px] text-neutral-500">
                              <span>{info.sittings} sittings</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const stageKey = `${t.id}-${s}`;
                                  setEditingSittingsKey(stageKey);
                                  setEditingSittingsValue(String(Math.max(1, info.sittings || 1)));
                                }}
                                title="Edit sittings count"
                                className="rounded border border-neutral-800 px-2 py-1 text-[13px] font-bold uppercase tracking-[0.18em] text-neutral-400 hover:border-cyan-500/40 hover:text-cyan-300"
                              >
                                Split
                              </button>
                            </div>

                            {editingSittingsKey === `${t.id}-${s}` && (
                              <div className="mt-2 flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/80 px-2 py-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  autoFocus
                                  value={editingSittingsValue}
                                  onFocus={(e) => e.currentTarget.select()}
                                  onClick={(e) => e.currentTarget.select()}
                                  onChange={(e) => setEditingSittingsValue(e.target.value.replace(/[^\d]/g, ""))}
                                  className="w-20 rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-[14px] font-mono text-white outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const n = parseInt(editingSittingsValue.trim(), 10);
                                    if (!Number.isFinite(n) || n < 1) {
                                      window.alert("Enter a whole number >= 1.");
                                      return;
                                    }
                                    onSetStageTotals(t.id, s, info.ms, n);
                                    setEditingSittingsKey(null);
                                  }}
                                  className="rounded border border-cyan-700/60 bg-cyan-500/10 px-2.5 py-1 text-[13px] font-bold uppercase tracking-[0.18em] text-cyan-200 hover:bg-cyan-500/15"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSittingsKey(null)}
                                  className="rounded border border-neutral-800 px-2.5 py-1 text-[13px] font-bold uppercase tracking-[0.18em] text-neutral-400 hover:text-neutral-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}

                            <div className="mt-2 flex gap-1.5">
                              {!info.running && (
                                <button
                                  type="button"
                                  onClick={() => onStartTimer(t.id, s)}
                                  className="flex-1 rounded-lg border border-emerald-800/60 bg-emerald-500/10 px-2 py-1.5 text-[13px] font-bold uppercase tracking-[0.18em] text-emerald-200 hover:bg-emerald-500/15"
                                >
                                  {info.paused ? 'Resume' : 'Start'}
                                </button>
                              )}
                              {info.running && (
                                <button
                                  type="button"
                                  onClick={onPauseTimer}
                                  className="flex-1 rounded-lg border border-amber-800/60 bg-amber-500/10 px-2 py-1.5 text-[13px] font-bold uppercase tracking-[0.18em] text-amber-200 hover:bg-amber-500/15"
                                >
                                  Pause
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={info.ms === 0 && !info.running && !info.paused}
                                onClick={() => onCompleteStage(t.id, s)}
                                className="rounded-lg border border-blue-800/60 bg-blue-500/10 px-2 py-1.5 text-[13px] font-bold uppercase tracking-[0.18em] text-blue-200 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Done
                                </button>
                              </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const stageKey = `${t.id}-${s}`;
                                  setEditingStageKey(stageKey);
                                  setEditingStageValue(formatHMS(info.ms));
                                }}
                                className="rounded-full border border-neutral-800 bg-neutral-950/60 px-2.5 py-1 text-[13px] font-bold uppercase tracking-[0.18em] text-neutral-400 hover:border-blue-500/40 hover:text-blue-300"
                              >
                                Edit time
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const stageKey = `${t.id}-${s}`;
                                  setEditingSittingsKey(stageKey);
                                  setEditingSittingsValue(String(Math.max(1, info.sittings || 1)));
                                }}
                                className="rounded-full border border-neutral-800 bg-neutral-950/60 px-2.5 py-1 text-[13px] font-bold uppercase tracking-[0.18em] text-neutral-400 hover:border-cyan-500/40 hover:text-cyan-300"
                              >
                                Edit sittings
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
                        className="flex w-full items-center justify-between border-b border-neutral-800/80 px-3 py-2 text-[14px] uppercase tracking-[0.22em] text-neutral-500 hover:text-neutral-200"
                        aria-expanded={entriesOpen === t.id}
                      >
                        <span>Time entries ({row.timers.length})</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${entriesOpen === t.id ? 'rotate-180' : ''}`} />
                      </button>
                      {entriesOpen === t.id ? (
                      <div className="divide-y divide-neutral-900">
                        {row.timers.slice().sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).map(timer => (
                          <div key={timer.id} className="flex items-start justify-between gap-3 px-3 py-2 text-[14px]">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-neutral-800 px-2 py-0.5 text-[13px] font-bold uppercase tracking-[0.18em] text-neutral-300">{STAGE_LABEL[timer.stage]}</span>
                                <span className="font-mono text-sm font-semibold text-neutral-100 tabular-nums">{formatHMS(timer.accumulatedActiveMs)}</span>
                                <span className="text-neutral-600">·</span>
                                {(() => {
                                  const n = timer.segments && timer.segments.length > 0
                                    ? timer.segments.length
                                    : timer.status === 'paused' ? timer.breaksCount : timer.breaksCount + 1;
                                  return <span className="text-neutral-500 text-[13px]">{new Date(timer.startedAt).toLocaleDateString()} · {n} sitting{n === 1 ? '' : 's'}</span>;
                                })()}
                                <span className={`rounded-full border px-2 py-0.5 text-[13px] font-bold uppercase tracking-[0.18em] ${timer.status === 'running' ? 'border-emerald-900 text-emerald-300' : timer.status === 'paused' ? 'border-amber-900 text-amber-300' : 'border-neutral-800 text-neutral-500'}`}>{timer.status}</span>
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



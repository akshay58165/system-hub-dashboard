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
  onUpdateTimer: (timerId: string, patch: Partial<TaskTimerRecord>) => void;
  onDeleteTimer: (timerId: string) => void;
}

type SortMode = TopicSortMode | 'newest' | 'time-desc' | 'time-asc' | 'running-first';

const SORT_LABELS: Partial<Record<SortMode, string>> = {
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
  onStartTimer, onPauseTimer, onCompleteStage, onAddManualTime, onUpdateTimer, onDeleteTimer
}: TimeViewProps) {
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
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

  const sorted = useMemo(() => {
    const rows = [...perTopic];
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
      default:
        rows.sort((a, b) => new Date(b.topic.createdDate).getTime() - new Date(a.topic.createdDate).getTime());
    }
    return rows;
  }, [perTopic, sortMode]);

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
        <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen(o => !o)}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-800 bg-neutral-950 text-[10px] text-neutral-300 hover:border-neutral-700"
          >
            <span>Sort: {SORT_LABELS[sortMode]}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {sortOpen && (
            <div className="absolute right-0 mt-1 z-10 w-44 rounded border border-neutral-800 bg-neutral-950 shadow-xl py-1">
              {(['newest', 'due-date', 'running-first', 'time-desc', 'time-asc', 'progress-most', 'progress-least', 'workload'] as SortMode[]).map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { setSortMode(opt); setSortOpen(false); }}
                  className={`block w-full text-left px-2 py-1 text-[10px] hover:bg-neutral-900 ${sortMode === opt ? 'text-purple-300' : 'text-neutral-300'}`}
                >{SORT_LABELS[opt]}</button>
              ))}
            </div>
          )}
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
        {sorted.length === 0 && (
          <div className="text-center py-6 text-neutral-500 text-[10px] border border-dashed border-neutral-800 rounded-lg">
            No topics yet. Add one from the Pipeline.
          </div>
        )}
        {sorted.map(row => {
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
                <div className="flex items-center gap-3 shrink-0 font-mono">
                  {STAGES.map(s => (
                    <div key={s} className="text-center min-w-[3.5rem]">
                      <div className="text-[8px] uppercase text-neutral-500">{STAGE_LABEL[s]}</div>
                      <div className={`text-[10px] font-bold ${row.perStage[s].running ? 'text-emerald-300' : row.perStage[s].paused ? 'text-amber-300' : row.perStage[s].done ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        {row.perStage[s].ms > 0 ? formatShort(row.perStage[s].ms) : '—'}
                      </div>
                      <div className="text-[8px] text-cyan-500">
                        {row.perStage[s].sittings > 0 ? `×${row.perStage[s].sittings}` : ''}
                      </div>
                    </div>
                  ))}
                  <div className="text-center min-w-[3.5rem] pl-2 border-l border-neutral-800">
                    <div className="text-[8px] uppercase text-neutral-500">Total</div>
                    <div className="text-[11px] font-bold text-white">{row.totalMs > 0 ? formatShort(row.totalMs) : '—'}</div>
                    <div className="text-[8px] text-neutral-500">{row.totalSittings} sittings</div>
                  </div>
                  <ChevronDown className={`h-3 w-3 text-neutral-500 transition ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-neutral-800 bg-neutral-950/70 p-3 space-y-3">
                  {/* Per-stage controls */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {STAGES.map(s => {
                      const info = row.perStage[s];
                      return (
                        <div key={s} className="rounded border border-neutral-800 bg-neutral-950 p-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold uppercase text-neutral-300">{STAGE_LABEL[s]}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const raw = window.prompt(`Add time for ${s} (HH:MM:SS or minutes):`, '00:30:00');
                                if (raw === null) return;
                                const ms = parseTimeInput(raw);
                                if (ms === null) { window.alert('Could not parse.'); return; }
                                onAddManualTime(t.id, s, ms);
                              }}
                              title="Add time manually"
                              className="p-0.5 rounded border border-neutral-800 text-neutral-500 hover:text-blue-300"
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                          </div>
                          <div className={`text-[11px] font-mono mt-1 ${info.running ? 'text-emerald-300' : info.paused ? 'text-amber-300' : 'text-neutral-300'}`}>
                            {formatHMS(info.ms)}
                          </div>
                          <div className="text-[8px] text-neutral-500 mt-0.5">{info.sittings} sittings</div>
                          <div className="flex gap-1 mt-1.5">
                            {!info.running && (
                              <button
                                type="button"
                                onClick={() => onStartTimer(t.id, s)}
                                className="flex-1 px-1 py-0.5 text-[8px] font-bold rounded border border-emerald-800/60 text-emerald-300 hover:bg-emerald-500/15"
                              >{info.paused ? 'Resume' : 'Start'}</button>
                            )}
                            {info.running && (
                              <button
                                type="button"
                                onClick={onPauseTimer}
                                className="flex-1 px-1 py-0.5 text-[8px] font-bold rounded border border-amber-800/60 text-amber-300 hover:bg-amber-500/15"
                              >Pause</button>
                            )}
                            <button
                              type="button"
                              disabled={info.ms === 0 && !info.running && !info.paused}
                              onClick={() => onCompleteStage(t.id, s)}
                              className="px-1 py-0.5 text-[8px] font-bold rounded border border-blue-800/60 text-blue-300 hover:bg-blue-500/15 disabled:opacity-40"
                            >Done</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Individual entries — editable & deletable */}
                  {row.timers.length > 0 && (
                    <div className="rounded border border-neutral-800 bg-neutral-950">
                      <div className="px-2 py-1 border-b border-neutral-800 text-[9px] uppercase text-neutral-500 tracking-wider">
                        Time entries ({row.timers.length})
                      </div>
                      <div className="divide-y divide-neutral-900">
                        {row.timers.slice().sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).map(timer => (
                          <div key={timer.id} className="flex items-center justify-between px-2 py-1.5 text-[10px]">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="uppercase text-[9px] font-bold text-neutral-400 min-w-[3rem]">{STAGE_LABEL[timer.stage]}</span>
                              <span className="text-neutral-300 font-mono">{formatHMS(timer.accumulatedActiveMs)}</span>
                              <span className="text-neutral-600">·</span>
                              {(() => {
                                const n = timer.segments && timer.segments.length > 0
                                  ? timer.segments.length
                                  : timer.status === 'paused' ? timer.breaksCount : timer.breaksCount + 1;
                                return <span className="text-neutral-500 text-[9px]">{new Date(timer.startedAt).toLocaleDateString()} · {n} sitting{n === 1 ? '' : 's'}</span>;
                              })()}
                              <span className={`px-1 rounded text-[8px] ${timer.status === 'running' ? 'text-emerald-300 border border-emerald-900' : timer.status === 'paused' ? 'text-amber-300 border border-amber-900' : 'text-neutral-500 border border-neutral-800'}`}>{timer.status}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleEditEntry(timer)}
                                title="Edit time"
                                className="p-1 rounded border border-neutral-800 text-neutral-400 hover:text-blue-300"
                              ><Pencil className="h-2.5 w-2.5" /></button>
                              <button
                                type="button"
                                onClick={() => { if (window.confirm('Delete this time entry?')) onDeleteTimer(timer.id); }}
                                title="Delete entry"
                                className="p-1 rounded border border-neutral-800 text-neutral-400 hover:text-rose-400"
                              ><Trash2 className="h-2.5 w-2.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

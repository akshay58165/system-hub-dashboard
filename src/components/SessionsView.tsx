import React, { useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Clock3, Coffee, Flame, Layers, ListChecks, Target, Timer, Trash2, TrendingUp, Zap } from 'lucide-react';
import type { SessionRecord, TaskTimerRecord, TaskTimerStage } from '../types';

interface SessionsViewProps {
  sessions: SessionRecord[];
  embedded?: boolean;
}

type ViewMode = 'session' | 'topic' | 'task';
type DateRangePreset = 'today' | 'yesterday' | 'last7' | 'custom';

// Return [startMs, endMs] (both inclusive) for the requested preset, or null
// if a custom range is incomplete/invalid — an incomplete range means "show
// nothing yet" rather than silently defaulting to something else.
function resolveDateRange(preset: DateRangePreset, customFrom: string, customTo: string): [number, number] | null {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;
  if (preset === 'today') return [startOfToday, endOfToday];
  if (preset === 'yesterday') return [startOfToday - 24 * 60 * 60 * 1000, startOfToday - 1];
  if (preset === 'last7') return [startOfToday - 6 * 24 * 60 * 60 * 1000, endOfToday];
  // custom
  if (!customFrom || !customTo) return null;
  const fromMs = new Date(`${customFrom}T00:00:00`).getTime();
  const toMs = new Date(`${customTo}T23:59:59.999`).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return null;
  return [fromMs, toMs];
}

const formatDuration = (ms: number) => {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};
const stageLabels: Record<TaskTimerStage, string> = { hook: 'Hooking', script: 'Scripting', shoot: 'Shooting', edit: 'Editing', schedule: 'Scheduling', post: 'Publishing' };
const stageShortLabels: Record<TaskTimerStage, string> = { hook: 'Hook', script: 'Script', shoot: 'Shoot', edit: 'Edit', schedule: 'Schedule', post: 'Post' };
// Stages surfaced to the Task filter. "post" is intentionally excluded —
// the app auto-posts a scheduled topic once its release time passes, so no
// user-tracked timer ever exists for that stage.
const stageOrder: TaskTimerStage[] = ['hook', 'script', 'shoot', 'edit', 'schedule'];

// A single timer rendered as a card. Shared by all three views so the metrics
// mean the same thing everywhere — session-based, topic-based, task-based all
// resolve to the same underlying TaskTimerRecord fields.
type TimerCardProps = {
  timer: TaskTimerRecord;
  session: SessionRecord;
  headline: 'topic' | 'stage';
  key?: React.Key;
};

function TimerCard({ timer, session, headline }: TimerCardProps) {
  const sessionDate = new Date(session.startedAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const startedTime = new Date(timer.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const endedTime = timer.completedAt ? new Date(timer.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div className="rounded-lg border border-cyan-950/60 bg-cyan-950/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-100 truncate">
            {headline === 'topic' ? timer.topicName : stageLabels[timer.stage]}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono text-neutral-500">
            <span className="font-bold uppercase tracking-wider text-cyan-300">
              {headline === 'topic' ? stageLabels[timer.stage] : timer.topicName}
            </span>
            <span>·</span>
            <span>{sessionDate}</span>
            <span>·</span>
            <span>{startedTime}{endedTime ? `–${endedTime}` : ' (still active)'}</span>
          </div>
        </div>
        <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase ${timer.endReason === 'done' ? 'bg-emerald-950/40 text-emerald-300' : 'bg-amber-950/40 text-amber-300'}`}>
          {timer.endReason === 'done' ? 'Completed' : 'Deferred'}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="font-mono text-sm font-bold text-emerald-300">{formatDuration(timer.accumulatedActiveMs)}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">Active</div>
        </div>
        <div>
          <div className="font-mono text-sm font-bold text-amber-300">{formatDuration(timer.accumulatedPausedMs)}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">Paused</div>
        </div>
        <div>
          <div className="font-mono text-sm font-bold text-cyan-300">{timer.breaksCount}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">Breaks</div>
        </div>
        <div>
          <div className="font-mono text-sm font-bold text-purple-300">{timer.productivityScore ? `${timer.productivityScore * 10}%` : '--'}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">Productive</div>
        </div>
      </div>
    </div>
  );
}

// Buckets used to colour the productivity chip and the active-time bar.
function productivityBand(pct: number): { tone: 'ember' | 'gold' | 'lime'; badgeCls: string; barCls: string; label: string; icon: React.ComponentType<{ className?: string }> } {
  if (pct >= 70) return { tone: 'lime', badgeCls: 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300', barCls: 'from-emerald-400 to-emerald-600', label: 'Deep', icon: Flame };
  if (pct >= 40) return { tone: 'gold', badgeCls: 'border-amber-800/60 bg-amber-950/40 text-amber-300', barCls: 'from-amber-400 to-amber-600', label: 'Steady', icon: Zap };
  return { tone: 'ember', badgeCls: 'border-rose-800/60 bg-rose-950/40 text-rose-300', barCls: 'from-rose-400 to-rose-600', label: 'Shallow', icon: TrendingUp };
}

export default function SessionsView({ sessions, embedded = false }: SessionsViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('session');
  const [taskStageFilter, setTaskStageFilter] = useState<TaskTimerStage | 'all'>('all');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last7');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const orderedAll = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime()),
    [sessions]
  );
  // Session date-range filter. Anchoring on startedAt (not endedAt) keeps a
  // session that started 11:30pm yesterday under "yesterday" — the diary
  // convention — even if it ended after midnight.
  const dateRange = useMemo(() => resolveDateRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo]);
  const ordered = useMemo(() => {
    if (!dateRange) return [];
    const [from, to] = dateRange;
    return orderedAll.filter(session => {
      const startedMs = new Date(session.startedAt).getTime();
      return startedMs >= from && startedMs <= to;
    });
  }, [orderedAll, dateRange]);

  // Flatten every task timer across every session, keeping the containing
  // session so the topic-based and task-based views can attribute each entry
  // to its real session (date, time range). No fabricated data: only records
  // that were actually archived on a SessionRecord are surfaced.
  //
  // Dedupe: if the same timer.id appears in more than one SessionRecord
  // (deferred/resumed timers can be snapshotted in both), keep the snapshot
  // with the largest accumulatedActiveMs — that's the true final state of
  // that task. Attribute the card to the session that owns that snapshot.
  // This keeps topic/task rollups honest (no double-counted minutes).
  const flatTimers = useMemo(() => {
    const bestById = new Map<string, { timer: TaskTimerRecord; session: SessionRecord }>();
    ordered.forEach(session => {
      (session.taskTimers || []).forEach(timer => {
        const existing = bestById.get(timer.id);
        if (!existing || timer.accumulatedActiveMs > existing.timer.accumulatedActiveMs) {
          bestById.set(timer.id, { timer, session });
        }
      });
    });
    return Array.from(bestById.values()).sort(
      (a, b) => new Date(b.timer.startedAt).getTime() - new Date(a.timer.startedAt).getTime()
    );
  }, [ordered]);

  // Group by topic — key on topicId (stable across renames), display the
  // most recent snapshot of topicName. Roll-ups (totals, stage count, last
  // touched) are computed from the same flatTimers source of truth.
  const topicGroups = useMemo(() => {
    const map = new Map<string, {
      topicId: string;
      topicName: string;
      entries: Array<{ timer: TaskTimerRecord; session: SessionRecord }>;
      totalActiveMs: number;
      stages: Set<TaskTimerStage>;
      lastStartedAt: number;
    }>();
    flatTimers.forEach(({ timer, session }) => {
      const existing = map.get(timer.topicId) ?? {
        topicId: timer.topicId,
        topicName: timer.topicName,
        entries: [],
        totalActiveMs: 0,
        stages: new Set<TaskTimerStage>(),
        lastStartedAt: 0
      };
      existing.entries.push({ timer, session });
      existing.totalActiveMs += timer.accumulatedActiveMs;
      existing.stages.add(timer.stage);
      const startedMs = new Date(timer.startedAt).getTime();
      if (startedMs > existing.lastStartedAt) {
        existing.lastStartedAt = startedMs;
        existing.topicName = timer.topicName; // freshest snapshot wins
      }
      map.set(timer.topicId, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.lastStartedAt - a.lastStartedAt);
  }, [flatTimers]);

  // Group by stage. Also compute which stages actually have data so the
  // filter buttons only offer real options — no dead choices.
  const taskGroups = useMemo(() => {
    const map = new Map<TaskTimerStage, {
      stage: TaskTimerStage;
      entries: Array<{ timer: TaskTimerRecord; session: SessionRecord }>;
      totalActiveMs: number;
      uniqueTopicIds: Set<string>;
    }>();
    flatTimers.forEach(({ timer, session }) => {
      const existing = map.get(timer.stage) ?? {
        stage: timer.stage,
        entries: [],
        totalActiveMs: 0,
        uniqueTopicIds: new Set<string>()
      };
      existing.entries.push({ timer, session });
      existing.totalActiveMs += timer.accumulatedActiveMs;
      existing.uniqueTopicIds.add(timer.topicId);
      map.set(timer.stage, existing);
    });
    return stageOrder.flatMap(stage => {
      const group = map.get(stage);
      return group ? [group] : [];
    });
  }, [flatTimers]);
  const availableStages = useMemo(() => taskGroups.map(g => g.stage), [taskGroups]);

  if (orderedAll.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-8 text-center">
        <Target className="mx-auto h-8 w-8 text-purple-400" />
        {!embedded && <h1 className="mt-3 text-xl font-bold text-white">Sessions</h1>}
        <p className="mt-2 text-sm text-neutral-500">No completed work sessions yet. Start the day from the header, then end it to see the full record here.</p>
      </div>
    );
  }

  const rangeLabel = datePreset === 'today' ? 'today'
    : datePreset === 'yesterday' ? 'yesterday'
    : datePreset === 'last7' ? 'the last 7 days'
    : dateRange ? `${new Date(dateRange[0]).toLocaleDateString()} – ${new Date(dateRange[1]).toLocaleDateString()}`
    : 'the selected range';

  return (
    <div className="space-y-5 pb-10">
      {!embedded && <div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-purple-400">
          <Clock3 className="h-4 w-4" />Session history
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">Sessions</h1>
        <p className="mt-1 text-sm text-neutral-500">{ordered.length} session{ordered.length === 1 ? '' : 's'} in {rangeLabel} · {orderedAll.length} recorded overall.</p>
      </div>}

      {/* View + date range — three lenses over the same underlying data,
          scoped by the date range on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {([
            { id: 'session', label: 'By Session', icon: Clock3, hint: 'Diary of every completed workday' },
            { id: 'topic', label: 'By Topic', icon: Layers, hint: 'Group every task by the topic it belonged to' },
            { id: 'task', label: 'By Task', icon: ListChecks, hint: 'Filter by production stage (hook, script, shoot, edit…)' }
          ] as const).map(option => {
            const Icon = option.icon;
            const isActive = viewMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setViewMode(option.id)}
                title={option.hint}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono font-semibold transition ${
                  isActive
                    ? 'border-purple-700 bg-purple-950/40 text-purple-200'
                    : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-neutral-500" />
          {([
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'last7', label: 'Last 7 days' },
            { id: 'custom', label: 'Custom' }
          ] as const).map(option => {
            const isActive = datePreset === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setDatePreset(option.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-mono font-semibold transition ${
                  isActive
                    ? 'border-amber-700 bg-amber-950/40 text-amber-200'
                    : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                {option.label}
              </button>
            );
          })}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-950/60 px-2.5 py-1 text-xs font-mono">
              <label className="flex items-center gap-1.5">
                <span className="text-neutral-500">From</span>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none focus:border-amber-700"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-neutral-500">To</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={e => setCustomTo(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-white outline-none focus:border-amber-700"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {viewMode === 'session' && (
        ordered.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-6 text-center text-sm text-neutral-500">
            {dateRange
              ? `No sessions were completed in ${rangeLabel}.`
              : 'Pick a "From" and "To" date to load a custom range.'}
          </div>
        ) : (
      <div className="space-y-1.5">
        {ordered.map(session => {
          const isExpanded = expandedId === session.id;
          const targetMs = (session.targetMinutes + session.extensionMinutes) * 60_000;
          const completionPct = targetMs ? Math.min(100, Math.round((session.accumulatedActiveMs / targetMs) * 100)) : 0;
          const totalGoals = session.achievedGoals.length + session.droppedGoals.length + session.pendingGoals.length;
          const productivity = Math.round(session.productivityPercent ?? 100);

          return (
            <div key={session.id} className="rounded-xl border border-neutral-800/80 bg-neutral-950/70 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-900/40 transition"
              >
                {/* Date + time range */}
                <div className="min-w-[160px] shrink-0">
                  {session.sessionNote ? (
                    <>
                      <div className="text-sm font-bold text-white leading-tight">{session.sessionNote}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-neutral-500">
                        {new Date(session.startedAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(session.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-bold text-white leading-tight">{new Date(session.startedAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-neutral-500">
                        {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(session.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </>
                  )}
                </div>

                {/* Inline stats — no card grid, just labeled numbers on one row */}
                <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
                  <span><span className="text-emerald-300 font-bold">{formatDuration(session.accumulatedActiveMs)}</span> <span className="text-neutral-500">active</span></span>
                  <span><span className="text-amber-300 font-bold">{formatDuration(session.accumulatedPausedMs)}</span> <span className="text-neutral-500">paused</span></span>
                  <span><span className="text-cyan-300 font-bold">{session.breaksCount}</span> <span className="text-neutral-500">brk</span></span>
                  <span><span className="text-purple-300 font-bold">{completionPct}%</span> <span className="text-neutral-500">quota</span></span>
                  <span><span className={`font-bold ${productivity >= 70 ? 'text-emerald-300' : productivity >= 40 ? 'text-amber-300' : 'text-rose-300'}`}>{productivity}%</span> <span className="text-neutral-500">prod</span></span>
                  <span><span className={`font-bold ${session.achievedGoals.length === totalGoals && totalGoals > 0 ? 'text-emerald-300' : 'text-white'}`}>{session.achievedGoals.length}/{totalGoals}</span> <span className="text-neutral-500">goals</span></span>
                  {session.extensionMinutes > 0 && (
                    <span className="rounded border border-amber-900/40 bg-amber-950/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">+{session.extensionMinutes}m ext</span>
                  )}
                </div>

                <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {isExpanded && (
                <div className="border-t border-neutral-900 p-5 space-y-4">
                  {(session.taskTimers?.length || 0) > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-cyan-400"><Timer className="h-4 w-4" />Goal task sessions</div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {session.taskTimers!.map(timer => (
                          <div key={timer.id} className="rounded-lg border border-cyan-950/60 bg-cyan-950/10 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-neutral-100">{timer.topicName}</div>
                                <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-cyan-300">{stageLabels[timer.stage]}</div>
                              </div>
                              <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${timer.endReason === 'done' ? 'bg-emerald-950/40 text-emerald-300' : 'bg-amber-950/40 text-amber-300'}`}>{timer.endReason === 'done' ? 'Completed' : 'Deferred'}</span>
                            </div>
                            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                              <div>
                                <div className="font-mono text-sm font-bold text-emerald-300">{formatDuration(timer.accumulatedActiveMs)}</div>
                                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">Active</div>
                              </div>
                              <div>
                                <div className="font-mono text-sm font-bold text-amber-300">{formatDuration(timer.accumulatedPausedMs)}</div>
                                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">Paused</div>
                              </div>
                              <div>
                                <div className="font-mono text-sm font-bold text-cyan-300">{timer.breaksCount}</div>
                                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">Breaks</div>
                              </div>
                              <div>
                                <div className="font-mono text-sm font-bold text-purple-300">{timer.productivityScore ? `${timer.productivityScore * 10}%` : '--'}</div>
                                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">Productive</div>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-cyan-950/40 pt-2 font-mono text-[11px] text-neutral-500">
                              <span>Started {new Date(timer.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                              <span>{timer.completedAt ? `Ended ${new Date(timer.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Still active'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {session.achievedGoals.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-emerald-400"><Check className="h-4 w-4" />Achieved</div>
                      <div className="mt-2 space-y-1.5">
                        {session.achievedGoals.map((goal, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-emerald-900/30 bg-emerald-950/10 px-3 py-2 text-xs">
                            <span className="font-semibold text-neutral-200">{goal.topicName}</span>
                            <span className="uppercase text-emerald-300">Reached {goal.targetStatus}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {session.droppedGoals.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-rose-400"><Trash2 className="h-4 w-4" />Dropped</div>
                      <div className="mt-2 space-y-1.5">
                        {session.droppedGoals.map((goal, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-rose-900/30 bg-rose-950/10 px-3 py-2 text-xs">
                            <span className="font-semibold text-neutral-200">{goal.topicName}</span>
                            <span className="uppercase text-rose-300">Was targeting {goal.targetStatus}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {session.pendingGoals.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-neutral-400"><TrendingUp className="h-4 w-4" />Still open when session ended</div>
                      <div className="mt-2 space-y-1.5">
                        {session.pendingGoals.map((goal, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-xs">
                            <span className="font-semibold text-neutral-200">{goal.topicName}</span>
                            <span className="uppercase text-neutral-500">Targeting {goal.targetStatus}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {totalGoals === 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500"><Coffee className="h-4 w-4" />No goals were set for this session.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
        )
      )}

      {viewMode === 'topic' && (
        topicGroups.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-6 text-center text-sm text-neutral-500">
            {dateRange
              ? `No task timers were archived in ${rangeLabel}.`
              : 'Pick a "From" and "To" date to load a custom range.'}
          </div>
        ) : (
          <div className="space-y-4">
            {topicGroups.map(group => (
              <div key={group.topicId} className="rounded-xl border border-neutral-800/80 bg-neutral-950/70 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-900 pb-3">
                  <div className="min-w-0">
                    <div className="text-base font-bold text-white truncate">{group.topicName}</div>
                    <div className="mt-1 text-xs text-neutral-500 font-mono">
                      Last touched {new Date(group.lastStartedAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}{group.entries.length} timer{group.entries.length === 1 ? '' : 's'} across {group.stages.size} stage{group.stages.size === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-xs">
                    <span><span className="text-emerald-300 font-bold">{formatDuration(group.totalActiveMs)}</span> <span className="text-neutral-500">total active</span></span>
                    <div className="flex gap-1">
                      {stageOrder.filter(s => group.stages.has(s)).map(s => (
                        <span key={s} className="rounded border border-cyan-900/50 bg-cyan-950/25 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300">{stageShortLabels[s]}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {group.entries.map(({ timer, session }) => (
                    <TimerCard key={`${session.id}:${timer.id}`} timer={timer} session={session} headline="stage" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {viewMode === 'task' && (
        <div className="space-y-4">
          {/* Stage filter — always show all five production stages so the set
              is predictable; stages without archived timers are visibly dimmed
              and render a "no data" panel when selected. */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTaskStageFilter('all')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-mono font-semibold transition ${
                taskStageFilter === 'all'
                  ? 'border-cyan-700 bg-cyan-950/40 text-cyan-200'
                  : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
              }`}
            >
              All stages
            </button>
            {stageOrder.map(stage => {
              const hasData = availableStages.includes(stage);
              const isSelected = taskStageFilter === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setTaskStageFilter(stage)}
                  title={hasData ? undefined : 'No timers archived for this stage yet'}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono font-semibold transition ${
                    isSelected
                      ? 'border-cyan-700 bg-cyan-950/40 text-cyan-200'
                      : hasData
                        ? 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                        : 'border-neutral-900 bg-neutral-950/40 text-neutral-600 hover:border-neutral-800 hover:text-neutral-500'
                  }`}
                >
                  {stageLabels[stage]}
                  {!hasData && <span className="text-[9px] uppercase tracking-wider opacity-70">· empty</span>}
                </button>
              );
            })}
          </div>

          {(() => {
            const groupByStage = new Map<TaskTimerStage, (typeof taskGroups)[number]>(
              taskGroups.map(group => [group.stage, group] as const)
            );
            const requestedStages = taskStageFilter === 'all' ? stageOrder : [taskStageFilter];
            const stagesWithData = requestedStages.filter((s): s is TaskTimerStage => groupByStage.has(s));
            if (stagesWithData.length === 0) {
              const scope = dateRange ? `in ${rangeLabel}` : 'in these sessions';
              return (
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-6 text-center text-sm text-neutral-500">
                  {taskStageFilter === 'all'
                    ? `No task timers were archived ${scope}.`
                    : `No ${stageLabels[taskStageFilter as TaskTimerStage].toLowerCase()} timers were archived ${scope}.`}
                </div>
              );
            }
            return stagesWithData.map(stage => {
              const group = groupByStage.get(stage);
              if (!group) return null;
              return (
                <div key={group.stage} className="rounded-xl border border-neutral-800/80 bg-neutral-950/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-900 pb-3">
                    <div>
                      <div className="text-base font-bold text-white">{stageLabels[group.stage]}</div>
                      <div className="mt-1 text-xs text-neutral-500 font-mono">
                        {group.uniqueTopicIds.size} topic{group.uniqueTopicIds.size === 1 ? '' : 's'} · {group.entries.length} timer{group.entries.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="font-mono text-xs">
                      <span className="text-emerald-300 font-bold">{formatDuration(group.totalActiveMs)}</span> <span className="text-neutral-500">total active</span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {group.entries.map(({ timer, session }) => (
                      <TimerCard key={`${session.id}:${timer.id}`} timer={timer} session={session} headline="topic" />
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Camera,
  Clock3,
  Lightbulb,
  PenLine,
  Radio,
  Scissors,
  Sparkles,
  Youtube,
  Zap,
} from 'lucide-react';
import type { SessionRecord, TaskTimerRecord, Topic, TopicActivity, VideoRecord, WorkdaySession } from '../types';

type PipelineNodeKey = 'topic' | 'hooked' | 'scripted' | 'shot' | 'edited' | 'scheduled' | 'posted';

interface ProductionPipelineMapProps {
  topics: Topic[];
  videos: VideoRecord[];
  activities: TopicActivity[];
  sessions: SessionRecord[];
  taskTimers: TaskTimerRecord[];
  workdaySession: WorkdaySession | null;
  focusTopic: Topic | null;
  dueSoonCount?: number;
  firstAttentionTopicId?: string;
  firstAttentionAction?: 'hook' | 'script' | 'shoot' | 'edit' | 'schedule' | 'post' | 'unblock';
  onOpenPipeline: (topicId?: string, action?: 'hook' | 'script' | 'shoot' | 'edit' | 'schedule' | 'post' | 'unblock') => void;
}

const stageAction: Record<PipelineNodeKey, 'hook' | 'script' | 'shoot' | 'edit' | 'schedule' | 'post' | undefined> = {
  topic: 'hook',
  hooked: 'script',
  scripted: 'shoot',
  shot: 'edit',
  edited: 'schedule',
  scheduled: 'post',
  posted: undefined,
};

type NodeTone = {
  badge: string;
  border: string;
  fill: string;
  ring: string;
  bar: string;
};

const toneMap: Record<PipelineNodeKey, NodeTone> = {
  topic:     { badge: 'text-cyan-300',    border: 'border-cyan-900/40',    fill: 'bg-cyan-500/[.05]',    ring: 'shadow-[0_0_30px_rgba(34,211,238,0.10)]',  bar: 'bg-cyan-400' },
  hooked:    { badge: 'text-blue-300',    border: 'border-blue-900/40',    fill: 'bg-blue-500/[.05]',    ring: 'shadow-[0_0_30px_rgba(59,130,246,0.10)]',  bar: 'bg-blue-400' },
  scripted:  { badge: 'text-violet-300',  border: 'border-violet-900/40',  fill: 'bg-violet-500/[.05]',  ring: 'shadow-[0_0_30px_rgba(167,139,250,0.10)]', bar: 'bg-violet-400' },
  shot:      { badge: 'text-amber-300',   border: 'border-amber-900/40',   fill: 'bg-amber-500/[.05]',   ring: 'shadow-[0_0_30px_rgba(251,191,36,0.10)]',  bar: 'bg-amber-400' },
  edited:    { badge: 'text-emerald-300', border: 'border-emerald-900/40', fill: 'bg-emerald-500/[.05]', ring: 'shadow-[0_0_30px_rgba(52,211,153,0.10)]',  bar: 'bg-emerald-400' },
  scheduled: { badge: 'text-pink-300',    border: 'border-pink-900/40',    fill: 'bg-pink-500/[.05]',    ring: 'shadow-[0_0_30px_rgba(244,114,182,0.10)]', bar: 'bg-pink-400' },
  posted:    { badge: 'text-rose-300',    border: 'border-rose-900/40',    fill: 'bg-rose-500/[.05]',    ring: 'shadow-[0_0_30px_rgba(244,63,94,0.10)]',   bar: 'bg-rose-400' },
};

const stageOrder: Topic['status'][] = ['topic', 'hooked', 'scripted', 'shot', 'edited', 'scheduled', 'posted'];

const timerStageForNode: Record<PipelineNodeKey, TaskTimerRecord['stage'] | null> = {
  topic: null,
  hooked: 'hook',
  scripted: 'script',
  shot: 'shoot',
  edited: 'edit',
  scheduled: 'schedule',
  posted: 'post',
};

const nextActionForStage: Record<PipelineNodeKey, string> = {
  topic: 'Write the hook',
  hooked: 'Write the script',
  scripted: 'Record the video',
  shot: 'Edit the cut',
  edited: 'Lock a release time',
  scheduled: 'Wait for the slot',
  posted: 'Review performance',
};

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

function stageTimerMs(timer: TaskTimerRecord, now = Date.now()) {
  const active = timer.accumulatedActiveMs + (timer.status === 'running' && timer.activeSince
    ? Math.max(0, now - new Date(timer.activeSince).getTime())
    : 0);
  return { active };
}

function daysSince(iso: string, now: number) {
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000);
}

// Stat tile for the bottom row.
function StatTile({ value, label, tone = 'text-white' }: { value: number | string; label: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/75 px-3 py-2">
      <div className={`text-sm font-semibold ${tone}`}>{value}</div>
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">{label}</div>
    </div>
  );
}

// Pulsing red dot for stages that need attention.
function AttentionDot() {
  return (
    <motion.span
      className="relative inline-flex h-2 w-2 shrink-0"
      animate={{ scale: [1, 1.15, 1] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/70" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.9)]" />
    </motion.span>
  );
}

// Pulsing green dot for stages with a live timer.
function LiveDot() {
  return (
    <motion.span
      className="relative inline-flex h-2 w-2 shrink-0"
      animate={{ scale: [1, 1.15, 1] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
    </motion.span>
  );
}

// Per-day, per-channel publish signal for the current calendar month.
// One vertical line per day. Colors are meaningful — no synthetic data.
// - past day, 0 posted, nothing scheduled → red   (missed slot)
// - any day with 1 posted                → light green
// - any day with 2 posted                → medium green
// - any day with 3+ posted               → dark green
// - future/today day with a scheduled-but-not-yet-posted topic → light green + blink
// - future/today day with nothing scheduled → neutral gray
function MonthlyPublishStrip({ topics, nowMs, className }: { topics: Topic[]; nowMs: number; className?: string }) {
  const nowDate = new Date(nowMs);
  const year = nowDate.getFullYear();
  const month = nowDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDay = nowDate.getDate();
  const monthName = nowDate.toLocaleDateString([], { month: 'long' });

  const dayKey = (isoOrDate: string | Date) => {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    if (d.getFullYear() !== year || d.getMonth() !== month) return -1;
    return d.getDate();
  };

  const channels: Array<{ name: 'LearnDriven' | 'DecodeWorthy'; accent: string }> = [
    { name: 'LearnDriven', accent: 'text-blue-300' },
    { name: 'DecodeWorthy', accent: 'text-emerald-300' },
  ];

  return (
    <div className={`rounded-xl border border-neutral-800/70 bg-neutral-950/70 p-3 ${className ?? ''}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">Publish rhythm · {monthName} {year}</div>
        <div className="font-mono text-[9px] text-neutral-600">{daysInMonth} days</div>
      </div>
      <div className="space-y-2">
        {channels.map(channel => {
          const channelTopics = topics.filter(t => t.channel === channel.name);
          const postedByDay = new Map<number, number>();
          const scheduledByDay = new Map<number, number>();
          channelTopics.forEach(t => {
            if (t.status === 'posted') {
              const stamp = t.postedAt || t.dueDate;
              if (!stamp) return;
              const d = dayKey(stamp);
              if (d > 0) postedByDay.set(d, (postedByDay.get(d) || 0) + 1);
            } else if (t.status === 'scheduled' && t.dueDate) {
              const d = dayKey(t.dueDate);
              if (d > 0) scheduledByDay.set(d, (scheduledByDay.get(d) || 0) + 1);
            }
          });
          const daysPosted = Array.from(postedByDay.keys()).length;
          const videosPosted = Array.from(postedByDay.values()).reduce((s, v) => s + v, 0);
          const daysScheduled = Array.from(scheduledByDay.keys()).length;

          return (
            <div key={channel.name} className="flex items-center gap-3">
              <div className="w-24 shrink-0">
                <div className={`text-[10px] font-bold ${channel.accent}`}>{channel.name}</div>
                <div className="font-mono text-[8px] text-neutral-500">{daysPosted}d · {videosPosted} vids</div>
              </div>
              <div className="flex flex-1 items-center gap-[2px] overflow-hidden rounded-md bg-neutral-950/60 px-1 py-1.5">
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const posted = postedByDay.get(day) || 0;
                  const scheduled = scheduledByDay.get(day) || 0;
                  const isPast = day < todayDay;
                  const isToday = day === todayDay;

                  let color = 'bg-neutral-800/70';
                  let title = `${monthName} ${day}`;
                  let animate = '';

                  if (posted >= 3) { color = 'bg-emerald-700'; title += ` · ${posted} posted`; }
                  else if (posted === 2) { color = 'bg-emerald-500'; title += ` · 2 posted`; }
                  else if (posted === 1) { color = 'bg-emerald-300'; title += ` · 1 posted`; }
                  else if (scheduled > 0 && !isPast) { color = 'bg-emerald-300/80'; animate = 'animate-pulse'; title += ` · ${scheduled} scheduled`; }
                  else if (isPast) { color = 'bg-rose-500/70'; title += ` · nothing posted`; }
                  else { title += ` · empty`; }

                  return (
                    <div
                      key={day}
                      title={title}
                      className={`h-6 flex-1 min-w-[2px] rounded-sm ${color} ${animate} ${isToday ? 'ring-1 ring-white/40' : ''}`}
                    />
                  );
                })}
              </div>
              <div className="w-20 shrink-0 text-right">
                <div className={`font-mono text-[11px] font-bold ${channel.accent}`}>{videosPosted}</div>
                <div className="font-mono text-[8px] text-neutral-500">
                  {daysScheduled > 0 ? `${daysScheduled} scheduled` : `${daysInMonth - todayDay} days left`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-900 pt-2 text-[8px] font-mono text-neutral-500">
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-rose-500/70" /> missed</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-neutral-800/70" /> empty</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-300/80 animate-pulse" /> scheduled</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-300" /> 1 posted</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-500" /> 2 posted</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-700" /> 3+ posted</span>
      </div>
    </div>
  );
}

export default function ProductionPipelineMap({
  topics,
  videos,
  activities,
  sessions,
  taskTimers,
  workdaySession,
  focusTopic,
  dueSoonCount = 0,
  firstAttentionTopicId,
  firstAttentionAction,
  onOpenPipeline
}: ProductionPipelineMapProps) {
  const now = Date.now();

  const activeTaskTimer = useMemo(
    () => taskTimers
      .filter(timer => timer.status === 'running' || timer.status === 'paused')
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0] ?? null,
    [taskTimers]
  );
  const activeTaskTimerMs = activeTaskTimer ? stageTimerMs(activeTaskTimer, now) : null;

  const todayKey = new Date().toDateString();
  const todayActions = activities.filter(item => new Date(item.timestamp).toDateString() === todayKey).length;
  const openTopics = topics.filter(topic => topic.status !== 'posted').length;
  const runningTimers = taskTimers.filter(timer => timer.status === 'running').length;
  const pausedTimers = taskTimers.filter(timer => timer.status === 'paused').length;
  const activeTimers = runningTimers + pausedTimers;

  const totalBlocked = topics.filter(t => Boolean(t.blockedReason)).length;
  const totalOverdue = topics.filter(t => t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== 'posted').length;

  const focusNode: PipelineNodeKey = activeTaskTimer
    ? (({ hook: 'hooked', script: 'scripted', shoot: 'shot', edit: 'edited', schedule: 'scheduled', post: 'posted' } as const)[activeTaskTimer.stage])
    : (focusTopic?.status ?? 'topic');

  const nodes = useMemo(() => {
    const topicsInStage = (status: Topic['status']) => topics.filter(t => t.status === status);

    return stageOrder.map<{
      key: PipelineNodeKey;
      title: string;
      count: number;
      blocked: number;
      overdue: number;
      stale: number;
      liveCount: number;
      pausedCount: number;
      oldestName?: string;
      oldestAgeDays?: number;
      nextAction: string;
      focusTopicId?: string;
      focusAction?: 'hook' | 'script' | 'shoot' | 'edit' | 'schedule' | 'post' | 'unblock';
      icon: React.ComponentType<{ className?: string }>;
      tone: NodeTone;
    }>(status => {
      const bucket = topicsInStage(status);
      const blocked = bucket.filter(t => Boolean(t.blockedReason)).length;
      const overdue = bucket.filter(t => t.dueDate && new Date(t.dueDate).getTime() < now).length;
      const stale = bucket.filter(t => daysSince(t.createdDate, now) >= 3).length;
      const oldest = [...bucket].sort((a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime())[0];

      // Pick the topic this card should jump to when clicked:
      // 1. blocked (needs unblocking) 2. overdue 3. oldest 4. any
      const firstBlocked = bucket.find(t => Boolean(t.blockedReason));
      const firstOverdue = bucket.filter(t => t.dueDate && new Date(t.dueDate).getTime() < now)
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];
      const focus = firstBlocked ?? firstOverdue ?? oldest;
      const focusAction: 'hook' | 'script' | 'shoot' | 'edit' | 'schedule' | 'post' | 'unblock' | undefined = focus
        ? (firstBlocked ? 'unblock' : stageAction[status])
        : undefined;

      const timerStage = timerStageForNode[status];
      const timersInStage = timerStage
        ? taskTimers.filter(t => t.stage === timerStage && (t.status === 'running' || t.status === 'paused'))
        : [];

      return {
        key: status,
        title: ({ topic: 'Ideas', hooked: 'Hooks', scripted: 'Scripts', shot: 'Shoots', edited: 'Edits', scheduled: 'Scheduled', posted: 'Published' } as const)[status],
        count: bucket.length,
        blocked,
        overdue,
        stale,
        liveCount: timersInStage.filter(t => t.status === 'running').length,
        pausedCount: timersInStage.filter(t => t.status === 'paused').length,
        oldestName: oldest?.name,
        oldestAgeDays: oldest ? daysSince(oldest.createdDate, now) : undefined,
        nextAction: nextActionForStage[status],
        focusTopicId: focus?.id,
        focusAction,
        icon: ({ topic: Lightbulb, hooked: Zap, scripted: PenLine, shot: Camera, edited: Scissors, scheduled: CalendarDays, posted: Youtube } as const)[status],
        tone: toneMap[status],
      };
    });
  }, [topics, taskTimers, now]);

  const maxCount = Math.max(1, ...nodes.map(node => node.count));

  const workdayLabel = workdaySession
    ? workdaySession.status === 'running'
      ? `Running · ${formatDuration((workdaySession.accumulatedActiveMs || 0) + (workdaySession.activeSince ? Math.max(0, now - new Date(workdaySession.activeSince).getTime()) : 0))}`
      : `Paused · ${formatDuration(workdaySession.accumulatedActiveMs || 0)}`
    : 'No day started';

  return (
    <section className="relative overflow-hidden rounded-3xl border border-neutral-800/80 bg-[linear-gradient(135deg,rgba(10,12,20,0.98),rgba(4,9,16,0.98))] p-5 md:p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:72px_72px]" />
      <motion.div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl"
        animate={{ x: [0, -30, 10, 0], y: [0, 16, -10, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute -left-28 bottom-0 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl"
        animate={{ x: [0, 24, -10, 0], y: [0, -10, 18, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />

      {(() => {
        const attentionCount = totalBlocked + totalOverdue;
        const opsTone: 'rose' | 'amber' | 'emerald' = attentionCount > 0 ? 'rose' : dueSoonCount > 0 ? 'amber' : 'emerald';
        const opsLabel = attentionCount > 0 ? 'Action required' : dueSoonCount > 0 ? 'Watch closely' : 'System clear';
        const opsBorder = opsTone === 'rose' ? 'border-rose-900/50 hover:border-rose-700' : opsTone === 'amber' ? 'border-amber-900/50 hover:border-amber-700' : 'border-emerald-900/50 hover:border-emerald-700';
        const opsBg = opsTone === 'rose' ? 'bg-rose-950/20' : opsTone === 'amber' ? 'bg-amber-950/20' : 'bg-emerald-950/20';
        const opsText = opsTone === 'rose' ? 'text-rose-400' : opsTone === 'amber' ? 'text-amber-300' : 'text-emerald-400';
        const opsDot = opsTone === 'rose' ? 'bg-rose-500 shadow-[0_0_12px_#f43f5e]' : opsTone === 'amber' ? 'bg-amber-400 shadow-[0_0_12px_#f59e0b]' : 'bg-emerald-400 shadow-[0_0_12px_#10b981]';
        return (
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.24em] text-cyan-300">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Live content operations
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                Creator Command Center
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-neutral-400">
                Every topic, every stage. Red pulse means attention here. Green pulse means a task timer is running.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[500px] min-w-0 w-full">
              {/* Operational state tile */}
              <button
                type="button"
                onClick={() => {
                  if (firstAttentionTopicId) onOpenPipeline(firstAttentionTopicId, firstAttentionAction);
                  else onOpenPipeline();
                }}
                className={`group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 min-w-0 w-full ${opsBorder} ${opsBg}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">Operational state</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${opsDot}`} />
                </div>
                <div className={`mt-2 font-mono text-sm font-bold uppercase tracking-wide ${opsText}`}>{opsLabel}</div>
                <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-neutral-500">
                  <span>{totalBlocked} blocked · {totalOverdue} overdue · {dueSoonCount} due soon</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 group-hover:text-white" />
                </div>
              </button>

              {/* Now working on tile */}
              <button
                type="button"
                onClick={() => {
                  if (activeTaskTimer) onOpenPipeline(activeTaskTimer.topicId, activeTaskTimer.stage);
                  else if (focusTopic) onOpenPipeline(focusTopic.id, focusTopic.blockedReason ? 'unblock' : stageAction[focusTopic.status]);
                  else onOpenPipeline();
                }}
                className="group rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-700/60 min-w-0 w-full"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">Now working on</span>
                  {activeTaskTimer ? <LiveDot /> : <span className="h-2.5 w-2.5 rounded-full bg-neutral-700" />}
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={focusTopic?.id ?? activeTaskTimer?.id ?? 'idle'}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="mt-2"
                  >
                    <div className="text-sm font-semibold text-white truncate">
                      {activeTaskTimer ? activeTaskTimer.topicName : focusTopic?.name ?? 'Nothing active'}
                    </div>
                    <div className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                      {activeTaskTimer
                        ? `${activeTaskTimer.status === 'paused' ? 'Paused' : 'Running'} · ${formatDuration(activeTaskTimerMs?.active ?? 0)} on ${activeTaskTimer.stage}`
                        : focusTopic
                          ? `Currently at ${focusTopic.status}${focusTopic.blockedReason ? ' · blocked' : ''}`
                          : 'Start a topic action and this card will light up.'}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </button>
            </div>
          </div>
        );
      })()}

      <div className="relative z-10 mt-6 rounded-3xl border border-neutral-800/70 bg-neutral-950/55 p-4 md:p-5 min-w-0">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-6 min-w-0">
          {nodes.map((node, index) => {
            const active = node.key === focusNode;
            const needsAttention = node.blocked + node.overdue > 0;
            const hasLive = node.liveCount > 0;
            const width = Math.max(6, Math.round((node.count / maxCount) * 100));
            const Icon = node.icon;
            return (
              <motion.button
                key={node.key}
                type="button"
                onClick={() => onOpenPipeline(node.focusTopicId, node.focusAction)}
                title={node.focusTopicId ? `Jump to: ${node.oldestName}` : 'Open pipeline'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className={`group relative overflow-hidden rounded-xl border bg-neutral-950/85 text-left transition hover:-translate-y-0.5 hover:bg-neutral-900/90 focus-visible:outline-none focus-visible:ring-1 min-w-0 w-full ${node.tone.border} ${active ? `${node.tone.ring} ring-1 ring-white/10` : ''}`}
              >
                <div className={`pointer-events-none absolute inset-0 ${node.tone.fill}`} />

                {/* Header stripe — icon left, big count, badges right */}
                <div className="relative z-10 flex items-center gap-2.5 border-b border-neutral-900/80 px-3 py-2.5">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${node.tone.border} bg-black/40 ${node.tone.badge}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`font-mono text-[9px] font-semibold uppercase tracking-[.2em] ${node.tone.badge}`}>{node.title}</div>
                    <div className="mt-0.5 text-lg font-bold leading-none text-white">
                      {node.count}
                      <span className="ml-1.5 text-[9px] font-normal uppercase tracking-wider text-neutral-500">
                        {node.count === 0 ? 'empty' : node.count === 1 ? 'topic' : 'topics'}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {hasLive && <LiveDot />}
                    {needsAttention && <AttentionDot />}
                  </div>
                </div>

                {/* Load bar directly under header */}
                <div className="relative z-10 h-1 overflow-hidden bg-neutral-900/60">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className={`h-full ${node.tone.bar} opacity-80`}
                  />
                </div>

                {/* Body: signals + oldest topic hint */}
                <div className="relative z-10 space-y-1.5 px-3 py-2.5 text-[10px]">
                  {(node.blocked > 0 || node.overdue > 0 || hasLive || (node.pausedCount > 0 && !hasLive)) && (
                    <div className="flex flex-wrap gap-1.5">
                      {node.blocked > 0 && (
                        <span className="inline-flex items-center gap-1 rounded border border-rose-900/40 bg-rose-950/25 px-1.5 py-0.5 font-mono text-[9px] font-bold text-rose-300">
                          <AlertTriangle className="h-2.5 w-2.5" />{node.blocked} blocked
                        </span>
                      )}
                      {node.overdue > 0 && (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-900/40 bg-amber-950/25 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                          <Clock3 className="h-2.5 w-2.5" />{node.overdue} overdue
                        </span>
                      )}
                      {hasLive && (
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-900/40 bg-emerald-950/25 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-300">
                          <Radio className="h-2.5 w-2.5" />{node.liveCount} live
                        </span>
                      )}
                      {!hasLive && node.pausedCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded border border-neutral-800 bg-neutral-900/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-neutral-300">
                          {node.pausedCount} paused
                        </span>
                      )}
                    </div>
                  )}
                  {node.count === 0 ? (
                    <div className="text-neutral-500 leading-snug">
                      <span className={`font-mono text-[8px] font-bold uppercase tracking-wider ${node.tone.badge}`}>Next step</span>
                      <div className="mt-0.5 text-[10px] text-neutral-400">{node.nextAction}</div>
                    </div>
                  ) : node.oldestName ? (
                    <div>
                      <div className="text-[9px] font-mono uppercase tracking-wider text-neutral-500">Oldest</div>
                      <div className="mt-0.5 truncate text-[11px] font-semibold text-neutral-100">{node.oldestName}</div>
                      <div className="mt-0.5 text-[9px] text-neutral-500">
                        {node.oldestAgeDays && node.oldestAgeDays > 0 ? `${node.oldestAgeDays}d in queue` : 'Added today'} · {node.nextAction}
                      </div>
                    </div>
                  ) : null}
                  {node.stale > 0 && node.blocked === 0 && node.overdue === 0 && node.count > 0 && (
                    <div className="text-[9px] text-neutral-500">{node.stale} sitting 3d+</div>
                  )}
                </div>
              </motion.button>
            );
          })}
          {/* Monthly publish calendar strip — fills the empty grid space to
              the right of the Published card on wide screens, and wraps to
              its own row underneath on narrower ones. Real data: each line
              is one day of the current month; color reflects posted count
              (topics with status='posted' whose postedAt/dueDate falls on
              that day) or a blinking marker if a topic is scheduled for
              that day but not yet posted. */}
          <MonthlyPublishStrip topics={topics} nowMs={now} className="xl:col-span-5" />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 min-w-0">
          <StatTile value={openTopics} label="topics in flight" />
          <StatTile value={activeTimers} label="task timers open" tone="text-cyan-300" />
          <StatTile value={todayActions} label="actions today" tone="text-sky-300" />
          <StatTile value={sessions.length} label="past sessions" tone="text-violet-300" />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1.35fr_.9fr_.9fr] min-w-0">
          {(() => {
            const weekCutoff = now - 7 * 86_400_000;
            const weekTimers = taskTimers.filter(t => new Date(t.startedAt).getTime() >= weekCutoff);
            const weekMs = weekTimers.reduce((sum, t) => sum + t.accumulatedActiveMs + (
              t.status === 'running' && t.activeSince ? Math.max(0, now - new Date(t.activeSince).getTime()) : 0
            ), 0);
            const weekSittings = weekTimers.reduce((sum, t) => {
              if (t.segments && t.segments.length > 0) return sum + t.segments.length;
              if (t.status === 'paused') return sum + t.breaksCount;
              if (t.status === 'running' || t.status === 'completed') return sum + t.breaksCount + 1;
              return sum;
            }, 0);
            const weekTopics = new Set(weekTimers.map(t => t.topicId)).size;
            return (
              <div className="rounded-2xl border border-neutral-800/70 bg-neutral-950/75 p-4 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">Time this week</div>
                    <div className="mt-1 text-sm font-semibold text-white">{formatDuration(weekMs)}</div>
                  </div>
                  <Clock3 className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="mt-2 text-[11px] text-neutral-400">
                  {weekTimers.length > 0
                    ? `${weekSittings} sitting${weekSittings === 1 ? '' : 's'} across ${weekTopics} topic${weekTopics === 1 ? '' : 's'}`
                    : 'Start a stage stopwatch on any topic to record time.'}
                </div>
              </div>
            );
          })()}

          <div className="rounded-2xl border border-neutral-800/70 bg-neutral-950/75 p-4">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">Active task</div>
              {activeTaskTimer?.status === 'running' && <LiveDot />}
            </div>
            <div className="mt-1 text-sm font-semibold text-white truncate">
              {activeTaskTimer ? activeTaskTimer.topicName : 'No task timer'}
            </div>
            <div className="mt-2 text-[11px] text-neutral-400">
              {activeTaskTimer
                ? `${activeTaskTimer.status === 'paused' ? 'Paused' : 'Running'} · ${formatDuration(activeTaskTimerMs?.active ?? 0)} on ${activeTaskTimer.stage}`
                : 'Click a stage action on any topic to start one.'}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800/70 bg-neutral-950/75 p-4">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">Attention</div>
              {totalBlocked + totalOverdue > 0 ? <AttentionDot /> : <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />}
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              {totalBlocked + totalOverdue === 0
                ? 'All clear'
                : `${totalBlocked + totalOverdue} need${totalBlocked + totalOverdue === 1 ? 's' : ''} action`}
            </div>
            <div className="mt-2 text-[11px] text-neutral-400">
              {totalBlocked} blocked · {totalOverdue} overdue · {runningTimers} running · {pausedTimers} paused
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2 min-w-0">
          {(() => {
            const recent = [...activities]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 3);
            const rel = (ts: string) => {
              const diff = now - new Date(ts).getTime();
              if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
              if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
              if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
              return `${Math.floor(diff / 86_400_000)}d ago`;
            };
            return (
              <div className="rounded-2xl border border-neutral-800/70 bg-neutral-950/75 p-4 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">Last done activity</div>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.85)] animate-pulse" title="Live activity feed" />
                </div>
                {recent.length === 0 ? (
                  <div className="mt-2 text-[11px] text-neutral-500">No activity yet. Actions across the app will surface here.</div>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {recent.map((activity, index) => {
                      const dotClass = index === 0
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)] animate-pulse'
                        : index === 1
                          ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]'
                          : 'bg-neutral-600';
                      return (
                        <li key={activity.id} className="flex items-start gap-2">
                          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] text-neutral-200" title={`${activity.action} — ${activity.topicName}`}>
                              <span className="font-semibold">{activity.action}</span>
                              {activity.topicName ? <span className="text-neutral-500"> · {activity.topicName}</span> : null}
                            </div>
                            <div className="text-[9px] text-neutral-500">{activity.channel} · {rel(activity.timestamp)}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })()}

          {(() => {
            const stages: Array<'hook' | 'script' | 'shoot' | 'edit'> = ['hook', 'script', 'shoot', 'edit'];
            const totalByTopicStage = new Map<string, Record<'hook' | 'script' | 'shoot' | 'edit', number>>();
            taskTimers.forEach(t => {
              if (t.stage !== 'hook' && t.stage !== 'script' && t.stage !== 'shoot' && t.stage !== 'edit') return;
              const active = t.accumulatedActiveMs + (t.status === 'running' && t.activeSince ? Math.max(0, now - new Date(t.activeSince).getTime()) : 0);
              if (active <= 0) return;
              const bucket = totalByTopicStage.get(t.topicId) || { hook: 0, script: 0, shoot: 0, edit: 0 };
              bucket[t.stage as 'hook' | 'script' | 'shoot' | 'edit'] += active;
              totalByTopicStage.set(t.topicId, bucket);
            });
            const complete: Record<'hook' | 'script' | 'shoot' | 'edit', number>[] = [];
            let incompleteCount = 0;
            totalByTopicStage.forEach(bucket => {
              if (stages.every(s => bucket[s] > 0)) complete.push(bucket);
              else incompleteCount += 1;
            });
            const avg = (stage: 'hook' | 'script' | 'shoot' | 'edit') => complete.length === 0
              ? 0
              : Math.round(complete.reduce((sum, b) => sum + b[stage], 0) / complete.length);
            const stageMeta: Record<'hook' | 'script' | 'shoot' | 'edit', { label: string; class: string }> = {
              hook: { label: 'Hook', class: 'text-blue-300' },
              script: { label: 'Script', class: 'text-violet-300' },
              shoot: { label: 'Shoot', class: 'text-amber-300' },
              edit: { label: 'Edit', class: 'text-emerald-300' }
            };
            return (
              <div className="rounded-2xl border border-neutral-800/70 bg-neutral-950/75 p-4 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">Avg time per stage · 1 video</div>
                  <span className={`h-2 w-2 rounded-full ${complete.length > 0 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.85)]' : 'bg-neutral-700'}`} title={complete.length > 0 ? 'Based on complete topics' : 'No topic yet has all 4 stages tracked'} />
                </div>
                {complete.length === 0 ? (
                  <div className="mt-2 text-[11px] text-neutral-500">
                    No topic has all 4 stages timed yet. {incompleteCount > 0 ? `${incompleteCount} topic${incompleteCount === 1 ? '' : 's'} with partial data ignored.` : ''}
                  </div>
                ) : (
                  <>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {stages.map(stage => (
                        <div key={stage} className="rounded border border-neutral-900 bg-neutral-950/60 px-2 py-1.5">
                          <div className={`text-[8px] uppercase tracking-wider ${stageMeta[stage].class}`}>{stageMeta[stage].label}</div>
                          <div className="mt-0.5 text-[13px] font-bold text-white tabular-nums">{formatDuration(avg(stage))}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-[10px] text-neutral-500">
                      Averaged from <span className="text-emerald-300 font-bold">{complete.length}</span> complete topic{complete.length === 1 ? '' : 's'}
                      {incompleteCount > 0 && <> · <span className="text-amber-300 font-bold">{incompleteCount}</span> incomplete topic{incompleteCount === 1 ? '' : 's'} excluded</>}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </section>
  );
}

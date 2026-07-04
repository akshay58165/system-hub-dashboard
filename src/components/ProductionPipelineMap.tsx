import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowUpRight,
  CalendarDays,
  Camera,
  Factory,
  PenLine,
  Scissors,
  Youtube,
  Clock3,
  Sparkles,
} from 'lucide-react';
import type { SessionRecord, TaskTimerRecord, Topic, TopicActivity, VideoRecord, WorkdaySession } from '../types';

type PipelineNodeKey = 'factory' | 'script' | 'shoot' | 'edit' | 'schedule' | 'post';

interface ProductionPipelineMapProps {
  topics: Topic[];
  videos: VideoRecord[];
  activities: TopicActivity[];
  sessions: SessionRecord[];
  taskTimers: TaskTimerRecord[];
  workdaySession: WorkdaySession | null;
  focusTopic: Topic | null;
  onOpenPipeline: () => void;
}

type NodeTone = {
  badge: string;
  accent: string;
  border: string;
  glow: string;
  fill: string;
  shadow: string;
  line: string;
};

type NodeDatum = {
  key: PipelineNodeKey;
  title: string;
  subtitle: string;
  stageCount: number;
  secondaryValue: string;
  details: string[];
  icon: React.ComponentType<{ className?: string }>;
  tone: NodeTone;
};

const toneMap: Record<PipelineNodeKey, NodeTone> = {
  factory: {
    badge: 'text-cyan-300',
    accent: 'text-cyan-300',
    border: 'border-cyan-900/45',
    glow: 'shadow-[0_0_40px_rgba(34,211,238,0.10)]',
    fill: 'bg-cyan-500/10',
    shadow: 'shadow-cyan-500/20',
    line: 'rgba(34,211,238,0.55)'
  },
  script: {
    badge: 'text-violet-300',
    accent: 'text-violet-300',
    border: 'border-violet-900/45',
    glow: 'shadow-[0_0_40px_rgba(167,139,250,0.12)]',
    fill: 'bg-violet-500/10',
    shadow: 'shadow-violet-500/20',
    line: 'rgba(167,139,250,0.55)'
  },
  shoot: {
    badge: 'text-amber-300',
    accent: 'text-amber-300',
    border: 'border-amber-900/45',
    glow: 'shadow-[0_0_40px_rgba(251,191,36,0.10)]',
    fill: 'bg-amber-500/10',
    shadow: 'shadow-amber-500/20',
    line: 'rgba(251,191,36,0.55)'
  },
  edit: {
    badge: 'text-emerald-300',
    accent: 'text-emerald-300',
    border: 'border-emerald-900/45',
    glow: 'shadow-[0_0_40px_rgba(52,211,153,0.10)]',
    fill: 'bg-emerald-500/10',
    shadow: 'shadow-emerald-500/20',
    line: 'rgba(52,211,153,0.55)'
  },
  schedule: {
    badge: 'text-pink-300',
    accent: 'text-pink-300',
    border: 'border-pink-900/45',
    glow: 'shadow-[0_0_40px_rgba(244,114,182,0.12)]',
    fill: 'bg-pink-500/10',
    shadow: 'shadow-pink-500/20',
    line: 'rgba(244,114,182,0.55)'
  },
  post: {
    badge: 'text-rose-300',
    accent: 'text-rose-300',
    border: 'border-rose-900/45',
    glow: 'shadow-[0_0_40px_rgba(244,63,94,0.10)]',
    fill: 'bg-rose-500/10',
    shadow: 'shadow-rose-500/20',
    line: 'rgba(244,63,94,0.55)'
  }
};

const stageToNode: Record<Topic['status'], PipelineNodeKey> = {
  topic: 'factory',
  scripted: 'script',
  shot: 'shoot',
  edited: 'edit',
  scheduled: 'schedule',
  posted: 'post'
};

const statusCopy: Record<Topic['status'], string> = {
  topic: 'Factory load',
  scripted: 'Ink drying',
  shot: 'Camera roll',
  edited: 'Cutting room',
  scheduled: 'Calendar lock',
  posted: 'Published'
};

function stageLabelFromTimer(stage: TaskTimerRecord['stage']) {
  return ({
    script: 'Ink',
    shoot: 'Camera',
    edit: 'Edit',
    schedule: 'Calendar',
    post: 'YouTube'
  } as const)[stage];
}

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
  const paused = timer.accumulatedPausedMs + (timer.status === 'paused' && timer.pausedAt
    ? Math.max(0, now - new Date(timer.pausedAt).getTime())
    : 0);
  return { active, paused };
}

function buildFocusCopy(topic: Topic | null) {
  if (!topic) {
    return {
      title: 'Nothing is actively in focus yet',
      description: 'Pick a topic or start a timer and the map will light up the active lane automatically.'
    };
  }

  if (topic.blockedReason) {
    return {
      title: topic.name,
      description: `Resolve blocker first: ${topic.blockedReason}`
    };
  }

  const nextAction = ({
    topic: 'Start scripting and move the idea into the factory lane.',
    scripted: 'Start recording in the camera studio.',
    shot: 'Move into editing and trim the cut.',
    edited: 'Lock the publish time on the calendar.',
    scheduled: 'Publish when the slot lands.',
    posted: 'Review the post and capture the lesson.'
  } as const)[topic.status];

  return {
    title: topic.name,
    description: `${statusCopy[topic.status]} · ${nextAction}`
  };
}

function NodeScene({ node, active }: { node: PipelineNodeKey; active: boolean }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  if (node === 'factory') {
    return (
      <svg viewBox="0 0 140 110" className="h-full w-full opacity-35" aria-hidden>
        <g style={{ color: toneMap.factory.line }}>
          <path {...common} d="M16 84h108" />
          <path {...common} d="M20 84V52l18 9V52l20 10V43l22 11V52l22 12V35l18 10v39" />
          <path {...common} d="M20 52h80" />
          <path {...common} d="M34 26v14m18-20v20m22-12v12m24-18v18" />
          <path {...common} d="M31 18c2 4 4 6 4 10m20-6c2 4 5 6 5 11m21-7c1 4 4 6 4 10m23-7c2 5 5 7 5 12" />
        </g>
      </svg>
    );
  }

  if (node === 'script') {
    return (
      <svg viewBox="0 0 140 110" className="h-full w-full opacity-35" aria-hidden>
        <g style={{ color: toneMap.script.line }}>
          <path {...common} d="M40 82h60l-8-42H48l-8 42Z" />
          <path {...common} d="M55 40l9 42m-9-42 14 42" />
          <path {...common} d="M48 58h38" />
          <path {...common} d="M63 24c6 8 10 16 10 24" />
          <path {...common} d="M91 22c-6 10-10 18-10 28" />
          <circle cx="72" cy="64" r="4.5" fill="currentColor" stroke="none" />
        </g>
      </svg>
    );
  }

  if (node === 'shoot') {
    return (
      <svg viewBox="0 0 140 110" className="h-full w-full opacity-35" aria-hidden>
        <g style={{ color: toneMap.shoot.line }}>
          <rect x="28" y="36" width="64" height="38" rx="8" {...common} />
          <path {...common} d="M92 45 118 34v42L92 65" />
          <circle cx="60" cy="55" r="12" {...common} />
          <circle cx="60" cy="55" r="4" fill="currentColor" stroke="none" />
          <path {...common} d="M38 30h18l5 7H33l5-7Z" />
        </g>
      </svg>
    );
  }

  if (node === 'edit') {
    return (
      <svg viewBox="0 0 140 110" className="h-full w-full opacity-35" aria-hidden>
        <g style={{ color: toneMap.edit.line }}>
          <path {...common} d="M28 40h84v28H28z" />
          <path {...common} d="M38 46h10m10 0h10m10 0h10m10 0h10" />
          <path {...common} d="M28 54h84" />
          <path {...common} d="M48 40l18 28m16-28 18 28" />
          <path {...common} d="M50 68h40" />
        </g>
      </svg>
    );
  }

  if (node === 'schedule') {
    return (
      <svg viewBox="0 0 140 110" className="h-full w-full opacity-35" aria-hidden>
        <g style={{ color: toneMap.schedule.line }}>
          <rect x="32" y="28" width="76" height="52" rx="10" {...common} />
          <path {...common} d="M32 42h76" />
          <path {...common} d="M48 22v12m44-12v12" />
          <path {...common} d="M46 50h16m12 0h16m-44 12h16m12 0h16" />
          <circle cx="48" cy="63" r="4" fill="currentColor" stroke="none" />
          <circle cx="72" cy="63" r="4" fill="currentColor" stroke="none" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 140 110" className="h-full w-full opacity-35" aria-hidden>
      <g style={{ color: toneMap.post.line }}>
        <rect x="30" y="30" width="80" height="48" rx="12" {...common} />
        <path {...common} d="M62 42l20 12-20 12V42Z" fill="currentColor" stroke="none" />
        <path {...common} d="M28 84h84" />
        <path {...common} d="M98 42c10 6 14 12 14 18s-4 12-14 18" />
      </g>
    </svg>
  );
}

function statBadge(value: number | string, label: string, colorClass: string) {
  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/75 px-3 py-2">
      <div className={`text-sm font-semibold ${colorClass}`}>{value}</div>
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">{label}</div>
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
  const blockedTopics = topics.filter(topic => Boolean(topic.blockedReason)).length;
  const dueSoonTopics = topics.filter(topic => {
    if (!topic.dueDate) return false;
    const dueMs = new Date(topic.dueDate).getTime();
    return Number.isFinite(dueMs) && dueMs >= now && dueMs <= now + 24 * 60 * 60 * 1000;
  }).length;
  const runningTimers = taskTimers.filter(timer => timer.status === 'running').length;
  const pausedTimers = taskTimers.filter(timer => timer.status === 'paused').length;
  const activeTimers = runningTimers + pausedTimers;

  const focusNode: PipelineNodeKey = activeTaskTimer
    ? ({ script: 'script', shoot: 'shoot', edit: 'edit', schedule: 'schedule', post: 'post' } as const)[activeTaskTimer.stage]
    : (focusTopic ? stageToNode[focusTopic.status] : 'factory');

  const focusCopy = buildFocusCopy(focusTopic);

  const nodes: NodeDatum[] = useMemo(() => {
    const countTopics = (status: Topic['status']) => topics.filter(topic => topic.status === status).length;
    const countVideos = (getter: (video: VideoRecord) => boolean) => videos.filter(getter).length;
    const countTimers = (stage: TaskTimerRecord['stage']) => taskTimers.filter(timer => timer.stage === stage && (timer.status === 'running' || timer.status === 'paused')).length;

    return [
      {
        key: 'factory',
        title: 'Factory',
        subtitle: 'Topic Foundry',
        stageCount: countTopics('topic'),
        secondaryValue: `${topics.length} total topics`,
        details: [
          `${countTopics('topic')} queued ideas`,
          `${blockedTopics} blocked`,
          `${dueSoonTopics} due soon`
        ],
        icon: Factory,
        tone: toneMap.factory
      },
      {
        key: 'script',
        title: 'Ink Pot',
        subtitle: 'Script Bay',
        stageCount: countTopics('scripted'),
        secondaryValue: `${countVideos(video => video.scriptStatus === 'completed')} scripts in video data`,
        details: [
          `${countTimers('script')} active script timers`,
          `${countVideos(video => video.scriptStatus === 'in-progress')} videos writing`,
          `${countTopics('scripted')} scripted topics`
        ],
        icon: PenLine,
        tone: toneMap.script
      },
      {
        key: 'shoot',
        title: 'Camera Studio',
        subtitle: 'Record Room',
        stageCount: countTopics('shot'),
        secondaryValue: `${countVideos(video => video.shootStatus === 'completed')} shoots in video data`,
        details: [
          `${countTimers('shoot')} active shoot timers`,
          `${countVideos(video => video.shootStatus === 'in-progress')} cameras rolling`,
          `${countTopics('shot')} shot topics`
        ],
        icon: Camera,
        tone: toneMap.shoot
      },
      {
        key: 'edit',
        title: 'Editing Room',
        subtitle: 'Post Bay',
        stageCount: countTopics('edited'),
        secondaryValue: `${countVideos(video => video.editStatus === 'completed')} edits in video data`,
        details: [
          `${countTimers('edit')} active edit timers`,
          `${countVideos(video => video.editStatus === 'in-progress')} cuts moving`,
          `${countTopics('edited')} edited topics`
        ],
        icon: Scissors,
        tone: toneMap.edit
      },
      {
        key: 'schedule',
        title: 'Calendar',
        subtitle: 'Release Window',
        stageCount: countTopics('scheduled'),
        secondaryValue: `${countVideos(video => video.scheduleStatus === 'completed')} releases staged`,
        details: [
          `${countTimers('schedule')} schedule timers`,
          `${topics.filter(topic => Boolean(topic.scheduledTime)).length} with a set time`,
          `${countTopics('scheduled')} scheduled topics`
        ],
        icon: CalendarDays,
        tone: toneMap.schedule
      },
      {
        key: 'post',
        title: 'YouTube',
        subtitle: 'Final Publish',
        stageCount: countTopics('posted'),
        secondaryValue: `${countVideos(video => video.publishedStatus === 'completed')} published videos`,
        details: [
          `${countTimers('post')} publish timers`,
          `${videos.filter(video => video.publishedStatus === 'completed').length} live uploads`,
          `${countTopics('posted')} posted topics`
        ],
        icon: Youtube,
        tone: toneMap.post
      }
    ];
  }, [blockedTopics, dueSoonTopics, topics, taskTimers, videos]);

  const maxCount = Math.max(1, ...nodes.map(node => node.stageCount));
  const currentTimeLabel = workdaySession
    ? workdaySession.status === 'running'
      ? `Running ${formatDuration((workdaySession.accumulatedActiveMs || 0) + (workdaySession.activeSince ? Math.max(0, now - new Date(workdaySession.activeSince).getTime()) : 0))}`
      : `Paused ${formatDuration(workdaySession.accumulatedActiveMs || 0)}`
    : 'No day timer active';
  const currentStageLabel = activeTaskTimer ? `${stageLabelFromTimer(activeTaskTimer.stage)} lane` : 'Focus lane idle';

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

      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.24em] text-cyan-300">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            Production atlas
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Factory to publish, shown as a living pipeline map</h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Topics are born in the factory, flow through script, camera, edit, calendar, and end at YouTube. Every node below is wired to the real topics, timers, sessions, and publish history already on this dashboard.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenPipeline}
          className="group min-w-[240px] rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-700/60"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">Now flowing</span>
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_18px_#22d3ee] animate-pulse" />
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={focusCopy.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="mt-2"
            >
              <div className="text-sm font-semibold text-white">{focusCopy.title}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-neutral-400">{focusCopy.description}</div>
            </motion.div>
          </AnimatePresence>
          <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-cyan-300">
            <span>Open pipeline</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </div>
        </button>
      </div>

      <div className="relative z-10 mt-6 rounded-3xl border border-neutral-800/70 bg-neutral-950/55 p-4 md:p-5">
        <div className="relative">
          <svg
            aria-hidden
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="pointer-events-none absolute left-[8%] right-[8%] top-[112px] hidden h-2 xl:block"
          >
            <defs>
              <linearGradient id="pipeline-rail" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="8%" stopColor="rgba(255,255,255,0.14)" />
                <stop offset="92%" stopColor="rgba(255,255,255,0.14)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <motion.path
              d="M 0 60 H 1200"
              fill="none"
              stroke="url(#pipeline-rail)"
              strokeWidth="2.5"
              strokeDasharray="2 14"
              strokeLinecap="round"
              animate={{ strokeDashoffset: [0, -120] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            />
          </svg>

          <div className="grid gap-4 xl:grid-cols-6">
            {nodes.map((node, index) => {
              const active = node.key === focusNode;
              const Icon = node.icon;
              const width = Math.max(18, Math.round((node.stageCount / maxCount) * 100));
              return (
                <motion.button
                  key={node.key}
                  type="button"
                  onClick={onOpenPipeline}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className={`group relative overflow-hidden rounded-2xl border bg-neutral-950/85 p-4 text-left transition hover:-translate-y-0.5 hover:bg-neutral-900/90 focus-visible:outline-none focus-visible:ring-1 ${node.tone.border} ${active ? `${node.tone.glow} ring-1 ring-white/10` : 'border-neutral-800/70'} ${active ? 'shadow-[0_0_60px_rgba(255,255,255,0.04)]' : ''}`}
                >
                  <div className={`pointer-events-none absolute inset-0 ${node.tone.fill} opacity-80`} />
                  <div className="pointer-events-none absolute right-0 top-0 h-24 w-24">
                    <NodeScene node={node.key} active={active} />
                  </div>
                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div>
                      <div className={`font-mono text-[9px] uppercase tracking-[.24em] ${node.tone.badge}`}>{node.title}</div>
                      <div className="mt-1 text-xl font-bold text-white">{node.stageCount}</div>
                      <div className="mt-0.5 text-[11px] text-neutral-400">{node.subtitle}</div>
                    </div>
                    <div className={`grid h-10 w-10 place-items-center rounded-xl border ${node.tone.border} bg-black/30 ${node.tone.accent} ${active ? 'animate-pulse' : ''}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="relative z-10 mt-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-[.24em] text-neutral-500">Live load</span>
                      {active && (
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.24em] ${node.tone.border} ${node.tone.badge}`}>Live</span>
                      )}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-900">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className={`h-full rounded-full ${node.tone.shadow}`}
                        style={{ background: `linear-gradient(90deg, rgba(255,255,255,0.1), ${node.tone.line})` }}
                      />
                    </div>
                    <div className="mt-2 font-mono text-[10px] text-neutral-500">{node.secondaryValue}</div>
                  </div>

                  <div className="relative z-10 mt-4 space-y-1.5">
                    {node.details.map(detail => (
                      <div key={detail} className="flex items-center gap-2 font-mono text-[9px] text-neutral-400">
                        <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.75)]' : 'bg-neutral-600'}`} />
                        <span>{detail}</span>
                      </div>
                    ))}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statBadge(openTopics, 'open topics', 'text-white')}
          {statBadge(activeTimers, 'active task timers', 'text-cyan-300')}
          {statBadge(todayActions, 'actions today', 'text-sky-300')}
          {statBadge(sessions.length, 'archived sessions', 'text-violet-300')}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1.35fr_.9fr_.9fr]">
          <div className="rounded-2xl border border-neutral-800/70 bg-neutral-950/75 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">Workday timer</div>
                <div className="mt-1 text-sm font-semibold text-white">{currentTimeLabel}</div>
              </div>
              <Clock3 className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="mt-2 text-[11px] text-neutral-400">{currentStageLabel}</div>
          </div>

          <div className="rounded-2xl border border-neutral-800/70 bg-neutral-950/75 p-4">
            <div className="font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">Active timer</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {activeTaskTimer ? `${stageLabelFromTimer(activeTaskTimer.stage)} · ${activeTaskTimer.topicName}` : 'No task timer running'}
            </div>
            <div className="mt-2 text-[11px] text-neutral-400">
              {activeTaskTimer
                ? `${activeTaskTimer.status === 'paused' ? 'Paused' : 'Running'} for ${formatDuration(activeTaskTimerMs?.active ?? 0)}`
                : 'Start a topic action and the lane here will light up instantly.'}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800/70 bg-neutral-950/75 p-4">
            <div className="font-mono text-[9px] uppercase tracking-[.24em] text-neutral-500">Pipeline health</div>
            <div className="mt-1 text-sm font-semibold text-white">{blockedTopics > 0 ? `${blockedTopics} blockers` : dueSoonTopics > 0 ? `${dueSoonTopics} due soon` : 'System clear'}</div>
            <div className="mt-2 text-[11px] text-neutral-400">
              {runningTimers} running · {pausedTimers} paused · {activities.length} logged actions
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import React, { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  GitBranch, 
  Layers, 
  Database, 
  Search, 
  Settings, 
  Bell, 
  Activity, 
  Clock,
  Cpu,
  Github,
  Wifi,
  ExternalLink,
  Laptop,
  CheckCircle2,
  Lock,
  Plus,
  LogIn,
  LogOut,
  AlertCircle,
  Clapperboard,
  Menu,
  X
} from 'lucide-react';
import { supabase } from './services/supabase';

import { GitHubRepo, VercelProject, SupabaseProject, SystemEvent, Topic, TopicActivity, TopicSortMode, CycleGoal, WorkdaySession, SessionRecord, SessionGoalOutcome, VideoRecord, Experiment, CreatorInsight, ScorecardState, AiRulePreset, AiUsageStats, TaskTimerRecord, TaskTimerStage, SideWorkEntry, SittingSegment } from './types';
import { mergeRemoteWithPendingTopics, mergeTopicsByNewest, normalizeCommittedTombstones, prepareLocalTopicMutation, topicCollectionsEqual, visibleCreatorTopics } from './lib/topicSync';
import { normalizeScorecard, rolloverScorecard } from './services/scorecardStorage';
import { 
  initialGitHubRepos, 
  initialVercelProjects, 
  initialSupabaseProject, 
  initialSystemEvents,
  initialTopics,
  initialActivities,
  initialVideos,
  initialExperiments,
  initialCreatorInsights
} from './data';

import CommandPalette from './components/CommandPalette';
import WorkdayTimer from './components/WorkdayTimer';
import RunningStageBar from './components/RunningStageBar';
import TopicCreateModal from './components/TopicCreateModal';
import { TaskTimerContext } from './contexts/TaskTimerContext';

const GithubView = lazy(() => import('./components/GithubView'));
const VercelView = lazy(() => import('./components/VercelView'));
const LogsView = lazy(() => import('./components/LogsView'));
const ContentActivityView = lazy(() => import('./components/ContentActivityView'));
const LogsTableEditor = lazy(() => import('./components/LogsTableEditor'));
const ScoreView = lazy(() => import('./components/ScoreView'));
const CommandCenterView = lazy(() => import('./components/CommandCenterView'));
const PipelineView = lazy(() => import('./components/PipelineView'));
const VideoLabView = lazy(() => import('./components/VideoLabView'));
const TodayGoalsView = lazy(() => import('./components/TodayGoalsView'));
const TimeView = lazy(() => import('./components/TimeView'));
const TopicScoreView = lazy(() => import('./components/TopicScoreView'));

// Get or create session ID for the current tab session
let currentSessionId = '';
try {
  currentSessionId = sessionStorage.getItem('unicorn_session_id') || '';
  if (!currentSessionId) {
    currentSessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('unicorn_session_id', currentSessionId);
  }
} catch { /* ignore in non-browser context */ }

function createEmptyAiUsageStats(): AiUsageStats {
  return {
    budgetUSD: null,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCostUSD: 0,
    callCount: 0,
    lastCall: null,
    cycleStartedAt: new Date().toISOString()
  };
}

type PendingDeleteKind = 'content' | 'activity' | 'goal' | 'preset' | 'events';

interface PendingDeleteItem {
  kind: PendingDeleteKind;
  id: string;
  label: string;
  topicId?: string;
  topicName?: string;
}

interface PendingDeleteGroup {
  id: string;
  label: string;
  createdAt: number;
  items: PendingDeleteItem[];
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function estimatePayloadSizeMb(...payloads: unknown[]) {
  const bytes = payloads.reduce<number>((sum, payload) => sum + new Blob([JSON.stringify(payload ?? null)]).size, 0);
  return Math.max(1, Math.round((bytes / 1024 / 1024) * 100) / 100);
}

function summarizeVercelUsage(
  projects: VercelProject[],
  topics: Topic[],
  activities: TopicActivity[],
  sessions: SessionRecord[],
  taskTimers: TaskTimerRecord[],
  workdaySession: WorkdaySession | null
) {
  const liveActiveTopics = topics.filter(topic => topic.inProgress || topic.status === 'scripted' || topic.status === 'shot' || topic.status === 'edited').length;
  const liveActiveTimers = taskTimers.filter(timer => timer.status === 'running' || timer.status === 'paused').length;
  const livePressure = liveActiveTopics + liveActiveTimers + Math.min(8, activities.length) + Math.min(5, sessions.length);
  const liveStorageMb = estimatePayloadSizeMb(topics, activities, sessions, taskTimers, workdaySession);

  if (projects.length === 0) {
    return {
      cpu: clampPercent(livePressure * 12 + (workdaySession?.status === 'running' ? 6 : 0)),
      storage: `${liveStorageMb.toFixed(2)} MB`,
      ram: clampPercent((liveActiveTimers * 18) + (workdaySession ? 8 : 0) + Math.min(20, activities.length * 2)),
      topLabel: 'Active',
      topValue: liveActiveTopics,
      sourceLabel: 'Live pipeline load from topics, timers, and sessions',
      footerLabel: `${sessions.length} sessions · ${taskTimers.length} timers`,
      footerValue: 'Dashboard state',
    };
  }

  const deploymentCount = projects.reduce((sum, project) => sum + project.deployments.length, 0);
  const functionCount = projects.reduce((sum, project) => sum + project.serverlessFunctions.length, 0);
  const activeProjects = projects.filter(project => project.status !== 'offline').length;
  const totalInvocations = projects.reduce(
    (sum, project) => sum + project.serverlessFunctions.reduce((inner, fn) => inner + fn.invocations, 0),
    0
  );
  const avgLatencyMs = average(projects.flatMap(project => project.analytics.latency.map(entry => entry.avgMs)));
  const avgLcpMs = average(projects.map(project => project.analytics.webVitals.lcp));
  const artifactStorageMb = deploymentCount * 18 + functionCount * 2;

  return {
    cpu: clampPercent((totalInvocations / Math.max(1, functionCount * 45)) * 100 + activeProjects * 6),
    storage: `${Math.max(0, artifactStorageMb)} MB`,
    ram: clampPercent((avgLatencyMs / 20) + (avgLcpMs / 80) + functionCount * 2),
    topLabel: 'Projects',
    topValue: projects.length,
    deploymentCount,
    functionCount,
    sourceLabel: 'Derived from deployments, functions, and analytics',
    footerLabel: `${deploymentCount} deployments · ${functionCount} functions`,
    footerValue: 'Traffic pressure',
  };
}

function summarizeSupabaseUsage(
  project: SupabaseProject,
  topics: Topic[],
  activities: TopicActivity[],
  sessions: SessionRecord[],
  taskTimers: TaskTimerRecord[],
  workdaySession: WorkdaySession | null
) {
  const liveRecordCount = topics.length + activities.length + sessions.length + taskTimers.length;
  const liveStorageMb = estimatePayloadSizeMb(project, topics, activities, sessions, taskTimers, workdaySession);
  const liveCpu = liveRecordCount * 2 + Math.max(0, project.metrics.activeConnections * 7);
  const liveRam = liveRecordCount > 0
    ? (Math.min(40, sessions.length * 5) + Math.min(30, taskTimers.filter(timer => timer.status !== 'completed').length * 7) + (workdaySession ? 8 : 0))
    : 0;
  return {
    cpu: clampPercent(project.metrics.cpuUsage > 0 ? project.metrics.cpuUsage : liveCpu),
    storage: project.metrics.dbSize !== '0 MB' ? project.metrics.dbSize : `${liveStorageMb.toFixed(2)} MB`,
    ram: clampPercent(project.metrics.memoryUsage > 0 ? project.metrics.memoryUsage : liveRam),
    activeConnections: Math.max(project.metrics.activeConnections, taskTimers.filter(timer => timer.status === 'running' || timer.status === 'paused').length, workdaySession ? 1 : 0),
    topLabel: project.metrics.activeConnections > 0 ? 'Connections' : 'Records',
    topValue: project.metrics.activeConnections > 0 ? project.metrics.activeConnections : liveRecordCount,
    sourceLabel: project.metrics.activeConnections > 0 ? 'Live database metrics from the active project' : 'Live records from topics, sessions, and timers',
    footerLabel: 'Postgres health and capacity snapshot',
    footerValue: 'Active connections tracked live',
  };
}

function highlightCommandDestination(target: HTMLElement, shouldFocus = false) {
  document.querySelectorAll('.command-action-target').forEach((element) => {
    element.classList.remove('command-action-target');
  });
  target.classList.add('command-action-target');
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (shouldFocus) target.focus({ preventScroll: true });

  // Let the navigation and smooth scroll finish before acknowledgement starts.
  // This prevents a stationary mouse from clearing the glow as the new panel mounts beneath it.
  window.setTimeout(() => {
    const acknowledgeTarget = () => {
      target.classList.remove('command-action-target');
      target.removeEventListener('pointerenter', acknowledgeTarget);
      target.removeEventListener('pointermove', acknowledgeTarget);
      target.removeEventListener('pointerdown', acknowledgeTarget);
      target.removeEventListener('touchstart', acknowledgeTarget);
      target.removeEventListener('click', acknowledgeTarget);
      target.removeEventListener('keydown', acknowledgeTarget);
    };
    target.addEventListener('pointerenter', acknowledgeTarget);
    target.addEventListener('pointermove', acknowledgeTarget);
    target.addEventListener('pointerdown', acknowledgeTarget);
    target.addEventListener('touchstart', acknowledgeTarget, { passive: true });
    target.addEventListener('click', acknowledgeTarget);
    target.addEventListener('keydown', acknowledgeTarget);
  }, 500);
}

function parseTimestampMs(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function workdaySessionRevisionMs(session: WorkdaySession | null) {
  if (!session) return 0;
  return Math.max(
    parseTimestampMs(session.updatedAt),
    parseTimestampMs(session.startedAt),
    parseTimestampMs(session.activeSince),
    parseTimestampMs(session.pausedAt)
  );
}

function taskTimerRevisionMs(timer: TaskTimerRecord) {
  return Math.max(
    parseTimestampMs(timer.completedAt),
    parseTimestampMs(timer.pausedAt),
    parseTimestampMs(timer.activeSince),
    parseTimestampMs(timer.startedAt)
  );
}

function sessionRecordRevisionMs(session: SessionRecord) {
  return Math.max(
    parseTimestampMs(session.endedAt),
    parseTimestampMs(session.startedAt)
  );
}

// Finalize any still-running side-work entry (endedAt === null) across the
// given timers, stamping each with its final duration. Idempotent — entries
// already closed are left untouched. Called whenever the user leaves the
// paused state (resume/start/stop) or the day ends, so a side-work clock never
// keeps ticking past the moment real work resumes.
function closeOpenSideWork(timers: TaskTimerRecord[], stampMs: number): TaskTimerRecord[] {
  return timers.map(timer => {
    if (!timer.sideWork?.some(entry => entry.endedAt === null)) return timer;
    return {
      ...timer,
      sideWork: timer.sideWork.map(entry => entry.endedAt === null
        ? {
            ...entry,
            endedAt: new Date(stampMs).toISOString(),
            accumulatedMs: entry.accumulatedMs + Math.max(0, stampMs - new Date(entry.startedAt).getTime())
          }
        : entry)
    };
  });
}

// Close the currently-open sitting segment on a timer (the last one with
// endedAt === null), stamping its final activeMs. Idempotent — a timer with
// no open segment (or no segments at all) is returned unchanged.
function closeOpenSegment(timer: TaskTimerRecord, stampMs: number): TaskTimerRecord {
  const segments = timer.segments;
  if (!segments || segments.length === 0) return timer;
  const last = segments[segments.length - 1];
  if (last.endedAt !== null) return timer;
  const elapsed = Math.max(0, stampMs - new Date(last.startedAt).getTime());
  const closed: SittingSegment = {
    ...last,
    endedAt: new Date(stampMs).toISOString(),
    activeMs: last.activeMs + elapsed,
  };
  return { ...timer, segments: [...segments.slice(0, -1), closed] };
}

// Append a fresh open sitting segment (for a start or resume) so the next
// pause/stop has something to close.
function openNewSegment(timer: TaskTimerRecord, startedAtIso: string): TaskTimerRecord {
  const newSegment: SittingSegment = {
    id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    startedAt: startedAtIso,
    endedAt: null,
    activeMs: 0,
  };
  return { ...timer, segments: [...(timer.segments || []), newSegment] };
}

function finalizeTaskTimersForSession(
  timers: TaskTimerRecord[],
  session: WorkdaySession,
  endedAtIso: string
) {
  const endedAt = new Date(endedAtIso).getTime();
  return closeOpenSideWork(timers, endedAt).map(timer => {
    const belongsToSession = timer.workdaySessionId === session.startedAt || (!timer.workdaySessionId && timer.dateKey === session.dateKey);
    if (!belongsToSession || (timer.status !== 'running' && timer.status !== 'paused')) return timer;
    // Also settle the last sitting (endedAt=null) so archived history holds
    // an honest per-sitting timeline instead of one dangling open segment.
    const withSegment = timer.status === 'running' ? closeOpenSegment(timer, endedAt) : timer;
    return {
      ...withSegment,
      status: 'completed' as const,
      completedAt: endedAtIso,
      accumulatedActiveMs: withSegment.accumulatedActiveMs + (timer.status === 'running' && timer.activeSince ? Math.max(0, endedAt - new Date(timer.activeSince).getTime()) : 0),
      accumulatedPausedMs: withSegment.accumulatedPausedMs + (timer.status === 'paused' && timer.pausedAt ? Math.max(0, endedAt - new Date(timer.pausedAt).getTime()) : 0),
      activeSince: null,
      pausedAt: null,
      endReason: 'deferred' as const
    };
  });
}

function buildArchivedSessionRecord(
  current: WorkdaySession,
  topics: Topic[],
  taskTimers: TaskTimerRecord[],
  endedAtIso: string,
  // Productivity score (1–10) the user gave for the final active segment when
  // stopping the timer. When absent, an active-at-stop segment counts as 100%.
  finalProductivityScore?: number
): SessionRecord {
  const stageOrder: Topic['status'][] = ['topic', 'hooked', 'scripted', 'shot', 'edited', 'scheduled', 'posted'];
  const achievedGoals: SessionGoalOutcome[] = [];
  const pendingGoals: SessionGoalOutcome[] = [];
  const endedAt = new Date(endedAtIso).getTime();
  const activeCarry = current.status === 'running' && current.activeSince
    ? Math.max(0, endedAt - new Date(current.activeSince).getTime())
    : 0;
  const pausedCarry = current.status === 'paused' && current.pausedAt
    ? Math.max(0, endedAt - new Date(current.pausedAt).getTime())
    : 0;

  (current.goals || []).forEach(goal => {
    const topic = topics.find(t => t.id === goal.topicId);
    if (!topic) return;
    const outcome: SessionGoalOutcome = { topicId: topic.id, topicName: topic.name, targetStatus: goal.targetStatus };
    const isDone = stageOrder.indexOf(topic.status) >= stageOrder.indexOf(goal.targetStatus);
    (isDone ? achievedGoals : pendingGoals).push(outcome);
  });

  const droppedGoals: SessionGoalOutcome[] = (current.droppedGoals || []).map(d => ({
    topicId: d.topicId,
    topicName: d.topicName,
    targetStatus: d.targetStatus
  }));
  const finalizedTimers = finalizeTaskTimersForSession(taskTimers, current, endedAtIso);

  // The final active segment (last resume → stop) is scored just like a pause
  // segment: it contributes to productive time at score/10, not a flat 100%.
  const finalSegmentMultiplier = typeof finalProductivityScore === 'number'
    ? finalProductivityScore / 10
    : 1;
  const finalActiveMs = current.accumulatedActiveMs + activeCarry;
  const finalProductiveMs = (current.productiveActiveMs ?? current.accumulatedActiveMs) + activeCarry * finalSegmentMultiplier;
  const finalPausedMs = current.accumulatedPausedMs + pausedCarry;

  return {
    id: `session-${Date.now()}`,
    dateKey: current.dateKey,
    startedAt: current.startedAt,
    endedAt: endedAtIso,
    targetMinutes: current.targetMinutes,
    extensionMinutes: current.extensionMinutes || 0,
    accumulatedActiveMs: finalActiveMs,
    productiveActiveMs: finalProductiveMs,
    productivityPercent: finalActiveMs ? Math.min(100, (finalProductiveMs / finalActiveMs) * 100) : 100,
    accumulatedPausedMs: finalPausedMs,
    breaksCount: current.breaksCount || 0,
    sessionNote: current.sessionNote,
    achievedGoals,
    droppedGoals,
    pendingGoals,
    taskTimers: finalizedTimers.filter(timer => timer.workdaySessionId === current.startedAt || (!timer.workdaySessionId && timer.dateKey === current.dateKey))
  };
}

function mergeWorkdaySessionByNewest(
  remoteSession: WorkdaySession | null,
  localSession: WorkdaySession | null,
  remoteStateRevisionMs = 0,
  localEndRevisionMs = 0
) {
  const remoteRevision = workdaySessionRevisionMs(remoteSession);
  const localRevision = localSession ? workdaySessionRevisionMs(localSession) : localEndRevisionMs;

  if (!remoteSession) {
    return remoteStateRevisionMs >= localRevision ? null : localSession;
  }

  if (!localSession) {
    // Local has no active session — either we never had one, or we just ended
    // it. If our end is at least as recent as the remote session's last change,
    // the session was intentionally cleared; do NOT resurrect the stale remote
    // running session (that's what made a stopped timer keep ticking).
    return localEndRevisionMs >= remoteRevision ? null : remoteSession;
  }
  return localRevision >= remoteRevision ? localSession : remoteSession;
}

function mergeSessionRecordsByNewest(
  remoteSessions: SessionRecord[] = [],
  localSessions: SessionRecord[] = [],
  remoteStateRevisionMs = 0
) {
  if (remoteSessions.length === 0) {
    const localNewest = localSessions.reduce((max, session) => Math.max(max, sessionRecordRevisionMs(session)), 0);
    return remoteStateRevisionMs >= localNewest ? [] : localSessions;
  }

  const merged = new Map<string, SessionRecord>();
  const upsert = (session: SessionRecord) => {
    const existing = merged.get(session.id);
    if (!existing || sessionRecordRevisionMs(session) > sessionRecordRevisionMs(existing)) {
      merged.set(session.id, session);
    }
  };

  remoteSessions.forEach(upsert);
  localSessions.forEach(upsert);

  return Array.from(merged.values()).sort((a, b) =>
    sessionRecordRevisionMs(b) - sessionRecordRevisionMs(a) ||
    parseTimestampMs(b.startedAt) - parseTimestampMs(a.startedAt)
  );
}

function mergeTaskTimersByNewest(
  remoteTimers: TaskTimerRecord[] = [],
  localTimers: TaskTimerRecord[] = [],
  remoteStateRevisionMs = 0
) {
  if (remoteTimers.length === 0) {
    const localNewest = localTimers.reduce((max, timer) => Math.max(max, taskTimerRevisionMs(timer)), 0);
    return healStaleRunningTimers(remoteStateRevisionMs >= localNewest ? [] : localTimers);
  }

  const merged = new Map<string, TaskTimerRecord>();
  const upsert = (timer: TaskTimerRecord) => {
    const existing = merged.get(timer.id);
    if (!existing || taskTimerRevisionMs(timer) > taskTimerRevisionMs(existing)) {
      merged.set(timer.id, timer);
    }
  };

  remoteTimers.forEach(upsert);
  localTimers.forEach(upsert);

  return healStaleRunningTimers(Array.from(merged.values()).sort((a, b) =>
    taskTimerRevisionMs(b) - taskTimerRevisionMs(a) ||
    parseTimestampMs(b.startedAt) - parseTimestampMs(a.startedAt)
  ));
}

// A running timer left over from a previous browser session (tab closed
// without pausing) still has status='running' with an activeSince from
// hours or days ago. Every subsequent render, `now - activeSince` inflates
// the displayed elapsed time — and the very next pause bakes that
// inflated number into accumulatedActiveMs, permanently corrupting the
// stage total. On load, cap any such stale timer so a 30-minute session
// can never silently become 8 hours.
const STALE_RUNNING_THRESHOLD_MS = 6 * 60 * 60 * 1000;
const STALE_RUNNING_CAP_MS = 30 * 60 * 1000;
function healStaleRunningTimers(timers: TaskTimerRecord[]): TaskTimerRecord[] {
  const nowMs = Date.now();
  return timers.map(tt => {
    if (tt.status !== 'running' || !tt.activeSince) return tt;
    const activeSinceMs = new Date(tt.activeSince).getTime();
    const elapsed = nowMs - activeSinceMs;
    if (!Number.isFinite(elapsed) || elapsed < STALE_RUNNING_THRESHOLD_MS) return tt;
    const capped = Math.min(elapsed, STALE_RUNNING_CAP_MS);
    const cappedEndMs = activeSinceMs + capped;
    const cappedEndIso = new Date(cappedEndMs).toISOString();
    const closed = closeOpenSegment(tt, cappedEndMs);
    return {
      ...closed,
      status: 'paused' as const,
      accumulatedActiveMs: closed.accumulatedActiveMs + capped,
      activeSince: null,
      pausedAt: cappedEndIso,
      breaksCount: tt.breaksCount + 1,
      pauseSource: 'manual' as const,
    };
  });
}

const workflowStageNames = ['hook', 'script', 'shoot', 'edit', 'schedule', 'post'] as const;

function workflowStatusesForTopicStatus(status: Topic['status']) {
  const completedThrough = {
    topic: -1,
    hooked: 0,
    scripted: 1,
    shot: 2,
    edited: 3,
    scheduled: 4,
    posted: 5
  }[status];

  return workflowStageNames.reduce((acc, stage, index) => {
    acc[stage] = index <= completedThrough ? 'completed' : 'pending';
    return acc;
  }, {} as Partial<Record<typeof workflowStageNames[number], 'pending' | 'in-progress' | 'completed'>>);
}

function isWorkflowInProgressStatus(status: Topic['status']) {
  return status === 'hooked' || status === 'scripted' || status === 'shot' || status === 'edited';
}

export default function App() {
  useEffect(() => {
    // Remove credentials stored by versions that called OpenAI from the browser.
    localStorage.removeItem('unicorn_openai_api_key');
  }, []);

  const [activeTab, setActiveTab] = useState<'overview' | 'topics' | 'progress' | 'actionhub' | 'logs' | 'score' | 'pipeline' | 'videolab' | 'topicintel' | 'experiments' | 'sessions'>(() => {
    const savedTab = localStorage.getItem('unicorn_active_tab') as any;
    return savedTab === 'insights' ? 'overview' : savedTab || 'overview';
  });

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pipelineSubView, setPipelineSubView] = useState<'videos' | 'topics'>('videos');
  const [topicSortOrder, setTopicSortOrder] = useState<TopicSortMode>('due-date');
  const previousTopicSortUserIdRef = useRef<string | null>(null);

  const [cycleGoals, setCycleGoals] = useState<CycleGoal | null>(null);
  const [workdaySession, setWorkdaySession] = useState<WorkdaySession | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [taskTimers, setTaskTimers] = useState<TaskTimerRecord[]>([]);

  const [scorecard, setScorecard] = useState<ScorecardState>(() => normalizeScorecard(null));

  // Day-rollover safety net for a tab left open across midnight: a 60s poll
  // plus an immediate check on tab focus/visibility regain. Rollover also
  // runs on every remote scorecard payload (see setScorecard(normalizeScorecard(...))
  // call sites below), so this mainly covers the "staring at an open tab
  // through midnight" case that no remote sync would otherwise trigger.
  useEffect(() => {
    const checkRollover = () => setScorecard(prev => rolloverScorecard(prev));
    const interval = setInterval(checkRollover, 60_000);
    const onFocus = () => checkRollover();
    const onVisibility = () => { if (document.visibilityState === 'visible') checkRollover(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  const [repos, setRepos] = useState<GitHubRepo[]>(initialGitHubRepos);
  const [vercelProjects, setVercelProjects] = useState<VercelProject[]>(initialVercelProjects);
  // Renamed from `supabase` - that name was shadowing the real Supabase client
  // imported above, silently breaking every auth/db/realtime call in this file.
  const [supabaseProject, setSupabaseProject] = useState<SupabaseProject>(initialSupabaseProject);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [activities, setActivitiesState] = useState<TopicActivity[]>(initialActivities);
  const activitiesRef = useRef<TopicActivity[]>(initialActivities);
  const setActivities: React.Dispatch<React.SetStateAction<TopicActivity[]>> = (update) => {
    const next = typeof update === 'function' ? update(activitiesRef.current) : update;
    activitiesRef.current = next;
    setActivitiesState(next);
  };
  const isRemoteSyncRef = useRef(false);
  const [topics, setTopicsState] = useState<Topic[]>(initialTopics);
  const topicTombstonesRef = useRef<Record<string, string>>({});
  const videoTombstonesRef = useRef<Record<string, string>>({});
  const dirtyTopicIdsRef = useRef<Set<string>>(new Set());
  const topicMutationEpochRef = useRef(0);
  const [pendingDeleteGroups, setPendingDeleteGroups] = useState<PendingDeleteGroup[]>([]);
  const pendingDeleteTimersRef = useRef<Record<string, number>>({});
  const pendingDeleteCommittersRef = useRef<Record<string, (() => void) | undefined>>({});
  const pendingDeleteGroupsRef = useRef<PendingDeleteGroup[]>([]);
  const setTopics: React.Dispatch<React.SetStateAction<Topic[]>> = (update) => {
    setTopicsState(previous => {
      const requested = typeof update === 'function' ? update(previous) : update;
      const changedAt = new Date().toISOString();
      const next = prepareLocalTopicMutation(previous, requested, changedAt);
      const previousById = new Map(previous.map(topic => [topic.id, topic]));
      const nextById = new Map(next.map(topic => [topic.id, topic]));
      const nextIds = new Set(next.map(topic => topic.id));
      const deletedAt = new Date().toISOString();
      previous.forEach(topic => {
        if (!nextIds.has(topic.id)) {
          topicTombstonesRef.current[topic.id] = deletedAt;
          dirtyTopicIdsRef.current.add(topic.id);
        }
      });
      next.forEach(topic => {
        const oldTopic = previousById.get(topic.id);
        if (!oldTopic || oldTopic !== topic) {
          dirtyTopicIdsRef.current.add(topic.id);
          delete topicTombstonesRef.current[topic.id];
        }
      });
      // A user mutation must always cancel a leftover remote-snapshot skip.
      // Otherwise the next real edit can be mistaken for an echo and never saved.
      isRemoteSyncRef.current = false;
      topicMutationEpochRef.current += 1;

      const auditChanges = [
        ...next.filter(topic => {
          const oldTopic = previousById.get(topic.id);
          return !oldTopic || oldTopic !== topic;
        }).map(topic => ({ topic, previous: previousById.get(topic.id), deleted: false })),
        ...previous.filter(topic => !nextById.has(topic.id)).map(topic => ({ topic, previous: topic, deleted: true }))
      ];

      if (auditChanges.length > 0) {
        const activityIdsBeforeMutation = new Set(activitiesRef.current.map(activity => activity.id));
        queueMicrotask(() => {
          const newlyAddedForTopic = (topicName: string) => activitiesRef.current.find(activity =>
            !activityIdsBeforeMutation.has(activity.id) && activity.topicName === topicName
          );
          const entriesNeedingTargets = auditChanges
            .map(change => ({ change, activity: newlyAddedForTopic(change.topic.name) }))
            .filter(entry => entry.activity && !entry.activity.topicId);
          if (entriesNeedingTargets.length > 0) {
            const targets = new Map(entriesNeedingTargets.map(entry => [entry.activity!.id, entry.change.topic.id]));
            setActivities(current => current.map(activity => targets.has(activity.id) ? {
              ...activity,
              topicId: targets.get(activity.id),
              targetTab: 'pipeline',
              targetSubView: 'topics'
            } : activity));
          }
          const missing = auditChanges.filter(change => !activitiesRef.current.some(activity =>
            !activityIdsBeforeMutation.has(activity.id) && activity.topicName === change.topic.name
          ));
          if (missing.length === 0) return;

          const describeTopicDiff = (previousTopic: Topic, nextTopic: Topic): string | null => {
            const parts: string[] = [];
            const prettyDate = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleDateString() : '—';
            if ((previousTopic.name || '') !== (nextTopic.name || '')) parts.push(`Renamed "${previousTopic.name}" → "${nextTopic.name}"`);
            if ((previousTopic.description || '') !== (nextTopic.description || '')) parts.push('Edited description');
            if (previousTopic.channel !== nextTopic.channel) parts.push(`Channel ${previousTopic.channel} → ${nextTopic.channel}`);
            if (previousTopic.format !== nextTopic.format) parts.push(`Format ${previousTopic.format || 'None'} → ${nextTopic.format || 'None'}`);
            if (previousTopic.category !== nextTopic.category) parts.push(`Category ${previousTopic.category || 'None'} → ${nextTopic.category || 'None'}`);
            if (previousTopic.priority !== nextTopic.priority) parts.push(`Priority ${previousTopic.priority} → ${nextTopic.priority}`);
            if ((previousTopic.topicScore ?? null) !== (nextTopic.topicScore ?? null)) {
              parts.push(nextTopic.topicScore === undefined
                ? 'Cleared topic score'
                : previousTopic.topicScore === undefined
                  ? `Scored ${nextTopic.topicScore}/10`
                  : `Score ${previousTopic.topicScore} → ${nextTopic.topicScore}`);
            }
            if ((previousTopic.explanationDifficulty ?? null) !== (nextTopic.explanationDifficulty ?? null)) {
              parts.push(nextTopic.explanationDifficulty === undefined
                ? 'Cleared explanation difficulty'
                : previousTopic.explanationDifficulty === undefined
                  ? `Set explanation difficulty ${nextTopic.explanationDifficulty}/10`
                  : `Difficulty ${previousTopic.explanationDifficulty} → ${nextTopic.explanationDifficulty}`);
            }
            if ((previousTopic.revenueLevel || '') !== (nextTopic.revenueLevel || '')) parts.push(`Revenue ${previousTopic.revenueLevel || 'None'} → ${nextTopic.revenueLevel || 'None'}`);
            if ((previousTopic.dueDate || null) !== (nextTopic.dueDate || null)) parts.push(`Due date ${prettyDate(previousTopic.dueDate)} → ${prettyDate(nextTopic.dueDate)}`);
            if ((previousTopic.scheduledTime || '') !== (nextTopic.scheduledTime || '')) parts.push(`Scheduled time ${previousTopic.scheduledTime || '—'} → ${nextTopic.scheduledTime || '—'}`);
            if (Boolean(previousTopic.savedForLater) !== Boolean(nextTopic.savedForLater)) parts.push(nextTopic.savedForLater ? 'Saved for later' : 'Restored from Later');
            if ((previousTopic.blockedReason || '') !== (nextTopic.blockedReason || '')) {
              parts.push(nextTopic.blockedReason
                ? `Blocked: ${nextTopic.blockedReason}`
                : 'Unblocked');
            }
            if (Boolean(previousTopic.autoPostPaused) !== Boolean(nextTopic.autoPostPaused)) parts.push(nextTopic.autoPostPaused ? 'Paused auto-post' : 'Resumed auto-post');
            const prevWf = previousTopic.workflowStatuses || {};
            const nextWf = nextTopic.workflowStatuses || {};
            const stageKeys: Array<'hook' | 'script' | 'shoot' | 'edit' | 'schedule' | 'post'> = ['hook', 'script', 'shoot', 'edit', 'schedule', 'post'];
            stageKeys.forEach(stage => {
              const before = prevWf[stage] || 'pending';
              const after = nextWf[stage] || 'pending';
              if (before !== after) parts.push(`${stage.charAt(0).toUpperCase() + stage.slice(1)} ${before} → ${after}`);
            });
            return parts.length > 0 ? parts.join(' · ') : null;
          };

          const generated = missing.map((change, index): TopicActivity => {
            const previousTopic = change.previous;
            let action = 'Updated topic details';
            if (change.deleted) action = 'Deleted topic';
            else if (!previousTopic) action = 'Created topic';
            else if (previousTopic.status !== change.topic.status || previousTopic.inProgress !== change.topic.inProgress) {
              action = `Changed workflow from ${previousTopic.status}${previousTopic.inProgress ? ' (pipeline)' : ''} to ${change.topic.status}${change.topic.inProgress ? ' (pipeline)' : ''}`;
            } else if (previousTopic) {
              const diff = describeTopicDiff(previousTopic, change.topic);
              if (diff) action = diff;
            }
            return {
              id: `act-auto-${Date.now()}-${index}-${change.topic.id}`,
              topicName: change.topic.name,
              channel: change.topic.channel,
              action,
              author: 'Akshay',
              timestamp: changedAt,
              topicId: change.topic.id,
              targetTab: 'pipeline',
              targetSubView: 'topics'
            };
          });
          setActivities(current => [...generated, ...current]);
        });
      }
      return next;
    });
  };

  const scheduleDeleteGroup = (items: PendingDeleteItem[], commit: () => void, label: string) => {
    const groupId = `del-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const createdAt = Date.now();
    pendingDeleteCommittersRef.current[groupId] = commit;
    setPendingDeleteGroups(prev => [...prev, { id: groupId, label, createdAt, items }]);
    pendingDeleteTimersRef.current[groupId] = window.setTimeout(() => {
      setPendingDeleteGroups(prev => prev.filter(group => group.id !== groupId));
      const timer = pendingDeleteTimersRef.current[groupId];
      if (timer) window.clearTimeout(timer);
      delete pendingDeleteTimersRef.current[groupId];
      const commitPending = pendingDeleteCommittersRef.current[groupId];
      delete pendingDeleteCommittersRef.current[groupId];
      suppressNextSaveRef.current = false;
      commitPending?.();
    }, 10_000);
  };

  const undoLastDelete = () => {
    const latest = pendingDeleteGroupsRef.current[pendingDeleteGroupsRef.current.length - 1];
    if (!latest) return;
    const timer = pendingDeleteTimersRef.current[latest.id];
    if (timer) window.clearTimeout(timer);
    delete pendingDeleteTimersRef.current[latest.id];
    delete pendingDeleteCommittersRef.current[latest.id];
    setPendingDeleteGroups(prev => prev.filter(group => group.id !== latest.id));
  };

  const requestDeleteContent = (items: PendingDeleteItem[], commit: () => void, label: string) => {
    scheduleDeleteGroup(items, commit, label);
  };

  const requestDeleteGoal = (goalId: string) => {
    const currentSession = workdaySession;
    if (!currentSession) return;
    const goal = (currentSession.goals || []).find(item => item.id === goalId);
    if (!goal) return;
    const topic = topics.find(item => item.id === goal.topicId);
    const goalTopicName = topic?.name || goal.topicId;
    const goalTargetStatus = goal.targetStatus;
    requestDeleteContent([{
      kind: 'goal',
      id: goal.id,
      label: goalTopicName,
      topicId: goal.topicId,
      topicName: topic?.name
    }], () => {
      setWorkdaySession(current => {
        if (!current) return current;
        const goalEntry = (current.goals || []).find(item => item.id === goalId);
        const droppedEntry = goalEntry ? [{
          id: goalEntry.id,
          topicId: goalEntry.topicId,
          topicName: goalTopicName,
          targetStatus: goalTargetStatus,
          droppedAt: new Date().toISOString()
        }] : [];
        return {
          ...current,
          goals: (current.goals || []).filter(item => item.id !== goalId),
          droppedGoals: [...(current.droppedGoals || []), ...droppedEntry],
          updatedAt: new Date().toISOString()
        };
      });
    }, `Remove goal "${topic?.name || goal.topicId}"`);
  };

  const requestDeleteActivity = (activityId: string) => {
    const activity = activities.find(item => item.id === activityId);
    if (!activity) return;
    requestDeleteContent([{
      kind: 'activity',
      id: activity.id,
      label: activity.action,
      topicId: activity.topicId,
      topicName: activity.topicName
    }], () => {
      setActivities(prev => prev.filter(item => item.id !== activityId));
    }, `Remove activity "${activity.action}"`);
  };

  const requestDeletePreset = (presetId: string) => {
    const preset = aiPresets.find(item => item.id === presetId);
    if (!preset) return;
    requestDeleteContent([{
      kind: 'preset',
      id: preset.id,
      label: preset.name
    }], () => {
      setAiPresets(prev => prev.filter(item => item.id !== presetId));
    }, `Remove preset "${preset.name}"`);
  };

  const requestClearEvents = () => {
    if (!events.length) return;
    requestDeleteContent([{
      kind: 'events',
      id: 'terminal-events',
      label: 'Terminal logs'
    }], () => {
      setEvents([]);
      localStorage.removeItem('unicorn_events');
    }, 'Clear terminal logs');
  };

  const requestDeleteContentItem = (itemId: string, label: string, topicName?: string) => {
    const matchingTopic = topics.find(topic => topic.id === itemId);
    const matchingVideo = videos.find(video => video.id === itemId);
    const relatedTopicName = topicName || matchingTopic?.name || matchingVideo?.title || label;
    requestDeleteContent([{
      kind: 'content',
      id: itemId,
      label: relatedTopicName,
      topicId: matchingTopic?.id || matchingVideo?.id,
      topicName: relatedTopicName
    }], () => {
      const deletedAt = new Date().toISOString();
      if (matchingTopic) {
        topicTombstonesRef.current[matchingTopic.id] = deletedAt;
        dirtyTopicIdsRef.current.add(matchingTopic.id);
        topicMutationEpochRef.current += 1;
        isRemoteSyncRef.current = false;
      }
      if (matchingVideo) {
        videoTombstonesRef.current[matchingVideo.id] = deletedAt;
      }
      setTopicsState(prev => prev.filter(topic => topic.id !== itemId));
      setVideos(prev => prev.filter(video => video.id !== itemId));
      setTaskTimers(prev => prev.filter(timer => timer.topicId !== itemId));
      setSelectedVideoId(current => current === itemId ? null : current);
      setActivities(prev => prev.filter(activity => {
        if (activity.topicId === itemId) return false;
        if (relatedTopicName && activity.topicName === relatedTopicName) return false;
        return true;
      }));
      setEvents(prev => [{
        id: `evt-delete-${Date.now()}-${itemId}`,
        source: 'system',
        type: 'warning',
        message: `Deleted "${relatedTopicName}" after undo window expired.`,
        timestamp: deletedAt
      }, ...prev]);
    }, `Delete "${relatedTopicName}"`);
  };

  const requestDeleteContentItems = (items: Array<{ id: string; label: string; topicName?: string }>, label: string) => {
    if (!items.length) return;
    requestDeleteContent(items.map(item => ({
      kind: 'content',
      id: item.id,
      label: item.label,
      topicName: item.topicName || item.label
    })), () => {
      const deletedAt = new Date().toISOString();
      const deletedIds = new Set(items.map(item => item.id));
      const deletedNames = new Set(items.map(item => item.topicName || item.label));
      items.forEach(item => {
        if (topics.find(topic => topic.id === item.id)) {
          topicTombstonesRef.current[item.id] = deletedAt;
          dirtyTopicIdsRef.current.add(item.id);
        }
        if (videos.find(video => video.id === item.id)) {
          videoTombstonesRef.current[item.id] = deletedAt;
        }
      });
      if (items.some(item => topics.some(topic => topic.id === item.id))) {
        topicMutationEpochRef.current += 1;
        isRemoteSyncRef.current = false;
      }
      setTopicsState(prev => prev.filter(topic => !deletedIds.has(topic.id)));
      setVideos(prev => prev.filter(video => !deletedIds.has(video.id)));
      setTaskTimers(prev => prev.filter(timer => !deletedIds.has(timer.topicId)));
      setSelectedVideoId(current => current && deletedIds.has(current) ? null : current);
      setActivities(prev => prev.filter(activity => {
        if (activity.topicId && deletedIds.has(activity.topicId)) return false;
        if (deletedNames.has(activity.topicName)) return false;
        return true;
      }));
    }, label);
  };
  useEffect(() => {
    pendingDeleteGroupsRef.current = pendingDeleteGroups;
  }, [pendingDeleteGroups]);

  // Referential integrity: a workday goal only ever references a topic by
  // id (see WorkdaySession in types.ts) and is never a valid goal once that
  // topic no longer exists — regardless of where/how the topic was removed
  // (manual delete, demo cleanup, or a full DB reset). This keeps that
  // invariant true continuously instead of leaving orphaned goals visible
  // until the next full reload happens to overwrite them.
  useEffect(() => {
    if (!workdaySession?.goals?.length) return;
    const liveTopicIds = new Set(topics.map(t => t.id));
    const prunedGoals = workdaySession.goals.filter(goal => liveTopicIds.has(goal.topicId));
    if (prunedGoals.length !== workdaySession.goals.length) {
      setWorkdaySession(prev => prev ? { ...prev, goals: prunedGoals, updatedAt: new Date().toISOString() } : prev);
    }
  }, [topics, workdaySession]);

  // Ends the live workday session by turning it into a permanent
  // SessionRecord — every session becomes a real history entry, regardless
  // of how it ends (ran out of time, manually ended, etc.), instead of
  // silently discarding the day's record the way "reset" used to.
  // "Discard without saving" — the day is thrown away, so we don't archive
  // anything. But we still need to (1) drop this workday's task timers so
  // they stop ticking, (2) push the null workday to Supabase, and (3) stamp
  // lastWorkdayEndAtRef so the next remote-state merge doesn't happily
  // rehydrate the session we just told the user is gone.
  const discardWorkdaySession = () => {
    const current = workdaySession;
    if (!current) return;
    const now = new Date();
    // Drop every timer that belonged to this discarded workday — timers
    // from other sessions must stay untouched.
    const nextTaskTimers = taskTimers.filter(timer =>
      timer.workdaySessionId !== current.startedAt
      && !(!timer.workdaySessionId && timer.dateKey === current.dateKey)
    );
    lastWorkdayEndAtRef.current = now.getTime();
    suppressNextSaveRef.current = true;
    setTaskTimers(nextTaskTimers);
    setWorkdaySession(null);
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveStateToSupabase(topics, activities, cycleGoals, null, sessions, scorecard, videos, experiments, insights, aiPresets, aiUsage, nextTaskTimers))
      .catch(error => {
        console.error('Failed to save discarded session:', error);
        setSyncError(error instanceof Error ? error.message : 'Failed to save discarded session.');
      });
  };

  const endWorkdaySession = (finalProductivityScore?: number) => {
    const current = workdaySession;
    if (!current) return;
    const now = new Date();
    const endedAtIso = now.toISOString();
    const record = buildArchivedSessionRecord(current, topics, taskTimers, endedAtIso, finalProductivityScore);
    const nextSessions = [record, ...sessions];
    const nextTaskTimers = finalizeTaskTimersForSession(taskTimers, current, endedAtIso);

    lastWorkdayEndAtRef.current = now.getTime();
    suppressNextSaveRef.current = true;
    setSessions(nextSessions);
    setTaskTimers(nextTaskTimers);
    setWorkdaySession(null);
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveStateToSupabase(topics, activities, cycleGoals, null, nextSessions, scorecard, videos, experiments, insights, aiPresets, aiUsage, nextTaskTimers))
      .catch(error => {
        console.error('Failed to save archived session:', error);
        setSyncError(error instanceof Error ? error.message : 'Failed to save archived session.');
      });
  };

  const [aiPresets, setAiPresets] = useState<AiRulePreset[]>([]);
  const [aiUsage, setAiUsage] = useState<AiUsageStats>(() => createEmptyAiUsageStats());

  const [videos, setVideos] = useState<VideoRecord[]>(initialVideos);
  const [experiments, setExperiments] = useState<Experiment[]>(initialExperiments);
  const [insights, setInsights] = useState<CreatorInsight[]>(initialCreatorInsights);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [topicFormTopic, setTopicFormTopic] = useState<Topic | null>(null);
  // Set when a pipeline card asks to jump to a specific topic's scorecard.
  // TopicScoreView reads it, auto-expands + scrolls to that card, then calls
  // onFocusHandled to clear it so a later tab visit stays neutral.
  const [scoreFocusTopicId, setScoreFocusTopicId] = useState<string | null>(null);

  const pendingDeleteContentIds = useMemo(() => new Set(
    pendingDeleteGroups.flatMap(group => group.items.filter(item => item.kind === 'content').map(item => item.id))
  ), [pendingDeleteGroups]);
  const pendingDeleteContentNames = useMemo(() => new Set(
    pendingDeleteGroups.flatMap(group => group.items.filter(item => item.kind === 'content').flatMap(item => item.topicName ? [item.topicName] : []))
  ), [pendingDeleteGroups]);
  const pendingDeleteActivityIds = useMemo(() => new Set(
    pendingDeleteGroups.flatMap(group => group.items.filter(item => item.kind === 'activity').map(item => item.id))
  ), [pendingDeleteGroups]);
  const pendingDeleteGoalIds = useMemo(() => new Set(
    pendingDeleteGroups.flatMap(group => group.items.filter(item => item.kind === 'goal').map(item => item.id))
  ), [pendingDeleteGroups]);
  const pendingDeletePresetIds = useMemo(() => new Set(
    pendingDeleteGroups.flatMap(group => group.items.filter(item => item.kind === 'preset').map(item => item.id))
  ), [pendingDeleteGroups]);

  const visibleTopics = useMemo(() => topics.filter(topic => !pendingDeleteContentIds.has(topic.id)), [topics, pendingDeleteContentIds]);
  const visibleVideos = useMemo(() => videos.filter(video => !pendingDeleteContentIds.has(video.id) && !videoTombstonesRef.current[video.id]), [videos, pendingDeleteContentIds]);
  const visibleActivities = useMemo(() => activities.filter(activity => {
    if (pendingDeleteActivityIds.has(activity.id)) return false;
    if (activity.topicId && pendingDeleteContentIds.has(activity.topicId)) return false;
    if (activity.topicName && pendingDeleteContentNames.has(activity.topicName)) return false;
    return true;
  }), [activities, pendingDeleteActivityIds, pendingDeleteContentIds, pendingDeleteContentNames]);
  const visibleWorkdaySession = useMemo(() => {
    if (!workdaySession) return null;
    const filteredGoals = (workdaySession.goals || []).filter(goal => !pendingDeleteGoalIds.has(goal.id) && !pendingDeleteContentIds.has(goal.topicId));
    if (filteredGoals.length === (workdaySession.goals || []).length) return workdaySession;
    return { ...workdaySession, goals: filteredGoals };
  }, [workdaySession, pendingDeleteGoalIds, pendingDeleteContentIds]);
  const visibleTaskTimers = useMemo(() => taskTimers.filter(timer => !pendingDeleteContentIds.has(timer.topicId)), [taskTimers, pendingDeleteContentIds]);
  const visibleAiPresets = useMemo(() => aiPresets.filter(preset => !pendingDeletePresetIds.has(preset.id)), [aiPresets, pendingDeletePresetIds]);
  const visibleEvents = useMemo(() => {
    const pendingClear = pendingDeleteGroups.some(group => group.items.some(item => item.kind === 'events'));
    return pendingClear ? [] : events;
  }, [events, pendingDeleteGroups]);

  const vercelUsageSummary = summarizeVercelUsage(vercelProjects, visibleTopics, visibleActivities, sessions, visibleTaskTimers, visibleWorkdaySession);
  const supabaseUsageSummary = summarizeSupabaseUsage(supabaseProject, visibleTopics, visibleActivities, sessions, visibleTaskTimers, visibleWorkdaySession);

  // Bidirectional Synchronization between topics and videos
  useEffect(() => {
    // 1. Synchronize topics into videos
    setVideos(prevVideos => {
      let changed = false;
      const nextVideos = [...prevVideos];

      // Remove videos that are deleted in tombstones
      const deletedIds = new Set([
        ...Object.keys(topicTombstonesRef.current),
        ...Object.keys(videoTombstonesRef.current)
      ]);
      const filteredVideos = nextVideos.filter(v => {
        if (deletedIds.has(v.id)) {
          changed = true;
          addEvent({
            id: `evt-sync-del-${Date.now()}-${v.id}`,
            source: 'system',
            type: 'info',
            message: `Sync: Removed pipeline card for "${v.title}" (deleted topic).`,
            timestamp: new Date().toISOString()
          });
          return false;
        }
        return true;
      });

      const videoMap = new Map(filteredVideos.map(v => [v.id, v]));

      topics.forEach(t => {
        if (videoTombstonesRef.current[t.id]) return;
        const v = videoMap.get(t.id);
        
        // Map Topic status to Video pipelineStage
        let stage: 'Topic' | 'Hook' | 'Script' | 'Shoot' | 'Edit' | 'Thumbnail' | 'Schedule' | 'Published' = 'Topic';
        if (t.status === 'hooked') stage = 'Hook';
        else if (t.status === 'scripted') stage = 'Script';
        else if (t.status === 'shot') stage = 'Shoot';
        else if (t.status === 'edited') stage = 'Edit';
        else if (t.status === 'scheduled') stage = 'Schedule';
        else if (t.status === 'posted') stage = 'Published';
        // Topic just started hooking — surface it in the Hook column even before it's marked hooked
        if (t.status === 'topic' && t.workflowStatuses?.hook === 'in-progress') stage = 'Hook';

        if (!v) {
          // Create new VideoRecord
          const newVideo: VideoRecord = {
            id: t.id,
            channelName: t.channel,
            title: t.name,
            format: t.format || 'Long',
            contentType: t.format === 'Short' ? 'News decode' : 'Deep explainer',
            topic: t.category || 'General',
            dueDate: t.dueDate || undefined,
            pipelineStage: stage,
            hookStatus: t.status === 'topic'
              ? (t.workflowStatuses?.hook === 'in-progress' ? 'in-progress' : 'pending')
              : 'completed',
            scriptStatus: (t.status === 'topic' || t.status === 'hooked') ? 'pending' : 'completed',
            shootStatus: (t.status === 'shot' || t.status === 'edited' || t.status === 'scheduled' || t.status === 'posted') ? 'completed' : 'pending',
            editStatus: (t.status === 'edited' || t.status === 'scheduled' || t.status === 'posted') ? 'completed' : 'pending',
            thumbnailStatus: t.format === 'Short' ? 'not-applicable' : ((t.status === 'scheduled' || t.status === 'posted') ? 'completed' : 'pending'),
            scheduleStatus: (t.status === 'scheduled' || t.status === 'posted') ? 'completed' : 'pending',
            publishedStatus: t.status === 'posted' ? 'completed' : 'pending',
            productionEffortHours: 2,
            blockedReason: t.blockedReason,
            tags: {
              topicType: '',
              hookType: '',
              contentStructure: '',
              productionStyle: '',
              audienceIntent: '',
              difficulty: '',
              evergreenPotential: 'Medium',
              revenuePotential: 'Medium',
              subscriberPotential: 'Medium',
              repeatability: 'Medium'
            }
          };
          filteredVideos.push(newVideo);
          changed = true;
          addEvent({
            id: `evt-sync-new-${Date.now()}-${t.id}`,
            source: 'system',
            type: 'success',
            message: `Sync: Created pipeline card for topic "${t.name}" in stage "${stage}".`,
            timestamp: new Date().toISOString()
          });
        } else {
          // Sync existing fields if changed
          if (
            v.title !== t.name || 
            v.channelName !== t.channel || 
            v.format !== (t.format || 'Long') || 
            v.pipelineStage !== stage ||
            v.dueDate !== (t.dueDate || undefined) ||
            v.blockedReason !== t.blockedReason
          ) {
            const oldStage = v.pipelineStage;
            v.title = t.name;
            v.channelName = t.channel;
            v.format = t.format || 'Long';
            v.pipelineStage = stage;
            v.dueDate = t.dueDate || undefined;
            v.blockedReason = t.blockedReason;
            changed = true;
            addEvent({
              id: `evt-sync-up-${Date.now()}-${t.id}`,
              source: 'system',
              type: 'info',
              message: `Sync: Updated pipeline card "${t.name}" (Stage: ${oldStage} -> ${stage}).`,
              timestamp: new Date().toISOString()
            });
          }
        }
      });

      return changed ? filteredVideos : prevVideos;
    });
  }, [topics]);

  useEffect(() => {
    // 2. Synchronize videos back into topics
    setTopicsState(prevTopics => {
      let changed = false;
      const nextTopics = [...prevTopics];
      const topicMap = new Map(nextTopics.map(t => [t.id, t]));

      videos.forEach(v => {
        if (videoTombstonesRef.current[v.id]) return;
        const t = topicMap.get(v.id);

        // Map Video pipelineStage to Topic status
        let status: 'topic' | 'hooked' | 'scripted' | 'shot' | 'edited' | 'scheduled' | 'posted' = 'topic';
        if (v.pipelineStage === 'Hook') status = 'hooked';
        else if (v.pipelineStage === 'Script') status = 'scripted';
        else if (v.pipelineStage === 'Shoot') status = 'shot';
        else if (v.pipelineStage === 'Edit' || v.pipelineStage === 'Thumbnail') status = 'edited';
        else if (v.pipelineStage === 'Schedule') status = 'scheduled';
        else if (v.pipelineStage === 'Published') status = 'posted';
        const workflowStatuses = workflowStatusesForTopicStatus(status);
        const inProgress = isWorkflowInProgressStatus(status);

        if (!t) {
          // Create new Topic if created from Pipeline Kanban
          const newTopic: Topic = {
            id: v.id,
            name: v.title,
            description: v.notes || '',
            channel: v.channelName,
            status: status,
            priority: 3,
            dueDate: v.dueDate || v.uploadDate || null,
            createdDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            format: v.format,
            blockedReason: v.blockedReason,
            inProgress,
            workflowStatuses,
            postedAt: status === 'posted' ? v.uploadDate || new Date().toISOString() : undefined
          };
          nextTopics.push(newTopic);
          changed = true;
          addEvent({
            id: `evt-sync-newt-${Date.now()}-${v.id}`,
            source: 'system',
            type: 'success',
            message: `Sync: Created workflow topic "${v.title}" from Kanban card (Status: ${status}).`,
            timestamp: new Date().toISOString()
          });
        } else {
          // Update status if changed from Kanban drag-and-drop
          if (t.status !== status || t.name !== v.title || t.channel !== v.channelName || t.format !== v.format || t.blockedReason !== v.blockedReason) {
            const oldStatus = t.status;
            t.status = status;
            t.name = v.title;
            t.channel = v.channelName;
            t.format = v.format;
            t.blockedReason = v.blockedReason;
            t.lastUpdated = new Date().toISOString();
            t.inProgress = inProgress;
            t.workflowStatuses = workflowStatuses;
            if (status === 'posted') {
              t.postedAt = t.postedAt || v.uploadDate || new Date().toISOString();
            } else {
              delete t.postedAt;
            }
            changed = true;
            addEvent({
              id: `evt-sync-upt-${Date.now()}-${v.id}`,
              source: 'system',
              type: 'info',
              message: `Sync: Updated workflow topic "${v.title}" from Kanban card (Status: ${oldStatus} -> ${status}).`,
              timestamp: new Date().toISOString()
            });
          }
        }
      });

      return changed ? nextTopics : prevTopics;
    });
  }, [videos]);

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [timeStr, setTimeStr] = useState('');
  const [lastDbUpdateTime, setLastDbUpdateTime] = useState<Date>(new Date(Date.now() - 5000));
  
  const addEvent = (evt: SystemEvent) => {
    setEvents(prev => [evt, ...prev].slice(0, 200));
    setLastDbUpdateTime(new Date());
  };

  const navigateToActivity = (activity: TopicActivity) => {
    const topic = topics.find(item => item.id === activity.topicId || item.name === activity.topicName);
    const video = videos.find(item => item.id === activity.topicId || item.title === activity.topicName);
    const targetSubView = activity.targetSubView || (topic ? 'topics' : 'videos');
    const targetId = targetSubView === 'topics'
      ? `topic-control-${activity.topicId || topic?.id || ''}`
      : `pipeline-video-${activity.topicId || video?.id || ''}`;

    setActiveTab(activity.targetTab || 'pipeline');
    setPipelineSubView(targetSubView);
    window.setTimeout(() => {
      const element = document.getElementById(targetId);
      if (!element) return;
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.animate([
        { boxShadow: '0 0 0 1px rgba(56,189,248,.25), 0 0 0 rgba(56,189,248,0)' },
        { boxShadow: '0 0 0 2px rgba(56,189,248,.9), 0 0 28px rgba(56,189,248,.35)' },
        { boxShadow: '0 0 0 1px rgba(56,189,248,.15), 0 0 0 rgba(56,189,248,0)' }
      ], { duration: 1600, easing: 'ease-out' });
    }, 250);
  };
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [logsSubView, setLogsSubView] = useState<'content' | 'backlog' | 'tables'>('content');

  // Supabase Auth and Real-time Gateway States
  const [user, setUser] = useState<any>(null);
  const channelRef = useRef<any>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const suppressNextSaveRef = useRef(false);
  const lastRemoteUpdatedAtRef = useRef(0);
  // Timestamp (ms) of the most recent local workday-session end. Lets merges
  // reject a stale remote "running" session so a stopped timer stays stopped.
  const lastWorkdayEndAtRef = useRef(0);
  const lastRemoteVersionRef = useRef(0);
  const reconciliationInFlightRef = useRef(false);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // syncError alone is just a banner message and must never block saving -
  // a one-time transient error (a momentary network blip during initial
  // load, for example) used to set syncError and then permanently block
  // every future save for the rest of the session with no automatic
  // recovery, silently discarding everything the user added afterward.
  // syncFatal is reserved for genuinely unrecoverable states (the
  // dashboard_state table not existing) where retrying truly cannot help.
  const [syncFatal, setSyncFatal] = useState(false);

  // Database Reset States
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPhase, setResetPhase] = useState<'password' | 'confirm' | 'deleting' | 'complete'>('password');
  const [resetProgress, setResetProgress] = useState(0);
  const [resetLogs, setResetLogs] = useState<string[]>([]);
  const [isShaking, setIsShaking] = useState(false);

  const formatRelativeTime = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const handleStartDetonation = () => {
    setResetPhase('deleting');
    setResetProgress(0);
    setResetLogs([]);

    const logMessages = [
      '[CONNECT] Connecting to Supabase Action Hub database cluster... OK',
      '[RESOLVE] Acquiring lock indices on catalog tables... OK',
      '[SELECT] Scanning for user-inputted custom backlogs... Found matches',
      '[DELETE] executing DELETE FROM topics WHERE id LIKE \'t-manual-%\'; [30%]',
      '[WIPE] Dropping temporary user table partition sector 0x93FA2... OK',
      '[DELETE] executing DELETE FROM activities WHERE id LIKE \'act-manual-%\'; [60%]',
      '[WIPE] Partition 0x93FA3 purged successfully.',
      '[FLUSH] Clearing Redis watch duration cache store...',
      '[FLUSH] Invalidating edge router cdn static cached nodes...',
      '[REBOOT] Restarting Desk Server instances... OK',
      '[SUCCESS] Reset complete. Connection closed.'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < logMessages.length) {
        const nextLog = logMessages[currentStep];
        setResetLogs(prev => [...prev, nextLog]);
        
        const percent = Math.min(100, Math.round(((currentStep + 1) / logMessages.length) * 100));
        setResetProgress(percent);

        // Clear states dynamically at specific progress milestones
        if (percent >= 30 && percent < 60) {
          setTopics([]);
          // Every one of these must be cleared locally in lockstep with the
          // Supabase upsert below — leaving any of them untouched here means
          // the live browser state still shows old values until a reload,
          // and worse, the very next debounced autosave (fired by the
          // setTopics([]) change above) would re-upload that stale value
          // and silently undo the reset that was just written to Supabase.
          setScorecard(normalizeScorecard(null));
          setVideos([]);
          setExperiments([]);
          setInsights([]);
          localStorage.setItem('unicorn_database_reset', 'true');
          
          // Purge recovery backups
          if (user) {
            localStorage.removeItem(`unicorn_dashboard_recovery_${user.id}`);
            localStorage.removeItem(`unicorn_dashboard_recovery_history_${user.id}`);
          }
          
          // Clear Supabase DB partition immediately
          if (supabase && user) {
            supabase.from('dashboard_state').upsert({
              user_id: user.id,
              state: {
                topics: [],
                activities: [],
                cycleGoals: null,
                workdaySession: null,
                sessions: [],
                scorecard: normalizeScorecard(null),
                videos: [],
                experiments: [],
                insights: [],
                aiPresets: [],
                aiUsage: createEmptyAiUsageStats()
              },
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' }).then(({ error }: any) => {
              if (error) console.error("Supabase reset error:", error.message);
            });
          }

          // Purge all biometrics and scorecard keys from local storage
          localStorage.removeItem('unicorn_scorecard_date');
          localStorage.removeItem('unicorn_scorecard_restfulness');
          localStorage.removeItem('unicorn_scorecard_nutrition');
          localStorage.removeItem('unicorn_scorecard_hydration');
          localStorage.removeItem('unicorn_scorecard_physicalActivity');
          localStorage.removeItem('unicorn_scorecard_endorphins');
          localStorage.removeItem('unicorn_scorecard_schedule');
          localStorage.removeItem('unicorn_scorecard_pleasantness');
          localStorage.removeItem('unicorn_scorecard_socialization');
          localStorage.removeItem('unicorn_scorecard_stomach');
          localStorage.removeItem('unicorn_scorecard_technicalities');
          localStorage.removeItem('unicorn_scorecard_relations');
          localStorage.removeItem('unicorn_scorecard_stress');
          localStorage.removeItem('unicorn_scorecard_history');
          localStorage.removeItem('unicorn_scorecard_db_logs');
          // Real user content (draft video scripts keyed by topic id) — once
          // topics are gone these would otherwise sit around unreachable
          // but never actually wiped, same integrity gap as everything else here.
          localStorage.removeItem('unicorn_video_scripts');
          // Cached Well-Being insight text generated from the (now-cleared)
          // biometric parameters — gated by date+completeness so it's inert
          // most of the time, but stays a stale leftover of prior input
          // until explicitly purged here.
          localStorage.removeItem('unicorn_wellbeing_last_insight_v2');
        } else if (percent >= 60 && percent < 85) {
          setActivities([]);
          setAiPresets([]);
          setAiUsage(createEmptyAiUsageStats());
          setCycleGoals(null);
          setWorkdaySession(null);
          setSessions([]);
          setEvents([]);
          localStorage.removeItem('unicorn_events');
        }

        currentStep++;
      } else {
        clearInterval(interval);
        setResetPhase('complete');
        
        setTimeout(() => {
          setEvents(prev => [{
            id: `evt-reset-${Date.now()}`,
            source: 'supabase',
            type: 'success',
            message: 'System Override: User-inputted backlog content successfully purged from database partition.',
            timestamp: new Date().toISOString()
          }, ...prev]);
          setIsResetOpen(false);
        }, 1500);
      }
    }, 400);
  };

  // Keyboard shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingField = Boolean(
        target &&
        (target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.tagName === 'SELECT' ||
         target.isContentEditable)
      );

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && pendingDeleteGroupsRef.current.length > 0) {
        e.preventDefault();
        undoLastDelete();
        return;
      }

      if (isTypingField || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setActiveTab('topics');
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setPipelineSubView('topics');
        setActiveTab('pipeline');
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setTopicFormTopic(null);
        setIsAddFormOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync active tab to localStorage for reload memory
  useEffect(() => {
    localStorage.setItem('unicorn_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'pipeline') {
      setPipelineSubView('topics');
    }
  }, [activeTab]);

  useEffect(() => {
    const previousUserId = previousTopicSortUserIdRef.current;
    if (!user?.id) {
      if (previousUserId) {
        localStorage.removeItem(`unicorn_topic_sort_order_${previousUserId}`);
      }
      previousTopicSortUserIdRef.current = null;
      return;
    }

    previousTopicSortUserIdRef.current = user.id;
    const storedSort = localStorage.getItem(`unicorn_topic_sort_order_${user.id}`);
    if (storedSort === 'due-date' || storedSort === 'last-created' || storedSort === 'level' || storedSort === 'progress-most' || storedSort === 'progress-least' || storedSort === 'workload') {
      setTopicSortOrder(storedSort as TopicSortMode);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(`unicorn_topic_sort_order_${user.id}`, topicSortOrder);
  }, [topicSortOrder, user?.id]);

  // 1. Listen for Supabase auth state change on mount
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      setIsStateLoaded(true);
      return;
    }
    
    let unsubscribeFn: (() => void) | null = null;
    
    const initAuth = async () => {
      try {
        // 1. Get current active session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          setAuthLoading(false);
        } else {
          setAuthLoading(false);
        }

        // 3. Listen for auth changes
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
          setAuthLoading(false);
        });

        if (data && data.subscription) {
          unsubscribeFn = () => data.subscription.unsubscribe();
        }
      } catch (err: any) {
        console.error("Supabase Auto-Auth listener crash:", err);
        setAuthLoading(false);
        setIsStateLoaded(true);
      }
    };

    initAuth();

    return () => {
      if (unsubscribeFn) {
        try {
          unsubscribeFn();
        } catch (e) {
          console.error("Failed to unsubscribe auth listener:", e);
        }
      }
    };
  }, []);

  // 2. Fetch dashboard state from Supabase when user logs in
  useEffect(() => {
    if (!supabase || !user) {
      setHydratedUserId(null);
      if (!user) {
        setIsStateLoaded(true);
      }
      return;
    }

    let cancelled = false;
    const userId = user.id;
    setHydratedUserId(null);
    // Never render an unhydrated empty dashboard during sign-in or account
    // changes. The loading overlay remains until one coherent snapshot exists.
    setIsStateLoaded(false);

    const fetchAndSubscribe = async () => {
      try {
        setSyncError(null);
        const { data, error } = await supabase
          .from('dashboard_state')
          .select('state, version, updated_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching state from Supabase:", error.message);
          if (error.message.includes('relation "public.dashboard_state" does not exist') || error.code === 'P0001') {
            setSyncError("Supabase error: Table 'public.dashboard_state' does not exist. Please run SQL migrations in your Supabase dashboard.");
            setSyncFatal(true);
          } else {
            // Transient (network blip, temporary outage, etc.) - show the
            // banner but let subsequent save attempts still go through; the
            // debounced save effect will naturally retry on the next change.
            setSyncError(`Supabase connection error: ${error.message}`);
          }
          setIsStateLoaded(true); // Let client render local fallback
          return;
        }

        if (data && data.state) {
          const backupKey = `unicorn_dashboard_recovery_${userId}`;
          let recoveryBackup: { updatedAt: string; sessionId: string; state: any } | null = null;
          try {
            recoveryBackup = JSON.parse(localStorage.getItem(backupKey) || 'null');
          } catch { /* Ignore */ }
          
          const remoteUpdatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
          lastRemoteUpdatedAtRef.current = remoteUpdatedAt;
          lastRemoteVersionRef.current = data.version || 0;
          const remoteState = data.state as any;
          const remoteTopics = visibleCreatorTopics((remoteState.topics || []) as Topic[]);
          const backupTopics = visibleCreatorTopics((recoveryBackup?.state?.topics || []) as Topic[]);
          const remoteTombstones = normalizeCommittedTombstones(remoteTopics, remoteState.deletedTopicIds || {});
          const backupTombstones = normalizeCommittedTombstones(backupTopics, recoveryBackup?.state?.deletedTopicIds || {});
          const combinedTombstones = { ...remoteTombstones, ...backupTombstones };
          const remoteVideoTombstones = (remoteState.deletedVideoIds || {}) as Record<string, string>;
          const backupVideoTombstones = (recoveryBackup?.state?.deletedVideoIds || {}) as Record<string, string>;
          videoTombstonesRef.current = { ...remoteVideoTombstones, ...backupVideoTombstones };
          const hydratedTopics = mergeTopicsByNewest(remoteTopics, backupTopics, combinedTombstones);
          topicTombstonesRef.current = combinedTombstones;
          const cloudNeedsRepair = !topicCollectionsEqual(hydratedTopics, remoteTopics);
          isRemoteSyncRef.current = !cloudNeedsRepair;
          suppressNextSaveRef.current = true;
          dirtyTopicIdsRef.current = cloudNeedsRepair
            ? new Set(hydratedTopics.filter(topic => !remoteTopics.some(remote => remote.id === topic.id)).map(topic => topic.id))
            : new Set();

          if (remoteState.topics) {
            setTopicsState(hydratedTopics);
            localStorage.removeItem(`unicorn_infotainment_demo_seed_v1_${userId}`);
          }
          if (remoteState.activities) setActivities(remoteState.activities);
          if (remoteState.cycleGoals) setCycleGoals(remoteState.cycleGoals);
          if (remoteState.topicSortOrder) setTopicSortOrder(remoteState.topicSortOrder as TopicSortMode);
          if ('workdaySession' in remoteState) {
            setWorkdaySession(localSession => mergeWorkdaySessionByNewest(remoteState.workdaySession || null, localSession, remoteUpdatedAt, lastWorkdayEndAtRef.current));
          }
          if ('sessions' in remoteState) {
            setSessions(localSessions => mergeSessionRecordsByNewest((remoteState.sessions || []) as SessionRecord[], localSessions, remoteUpdatedAt));
          }
          if (remoteState.scorecard) setScorecard(normalizeScorecard(remoteState.scorecard));
          if (remoteState.videos) setVideos((remoteState.videos as VideoRecord[]).filter(video => !videoTombstonesRef.current[video.id]));
          if (remoteState.experiments) setExperiments(remoteState.experiments);
          if (remoteState.insights) setInsights(remoteState.insights);

          // A preset saved right before a reload can lose its race with the
          // debounced Supabase write (the network call gets aborted mid-flight
          // by the reload). Union it back in from the same-device recovery
          // backup so it isn't silently lost, the same safety net topics
          // already have.
          const remotePresets = (remoteState.aiPresets || []) as AiRulePreset[];
          const backupPresets = (recoveryBackup?.state?.aiPresets || []) as AiRulePreset[];
          if (remoteState.aiPresets || backupPresets.length > 0) {
            const mergedPresets = new Map<string, AiRulePreset>();
            [...backupPresets, ...remotePresets].forEach(preset => {
              const existing = mergedPresets.get(preset.id);
              if (!existing || new Date(preset.createdAt).getTime() >= new Date(existing.createdAt).getTime()) mergedPresets.set(preset.id, preset);
            });
            setAiPresets(Array.from(mergedPresets.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
          }
          if (remoteState.aiUsage) setAiUsage(remoteState.aiUsage);

          addEvent({
            id: `evt-supabase-loaded-${Date.now()}`,
            source: 'supabase',
            type: 'info',
            message: 'Supabase Cloud: Device state synchronized with database cluster.',
            timestamp: new Date().toISOString()
          });
        } else {
          // If no remote state exists yet for this auto-created user, write initial state to seed it
          console.log("Supabase Sync: Seeding new database row for creator...");
          await supabase.from('dashboard_state').upsert({
            user_id: user.id,
            state: {
              topics,
              activities,
              cycleGoals,
              workdaySession,
              sessions,
              scorecard,
              videos,
              experiments,
              insights,
              aiPresets,
              aiUsage,
              topicSortOrder,
              deletedVideoIds: videoTombstonesRef.current
            },
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        }
        
        setHydratedUserId(userId);
        setIsStateLoaded(true); // Completed initial load

        // Bail out if this effect was cleaned up while the above awaits were
        // in flight (e.g. a token-refresh auth event fired again) - creating
        // a channel after cancellation is what caused stale, duplicate
        // subscriptions on the same channel name.
        if (cancelled) return;

        // 3. Subscribe to Real-time database changes for this user.
        // Defensively remove any channel already registered under this exact
        // name first: Supabase's client deduplicates by topic name, so
        // calling .channel() again for a name that's still subscribed
        // returns the SAME already-subscribed instance, and attaching a new
        // .on() listener to an already-subscribed channel throws
        // "cannot add postgres_changes callbacks ... after subscribe()".
        const channelName = `realtime:dashboard_state:${userId}`;
        const existing = supabase.getChannels?.().find((c: any) => c.topic === channelName || c.topic === `realtime:${channelName}`);
        if (existing) {
          try { supabase.removeChannel(existing); } catch { /* ignore */ }
        }

        const newChannel = supabase.channel(channelName)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'dashboard_state', filter: `user_id=eq.${userId}` },
            (payload: any) => {
              const newState = payload.new as any;
              if (newState && newState.state) {
                const remoteState = newState.state as any;
                const remoteVersion = newState.version || 0;
                if (remoteVersion && remoteVersion <= lastRemoteVersionRef.current) return;
                lastRemoteVersionRef.current = Math.max(lastRemoteVersionRef.current, remoteVersion);
                lastRemoteUpdatedAtRef.current = newState.updated_at ? new Date(newState.updated_at).getTime() : Date.now();
                const remoteTopics = visibleCreatorTopics((remoteState.topics || []) as Topic[]);
                const remoteTombstones = normalizeCommittedTombstones(remoteTopics, remoteState.deletedTopicIds || {});
                const remoteVideoTombstones = (remoteState.deletedVideoIds || {}) as Record<string, string>;
                const combinedTombstones = { ...remoteTombstones, ...topicTombstonesRef.current };
                videoTombstonesRef.current = { ...remoteVideoTombstones, ...videoTombstonesRef.current };
                remoteTopics.forEach(topic => {
                  if (!dirtyTopicIdsRef.current.has(topic.id)) delete combinedTombstones[topic.id];
                });
                topicTombstonesRef.current = combinedTombstones;
                isRemoteSyncRef.current = dirtyTopicIdsRef.current.size === 0;
                
                if (remoteState.topics) {
                  setTopicsState(localTopics => {
                    const mergedTopics = mergeRemoteWithPendingTopics(
                      remoteTopics, localTopics, dirtyTopicIdsRef.current, topicTombstonesRef.current
                    );
                    if (!topicCollectionsEqual(mergedTopics, remoteTopics)) isRemoteSyncRef.current = false;
                    return mergedTopics;
                  });
                }
                if (remoteState.activities) setActivities(remoteState.activities);
                if (remoteState.cycleGoals) setCycleGoals(remoteState.cycleGoals);
                if (remoteState.topicSortOrder) setTopicSortOrder(remoteState.topicSortOrder as TopicSortMode);
                if ('workdaySession' in remoteState) {
                  setWorkdaySession(localSession => mergeWorkdaySessionByNewest(remoteState.workdaySession || null, localSession, lastRemoteUpdatedAtRef.current, lastWorkdayEndAtRef.current));
                }
                if ('sessions' in remoteState) {
                  setSessions(localSessions => mergeSessionRecordsByNewest((remoteState.sessions || []) as SessionRecord[], localSessions, lastRemoteUpdatedAtRef.current));
                }
                if (remoteState.scorecard) setScorecard(normalizeScorecard(remoteState.scorecard));
                if (remoteState.videos) setVideos((remoteState.videos as VideoRecord[]).filter(video => !videoTombstonesRef.current[video.id]));
                if (remoteState.experiments) setExperiments(remoteState.experiments);
                if (remoteState.insights) setInsights(remoteState.insights);
                if (remoteState.aiPresets) setAiPresets(remoteState.aiPresets);
                if (remoteState.aiUsage) setAiUsage(remoteState.aiUsage);
                if ('taskTimers' in remoteState) {
                  setTaskTimers(localTimers => mergeTaskTimersByNewest((remoteState.taskTimers || []) as TaskTimerRecord[], localTimers, lastRemoteUpdatedAtRef.current));
                }
                suppressNextSaveRef.current = true;

                addEvent({
                  id: `evt-supabase-sync-realtime-${Date.now()}`,
                  source: 'supabase',
                  type: 'success',
                  message: 'Supabase Sync: Real-time update synced from remote device.',
                  timestamp: new Date().toISOString()
                });
              }
            }
          )
          .subscribe();

        channelRef.current = newChannel;
      } catch (e: any) {
        console.error("Supabase sync initialization failed:", e);
        setSyncError(`Sync engine failure: ${e.message}`);
        setIsStateLoaded(true);
      }
    };

    fetchAndSubscribe();

    return () => {
      cancelled = true;
      if (supabase && channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
        } catch (e) {
          console.error("Failed to remove channel:", e);
        } finally {
          channelRef.current = null;
        }
      }
    };
  }, [user?.id]);

  const saveConflictSafeState = async (
    newTopics: Topic[], newActs: TopicActivity[], newGoals: CycleGoal | null,
    newWorkdaySession: WorkdaySession | null, newSessions: SessionRecord[],
    newScorecard: any, newVideos: VideoRecord[], newExperiments: Experiment[], newInsights: CreatorInsight[],
    newPresets: AiRulePreset[], newUsage: AiUsageStats, newTaskTimers: TaskTimerRecord[]
  ) => {
    const savingTopicEpoch = topicMutationEpochRef.current;
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: current, error: readError } = await supabase.from('dashboard_state')
        .select('state, version, updated_at').eq('user_id', user.id).maybeSingle();
      if (readError) throw readError;
      const remoteState = (current?.state || {}) as any;
      const remoteTopics = visibleCreatorTopics((remoteState.topics || []) as Topic[]);
      const remoteTombstones = normalizeCommittedTombstones(remoteTopics, remoteState.deletedTopicIds || {});
      const deletedTopicIds: Record<string, string> = { ...remoteTombstones, ...topicTombstonesRef.current };
      const remoteVideoTombstones = (remoteState.deletedVideoIds || {}) as Record<string, string>;
      const deletedVideoIds: Record<string, string> = { ...remoteVideoTombstones, ...videoTombstonesRef.current };
      topicTombstonesRef.current = deletedTopicIds;
      videoTombstonesRef.current = deletedVideoIds;
      const remoteStateRevisionMs = current?.updated_at ? new Date(current.updated_at).getTime() : 0;
      const remoteSessions = (remoteState.sessions || []) as SessionRecord[];
      const remoteTaskTimers = (remoteState.taskTimers || []) as TaskTimerRecord[];
      const remoteWorkdaySession = ('workdaySession' in remoteState ? remoteState.workdaySession || null : null) as WorkdaySession | null;
      const localWorkdayEndRevisionMs = newWorkdaySession ? 0 : Math.max(lastWorkdayEndAtRef.current, newSessions.reduce((max, session) => Math.max(max, sessionRecordRevisionMs(session)), 0));

      const mergedTopics = mergeTopicsByNewest(remoteTopics, newTopics, deletedTopicIds);
      const mergedActivities = new Map<string, TopicActivity>();
      [...((remoteState.activities || []) as TopicActivity[]), ...newActs].forEach(activity => {
        const existing = mergedActivities.get(activity.id);
        if (!existing || new Date(activity.timestamp).getTime() >= new Date(existing.timestamp).getTime()) mergedActivities.set(activity.id, activity);
      });
      const mergedSessions = mergeSessionRecordsByNewest(remoteSessions, newSessions, remoteStateRevisionMs);
      const mergedTaskTimers = mergeTaskTimersByNewest(remoteTaskTimers, newTaskTimers, remoteStateRevisionMs);
      const mergedWorkdaySession = mergeWorkdaySessionByNewest(remoteWorkdaySession, newWorkdaySession, remoteStateRevisionMs, localWorkdayEndRevisionMs);
      const nextState = {
        ...remoteState, topics: mergedTopics, deletedTopicIds,
        activities: Array.from(mergedActivities.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        cycleGoals: newGoals, workdaySession: mergedWorkdaySession, sessions: mergedSessions, scorecard: newScorecard, videos: newVideos,
        experiments: newExperiments, insights: newInsights, aiPresets: newPresets, aiUsage: newUsage, taskTimers: mergedTaskTimers,
        topicSortOrder,
        deletedVideoIds
      };
      const nextVersion = (current?.version || 0) + 1;
      const updatedAt = new Date().toISOString();
      if (!current) {
        const { error } = await supabase.from('dashboard_state').insert({ user_id: user.id, state: nextState, version: nextVersion, updated_at: updatedAt });
        if (error?.code === '23505') continue;
        if (error) throw error;
        lastRemoteUpdatedAtRef.current = new Date(updatedAt).getTime();
        lastRemoteVersionRef.current = nextVersion;
        if (topicMutationEpochRef.current === savingTopicEpoch) {
          dirtyTopicIdsRef.current.clear();
          isRemoteSyncRef.current = true;
          suppressNextSaveRef.current = true;
          setTopicsState(mergedTopics);
        }
        return;
      }
      const { data: saved, error } = await supabase.from('dashboard_state')
        .update({ state: nextState, version: nextVersion, updated_at: updatedAt })
        .eq('user_id', user.id).eq('version', current.version).select('updated_at').maybeSingle();
      if (error) throw error;
      if (!saved) continue;
      lastRemoteUpdatedAtRef.current = new Date(saved.updated_at || updatedAt).getTime();
      lastRemoteVersionRef.current = nextVersion;
      if (topicMutationEpochRef.current === savingTopicEpoch) {
        dirtyTopicIdsRef.current.clear();
        isRemoteSyncRef.current = true;
        suppressNextSaveRef.current = true;
        setTopicsState(mergedTopics);
      }
      return;
    }
    throw new Error('Concurrent sync conflict could not be resolved after four attempts.');
  };

  // 4. Save local state changes back to Supabase
  const saveStateToSupabase = async (
    newTopics: Topic[],
    newActs: TopicActivity[],
    newGoals: CycleGoal | null,
    newWorkdaySession: WorkdaySession | null,
    newSessions: SessionRecord[],
    newScorecard: any,
    newVideos: VideoRecord[],
    newExperiments: Experiment[],
    newInsights: CreatorInsight[],
    newPresets: AiRulePreset[],
    newUsage: AiUsageStats,
    newTaskTimers: TaskTimerRecord[]
  ) => {
    // Only a genuinely unrecoverable state (missing schema) blocks saving.
    // A transient syncError banner must never permanently stop future saves -
    // that was the actual cause of topics silently never reaching the
    // database: one past transient failure disabled every save for the rest
    // of the session with no automatic recovery.
    if (!supabase || !user || syncFatal) return;
    try {
      await saveConflictSafeState(newTopics, newActs, newGoals, newWorkdaySession, newSessions, newScorecard, newVideos, newExperiments, newInsights, newPresets, newUsage, newTaskTimers);
      setSyncError(null);
      return;
      const { error } = await supabase
        .from('dashboard_state')
        .upsert({
          user_id: user.id,
          state: {
            topics: newTopics,
            activities: newActs,
            cycleGoals: newGoals,
            workdaySession: newWorkdaySession,
            scorecard: newScorecard,
            videos: newVideos,
            experiments: newExperiments,
            insights: newInsights
          },
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) {
        console.error("Error saving state to Supabase:", error.message);
        if (error.message.includes('relation "public.dashboard_state" does not exist')) {
          setSyncError("Supabase error: Table 'public.dashboard_state' does not exist. Please run SQL migrations.");
          setSyncFatal(true);
        } else {
          // Surface it, but let the next debounced save retry naturally.
          setSyncError(`Supabase save error: ${error.message}`);
        }
      } else {
        // A successful save proves the connection has recovered - clear any
        // stale error banner so the UI honestly reflects current state.
        setSyncError(null);
      }
    } catch (e: any) {
      console.error(e);
      setSyncError(`Supabase save error: ${e.message || 'unknown error'}`);
    }
  };

  // Write a synchronous browser recovery journal before the debounced cloud save.
  // A refresh can therefore never erase a topic created milliseconds earlier.
  useEffect(() => {
    if (!user || authLoading || !isStateLoaded || hydratedUserId !== user.id) return;
    const backupKey = `unicorn_dashboard_recovery_${user.id}`;
    const historyKey = `unicorn_dashboard_recovery_history_${user.id}`;
    let durableTopics = topics;
    let durableTombstones = { ...topicTombstonesRef.current };
    try {
      const previousBackup = JSON.parse(localStorage.getItem(backupKey) || 'null');
      const previousTopics = visibleCreatorTopics((previousBackup?.state?.topics || []) as Topic[]);
      const previousTombstones = normalizeCommittedTombstones(previousTopics, previousBackup?.state?.deletedTopicIds || {});
      durableTombstones = { ...previousTombstones, ...durableTombstones };
      durableTopics = mergeTopicsByNewest(previousTopics, topics, durableTombstones);
    } catch { /* A malformed old backup must not block the current snapshot. */ }

    const nextBackup = {
      updatedAt: new Date().toISOString(),
      sessionId: currentSessionId,
      state: { topics: durableTopics, deletedTopicIds: durableTombstones, deletedVideoIds: videoTombstonesRef.current, activities, cycleGoals, workdaySession, sessions, scorecard, videos, experiments, insights, aiPresets, aiUsage, topicSortOrder }
    };

    try {
      const previousBackup = JSON.parse(localStorage.getItem(backupKey) || 'null');
      if (previousBackup?.state?.topics?.length > 0) {
        const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
        const previousIds = previousBackup.state.topics.map((topic: Topic) => topic.id).sort().join('|');
        const nextIds = topics.map(topic => topic.id).sort().join('|');
        if (previousIds !== nextIds) {
          localStorage.setItem(historyKey, JSON.stringify([previousBackup, ...history].slice(0, 10)));
        }
      }
    } catch { /* A malformed old backup must not block the current snapshot. */ }

    localStorage.setItem(backupKey, JSON.stringify(nextBackup));
  }, [topics, activities, cycleGoals, workdaySession, sessions, scorecard, videos, experiments, insights, aiPresets, aiUsage, topicSortOrder, user, authLoading, isStateLoaded, hydratedUserId]);

  // Realtime is the fast path; versioned reconciliation is the reliability path.
  // It keeps devices converged even when postgres_changes delivery is delayed,
  // suspended in a background tab, or unavailable for this table publication.
  useEffect(() => {
    if (!supabase || !user || hydratedUserId !== user.id || syncFatal) return;

    const reconcile = async () => {
      if (reconciliationInFlightRef.current) return;
      reconciliationInFlightRef.current = true;
      try {
        const { data, error } = await supabase
          .from('dashboard_state')
          .select('state, version, updated_at')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error || !data?.state) return;

        const remoteUpdatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
        const remoteVersion = data.version || 0;
        if (remoteVersion && remoteVersion <= lastRemoteVersionRef.current) return;
        if (!remoteVersion && remoteUpdatedAt <= lastRemoteUpdatedAtRef.current) return;
        lastRemoteVersionRef.current = Math.max(lastRemoteVersionRef.current, remoteVersion);
        lastRemoteUpdatedAtRef.current = remoteUpdatedAt;
        const remoteState = data.state as any;
        const remoteTopics = visibleCreatorTopics((remoteState.topics || []) as Topic[]);
        const remoteTombstones = normalizeCommittedTombstones(remoteTopics, remoteState.deletedTopicIds || {});
        const combinedTombstones = { ...remoteTombstones, ...topicTombstonesRef.current };
        remoteTopics.forEach(topic => {
          if (!dirtyTopicIdsRef.current.has(topic.id)) delete combinedTombstones[topic.id];
        });
        topicTombstonesRef.current = combinedTombstones;
        isRemoteSyncRef.current = dirtyTopicIdsRef.current.size === 0;

        if (remoteState.topics) setTopicsState(localTopics => {
          const mergedTopics = mergeRemoteWithPendingTopics(
            remoteTopics, localTopics, dirtyTopicIdsRef.current, topicTombstonesRef.current
          );
          if (!topicCollectionsEqual(mergedTopics, remoteTopics)) isRemoteSyncRef.current = false;
          return mergedTopics;
        });
        if (remoteState.activities) setActivities(remoteState.activities);
        if (remoteState.cycleGoals) setCycleGoals(remoteState.cycleGoals);
        if ('workdaySession' in remoteState) {
          setWorkdaySession(localSession => mergeWorkdaySessionByNewest(remoteState.workdaySession || null, localSession, remoteUpdatedAt, lastWorkdayEndAtRef.current));
        }
        if ('sessions' in remoteState) {
          setSessions(localSessions => mergeSessionRecordsByNewest((remoteState.sessions || []) as SessionRecord[], localSessions, remoteUpdatedAt));
        }
        if (remoteState.scorecard) setScorecard(normalizeScorecard(remoteState.scorecard));
        if (remoteState.videos) setVideos((remoteState.videos as VideoRecord[]).filter(video => !videoTombstonesRef.current[video.id]));
        if (remoteState.experiments) setExperiments(remoteState.experiments);
        if (remoteState.insights) setInsights(remoteState.insights);
        if (remoteState.aiPresets) setAiPresets(remoteState.aiPresets);
        if (remoteState.aiUsage) setAiUsage(remoteState.aiUsage);
        if ('taskTimers' in remoteState) {
          setTaskTimers(localTimers => mergeTaskTimersByNewest((remoteState.taskTimers || []) as TaskTimerRecord[], localTimers, remoteUpdatedAt));
        }
      } finally {
        reconciliationInFlightRef.current = false;
      }
    };

    const interval = window.setInterval(reconcile, 2000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') reconcile(); };
    window.addEventListener('online', reconcile);
    document.addEventListener('visibilitychange', handleVisibility);
    reconcile();

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', reconcile);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, hydratedUserId, syncFatal]);

  useEffect(() => {
    if (!user || authLoading || !isStateLoaded || hydratedUserId !== user.id) return;

    if (suppressNextSaveRef.current) {
      suppressNextSaveRef.current = false;
      return;
    }

    // Short debounce batches a single interaction; the queue preserves write order.
    const timer = setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(() => saveStateToSupabase(topics, activities, cycleGoals, workdaySession, sessions, scorecard, videos, experiments, insights, aiPresets, aiUsage, taskTimers));
    }, 75);

    return () => clearTimeout(timer);
  }, [topics, activities, cycleGoals, workdaySession, sessions, scorecard, videos, experiments, insights, aiPresets, aiUsage, taskTimers, topicSortOrder, user, authLoading, isStateLoaded, hydratedUserId]);

  // ─── Task Timer Handlers ────────────────────────────────────────────────────
  const todayKey = () => new Date().toLocaleDateString('en-CA');

  // Start a new task timer. A previous task session is deferred so only one
  // inner timer can ever be eligible to resume.
  // `force` is used by the "resume the paused workday?" flow: the workday is
  // being resumed in the same user action, so the not-yet-committed 'paused'
  // status must not block the task from starting.
  const startTaskTimer = (topicId: string, stage: TaskTimerStage, opts?: { force?: boolean }) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    const stamp = new Date().toISOString();

    // Stage stopwatches run independently of any workday/session concept —
    // the workday gate was removed when the per-stage stopwatch model was
    // introduced. `opts.force` is kept for callers that still pass it.
    void opts;

    setTopics(prev => prev.map(item => {
      if (item.id !== topicId) return item;

      const completedStatusByStage: Record<TaskTimerStage, Topic['status']> = {
        hook: 'hooked', script: 'scripted', shoot: 'shot', edit: 'edited', schedule: 'scheduled', post: 'posted'
      };
      const stagesOrder: TaskTimerStage[] = ['hook', 'script', 'shoot', 'edit', 'schedule', 'post'];
      const targetIdx = stagesOrder.indexOf(stage);

      const updatedStatuses: Record<string, 'pending' | 'in-progress' | 'completed'> = { ...item.workflowStatuses };
      
      stagesOrder.forEach((stg, idx) => {
        if (idx < targetIdx) {
          updatedStatuses[stg] = 'completed';
        } else if (idx === targetIdx) {
          updatedStatuses[stg] = 'in-progress';
        } else {
          delete updatedStatuses[stg];
        }
      });

      let newStatus: Topic['status'] = 'topic';
      if (targetIdx > 0) {
        newStatus = completedStatusByStage[stagesOrder[targetIdx - 1]];
      }

      return {
        ...item,
        status: newStatus,
        inProgress: true,
        workflowStatuses: updatedStatuses,
        lastUpdated: new Date().toISOString()
      };
    }));

    setTaskTimers(prevRaw => {
      const end = new Date(stamp).getTime();
      // Starting/resuming a stage IS returning to real work — close any
      // side-work clock that was running during a pause first.
      const prev = closeOpenSideWork(prevRaw, end);
      const existing = prev.find(tt => (tt.status === 'running' || tt.status === 'paused') && tt.topicId === topicId && tt.stage === stage);
      if (existing?.status === 'running') return prev;
      // Auto-pause any other running task timer (different topic/stage) so it
      // can be resumed later — do NOT complete it. Paused timers stay paused.
      // This applies whether we're starting a fresh timer OR resuming a paused one.
      const settled = prev.map(tt => {
        if (tt.status !== 'running' || tt.id === existing?.id) return tt;
        // Close this timer's current sitting so its history stays honest.
        const closed = closeOpenSegment(tt, end);
        return {
          ...closed,
          status: 'paused' as const,
          accumulatedActiveMs: closed.accumulatedActiveMs + (tt.activeSince ? Math.max(0, end - new Date(tt.activeSince).getTime()) : 0),
          activeSince: null,
          pausedAt: stamp,
          breaksCount: tt.breaksCount + 1,
          pauseSource: 'manual' as const,
        };
      });
      if (existing?.status === 'paused') {
        return settled.map(tt => tt.id === existing.id ? openNewSegment({
          ...tt,
          status: 'running' as const,
          accumulatedPausedMs: tt.accumulatedPausedMs + (tt.pausedAt ? Math.max(0, end - new Date(tt.pausedAt).getTime()) : 0),
          activeSince: stamp,
          pausedAt: null,
          pauseSource: undefined
        }, stamp) : tt);
      }
      const baseTimer: TaskTimerRecord = {
        id: `tt-${Date.now()}-${topicId}-${stage}`,
        topicId, topicName: topic.name, stage,
        status: 'running',
        startedAt: stamp, activeSince: stamp, pausedAt: null,
        accumulatedActiveMs: 0, accumulatedPausedMs: 0, breaksCount: 0,
        workdaySessionId: workdaySession ? workdaySession.startedAt : stamp,
        dateKey: todayKey(),
      };
      // First sitting starts now, ends on the first pause/stop.
      const newTimer = openNewSegment(baseTimer, stamp);
      return [...settled, newTimer];
    });
    // Log activity
    setActivities(prev => [{
      id: `act-task-start-${Date.now()}`,
      topicName: topic.name, channel: topic.channel,
      action: `Started ${stage} session timer`,
      author: 'You', timestamp: stamp, topicId, targetTab: 'pipeline', targetSubView: 'topics'
    }, ...prev]);
  };

  // Ensure the running workday has a goal for this topic aimed at the clicked
  // stage. Clicking a stage while the timer is running IS the goal — each click
  // sets (or advances) the topic's single goal to that stage, so it flows into
  // the session's achieved/pending goal tally and shows the goal arrow.
  const addStageGoal = (topicId: string, stage: TaskTimerStage) => {
    const targetMap: Record<TaskTimerStage, NonNullable<WorkdaySession['goals']>[number]['targetStatus']> = {
      hook: 'hooked', script: 'scripted', shoot: 'shot', edit: 'edited', schedule: 'scheduled', post: 'posted'
    };
    const targetStatus = targetMap[stage];
    const stamp = new Date().toISOString();
    setWorkdaySession(current => {
      if (!current) return current;
      const goals = current.goals || [];
      const existing = goals.find(goal => goal.topicId === topicId);
      // Already aimed at this exact stage — nothing to do.
      if (existing && existing.targetStatus === targetStatus) return current;
      const nextGoals = existing
        ? goals.map(goal => goal.topicId === topicId ? { ...goal, targetStatus, addedAt: stamp } : goal)
        : [...goals, { id: `goal-${Date.now()}-${topicId}`, topicId, targetStatus, addedAt: stamp }];
      return { ...current, goals: nextGoals, updatedAt: stamp };
    });
  };

  // The Pipeline "resume the paused workday?" confirmation: resume the workday
  // clock (and any day-paused task timers) and immediately begin counting the
  // clicked stage as a task in this session.
  const resumeWorkdayAndStartTask = (topicId: string, stage: TaskTimerStage) => {
    handleMainTimerResume();
    startTaskTimer(topicId, stage, { force: true });
  };

  const pauseActiveTaskTimer = (pauseSourceOrProductivity?: 'manual' | 'day' | number, maybeProductivityScore?: number) => {
    const pauseSource = pauseSourceOrProductivity === 'day' || pauseSourceOrProductivity === 'manual'
      ? pauseSourceOrProductivity
      : 'manual';
    const productivityScore = typeof pauseSourceOrProductivity === 'number'
      ? pauseSourceOrProductivity
      : maybeProductivityScore;
    setTaskTimers(prev => prev.map(tt => {
      if (tt.status !== 'running') return tt;
      const stamp = new Date();
      const closed = closeOpenSegment(tt, stamp.getTime());
      return {
        ...closed,
        status: 'paused' as const,
        accumulatedActiveMs: closed.accumulatedActiveMs + (tt.activeSince ? Math.max(0, stamp.getTime() - new Date(tt.activeSince).getTime()) : 0),
        activeSince: null,
        pausedAt: stamp.toISOString(),
        breaksCount: tt.breaksCount + 1,
        pauseSource,
        productivityScore: productivityScore ?? tt.productivityScore,
      };
    }));
  };

  // Pause the running stage timer AND optionally open a side-work clock for
  // off-stage work done during the pause (see SideWorkEntry). When side work is
  // logged the pause is NOT counted as a break — the user isn't resting, they're
  // doing other tracked work — matching how "I paused, but not for a break" reads.
  const pauseActiveTaskTimerWithDetails = (
    productivityScore?: number,
    sideWork?: { description: string; linkedTo: 'topic' | 'session' }
  ) => {
    const description = sideWork?.description.trim();
    const logSideWork = Boolean(description);
    setTaskTimers(prev => prev.map(tt => {
      if (tt.status !== 'running') return tt;
      const stamp = new Date();
      const closed = closeOpenSegment(tt, stamp.getTime());
      const newEntry: SideWorkEntry | null = logSideWork
        ? {
            id: `sw-${Date.now()}-${tt.id}`,
            description: description!,
            linkedTo: sideWork!.linkedTo,
            startedAt: stamp.toISOString(),
            endedAt: null,
            accumulatedMs: 0
          }
        : null;
      return {
        ...closed,
        status: 'paused' as const,
        accumulatedActiveMs: closed.accumulatedActiveMs + (tt.activeSince ? Math.max(0, stamp.getTime() - new Date(tt.activeSince).getTime()) : 0),
        activeSince: null,
        pausedAt: stamp.toISOString(),
        breaksCount: logSideWork ? tt.breaksCount : tt.breaksCount + 1,
        pauseSource: 'manual' as const,
        productivityScore: productivityScore ?? tt.productivityScore,
        sideWork: newEntry ? [...(closed.sideWork || []), newEntry] : closed.sideWork,
      };
    }));
  };

  const resumeActiveTaskTimer = (pauseSource?: 'manual' | 'day') => {
    const resumeMs = Date.now();
    setTaskTimers(prev => closeOpenSideWork(prev, resumeMs).map(tt => {
      if (tt.status !== 'paused') return tt;
      if (pauseSource && tt.pauseSource !== pauseSource) return tt;
      const stamp = new Date();
      return openNewSegment({
        ...tt,
        status: 'running' as const,
        accumulatedPausedMs: tt.accumulatedPausedMs + (tt.pausedAt ? Math.max(0, stamp.getTime() - new Date(tt.pausedAt).getTime()) : 0),
        activeSince: stamp.toISOString(),
        pausedAt: null,
        pauseSource: undefined,
      }, stamp.toISOString());
    }));
  };

  const completeTaskTimerStage = (topicId: string, stage: TaskTimerStage) => {
    const stamp = new Date().toISOString();
    setTaskTimers(prev => closeOpenSideWork(prev, new Date(stamp).getTime()).map(tt => {
      if (tt.topicId !== topicId || tt.stage !== stage || (tt.status !== 'running' && tt.status !== 'paused')) return tt;
      const end = new Date(stamp).getTime();
      const closed = tt.status === 'running' ? closeOpenSegment(tt, end) : tt;
      return {
        ...closed,
        status: 'completed' as const,
        completedAt: stamp,
        accumulatedActiveMs: closed.accumulatedActiveMs + (tt.status === 'running' && tt.activeSince ? Math.max(0, end - new Date(tt.activeSince).getTime()) : 0),
        accumulatedPausedMs: closed.accumulatedPausedMs + (tt.status === 'paused' && tt.pausedAt ? Math.max(0, end - new Date(tt.pausedAt).getTime()) : 0),
        activeSince: null,
        pausedAt: null,
        endReason: 'done' as const
      };
    }));
  };

  // Add a manual chunk of time to a stage — a completed synthetic timer
  // that shows up in the stage totals just like a real live-tracked one.
  const addManualStageTime = (topicId: string, stage: TaskTimerStage, activeMs: number) => {
    if (!Number.isFinite(activeMs) || activeMs <= 0) return;
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    const nowIso = new Date().toISOString();
    const seg: SittingSegment = { id: `seg-manual-${Date.now()}`, startedAt: nowIso, endedAt: nowIso, activeMs };
    const newTimer: TaskTimerRecord = {
      id: `tt-manual-${Date.now()}-${topicId}-${stage}`,
      topicId, topicName: topic.name, stage,
      status: 'completed',
      startedAt: nowIso, completedAt: nowIso,
      activeSince: null, pausedAt: null,
      accumulatedActiveMs: activeMs,
      accumulatedPausedMs: 0,
      breaksCount: 0,
      endReason: 'done',
      dateKey: todayKey(),
      segments: [seg],
    };
    setTaskTimers(prev => [...prev, newTimer]);
    setActivities(prev => [{
      id: `act-manual-${Date.now()}`,
      topicName: topic.name, channel: topic.channel,
      action: `Manual time entry: ${Math.round(activeMs / 60000)} min on ${stage}`,
      author: 'You', timestamp: nowIso, topicId, targetTab: 'pipeline', targetSubView: 'topics'
    }, ...prev]);
  };

  const updateStageTimer = (timerId: string, patch: Partial<TaskTimerRecord>) => {
    setTaskTimers(prev => prev.map(tt => tt.id === timerId ? { ...tt, ...patch } : tt));
  };

  const deleteStageTimer = (timerId: string) => {
    setTaskTimers(prev => prev.filter(tt => tt.id !== timerId));
  };

  // Replace every timer for a topic+stage with a single manual entry sized to
  // `activeMs`. Used by the topic editor to overwrite the stored stage total.
  // Passing activeMs=0 wipes the stage's timers without adding a new one.
  const replaceStageTime = (topicId: string, stage: TaskTimerStage, activeMs: number) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    const nowIso = new Date().toISOString();
    const clean = Math.max(0, Math.floor(activeMs));
    setTaskTimers(prev => {
      // Zero-out any existing timers for this topic+stage instead of deleting
      // them. A pure delete lets the remote sync merge re-inject the old
      // records (they still exist in remoteTaskTimers with their original
      // revision) and the manual edit gets clobbered. By keeping the same id
      // and bumping completedAt to now, the local wins on
      // taskTimerRevisionMs — old copy is superseded server-side too.
      const zeroed = prev.map(tt => tt.topicId === topicId && tt.stage === stage
        ? {
            ...tt,
            status: 'completed' as const,
            completedAt: nowIso,
            activeSince: null,
            pausedAt: null,
            accumulatedActiveMs: 0,
            accumulatedPausedMs: 0,
            breaksCount: 0,
            segments: [],
            endReason: 'done' as const
          }
        : tt);
      if (clean === 0) return zeroed;
      const seg: SittingSegment = { id: `seg-manual-${Date.now()}`, startedAt: nowIso, endedAt: nowIso, activeMs: clean };
      const newTimer: TaskTimerRecord = {
        id: `tt-manual-${Date.now()}-${topicId}-${stage}`,
        topicId, topicName: topic.name, stage,
        status: 'completed',
        startedAt: nowIso, completedAt: nowIso,
        activeSince: null, pausedAt: null,
        accumulatedActiveMs: clean,
        accumulatedPausedMs: 0,
        breaksCount: 0,
        endReason: 'done',
        dateKey: todayKey(),
        segments: [seg],
      };
      return [...zeroed, newTimer];
    });
  };

  // Replace both the total time AND sittings count for a topic+stage in one
  // atomic write. The sittings count is stored as N synthetic segments, each
  // sized to totalMs / N, so downstream `sittings = segments.length` reads it
  // back correctly. Zeroes existing rows the same way replaceStageTime does
  // so a Supabase sync round-trip can't re-inject the old numbers.
  const setStageTotals = (topicId: string, stage: TaskTimerStage, totalMs: number, sittings: number) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    const nowIso = new Date().toISOString();
    const clean = Math.max(0, Math.floor(totalMs));
    const sittingCount = Math.max(1, Math.floor(sittings));
    setTaskTimers(prev => {
      // Void every prior timer for this topic+stage. breaksCount = -1 makes
      // the downstream sittings formula (`breaksCount + 1` for completed
      // timers without segments) evaluate to 0 for these rows so they stop
      // contributing to the sittings count — before this fix, N prior rows
      // each still counted as 1 sitting, so 3 zeroed rows + a synthetic "3"
      // rendered as 6 sittings instead of the 3 the user asked for.
      const zeroed = prev.map(tt => tt.topicId === topicId && tt.stage === stage
        ? {
            ...tt,
            status: 'completed' as const,
            completedAt: nowIso,
            activeSince: null,
            pausedAt: null,
            accumulatedActiveMs: 0,
            accumulatedPausedMs: 0,
            breaksCount: -1,
            segments: [],
            endReason: 'done' as const
          }
        : tt);
      if (clean === 0 && sittings <= 0) return zeroed;
      // Store only what we actually care about: the total time and the
      // sittings count. No per-segment breakdown — a manual edit is
      // authoritative and shouldn't lie about which minute belongs to
      // which sitting. Downstream sittings-display code falls back to
      // `breaksCount + 1` for completed timers with no segments, so
      // setting breaksCount = sittings - 1 makes the count render right.
      const newTimer: TaskTimerRecord = {
        id: `tt-manual-${Date.now()}-${topicId}-${stage}`,
        topicId, topicName: topic.name, stage,
        status: 'completed',
        startedAt: nowIso, completedAt: nowIso,
        activeSince: null, pausedAt: null,
        accumulatedActiveMs: clean,
        accumulatedPausedMs: 0,
        breaksCount: Math.max(0, sittingCount - 1),
        endReason: 'done',
        dateKey: todayKey(),
        segments: [],
      };
      return [...zeroed, newTimer];
    });
  };

  const stopActiveTaskTimer = (endReason: 'done' | 'deferred', productivityScore?: number) => {
    const stamp = new Date().toISOString();
    setTaskTimers(prev => closeOpenSideWork(prev, new Date(stamp).getTime()).map(tt => {
      if (tt.status !== 'running' && tt.status !== 'paused') return tt;
      const closed = tt.status === 'running' ? closeOpenSegment(tt, new Date(stamp).getTime()) : tt;
      const finalActive = closed.accumulatedActiveMs + (tt.status === 'running' && tt.activeSince ? Math.max(0, new Date(stamp).getTime() - new Date(tt.activeSince).getTime()) : 0);
      const finalPaused = closed.accumulatedPausedMs + (tt.status === 'paused' && tt.pausedAt ? Math.max(0, new Date(stamp).getTime() - new Date(tt.pausedAt).getTime()) : 0);
      return { ...closed, status: 'completed' as const, completedAt: stamp, activeSince: null, pausedAt: null, accumulatedActiveMs: finalActive, accumulatedPausedMs: finalPaused, endReason, productivityScore };
    }));
    // Log activity
    const active = taskTimers.find(tt => tt.status === 'running' || tt.status === 'paused');
    if (active) {
      const topic = topics.find(t => t.id === active.topicId);
      if (topic) {
        setActivities(prev => [{
          id: `act-task-stop-${Date.now()}`,
          topicName: topic.name, channel: topic.channel,
          action: `${endReason === 'done' ? 'Completed' : 'Deferred'} ${active.stage} session${productivityScore ? ` (${productivityScore * 10}% productive)` : ''}`,
          author: 'You', timestamp: stamp, topicId: topic.id, targetTab: 'pipeline', targetSubView: 'topics'
        }, ...prev]);
      }
    }
  };

  // When main timer is paused → also pause any running task timer
  const handleMainTimerPause = () => {
    // Pausing the whole day ends any side-work clock left running on an
    // already-paused stage timer (pauseActiveTaskTimer only touches running ones).
    setTaskTimers(prev => closeOpenSideWork(prev, Date.now()));
    pauseActiveTaskTimer('day');
    setWorkdaySession(current => {
      if (!current || current.status !== 'running' || !current.activeSince) return current;
      const stamp = new Date();
      return {
        ...current,
        accumulatedActiveMs: current.accumulatedActiveMs + Math.max(0, stamp.getTime() - new Date(current.activeSince).getTime()),
        activeSince: null, pausedAt: stamp.toISOString(), status: 'paused',
        updatedAt: stamp.toISOString(), breaksCount: (current.breaksCount || 0) + 1
      };
    });
  };

  // When main timer resumes → also resume any paused task timer
  const handleMainTimerResume = () => {
    resumeActiveTaskTimer('day');
    setWorkdaySession(current => {
      if (!current || current.status !== 'paused') return current;
      const stamp = new Date();
      return {
        ...current,
        accumulatedPausedMs: current.accumulatedPausedMs + (current.pausedAt ? Math.max(0, stamp.getTime() - new Date(current.pausedAt).getTime()) : 0),
        activeSince: stamp.toISOString(), pausedAt: null, status: 'running', updatedAt: stamp.toISOString()
      };
    });
  };

  // When main session ends → complete any running/paused task timers
  const endWorkdaySessionWithTaskTimers = (finalProductivityScore?: number) => {
    endWorkdaySession(finalProductivityScore);
  };

  // Derived: the single active task timer (running or paused, most recent)
  const activeTaskTimer = visibleTaskTimers
    .filter(tt => tt.status === 'running' || tt.status === 'paused')
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0] ?? null;

  // Update clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const weekday = now.toLocaleDateString([], { weekday: 'long' });
      const day = now.getDate();
      const suffix = (day % 10 === 1 && day !== 11) ? 'st'
        : (day % 10 === 2 && day !== 12) ? 'nd'
        : (day % 10 === 3 && day !== 13) ? 'rd'
        : 'th';
      const month = now.toLocaleDateString([], { month: 'long' });
      const year = now.getFullYear();
      const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTimeStr(`${weekday} ${day}${suffix} ${month} ${year} ${time}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);





  const handleUpdateRepo = (repoId: string, updatedRepo: Partial<GitHubRepo>) => {
    setRepos(prev => prev.map(r => r.id === repoId ? { ...r, ...updatedRepo } : r));
    setLastDbUpdateTime(new Date());
  };

  const handleUpdateProject = (projectId: string, updatedProject: Partial<VercelProject>) => {
    setVercelProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updatedProject } : p));
    setLastDbUpdateTime(new Date());
  };

  const handleUpdateSupabase = (updated: Partial<SupabaseProject>) => {
    setSupabaseProject(prev => ({ ...prev, ...updated }));
    setLastDbUpdateTime(new Date());
  };

  // Helper linking GitHub workflow completion to triggering Vercel build
  const triggerVercelDeploy = (projectName: string) => {
    const vercelProj = vercelProjects.find(p => p.name === projectName);
    if (!vercelProj) return;

    // Trigger vercel project deploy sequence
    const newDeploymentId = `vdep-auto-${Date.now()}`;
    const newDeployment = {
      id: newDeploymentId,
      url: `${vercelProj.name}-git-main.vercel.app`,
      branch: vercelProj.gitBranch,
      commitMessage: 'git push: automatic deployment from GitHub workflow integration trigger',
      status: 'ready' as const,
      createdAt: new Date().toISOString(),
      creator: 'github-bot',
      duration: '52s',
      logs: [
        'Deployment automatically triggered by Git webhook.',
        'Pulling build hook outputs...',
        'Compiling Next.js targets...',
        'Edge servers synchronized!',
        'Active routing rule switched successfully.'
      ]
    };

    handleUpdateProject(vercelProj.id, {
      status: 'ready',
      updatedAt: new Date().toISOString(),
      deployments: [newDeployment, ...vercelProj.deployments]
    });

    addEvent({
      id: `evt-v-auto-${Date.now()}`,
      source: 'vercel',
      type: 'success',
      message: `Vercel: Auto-deployment of "${vercelProj.name}" is LIVE following GitHub action merge!`,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <div className="app-bg min-h-screen text-neutral-200 antialiased font-sans">

      {/* Cloud State Loading Overlay */}
      <AnimatePresence>
        {!isStateLoaded && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-neutral-950 flex flex-col items-center justify-center font-mono p-6"
          >
            <div className="space-y-4 max-w-sm w-full text-center">
              <div className="relative w-12 h-12 mx-auto">
                <div className="absolute inset-0 rounded-full border-2 border-emerald-950" />
                <div className="absolute inset-0 rounded-full border-2 border-t-emerald-400 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-white uppercase tracking-widest font-bold animate-pulse">
                  Initializing Cloud Gateway...
                </p>
                <p className="text-[10px] text-neutral-500">
                  Syncing secure schema partitions with Supabase...
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Gate - no guest access. The whole app stays hidden until signed in. */}
      {isStateLoaded && !authLoading && !user && (
        <div className="fixed inset-0 z-50 bg-neutral-950 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-neutral-950 border border-neutral-900 rounded-xl max-w-sm w-full p-6 shadow-[0_0_50px_rgba(59,130,246,0.07)] relative overflow-hidden font-mono"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-emerald-400 font-bold tracking-tight text-xs font-mono">
                UNI
              </span>
              <span className="text-sm font-bold text-white tracking-tight">Unicorn's Desk</span>
            </div>

            <div className="flex items-center gap-2 mb-4 border-b border-neutral-900 pb-3 mt-3">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span className="text-[10px] uppercase font-bold text-blue-400 tracking-widest">
                Cloud Sync Gateway
              </span>
            </div>

            <p className="text-[10px] text-neutral-400 leading-normal mb-4 font-sans">
              Sign in to access your dashboard. Topics, goals, and progress are stored in the cloud and sync across every device on this account - no guest mode.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthError(null);
                if (!supabase) {
                  setAuthError("Supabase is not configured or failed to initialize.");
                  return;
                }
                try {
                  if (isSignUpMode) {
                    const { error } = await supabase.auth.signUp({
                      email: authEmail,
                      password: authPassword
                    });
                    if (error) {
                      setAuthError(error.message);
                    } else {
                      addEvent({
                        id: `evt-supabase-register-${Date.now()}`,
                        source: 'supabase',
                        type: 'success',
                        message: `Supabase Auth: Account registered successfully for ${authEmail}.`,
                        timestamp: new Date().toISOString()
                      });
                    }
                  } else {
                    const { error } = await supabase.auth.signInWithPassword({
                      email: authEmail,
                      password: authPassword
                    });
                    if (error) {
                      setAuthError(error.message);
                    } else {
                      addEvent({
                        id: `evt-supabase-login-${Date.now()}`,
                        source: 'supabase',
                        type: 'success',
                        message: `Supabase Auth: Authenticated successfully as ${authEmail}.`,
                        timestamp: new Date().toISOString()
                      });
                    }
                  }
                } catch (err: any) {
                  setAuthError(err.message);
                }
              }}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-[9px] text-neutral-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-neutral-900/40 border border-neutral-900 focus:border-blue-900/50 outline-none text-xs rounded px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[9px] text-neutral-500 uppercase mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-neutral-900/40 border border-neutral-900 focus:border-blue-900/50 outline-none text-xs rounded px-3 py-2 text-white font-mono"
                />
              </div>

              {authError && (
                <p className="text-[9px] text-red-500 uppercase font-bold tracking-wider leading-relaxed bg-red-950/20 p-2 border border-red-950 rounded text-center">
                  {authError}
                </p>
              )}

              <div className="flex items-center justify-between text-[9px] pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setIsSignUpMode(!isSignUpMode);
                  }}
                  className="text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                >
                  {isSignUpMode ? "Have an account? Sign In" : "Need an account? Sign Up"}
                </button>

                <button
                  type="submit"
                  className="px-4 py-1 bg-blue-950/40 hover:bg-blue-900/30 text-blue-400 border border-blue-900/30 rounded font-semibold transition cursor-pointer"
                >
                  {isSignUpMode ? "Register" : "Sign In"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Everything below is gated behind a signed-in user - no guest data. */}
      {user && (
      <>
      {/* Database Warning Banner */}
      {syncError && (
        <div className="bg-red-950/40 border-b border-red-900/60 px-4 py-2.5 text-center text-xs font-mono text-red-400 flex items-center justify-center gap-2 select-none">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500 animate-pulse" />
          <span>{syncError}</span>
        </div>
      )}

      <header className="bg-neutral-950 sticky top-0 z-40">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & title with invisible box wrapper to go home */}
          <div 
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-3 shrink-0 cursor-pointer select-none group/logo hover:opacity-95 transition-opacity"
            title="Return Home"
          >
            <div className="flex items-center">
              <span className="p-1.5 bg-neutral-900 border border-neutral-800 group-hover/logo:border-neutral-700 rounded-lg text-emerald-400 font-bold tracking-tight text-xs font-mono transition-colors">
                UNI
              </span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                Unicorn's Desk
                <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-400 font-mono text-[9px] uppercase font-semibold rounded-full border border-emerald-900">
                  v7.7
                </span>
              </h1>
              <p className="text-[10px] text-neutral-500 font-mono hidden sm:block">It works if you do what works</p>
            </div>
          </div>

          {/* Quick Search bar */}
          <div className="flex-1 max-w-sm hidden md:block">
            <button 
              onClick={() => setIsPaletteOpen(true)}
              className="w-full flex items-center justify-between gap-3 px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-850 text-neutral-500 hover:text-neutral-400 border border-neutral-800 rounded-lg transition text-xs font-mono"
            >
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-neutral-500" />
                <span>Search projects or schemas...</span>
              </div>
              <span className="text-[9px] text-neutral-600 font-semibold uppercase bg-neutral-950 px-1.5 py-0.5 border border-neutral-850 rounded">
                ⌘K
              </span>
            </button>
          </div>

          {/* Real-time UTC metrics / clock */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0 font-mono text-[11px] text-neutral-400">
            <div className="flex items-center gap-1.5 text-neutral-500 bg-neutral-900 border border-neutral-850 px-2 sm:px-2.5 py-1 rounded-lg">
              <span
                className="relative flex h-2 w-2"
                title={syncError ? `Cloud Sync Error: ${syncError}` : 'Cloud Sync Active'}
                aria-label={syncError ? 'Cloud sync error' : 'Cloud sync active'}
              >
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${syncError ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${syncError ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
              </span>
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{timeStr || 'Loading...'}</span>
            </div>

            {/* Supabase Sync Auth Control - header only renders once `user` is set */}
            <div className="flex items-center gap-2 bg-emerald-950/20 border border-emerald-900/30 rounded-lg px-2 py-1 text-emerald-400 select-none font-mono">
              <button
                onClick={async () => {
                  if (supabase) {
                    await supabase.auth.signOut();
                  }
                  addEvent({
                    id: `evt-supabase-logout-${Date.now()}`,
                    source: 'supabase',
                    type: 'warning',
                    message: 'Supabase Auth: Logged out from database sync session.',
                    timestamp: new Date().toISOString()
                  });
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-900/40 text-emerald-400 transition hover:bg-emerald-950/40 hover:text-white"
                title={`Logout${user?.email ? ` from ${user.email}` : ''}`}
                aria-label="Logout"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Main Tab Controller Bar */}
      <nav className="border-b border-neutral-900 bg-neutral-950/60 backdrop-blur-md sticky top-16 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-2 sm:overflow-x-auto sm:no-scrollbar">
            {/* Mobile: hamburger + active tab label. Desktop: horizontal tab strip. */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="sm:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900/70 border border-neutral-800 text-neutral-200 text-xs font-mono font-semibold"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
              <span className="capitalize">
                {(() => {
                  const label: Record<string, string> = {
                    overview: 'Command Center', topics: 'Topics', pipeline: 'Pipeline', actionhub: 'Score',
                    topicintel: 'Time', videolab: 'Video Lab', logs: 'Logs', progress: 'Progress',
                    score: 'Score', experiments: 'Experiments', sessions: 'Sessions'
                  };
                  return label[activeTab] || activeTab;
                })()}
              </span>
            </button>
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'overview'
                    ? 'bg-neutral-900 border border-neutral-850 text-white'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <Activity className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
                <span>Command Center</span>
              </button>

              <button
                onClick={() => setActiveTab('topics')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'topics'
                    ? 'bg-neutral-900 border border-neutral-850 text-blue-400'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <GitBranch className="h-3.5 w-3.5" />
                <span>Topics</span>
              </button>

              <button
                onClick={() => {
                  setPipelineSubView('topics');
                  setActiveTab('pipeline');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'pipeline'
                    ? 'bg-neutral-900 border border-neutral-850 text-amber-400'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-amber-500" />
                <span>Pipeline</span>
              </button>

              <button
                onClick={() => setActiveTab('actionhub')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'actionhub'
                    ? 'bg-neutral-900 border border-neutral-850 text-emerald-400'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                <span>Score</span>
              </button>

              <button
                onClick={() => setActiveTab('topicintel')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'topicintel'
                    ? 'bg-neutral-900 border border-neutral-850 text-purple-400'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <Clock className="h-3.5 w-3.5 text-purple-400" />
                <span>Time</span>
              </button>

              <button
                onClick={() => setActiveTab('videolab')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'videolab'
                    ? 'bg-neutral-900 border border-neutral-850 text-blue-400'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <Clapperboard className="h-3.5 w-3.5 text-blue-400" />
                <span>Video Lab</span>
              </button>

              <button
                onClick={() => setActiveTab('logs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'logs'
                    ? 'bg-neutral-900 border border-neutral-850 text-purple-400'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Logs</span>
              </button>
            </div>

            {/* Workday timer UI hidden — per-stage stopwatches on the topic card now
                own all time tracking. WorkdayTimer state is still persisted but
                nothing renders it. */}
            {false && (<WorkdayTimer session={visibleWorkdaySession} setSession={setWorkdaySession} topics={visibleTopics} onEndSession={endWorkdaySessionWithTaskTimers} onDiscardSession={discardWorkdaySession} onOpenTopic={() => {}} onExternalPause={handleMainTimerPause} onExternalResume={handleMainTimerResume} />)}

            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(59, 130, 246, 0.6)' }}
              whileTap={{ scale: 0.95 }}
              animate={{
                boxShadow: [
                  '0 0 10px rgba(59, 130, 246, 0.2)',
                  '0 0 20px rgba(59, 130, 246, 0.4)',
                  '0 0 10px rgba(59, 130, 246, 0.2)'
                ]
              }}
              transition={{
                boxShadow: {
                  repeat: Infinity,
                  duration: 2,
                  ease: 'easeInOut'
                }
              }}
              onClick={() => {
                setTopicFormTopic(null);
                setIsAddFormOpen(true);
              }}
              className="hidden sm:flex px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-black font-bold font-mono text-[11px] rounded-lg items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Topic</span>
            </motion.button>
          </div>
        </div>
      </nav>

      {/* Mobile navigation drawer — slides in from the left, only rendered
          when open so no wasted paint on desktop. */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              key="mobile-nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMobileNavOpen(false)}
              className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm sm:hidden"
            />
            <motion.aside
              key="mobile-nav-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              className="fixed left-0 top-0 bottom-0 z-[71] w-72 max-w-[85vw] bg-neutral-950 border-r border-neutral-800 shadow-2xl flex flex-col sm:hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-900">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-emerald-400 font-bold tracking-tight text-xs font-mono">UNI</span>
                  <span className="text-sm font-bold text-white">Unicorn's Desk</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1.5 rounded border border-neutral-800 text-neutral-400 hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {([
                  { id: 'overview' as const, label: 'Command Center', Icon: Activity, iconClass: 'text-purple-400', activeClass: 'text-white' },
                  { id: 'topics' as const, label: 'Topics', Icon: GitBranch, iconClass: 'text-blue-400', activeClass: 'text-blue-400' },
                  { id: 'pipeline' as const, label: 'Pipeline', Icon: Layers, iconClass: 'text-amber-500', activeClass: 'text-amber-400', extra: () => setPipelineSubView('topics') },
                  { id: 'actionhub' as const, label: 'Score', Icon: Database, iconClass: 'text-emerald-400', activeClass: 'text-emerald-400' },
                  { id: 'topicintel' as const, label: 'Time', Icon: Clock, iconClass: 'text-purple-400', activeClass: 'text-purple-400' },
                  { id: 'videolab' as const, label: 'Video Lab', Icon: Clapperboard, iconClass: 'text-blue-400', activeClass: 'text-blue-400' },
                  { id: 'logs' as const, label: 'Logs', Icon: Terminal, iconClass: 'text-purple-400', activeClass: 'text-purple-400' },
                ]).map(item => {
                  const isActive = activeTab === item.id;
                  const Icon = item.Icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        item.extra?.();
                        setActiveTab(item.id);
                        setMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-mono font-semibold transition ${
                        isActive
                          ? `bg-neutral-900 border border-neutral-800 ${item.activeClass}`
                          : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${item.iconClass}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="p-3 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => {
                    setTopicFormTopic(null);
                    setIsAddFormOpen(true);
                    setMobileNavOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-500 hover:bg-blue-600 text-black font-bold font-mono text-xs rounded-lg"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Topic</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <RunningStageBar
        timers={visibleTaskTimers}
        topics={visibleTopics}
        onPause={() => pauseActiveTaskTimer()}
        onResume={() => resumeActiveTaskTimer()}
        onDone={(topicId, stage) => completeTaskTimerStage(topicId, stage as any)}
      />

      {/* Primary Application Body */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            id="active-workspace-panel"
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <Suspense fallback={
              <div className="flex min-h-[50vh] items-center justify-center text-sm font-mono text-neutral-500">
                Loading workspace…
              </div>
            }>
            {activeTab === 'overview' && (
              <CommandCenterView
                topics={visibleTopics}
                videos={visibleVideos}
                experiments={experiments}
                sessions={sessions}
                taskTimers={visibleTaskTimers}
                insights={insights}
                cycleGoals={cycleGoals}
                workdaySession={visibleWorkdaySession}
                sortOrder={topicSortOrder}
                setSortOrder={setTopicSortOrder}
                onTabChange={(tab) => {
                  setActiveTab(tab === 'sessions' ? 'topicintel' : tab);
                  window.setTimeout(() => {
                    const destination = document.getElementById('active-workspace-panel');
                    if (destination) highlightCommandDestination(destination);
                  }, 350);
                }}
                setSelectedVideoId={setSelectedVideoId}
                scorecard={scorecard}
                activities={visibleActivities}
                onOpenTopicPipeline={(topicId, action) => {
                  setPipelineSubView('topics');
                  setActiveTab('pipeline');
                  const targetId = topicId && action ? `topic-action-${topicId}-${action}` : '';
                  let attempts = 0;
                  const focusTarget = () => {
                    const control = targetId ? document.getElementById(targetId) : null;
                    if (control) {
                      highlightCommandDestination(control, true);
                      return;
                    }

                    const topicCard = topicId ? document.getElementById(`topic-control-${topicId}`) : null;
                    if (topicCard && attempts >= 8) {
                      highlightCommandDestination(topicCard);
                      return;
                    }

                    if (!topicId) {
                      const workspace = document.getElementById('active-workspace-panel');
                      if (workspace) highlightCommandDestination(workspace);
                      return;
                    }

                    if (attempts < 12) {
                      attempts += 1;
                      window.setTimeout(focusTarget, 100);
                      return;
                    }

                    const workspace = document.getElementById('active-workspace-panel');
                    if (topicCard) highlightCommandDestination(topicCard);
                    else if (workspace) highlightCommandDestination(workspace);
                  };

                  window.setTimeout(focusTarget, 250);
                }}
              />
            )}

            {activeTab === 'pipeline' && (
              <TaskTimerContext.Provider value={{
                timers: visibleTaskTimers,
                activeTimer: activeTaskTimer,
                workdaySession: visibleWorkdaySession,
                startTimer: startTaskTimer,
                pauseTimer: pauseActiveTaskTimer,
                resumeTimer: resumeActiveTaskTimer,
                stopTimer: stopActiveTaskTimer,
                completeStageTimer: completeTaskTimerStage,
                addStageGoal: addStageGoal,
                resumeWorkdayAndStart: resumeWorkdayAndStartTask,
                addManualStageTime,
                replaceStageTime,
                setStageTotals,
                updateStageTimer,
                deleteStageTimer
              }}>
                <PipelineView
                  videos={visibleVideos}
                  setVideos={setVideos}
                  onAddEvent={addEvent}
                  topics={visibleTopics}
                  setTopics={setTopics}
                activities={visibleActivities}
                setActivities={setActivities}
                cycleGoals={cycleGoals}
                activeSubView={pipelineSubView}
                setActiveSubView={setPipelineSubView}
                workdaySession={visibleWorkdaySession}
                setWorkdaySession={setWorkdaySession}
                onEditTopic={(topic) => {
                  setTopicFormTopic(topic);
                  setIsAddFormOpen(true);
                }}
                onDeleteContentItem={requestDeleteContentItem}
                onOpenTopicScore={(topicId) => {
                  setScoreFocusTopicId(topicId);
                  setActiveTab('actionhub');
                }}
              />
            </TaskTimerContext.Provider>
          )}

            {activeTab === 'videolab' && (
              <VideoLabView
                videos={visibleVideos}
                selectedVideoId={selectedVideoId}
                setSelectedVideoId={setSelectedVideoId}
                topics={visibleTopics}
                cycleGoals={cycleGoals}
                onDeleteContentItem={requestDeleteContentItem}
              />
            )}

            {activeTab === 'topicintel' && (
              <TimeView
                topics={visibleTopics}
                taskTimers={visibleTaskTimers}
                onStartTimer={(topicId, stage) => startTaskTimer(topicId, stage)}
                onPauseTimer={() => pauseActiveTaskTimer()}
                onCompleteStage={completeTaskTimerStage}
                onAddManualTime={addManualStageTime}
                onReplaceTime={replaceStageTime}
                onSetStageTotals={setStageTotals}
                onUpdateTimer={updateStageTimer}
                onDeleteTimer={deleteStageTimer}
              />
            )}

            {activeTab === 'topics' && (
              <GithubView
                repos={repos}
                onAddEvent={addEvent}
                onUpdateRepo={handleUpdateRepo}
                onTriggerDeploy={triggerVercelDeploy}
                topics={visibleTopics}
                setTopics={setTopics}
                activities={visibleActivities}
                setActivities={setActivities}
                sortOrder={topicSortOrder}
                setSortOrder={setTopicSortOrder}
                setActiveTab={setActiveTab}
                setPipelineSubView={setPipelineSubView}
                onDeleteContentItem={requestDeleteContentItem}
                onDeleteContentItems={requestDeleteContentItems}
                taskTimers={visibleTaskTimers}
              />
            )}

            {activeTab === 'progress' && (
              <VercelView
                projects={vercelProjects}
                onAddEvent={addEvent}
                onUpdateProject={handleUpdateProject}
                topics={visibleTopics}
                setTopics={setTopics}
                activities={visibleActivities}
                setActivities={setActivities}
                setActiveTab={setActiveTab}
                cycleGoals={cycleGoals}
                onDeleteContentItem={requestDeleteContentItem}
                onOpenTopicScore={(topicId) => {
                  setScoreFocusTopicId(topicId);
                  setActiveTab('actionhub');
                }}
              />
            )}

            {activeTab === 'actionhub' && (
              <TopicScoreView
                topics={visibleTopics}
                setTopics={setTopics}
                focusTopicId={scoreFocusTopicId}
                onFocusHandled={() => setScoreFocusTopicId(null)}
              />
            )}

            {activeTab === 'logs' && (
              <div className="space-y-4">
                {/* Logs Sub Navigation Tabs */}
                <div className="flex bg-neutral-900 border border-neutral-850 rounded-lg p-0.5 max-w-fit font-mono">
                  <button 
                    onClick={() => setLogsSubView('content')}
                    className={`px-3 py-1 text-[10px] font-bold rounded transition ${logsSubView === 'content' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
                  >
                    Activity Feed
                  </button>
                  <button 
                    onClick={() => setLogsSubView('backlog')}
                    className={`px-3 py-1 text-[10px] font-bold rounded transition ${logsSubView === 'backlog' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
                  >
                    Telemetry Logs
                  </button>
                  <button 
                    onClick={() => setLogsSubView('tables')}
                    className={`px-3 py-1 text-[10px] font-bold rounded transition ${logsSubView === 'tables' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
                  >
                    Database Tables
                  </button>
                </div>

                {/* Sub View Contents */}
                {logsSubView === 'content' && (
                  <ContentActivityView
                    activities={visibleActivities}
                    topics={visibleTopics}
                    onShowBacklog={() => setLogsSubView('backlog')}
                    onNavigateActivity={navigateToActivity}
                  />
                )}
                
                {logsSubView === 'backlog' && (
                  <LogsView
                    events={visibleEvents}
                    onClearEvents={requestClearEvents}
                    onBack={() => setLogsSubView('content')}
                  />
                )}

                {logsSubView === 'tables' && (
                  <LogsTableEditor
                    topics={visibleTopics}
                    setTopics={setTopics}
                    activities={visibleActivities}
                    setActivities={setActivities}
                    onAddEvent={addEvent}
                    onDeleteContentItem={requestDeleteContentItem}
                    onDeleteActivity={requestDeleteActivity}
                  />
                )}
              </div>
            )}

            {activeTab === 'score' && (
              <ScoreView 
                repos={repos} 
                vercelProjects={vercelProjects} 
                supabase={supabaseProject} 
                scorecard={scorecard}
                setScorecard={setScorecard}
              />
            )}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {isAddFormOpen && (
        <TopicCreateModal
          isOpen={isAddFormOpen}
          onClose={() => {
            setIsAddFormOpen(false);
            setTopicFormTopic(null);
          }}
          topicToEdit={topicFormTopic}
          topics={topics}
          setTopics={setTopics}
          setActivities={setActivities}
          onAddEvent={addEvent}
          setActiveTab={setActiveTab}
          setPipelineSubView={setPipelineSubView}
          taskTimers={visibleTaskTimers}
          onReplaceStageTime={replaceStageTime}
        />
      )}

      {/* Command Palette Modal */}
      <CommandPalette 
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        repos={repos}
        vercelProjects={vercelProjects}
        supabase={supabaseProject}
        onTabChange={setActiveTab}
        onTriggerDeploy={triggerVercelDeploy}
      />

      {/* Footer */}
      <footer className="border-t border-neutral-900/60 bg-neutral-950 py-8 mt-12 font-mono text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Laptop className="h-4 w-4" />
              <span>Unicorn's Desk Panel - Cloud Sync Integration Active</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-neutral-400">Last Updated: {formatRelativeTime(lastDbUpdateTime)}</span>
              <button
                onClick={() => {
                  setIsResetOpen(true);
                  setResetPhase('password');
                  setResetPassword('');
                  setResetLogs([]);
                  setResetProgress(0);
                }}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 bg-red-950/40 border border-red-900/50 hover:border-red-800/80 px-2 py-0.5 rounded cursor-pointer transition duration-300 font-mono font-medium text-[10px]"
              >
                <Database className="h-3 w-3 animate-pulse text-red-500" />
                <span>DB Reset</span>
              </button>
            </div>
          </div>

        </div>
      </footer>


      {/* Database Detonation Modal Overlay */}
      <AnimatePresence>
        {isResetOpen && (
          <div className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                x: isShaking ? [-6, 6, -6, 6, -3, 3, 0] : 0
              }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-neutral-950 border border-neutral-900 rounded-xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(239,68,68,0.07)] relative overflow-hidden font-mono"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center gap-2 mb-4 border-b border-neutral-900 pb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[10px] uppercase font-bold text-red-500 tracking-widest">
                  System Detonation Node
                </span>
              </div>

              {resetPhase === 'password' && (
                <div className="space-y-4">
                  <p className="text-[10px] text-neutral-400 leading-normal">
                    Enter security override key to initiate content database wipe sequence:
                  </p>
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (resetPassword === 'itisakshaysorder') {
                        setResetPhase('confirm');
                      } else {
                        setIsShaking(true);
                        setTimeout(() => setIsShaking(false), 500);
                        setResetPassword('');
                      }
                    }} 
                    className="space-y-3"
                  >
                    <input 
                      type="password"
                      required
                      autoFocus
                      placeholder="ENTER KEY..."
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="w-full bg-neutral-900/40 border border-neutral-900 focus:border-red-900/50 outline-none text-xs rounded px-3 py-2 text-white text-center tracking-widest font-mono"
                    />
                    <div className="flex justify-end gap-2 text-[10px]">
                      <button 
                        type="button" 
                        onClick={() => setIsResetOpen(false)}
                        className="px-2.5 py-1 text-neutral-500 hover:text-neutral-300"
                      >
                        Abort
                      </button>
                      <button 
                        type="submit"
                        className="px-4 py-1 bg-red-950/40 hover:bg-red-900/30 text-red-400 border border-red-900/30 rounded font-semibold transition"
                      >
                        Authorize
                      </button>
                    </div>
                  </form>
                  {isShaking && (
                    <p className="text-[9px] text-red-500 text-center animate-pulse uppercase font-bold tracking-wider">
                      Override Denied: Authentication Failure
                    </p>
                  )}
                </div>
              )}

              {resetPhase === 'confirm' && (
                <div className="space-y-4">
                  <div className="p-3 bg-red-950/10 border border-red-900/40 text-red-400 rounded-lg text-[10px] leading-relaxed">
                    <span className="font-bold block mb-1">⚠️ DETONATION WARNING:</span>
                    This operation will drop all catalog tables, video backlogs, channel logs, and telemetry history. Reseeding factory content schemas is required post-flush. Execute?
                  </div>
                  <div className="flex justify-center gap-3 text-[10px]">
                    <button 
                      onClick={() => setIsResetOpen(false)}
                      className="px-4 py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white rounded transition"
                    >
                      [ CANCEL ]
                    </button>
                    <button 
                      onClick={handleStartDetonation}
                      className="px-4 py-1.5 bg-red-950/40 border border-red-900/60 text-red-400 hover:bg-red-950 hover:text-red-300 rounded transition font-bold"
                    >
                      [ YES, DETONATE ]
                    </button>
                  </div>
                </div>
              )}

              {resetPhase === 'deleting' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-red-400 font-bold uppercase animate-pulse">Flush active...</span>
                    <span className="text-neutral-400">{resetProgress}%</span>
                  </div>
                  <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden border border-neutral-900">
                    <div 
                      className="bg-gradient-to-r from-red-600 to-orange-500 h-full rounded-full transition-all duration-150" 
                      style={{ width: `${resetProgress}%` }}
                    />
                  </div>
                  <div className="bg-neutral-950/60 border border-neutral-900 rounded-lg p-2.5 h-36 overflow-y-auto font-mono text-[8px] text-neutral-400 space-y-1 scrollbar-thin">
                    {resetLogs.map((log, idx) => (
                      <div key={idx} className={log.includes('DROP') || log.includes('WIPE') ? 'text-red-400' : 'text-neutral-400'}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resetPhase === 'complete' && (
                <div className="space-y-3 text-center py-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto animate-bounce" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-white uppercase text-[10px]">Detonation Ingest Complete</span>
                    <p className="text-[9px] text-neutral-400 font-sans">Desk catalog successfully reseeded. Client rebooted.</p>
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </>
      )}

    </div>
  );
}

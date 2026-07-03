import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
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
  TrendingUp, 
  Cpu, 
  Github,
  Wifi,
  ExternalLink,
  Laptop,
  Trophy,
  CheckCircle2,
  Lock,
  Plus,
  LogIn,
  LogOut,
  User as UserIcon,
  AlertCircle,
  Bookmark,
  Clapperboard,
  Sparkles,
  ListChecks,
  Youtube,
  Loader2
} from 'lucide-react';
import { supabase } from './services/supabase';

import { GitHubRepo, VercelProject, SupabaseProject, SystemEvent, Topic, TopicActivity, CycleGoal, WorkdaySession, VideoRecord, Experiment, CreatorInsight, ScorecardState, AiRulePreset, AiUsageStats, YoutubeRevenueData } from './types';
import { mergeRemoteWithPendingTopics, mergeTopicsByNewest, normalizeCommittedTombstones, prepareLocalTopicMutation, topicCollectionsEqual, visibleCreatorTopics } from './lib/topicSync';
import { normalizeScorecard, rolloverScorecard } from './services/scorecardStorage';
import { fetchYoutubeRevenue, startYoutubeAuth, disconnectYoutube } from './services/youtube';
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

const GithubView = lazy(() => import('./components/GithubView'));
const VercelView = lazy(() => import('./components/VercelView'));
const SupabaseView = lazy(() => import('./components/SupabaseView'));
const LogsView = lazy(() => import('./components/LogsView'));
const ContentActivityView = lazy(() => import('./components/ContentActivityView'));
const LogsTableEditor = lazy(() => import('./components/LogsTableEditor'));
const ScoreView = lazy(() => import('./components/ScoreView'));
const CommandCenterView = lazy(() => import('./components/CommandCenterView'));
const PipelineView = lazy(() => import('./components/PipelineView'));
const VideoLabView = lazy(() => import('./components/VideoLabView'));
const TodayGoalsView = lazy(() => import('./components/TodayGoalsView'));
const ForecastingView = lazy(() => import('./components/ForecastingView'));
const ExperimentTrackerView = lazy(() => import('./components/ExperimentTrackerView'));
const InsightsView = lazy(() => import('./components/InsightsView'));

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

export default function App() {
  useEffect(() => {
    // Remove credentials stored by versions that called OpenAI from the browser.
    localStorage.removeItem('unicorn_openai_api_key');
  }, []);

  const [activeTab, setActiveTab] = useState<'overview' | 'topics' | 'progress' | 'actionhub' | 'logs' | 'score' | 'pipeline' | 'videolab' | 'topicintel' | 'forecasting' | 'experiments' | 'insights'>(() => {
    return (localStorage.getItem('unicorn_active_tab') as any) || 'overview';
  });

  const [pipelineSubView, setPipelineSubView] = useState<'videos' | 'topics'>('videos');

  const [cycleGoals, setCycleGoals] = useState<CycleGoal | null>(null);
  const [workdaySession, setWorkdaySession] = useState<WorkdaySession | null>(null);

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
  const dirtyTopicIdsRef = useRef<Set<string>>(new Set());
  const topicMutationEpochRef = useRef(0);
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

          const generated = missing.map((change, index): TopicActivity => {
            const previousTopic = change.previous;
            let action = 'Updated topic details';
            if (change.deleted) action = 'Deleted topic';
            else if (!previousTopic) action = 'Created topic';
            else if (previousTopic.status !== change.topic.status || previousTopic.inProgress !== change.topic.inProgress) {
              action = `Changed workflow from ${previousTopic.status}${previousTopic.inProgress ? ' (pipeline)' : ''} to ${change.topic.status}${change.topic.inProgress ? ' (pipeline)' : ''}`;
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

  const [aiPresets, setAiPresets] = useState<AiRulePreset[]>([]);
  const [aiUsage, setAiUsage] = useState<AiUsageStats>(() => createEmptyAiUsageStats());

  // Single, app-wide YouTube connection - fetched once here (not per-view),
  // so every tile that shows YouTube data reflects the same connection
  // state and nothing ever re-prompts for auth on its own. The one and
  // only place that starts the OAuth flow is the header control below.
  const [youtubeRevenue, setYoutubeRevenue] = useState<YoutubeRevenueData | null>(null);
  const [isLoadingYoutube, setIsLoadingYoutube] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [isConnectingYoutube, setIsConnectingYoutube] = useState(false);
  const [videos, setVideos] = useState<VideoRecord[]>(initialVideos);
  const [experiments, setExperiments] = useState<Experiment[]>(initialExperiments);
  const [insights, setInsights] = useState<CreatorInsight[]>(initialCreatorInsights);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  // Bidirectional Synchronization between topics and videos
  useEffect(() => {
    // 1. Synchronize topics into videos
    setVideos(prevVideos => {
      let changed = false;
      const nextVideos = [...prevVideos];

      // Remove videos that are deleted in tombstones
      const deletedIds = new Set(Object.keys(topicTombstonesRef.current));
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
        const v = videoMap.get(t.id);
        
        // Map Topic status to Video pipelineStage
        let stage: 'Topic' | 'Script' | 'Shoot' | 'Edit' | 'Thumbnail' | 'Schedule' | 'Published' = 'Topic';
        if (t.status === 'scripted') stage = 'Script';
        else if (t.status === 'shot') stage = 'Shoot';
        else if (t.status === 'edited') stage = 'Edit';
        else if (t.status === 'scheduled') stage = 'Schedule';
        else if (t.status === 'posted') stage = 'Published';

        if (!v) {
          // Create new VideoRecord
          const newVideo: VideoRecord = {
            id: t.id,
            channelName: t.channel,
            title: t.name,
            format: t.format || 'Long',
            contentType: t.format === 'Short' ? 'News decode' : 'Deep explainer',
            topic: t.category || 'General',
            pipelineStage: stage,
            scriptStatus: t.status !== 'topic' ? 'completed' : 'pending',
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
            v.blockedReason !== t.blockedReason
          ) {
            const oldStage = v.pipelineStage;
            v.title = t.name;
            v.channelName = t.channel;
            v.format = t.format || 'Long';
            v.pipelineStage = stage;
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
        const t = topicMap.get(v.id);

        // Map Video pipelineStage to Topic status
        let status: 'topic' | 'scripted' | 'shot' | 'edited' | 'scheduled' | 'posted' = 'topic';
        if (v.pipelineStage === 'Script') status = 'scripted';
        else if (v.pipelineStage === 'Shoot') status = 'shot';
        else if (v.pipelineStage === 'Edit' || v.pipelineStage === 'Thumbnail') status = 'edited';
        else if (v.pipelineStage === 'Schedule') status = 'scheduled';
        else if (v.pipelineStage === 'Published') status = 'posted';

        if (!t) {
          // Create new Topic if created from Pipeline Kanban
          const newTopic: Topic = {
            id: v.id,
            name: v.title,
            description: v.notes || '',
            channel: v.channelName,
            status: status,
            priority: 3,
            dueDate: v.uploadDate || null,
            createdDate: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            format: v.format,
            blockedReason: v.blockedReason
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

  useEffect(() => {
    localStorage.removeItem('yt_oauth_credentials');
    localStorage.removeItem('yt_oauth_credentials_v2');
    const callback = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (callback.get('state') === 'youtube_oauth') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    // api/youtube-auth-callback.js redirects back here with ?youtube=<status>
    // after the OAuth flow completes (or fails) - surface it once, then
    // strip the param so a refresh doesn't re-show the same event.
    const query = new URLSearchParams(window.location.search);
    const youtubeStatus = query.get('youtube');
    if (youtubeStatus) {
      const isSuccess = youtubeStatus === 'connected';
      addEvent({
        id: `evt-youtube-oauth-${Date.now()}`,
        source: 'system',
        type: isSuccess ? 'success' : 'error',
        message: isSuccess
          ? 'YouTube Analytics: Channel connected successfully.'
          : `YouTube Analytics: Connection failed (${youtubeStatus}).`,
        timestamp: new Date().toISOString()
      });
      query.delete('youtube');
      const remaining = query.toString();
      window.history.replaceState(null, '', window.location.pathname + (remaining ? `?${remaining}` : ''));
    }
  }, []);

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
  const lastRemoteUpdatedAtRef = useRef(0);
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
        } else if (percent >= 60 && percent < 85) {
          setActivities([]);
          setAiPresets([]);
          setAiUsage(createEmptyAiUsageStats());
          setCycleGoals(null);
          setWorkdaySession(null);
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync active tab to localStorage for reload memory
  useEffect(() => {
    localStorage.setItem('unicorn_active_tab', activeTab);
  }, [activeTab]);

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
          const hydratedTopics = mergeTopicsByNewest(remoteTopics, backupTopics, combinedTombstones);
          topicTombstonesRef.current = combinedTombstones;
          const cloudNeedsRepair = !topicCollectionsEqual(hydratedTopics, remoteTopics);
          isRemoteSyncRef.current = !cloudNeedsRepair;
          dirtyTopicIdsRef.current = cloudNeedsRepair
            ? new Set(hydratedTopics.filter(topic => !remoteTopics.some(remote => remote.id === topic.id)).map(topic => topic.id))
            : new Set();

          if (remoteState.topics) {
            setTopicsState(hydratedTopics);
            localStorage.removeItem(`unicorn_infotainment_demo_seed_v1_${userId}`);
          }
          if (remoteState.activities) setActivities(remoteState.activities);
          if (remoteState.cycleGoals) setCycleGoals(remoteState.cycleGoals);
          if ('workdaySession' in remoteState) setWorkdaySession(remoteState.workdaySession || null);
          if (remoteState.scorecard) setScorecard(normalizeScorecard(remoteState.scorecard));
          if (remoteState.videos) setVideos(remoteState.videos);
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
              scorecard,
              videos,
              experiments,
              insights,
              aiPresets,
              aiUsage
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
                const combinedTombstones = { ...remoteTombstones, ...topicTombstonesRef.current };
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
                if ('workdaySession' in remoteState) setWorkdaySession(remoteState.workdaySession || null);
                if (remoteState.scorecard) setScorecard(normalizeScorecard(remoteState.scorecard));
                if (remoteState.videos) setVideos(remoteState.videos);
                if (remoteState.experiments) setExperiments(remoteState.experiments);
                if (remoteState.insights) setInsights(remoteState.insights);
                if (remoteState.aiPresets) setAiPresets(remoteState.aiPresets);
                if (remoteState.aiUsage) setAiUsage(remoteState.aiUsage);

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

  const loadYoutubeRevenue = async () => {
    setIsLoadingYoutube(true);
    setYoutubeError(null);
    try {
      const result = await fetchYoutubeRevenue();
      setYoutubeRevenue(result);
      if (result.connected && (result as any).error) setYoutubeError((result as any).error);
    } catch (err: any) {
      setYoutubeError(err.message || 'Failed to fetch YouTube data.');
    } finally {
      setIsLoadingYoutube(false);
    }
  };

  useEffect(() => {
    if (!user || authLoading) return;
    loadYoutubeRevenue();
  }, [user?.id, authLoading]);

  const handleConnectYoutube = async () => {
    setIsConnectingYoutube(true);
    try {
      await startYoutubeAuth();
    } catch (err: any) {
      setYoutubeError(err.message || 'Failed to start YouTube connection.');
      setIsConnectingYoutube(false);
    }
  };

  const handleDisconnectYoutube = async () => {
    if (!window.confirm('Disconnect this YouTube channel? Revenue and subscriber data will stop updating until reconnected.')) return;
    try {
      await disconnectYoutube();
      setYoutubeRevenue({ connected: false });
    } catch (err: any) {
      setYoutubeError(err.message || 'Failed to disconnect YouTube.');
    }
  };

  const saveConflictSafeState = async (
    newTopics: Topic[], newActs: TopicActivity[], newGoals: CycleGoal | null,
    newWorkdaySession: WorkdaySession | null,
    newScorecard: any, newVideos: VideoRecord[], newExperiments: Experiment[], newInsights: CreatorInsight[],
    newPresets: AiRulePreset[], newUsage: AiUsageStats
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
      topicTombstonesRef.current = deletedTopicIds;

      const mergedTopics = mergeTopicsByNewest(remoteTopics, newTopics, deletedTopicIds);
      const mergedActivities = new Map<string, TopicActivity>();
      [...((remoteState.activities || []) as TopicActivity[]), ...newActs].forEach(activity => {
        const existing = mergedActivities.get(activity.id);
        if (!existing || new Date(activity.timestamp).getTime() >= new Date(existing.timestamp).getTime()) mergedActivities.set(activity.id, activity);
      });
      const nextState = {
        ...remoteState, topics: mergedTopics, deletedTopicIds,
        activities: Array.from(mergedActivities.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        cycleGoals: newGoals, workdaySession: newWorkdaySession, scorecard: newScorecard, videos: newVideos,
        experiments: newExperiments, insights: newInsights, aiPresets: newPresets, aiUsage: newUsage
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
    newScorecard: any,
    newVideos: VideoRecord[],
    newExperiments: Experiment[],
    newInsights: CreatorInsight[],
    newPresets: AiRulePreset[],
    newUsage: AiUsageStats
  ) => {
    // Only a genuinely unrecoverable state (missing schema) blocks saving.
    // A transient syncError banner must never permanently stop future saves -
    // that was the actual cause of topics silently never reaching the
    // database: one past transient failure disabled every save for the rest
    // of the session with no automatic recovery.
    if (!supabase || !user || syncFatal) return;
    try {
      await saveConflictSafeState(newTopics, newActs, newGoals, newWorkdaySession, newScorecard, newVideos, newExperiments, newInsights, newPresets, newUsage);
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
      state: { topics: durableTopics, deletedTopicIds: durableTombstones, activities, cycleGoals, workdaySession, scorecard, videos, experiments, insights, aiPresets, aiUsage }
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
  }, [topics, activities, cycleGoals, workdaySession, scorecard, videos, experiments, insights, aiPresets, aiUsage, user, authLoading, isStateLoaded, hydratedUserId]);

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
        if ('workdaySession' in remoteState) setWorkdaySession(remoteState.workdaySession || null);
        if (remoteState.scorecard) setScorecard(normalizeScorecard(remoteState.scorecard));
        if (remoteState.videos) setVideos(remoteState.videos);
        if (remoteState.experiments) setExperiments(remoteState.experiments);
        if (remoteState.insights) setInsights(remoteState.insights);
        if (remoteState.aiPresets) setAiPresets(remoteState.aiPresets);
        if (remoteState.aiUsage) setAiUsage(remoteState.aiUsage);
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

    if (isRemoteSyncRef.current) {
      isRemoteSyncRef.current = false;
      return;
    }

    // Short debounce batches a single interaction; the queue preserves write order.
    const timer = setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(() => saveStateToSupabase(topics, activities, cycleGoals, workdaySession, scorecard, videos, experiments, insights, aiPresets, aiUsage));
    }, 75);

    return () => clearTimeout(timer);
  }, [topics, activities, cycleGoals, workdaySession, scorecard, videos, experiments, insights, aiPresets, aiUsage, user, authLoading, isStateLoaded, hydratedUserId]);

  // Update clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
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
          <div className="flex items-center gap-4 shrink-0 font-mono text-[11px] text-neutral-400">
            <div className="flex items-center gap-1.5 text-neutral-500 bg-neutral-900 border border-neutral-850 px-2.5 py-1 rounded-lg">
              <Clock className="h-3.5 w-3.5" />
              <span>{timeStr || 'Loading...'}</span>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 text-neutral-400">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${syncError ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${syncError ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
              </span>
              <span>{syncError ? 'Cloud Sync Error' : 'Cloud Sync Active'}</span>
            </div>

            {/* Global YouTube connection control - the ONE place that starts the
                OAuth flow anywhere in the app. Every YouTube-backed tile just
                reads this same state; nothing else ever prompts for auth. */}
            {!youtubeRevenue || isLoadingYoutube ? (
              <div className="hidden lg:flex items-center gap-1.5 bg-neutral-900 border border-neutral-850 rounded-lg px-2.5 py-1 text-neutral-500 font-mono text-[9px]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>YouTube</span>
              </div>
            ) : youtubeRevenue.connected ? (
              <div className="hidden lg:flex items-center gap-2 bg-red-950/20 border border-red-900/30 rounded-lg px-2.5 py-1 text-red-400 select-none font-mono">
                <Youtube className="h-3.5 w-3.5" />
                <span className="max-w-[110px] truncate text-[9px] font-bold">{youtubeRevenue.channelTitle || 'Connected'}</span>
                <button
                  onClick={handleDisconnectYoutube}
                  className="hover:text-white ml-1 cursor-pointer transition"
                  title="Disconnect YouTube"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectYoutube}
                disabled={isConnectingYoutube}
                className="hidden lg:flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-red-900/40 disabled:opacity-40 rounded-lg px-2.5 py-1 text-neutral-400 hover:text-red-400 font-mono text-[9px] font-bold transition cursor-pointer"
                title="Connect your YouTube channel for real revenue and subscriber data"
              >
                <Youtube className="h-3.5 w-3.5" />
                <span>{isConnectingYoutube ? 'Redirecting…' : 'Connect YouTube'}</span>
              </button>
            )}

            {/* Supabase Sync Auth Control - header only renders once `user` is set */}
            <div className="flex items-center gap-2 bg-emerald-950/20 border border-emerald-900/30 rounded-lg px-2.5 py-1 text-emerald-400 select-none font-mono">
              <UserIcon className="h-3.5 w-3.5 text-emerald-400" />
              <span className="max-w-[90px] truncate text-[9px] font-bold">{user.email}</span>
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
                className="hover:text-red-400 ml-1 cursor-pointer transition"
                title="Logout / Disconnect Sync"
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
          <div className="flex items-center justify-between gap-4 py-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 shrink-0">
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
                onClick={() => setActiveTab('pipeline')}
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
                onClick={() => setActiveTab('topicintel')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'topicintel'
                    ? 'bg-neutral-900 border border-neutral-850 text-purple-400'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <ListChecks className="h-3.5 w-3.5 text-purple-400" />
                <span>Today&apos;s Goals</span>
              </button>

              <button
                onClick={() => setActiveTab('forecasting')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'forecasting'
                    ? 'bg-neutral-900 border border-neutral-850 text-emerald-400'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                <span>Forecasting</span>
              </button>

              <button
                onClick={() => setActiveTab('experiments')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'experiments'
                    ? 'bg-neutral-900 border border-neutral-850 text-amber-500'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5 text-amber-500" />
                <span>Experiments</span>
              </button>

              <button
                onClick={() => setActiveTab('insights')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'insights'
                    ? 'bg-neutral-900 border border-neutral-850 text-purple-400'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
                <span>Insights</span>
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
                onClick={() => setActiveTab('actionhub')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'actionhub'
                    ? 'bg-neutral-900 border border-neutral-850 text-emerald-400'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                <span>Action Hub</span>
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

              <button
                onClick={() => setActiveTab('score')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'score'
                    ? 'bg-neutral-900 border border-neutral-850 text-rose-400'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <Trophy className="h-3.5 w-3.5" />
                <span>Well-Being</span>
              </button>
            </div>

            <WorkdayTimer session={workdaySession} setSession={setWorkdaySession} topics={topics} />

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
                setActiveTab('topics');
                setIsAddFormOpen(true);
              }}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-black font-bold font-mono text-[11px] rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Topic</span>
            </motion.button>
          </div>
        </div>
      </nav>

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
                topics={topics}
                videos={videos}
                experiments={experiments}
                insights={insights}
                cycleGoals={cycleGoals}
                onTabChange={(tab) => {
                  setActiveTab(tab);
                  window.setTimeout(() => {
                    const destination = document.getElementById('active-workspace-panel');
                    if (destination) highlightCommandDestination(destination);
                  }, 350);
                }}
                setSelectedVideoId={setSelectedVideoId}
                scorecard={scorecard}
                activities={activities}
                onOpenTopicPipeline={(topicId, action) => {
                  setPipelineSubView('topics');
                  setActiveTab('pipeline');
                  window.setTimeout(() => {
                    const control = document.getElementById(`topic-action-${topicId}-${action}`);
                    const topicCard = document.getElementById(`topic-control-${topicId}`);
                    const workspace = document.getElementById('active-workspace-panel');
                    const target = control || topicCard || workspace;
                    if (!target) return;
                    highlightCommandDestination(target, Boolean(control));
                  }, 350);
                }}
              />
            )}

            {activeTab === 'pipeline' && (
              <PipelineView
                videos={videos}
                setVideos={setVideos}
                onAddEvent={addEvent}
                topics={topics}
                setTopics={setTopics}
                activities={activities}
                setActivities={setActivities}
                cycleGoals={cycleGoals}
                activeSubView={pipelineSubView}
                setActiveSubView={setPipelineSubView}
              />
            )}

            {activeTab === 'videolab' && (
              <VideoLabView
                videos={videos}
                setVideos={setVideos}
                selectedVideoId={selectedVideoId}
                setSelectedVideoId={setSelectedVideoId}
                topics={topics}
                cycleGoals={cycleGoals}
              />
            )}

            {activeTab === 'topicintel' && (
              <TodayGoalsView
                topics={topics}
                session={workdaySession}
                setSession={setWorkdaySession}
              />
            )}

            {activeTab === 'forecasting' && (
              <ForecastingView
                videos={videos}
                cycleGoals={cycleGoals}
              />
            )}

            {activeTab === 'experiments' && (
              <ExperimentTrackerView
                experiments={experiments}
                setExperiments={setExperiments}
                videos={videos}
                onAddEvent={addEvent}
              />
            )}

            {activeTab === 'insights' && (
              <InsightsView
                insights={insights}
                videos={videos}
                onTabChange={setActiveTab}
              />
            )}

            {activeTab === 'topics' && (
              <GithubView 
                repos={repos} 
                onAddEvent={addEvent} 
                onUpdateRepo={handleUpdateRepo}
                onTriggerDeploy={triggerVercelDeploy}
                topics={topics}
                setTopics={setTopics}
                activities={activities}
                setActivities={setActivities}
                isAddFormOpen={isAddFormOpen}
                setIsAddFormOpen={setIsAddFormOpen}
                setActiveTab={setActiveTab}
                setPipelineSubView={setPipelineSubView}
              />
            )}

            {activeTab === 'progress' && (
              <VercelView 
                projects={vercelProjects} 
                onAddEvent={addEvent} 
                onUpdateProject={handleUpdateProject}
                topics={topics}
                setTopics={setTopics}
                activities={activities}
                setActivities={setActivities}
                setActiveTab={setActiveTab}
                cycleGoals={cycleGoals}
              />
            )}

            {activeTab === 'actionhub' && (
              <SupabaseView 
                supabase={supabaseProject} 
                onAddEvent={addEvent} 
                onUpdateSupabase={handleUpdateSupabase}
                topics={topics}
                setTopics={setTopics}
                activities={activities}
                setActivities={setActivities}
                cycleGoals={cycleGoals}
                setCycleGoals={setCycleGoals}
                aiPresets={aiPresets}
                setAiPresets={setAiPresets}
                aiUsage={aiUsage}
                setAiUsage={setAiUsage}
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
                    activities={activities}
                    topics={topics}
                    onShowBacklog={() => setLogsSubView('backlog')}
                    onNavigateActivity={navigateToActivity}
                  />
                )}
                
                {logsSubView === 'backlog' && (
                  <LogsView
                    events={events}
                    onClearEvents={() => { setEvents([]); localStorage.removeItem('unicorn_events'); }}
                    onBack={() => setLogsSubView('content')}
                  />
                )}

                {logsSubView === 'tables' && (
                  <LogsTableEditor
                    topics={topics}
                    setTopics={setTopics}
                    activities={activities}
                    setActivities={setActivities}
                    onAddEvent={addEvent}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Laptop className="h-4 w-4" />
            <span>Unicorn's Desk Panel - Cloud Sync Integration Active</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Last Updated: {formatRelativeTime(lastDbUpdateTime)}</span>
            <button 
              onClick={() => {
                setIsResetOpen(true);
                setResetPhase('password');
                setResetPassword('');
                setResetLogs([]);
                setResetProgress(0);
              }}
              className="flex items-center gap-1 text-red-400 hover:text-red-300 bg-red-950/40 border border-red-900/50 hover:border-red-800/80 px-2 py-0.5 rounded cursor-pointer transition duration-300 ml-2 font-mono font-medium text-[10px]"
            >
              <Database className="h-3 w-3 animate-pulse text-red-500" />
              <span>DB Reset</span>
            </button>
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

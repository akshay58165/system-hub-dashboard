export interface GitHubRepo {
  id: string;
  name: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  branches: string[];
  currentBranch: string;
  pullRequests: GitHubPR[];
  workflows: GitHubWorkflow[];
  commits: GitHubCommit[];
}

export interface GitHubPR {
  id: string;
  title: string;
  number: number;
  author: string;
  status: 'open' | 'merged' | 'closed';
  createdAt: string;
  branch: string;
}

export interface GitHubWorkflow {
  id: string;
  name: string;
  status: 'success' | 'failure' | 'running' | 'queued';
  lastRun: string;
  duration: string;
  commitHash: string;
  logs: string[];
}

export interface GitHubCommit {
  id: string;
  message: string;
  author: string;
  date: string;
  hash: string;
}

export interface VercelProject {
  id: string;
  name: string;
  framework: string;
  status: 'ready' | 'building' | 'failed' | 'offline';
  domain: string;
  gitBranch: string;
  updatedAt: string;
  deployments: VercelDeployment[];
  analytics: VercelAnalytics;
  serverlessFunctions: ServerlessFunction[];
}

export interface VercelDeployment {
  id: string;
  url: string;
  branch: string;
  commitMessage: string;
  status: 'ready' | 'building' | 'failed' | 'queued';
  createdAt: string;
  creator: string;
  duration?: string;
  logs: string[];
}

export interface VercelAnalytics {
  webVitals: {
    lcp: number; // Largest Contentful Paint (ms)
    fid: number; // First Input Delay (ms)
    cls: number; // Cumulative Layout Shift
  };
  traffic: {
    date: string;
    views: number;
    visitors: number;
  }[];
  latency: {
    date: string;
    avgMs: number;
  }[];
}

export interface ServerlessFunction {
  id: string;
  path: string;
  invocations: number;
  errors: number;
  avgDurationMs: number;
}

export interface SupabaseProject {
  id: string;
  name: string;
  status: 'active' | 'pausing' | 'restoring';
  region: string;
  dbVersion: string;
  tables: SupabaseTable[];
  authUsers: SupabaseUser[];
  apiLogs: SupabaseApiLog[];
  metrics: {
    dbSize: string;
    activeConnections: number;
    cpuUsage: number;
    memoryUsage: number;
  };
}

export interface SupabaseTable {
  name: string;
  rowCount: number;
  columns: { name: string; type: string; isNullable: boolean }[];
  rows: Record<string, any>[];
}

export interface SupabaseUser {
  id: string;
  email: string;
  provider: string;
  lastSignIn: string;
  createdAt: string;
  status: 'active' | 'banned' | 'unconfirmed';
}

export interface SupabaseApiLog {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  status: number;
  latencyMs: number;
  timestamp: string;
}

export interface SystemEvent {
  id: string;
  source: 'github' | 'vercel' | 'supabase' | 'system';
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  channel: 'LearnDriven' | 'DecodeWorthy';
  status: 'topic' | 'scripted' | 'shot' | 'edited' | 'scheduled' | 'posted';
  priority: 1 | 2 | 3 | 4 | 5;
  topicScore?: number;
  dueDate: string | null;
  createdDate: string;
  lastUpdated: string;
  revenueLevel?: string;
  inProgress?: boolean;
  savedForLater?: boolean;
  scheduledTime?: string;
  postedAt?: string;
  autoPostPaused?: boolean;
  format?: 'Short' | 'Long' | 'Members';
  category?: string;
  isDemo?: boolean;
  workflowStatuses?: Partial<Record<'script' | 'shoot' | 'edit' | 'schedule' | 'post', 'pending' | 'in-progress' | 'completed'>>;
  // Set when a topic is explicitly marked stuck (past due, work can't
  // proceed for a known reason) rather than silently left to scream a
  // missed-deadline countdown forever. Cleared via the Unblock action.
  blockedReason?: string;
}

export interface TopicActivity {
  id: string;
  topicName: string;
  channel: 'LearnDriven' | 'DecodeWorthy';
  action: string;
  author: string;
  timestamp: string;
  topicId?: string;
  targetTab?: 'pipeline' | 'topics' | 'actionhub';
  targetSubView?: 'videos' | 'topics';
}

export type TopicSortMode = 'due-date' | 'last-created' | 'level' | 'progress-most' | 'progress-least' | 'workload';

export interface CycleGoal {
  cycleType: 'this-month' | 'next-month' | 'custom';
  monthName: string;
  startDate: string;
  endDate: string;
  learnDrivenShorts: number | null;
  learnDrivenLong: number | null;
  learnDrivenMembers: number | null;
  decodeWorthyShorts: number | null;
}

export interface WorkdaySession {
  dateKey: string;
  targetMinutes: number;
  startedAt: string;
  activeSince: string | null;
  pausedAt: string | null;
  accumulatedActiveMs: number;
  productiveActiveMs?: number;
  productivityRatings?: Array<{ recordedAt: string; segmentActiveMs: number; score: number }>;
  accumulatedPausedMs: number;
  status: 'running' | 'paused' | 'completed';
  updatedAt: string;
  // Real, counted every time work is actually paused — not derived, so the
  // session record can honestly report how many breaks were taken.
  breaksCount?: number;
  // Total extra minutes added via the "extend" control, on top of the
  // original targetMinutes chosen when the day started.
  extensionMinutes?: number;
  // Deliberately does NOT store a topicName snapshot — topicId is the only
  // reference. The topic's current name/status/priority must always be read
  // live from the topics array; a goal whose topicId no longer resolves to a
  // real topic is not a valid goal (see App.tsx's cascading prune effect).
  goals?: Array<{
    id: string;
    topicId: string;
    targetStatus: 'scripted' | 'shot' | 'edited' | 'scheduled' | 'posted';
    addedAt: string;
  }>;
  // Goals explicitly removed by the user before completion (or whose topic
  // was deleted out from under them) — a live goal is gone the instant this
  // happens, per the topic-instance integrity rule, but the fact that it was
  // dropped is real history worth keeping for the session record. Snapshots
  // topicName/targetStatus at the moment of drop since this is a log entry,
  // not a live reference (same reasoning as TopicActivity.topicName).
  droppedGoals?: Array<{
    id: string;
    topicId: string;
    topicName: string;
    targetStatus: 'scripted' | 'shot' | 'edited' | 'scheduled' | 'posted';
    droppedAt: string;
  }>;
}

export interface SessionGoalOutcome {
  topicId: string;
  topicName: string;
  targetStatus: 'scripted' | 'shot' | 'edited' | 'scheduled' | 'posted';
}

// A permanent, archived record of one completed workday session — written
// once, when the session ends, and never mutated again. Every number here
// is the session's real final tally, not a live/derived value.
export interface SessionRecord {
  id: string;
  dateKey: string;
  startedAt: string;
  endedAt: string;
  targetMinutes: number;
  extensionMinutes: number;
  accumulatedActiveMs: number;
  productiveActiveMs?: number;
  productivityPercent?: number;
  accumulatedPausedMs: number;
  breaksCount: number;
  achievedGoals: SessionGoalOutcome[];
  droppedGoals: SessionGoalOutcome[];
  pendingGoals: SessionGoalOutcome[];
  taskTimers?: TaskTimerRecord[];
}

export interface VideoRecord {
  id: string;
  channelName: 'LearnDriven' | 'DecodeWorthy';
  videoId?: string;
  title: string;
  url?: string;
  format: 'Short' | 'Long' | 'Members';
  contentType: string; // e.g. "Practical explainer", "Myth-busting"
  topic: string;
  series?: string;
  category?: string;
  pipelineStage: 'Topic' | 'Script' | 'Shoot' | 'Edit' | 'Thumbnail' | 'Schedule' | 'Published';
  uploadDate?: string;
  dueDate?: string;
  publishTime?: string;
  duration?: number; // duration in seconds
  
  // Pipeline status checks
  scriptStatus: 'pending' | 'in-progress' | 'completed';
  shootStatus: 'pending' | 'in-progress' | 'completed';
  editStatus: 'pending' | 'in-progress' | 'completed';
  thumbnailStatus: 'pending' | 'in-progress' | 'completed' | 'not-applicable';
  scheduleStatus: 'pending' | 'completed';
  publishedStatus: 'pending' | 'completed';
  
  productionEffortHours: number;
  hookType?: string;
  structureType?: string;
  contentIntent?: string;
  difficultyLevel?: 'easy' | 'medium' | 'hard';
  researchDepth?: string;
  thumbnailVersion?: string;
  titleVersion?: string;
  notes?: string;
  blockedReason?: string;
  nextAction?: string;
  performanceStatus?: 'Great' | 'Good' | 'Normal' | 'Watch' | 'At Risk' | 'Problem' | 'Needs Action';
  
  // Manual Tags
  tags: {
    topicType: string;
    hookType: string;
    contentStructure: string;
    productionStyle: string;
    audienceIntent: string;
    difficulty: string;
    evergreenPotential: 'High' | 'Medium' | 'Low';
    revenuePotential: 'High' | 'Medium' | 'Low';
    subscriberPotential: 'High' | 'Medium' | 'Low';
    repeatability: 'High' | 'Medium' | 'Low';
  };

  // Derived Performance Metrics
  metrics?: {
    views1h?: number;
    views3h?: number;
    views6h?: number;
    views12h?: number;
    views24h?: number;
    views48h?: number;
    views7d?: number;
    views28d?: number;
    lifetimeViews?: number;
    viewVelocity?: number;
    watchTimeHours?: number;
    averageViewDurationSeconds?: number;
    averagePercentageViewed?: number;
    retentionQuality?: 'High' | 'Medium' | 'Low';
    ctr?: number;
    ctrByTrafficSource?: Record<string, number>;
    subscribersGainedPer1kViews?: number;
    likesPer1kViews?: number;
    commentsPer1kViews?: number;
    sharesPer1kViews?: number;
    revenuePer1kViews?: number;
    revenuePerProductionHour?: number;
    viewsPerProductionHour?: number;
    subscribersPerProductionHour?: number;
    evergreenScore?: number;
    topicRepeatScore?: number;
    formatEfficiencyScore?: number;
    videoHealthScore?: number;
    
    // Platform-specific scoring criteria
    swipeResistance?: number; // % (Shorts only)
    rewatchPotential?: 'High' | 'Medium' | 'Low'; // (Shorts only)
    watchTimePerImpression?: number; // (Long only)
    endScreenPerformance?: number; // % (Long only)
    memberValueScore?: number; // 0-100 (Members only)
    completionRate?: number; // %
  };
}

export interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  startDate: string;
  endDate: string;
  videosIncluded: string[]; // Video IDs
  metricBeingTested: string;
  result?: string;
  decision?: string;
  learning?: string;
  status: 'active' | 'completed';
}

export interface CreatorInsight {
  id: string;
  title: string;
  description: string;
  type: 'success' | 'warning' | 'info' | 'recommendation';
  channel: 'LearnDriven' | 'DecodeWorthy' | 'All';
  reason: string;
  actionLabel?: string;
}

export interface ScorecardParams {
  restfulness: number | null;
  nutrition: number | null;
  hydration: number | null;
  physicalActivity: number | null;
  endorphins: number | null;
  schedule: number | null;
  pleasantness: number | null;
  socialization: number | null;
  stomach: number | null;
  technicalities: number | null;
  relations: number | null;
  stress: number | null;
}

export interface ScorecardHistoryEntry {
  id: string;
  timestamp: string;
  parameter: string;
  oldVal: string;
  newVal: string;
  scoreEffect: number;
  description: string;
}

export interface ScorecardDayEntry extends ScorecardParams {
  date: string; // YYYY-MM-DD, local calendar day, zero-padded
  history: ScorecardHistoryEntry[];
}

export interface ScorecardState {
  today: ScorecardDayEntry;
  archive: ScorecardDayEntry[]; // past days only, ascending by date, capped at 90
}

export interface AiRulePreset {
  id: string;
  name: string;
  instruction: string;
  createdAt: string;
}

export interface AiUsageCall {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD: number;
  timestamp: string;
}

export interface AiUsageStats {
  budgetUSD: number | null;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUSD: number;
  callCount: number;
  lastCall: AiUsageCall | null;
  cycleStartedAt: string;
}

export interface YoutubeRevenueData {
  connected: boolean;
  channelTitle?: string;
  revenue?: number;
  currency?: string;
  subscribersNetGained?: number;
  subscriberCount?: number;
  periodStart?: string;
  periodEnd?: string;
  fetchedAt?: string;
}

export interface MonthForecast {
  expectedViews: number;
  expectedSubscribers: number;
  expectedRevenueINR: number;
  expectedUploadsCompleted: number;
  requiredUploads: number;
  riskOfMissingConsistency: 'Low' | 'Medium' | 'High';
}
export type TaskTimerStage = 'script' | 'shoot' | 'edit' | 'schedule' | 'post';

export interface TaskTimerRecord {
  id: string;
  topicId: string;
  topicName: string;         // snapshot at start time
  stage: TaskTimerStage;
  status: 'running' | 'paused' | 'completed' | 'abandoned';
  startedAt: string;
  completedAt?: string;
  activeSince: string | null;  // null when paused
  pausedAt: string | null;
  accumulatedActiveMs: number;
  accumulatedPausedMs: number;
  breaksCount: number;
  /** 1-10 self-rated productivity score. 1 = 10%, 10 = 100% productive. */
  productivityScore?: number;
  /** 'done' = task stage fully finished, 'deferred' = stopping to resume later */
  endReason?: 'done' | 'deferred';
  pauseSource?: 'manual' | 'day';
  workdaySessionId?: string;
  dateKey: string;             // YYYY-MM-DD for archival scoping
}

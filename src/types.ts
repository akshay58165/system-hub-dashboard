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
  dueDate: string | null;
  createdDate: string;
  lastUpdated: string;
  revenueLevel?: string;
  inProgress?: boolean;
  scheduledTime?: string;
  postedAt?: string;
  autoPostPaused?: boolean;
  format?: 'Short' | 'Long' | 'Members';
  category?: string;
  isDemo?: boolean;
  workflowStatuses?: Partial<Record<'script' | 'shoot' | 'edit' | 'schedule' | 'post', 'pending' | 'in-progress' | 'completed'>>;
}

export interface TopicActivity {
  id: string;
  topicName: string;
  channel: 'LearnDriven' | 'DecodeWorthy';
  action: string;
  author: string;
  timestamp: string;
}

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

export interface MonthForecast {
  expectedViews: number;
  expectedSubscribers: number;
  expectedRevenueINR: number;
  expectedUploadsCompleted: number;
  requiredUploads: number;
  riskOfMissingConsistency: 'Low' | 'Medium' | 'High';
}

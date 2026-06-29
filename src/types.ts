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

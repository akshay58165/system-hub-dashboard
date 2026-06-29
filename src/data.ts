import { GitHubRepo, VercelProject, SupabaseProject, SystemEvent, SupabaseTable } from './types';

export const initialSystemEvents: SystemEvent[] = [
  {
    id: 'evt-1',
    source: 'github',
    type: 'success',
    message: 'GitHub Actions: Workflow "Production Deploy" completed successfully',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15m ago
  },
  {
    id: 'evt-2',
    source: 'vercel',
    type: 'success',
    message: 'Vercel Deployment main-app-prod.vercel.app is now LIVE',
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(), // 14m ago
  },
  {
    id: 'evt-3',
    source: 'supabase',
    type: 'info',
    message: 'Supabase Database optimization: Auto-vacuum finished on "profiles" table',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'evt-4',
    source: 'github',
    type: 'info',
    message: 'New Pull Request #42 opened: "feature/stripe-billing" by alex-dev',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'evt-5',
    source: 'vercel',
    type: 'warning',
    message: 'Vercel Serverless Function /api/checkout exceeded 1.5s average response time',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: 'evt-6',
    source: 'supabase',
    type: 'error',
    message: 'Supabase API: Rate limit warning triggered for client IP 185.220.101.4',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
];

export const initialGitHubRepos: GitHubRepo[] = [
  {
    id: 'repo-1',
    name: 'main-app',
    description: 'Next.js core web applet containing dashboard, payments, and AI integrations.',
    stars: 128,
    forks: 24,
    openIssues: 12,
    branches: ['main', 'dev', 'feature/stripe-billing', 'fix/auth-leak'],
    currentBranch: 'main',
    pullRequests: [
      {
        id: 'pr-1',
        title: 'feat: Integrate stripe billing hooks and customer portals',
        number: 42,
        author: 'alex-dev',
        status: 'open',
        createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        branch: 'feature/stripe-billing',
      },
      {
        id: 'pr-2',
        title: 'fix: patch jwt token leakage in local storage fallback',
        number: 41,
        author: 'sarah-ops',
        status: 'merged',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        branch: 'fix/auth-leak',
      },
    ],
    workflows: [
      {
        id: 'wf-1',
        name: 'Production Deploy',
        status: 'success',
        lastRun: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        duration: '1m 45s',
        commitHash: 'a5c3e92',
        logs: [
          'Checking out repository commit a5c3e92',
          'Setting up Node.js v20.x',
          'Installing project dependencies via npm',
          'Running linters & security auditing',
          'Compiling next.js assets in optimized chunks',
          'Workflow completed successfully. Triggered Vercel buildhook webhook_id: 9d10a2.',
        ],
      },
      {
        id: 'wf-2',
        name: 'Linter & Test Suite',
        status: 'success',
        lastRun: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        duration: '42s',
        commitHash: 'f0c1a32',
        logs: [
          'Setting up Node.js environment...',
          'npm ci run successfully',
          'Running: npm run lint... Passed!',
          'Running: npm run test... 18/18 test files executed successfully.',
        ],
      },
    ],
    commits: [
      {
        id: 'c-1',
        message: 'Merge pull request #41 from fix/auth-leak',
        author: 'sarah-ops',
        date: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        hash: 'a5c3e92',
      },
      {
        id: 'c-2',
        message: 'fix: secure localStorage credentials via cookie session verification',
        author: 'sarah-ops',
        date: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        hash: 'f0c1a32',
      },
      {
        id: 'c-3',
        message: 'feat: add UI skeletons for workspace file explorer view',
        author: 'tony-design',
        date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        hash: '8f7d9a1',
      },
    ],
  },
  {
    id: 'repo-2',
    name: 'supabase-edge-funcs',
    description: 'Deno-based Supabase Edge Functions for handling webhook signatures and emails.',
    stars: 34,
    forks: 8,
    openIssues: 3,
    branches: ['main', 'refactor/deno-imports'],
    currentBranch: 'main',
    pullRequests: [],
    workflows: [
      {
        id: 'wf-3',
        name: 'Deploy Edge Functions',
        status: 'success',
        lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        duration: '55s',
        commitHash: 'd3f4a12',
        logs: [
          'Authenticating with Supabase CLI...',
          'Bundling function /stripe-webhooks...',
          'Bundling function /welcome-email...',
          'Uploading bundles to Supabase projects container in us-east-1...',
          'Functions live!',
        ],
      },
    ],
    commits: [
      {
        id: 'c-4',
        message: 'refactor: simplify stripe charge handlers using modern Deno SDK',
        author: 'alex-dev',
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
        hash: 'd3f4a12',
      },
    ],
  },
  {
    id: 'repo-3',
    name: 'marketing-site',
    description: 'Highly interactive landing page and promotional assets built using Astro & Tailwind.',
    stars: 56,
    forks: 4,
    openIssues: 1,
    branches: ['main', 'design/dark-mode'],
    currentBranch: 'main',
    pullRequests: [
      {
        id: 'pr-3',
        title: 'design: optimize animations and set system-level dark mode toggle',
        number: 14,
        author: 'tony-design',
        status: 'open',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        branch: 'design/dark-mode',
      },
    ],
    workflows: [
      {
        id: 'wf-4',
        name: 'Astro Build & Test',
        status: 'success',
        lastRun: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        duration: '1m 12s',
        commitHash: '7b2c9d1',
        logs: [
          'Checking environment variables...',
          'Astro project verified. Run build command.',
          'Static pages compiled: 14 HTML files, 3 assets files.',
          'Integrity check complete.',
        ],
      },
    ],
    commits: [
      {
        id: 'c-5',
        message: 'design: add interactive pricing sliders with billing cycle toggles',
        author: 'tony-design',
        date: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        hash: '7b2c9d1',
      },
    ],
  },
];

export const initialVercelProjects: VercelProject[] = [
  {
    id: 'vprj-1',
    name: 'main-app',
    framework: 'Next.js',
    status: 'ready',
    domain: 'main-app-prod.vercel.app',
    gitBranch: 'main',
    updatedAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    deployments: [
      {
        id: 'vdep-1',
        url: 'main-app-hq89df.vercel.app',
        branch: 'main',
        commitMessage: 'Merge pull request #41 from fix/auth-leak',
        status: 'ready',
        createdAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
        creator: 'sarah-ops',
        duration: '1m 20s',
        logs: [
          'Cloning repository main-app...',
          'Detected Next.js project. Overriding default build commands.',
          'Running "npm run build"...',
          'Creating optimized client bundles...',
          'Creating serverless functions endpoints...',
          'Deploying to Vercel edge networks in 18 regions worldwide...',
          'Deployment active!',
        ],
      },
      {
        id: 'vdep-2',
        url: 'main-app-git-stripe-billing.vercel.app',
        branch: 'feature/stripe-billing',
        commitMessage: 'feat: Integrate stripe billing hooks and customer portals',
        status: 'ready',
        createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
        creator: 'alex-dev',
        duration: '1m 35s',
        logs: [
          'Cloning repository main-app (branch: feature/stripe-billing)...',
          'Executing build tasks...',
          'Vercel edge preview ready at main-app-git-stripe-billing.vercel.app.',
        ],
      },
    ],
    analytics: {
      webVitals: {
        lcp: 1200,
        fid: 45,
        cls: 0.04,
      },
      traffic: [
        { date: 'Jun 23', views: 2400, visitors: 1100 },
        { date: 'Jun 24', views: 2800, visitors: 1300 },
        { date: 'Jun 25', views: 3200, visitors: 1550 },
        { date: 'Jun 26', views: 4100, visitors: 1900 },
        { date: 'Jun 27', views: 3900, visitors: 1800 },
        { date: 'Jun 28', views: 5200, visitors: 2400 },
        { date: 'Jun 29', views: 6100, visitors: 2900 },
      ],
      latency: [
        { date: 'Jun 23', avgMs: 142 },
        { date: 'Jun 24', avgMs: 138 },
        { date: 'Jun 25', avgMs: 145 },
        { date: 'Jun 26', avgMs: 160 },
        { date: 'Jun 27', avgMs: 130 },
        { date: 'Jun 28', avgMs: 122 },
        { date: 'Jun 29', avgMs: 115 },
      ],
    },
    serverlessFunctions: [
      { id: 'func-1', path: '/api/auth/session', invocations: 45200, errors: 4, avgDurationMs: 85 },
      { id: 'func-2', path: '/api/checkout', invocations: 12800, errors: 14, avgDurationMs: 380 },
      { id: 'func-3', path: '/api/ai/suggest', invocations: 8900, errors: 52, avgDurationMs: 980 },
    ],
  },
  {
    id: 'vprj-2',
    name: 'marketing-site',
    framework: 'Astro',
    status: 'ready',
    domain: 'marketing-site-prod.vercel.app',
    gitBranch: 'main',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    deployments: [
      {
        id: 'vdep-3',
        url: 'marketing-site-9f82d.vercel.app',
        branch: 'main',
        commitMessage: 'design: add interactive pricing sliders with billing cycle toggles',
        status: 'ready',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        creator: 'tony-design',
        duration: '48s',
        logs: [
          'Cloning repository marketing-site...',
          'Astro building SSG assets...',
          'Static output completed. Hosting index files on Vercel CDN.',
          'Site deployed successfully!',
        ],
      },
    ],
    analytics: {
      webVitals: {
        lcp: 850,
        fid: 12,
        cls: 0.01,
      },
      traffic: [
        { date: 'Jun 23', views: 8900, visitors: 4500 },
        { date: 'Jun 24', views: 9500, visitors: 4800 },
        { date: 'Jun 25', views: 10200, visitors: 5100 },
        { date: 'Jun 26', views: 12400, visitors: 6200 },
        { date: 'Jun 27', views: 11000, visitors: 5600 },
        { date: 'Jun 28', views: 14500, visitors: 7300 },
        { date: 'Jun 29', views: 15900, visitors: 8100 },
      ],
      latency: [
        { date: 'Jun 23', avgMs: 42 },
        { date: 'Jun 24', avgMs: 40 },
        { date: 'Jun 25', avgMs: 45 },
        { date: 'Jun 26', avgMs: 38 },
        { date: 'Jun 27', avgMs: 41 },
        { date: 'Jun 28', avgMs: 35 },
        { date: 'Jun 29', avgMs: 34 },
      ],
    },
    serverlessFunctions: [],
  },
];

export const initialSupabaseProject: SupabaseProject = {
  id: 'sub-proj-1',
  name: 'prod-cluster-east',
  status: 'active',
  region: 'us-east-1 (N. Virginia)',
  dbVersion: 'PostgreSQL 15.6 (Supabase)',
  tables: [
    {
      name: 'profiles',
      rowCount: 4520,
      columns: [
        { name: 'id', type: 'uuid', isNullable: false },
        { name: 'email', type: 'text', isNullable: false },
        { name: 'full_name', type: 'text', isNullable: true },
        { name: 'avatar_url', type: 'text', isNullable: true },
        { name: 'subscription_tier', type: 'text', isNullable: false },
        { name: 'created_at', type: 'timestamp', isNullable: false },
      ],
      rows: [
        { id: '1b89df8e-73a2-4db1-9fa8-1f19f2a08d01', email: 'typeakshay@gmail.com', full_name: 'Akshay Kumar', avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80', subscription_tier: 'Pro Enterprise', created_at: '2026-01-15T08:30:00Z' },
        { id: '3f5da12a-39fa-456d-8fb2-c12e9b101c02', email: 'alex.smith@github.com', full_name: 'Alex Smith', avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=80&h=80', subscription_tier: 'Pro', created_at: '2026-03-22T14:15:30Z' },
        { id: '9a8d7c6b-5e4f-3d2c-1b0a-9f8e7d6c5b4a', email: 'sarah.jones@ops.net', full_name: 'Sarah Jones', avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&h=80', subscription_tier: 'Enterprise', created_at: '2026-05-10T11:05:00Z' },
        { id: 'ef9b8a7d-6c5b-4a3d-2e1f-0d9c8b7a6e5f', email: 'tony.stark@stark.com', full_name: 'Tony Stark', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&h=80', subscription_tier: 'Free', created_at: '2026-06-25T18:22:11Z' },
      ],
    },
    {
      name: 'posts',
      rowCount: 1280,
      columns: [
        { name: 'id', type: 'bigint', isNullable: false },
        { name: 'title', type: 'text', isNullable: false },
        { name: 'slug', type: 'text', isNullable: false },
        { name: 'content', type: 'text', isNullable: true },
        { name: 'author_id', type: 'uuid', isNullable: false },
        { name: 'published', type: 'boolean', isNullable: false },
        { name: 'published_at', type: 'timestamp', isNullable: true },
      ],
      rows: [
        { id: 1, title: 'Integrating Github, Vercel & Supabase like a Pro', slug: 'integrating-github-vercel-supabase', content: 'A complete masterclass on building highly productive full-stack software dashboards using modern serverless telemetry.', author_id: '1b89df8e-73a2-4db1-9fa8-1f19f2a08d01', published: true, published_at: '2026-06-28T09:00:00Z' },
        { id: 2, title: 'Securing Edge Function secrets on the Cloud', slug: 'securing-edge-secrets', content: 'Avoid credentials leak by using environment bindings instead of committing hardcoded token strings in your codebase.', author_id: '3f5da12a-39fa-456d-8fb2-c12e9b101c02', published: true, published_at: '2026-06-26T15:30:00Z' },
        { id: 3, title: 'Designing beautiful telemetry interfaces', slug: 'beautiful-telemetry-interfaces', content: 'Minimalist UX design patterns that help developers understand system status at a single visual glance.', author_id: '1b89df8e-73a2-4db1-9fa8-1f19f2a08d01', published: false, published_at: null },
      ],
    },
    {
      name: 'transactions',
      rowCount: 840,
      columns: [
        { name: 'id', type: 'text', isNullable: false },
        { name: 'user_id', type: 'uuid', isNullable: false },
        { name: 'amount', type: 'numeric', isNullable: false },
        { name: 'currency', type: 'text', isNullable: false },
        { name: 'status', type: 'text', isNullable: false },
        { name: 'created_at', type: 'timestamp', isNullable: false },
      ],
      rows: [
        { id: 'txn_9d1a3b8', user_id: '1b89df8e-73a2-4db1-9fa8-1f19f2a08d01', amount: 149.00, currency: 'USD', status: 'succeeded', created_at: '2026-06-29T02:30:11Z' },
        { id: 'txn_3f2c5e1', user_id: '3f5da12a-39fa-456d-8fb2-c12e9b101c02', amount: 29.00, currency: 'USD', status: 'succeeded', created_at: '2026-06-28T19:40:00Z' },
        { id: 'txn_8c1b2f4', user_id: '9a8d7c6b-5e4f-3d2c-1b0a-9f8e7d6c5b4a', amount: 399.00, currency: 'USD', status: 'succeeded', created_at: '2026-06-27T10:15:22Z' },
        { id: 'txn_2e4a8b1', user_id: 'ef9b8a7d-6c5b-4a3d-2e1f-0d9c8b7a6e5f', amount: 0.00, currency: 'USD', status: 'failed', created_at: '2026-06-26T08:12:05Z' },
      ],
    },
  ],
  authUsers: [
    { id: 'usr-1', email: 'typeakshay@gmail.com', provider: 'github', lastSignIn: '2026-06-29T04:12:00Z', createdAt: '2026-01-15T08:30:00Z', status: 'active' },
    { id: 'usr-2', email: 'alex.smith@github.com', provider: 'github', lastSignIn: '2026-06-28T14:15:30Z', createdAt: '2026-03-22T14:15:30Z', status: 'active' },
    { id: 'usr-3', email: 'sarah.jones@ops.net', provider: 'google', lastSignIn: '2026-06-29T01:05:00Z', createdAt: '2026-05-10T11:05:00Z', status: 'active' },
    { id: 'usr-4', email: 'tony.stark@stark.com', provider: 'github', lastSignIn: '2026-06-25T18:22:11Z', createdAt: '2026-06-25T18:22:11Z', status: 'active' },
  ],
  apiLogs: [
    { id: 'log-1', method: 'GET', path: '/rest/v1/profiles?select=*', status: 200, latencyMs: 14, timestamp: new Date(Date.now() - 1000 * 5).toISOString() },
    { id: 'log-2', method: 'POST', path: '/rest/v1/transactions', status: 201, latencyMs: 38, timestamp: new Date(Date.now() - 1000 * 24).toISOString() },
    { id: 'log-3', method: 'GET', path: '/rest/v1/posts?published=eq.true', status: 200, latencyMs: 8, timestamp: new Date(Date.now() - 1000 * 45).toISOString() },
    { id: 'log-4', method: 'POST', path: '/auth/v1/token?grant_type=password', status: 200, latencyMs: 112, timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString() },
    { id: 'log-5', method: 'GET', path: '/rest/v1/profiles?id=eq.1b89df8e-73a2-4db1-9fa8-1f19f2a08d01', status: 200, latencyMs: 11, timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  ],
  metrics: {
    dbSize: '142.8 MB',
    activeConnections: 18,
    cpuUsage: 14,
    memoryUsage: 38,
  },
};

// SQL parser simulation for the interactive database interface!
export function runSqlSimulation(sql: string, tables: SupabaseTable[]): { success: boolean; message: string; rows?: Record<string, any>[]; columns?: string[] } {
  const cleanSql = sql.trim().replace(/;$/, '').toLowerCase();
  
  if (cleanSql.startsWith('select')) {
    // Find table name
    const match = sql.match(/from\s+([a-zA-Z0-9_]+)/i);
    if (!match) {
      return { success: false, message: 'SQL Error: Syntax error or unsupported SELECT. Provide "FROM <table_name>".' };
    }
    const tableName = match[1].toLowerCase();
    const table = tables.find(t => t.name.toLowerCase() === tableName);
    if (!table) {
      return { success: false, message: `SQL Error: relation "${tableName}" does not exist` };
    }
    
    // Simulate selection
    let resultRows = [...table.rows];
    
    // check WHERE
    const whereMatch = sql.match(/where\s+(.+)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].toLowerCase();
      if (whereClause.includes('email')) {
        const emailMatch = whereClause.match(/email\s*=\s*['"](.+)['"]/i);
        if (emailMatch) {
          const email = emailMatch[1];
          resultRows = resultRows.filter(r => r.email && r.email.toLowerCase() === email.toLowerCase());
        }
      } else if (whereClause.includes('published')) {
        if (whereClause.includes('true')) {
          resultRows = resultRows.filter(r => r.published === true);
        } else if (whereClause.includes('false')) {
          resultRows = resultRows.filter(r => r.published === false);
        }
      } else if (whereClause.includes('status')) {
        const statusMatch = whereClause.match(/status\s*=\s*['"](.+)['"]/i);
        if (statusMatch) {
          const status = statusMatch[1];
          resultRows = resultRows.filter(r => r.status && r.status.toLowerCase() === status.toLowerCase());
        }
      }
    }
    
    const columns = table.columns.map(c => c.name);
    return {
      success: true,
      message: `Success: SELECT returned ${resultRows.length} rows from "${table.name}".`,
      rows: resultRows,
      columns,
    };
  }
  
  if (cleanSql.startsWith('insert')) {
    const match = sql.match(/into\s+([a-zA-Z0-9_]+)/i);
    if (!match) {
      return { success: false, message: 'SQL Error: Syntax error in INSERT statement.' };
    }
    const tableName = match[1].toLowerCase();
    const table = tables.find(t => t.name.toLowerCase() === tableName);
    if (!table) {
      return { success: false, message: `SQL Error: relation "${tableName}" does not exist` };
    }
    
    return {
      success: true,
      message: `Row simulated successfully! Hint: Use the Table Editor GUI to write persistent rows, or execute 'SELECT * FROM ${table.name}' to see current items.`,
    };
  }
  
  return {
    success: false,
    message: 'SQL execution error: Only SELECT statements (e.g. "SELECT * FROM profiles") are fully visualisable in this environment console. Please use SELECT queries or the interactive Table Editor GUI below.',
  };
}

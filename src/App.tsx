import React, { useState, useEffect } from 'react';
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
  Lock
} from 'lucide-react';

import { GitHubRepo, VercelProject, SupabaseProject, SystemEvent, Topic, TopicActivity } from './types';
import { 
  initialGitHubRepos, 
  initialVercelProjects, 
  initialSupabaseProject, 
  initialSystemEvents,
  initialTopics,
  initialActivities
} from './data';

import Overview from './components/Overview';
import GithubView from './components/GithubView';
import VercelView from './components/VercelView';
import SupabaseView from './components/SupabaseView';
import LogsView from './components/LogsView';
import ScoreView from './components/ScoreView';
import CommandPalette from './components/CommandPalette';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'topics' | 'progress' | 'actionhub' | 'logs' | 'score'>('overview');
  const [repos, setRepos] = useState<GitHubRepo[]>(initialGitHubRepos);
  const [vercelProjects, setVercelProjects] = useState<VercelProject[]>(initialVercelProjects);
  const [supabase, setSupabase] = useState<SupabaseProject>(initialSupabaseProject);
  const [events, setEvents] = useState<SystemEvent[]>(initialSystemEvents);
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [activities, setActivities] = useState<TopicActivity[]>(initialActivities);
  
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [timeStr, setTimeStr] = useState('');
  const [lastDbUpdateTime, setLastDbUpdateTime] = useState<Date>(new Date(Date.now() - 5000));

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
        } else if (percent >= 60 && percent < 85) {
          setActivities([]);
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

  // Simulate real-time background events (e.g. background database actions, commits, deployments)
  useEffect(() => {
    const interval = setInterval(() => {
      // Pick a random event type
      const eventTypes = ['api', 'metrics', 'commit'] as const;
      const chosenType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

      if (chosenType === 'api') {
        // Generate new API log in Supabase
        const apiPaths = [
          '/rest/v1/posts?select=*',
          '/rest/v1/transactions?id=eq.txn_9d1a3b8',
          '/auth/v1/user',
          '/rest/v1/profiles?subscription_tier=eq.Pro'
        ];
        const randomPath = apiPaths[Math.floor(Math.random() * apiPaths.length)];
        const randomMethod = randomPath.includes('auth') || randomPath.includes('transactions') ? 'POST' : 'GET';
        const randomStatus = Math.random() > 0.05 ? 200 : 401;
        const latency = Math.floor(Math.random() * 80) + 8;

        const newLog = {
          id: `log-${Date.now()}`,
          method: randomMethod as 'GET' | 'POST',
          path: randomPath,
          status: randomStatus,
          latencyMs: latency,
          timestamp: new Date().toISOString()
        };

        setSupabase(prev => ({
          ...prev,
          apiLogs: [newLog, ...prev.apiLogs.slice(0, 15)],
          metrics: {
            ...prev.metrics,
            activeConnections: Math.max(10, Math.min(40, prev.metrics.activeConnections + (Math.random() > 0.5 ? 1 : -1)))
          }
        }));

        if (randomStatus === 401) {
          addEvent({
            id: `evt-bg-err-${Date.now()}`,
            source: 'supabase',
            type: 'warning',
            message: `Supabase API: Unauthorized request blocked on ${randomPath}`,
            timestamp: new Date().toISOString()
          });
        }
      } else if (chosenType === 'metrics') {
        // Slightly fluctuate hardware metrics
        setSupabase(prev => ({
          ...prev,
          metrics: {
            ...prev.metrics,
            cpuUsage: Math.max(5, Math.min(90, prev.metrics.cpuUsage + Math.floor(Math.random() * 6) - 3)),
            memoryUsage: Math.max(25, Math.min(80, prev.metrics.memoryUsage + Math.floor(Math.random() * 4) - 2))
          }
        }));
      } else if (chosenType === 'commit') {
        // Simulate minor commit in background on main-app repo
        const commitMessages = [
          'chore: improve tailwind utility class loading',
          'docs: update supabase migration guidelines in README.md',
          'refactor: optimize edge function payload sanitizers',
          'style: adjust dialog borders to clean charcoal colors'
        ];
        const message = commitMessages[Math.floor(Math.random() * commitMessages.length)];
        const hash = Math.random().toString(16).substring(2, 9);
        const authors = ['alex-dev', 'tony-design', 'sarah-ops'];
        const author = authors[Math.floor(Math.random() * authors.length)];

        const newCommit = {
          id: `c-bg-${Date.now()}`,
          message,
          author,
          date: new Date().toISOString(),
          hash
        };

        setRepos(prev => prev.map(r => {
          if (r.name === 'main-app') {
            return {
              ...r,
              commits: [newCommit, ...r.commits.slice(0, 15)]
            };
          }
          return r;
        }));

        addEvent({
          id: `evt-bg-cmt-${Date.now()}`,
          source: 'github',
          type: 'info',
          message: `GitHub: ${author} pushed commit "${message}" to main-app (${hash})`,
          timestamp: new Date().toISOString()
        });
      }

    }, 20000); // Trigger every 20 seconds

    return () => clearInterval(interval);
  }, []);

  const addEvent = (evt: SystemEvent) => {
    setEvents(prev => [evt, ...prev.slice(0, 29)]);
    setLastDbUpdateTime(new Date());
  };

  const handleUpdateRepo = (repoId: string, updatedRepo: Partial<GitHubRepo>) => {
    setRepos(prev => prev.map(r => r.id === repoId ? { ...r, ...updatedRepo } : r));
    setLastDbUpdateTime(new Date());
  };

  const handleUpdateProject = (projectId: string, updatedProject: Partial<VercelProject>) => {
    setVercelProjects(prev => prev.map(p => p.id === projectId ? { ...p, ...updatedProject } : p));
    setLastDbUpdateTime(new Date());
  };

  const handleUpdateSupabase = (updated: Partial<SupabaseProject>) => {
    setSupabase(prev => ({ ...prev, ...updated }));
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
    <div className="min-h-screen bg-neutral-950 text-neutral-200 antialiased font-sans">
      
      {/* Top Main Header */}
      <header className="bg-neutral-950 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center">
              <span className="p-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-emerald-400 font-bold tracking-tight text-xs font-mono">
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
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>All Cloud Systems Nominal</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Tab Controller Bar */}
      <nav className="border-b border-neutral-900 bg-neutral-950/60 backdrop-blur-md sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 py-2 overflow-x-auto">
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'overview'
                    ? 'bg-neutral-900 border border-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Overview</span>
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
                <span>Topic Repos</span>
              </button>

              <button
                onClick={() => setActiveTab('progress')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-1.5 ${
                  activeTab === 'progress'
                    ? 'bg-neutral-900 border border-neutral-850 text-amber-400'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Progress</span>
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
                <span>Score</span>
              </button>
            </div>

            <div className="flex items-center gap-1 font-mono text-[10px] text-neutral-500 shrink-0">
              <span className="hidden sm:inline">User email:</span>
              <span className="px-2 py-0.5 bg-neutral-900 border border-neutral-850 text-neutral-300 rounded">
                typeakshay@gmail.com
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Primary Application Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'overview' && (
              <Overview 
                repos={repos} 
                vercelProjects={vercelProjects} 
                supabase={supabase} 
                events={events}
                onTabChange={setActiveTab}
                topics={topics}
                activities={activities}
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
              />
            )}

            {activeTab === 'progress' && (
              <VercelView 
                projects={vercelProjects} 
                onAddEvent={addEvent} 
                onUpdateProject={handleUpdateProject}
                topics={topics}
                activities={activities}
              />
            )}

            {activeTab === 'actionhub' && (
              <SupabaseView 
                supabase={supabase} 
                onAddEvent={addEvent} 
                onUpdateSupabase={handleUpdateSupabase}
                topics={topics}
                setTopics={setTopics}
                activities={activities}
                setActivities={setActivities}
              />
            )}

            {activeTab === 'logs' && (
              <LogsView 
                events={events} 
                onClearEvents={() => setEvents([])}
              />
            )}

            {activeTab === 'score' && (
              <ScoreView 
                repos={repos} 
                vercelProjects={vercelProjects} 
                supabase={supabase} 
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Command Palette Modal */}
      <CommandPalette 
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        repos={repos}
        vercelProjects={vercelProjects}
        supabase={supabase}
        onTabChange={setActiveTab}
        onTriggerDeploy={triggerVercelDeploy}
      />

      {/* Footer */}
      <footer className="border-t border-neutral-900/60 bg-neutral-950 py-8 mt-12 font-mono text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Laptop className="h-4 w-4" />
            <span>Unicorn's Desk Panel — Cloud Sync Integration Active</span>
          </div>
          <div className="flex items-center gap-4">
            <span>DB Space: 8.2%</span>
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

    </div>
  );
}

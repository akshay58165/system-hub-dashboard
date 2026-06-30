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
  Lock,
  Plus,
  LogIn,
  LogOut,
  User as UserIcon,
  AlertCircle
} from 'lucide-react';
import { supabase } from './services/supabase';

import { GitHubRepo, VercelProject, SupabaseProject, SystemEvent, Topic, TopicActivity, CycleGoal } from './types';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'topics' | 'progress' | 'actionhub' | 'logs' | 'score'>(() => {
    return (localStorage.getItem('unicorn_active_tab') as any) || 'overview';
  });

  const [cycleGoals, setCycleGoals] = useState<CycleGoal | null>(null);

  const [scorecard, setScorecard] = useState<any>(() => {
    const today = new Date();
    const currentDateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    return {
      restfulness: null,
      nutrition: null,
      hydration: null,
      physicalActivity: null,
      endorphins: null,
      schedule: null,
      pleasantness: null,
      socialization: null,
      stomach: null,
      technicalities: null,
      relations: null,
      stress: null,
      history: [
        {
          id: 'init',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          parameter: 'System',
          oldVal: 'None',
          newVal: 'Initialized',
          scoreEffect: 0,
          description: 'Daily Readiness Scorecard initialized with baseline levels.'
        }
      ],
      date: currentDateStr
    };
  });
  const [repos, setRepos] = useState<GitHubRepo[]>(initialGitHubRepos);
  const [vercelProjects, setVercelProjects] = useState<VercelProject[]>(initialVercelProjects);
  const [supabase, setSupabase] = useState<SupabaseProject>(initialSupabaseProject);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [activities, setActivities] = useState<TopicActivity[]>(initialActivities);
  
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [timeStr, setTimeStr] = useState('');
  const [lastDbUpdateTime, setLastDbUpdateTime] = useState<Date>(new Date(Date.now() - 5000));
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);

  // Supabase Auth and Real-time Gateway States
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

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
          localStorage.setItem('unicorn_database_reset', 'true');
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
          // 2. Perform auto-login for creators
          const email = "creator-sync@dashboard.com";
          const password = "creatorpassword123!";
          
          console.log("Supabase Auto-Auth: Logging in to creator sync gateway...");
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
          });
          
          if (signInError) {
            console.log("Supabase Auto-Auth: Account not found or login failed. Registering sync node...");
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email,
              password
            });
            
            if (signUpError) {
              console.error("Supabase Auto-Auth: Registration failed:", signUpError.message);
              setSyncError(`Supabase connection failed. Login error: "${signInError.message}". Signup error: "${signUpError.message}". Check email confirmation settings in Supabase Auth.`);
              setAuthLoading(false);
              setIsStateLoaded(true); // Let app render in local-mode
            } else if (signUpData?.user) {
              setUser(signUpData.user);
              setAuthLoading(false);
            }
          } else if (signInData?.user) {
            setUser(signInData.user);
            setAuthLoading(false);
          }
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
      if (!user) {
        setIsStateLoaded(true);
      }
      return;
    }

    let channel: any = null;

    const fetchAndSubscribe = async () => {
      try {
        setSyncError(null);
        const { data, error } = await supabase
          .from('dashboard_state')
          .select('state')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching state from Supabase:", error.message);
          if (error.message.includes('relation "public.dashboard_state" does not exist') || error.code === 'P0001') {
            setSyncError("Supabase error: Table 'public.dashboard_state' does not exist. Please run SQL migrations in your Supabase dashboard.");
          } else {
            setSyncError(`Supabase connection error: ${error.message}`);
          }
          setIsStateLoaded(true); // Let client render local fallback
          return;
        }

        if (data && data.state) {
          const remoteState = data.state as any;
          if (remoteState.topics) setTopics(remoteState.topics);
          if (remoteState.activities) setActivities(remoteState.activities);
          if (remoteState.cycleGoals) setCycleGoals(remoteState.cycleGoals);
          if (remoteState.scorecard) setScorecard(remoteState.scorecard);

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
              scorecard
            },
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        }
        
        setIsStateLoaded(true); // Completed initial load

        // 3. Subscribe to Real-time database changes for this user
        channel = supabase.channel(`realtime:dashboard_state:${user.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'dashboard_state', filter: `user_id=eq.${user.id}` },
            (payload) => {
              const newState = payload.new as any;
              if (newState && newState.state) {
                const remoteState = newState.state as any;
                if (remoteState.topics) setTopics(remoteState.topics);
                if (remoteState.activities) setActivities(remoteState.activities);
                if (remoteState.cycleGoals) setCycleGoals(remoteState.cycleGoals);
                if (remoteState.scorecard) setScorecard(remoteState.scorecard);

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
      } catch (e: any) {
        console.error("Supabase sync initialization failed:", e);
        setSyncError(`Sync engine failure: ${e.message}`);
        setIsStateLoaded(true);
      }
    };

    fetchAndSubscribe();

    return () => {
      if (supabase && channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.error("Failed to remove channel:", e);
        }
      }
    };
  }, [user]);

  // 4. Save local state changes back to Supabase
  const saveStateToSupabase = async (newTopics: Topic[], newActs: TopicActivity[], newGoals: CycleGoal | null, newScorecard: any) => {
    if (!supabase || !user || syncError) return;
    try {
      const { error } = await supabase
        .from('dashboard_state')
        .upsert({
          user_id: user.id,
          state: {
            topics: newTopics,
            activities: newActs,
            cycleGoals: newGoals,
            scorecard: newScorecard
          },
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) {
        console.error("Error saving state to Supabase:", error.message);
        // Do not block local updates, but log warning
        if (error.message.includes('relation "public.dashboard_state" does not exist')) {
          setSyncError("Supabase error: Table 'public.dashboard_state' does not exist. Please run SQL migrations.");
        }
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!user || authLoading || !isStateLoaded) return;

    // Debounce updates to 800ms
    const timer = setTimeout(() => {
      saveStateToSupabase(topics, activities, cycleGoals, scorecard);
    }, 800);

    return () => clearTimeout(timer);
  }, [topics, activities, cycleGoals, scorecard, user, authLoading, isStateLoaded]);

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

      {/* Database Warning Banner */}
      {syncError && (
        <div className="bg-red-950/40 border-b border-red-900/60 px-4 py-2.5 text-center text-xs font-mono text-red-400 flex items-center justify-center gap-2 select-none">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500 animate-pulse" />
          <span>{syncError}</span>
        </div>
      )}
      
      {/* Top Main Header */}
      <header className="bg-neutral-950 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
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
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>All Cloud Systems Nominal</span>
            </div>

            {/* Supabase Sync Auth Control */}
            {authLoading ? (
              <div className="h-6 w-16 bg-neutral-900 border border-neutral-850 rounded-lg animate-pulse" />
            ) : user ? (
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
            ) : (
              <button
                onClick={() => {
                  setAuthError(null);
                  setIsAuthModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-950/45 hover:bg-blue-900/20 text-blue-400 border border-blue-900/40 hover:border-blue-500 rounded-lg transition text-[9px] font-bold cursor-pointer select-none font-mono"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Cloud Sync</span>
              </button>
            )}
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
                isAddFormOpen={isAddFormOpen}
                setIsAddFormOpen={setIsAddFormOpen}
                setActiveTab={setActiveTab}
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
                supabase={supabase} 
                onAddEvent={addEvent} 
                onUpdateSupabase={handleUpdateSupabase}
                topics={topics}
                setTopics={setTopics}
                activities={activities}
                setActivities={setActivities}
                cycleGoals={cycleGoals}
                setCycleGoals={setCycleGoals}
              />
            )}

            {activeTab === 'logs' && (
              <LogsView 
                events={events} 
                onClearEvents={() => { setEvents([]); localStorage.removeItem('unicorn_events'); }}
              />
            )}

            {activeTab === 'score' && (
              <ScoreView 
                repos={repos} 
                vercelProjects={vercelProjects} 
                supabase={supabase} 
                scorecard={scorecard}
                setScorecard={setScorecard}
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

      {/* Supabase Cloud Sync Gateway Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-950 border border-neutral-900 rounded-xl max-w-sm w-full p-6 shadow-[0_0_50px_rgba(59,130,246,0.07)] relative overflow-hidden font-mono"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center gap-2 mb-4 border-b border-neutral-900 pb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="text-[10px] uppercase font-bold text-blue-400 tracking-widest">
                  Cloud Sync Gateway
                </span>
              </div>

              <p className="text-[10px] text-neutral-400 leading-normal mb-4 font-sans">
                Sign in or register an account to sync your topics, scheduling details, and targets across phone and computer in real-time.
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
                      const { data, error } = await supabase.auth.signUp({
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
                        setIsAuthModalOpen(false);
                      }
                    } else {
                      const { data, error } = await supabase.auth.signInWithPassword({
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
                        setIsAuthModalOpen(false);
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

                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => setIsAuthModalOpen(false)}
                      className="px-2.5 py-1 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-4 py-1 bg-blue-950/40 hover:bg-blue-900/30 text-blue-400 border border-blue-900/30 rounded font-semibold transition cursor-pointer"
                    >
                      {isSignUpMode ? "Register" : "Sign In"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

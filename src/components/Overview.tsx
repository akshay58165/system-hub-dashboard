import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  GitBranch, 
  Layers, 
  Database, 
  Activity, 
  Cpu, 
  CheckCircle2, 
  ArrowUpRight, 
  AlertTriangle, 
  Clock, 
  Zap, 
  Users, 
  Server, 
  Wifi,
  Youtube
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  CartesianGrid 
} from 'recharts';
import { GitHubRepo, VercelProject, SupabaseProject, SystemEvent } from '../types';

interface OverviewProps {
  repos: GitHubRepo[];
  vercelProjects: VercelProject[];
  supabase: SupabaseProject;
  events: SystemEvent[];
  onTabChange: (tab: 'overview' | 'topics' | 'progress' | 'actionhub' | 'logs' | 'score') => void;
}

export default function Overview({ repos, vercelProjects, supabase, events, onTabChange }: OverviewProps) {
  // Compute some high-level metrics
  const totalStars = useMemo(() => repos.reduce((sum, r) => sum + r.stars, 0), [repos]);
  const totalIssues = useMemo(() => repos.reduce((sum, r) => sum + r.openIssues, 0), [repos]);
  
  const activeDeploymentsCount = useMemo(() => {
    return vercelProjects.filter(p => p.status === 'ready').length;
  }, [vercelProjects]);

  // YouTube Payment Cycle calculations
  const paymentMetrics = useMemo(() => {
    const today = new Date();
    
    const formatDays = (targetDate: Date) => {
      const t1 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const t2 = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const diff = t2.getTime() - t1.getTime();
      const days = Math.round(diff / (1000 * 60 * 60 * 24));
      if (days < 0) return 'Locked';
      if (days === 0) return 'Today';
      return `${days}d`;
    };

    // 1. Current Month Track (Green Card)
    const curMonthName = today.toLocaleString('default', { month: 'long' });
    // Lock: Last day of the current month
    const curLockDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    // Received: 25th of the following month
    const curPayoutDate = new Date(today.getFullYear(), today.getMonth() + 1, 25);

    // 2. Bottom Track
    // Check if the previous month's payout (dispatched on 25th of current month) is still pending
    const prevPayoutDate = new Date(today.getFullYear(), today.getMonth(), 25);
    const isPrevPayoutPending = today.getTime() <= prevPayoutDate.getTime();

    let bottomName = '';
    let bottomLockDays = '';
    let bottomPayDays = '';
    let bottomLabel = '';

    if (isPrevPayoutPending) {
      // Show Last Month's Cycle
      const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      bottomName = prevMonthDate.toLocaleString('default', { month: 'long' });
      bottomLabel = 'Last Month';
      
      const prevLockDate = new Date(today.getFullYear(), today.getMonth(), 0);
      bottomLockDays = formatDays(prevLockDate);
      bottomPayDays = formatDays(prevPayoutDate);
    } else {
      // Show Next Month's Cycle
      const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      bottomName = nextMonthDate.toLocaleString('default', { month: 'long' });
      bottomLabel = 'Next Month';
      
      const nextLockDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      const nextPayoutDate = new Date(today.getFullYear(), today.getMonth() + 2, 25);
      
      bottomLockDays = formatDays(nextLockDate);
      bottomPayDays = formatDays(nextPayoutDate);
    }

    return {
      curMonthName,
      curLockDays: formatDays(curLockDate),
      curPayDays: formatDays(curPayoutDate),
      bottomName,
      bottomLabel,
      bottomLockDays,
      bottomPayDays
    };
  }, []);

  const getLockGlowStyle = (daysStr: string) => {
    if (daysStr === 'Locked') {
      return {
        color: 'text-neutral-500',
        animationClass: '',
        style: {},
        showWarning: false
      };
    }
    
    let days = 0;
    if (daysStr === 'Today') {
      days = 0;
    } else {
      days = parseInt(daysStr.replace('d', ''), 10) || 0;
    }

    if (days > 20) {
      return {
        color: 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]',
        animationClass: 'animate-pulse',
        style: { animationDuration: '3s' },
        showWarning: false
      };
    } else if (days > 15) {
      return {
        color: 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]',
        animationClass: 'animate-pulse',
        style: { animationDuration: '2s' },
        showWarning: false
      };
    } else if (days > 10) {
      return {
        color: 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]',
        animationClass: 'animate-pulse',
        style: { animationDuration: '1.5s' },
        showWarning: false
      };
    } else if (days > 5) {
      return {
        color: 'text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.3)]',
        animationClass: 'animate-pulse',
        style: { animationDuration: '1s' },
        showWarning: false
      };
    } else {
      return {
        color: 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] font-bold',
        animationClass: 'animate-pulse',
        style: { animationDuration: days === 0 ? '0.3s' : '0.6s' },
        showWarning: true
      };
    }
  };

  // Merge traffic data across projects for the combined chart
  const combinedTraffic = useMemo(() => {
    if (vercelProjects.length === 0) return [];
    const base = vercelProjects[0].analytics.traffic;
    return base.map((item, idx) => {
      let views = item.views;
      let visitors = item.visitors;
      for (let i = 1; i < vercelProjects.length; i++) {
        if (vercelProjects[i].analytics.traffic[idx]) {
          views += vercelProjects[i].analytics.traffic[idx].views;
          visitors += vercelProjects[i].analytics.traffic[idx].visitors;
        }
      }
      return {
        date: item.date,
        views,
        visitors,
      };
    });
  }, [vercelProjects]);

  return (
    <div className="space-y-6">
      {/* Integrated Pipeline Pipeline Flow */}
      <div id="pipeline-card" className="bg-neutral-950 border border-neutral-900 rounded-xl p-6 relative overflow-hidden shadow-[0_4px_25px_rgba(0,0,0,0.2)] hover:border-neutral-850/50 transition duration-300">
        {/* Background design elements */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0e0e12_1px,transparent_1px),linear-gradient(to_bottom,#0e0e12_1px,transparent_1px)] bg-[size:20px_20px] opacity-40 pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 relative z-10">
          <div>
            <h2 className="text-sm font-bold text-neutral-100 font-mono tracking-tight flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              System Pipeline Flow
            </h2>
            <p className="text-[10px] text-neutral-400 font-mono">Real-time interconnection of your repository, build engine, and server cluster.</p>
          </div>
          
          <div className="flex items-center gap-4 text-[10px] font-mono">
            <div className="flex items-center gap-1.5 text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span>Topic Repos Live</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>Progress Edge</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Action Hub Primary</span>
            </div>
          </div>
        </div>

        {/* The Pipeline Connection Graphic */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center relative py-4 z-10">
          {/* GitHub Source Block */}
          <div 
            onClick={() => onTabChange('topics')}
            className="md:col-span-1 p-5 bg-neutral-950/80 border border-neutral-900 rounded-xl hover:border-red-500/30 hover:bg-neutral-900/10 hover:shadow-[0_0_15px_rgba(239,68,68,0.04)] transition-all duration-300 cursor-pointer flex flex-col items-center text-center group relative overflow-hidden min-w-[160px]"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="p-3 bg-neutral-900/50 rounded-full border border-neutral-900 group-hover:border-red-900/30 group-hover:bg-red-950/10 transition-colors duration-300 text-neutral-300 mb-2.5 flex items-center justify-center">
              <Youtube className="h-5 w-5 text-red-500 group-hover:scale-110 transition-transform duration-300 animate-pulse" />
            </div>
            <span className="text-xs font-mono font-bold text-neutral-200">Payment Cycle</span>
            
            {/* Current Month: Green Card */}
            <div className="w-full mt-3.5 p-3 bg-emerald-950/10 border border-emerald-900/30 rounded-lg text-left text-[10px] font-mono select-none space-y-1">
              <div className="flex justify-between items-center border-b border-emerald-900/20 pb-1.5 mb-1.5 font-bold text-emerald-400">
                <span>Current: {paymentMetrics.curMonthName}</span>
                <span>{paymentMetrics.curPayDays} left</span>
              </div>
              <div className="flex justify-between text-neutral-400 items-center">
                <span>Revenue Lock:</span>
                <span 
                  className={`font-mono font-bold flex items-center gap-1 ${getLockGlowStyle(paymentMetrics.curLockDays).color} ${getLockGlowStyle(paymentMetrics.curLockDays).animationClass}`}
                  style={getLockGlowStyle(paymentMetrics.curLockDays).style}
                >
                  {getLockGlowStyle(paymentMetrics.curLockDays).showWarning && (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  )}
                  {paymentMetrics.curLockDays}
                </span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Bank Dispatch:</span>
                <span className="text-neutral-200 font-bold">{paymentMetrics.curPayDays}</span>
              </div>
            </div>

            {/* Bottom Card: Last/Next Month (Neutral) */}
            <div className="w-full mt-2.5 p-3 bg-neutral-900/10 border border-neutral-900/60 rounded-lg text-left text-[10px] font-mono select-none space-y-1">
              <div className="flex justify-between items-center border-b border-neutral-900/40 pb-1.5 mb-1.5 font-bold text-neutral-400">
                <span>{paymentMetrics.bottomLabel}: {paymentMetrics.bottomName}</span>
                <span>{paymentMetrics.bottomPayDays} left</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Revenue Lock:</span>
                <span className="text-neutral-300 font-bold">{paymentMetrics.bottomLockDays}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Bank Dispatch:</span>
                <span className="text-neutral-300 font-bold">{paymentMetrics.bottomPayDays}</span>
              </div>
            </div>
          </div>

          {/* Connection Vector 1 */}
          <div className="hidden md:flex md:col-span-1 h-20 items-center justify-center relative">
            <svg className="w-full h-12 overflow-visible" fill="none">
              <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Base track */}
              <line x1="0" y1="24" x2="100%" y2="24" stroke="#121214" strokeWidth="4" strokeLinecap="round" />
              <line x1="0" y1="24" x2="100%" y2="24" stroke="#1e1e24" strokeWidth="2" strokeLinecap="round" />
              
              {/* Active flow trace */}
              <motion.line 
                x1="0" 
                y1="24" 
                x2="100%" 
                y2="24" 
                stroke="url(#grad1)" 
                strokeWidth="2" 
                strokeLinecap="round"
                strokeDasharray="6 6"
                animate={{ strokeDashoffset: [0, -24] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.2,
                  ease: "linear"
                }}
                filter="url(#glow)"
              />

              {/* Moving data packets */}
              <motion.circle
                r="3.5"
                fill="#60a5fa"
                filter="url(#glow)"
                animate={{ cx: ["0%", "100%"] }}
                transition={{
                  repeat: Infinity,
                  duration: 2.2,
                  ease: "easeInOut"
                }}
                cy="24"
              />
              <motion.circle
                r="2"
                fill="#fbbf24"
                filter="url(#glow)"
                animate={{ cx: ["0%", "100%"] }}
                transition={{
                  repeat: Infinity,
                  duration: 2.2,
                  delay: 1.1,
                  ease: "easeInOut"
                }}
                cy="24"
              />
            </svg>
            
            <div className="absolute top-1 text-[8px] font-mono text-neutral-500 uppercase tracking-widest pointer-events-none select-none animate-pulse">
              Script & Film
            </div>
            <div className="absolute bottom-1 text-[8px] font-mono text-neutral-600">
              Flow: High
            </div>
          </div>

          {/* Vercel Host Block */}
          <div 
            onClick={() => onTabChange('progress')}
            className="md:col-span-1 p-5 bg-neutral-950/80 border border-neutral-900 rounded-xl hover:border-amber-500/30 hover:bg-neutral-900/10 hover:shadow-[0_0_15px_rgba(245,158,11,0.04)] transition-all duration-300 cursor-pointer flex flex-col items-center text-center group relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="p-3 bg-neutral-900/50 rounded-full border border-neutral-900 group-hover:border-amber-900/30 group-hover:bg-amber-950/10 transition-colors duration-300 text-neutral-300 mb-2">
              <Layers className="h-5 w-5 text-amber-400 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <span className="text-xs font-mono font-semibold text-neutral-200">Progress</span>
            <span className="text-[10px] text-neutral-500 font-mono mt-1">{vercelProjects.length} Channels Active</span>
            <span className="text-[9px] text-blue-400 font-mono mt-0.5 bg-blue-950/20 border border-blue-900/30 px-1.5 py-0.2 rounded">CDN & Stream: OK</span>
          </div>

          {/* Connection Vector 2 */}
          <div className="hidden md:flex md:col-span-1 h-20 items-center justify-center relative">
            <svg className="w-full h-12 overflow-visible" fill="none">
              <defs>
                <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#34d399" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
                </linearGradient>
              </defs>
              
              {/* Base track */}
              <line x1="0" y1="24" x2="100%" y2="24" stroke="#121214" strokeWidth="4" strokeLinecap="round" />
              <line x1="0" y1="24" x2="100%" y2="24" stroke="#1e1e24" strokeWidth="2" strokeLinecap="round" />
              
              {/* Active flow trace */}
              <motion.line 
                x1="0" 
                y1="24" 
                x2="100%" 
                y2="24" 
                stroke="url(#grad2)" 
                strokeWidth="2" 
                strokeLinecap="round"
                strokeDasharray="6 6"
                animate={{ strokeDashoffset: [0, -24] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: "linear"
                }}
                filter="url(#glow)"
              />

              {/* Moving data packets */}
              <motion.circle
                r="3.5"
                fill="#fbbf24"
                filter="url(#glow)"
                animate={{ cx: ["0%", "100%"] }}
                transition={{
                  repeat: Infinity,
                  duration: 2.5,
                  ease: "easeInOut"
                }}
                cy="24"
              />
              <motion.circle
                r="2"
                fill="#34d399"
                filter="url(#glow)"
                animate={{ cx: ["0%", "100%"] }}
                transition={{
                  repeat: Infinity,
                  duration: 2.5,
                  delay: 1.25,
                  ease: "easeInOut"
                }}
                cy="24"
              />
            </svg>
            
            <div className="absolute top-1 text-[8px] font-mono text-neutral-500 uppercase tracking-widest pointer-events-none select-none animate-pulse">
              Edit & Schedule
            </div>
            <div className="absolute bottom-1 text-[8px] font-mono text-neutral-600">
              Polish Stage
            </div>
          </div>

          {/* Supabase Storage Block */}
          <div 
            onClick={() => onTabChange('actionhub')}
            className="md:col-span-1 p-5 bg-neutral-950/80 border border-neutral-900 rounded-xl hover:border-emerald-500/30 hover:bg-neutral-900/10 hover:shadow-[0_0_15px_rgba(16,185,129,0.04)] transition-all duration-300 cursor-pointer flex flex-col items-center text-center group relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="p-3 bg-neutral-900/50 rounded-full border border-neutral-900 group-hover:border-emerald-900/30 group-hover:bg-emerald-950/10 transition-colors duration-300 text-neutral-300 mb-2">
              <Database className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <span className="text-xs font-mono font-semibold text-neutral-200">Action Hub</span>
            <span className="text-[10px] text-neutral-500 font-mono mt-1">{supabase.tables.length} Scheduled Lists</span>
            <span className="text-[9px] text-emerald-400 font-mono mt-0.5 bg-emerald-950/20 border border-emerald-900/30 px-1.5 py-0.2 rounded">{supabase.metrics.activeConnections} Tasks Queue</span>
          </div>
        </div>
      </div>

      {/* Grid of 4 Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Combined Traffic */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition duration-300 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Audience Reach</span>
            <Users className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">24.5K</span>
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-0.5">
              +14.2% MoM
            </span>
          </div>
          <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
            <span>Subscribers & Members</span>
            <span className="text-neutral-400">Target: 50K</span>
          </div>
        </div>

        {/* Card 2: Serverless Latency */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition duration-300 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Viewer Retention</span>
            <Activity className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">6:45m</span>
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-0.5">
              +8.4% watchtime
            </span>
          </div>
          <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
            <span>Average watch duration</span>
            <span className="text-emerald-400">Status: High</span>
          </div>
        </div>

        {/* Card 3: Supabase Database Pool */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition duration-300 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Action Hub Items</span>
            <Database className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">14 Tasks</span>
            <span className="text-xs text-neutral-400 font-mono">
              {supabase.tables.length} Tables Active
            </span>
          </div>
          <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
            <span>Completed tasks ratio</span>
            <span className="text-neutral-400">82% Efficiency</span>
          </div>
        </div>

        {/* Card 4: Action Runs */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition duration-300 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Published Catalogue</span>
            <GitBranch className="h-4 w-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">{repos.length} Channels</span>
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-0.5">
              152 Videos
            </span>
          </div>
          <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
            <span>Content Rating</span>
            <span className="text-yellow-500 font-mono">★ 4.9 Rating</span>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Combined Traffic and Views (2 cols on large screen) */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 lg:col-span-2 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">Viewer Traffic & Engagement</h3>
              <p className="text-xs text-neutral-500">Aggregated viewer traffic across video distribution networks and social channels.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1 text-blue-400">
                <span className="h-1.5 w-1.5 bg-blue-500 rounded-full" />
                <span>Video Views</span>
              </div>
              <div className="flex items-center gap-1 text-emerald-400">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />
                <span>Unique Viewers</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={combinedTraffic} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#404040" fontSize={10} fontStyle="italic" />
                <YAxis stroke="#404040" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0c0c0e', borderColor: '#1e1e24', borderRadius: '8px' }}
                  labelStyle={{ color: '#a3a3a3', fontStyle: 'italic', fontSize: '11px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <CartesianGrid stroke="#1e1e24" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="views" name="Video Views" stroke="#3b82f6" fillOpacity={1} fill="url(#colorViews)" strokeWidth={2} />
                <Area type="monotone" dataKey="visitors" name="Unique Viewers" stroke="#10b981" fillOpacity={1} fill="url(#colorVisitors)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Server / Web Vitals & Hardware Speeds */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-neutral-850/30 transition duration-300">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">Video SEO & CTR</h3>
            <p className="text-xs text-neutral-500 font-mono">Real-time search optimization and click performance.</p>
          </div>

          {/* CTR Speedometer */}
          <div className="space-y-4 py-2 font-mono">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Click-Through Rate (CTR)</span>
                <span className="text-emerald-400 font-semibold">8.2% (Optimal)</span>
              </div>
              <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '82%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Viewer Engagement Index</span>
                <span className="text-emerald-400 font-semibold">92% (High)</span>
              </div>
              <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '92%' }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">SEO Search Visibility</span>
                <span className="text-emerald-400 font-semibold">98/100 (Excellent)</span>
              </div>
              <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '98%' }} />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-900 grid grid-cols-2 gap-4">
            <div className="p-3 bg-neutral-900/40 border border-neutral-900 rounded-lg text-center font-mono">
              <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider block">Active Scripts</span>
              <span className="text-lg font-bold text-emerald-400 mt-1 block">{supabase.metrics.activeConnections}</span>
            </div>
            <div className="p-3 bg-neutral-900/40 border border-neutral-900 rounded-lg text-center font-mono">
              <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider block">Publish Delay</span>
              <span className="text-lg font-bold text-blue-400 mt-1 block">0.5h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Event Ticker Feed */}
      <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 shadow-sm hover:border-neutral-850/30 transition duration-300">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">Content Pipeline Telemetry</h3>
            <p className="text-xs text-neutral-500">Live feed showing content tasks, scheduled items, and channel state activity.</p>
          </div>
          <span className="px-2 py-0.5 bg-neutral-900 text-neutral-400 font-mono text-[10px] border border-neutral-900 rounded-full">
            {events.length} logs
          </span>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {events.map((evt) => (
            <div 
              key={evt.id} 
              className="p-3 bg-neutral-900/20 border border-neutral-900 rounded-lg flex items-start gap-3 hover:bg-neutral-900/40 transition text-xs"
            >
              {/* Event Badge Icon */}
              <div className="mt-0.5">
                {evt.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {evt.type === 'info' && <Wifi className="h-4 w-4 text-blue-400" />}
                {evt.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                {evt.type === 'error' && <AlertTriangle className="h-4 w-4 text-rose-500" />}
              </div>

              {/* Event details */}
              <div className="flex-1 min-w-0">
                <p className="text-neutral-300 tracking-wide font-mono break-all">{evt.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] uppercase font-semibold tracking-wider ${
                    evt.source === 'github' ? 'bg-neutral-800 text-neutral-300' :
                    evt.source === 'vercel' ? 'bg-blue-950 text-blue-400' :
                    evt.source === 'supabase' ? 'bg-emerald-950 text-emerald-400' :
                    'bg-neutral-800 text-neutral-400'
                  }`}>
                    {evt.source}
                  </span>
                  <span className="text-neutral-500 font-mono text-[10px] italic">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

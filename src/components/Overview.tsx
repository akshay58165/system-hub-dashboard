import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GitBranch, 
  Layers, 
  Database, 
  Activity, 
  Cpu, 
  CheckCircle2, 
  CheckCircle,
  ArrowUpRight, 
  AlertTriangle, 
  Clock, 
  Zap, 
  Users, 
  Server, 
  Wifi,
  Youtube,
  FileText
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
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  Brush
} from 'recharts';
import { GitHubRepo, VercelProject, SupabaseProject, SystemEvent, Topic, TopicActivity } from '../types';
import AIInsightsBanner from './AIInsightsBanner';

interface OverviewProps {
  repos: GitHubRepo[];
  vercelProjects: VercelProject[];
  supabase: SupabaseProject;
  events: SystemEvent[];
  onTabChange: (tab: 'overview' | 'topics' | 'progress' | 'actionhub' | 'logs' | 'score') => void;
  topics: Topic[];
  activities: TopicActivity[];
}

export default function Overview({ repos, vercelProjects, supabase, events, onTabChange, topics, activities }: OverviewProps) {
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

  // Streak calculations
  const streakMetrics = useMemo(() => {
    const isShortVideo = (t: Topic) => {
      return (
        (t.revenueLevel && ['Lvl 1', 'Lvl 2', 'Lvl 3', 'Lvl 4'].includes(t.revenueLevel)) ||
        t.name.toLowerCase().includes('short') ||
        t.description.toLowerCase().includes('short')
      );
    };

    const getStreakForChannel = (channel: 'LearnDriven' | 'DecodeWorthy') => {
      const scheduledShorts = topics.filter(t => 
        t.channel === channel && 
        t.status === 'scheduled' && 
        t.dueDate &&
        isShortVideo(t)
      );

      if (scheduledShorts.length === 0) {
        return { streak: 0, status: 'red', message: 'No videos scheduled!' };
      }

      // Convert due dates to midnight timestamp (local time) to avoid timezone offsets
      const dates = scheduledShorts.map(t => {
        const d = new Date(t.dueDate!);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      });

      // Sort unique timestamps
      const uniqueDates = Array.from(new Set(dates)).sort((a, b) => a - b);
      if (uniqueDates.length === 0) {
        return { streak: 0, status: 'red', message: 'No videos scheduled!' };
      }

      // Find the active consecutive streak.
      // We will count the longest consecutive chain of days in the scheduled list of dates.
      let currentStreak = 1;
      let maxStreak = 1;

      for (let i = 1; i < uniqueDates.length; i++) {
        const prev = uniqueDates[i - 1];
        const curr = uniqueDates[i];
        const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else if (diffDays > 1) {
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
          currentStreak = 1;
        }
      }
      const finalStreak = Math.max(maxStreak, currentStreak);

      // Warning rules:
      // - 1 video (streak 1): red warning, "Streak is about to end!"
      // - 2 videos consecutive (streak 2) and no 3rd day scheduled (gap on day 3): orange warning, "Gap on day 3!"
      // - 3 videos consecutive (streak 3): green warning "Good!"
      // - 4 videos consecutive (streak 4): green warning "Good!"
      // - 5+ videos consecutive (streak 5+): green-pulse warning "Very Good!"
      if (finalStreak === 1) {
        return { streak: 1, status: 'red', message: 'Streak is about to end!' };
      } else if (finalStreak === 2) {
        return { streak: 2, status: 'orange', message: 'Gap on day 3!' };
      } else if (finalStreak >= 5) {
        return { streak: finalStreak, status: 'green-pulse', message: 'Very Good!' };
      } else {
        return { streak: finalStreak, status: 'green', message: 'Good!' };
      }
    };

    return {
      learnDriven: getStreakForChannel('LearnDriven'),
      decodeWorthy: getStreakForChannel('DecodeWorthy')
    };
  }, [topics]);

  const getStreakStyle = (status: string) => {
    if (status === 'red') {
      return {
        cardClass: 'bg-red-950/20 border-red-900/40 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.1)]',
        indicatorClass: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-ping',
        textClass: 'text-red-400 font-bold animate-pulse'
      };
    } else if (status === 'orange') {
      return {
        cardClass: 'bg-amber-950/25 border-amber-900/40 text-orange-400 shadow-[0_0_12px_rgba(245,158,11,0.08)]',
        indicatorClass: 'bg-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse',
        textClass: 'text-orange-400 font-bold'
      };
    } else if (status === 'green-pulse') {
      return {
        cardClass: 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.08)]',
        indicatorClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse',
        textClass: 'text-emerald-400 font-bold animate-pulse'
      };
    } else {
      return {
        cardClass: 'bg-emerald-950/10 border-emerald-900/20 text-emerald-500',
        indicatorClass: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]',
        textClass: 'text-emerald-500 font-bold'
      };
    }
  };

  // Month coverage calculations
  const coverageMetrics = useMemo(() => {
    const today = new Date();
    const passedDays = today.getDate(); // e.g. 30 on June 30
    
    const isShortVideo = (t: Topic) => {
      return (
        (t.revenueLevel && ['Lvl 1', 'Lvl 2', 'Lvl 3', 'Lvl 4'].includes(t.revenueLevel)) ||
        t.name.toLowerCase().includes('short') ||
        t.description.toLowerCase().includes('short')
      );
    };

    const getCoverageForChannel = (channel: 'LearnDriven' | 'DecodeWorthy') => {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      
      const monthShorts = topics.filter(t => {
        if (t.channel !== channel) return false;
        if (!isShortVideo(t)) return false;
        if (!t.dueDate) return false;
        
        const d = new Date(t.dueDate);
        return d >= startOfMonth && d <= endOfToday;
      });

      // Find unique days covered in this month up to today
      const uniqueDays = new Set(monthShorts.map(t => new Date(t.dueDate!).getDate()));
      
      return {
        secured: uniqueDays.size,
        totalPassed: passedDays
      };
    };

    return {
      learnDriven: getCoverageForChannel('LearnDriven'),
      decodeWorthy: getCoverageForChannel('DecodeWorthy'),
      passedDays
    };
  }, [topics]);

  // Buffer and Frequency calculations
  const bufferAndFrequency = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isShortVideo = (t: Topic) => {
      return (
        (t.revenueLevel && ['Lvl 1', 'Lvl 2', 'Lvl 3', 'Lvl 4'].includes(t.revenueLevel)) ||
        t.name.toLowerCase().includes('short') ||
        t.description.toLowerCase().includes('short')
      );
    };

    const isLongVideo = (t: Topic) => {
      return (
        (t.revenueLevel && ['Lvl 6', 'Lvl 7', 'Lvl 8', 'Lvl 9', 'Lvl 20'].includes(t.revenueLevel)) ||
        t.name.toLowerCase().includes('long') ||
        t.description.toLowerCase().includes('long')
      );
    };

    const isMembersOnly = (t: Topic) => {
      return (
        (t.revenueLevel && t.revenueLevel === 'Lvl 5') ||
        t.name.toLowerCase().includes('member') ||
        t.description.toLowerCase().includes('member')
      );
    };

    const getMetricsForChannel = (channel: 'LearnDriven' | 'DecodeWorthy') => {
      // Buffer: Only scheduled in the future
      const scheduledFuture = topics.filter(t => 
        t.channel === channel && 
        t.status === 'scheduled' && 
        t.dueDate &&
        new Date(t.dueDate) > today
      );

      // Unique days covered in the future
      const uniqueFutureDays = new Set(scheduledFuture.map(t => {
        const d = new Date(t.dueDate!);
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      }));

      const bufferDays = uniqueFutureDays.size;

      // Frequency (current month scheduled + completed/published)
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const monthVideos = topics.filter(t => 
        t.channel === channel && 
        t.dueDate && 
        new Date(t.dueDate) >= startOfMonth && 
        new Date(t.dueDate) <= endOfMonth
      );

      const shortsCount = monthVideos.filter(isShortVideo).length;
      const longsCount = monthVideos.filter(isLongVideo).length;
      const membersCount = monthVideos.filter(isMembersOnly).length;

      return {
        bufferDays,
        shortsCount,
        longsCount,
        membersCount
      };
    };

    return {
      learnDriven: getMetricsForChannel('LearnDriven'),
      decodeWorthy: getMetricsForChannel('DecodeWorthy')
    };
  }, [topics]);

  // Generate monthly timeline data for topics added vs videos scheduled
  const monthlyTimelineData = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const data = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
      const dateLabel = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }); // e.g. "Jun 1"

      // LearnDriven counts
      const ldAdded = topics.filter(t => 
        t.channel === 'LearnDriven' && 
        t.createdDate && 
        t.createdDate.split('T')[0] === dateStr
      ).length;

      const ldScheduled = topics.filter(t => 
        t.channel === 'LearnDriven' && 
        t.status === 'scheduled' && 
        t.dueDate && 
        t.dueDate.split('T')[0] === dateStr
      ).length;

      // DecodeWorthy counts
      const dwAdded = topics.filter(t => 
        t.channel === 'DecodeWorthy' && 
        t.createdDate && 
        t.createdDate.split('T')[0] === dateStr
      ).length;

      const dwScheduled = topics.filter(t => 
        t.channel === 'DecodeWorthy' && 
        t.status === 'scheduled' && 
        t.dueDate && 
        t.dueDate.split('T')[0] === dateStr
      ).length;

      data.push({
        date: dateLabel,
        rawDate: dateStr,
        ldAdded,
        ldScheduled,
        dwAdded,
        dwScheduled
      });
    }

    return data;
  }, [topics]);

  // Compute last 25 content activities sorted by timestamp descending
  const last25Activities = useMemo(() => {
    return [...activities]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 25);
  }, [activities]);

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
      <AIInsightsBanner />

      {/* Integrated Pipeline Pipeline Flow */}
      <div id="pipeline-card" className="bg-neutral-950 border border-neutral-900 rounded-xl p-4 py-3 relative overflow-hidden shadow-[0_4px_25px_rgba(0,0,0,0.2)] hover:border-neutral-850/50 transition duration-300">
        {/* Background design elements */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0e0e12_1px,transparent_1px),linear-gradient(to_bottom,#0e0e12_1px,transparent_1px)] bg-[size:20px_20px] opacity-40 pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-4 relative z-10">
          <div>
            <h2 className="text-sm font-bold text-neutral-100 font-mono tracking-tight flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Content Pipeline Flow
            </h2>
            <p className="text-[10px] text-neutral-400 font-mono">Real-time tracking of content schedules, creation streaks, and monthly channel coverage.</p>
          </div>
          
          <div className="flex items-center gap-4 text-[10px] font-mono">
            <div className="flex items-center gap-1.5 text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              <span>Payment Cycle</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <span>Streak Status</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Month Coverage</span>
            </div>
          </div>
        </div>

        {/* The Pipeline Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch relative py-1 z-10">
          {/* GitHub Source Block */}
          <div 
            onClick={() => onTabChange('topics')}
            className="md:col-span-2 p-3 bg-neutral-950/80 border border-neutral-900 rounded-xl hover:border-red-500/30 hover:bg-neutral-900/10 hover:shadow-[0_0_15px_rgba(239,68,68,0.04)] transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="flex items-center gap-2 border-b border-neutral-900 pb-2 mb-2 w-full text-left">
              <Youtube className="h-4 w-4 text-red-500 animate-pulse" />
              <span className="text-xs font-mono font-bold text-neutral-200">Payment Cycle</span>
            </div>
            
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1.5">
              {/* Current Month: Green Card */}
              <div className="p-2 bg-emerald-950/10 border border-emerald-900/30 rounded-lg text-left text-[10px] font-mono select-none space-y-1">
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
              <div className="p-2 bg-neutral-900/10 border border-neutral-900/60 rounded-lg text-left text-[10px] font-mono select-none space-y-1">
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
          </div>

          {/* Streak Status Block */}
          <div 
            onClick={() => onTabChange('topics')}
            className="md:col-span-1 p-3 bg-neutral-950/80 border border-neutral-900 rounded-xl hover:border-amber-500/30 hover:bg-neutral-900/10 hover:shadow-[0_0_15px_rgba(245,158,11,0.04)] transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden font-mono"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="flex items-center gap-2 border-b border-neutral-900 pb-2 mb-2 w-full text-left">
              <Zap className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold text-neutral-200">Streak Status</span>
            </div>

            <div className="w-full mt-1.5 space-y-2 text-left text-[9px]">
              {/* LearnDriven Streak */}
              <div className={`p-2 rounded-lg border ${getStreakStyle(streakMetrics.learnDriven.status).cardClass}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-neutral-300">LearnDriven</span>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${getStreakStyle(streakMetrics.learnDriven.status).indicatorClass}`} />
                      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${getStreakStyle(streakMetrics.learnDriven.status).indicatorClass.replace(' animate-ping', '').replace(' animate-pulse', '')}`} />
                    </span>
                    <span className="font-mono font-bold bg-neutral-950/40 px-1.5 py-0.2 border border-neutral-900/40 rounded text-neutral-200">
                      {streakMetrics.learnDriven.streak}d
                    </span>
                  </div>
                </div>
                <div className={`text-[8px] uppercase tracking-wide ${getStreakStyle(streakMetrics.learnDriven.status).textClass}`}>
                  {streakMetrics.learnDriven.message}
                </div>
              </div>

              {/* DecodeWorthy Streak */}
              <div className={`p-2 rounded-lg border ${getStreakStyle(streakMetrics.decodeWorthy.status).cardClass}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-neutral-300">DecodeWorthy</span>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${getStreakStyle(streakMetrics.decodeWorthy.status).indicatorClass}`} />
                      <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${getStreakStyle(streakMetrics.decodeWorthy.status).indicatorClass.replace(' animate-ping', '').replace(' animate-pulse', '')}`} />
                    </span>
                    <span className="font-mono font-bold bg-neutral-950/40 px-1.5 py-0.2 border border-neutral-900/40 rounded text-neutral-200">
                      {streakMetrics.decodeWorthy.streak}d
                    </span>
                  </div>
                </div>
                <div className={`text-[8px] uppercase tracking-wide ${getStreakStyle(streakMetrics.decodeWorthy.status).textClass}`}>
                  {streakMetrics.decodeWorthy.message}
                </div>
              </div>
            </div>
          </div>

          {/* Month Coverage Block */}
          <div 
            onClick={() => onTabChange('topics')}
            className="md:col-span-1 p-3 bg-neutral-950/80 border border-neutral-900 rounded-xl hover:border-emerald-500/30 hover:bg-neutral-900/10 hover:shadow-[0_0_15px_rgba(16,185,129,0.04)] transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden font-mono"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="flex justify-between items-center border-b border-neutral-900 pb-2 mb-2 w-full text-left">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold text-neutral-200">Month Coverage</span>
              </div>
              <span className="text-[9px] text-neutral-500">{coverageMetrics.passedDays}d elapsed</span>
            </div>

            <div className="w-full mt-1.5 space-y-2.5 text-left text-[9px]">
              {/* LearnDriven Coverage */}
              <div className="p-2 bg-neutral-900/30 border border-neutral-900/60 rounded-lg space-y-1.5">
                <div className="flex justify-between items-center text-[8px] font-bold text-neutral-300">
                  <span>LearnDriven</span>
                  <span className="text-emerald-400 font-mono">
                    {coverageMetrics.learnDriven.secured} / {coverageMetrics.passedDays}d
                  </span>
                </div>
                <div className="w-full bg-neutral-950 rounded-full h-1 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-1 rounded-full" 
                    style={{ width: `${(coverageMetrics.learnDriven.secured / (coverageMetrics.passedDays || 1)) * 100}%` }}
                  />
                </div>
              </div>

              {/* DecodeWorthy Coverage */}
              <div className="p-2 bg-neutral-900/30 border border-neutral-900/60 rounded-lg space-y-1.5">
                <div className="flex justify-between items-center text-[8px] font-bold text-neutral-300">
                  <span>DecodeWorthy</span>
                  <span className="text-emerald-400 font-mono">
                    {coverageMetrics.decodeWorthy.secured} / {coverageMetrics.passedDays}d
                  </span>
                </div>
                <div className="w-full bg-neutral-950 rounded-full h-1 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-1 rounded-full" 
                    style={{ width: `${(coverageMetrics.decodeWorthy.secured / (coverageMetrics.passedDays || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of 4 Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Topics */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition duration-300 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Total Topics</span>
            <FileText className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">{topics.length}</span>
            <span className="text-xs text-neutral-400 font-mono">
              across channels
            </span>
          </div>
          <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
            <span>Content ideas in pipeline</span>
            <span className="text-neutral-400">{topics.filter(t => t.channel === 'LearnDriven').length} LD / {topics.filter(t => t.channel === 'DecodeWorthy').length} DW</span>
          </div>
        </div>

        {/* Card 2: Scheduled Videos */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition duration-300 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Scheduled Videos</span>
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">{topics.filter(t => t.status === 'scheduled').length}</span>
            <span className="text-xs text-neutral-400 font-mono">
              ready to publish
            </span>
          </div>
          <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
            <span>Completion rate</span>
            <span className={`${topics.length > 0 ? 'text-emerald-400' : 'text-neutral-500'}`}>{topics.length > 0 ? Math.round((topics.filter(t => t.status === 'scheduled').length / topics.length) * 100) : 0}%</span>
          </div>
        </div>

        {/* Card 3: In Progress */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition duration-300 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">In Progress</span>
            <Activity className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">{topics.filter(t => t.status !== 'topic' && t.status !== 'scheduled').length}</span>
            <span className="text-xs text-neutral-400 font-mono">
              being worked on
            </span>
          </div>
          <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
            <span>Scripted / Shot / Edited</span>
            <span className="text-neutral-400">{topics.filter(t => t.status === 'scripted').length}S / {topics.filter(t => t.status === 'shot').length}H / {topics.filter(t => t.status === 'edited').length}E</span>
          </div>
        </div>

        {/* Card 4: Recent Activity */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 hover:border-neutral-800 transition duration-300 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Recent Activity</span>
            <GitBranch className="h-4 w-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">{activities.length}</span>
            <span className="text-xs text-neutral-400 font-mono">
              logged actions
            </span>
          </div>
          <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
            <span>Content workflow events</span>
            <span className="text-neutral-400">{events.length} telemetry</span>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Content Scheduling & Velocity (2 cols on large screen) */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 lg:col-span-2 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">Content Scheduling & Velocity</h3>
              <p className="text-xs text-neutral-500 font-sans">Dotted line = Topics Added | Solid line = Videos Scheduled</p>
            </div>
            <div className="flex flex-wrap items-center gap-3.5 text-[9px] font-mono">
              <div className="flex items-center gap-1.5 text-blue-400">
                <span className="h-1.5 w-1.5 bg-blue-500 rounded-full" />
                <span>LearnDriven</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />
                <span>DecodeWorthy</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full select-none font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTimelineData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="date" stroke="#404040" fontSize={9} />
                <YAxis stroke="#404040" fontSize={9} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0c0c0e', borderColor: '#1e1e24', borderRadius: '8px' }}
                  labelStyle={{ color: '#a3a3a3', fontSize: '10px', fontWeight: 'bold' }}
                  itemStyle={{ fontSize: '10px' }}
                />
                <CartesianGrid stroke="#1e1e24" strokeDasharray="3 3" />
                
                {/* LearnDriven (Blue) */}
                <Line type="monotone" dataKey="ldAdded" name="LearnDriven: Added" stroke="#3b82f6" strokeDasharray="4 4" strokeWidth={1.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="ldScheduled" name="LearnDriven: Scheduled" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />

                {/* DecodeWorthy (Green) */}
                <Line type="monotone" dataKey="dwAdded" name="DecodeWorthy: Added" stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="dwScheduled" name="DecodeWorthy: Scheduled" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                
                {/* Slidable Brush control */}
                <Brush dataKey="date" height={20} stroke="#2b2b35" fill="#09090b" startIndex={Math.max(0, monthlyTimelineData.length - 14)} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Video Buffer & Frequency */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-neutral-850/30 transition duration-300 font-mono">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">Video Buffer & Frequency</h3>
            <p className="text-xs text-neutral-500">Publishing safety margin and monthly output volume.</p>
          </div>

          <div className="space-y-4 py-1 text-xs">
            {/* LearnDriven Block */}
            <div className="p-3 bg-neutral-900/20 border border-neutral-900 rounded-lg space-y-2">
              <div className="flex justify-between items-center border-b border-neutral-900/60 pb-1.5 font-bold">
                <span className="text-neutral-300">LearnDriven</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  bufferAndFrequency.learnDriven.bufferDays >= 5 ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40' :
                  bufferAndFrequency.learnDriven.bufferDays >= 2 ? 'bg-amber-950/40 text-orange-400 border border-amber-900/40' :
                  'bg-red-950 text-red-400 border border-red-900/40 animate-pulse'
                }`}>
                  {bufferAndFrequency.learnDriven.bufferDays}d Buffer
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-neutral-400">
                <div className="bg-neutral-950/40 p-1.5 rounded border border-neutral-900/60">
                  <span className="text-[8px] uppercase text-neutral-500 block">Shorts</span>
                  <span className="font-bold text-white mt-0.5 block">{bufferAndFrequency.learnDriven.shortsCount}/mo</span>
                </div>
                <div className="bg-neutral-950/40 p-1.5 rounded border border-neutral-900/60">
                  <span className="text-[8px] uppercase text-neutral-500 block">Longs</span>
                  <span className="font-bold text-white mt-0.5 block">{bufferAndFrequency.learnDriven.longsCount}/mo</span>
                </div>
                <div className="bg-neutral-950/40 p-1.5 rounded border border-neutral-900/60">
                  <span className="text-[8px] uppercase text-neutral-500 block">Members</span>
                  <span className="font-bold text-white mt-0.5 block">{bufferAndFrequency.learnDriven.membersCount}/mo</span>
                </div>
              </div>
            </div>

            {/* DecodeWorthy Block */}
            <div className="p-3 bg-neutral-900/20 border border-neutral-900 rounded-lg space-y-2">
              <div className="flex justify-between items-center border-b border-neutral-900/60 pb-1.5 font-bold">
                <span className="text-neutral-300">DecodeWorthy</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  bufferAndFrequency.decodeWorthy.bufferDays >= 5 ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40' :
                  bufferAndFrequency.decodeWorthy.bufferDays >= 2 ? 'bg-amber-950/40 text-orange-400 border border-amber-900/40' :
                  'bg-red-950 text-red-400 border border-red-900/40 animate-pulse'
                }`}>
                  {bufferAndFrequency.decodeWorthy.bufferDays}d Buffer
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-neutral-400">
                <div className="bg-neutral-950/40 p-1.5 rounded border border-neutral-900/60 col-span-3">
                  <span className="text-[8px] uppercase text-neutral-500 block">Shorts Frequency</span>
                  <span className="font-bold text-white mt-0.5 block">{bufferAndFrequency.decodeWorthy.shortsCount}/mo (Long/Member N/A)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Pipeline Activities */}
      <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 shadow-sm hover:border-neutral-850/30 transition duration-300">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">Content Pipeline Activities</h3>
            <p className="text-xs text-neutral-500 font-sans">Real-time log of the last 25 workflow state transitions and video scheduling.</p>
          </div>
          <span className="px-2 py-0.5 bg-neutral-900 text-neutral-400 font-mono text-[10px] border border-neutral-900 rounded-full">
            {last25Activities.length} logs
          </span>
        </div>

        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {last25Activities.map((act) => {
            const dateObj = new Date(act.timestamp);
            const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

            return (
              <div 
                key={act.id} 
                className="p-3 bg-neutral-900/20 border border-neutral-900 rounded-lg flex items-start gap-3 hover:bg-neutral-900/40 transition text-xs font-mono"
              >
                {/* Event Badge Icon */}
                <div className="mt-0.5">
                  <Youtube className={`h-4 w-4 ${act.channel === 'LearnDriven' ? 'text-blue-400' : 'text-emerald-400'}`} />
                </div>

                {/* Event details */}
                <div className="flex-1 min-w-0">
                  <p className="text-neutral-300 tracking-wide font-mono">
                    <span className="text-white font-bold">@{act.author}</span> {act.action} <span className={`font-bold ${act.channel === 'LearnDriven' ? 'text-blue-400' : 'text-emerald-400'}`}>"{act.topicName}"</span>
                  </p>
                  <div className="flex items-center gap-2.5 mt-1">
                    <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] uppercase font-semibold tracking-wider ${
                      act.channel === 'LearnDriven' ? 'bg-blue-950/40 text-blue-400 border border-blue-900/20' :
                      'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20'
                    }`}>
                      {act.channel}
                    </span>
                    <span className="text-neutral-500 font-mono text-[10px] italic">
                      {dateStr} - {timeStr}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

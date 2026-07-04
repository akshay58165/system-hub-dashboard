import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
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
  Flame,
  Target
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
import { GitHubRepo, VercelProject, SupabaseProject, SystemEvent, Topic, TopicActivity, CycleGoal } from '../types';
import AIInsightsBanner from './AIInsightsBanner';

interface OverviewProps {
  repos: GitHubRepo[];
  vercelProjects: VercelProject[];
  supabase: SupabaseProject;
  events: SystemEvent[];
  onTabChange: (tab: 'overview' | 'topics' | 'progress' | 'actionhub' | 'logs' | 'score') => void;
  topics: Topic[];
  activities: TopicActivity[];
  cycleGoals: CycleGoal | null;
}

export default function Overview({ repos, vercelProjects, supabase, events, onTabChange, topics, activities, cycleGoals }: OverviewProps) {
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

  // "What should I do next" + "what's overdue" - the two questions a creator
  // actually opens the dashboard to answer, computed from real topic state.
  const actionableMetrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const unfinished = topics.filter(t => t.status !== 'scheduled');

    const overdue = unfinished.filter(t => t.dueDate && new Date(t.dueDate) < today);

    // Next up: earliest due date among unfinished topics; if none have a due
    // date, fall back to the oldest untouched topic (still needs picking up).
    const withDueDate = unfinished
      .filter(t => t.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    let nextUp: Topic | null = withDueDate[0] ?? null;
    if (!nextUp) {
      const oldest = [...unfinished].sort(
        (a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime()
      );
      nextUp = oldest[0] ?? null;
    }

    let nextUpDueLabel = 'No due date';
    if (nextUp?.dueDate) {
      const due = new Date(nextUp.dueDate);
      due.setHours(0, 0, 0, 0);
      const days = Math.round((due.getTime() - today.getTime()) / 86400000);
      if (days < 0) nextUpDueLabel = `${Math.abs(days)}d overdue`;
      else if (days === 0) nextUpDueLabel = 'Due today';
      else if (days === 1) nextUpDueLabel = 'Due tomorrow';
      else nextUpDueLabel = `Due in ${days}d`;
    }

    return { overdueCount: overdue.length, nextUp, nextUpDueLabel };
  }, [topics]);

  // 14-day "don't break the chain" heatmap - real activity presence per day.
  const activityHeatmap = useMemo(() => {
    const days: { iso: string; label: string; count: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const count = activities.filter(a => a.timestamp.slice(0, 10) === iso).length;
      days.push({ iso, label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1), count });
    }
    return days;
  }, [activities]);

  // Real goal pace - compares actual scheduling velocity against the active
  // cycle target set in Action Hub. Honest empty state if no cycle is set.
  const goalPace = useMemo(() => {
    if (!cycleGoals) return null;

    const target =
      (cycleGoals.learnDrivenShorts || 0) +
      (cycleGoals.learnDrivenLong || 0) +
      (cycleGoals.learnDrivenMembers || 0) +
      (cycleGoals.decodeWorthyShorts || 0);
    if (target === 0) return null;

    const start = new Date(cycleGoals.startDate + 'T00:00:00');
    const end = new Date(cycleGoals.endDate + 'T23:59:59');
    const today = new Date();

    const scheduledInCycle = topics.filter(t => {
      if (!t.dueDate) return false;
      const d = new Date(t.dueDate);
      return d >= start && d <= end && (t.status === 'scheduled' || t.status === 'edited');
    }).length;

    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
    const daysElapsed = Math.min(totalDays, Math.max(1, Math.round((today.getTime() - start.getTime()) / 86400000)));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);

    const currentPace = scheduledInCycle / (daysElapsed / 7); // videos/week so far
    const remaining = Math.max(0, target - scheduledInCycle);
    const requiredPace = daysRemaining > 0 ? remaining / (daysRemaining / 7) : remaining > 0 ? Infinity : 0;
    const aheadOfSchedule = remaining === 0 || currentPace >= requiredPace;

    return {
      target,
      scheduledInCycle,
      remaining,
      currentPace,
      requiredPace,
      daysRemaining,
      aheadOfSchedule,
      monthName: cycleGoals.monthName
    };
  }, [cycleGoals, topics]);

  const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
  const nextMilestone = (streak: number) => STREAK_MILESTONES.find(m => m > streak) ?? null;

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
        color: 'text-neutral-400',
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

      {/* Pipeline Flow - same visual language as AI Insights: glow blobs, icon badges, motion entrance.
          All values below are real, computed from your actual topics - only the presentation changed. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-xl border border-neutral-900 bg-neutral-950 shadow-[0_4px_30px_rgba(0,0,0,0.3)]"
      >
        <motion.div
          className="absolute -top-20 -right-10 w-72 h-72 rounded-full bg-emerald-500/8 blur-3xl pointer-events-none"
          animate={{ x: [0, -25, 10, 0], y: [0, 20, -10, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-blue-500/8 blur-3xl pointer-events-none"
          animate={{ x: [0, 25, -10, 0], y: [0, -20, 10, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="grid place-items-center h-8 w-8 rounded-lg bg-emerald-950/30 border border-emerald-900/40 text-emerald-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-100 font-mono tracking-tight">Streak Engine</h2>
              <p className="text-[11px] text-neutral-400 font-mono">Real creation streaks, daily momentum, and goal pace - built to keep the chain alive.</p>
            </div>
          </div>

          {/* Streak flame cards + Today's Move - the three things that should hit you the moment you open this app */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            {[
              { channel: 'LearnDriven' as const, data: streakMetrics.learnDriven },
              { channel: 'DecodeWorthy' as const, data: streakMetrics.decodeWorthy }
            ].map(({ channel, data }, idx) => {
              const lit = data.streak > 0;
              const milestone = nextMilestone(data.streak);
              const flameColor =
                data.status === 'red' ? 'text-neutral-700' :
                data.status === 'orange' ? 'text-amber-400' :
                data.status === 'green-pulse' ? 'text-orange-400' : 'text-emerald-400';
              const glow =
                data.status === 'red' ? '' :
                data.status === 'orange' ? 'drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]' :
                data.status === 'green-pulse' ? 'drop-shadow-[0_0_16px_rgba(251,146,60,0.6)]' :
                'drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]';
              const bg =
                data.status === 'red' ? 'bg-neutral-950 border-neutral-900' :
                data.status === 'orange' ? 'bg-amber-950/10 border-amber-900/30' :
                'bg-emerald-950/10 border-emerald-900/30';

              return (
                <motion.div
                  key={channel}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 * idx }}
                  onClick={() => onTabChange('topics')}
                  className={`p-5 rounded-xl border cursor-pointer transition-all duration-300 hover:border-opacity-60 ${bg}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">{channel}</span>
                    <motion.div
                      animate={lit ? { scale: [1, 1.12, 1] } : {}}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Flame className={`h-5 w-5 ${flameColor} ${glow}`} />
                    </motion.div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold text-white font-mono tracking-tighter">{data.streak}</span>
                    <span className="text-[11px] text-neutral-400 font-mono uppercase">day streak</span>
                  </div>
                  <p className={`text-[11px] font-mono mt-1.5 font-bold ${
                    data.status === 'red' ? 'text-rose-400' : data.status === 'orange' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {data.message}
                  </p>
                  {milestone && (
                      <p className="text-[11px] text-neutral-400 font-mono mt-2">
                      {milestone - data.streak} more day{milestone - data.streak === 1 ? '' : 's'} to the <span className="text-neutral-300 font-bold">{milestone}-day club</span>
                    </p>
                  )}
                </motion.div>
              );
            })}

            {/* Today's Move - one clear, real, actionable next step */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="p-5 rounded-xl border border-blue-900/30 bg-blue-950/10 flex flex-col justify-between"
            >
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-blue-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 font-mono">Today's Move</span>
              </div>
              {(() => {
                const urgentStreak =
                  streakMetrics.learnDriven.status === 'red' ? { channel: 'LearnDriven', msg: 'has no videos scheduled' } :
                  streakMetrics.decodeWorthy.status === 'red' ? { channel: 'DecodeWorthy', msg: 'has no videos scheduled' } :
                  null;

                if (actionableMetrics.overdueCount > 0 && actionableMetrics.nextUp) {
                  return (
                    <>
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        <span className="text-rose-400 font-bold">{actionableMetrics.overdueCount} topic{actionableMetrics.overdueCount === 1 ? '' : 's'} overdue.</span> Start with <span className="text-white font-bold">"{actionableMetrics.nextUp.name}"</span>.
                      </p>
                    </>
                  );
                }
                if (urgentStreak) {
                  return (
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      <span className="text-amber-400 font-bold">{urgentStreak.channel}</span> {urgentStreak.msg} - keep the chain alive today.
                    </p>
                  );
                }
                if (actionableMetrics.nextUp) {
                  return (
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      Next up: <span className="text-white font-bold">"{actionableMetrics.nextUp.name}"</span> - {actionableMetrics.nextUpDueLabel}.
                    </p>
                  );
                }
                return (
                  <p className="text-xs text-emerald-400 leading-relaxed font-bold">
                    All caught up - nothing urgent. Great work staying ahead.
                  </p>
                );
              })()}
              <button
                onClick={() => onTabChange('topics')}
                className="flex items-center justify-center gap-1.5 w-full py-2 mt-3 rounded-lg border border-blue-800/50 bg-blue-900/30 text-blue-400 text-xs font-bold hover:bg-blue-800/50 transition cursor-pointer"
              >
                Take action <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          </div>

          {/* 14-day chain - real activity presence, not a fabricated streak number */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="p-4 rounded-xl border border-neutral-900 bg-neutral-950/60 mb-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">Last 14 Days</span>
              <span className="text-[11px] text-neutral-400 font-mono">{activities.length > 0 ? 'Don\'t break the chain' : 'No activity logged yet'}</span>
            </div>
            <div className="flex gap-1.5">
              {activityHeatmap.map((day, i) => (
                <motion.div
                  key={day.iso}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25, delay: 0.02 * i }}
                  title={`${day.iso}: ${day.count} action${day.count === 1 ? '' : 's'}`}
                  className={`flex-1 h-8 rounded-md ${
                    day.count === 0 ? 'bg-neutral-900' :
                    day.count === 1 ? 'bg-emerald-900/50' :
                    day.count <= 3 ? 'bg-emerald-700/70' : 'bg-emerald-500'
                  }`}
                />
              ))}
            </div>
          </motion.div>

          {/* Goal Pace - real cycle target vs real scheduling velocity */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="p-5 rounded-xl border border-purple-900/30 bg-purple-950/10"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono">Goal Pace</span>
              </div>
              {goalPace && (
                <span className="text-[11px] font-mono text-neutral-400">{goalPace.monthName} · {goalPace.daysRemaining}d remaining</span>
              )}
            </div>

            {!goalPace ? (
              <div className="flex flex-col items-center text-center gap-2 py-6">
                <p className="text-xs text-neutral-400">No active cycle goal set.</p>
                <button
                  onClick={() => onTabChange('actionhub')}
                  className="text-[11px] text-purple-400 font-bold hover:text-purple-300 transition cursor-pointer"
                >
                  Set targets in Action Hub →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-neutral-900 pb-3">
                  <div>
                    <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">Current Pace</span>
                    <div className="text-2xl font-bold text-white font-mono tracking-tight">
                      {goalPace.currentPace.toFixed(1)} <span className="text-[11px] text-neutral-400 uppercase">vids/wk</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-purple-400/70 uppercase tracking-wider">Required Pace</span>
                    <div className="text-2xl font-bold text-purple-400 font-mono tracking-tight">
                      {Number.isFinite(goalPace.requiredPace) ? goalPace.requiredPace.toFixed(1) : '-'} <span className="text-[10px] text-purple-400/50 uppercase">vids/wk</span>
                    </div>
                  </div>
                </div>

                <div className={`px-3 py-2 rounded-lg border flex items-center gap-2 ${
                  goalPace.aheadOfSchedule ? 'bg-emerald-950/30 border-emerald-900/50' : 'bg-amber-950/30 border-amber-900/50'
                }`}>
                  {goalPace.aheadOfSchedule ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />}
                  <span className={`text-[11px] font-mono ${goalPace.aheadOfSchedule ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {goalPace.aheadOfSchedule
                      ? 'On pace to hit your goal. Keep it up.'
                      : `${goalPace.remaining} more needed - pick up the pace to stay on track.`}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span className="text-neutral-400">{goalPace.scheduledInCycle} / {goalPace.target} videos</span>
                    <span className="text-neutral-400">{Math.round((goalPace.scheduledInCycle / goalPace.target) * 100)}%</span>
                  </div>
                  <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (goalPace.scheduledInCycle / goalPace.target) * 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400"
                    />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* Status tiles - restyled to match, same real counts as before */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Next Up',
            variant: 'next' as const,
            icon: <Target className="h-4 w-4" />,
            color: 'text-blue-400',
            bg: 'bg-blue-950/20',
            border: 'border-blue-900/30',
            topicTitle: actionableMetrics.nextUp?.name ?? null,
            dueLabel: actionableMetrics.nextUpDueLabel,
            footLabel: 'Your highest-priority unfinished topic',
            footValue: actionableMetrics.nextUp ? actionableMetrics.nextUp.channel : '-'
          },
          {
            label: 'Overdue',
            variant: 'stat' as const,
            icon: <AlertTriangle className="h-4 w-4" />,
            color: actionableMetrics.overdueCount > 0 ? 'text-rose-400' : 'text-emerald-400',
            bg: actionableMetrics.overdueCount > 0 ? 'bg-rose-950/20' : 'bg-emerald-950/20',
            border: actionableMetrics.overdueCount > 0 ? 'border-rose-900/30' : 'border-emerald-900/30',
            value: actionableMetrics.overdueCount,
            unit: actionableMetrics.overdueCount > 0 ? 'need attention' : 'all clear',
            footLabel: 'Past due, not yet scheduled',
            footValue: actionableMetrics.overdueCount > 0 ? 'Review now' : 'Nothing slipping'
          },
          {
            label: 'Scheduled Videos',
            variant: 'stat' as const,
            icon: <CheckCircle className="h-4 w-4" />,
            color: 'text-emerald-400',
            bg: 'bg-emerald-950/20',
            border: 'border-emerald-900/30',
            value: topics.filter(t => t.status === 'scheduled').length,
            unit: 'ready to publish',
            footLabel: 'Completion rate',
            footValue: `${topics.length > 0 ? Math.round((topics.filter(t => t.status === 'scheduled').length / topics.length) * 100) : 0}%`
          },
          {
            label: 'In Progress',
            variant: 'stat' as const,
            icon: <Activity className="h-4 w-4" />,
            color: 'text-amber-400',
            bg: 'bg-amber-950/20',
            border: 'border-amber-900/30',
            value: topics.filter(t => t.status !== 'topic' && t.status !== 'scheduled').length,
            unit: 'being worked on',
            footLabel: 'Scripted / Shot / Edited',
            footValue: `${topics.filter(t => t.status === 'scripted').length}S / ${topics.filter(t => t.status === 'shot').length}H / ${topics.filter(t => t.status === 'edited').length}E`
          }
        ].map((tile, i) => (
          <motion.div
            key={tile.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 * i }}
            whileHover={{ y: -2 }}
            onClick={() => onTabChange('topics')}
            className={`p-4 rounded-lg border ${tile.bg} ${tile.border} transition-colors duration-300 cursor-pointer`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-neutral-400">{tile.label}</span>
              <span className={tile.color}>{tile.icon}</span>
            </div>

            {tile.variant === 'next' ? (
              <div className="min-h-[28px]">
                {tile.topicTitle ? (
                  <>
                    <p className="text-sm font-bold text-white leading-snug line-clamp-2">{tile.topicTitle}</p>
                    <span className={`inline-block mt-1 text-[10px] font-mono font-bold ${tile.dueLabel?.includes('overdue') ? 'text-rose-400' : tile.dueLabel === 'Due today' ? 'text-amber-400' : 'text-neutral-400'}`}>
                      {tile.dueLabel}
                    </span>
                  </>
                ) : (
                  <p className="text-sm font-bold text-neutral-400">No topics yet - add one</p>
                )}
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tracking-tight text-white">{tile.value}</span>
                <span className="text-xs text-neutral-400 font-mono">{tile.unit}</span>
              </div>
            )}

            <div className="mt-2 text-[11px] text-neutral-400 font-mono flex items-center justify-between">
              <span>{tile.footLabel}</span>
              <span className="text-neutral-400">{tile.footValue}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Content Scheduling & Velocity (2 cols on large screen) */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 lg:col-span-2 space-y-4 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">Content Scheduling & Velocity</h3>
              <p className="text-[11px] text-neutral-400 font-sans">Dotted line = Topics Added | Solid line = Videos Scheduled</p>
            </div>
            <div className="flex flex-wrap items-center gap-3.5 text-[10px] font-mono">
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
            <p className="text-[11px] text-neutral-400">Publishing safety margin and monthly output volume.</p>
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
                  <span className="text-[9px] uppercase text-neutral-400 block">Shorts</span>
                  <span className="font-bold text-white mt-0.5 block">{bufferAndFrequency.learnDriven.shortsCount}/mo</span>
                </div>
                <div className="bg-neutral-950/40 p-1.5 rounded border border-neutral-900/60">
                  <span className="text-[9px] uppercase text-neutral-400 block">Longs</span>
                  <span className="font-bold text-white mt-0.5 block">{bufferAndFrequency.learnDriven.longsCount}/mo</span>
                </div>
                <div className="bg-neutral-950/40 p-1.5 rounded border border-neutral-900/60">
                  <span className="text-[9px] uppercase text-neutral-400 block">Members</span>
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
                  <span className="text-[9px] uppercase text-neutral-400 block">Shorts Frequency</span>
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
            <p className="text-[11px] text-neutral-400 font-sans">Real-time log of the last 25 workflow state transitions and video scheduling.</p>
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
                    <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] uppercase font-semibold tracking-wider ${
                      act.channel === 'LearnDriven' ? 'bg-blue-950/40 text-blue-400 border border-blue-900/20' :
                      'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20'
                    }`}>
                      {act.channel}
                    </span>
                    <span className="text-neutral-400 font-mono text-[11px] italic">
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

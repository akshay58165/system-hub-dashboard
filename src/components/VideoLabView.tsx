import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  LayoutGrid, 
  Layers, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2,
  Flame,
  Target,
  Trophy,
  CalendarCheck,
  Activity
} from 'lucide-react';
import { VideoRecord, Topic, CycleGoal } from '../types';

interface VideoLabProps {
  videos: VideoRecord[];
  setVideos: React.Dispatch<React.SetStateAction<VideoRecord[]>>;
  selectedVideoId: string | null;
  setSelectedVideoId: (id: string) => void;
  topics: Topic[];
  cycleGoals: CycleGoal | null;
}

type ViewType = 'calendar' | 'weekly' | 'monthly' | 'yearly';

interface UnifiedPost {
  id: string;
  title: string;
  channelName: 'LearnDriven' | 'DecodeWorthy';
  format: 'Short' | 'Long' | 'Members';
  dateStr: string;
  source: 'pipeline' | 'video';
  state: 'published' | 'scheduled';
}

// Content types styling helper
const getFormatColor = (channel: 'LearnDriven' | 'DecodeWorthy', format: 'Short' | 'Long' | 'Members'): string => {
  if (channel === 'LearnDriven') {
    switch (format) {
      case 'Short': return '#10b981'; // Emerald
      case 'Long': return '#047857'; // Forest Green
      case 'Members': return '#0d9488'; // Teal
    }
  } else {
    switch (format) {
      case 'Short': return '#8b5cf6'; // Violet
      case 'Long': return '#4f46e5'; // Indigo
      case 'Members': return '#06b6d4'; // Cyan
    }
  }
  return '#4b5563';
};

const getFormatLabel = (channel: 'LearnDriven' | 'DecodeWorthy', format: 'Short' | 'Long' | 'Members'): string => {
  return `${channel} ${format}`;
};

export default function VideoLabView({ 
  videos, 
  setVideos, 
  selectedVideoId, 
  setSelectedVideoId,
  topics,
  cycleGoals
}: VideoLabProps) {
  const [viewMode, setViewMode] = useState<ViewType>('calendar');
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);
  const [hoveredDayData, setHoveredDayData] = useState<{ x: number; y: number; dateStr: string; posts: UnifiedPost[] } | null>(null);

  const handleMouseEnter = (e: React.MouseEvent, dateStr: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredDayData({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      dateStr,
      posts: postsByDate[dateStr] || []
    });
  };

  // Form states for adding new mock video
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newChannel, setNewChannel] = useState<'LearnDriven' | 'DecodeWorthy'>('LearnDriven');
  const [newFormat, setNewFormat] = useState<'Short' | 'Long' | 'Members'>('Short');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Parse publish date safely from video
  const parseVideoDateStr = (v: VideoRecord): string => {
    const rawDate = v.uploadDate || v.dueDate || v.publishTime || '';
    if (!rawDate) return '';
    return rawDate.split('T')[0];
  };

  // Merge pipeline topics (scheduled or posted) and the videos array
  const combinedPosts = useMemo(() => {
    const posts: UnifiedPost[] = [];
    
    // Add history from videos
    videos.forEach(v => {
      const dateStr = parseVideoDateStr(v);
      if (dateStr) {
        posts.push({
          id: v.id,
          title: v.title,
          channelName: v.channelName,
          format: v.format,
          dateStr: dateStr,
          source: 'video',
          state: 'published'
        });
      }
    });

    // Add active pipeline topics
    topics.forEach(t => {
      if (t.dueDate && (t.status === 'posted' || t.status === 'scheduled')) {
        posts.push({
          id: t.id,
          title: t.name,
          channelName: t.channel,
          format: t.format || 'Long', // Default to Long if undefined
          dateStr: t.dueDate.split('T')[0],
          source: 'pipeline',
          state: t.status === 'posted' ? 'published' : 'scheduled'
        });
      }
    });

    return posts;
  }, [videos, topics]);

  // Group combined posts by YYYY-MM-DD
  const postsByDate = useMemo(() => {
    const groups: { [dateStr: string]: UnifiedPost[] } = {};
    combinedPosts.forEach(p => {
      if (p.dateStr) {
        if (!groups[p.dateStr]) {
          groups[p.dateStr] = [];
        }
        groups[p.dateStr].push(p);
      }
    });
    return groups;
  }, [combinedPosts]);

  const consistency = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayKey = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const shiftDay = (date: Date, amount: number) => {
      const shifted = new Date(date);
      shifted.setDate(shifted.getDate() + amount);
      return shifted;
    };
    const published = combinedPosts
      .filter(post => post.state === 'published' && post.dateStr <= dayKey(today))
      .filter((post, index, list) => index === list.findIndex(candidate =>
        candidate.channelName === post.channelName
        && candidate.dateStr === post.dateStr
        && candidate.title.trim().toLowerCase() === post.title.trim().toLowerCase()
      ));
    const publishedDays = new Set(published.map(post => post.dateStr));
    const orderedDays = [...publishedDays].sort();
    const yesterdayKey = dayKey(shiftDay(today, -1));
    let streakCursor = publishedDays.has(dayKey(today)) ? today : publishedDays.has(yesterdayKey) ? shiftDay(today, -1) : null;
    let currentStreak = 0;
    while (streakCursor && publishedDays.has(dayKey(streakCursor))) {
      currentStreak += 1;
      streakCursor = shiftDay(streakCursor, -1);
    }
    let bestStreak = 0;
    let runningStreak = 0;
    let previousTime = 0;
    orderedDays.forEach(dateStr => {
      const time = new Date(`${dateStr}T00:00:00`).getTime();
      runningStreak = previousTime && time - previousTime === 864e5 ? runningStreak + 1 : 1;
      bestStreak = Math.max(bestStreak, runningStreak);
      previousTime = time;
    });
    const countBetween = (start: Date, end: Date) => published.filter(post => {
      const time = new Date(`${post.dateStr}T00:00:00`).getTime();
      return time >= start.getTime() && time <= end.getTime();
    }).length;
    const last7 = countBetween(shiftDay(today, -6), today);
    const previous7 = countBetween(shiftDay(today, -13), shiftDay(today, -7));
    const active30 = [...publishedDays].filter(dateStr => dateStr >= dayKey(shiftDay(today, -29)) && dateStr <= dayKey(today)).length;
    let longestGap30 = 0;
    let runningGap = 0;
    for (let offset = 29; offset >= 0; offset -= 1) {
      if (publishedDays.has(dayKey(shiftDay(today, -offset)))) runningGap = 0;
      else {
        runningGap += 1;
        longestGap30 = Math.max(longestGap30, runningGap);
      }
    }
    const weekly = Array.from({ length: 8 }, (_, index) => {
      const end = shiftDay(today, -(7 - index) * 7);
      const start = shiftDay(end, -6);
      return { label: `${start.getDate()}/${start.getMonth() + 1}`, count: countBetween(start, end) };
    });
    const goalTarget = cycleGoals ? [cycleGoals.learnDrivenShorts, cycleGoals.learnDrivenLong, cycleGoals.learnDrivenMembers, cycleGoals.decodeWorthyShorts].reduce<number>((sum, value) => sum + (value || 0), 0) : 0;
    const goalStart = cycleGoals ? new Date(`${cycleGoals.startDate}T00:00:00`) : new Date(today.getFullYear(), today.getMonth(), 1);
    const goalEnd = cycleGoals ? new Date(`${cycleGoals.endDate}T23:59:59`) : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    const goalDone = countBetween(goalStart, new Date(Math.min(today.getTime(), goalEnd.getTime())));
    const daysLeft = Math.max(0, Math.ceil((goalEnd.getTime() - today.getTime()) / 864e5));
    const remaining = Math.max(0, goalTarget - goalDone);
    const scheduledNext7 = combinedPosts.filter(post => post.state === 'scheduled' && post.dateStr >= dayKey(today) && post.dateStr <= dayKey(shiftDay(today, 6))).length;
    const weeklyTarget = goalTarget > 0 ? Math.max(1, Math.ceil(goalTarget / Math.max(1, Math.ceil((goalEnd.getTime() - goalStart.getTime()) / (7 * 864e5))))) : 0;
    const hitWeeks = weeklyTarget ? weekly.filter(week => week.count >= weeklyTarget).length : 0;
    return { currentStreak, bestStreak, last7, previous7, active30, longestGap30, weekly, goalTarget, goalDone, daysLeft, remaining, scheduledNext7, weeklyTarget, hitWeeks };
  }, [combinedPosts, cycleGoals]);

  // List of days in selected month
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDayIndex = new Date(selectedYear, selectedMonth, 1).getDay(); // 0 is Sunday
    
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    
    // Previous month padding
    const prevMonthDays = new Date(selectedYear, selectedMonth, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = selectedMonth === 0 ? 11 : selectedMonth - 1;
      const y = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
      days.push({
        dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: false
      });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        dateStr: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        dayNum: i,
        isCurrentMonth: true
      });
    }

    return days;
  }, [selectedYear, selectedMonth]);

  // Sequential days of the month (1-31 without weekday alignment padding)
  const sequentialMonthDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const days: { dateStr: string; dayNum: number }[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        dateStr: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        dayNum: i
      });
    }
    return days;
  }, [selectedYear, selectedMonth]);

  // Months lists
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Add mock video record helper
  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const mockRecord: VideoRecord = {
      id: `mock-vid-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      channelName: newChannel,
      title: newTitle.trim(),
      format: newFormat,
      contentType: 'Grid Simulated',
      topic: newTitle.trim(),
      pipelineStage: 'Published',
      uploadDate: new Date(newDate).toISOString(),
      scriptStatus: 'completed',
      shootStatus: 'completed',
      editStatus: 'completed',
      thumbnailStatus: 'completed',
      scheduleStatus: 'completed',
      publishedStatus: 'completed',
      productionEffortHours: 2,
      tags: []
    };

    setVideos(prev => [mockRecord, ...prev]);
    setNewTitle('');
    setShowAddForm(false);
  };

  // Delete video (if mock/video database item)
  const handleDeletePost = (post: UnifiedPost) => {
    if (post.source === 'pipeline') {
      alert("This post comes from an active pipeline topic. Please update or delete it in the pipeline dashboard.");
      return;
    }
    setVideos(prev => prev.filter(v => v.id !== post.id));
  };

  // Render subdivided grid blocks inside a day square
  const renderSubdividedBlock = (dateStr: string, sizeClass = 'h-full w-full') => {
    const dayPosts = postsByDate[dateStr] || [];
    if (dayPosts.length === 0) {
      return (
        <div className={`bg-neutral-900/60 border border-neutral-850/60 rounded-md transition duration-300 hover:border-neutral-700/80 ${sizeClass}`} />
      );
    }

    // Grid layout based on count
    const count = dayPosts.length;
    let gridStyle = {};
    if (count === 1) {
      gridStyle = { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
    } else if (count === 2) {
      gridStyle = { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
    } else if (count === 3) {
      gridStyle = { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }; // 2x2 with 3 elements
    } else {
      gridStyle = { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
    }

    const isYearly = sizeClass.includes('w-[12px]');

    return (
      <div 
        style={gridStyle}
        className={`grid gap-0.5 p-0.5 bg-neutral-900 border border-neutral-805 rounded-md overflow-hidden transition-all duration-300 hover:scale-[1.05] hover:shadow-[0_0_12px_rgba(139,92,246,0.15)] ${sizeClass}`}
      >
        {dayPosts.slice(0, 4).map((post) => {
          const color = getFormatColor(post.channelName, post.format);
          return (
            <div 
              key={post.id} 
              style={{ backgroundColor: color }}
              className="rounded-[2px] w-full h-full relative p-0.5 flex items-center justify-center overflow-hidden"
              title={`${post.title} (${getFormatLabel(post.channelName, post.format)})`}
            >
              {!isYearly && (
                <span className="text-[7px] leading-tight font-sans font-bold text-white/95 text-center truncate w-full px-0.5 select-none tracking-tight block">
                  {post.title}
                </span>
              )}
            </div>
          );
        })}
        {dayPosts.length > 4 && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[8px] font-mono text-white pointer-events-none">
            +{dayPosts.length - 4}
          </div>
        )}
      </div>
    );
  };

  // Helper alias for map rendering callback
  const p = { channelName: 'LearnDriven' as const, format: 'Short' as const };

  return (
    <div className="space-y-6 font-mono text-zinc-300 relative">
      
      {/* Top Banner Control Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950 border border-zinc-900 rounded-xl p-5 shadow-lg">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-indigo-500 animate-pulse" />
            <span>Video Consistency Lab</span>
          </h2>
          <p className="text-[10px] text-zinc-500 uppercase">
            Streaks, publishing cadence, goal pace, and release history from live production data
          </p>
        </div>

        {/* View selection tabs */}
        <div className="flex items-center gap-1.5 bg-zinc-900/60 p-1.5 rounded-lg border border-zinc-850">
          {(['calendar', 'weekly', 'monthly', 'yearly'] as ViewType[]).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                setSelectedDay(null);
              }}
              className={`px-3 py-1 text-[10px] rounded uppercase font-bold transition-all duration-200 ${
                viewMode === mode 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-850'
              }`}
            >
              {mode === 'monthly' ? 'Monthly (Single)' : mode}
            </button>
          ))}
        </div>
      </div>

      {/* Consistency and goal control surface */}
      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Current streak', value: `${consistency.currentStreak}d`, detail: 'consecutive publish days', icon: Flame, color: 'text-orange-400', border: 'border-orange-950/60' },
            { label: 'Best streak', value: `${consistency.bestStreak}d`, detail: 'all-time consecutive record', icon: Trophy, color: 'text-amber-400', border: 'border-amber-950/60' },
            { label: 'Published 7d', value: consistency.last7, detail: `${consistency.last7 - consistency.previous7 >= 0 ? '+' : ''}${consistency.last7 - consistency.previous7} vs previous 7d`, icon: Activity, color: 'text-cyan-400', border: 'border-cyan-950/60' },
            { label: 'Active days 30d', value: consistency.active30, detail: `${consistency.longestGap30}d longest blank gap`, icon: CalendarCheck, color: 'text-emerald-400', border: 'border-emerald-950/60' },
            { label: 'Scheduled 7d', value: consistency.scheduledNext7, detail: 'upcoming releases', icon: Clock, color: 'text-purple-400', border: 'border-purple-950/60' }
          ].map(metric => (
            <div key={metric.label} className={`rounded-xl border ${metric.border} bg-zinc-950/80 p-4`}>
              <div className="flex items-center justify-between"><span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">{metric.label}</span><metric.icon className={`h-4 w-4 ${metric.color}`} /></div>
              <div className="mt-3 text-2xl font-black text-white">{metric.value}</div>
              <div className="mt-1 text-[9px] text-zinc-600">{metric.detail}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/70 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div><div className="flex items-center gap-2 text-sm font-bold text-white"><Target className="h-4 w-4 text-indigo-400" /> Publishing goal</div><div className="mt-1 text-[9px] uppercase text-zinc-600">{cycleGoals?.monthName || 'No active cycle configured'}</div></div>
              <div className="text-right"><div className="text-lg font-black text-indigo-300">{consistency.goalDone}/{consistency.goalTarget || '-'}</div><div className="text-[8px] uppercase text-zinc-600">published / target</div></div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-zinc-900"><motion.div initial={{ width: 0 }} animate={{ width: `${consistency.goalTarget ? Math.min(100, Math.round((consistency.goalDone / consistency.goalTarget) * 100)) : 0}%` }} className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-violet-500 to-cyan-400" /></div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><div className="text-lg font-bold text-white">{consistency.remaining}</div><div className="text-[8px] uppercase text-zinc-600">remaining</div></div>
              <div><div className="text-lg font-bold text-white">{consistency.daysLeft}</div><div className="text-[8px] uppercase text-zinc-600">days left</div></div>
              <div><div className="text-lg font-bold text-white">{consistency.daysLeft ? (consistency.remaining / consistency.daysLeft).toFixed(2) : consistency.remaining}</div><div className="text-[8px] uppercase text-zinc-600">needed / day</div></div>
              <div><div className="text-lg font-bold text-white">{consistency.weeklyTarget || '-'}</div><div className="text-[8px] uppercase text-zinc-600">weekly target</div></div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-900 bg-zinc-950/70 p-5">
            <div className="mb-4 flex items-center justify-between"><div><div className="text-sm font-bold text-white">8-week cadence</div><div className="mt-1 text-[9px] uppercase text-zinc-600">published videos per rolling week</div></div><div className="text-right"><div className="text-lg font-black text-cyan-300">{consistency.hitWeeks}/8</div><div className="text-[8px] uppercase text-zinc-600">goal-hit weeks</div></div></div>
            <div className="flex h-24 items-end gap-2 border-b border-zinc-900 pb-2">
              {consistency.weekly.map((week, index) => {
                const max = Math.max(1, consistency.weeklyTarget, ...consistency.weekly.map(item => item.count));
                const hit = consistency.weeklyTarget > 0 && week.count >= consistency.weeklyTarget;
                return <div key={`${week.label}-${index}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1"><span className="text-[8px] text-zinc-500">{week.count}</span><div className={`w-full rounded-t ${hit ? 'bg-emerald-500' : 'bg-indigo-500/70'}`} style={{ height: `${Math.max(4, (week.count / max) * 62)}px` }} /><span className="text-[7px] text-zinc-700">{week.label}</span></div>;
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Grid Display Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Matrix Renderer (3 columns) */}
        <div className="lg:col-span-3 space-y-6 bg-zinc-950/40 border border-zinc-900/80 rounded-xl p-6">
          
          {/* Matrix Header Navigation */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
            <div className="flex items-center gap-3">
              {(viewMode === 'calendar' || viewMode === 'monthly') && (
                <>
                  <button 
                    onClick={() => {
                      if (selectedMonth === 0) {
                        setSelectedMonth(11);
                        setSelectedYear(y => y - 1);
                      } else {
                        setSelectedMonth(m => m - 1);
                      }
                    }}
                    className="p-1 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {monthNames[selectedMonth]} {selectedYear}
                  </span>
                  <button 
                    onClick={() => {
                      if (selectedMonth === 11) {
                        setSelectedMonth(0);
                        setSelectedYear(y => y + 1);
                      } else {
                        setSelectedMonth(m => m + 1);
                      }
                    }}
                    className="p-1 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {viewMode === 'weekly' && (
                <>
                  <button 
                    onClick={() => {
                      if (selectedWeekIdx === 0) {
                        // Go to last week of previous month
                        const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
                        const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
                        const prevMonthDaysCount = new Date(prevYear, prevMonth + 1, 0).getDate();
                        const prevMonthFirstDayIndex = new Date(prevYear, prevMonth, 1).getDay();
                        const totalPrevDays = prevMonthDaysCount + prevMonthFirstDayIndex;
                        const prevWeeksCount = Math.ceil(totalPrevDays / 7);
                        setSelectedMonth(prevMonth);
                        setSelectedYear(prevYear);
                        setSelectedWeekIdx(prevWeeksCount - 1);
                      } else {
                        setSelectedWeekIdx(w => w - 1);
                      }
                    }}
                    className="p-1 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {monthNames[selectedMonth]} {selectedYear} - Week {selectedWeekIdx + 1}
                  </span>
                  <button 
                    onClick={() => {
                      const maxWeeks = Math.ceil(calendarDays.length / 7);
                      if (selectedWeekIdx >= maxWeeks - 1) {
                        // Go to first week of next month
                        const nextMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
                        const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
                        setSelectedMonth(nextMonth);
                        setSelectedYear(nextYear);
                        setSelectedWeekIdx(0);
                      } else {
                        setSelectedWeekIdx(w => w + 1);
                      }
                    }}
                    className="p-1 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {viewMode === 'yearly' && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSelectedYear(y => y - 1)}
                    className="p-1 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Yearly Density Map: {selectedYear}
                  </span>
                  <button 
                    onClick={() => setSelectedYear(y => y + 1)}
                    className="p-1 bg-zinc-900 hover:bg-zinc-800 rounded border border-zinc-800 transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-800/40 text-indigo-400 text-[10px] px-3 py-1.5 rounded uppercase font-bold flex items-center gap-1.5 transition duration-300"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Simulate Upload</span>
            </button>
          </div>

          {/* Quick Simulation Form Overlay */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onSubmit={handleAddVideo}
                className="bg-zinc-950 border border-indigo-950 p-4 rounded-lg space-y-4 overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] text-zinc-400 uppercase font-bold">Video Title</label>
                    <input 
                      type="text" 
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="Enter title..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-600"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-zinc-400 uppercase font-bold">Channel</label>
                    <select
                      value={newChannel}
                      onChange={e => setNewChannel(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-600"
                    >
                      <option value="LearnDriven">LearnDriven</option>
                      <option value="DecodeWorthy">DecodeWorthy</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-zinc-400 uppercase font-bold">Format Type</label>
                    <select
                      value={newFormat}
                      onChange={e => setNewFormat(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-600"
                    >
                      <option value="Short">Short</option>
                      <option value="Long">Long</option>
                      <option value="Members">Members Only</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2 border-t border-zinc-900">
                  <div className="space-y-1">
                    <label className="text-[9px] text-zinc-400 uppercase font-bold">Release Date</label>
                    <input 
                      type="date" 
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-600 font-sans"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 text-[10px] uppercase font-bold text-zinc-500 hover:text-zinc-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-4 py-1.5 rounded uppercase"
                    >
                      Add to Grid
                    </button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* VIEW: CALENDAR */}
          {viewMode === 'calendar' && (
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
              </div>
              <div className="grid grid-cols-7 gap-2.5">
                {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
                  const dayPosts = postsByDate[dateStr] || [];
                  const isSelected = selectedDay === dateStr;

                  return (
                    <div 
                      key={dateStr}
                      onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                      onMouseEnter={(e) => handleMouseEnter(e, dateStr)}
                      onMouseLeave={() => setHoveredDayData(null)}
                      className={`relative aspect-square cursor-pointer flex flex-col justify-between ${
                        isCurrentMonth ? '' : 'opacity-30'
                      }`}
                    >
                      {/* Subdivided blocks inside the cell */}
                      {renderSubdividedBlock(dateStr, 'h-full w-full')}
                      
                      {/* Calendar Day Label overlay */}
                      <span className={`absolute top-1.5 left-2 text-[9px] font-bold ${
                        isSelected 
                          ? 'text-indigo-400 font-black scale-110' 
                          : dayPosts.length > 0 ? 'text-zinc-100' : 'text-zinc-600'
                      }`}>
                        {dayNum}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: WEEKLY */}
          {viewMode === 'weekly' && (() => {
            const weekDays = calendarDays.slice(selectedWeekIdx * 7, (selectedWeekIdx + 1) * 7);
            if (weekDays.length === 0) return null;

            return (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">Week {selectedWeekIdx + 1} Feed View</span>
                  <span className="text-[8px] text-zinc-400 font-mono">
                    Total Week Posts: {
                      weekDays.reduce((acc, d) => acc + (postsByDate[d.dateStr]?.length || 0), 0)
                    }
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-3">
                  {weekDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
                    const dayPosts = postsByDate[dateStr] || [];
                    const isSelected = selectedDay === dateStr;
                    const weekdayName = new Date(dateStr).toLocaleDateString([], { weekday: 'short' });

                    return (
                      <div 
                        key={dateStr}
                        onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                        onMouseEnter={(e) => handleMouseEnter(e, dateStr)}
                        onMouseLeave={() => setHoveredDayData(null)}
                        className={`cursor-pointer transition-all duration-300 ${isCurrentMonth ? '' : 'opacity-25'}`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[9px] font-bold ${isSelected ? 'text-indigo-400 font-black' : 'text-zinc-500'}`}>
                            {dayNum} - {weekdayName}
                          </span>
                          {dayPosts.length > 0 && (
                            <span className="text-[8px] bg-indigo-950 text-indigo-400 px-1 rounded-sm">{dayPosts.length}p</span>
                          )}
                        </div>
                        <div className="aspect-square">
                          {renderSubdividedBlock(dateStr, 'h-full w-full')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* VIEW: MONTHLY (ELABORATED SINGLE MONTH 1-31 GRID MAP) */}
          {viewMode === 'monthly' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Sequential Monthly Grid Map</span>
                <span className="text-[9px] text-zinc-400 font-mono">
                  {monthNames[selectedMonth]} Total Publications: {
                    sequentialMonthDays.reduce((acc, d) => acc + (postsByDate[d.dateStr]?.length || 0), 0)
                  }
                </span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 gap-3">
                {sequentialMonthDays.map(({ dateStr, dayNum }) => {
                  const dayPosts = postsByDate[dateStr] || [];
                  const isSelected = selectedDay === dateStr;
                  const weekdayName = new Date(dateStr).toLocaleDateString([], { weekday: 'short' });

                  return (
                    <div 
                      key={dateStr}
                      onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                      onMouseEnter={(e) => handleMouseEnter(e, dateStr)}
                      onMouseLeave={() => setHoveredDayData(null)}
                      className="relative aspect-square cursor-pointer flex flex-col justify-between"
                    >
                      {/* Subdivided blocks inside the cell */}
                      {renderSubdividedBlock(dateStr, 'h-full w-full')}
                      
                      {/* Calendar Day Label overlay */}
                      <span className={`absolute top-1.5 left-2 text-[9px] font-bold ${
                        isSelected 
                          ? 'text-indigo-400 font-black scale-110' 
                          : dayPosts.length > 0 ? 'text-zinc-100' : 'text-zinc-600'
                      }`}>
                        Day {dayNum} - {weekdayName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: YEARLY */}
          {viewMode === 'yearly' && (
            <div className="space-y-4 overflow-x-auto select-none py-2">
              <div className="flex gap-[3px] min-w-[700px]">
                {/* Day of week labels */}
                <div className="grid grid-rows-7 gap-[3px] text-[8px] text-zinc-600 font-bold pr-1 pt-4 select-none">
                  <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
                </div>

                {/* 53 Columns of Weeks */}
                {Array.from({ length: 53 }).map((_, weekIdx) => {
                  return (
                    <div key={weekIdx} className="grid grid-rows-7 gap-[3px] w-full">
                      {Array.from({ length: 7 }).map((_, dayIdx) => {
                        // Calculate specific date
                        const startOfYear = new Date(selectedYear, 0, 1);
                        const startDayOfWeek = startOfYear.getDay();
                        const dayOffset = (weekIdx * 7) + dayIdx - startDayOfWeek;
                        const date = new Date(selectedYear, 0, 1 + dayOffset);
                        
                        const isValidYear = date.getFullYear() === selectedYear;
                        const dateStr = date.toISOString().split('T')[0];
                        const dayPosts = postsByDate[dateStr] || [];

                        if (!isValidYear) {
                          return <div key={dayIdx} className="w-[11px] h-[11px] bg-transparent" />;
                        }

                        return (
                          <div
                            key={dayIdx}
                            onClick={() => setSelectedDay(selectedDay === dateStr ? null : dateStr)}
                            onMouseEnter={(e) => handleMouseEnter(e, dateStr)}
                            onMouseLeave={() => setHoveredDayData(null)}
                            className="relative cursor-pointer"
                          >
                            {renderSubdividedBlock(dateStr, 'w-[12px] h-[12px]')}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Month Markers below matrix */}
              <div className="flex justify-between text-[8px] font-bold text-zinc-600 px-6 uppercase pt-1">
                {monthNames.map(name => <span key={name}>{name.substring(0, 3)}</span>)}
              </div>
            </div>
          )}

        </div>

        {/* Right Side: Day Details & Interactive Feed Monitor (1 column) */}
        <div className="space-y-6">
          
          {/* Day Feed panel */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-indigo-400" />
                <span>Selected Day Feed</span>
              </h3>
              {selectedDay && (
                <span className="text-[9px] font-mono text-zinc-500 uppercase">{selectedDay}</span>
              )}
            </div>

            {selectedDay ? (
              <div className="space-y-4">
                {(() => {
                  const dayPosts = postsByDate[selectedDay] || [];
                  if (dayPosts.length === 0) {
                    return (
                      <div className="text-center py-8 text-zinc-500 text-[10px] border border-dashed border-zinc-900 rounded-lg">
                        No videos published on this day. Use "Simulate Upload" to add some!
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {dayPosts.map(post => {
                        const color = getFormatColor(post.channelName, post.format);
                        return (
                          <div 
                            key={post.id}
                            className="bg-zinc-900/30 border border-zinc-900 rounded-lg p-3 space-y-2 relative overflow-hidden"
                          >
                            {/* Color strip */}
                            <div className="absolute top-0 left-0 bottom-0 w-1" style={{ backgroundColor: color }} />
                            
                            <div className="flex justify-between items-start pl-2">
                              <span className="text-[10px] font-bold text-white tracking-tight line-clamp-2 pr-4">{post.title}</span>
                              {post.source === 'video' ? (
                                <button 
                                  onClick={() => handleDeletePost(post)}
                                  className="text-zinc-600 hover:text-red-400 p-0.5"
                                  title="Remove mock record"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              ) : (
                                <span className="text-[7px] bg-indigo-950 text-indigo-400 border border-indigo-900/40 px-1 py-0.2 rounded font-bold" title="Live Pipeline Item">Pipeline</span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1.5 pl-2">
                              <span 
                                style={{ borderColor: `${color}40`, color: color }}
                                className="px-1.5 py-0.2 bg-zinc-950 border rounded text-[8px] font-bold"
                              >
                                {post.channelName}
                              </span>
                              <span className="px-1.5 py-0.2 bg-zinc-900 text-zinc-400 border border-zinc-850 rounded text-[8px]">
                                {post.format}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 text-[10px] leading-normal uppercase">
                Select any square grid block in the matrix to view the publications and metrics feed for that day.
              </div>
            )}
          </div>

          {/* Color Legend panel */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
              <Layers className="h-4 w-4 text-emerald-400" />
              <span>Matrix Legend</span>
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-[9px] text-zinc-500 font-bold uppercase block tracking-wider">LearnDriven Channel</span>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: getFormatColor('LearnDriven', 'Short') }} />
                    <span className="text-[9px] text-zinc-400">Short Video (#10b981)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: getFormatColor('LearnDriven', 'Long') }} />
                    <span className="text-[9px] text-zinc-400">Long Video (#047857)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: getFormatColor('LearnDriven', 'Members') }} />
                    <span className="text-[9px] text-zinc-400">Members Only (#0d9488)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-zinc-900 pt-3">
                <span className="text-[9px] text-zinc-500 font-bold uppercase block tracking-wider">DecodeWorthy Channel</span>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: getFormatColor('DecodeWorthy', 'Short') }} />
                    <span className="text-[9px] text-zinc-400">Short Video (#8b5cf6)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: getFormatColor('DecodeWorthy', 'Long') }} />
                    <span className="text-[9px] text-zinc-400">Long Video (#4f46e5)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: getFormatColor('DecodeWorthy', 'Members') }} />
                    <span className="text-[9px] text-zinc-400">Members Only (#06b6d4)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Floating Tooltip */}
      <AnimatePresence>
        {hoveredDayData && hoveredDayData.posts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{ 
              position: 'fixed', 
              left: `${hoveredDayData.x}px`, 
              top: `${hoveredDayData.y}px`, 
              transform: 'translate(-50%, -100%)' 
            }}
            className="z-50 bg-zinc-950/95 border border-zinc-800 p-3 rounded-lg shadow-2xl w-64 space-y-2 pointer-events-none font-mono text-[10px] backdrop-blur-md"
          >
            <div className="border-b border-zinc-900 pb-1.5 flex justify-between items-center text-zinc-500 font-bold uppercase">
              <span>{new Date(hoveredDayData.dateStr).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span className="bg-zinc-900 px-1 py-0.2 rounded text-zinc-400">{hoveredDayData.posts.length} Posts</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {hoveredDayData.posts.map(post => {
                const color = getFormatColor(post.channelName, post.format);
                return (
                  <div key={post.id} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-[8px] font-bold uppercase" style={{ color }}>{post.channelName}</span>
                      <span className="text-[8px] text-zinc-600 bg-zinc-900 border border-zinc-850 px-1 rounded-sm">{post.format}</span>
                    </div>
                    <p className="text-white leading-normal pl-3 font-semibold line-clamp-2">{post.title}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

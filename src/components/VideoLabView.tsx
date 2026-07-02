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
  Trash2 
} from 'lucide-react';
import { VideoRecord, Topic } from '../types';

interface VideoLabProps {
  videos: VideoRecord[];
  setVideos: React.Dispatch<React.SetStateAction<VideoRecord[]>>;
  selectedVideoId: string | null;
  setSelectedVideoId: (id: string) => void;
  topics: Topic[];
}

type ViewType = 'calendar' | 'weekly' | 'monthly' | 'yearly';

interface UnifiedPost {
  id: string;
  title: string;
  channelName: 'LearnDriven' | 'DecodeWorthy';
  format: 'Short' | 'Long' | 'Members';
  dateStr: string;
  source: 'pipeline' | 'video';
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
  topics
}: VideoLabProps) {
  const [viewMode, setViewMode] = useState<ViewType>('calendar');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(6); // July (0-indexed: 6)
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
  const [newDate, setNewDate] = useState('2026-07-04');

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
          source: 'video'
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
          source: 'pipeline'
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
      productionEffortHours: 2
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
            <span>Content Activity Matrix</span>
          </h2>
          <p className="text-[10px] text-zinc-500 uppercase">
            Visual publication density grid mapped directly to pipeline pipeline updates & database records
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

                    return (
                      <div 
                        key={dateStr}
                        onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                        onMouseEnter={(e) => handleMouseEnter(e, dateStr)}
                        onMouseLeave={() => setHoveredDayData(null)}
                        className={`cursor-pointer transition-all duration-300 ${isCurrentMonth ? '' : 'opacity-25'}`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[9px] font-bold ${isSelected ? 'text-indigo-400 font-black' : 'text-zinc-500'}`}>{dayNum}</span>
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
                        Day {dayNum}
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
              <span>{new Date(hoveredDayData.dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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

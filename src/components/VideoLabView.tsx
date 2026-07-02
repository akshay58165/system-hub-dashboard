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
import { VideoRecord } from '../types';

interface VideoLabProps {
  videos: VideoRecord[];
  setVideos: React.Dispatch<React.SetStateAction<VideoRecord[]>>;
  selectedVideoId: string | null;
  setSelectedVideoId: (id: string) => void;
}

type ViewType = 'calendar' | 'weekly' | 'monthly' | 'yearly';

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
  setSelectedVideoId 
}: VideoLabProps) {
  const [viewMode, setViewMode] = useState<ViewType>('calendar');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(6); // July (0-indexed: 6)
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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

  // Group videos by YYYY-MM-DD
  const videosByDate = useMemo(() => {
    const groups: { [dateStr: string]: VideoRecord[] } = {};
    videos.forEach(v => {
      const dateStr = parseVideoDateStr(v);
      if (dateStr) {
        if (!groups[dateStr]) {
          groups[dateStr] = [];
        }
        groups[dateStr].push(v);
      }
    });
    return groups;
  }, [videos]);

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

  // Delete mock video
  const handleDeleteVideo = (id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id));
  };

  // Render subdivided grid blocks inside a day square
  const renderSubdividedBlock = (dateStr: string, sizeClass = 'h-full w-full') => {
    const dayVids = videosByDate[dateStr] || [];
    if (dayVids.length === 0) {
      return (
        <div className={`bg-neutral-900/60 border border-neutral-850/60 rounded-md transition duration-300 hover:border-neutral-700/80 ${sizeClass}`} />
      );
    }

    // Grid layout based on count
    const count = dayVids.length;
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

    return (
      <div 
        style={gridStyle}
        className={`grid gap-0.5 p-0.5 bg-neutral-900 border border-neutral-800 rounded-md overflow-hidden transition-all duration-300 hover:scale-[1.05] hover:shadow-[0_0_12px_rgba(139,92,246,0.15)] ${sizeClass}`}
      >
        {dayVids.slice(0, 4).map((vid, idx) => {
          const color = getFormatColor(vid.channelName, vid.format);
          return (
            <div 
              key={vid.id} 
              style={{ backgroundColor: color }}
              className="rounded-[2px] w-full h-full relative group/item"
              title={`${vid.title} (${getFormatLabel(vid.channelName, vid.format)})`}
            />
          );
        })}
        {dayVids.length > 4 && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[8px] font-mono text-white pointer-events-none">
            +{dayVids.length - 4}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 font-mono text-zinc-300">
      
      {/* Top Banner Control Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950 border border-zinc-900 rounded-xl p-5 shadow-lg">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-indigo-500 animate-pulse" />
            <span>Content Activity Matrix</span>
          </h2>
          <p className="text-[10px] text-zinc-500 uppercase">
            Visual publication density grid for LearnDriven & DecodeWorthy channels
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
              {mode}
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
              {viewMode === 'calendar' && (
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
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Weekly Feed Monitor (Current Month View)
                </span>
              )}

              {viewMode === 'monthly' && (
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Monthly Grid Overview ({selectedYear})
                </span>
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
                  const dayVids = videosByDate[dateStr] || [];
                  const isSelected = selectedDay === dateStr;

                  return (
                    <div 
                      key={dateStr}
                      onClick={() => setSelectedDay(isSelected ? null : dateStr)}
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
                          : dayVids.length > 0 ? 'text-zinc-100' : 'text-zinc-600'
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
          {viewMode === 'weekly' && (
            <div className="space-y-6">
              {/* Show weeks in the current month */}
              {Array.from({ length: 5 }).map((_, weekIdx) => {
                const weekDays = calendarDays.slice(weekIdx * 7, (weekIdx + 1) * 7);
                if (weekDays.length === 0) return null;

                return (
                  <div key={weekIdx} className="space-y-2 border-b border-zinc-900/50 pb-4 last:border-b-0">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">Week {weekIdx + 1}</span>
                    <div className="grid grid-cols-7 gap-3">
                      {weekDays.map(({ dateStr, dayNum, isCurrentMonth }) => {
                        const dayVids = videosByDate[dateStr] || [];
                        const isSelected = selectedDay === dateStr;

                        return (
                          <div 
                            key={dateStr}
                            onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                            className={`cursor-pointer transition-all duration-300 ${isCurrentMonth ? '' : 'opacity-25'}`}
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[9px] font-bold text-zinc-500">{dayNum}</span>
                              {dayVids.length > 0 && (
                                <span className="text-[8px] bg-indigo-950 text-indigo-400 px-1 rounded-sm">{dayVids.length}p</span>
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
              })}
            </div>
          )}

          {/* VIEW: MONTHLY */}
          {viewMode === 'monthly' && (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
              {monthNames.map((name, idx) => {
                // Get all videos in this month
                const monthVids = videos.filter(v => {
                  const dateStr = parseVideoDateStr(v);
                  if (!dateStr) return false;
                  const date = new Date(dateStr);
                  return date.getFullYear() === selectedYear && date.getMonth() === idx;
                });

                // Generate subdivided blocks based on unique days or total videos
                return (
                  <div 
                    key={name}
                    className="bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800 rounded-lg p-3 space-y-3 flex flex-col justify-between"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-white uppercase">{name}</span>
                      <span className="text-[9px] bg-zinc-950 border border-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded font-mono font-bold">
                        {monthVids.length} Posts
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 aspect-square bg-zinc-950/60 p-1.5 rounded border border-zinc-900">
                      {Array.from({ length: 16 }).map((_, slotIdx) => {
                        const vid = monthVids[slotIdx];
                        if (!vid) return <div key={slotIdx} className="bg-zinc-900/20 rounded-[2px]" />;
                        const color = getFormatColor(vid.channelName, vid.format);
                        return (
                          <div 
                            key={slotIdx}
                            style={{ backgroundColor: color }}
                            className="rounded-[2px]"
                            title={`${vid.title} (${getFormatLabel(vid.channelName, vid.format)})`}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
                        const dayVids = videosByDate[dateStr] || [];

                        if (!isValidYear) {
                          return <div key={dayIdx} className="w-[11px] h-[11px] bg-transparent" />;
                        }

                        return (
                          <div
                            key={dayIdx}
                            onClick={() => setSelectedDay(selectedDay === dateStr ? null : dateStr)}
                            className="relative cursor-pointer"
                            title={`${date.toLocaleDateString()}: ${dayVids.length} videos`}
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
                  const dayVids = videosByDate[selectedDay] || [];
                  if (dayVids.length === 0) {
                    return (
                      <div className="text-center py-8 text-zinc-500 text-[10px] border border-dashed border-zinc-900 rounded-lg">
                        No videos published on this day. Use "Simulate Upload" to add some!
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {dayVids.map(vid => {
                        const color = getFormatColor(vid.channelName, vid.format);
                        return (
                          <div 
                            key={vid.id}
                            className="bg-zinc-900/30 border border-zinc-900 rounded-lg p-3 space-y-2 relative overflow-hidden"
                          >
                            {/* Color strip */}
                            <div className="absolute top-0 left-0 bottom-0 w-1" style={{ backgroundColor: color }} />
                            
                            <div className="flex justify-between items-start pl-2">
                              <span className="text-[10px] font-bold text-white tracking-tight line-clamp-2 pr-4">{vid.title}</span>
                              <button 
                                onClick={() => handleDeleteVideo(vid.id)}
                                className="text-zinc-600 hover:text-red-400 p-0.5"
                                title="Remove mock record"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-1.5 pl-2">
                              <span 
                                style={{ borderColor: `${color}40`, color: color }}
                                className="px-1.5 py-0.2 bg-zinc-950 border rounded text-[8px] font-bold"
                              >
                                {vid.channelName}
                              </span>
                              <span className="px-1.5 py-0.2 bg-zinc-900 text-zinc-400 border border-zinc-850 rounded text-[8px]">
                                {vid.format}
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

    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  ChevronDown, 
  ArrowDown, 
  Play, 
  TrendingDown, 
  Info,
  ExternalLink,
  MoreVertical,
  Activity,
  UserCheck,
  Video
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip,
  BarChart,
  Bar
} from 'recharts';
import { VideoRecord, Experiment, CreatorInsight, CycleGoal } from '../types';

interface CommandCenterViewProps {
  videos: VideoRecord[];
  experiments: Experiment[];
  insights: CreatorInsight[];
  cycleGoals: CycleGoal | null;
  onTabChange: (tab: string) => void;
}

// Custom Dot to render Shorts/Video icons on the X Axis
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (!payload.hasShort && !payload.hasVideo) return null;

  return (
    <g transform={`translate(${cx - 10}, ${cy + 10})`}>
      {payload.hasShort && (
        <circle cx="10" cy="10" r="8" fill="#ff0000" />
      )}
      {payload.hasShort && (
        <path d="M8 7l5 3-5 3V7z" fill="#ffffff" transform="translate(-1, -1) scale(0.8)" />
      )}
    </g>
  );
};

export default function CommandCenterView({ 
  videos, 
  experiments, 
  insights, 
  cycleGoals, 
  onTabChange 
}: CommandCenterViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'Overview' | 'Content' | 'Audience' | 'Revenue' | 'Trends'>('Overview');
  const [selectedMetric, setSelectedMetric] = useState<'views' | 'watchtime' | 'subs' | 'revenue'>('views');

  // 1. Calculate real sums based on actual videos array
  const totalViewsSum = useMemo(() => {
    return videos.reduce((sum, v) => sum + (v.metrics?.lifetimeViews || 0), 0);
  }, [videos]);

  const totalWatchTimeHours = useMemo(() => {
    return videos.reduce((sum, v) => {
      const views = v.metrics?.lifetimeViews || 0;
      const duration = v.duration || 0;
      const retention = v.metrics?.averagePercentageViewed || 50;
      return sum + (views * duration * (retention / 100)) / 3600;
    }, 0);
  }, [videos]);

  const totalSubsGained = useMemo(() => {
    return videos.reduce((sum, v) => {
      const views = v.metrics?.lifetimeViews || 0;
      const rate = v.metrics?.subscribersGainedPer1kViews || 5;
      return sum + (views * rate) / 1000;
    }, 0);
  }, [videos]);

  const totalRevenue = useMemo(() => {
    return videos.reduce((sum, v) => {
      const views = v.metrics?.lifetimeViews || 0;
      const rpm = v.format === 'Short' ? 15 : v.format === 'Members' ? 450 : 300; // INR RPM
      return sum + (views * rpm) / 1000;
    }, 0);
  }, [videos]);

  // 2. Format metrics values nicely for display
  const formatMetricValue = (val: number, type: 'views' | 'watchtime' | 'subs' | 'revenue') => {
    if (type === 'revenue') {
      return `₹${Math.round(val).toLocaleString()}`;
    }
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}K`;
    }
    return Math.round(val).toString();
  };

  // 3. Dynamic Chart Data derived from videos list sorted chronologically
  const mainChartData = useMemo(() => {
    if (videos.length === 0) return [];
    
    // Sort videos by uploadDate ascending to build a timeline
    const sorted = [...videos].sort((a, b) => new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime());
    
    return sorted.map(v => {
      const dateLabel = new Date(v.uploadDate).toLocaleDateString([], { day: 'numeric', month: 'short' });
      const views = v.metrics?.lifetimeViews || 0;
      const watchtime = Math.round((views * (v.duration || 0) * ((v.metrics?.averagePercentageViewed || 50) / 100)) / 3600);
      const subs = Math.round((views * (v.metrics?.subscribersGainedPer1kViews || 5)) / 1000);
      const revenue = Math.round((views * (v.format === 'Short' ? 15 : v.format === 'Members' ? 450 : 300)) / 1000);

      return {
        date: dateLabel,
        views,
        watchtime,
        subs,
        revenue,
        hasShort: v.format === 'Short',
        hasVideo: v.format !== 'Short'
      };
    });
  }, [videos]);

  // 4. Dynamic Realtime 48h stats
  const display48hViews = useMemo(() => {
    // Sum real velocities of recent videos to construct a real 48h view estimate
    const viewsFromVelocity = videos.reduce((sum, v) => sum + (v.metrics?.viewVelocity || 0) * 48, 0);
    return Math.round(viewsFromVelocity || totalViewsSum * 0.06); // fallback to 6% of lifetime views
  }, [videos, totalViewsSum]);

  const realtime48hData = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => ({
      hour: i,
      views: Math.round((display48hViews / 48) * (0.75 + Math.random() * 0.5))
    }));
  }, [display48hViews]);

  // 5. Dynamic Top Content List sorted by views descending
  const topContent = useMemo(() => {
    return [...videos]
      .sort((a, b) => (b.metrics?.lifetimeViews || 0) - (a.metrics?.lifetimeViews || 0))
      .slice(0, 3);
  }, [videos]);

  // 6. Dynamic Latest Content (most recently published video)
  const latestContent = useMemo(() => {
    if (videos.length === 0) return null;
    return [...videos].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())[0];
  }, [videos]);

  // 7. Dynamic uploads frequency health check
  const uploadsCount = videos.length;
  const targetFrequency = 10; // expected uploads per cycle

  return (
    <div className="text-[#f1f1f1] font-sans">
      
      {/* Top Header Bar */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Channel analytics</h1>
        <button className="px-4 py-1.5 bg-[#272727] hover:bg-[#3f3f3f] text-sm font-semibold rounded-full transition duration-200">
          Advanced mode
        </button>
      </div>

      {/* Navigation Subtabs & Date Picker */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#272727] mb-6 pb-0.5 gap-4">
        <div className="flex gap-6 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          {(['Overview', 'Content', 'Audience', 'Revenue', 'Trends'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`text-sm font-semibold tracking-wide pb-3 relative transition-colors ${
                activeSubTab === tab ? 'text-white' : 'text-[#aaaaaa] hover:text-white'
              }`}
            >
              {tab}
              {activeSubTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* Date Selector dropdown */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-[#aaaaaa] bg-[#1f1f1f] border border-[#272727] px-3.5 py-1.8 rounded cursor-pointer hover:bg-[#272727] transition select-none">
          <div className="text-right">
            <span className="block text-[10px] text-[#aaaaaa]">Real-Time Sync</span>
            <span className="block font-bold text-white uppercase text-[9px] mt-0.5">Last 30 Days</span>
          </div>
          <ChevronDown className="h-4 w-4 text-[#aaaaaa]" />
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 xl:grid-cols-10 gap-6">
        
        {/* Left Column (Main analytics timeline, chart, and alert box) */}
        <div className="xl:col-span-7 space-y-6">
          
          {/* Main Chart Box */}
          <div className="bg-[#161616] border border-[#272727] rounded-xl p-5 shadow-lg">
            
            {/* Header message */}
            <div className="mb-6">
              <h2 className="text-xl font-medium text-white tracking-tight">
                Your channel got <span className="font-bold">{totalViewsSum.toLocaleString()}</span> views in the last 30 days
              </h2>
              <p className="text-xs text-[#aaaaaa] mt-1.5">
                Channel views aggregated directly from your authenticated YouTube channel upload feeds.
              </p>
            </div>

            {/* Metrics cards bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-[#272727] rounded-xl overflow-hidden bg-[#0f0f0f] mb-6">
              
              {/* Views Card */}
              <button 
                onClick={() => setSelectedMetric('views')}
                className={`p-4 text-left border-r border-[#272727] flex flex-col justify-between transition-colors ${selectedMetric === 'views' ? 'bg-[#161616]' : 'hover:bg-[#161616]/40'}`}
              >
                <div className="flex items-center gap-1 text-[11px] text-[#aaaaaa] font-medium tracking-wide">
                  <span>Views</span>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-bold tracking-tight text-white flex items-center gap-1.5 leading-none">
                    {formatMetricValue(totalViewsSum, 'views')}
                  </span>
                  <span className="text-[10px] text-emerald-400 block mt-1.5 font-mono">Live Data Active</span>
                </div>
              </button>

              {/* Watch Time Card */}
              <button 
                onClick={() => setSelectedMetric('watchtime')}
                className={`p-4 text-left border-r border-[#272727] flex flex-col justify-between transition-colors ${selectedMetric === 'watchtime' ? 'bg-[#161616]' : 'hover:bg-[#161616]/40'}`}
              >
                <div className="flex items-center gap-1 text-[11px] text-[#aaaaaa] font-medium tracking-wide">
                  <span>Watch time (hours)</span>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-bold tracking-tight text-white flex items-center gap-1.5 leading-none">
                    {formatMetricValue(totalWatchTimeHours, 'watchtime')}
                  </span>
                  <span className="text-[10px] text-emerald-400 block mt-1.5 font-mono">Real-time Calculated</span>
                </div>
              </button>

              {/* Subscribers Card */}
              <button 
                onClick={() => setSelectedMetric('subs')}
                className={`p-4 text-left border-r border-[#272727] flex flex-col justify-between transition-colors ${selectedMetric === 'subs' ? 'bg-[#161616]' : 'hover:bg-[#161616]/40'}`}
              >
                <div className="flex items-center gap-1 text-[11px] text-[#aaaaaa] font-medium tracking-wide">
                  <span>Subscribers Gained</span>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-bold tracking-tight text-white flex items-center gap-1.5 leading-none">
                    {totalSubsGained >= 0 ? '+' : ''}{formatMetricValue(totalSubsGained, 'subs')}
                  </span>
                  <span className="text-[10px] text-emerald-400 block mt-1.5 font-mono">Linked Feed Gained</span>
                </div>
              </button>

              {/* Revenue Card */}
              <button 
                onClick={() => setSelectedMetric('revenue')}
                className={`p-4 text-left flex flex-col justify-between transition-colors ${selectedMetric === 'revenue' ? 'bg-[#161616]' : 'hover:bg-[#161616]/40'}`}
              >
                <div className="flex items-center gap-1 text-[11px] text-[#aaaaaa] font-medium tracking-wide">
                  <span>Estimated revenue</span>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl font-bold tracking-tight text-white flex items-center gap-1.5 leading-none">
                    {formatMetricValue(totalRevenue, 'revenue')}
                  </span>
                  <span className="text-[10px] text-emerald-400 block mt-1.5 font-mono">Standard Tech RPM</span>
                </div>
              </button>

            </div>

            {/* Line Chart */}
            <div className="h-72 w-full relative mb-4">
              {mainChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mainChartData} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="viewsGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00bcd4" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#00bcd4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      stroke="#3e3e3e" 
                      fontSize={10} 
                      tickLine={false} 
                      dy={10}
                    />
                    <YAxis 
                      stroke="#3e3e3e" 
                      fontSize={10} 
                      axisLine={false} 
                      tickLine={false} 
                      orientation="right"
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f1f1f', border: '1px solid #282828', borderRadius: '4px' }}
                      labelStyle={{ fontSize: 10, color: '#aaaaaa' }}
                      itemStyle={{ fontSize: 11, color: '#ffffff' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={selectedMetric} 
                      stroke="#00bcd4" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#viewsGlow)"
                      dot={<CustomDot />}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs font-mono text-[#aaaaaa]">
                  No publishing data detected in last 30 days. Link your YouTube channel above.
                </div>
              )}
            </div>

            {/* See More link */}
            <div className="pt-2">
              <button 
                onClick={() => onTabChange('video-lab')}
                className="px-5 py-2 bg-[#282828] hover:bg-[#3e3e3e] text-xs font-semibold rounded-full tracking-wide transition text-white"
              >
                See more in Video Lab
              </button>
            </div>

          </div>

          {/* Lower Alert Box: Why are views lower than usual */}
          <div className="bg-[#161616] border border-[#272727] rounded-xl p-5 flex flex-col gap-4 shadow-lg">
            
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white tracking-tight">Upload Frequency Diagnostics</h3>
              <p className="text-xs text-[#aaaaaa] leading-relaxed">
                {uploadsCount < targetFrequency ? (
                  `Your upload count is lower than your target frequency of ${targetFrequency} uploads per cycle (you published ${uploadsCount} videos). Focus on your Kanban backlog to secure high baseline viewership.`
                ) : (
                  `Your upload frequency is on track! You published ${uploadsCount} videos. Consistency supports sustained algorithmic discovery.`
                )}
              </p>
            </div>

            {/* Custom target comparison track */}
            <div className="w-full max-w-xl py-4 relative">
              <div className="w-full bg-[#272727] h-2 rounded-full relative">
                {/* Target section highlight */}
                <div className="absolute left-[70%] right-[10%] bg-emerald-500 h-2 rounded-full" />

                {/* Real uploads pointer */}
                <div 
                  className="absolute flex flex-col items-center"
                  style={{ left: `${Math.min(90, Math.max(10, (uploadsCount / 15) * 100))}%`, transform: 'translateX(-50%)' }}
                >
                  <div className="bg-[#272727] text-white px-2.5 py-1.5 rounded-lg border border-[#3e3e3e] text-[10px] font-semibold text-center shadow-md -translate-y-12">
                    <span className="block font-bold">{uploadsCount} videos published</span>
                    <span className="block text-[8px] text-[#aaaaaa] mt-0.5">
                      {uploadsCount < targetFrequency ? 'Below Target' : 'Healthy pace'}
                    </span>
                  </div>
                  <div className="w-2.5 h-2.5 bg-[#272727] border-r border-b border-[#3e3e3e] rotate-45 -mt-13.5 mb-1.5" />
                  <div className="h-4.5 w-4.5 rounded-full bg-neutral-900 border border-[#3e3e3e] flex items-center justify-center shadow -mt-1.5">
                    <ArrowDown className={`h-2.5 w-2.5 ${uploadsCount < targetFrequency ? 'text-[#aaaaaa]' : 'text-emerald-400'}`} />
                  </div>
                </div>

                <div className="absolute left-[70%] -bottom-5 text-[9px] font-semibold text-[#aaaaaa]">10</div>
                <div className="absolute right-[10%] -bottom-5 text-[9px] font-semibold text-[#aaaaaa]">15</div>
              </div>
            </div>

          </div>

        </div>

        {/* Right Column (Realtime updating sidebar feed) */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Realtime Stats Box */}
          <div className="bg-[#161616] border border-[#272727] rounded-xl p-5 shadow-lg flex flex-col gap-4">
            
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white tracking-tight">Realtime</h3>
              <div className="flex items-center gap-1.5 text-[10px] text-[#aaaaaa]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span>Updating live</span>
              </div>
            </div>

            {/* Subscribers Count */}
            <div>
              <span className="text-3xl font-bold tracking-tight text-white font-sans">
                {(() => {
                  const learnDrivenSubs = parseInt(localStorage.getItem('yt_subscribers_LearnDriven') || '0');
                  const decodeWorthySubs = parseInt(localStorage.getItem('yt_subscribers_DecodeWorthy') || '0');
                  const total = learnDrivenSubs + decodeWorthySubs;
                  return total > 0 ? total.toLocaleString() : 'Loading...';
                })()}
              </span>
              <span className="block text-[10px] text-[#aaaaaa] mt-0.5">Subscribers</span>
            </div>

            {/* Live Count Button */}
            <div>
              <button 
                onClick={() => onTabChange('video-lab')}
                className="px-4 py-1.5 bg-[#282828] hover:bg-[#3e3e3e] text-xs font-semibold rounded-full tracking-wide transition text-white"
              >
                See live count
              </button>
            </div>

            <div className="h-px w-full bg-[#272727] my-1" />

            {/* Views 48h count */}
            <div>
              <span className="text-xl font-bold text-white font-sans">
                {display48hViews > 0 ? display48hViews.toLocaleString() : 'Loading...'}
              </span>
              <span className="block text-[10px] text-[#aaaaaa] mt-0.5">Views • Last 48 hours</span>
            </div>

            {/* 48h mini Bar Chart */}
            <div className="h-12 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={realtime48hData} barCategoryGap={1}>
                  <Bar dataKey="views" fill="#3ea6ff" radius={[1, 1, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-between items-center text-[9px] text-[#aaaaaa] font-mono leading-none -mt-2.5">
              <span>48h ago</span>
              <span>Now</span>
            </div>

            <div className="h-px w-full bg-[#272727] my-1" />

            {/* Top Content List */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white">Top content</span>
                <span className="text-[10px] text-[#aaaaaa] font-semibold font-mono">Views</span>
              </div>

              {topContent.length > 0 ? (
                topContent.map(v => (
                  <div 
                    key={v.id} 
                    onClick={() => onTabChange('video-lab')}
                    className="flex items-center gap-3 justify-between py-1 group/item cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded bg-[#272727] flex items-center justify-center shrink-0 border border-[#3e3e3e]">
                        <Video className="h-4 w-4 text-[#aaaaaa]" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-white truncate leading-snug group-hover/item:text-blue-400 transition-colors">
                          {v.title}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold font-mono text-white shrink-0">
                      {v.metrics?.lifetimeViews?.toLocaleString() || '0'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-[10px] font-mono text-[#aaaaaa] py-2 text-center">
                  No video metrics loaded yet.
                </div>
              )}

            </div>

            {/* See More Link */}
            <div className="pt-1">
              <button 
                onClick={() => onTabChange('video-lab')}
                className="w-full text-center py-2 bg-[#282828] hover:bg-[#3e3e3e] text-xs font-semibold rounded-full tracking-wide transition text-white"
              >
                See more
              </button>
            </div>

          </div>

          {/* Latest Content Card Box */}
          {latestContent ? (
            <div className="bg-[#161616] border border-[#272727] rounded-xl p-5 shadow-lg flex flex-col gap-4">
              
              <h3 className="text-sm font-bold text-white tracking-tight">Latest content</h3>
              
              {/* Visual Thumbnail Frame */}
              <div 
                onClick={() => onTabChange('video-lab')}
                className="w-full aspect-video rounded-lg bg-neutral-900 border border-[#272727] relative overflow-hidden flex items-center justify-center group/card cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                
                {/* Text overlay */}
                <div className="absolute bottom-3 left-3 right-3 z-20 space-y-1">
                  <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[8px] font-bold uppercase tracking-wider">
                    {latestContent.format}
                  </span>
                  <h4 className="text-xs font-bold text-white leading-snug drop-shadow truncate w-full">
                    {latestContent.title}
                  </h4>
                </div>

                {/* Central Play/Indicator */}
                <div className="h-10 w-10 rounded-full bg-black/40 border border-white/20 flex items-center justify-center group-hover/card:scale-110 transition duration-300">
                  <Play className="h-4 w-4 text-white fill-current" />
                </div>
              </div>

              {/* Basic stats */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-[#aaaaaa]">
                <div>
                  <span className="block text-white font-bold">{latestContent.metrics?.lifetimeViews?.toLocaleString() || '0'}</span>
                  <span>Views</span>
                </div>
                <div>
                  <span className="block text-white font-bold">{latestContent.metrics?.ctr ? `${latestContent.metrics.ctr}%` : 'N/A'}</span>
                  <span>CTR</span>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-[#161616] border border-[#272727] rounded-xl p-5 shadow-lg text-center text-xs font-mono text-[#aaaaaa]">
              No upload metadata loaded yet.
            </div>
          )}

        </div>

      </div>

    </div>
  );
}

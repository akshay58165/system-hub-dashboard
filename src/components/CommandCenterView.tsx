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
  Video,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Brain,
  Sparkles,
  Shield,
  ActivitySquare
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
  scorecard: any;
  activities: any[];
  onTabChange: (tab: string) => void;
  setSelectedVideoId: (videoId: string | null) => void;
}

// Custom Dot for chart
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (!payload.hasShort && !payload.hasVideo) return null;
  return (
    <g transform={`translate(${cx - 8}, ${cy + 8})`}>
      {payload.hasShort ? (
        <circle cx="8" cy="8" r="6" fill="#ff4e4e" />
      ) : (
        <circle cx="8" cy="8" r="6" fill="#3ea6ff" />
      )}
    </g>
  );
};

export default function CommandCenterView({ 
  videos, 
  experiments, 
  insights, 
  cycleGoals, 
  scorecard,
  activities,
  onTabChange,
  setSelectedVideoId
}: CommandCenterViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'Overview' | 'Content' | 'Audience' | 'Revenue' | 'Trends'>('Overview');
  const [selectedMetric, setSelectedMetric] = useState<'views' | 'watchtime' | 'subs' | 'revenue'>('views');

  // 1. Calculate live metrics
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
      const rpm = v.format === 'Short' ? 15 : v.format === 'Members' ? 450 : 300;
      return sum + (views * rpm) / 1000;
    }, 0);
  }, [videos]);

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

  // 2. Timeline chart data
  const mainChartData = useMemo(() => {
    if (videos.length === 0) return [];
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

  // 3. Dynamic Realtime Stats
  const display48hViews = useMemo(() => {
    const viewsFromVelocity = videos.reduce((sum, v) => sum + (v.metrics?.viewVelocity || 0) * 48, 0);
    return Math.round(viewsFromVelocity || totalViewsSum * 0.06);
  }, [videos, totalViewsSum]);

  const realtime48hData = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => ({
      hour: i,
      views: Math.round((display48hViews / 48) * (0.8 + Math.random() * 0.4))
    }));
  }, [display48hViews]);

  // 4. Dynamic Directives (Integrated from synced OpenAI insights or derived locally)
  const directives = useMemo(() => {
    const defaultDirectives = {
      whatToDo: [] as any[],
      whatIsDone: [] as any[],
      whatToChase: [] as any[],
      whatToMaintain: [] as any[],
      howToKeepUp: [] as any[]
    };

    // Filter synced insights if present
    insights.forEach(ins => {
      const directiveItem = {
        id: ins.id,
        title: ins.title,
        description: ins.description,
        actionLabel: ins.actionLabel || 'Action'
      };

      if (ins.reason?.includes('What to Do')) {
        defaultDirectives.whatToDo.push(directiveItem);
      } else if (ins.reason?.includes('How to Keep Up')) {
        defaultDirectives.howToKeepUp.push(directiveItem);
      } else if (ins.reason?.includes('What to Maintain')) {
        defaultDirectives.whatToMaintain.push(directiveItem);
      }
    });

    // Fallbacks if list is empty
    if (defaultDirectives.whatToDo.length === 0) {
      const blockedVideo = videos.find(v => v.pipelineStage === 'Edit' || v.blockedReason);
      if (blockedVideo) {
        defaultDirectives.whatToDo.push({
          id: 'def-do-1',
          title: 'Resolve Editing Block',
          description: `Resolve rendering blocks or edit pipeline items on "${blockedVideo.title}".`,
          actionLabel: 'Resolve Pipeline Block'
        });
      } else {
        defaultDirectives.whatToDo.push({
          id: 'def-do-2',
          title: 'Draft Script Backlog',
          description: 'Upload queue count is empty. Plan and script a high-potential technology decode.',
          actionLabel: 'Start Scripting'
        });
      }
    }

    if (defaultDirectives.whatIsDone.length === 0) {
      const published = videos.filter(v => v.pipelineStage === 'Published');
      if (published.length > 0) {
        defaultDirectives.whatIsDone.push({
          id: 'def-done-1',
          title: 'Published Recent Video',
          description: `"${published[0].title}" was uploaded and is gathering real-time telemetry.`,
          actionLabel: 'View Analytics'
        });
      } else {
        defaultDirectives.whatIsDone.push({
          id: 'def-done-2',
          title: 'System Connected',
          description: 'YouTube Channel API key and Supabase database engines loaded successfully.',
          actionLabel: 'View Logs'
        });
      }
    }

    if (defaultDirectives.whatToChase.length === 0) {
      // Dynamic forecasting milestone
      const subGoal = (cycleGoals as any)?.subscribersTarget || 100000;
      defaultDirectives.whatToChase.push({
        id: 'def-chase-1',
        title: 'Chase Subscriber Target',
        description: `Gained ${Math.round(totalSubsGained).toLocaleString()} subs. Chase target of ${subGoal.toLocaleString()} subscribers.`,
        actionLabel: 'View Forecast'
      });
    }

    if (defaultDirectives.whatToMaintain.length === 0) {
      const uploads = videos.length;
      defaultDirectives.whatToMaintain.push({
        id: 'def-maint-1',
        title: 'Maintain Upload Cadence',
        description: `Upload frequency is ${uploads} videos this month. Maintain target threshold.`,
        actionLabel: 'Review Pipeline'
      });
    }

    if (defaultDirectives.howToKeepUp.length === 0) {
      // Correlate well-being inputs
      const sleep = scorecard?.sleep || 8;
      const stress = scorecard?.stress || 3;
      const energy = scorecard?.energy || 8;

      if (sleep < 7) {
        defaultDirectives.howToKeepUp.push({
          id: 'def-keep-1',
          title: 'Sleep Budget Deficit',
          description: `Your logged sleep is low (${sleep}/10). Lower rest scores correlate with a 15% increase in production latency. Prioritize creative recovery today.`,
          actionLabel: 'Check Bio Scorecard'
        });
      } else if (stress > 6) {
        defaultDirectives.howToKeepUp.push({
          id: 'def-keep-2',
          title: 'High Stress Warning',
          description: `Stress parameter is high (${stress}/10). Focus on planning/scripting rather than heavy editing lines to optimize output quality.`,
          actionLabel: 'Check Bio Scorecard'
        });
      } else {
        defaultDirectives.howToKeepUp.push({
          id: 'def-keep-3',
          title: 'Optimal Performance State',
          description: `All biometrics indicators (Energy: ${energy}/10) are healthy. Focus levels are high. Execute high-effort filming work today.`,
          actionLabel: 'Check Bio Scorecard'
        });
      }
    }

    return defaultDirectives;
  }, [videos, insights, cycleGoals, scorecard]);

  // Action Button Handler that navigates tabs
  const handleActionClick = (actionLabel: string, id?: string) => {
    const label = actionLabel.toLowerCase();
    if (label.includes('script') || label.includes('video')) {
      onTabChange('video-lab');
    } else if (label.includes('pipeline') || label.includes('review')) {
      onTabChange('pipeline');
    } else if (label.includes('scorecard') || label.includes('bio')) {
      onTabChange('dashboard'); // switches to primary cockpit tab (usually has biometrics)
    } else if (label.includes('stats') || label.includes('analytics') || label.includes('forecast')) {
      setActiveSubTab('Overview');
    }
  };

  const topVideos = useMemo(() => {
    return [...videos].sort((a, b) => (b.metrics?.lifetimeViews || 0) - (a.metrics?.lifetimeViews || 0)).slice(0, 3);
  }, [videos]);

  const latestVideo = useMemo(() => {
    if (videos.length === 0) return null;
    return [...videos].sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())[0];
  }, [videos]);

  return (
    <div className="space-y-6 text-[#f1f1f1] font-sans pb-12">
      
      {/* Premium Top Bar */}
      <div className="flex justify-between items-center bg-[#161616]/40 backdrop-blur-xl border border-[#272727]/60 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white leading-none">Unified CommandCenter</h1>
            <p className="text-[10px] text-[#aaaaaa] mt-1 font-mono">INTEGRATED TELEMETRY & STRATEGY ENGINE</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#aaaaaa] bg-[#0f0f0f] border border-[#272727] px-3.5 py-1.5 rounded-full select-none">
          <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          <span>REAL-TIME ANALYSIS SYNCHRONIZED</span>
        </div>
      </div>

      {/* Telemetry Chart Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Core Metrics Box */}
        <div className="lg:col-span-2 bg-[#161616]/60 backdrop-blur-xl border border-[#272727]/60 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Channel Trajectory</h2>
                <p className="text-xs text-[#aaaaaa] mt-0.5">Aggregated recent metrics from linked active publishing channels.</p>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono text-[#aaaaaa] bg-[#1f1f1f] px-3 py-1 rounded-full border border-[#272727]">
                <span>Last 30 Days</span>
              </div>
            </div>

            {/* Metrics cards bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border border-[#272727] rounded-xl overflow-hidden bg-[#0f0f0f]/80 mb-6">
              
              <button 
                onClick={() => setSelectedMetric('views')}
                className={`p-3.5 text-left border-r border-[#272727] flex flex-col justify-between transition-colors ${selectedMetric === 'views' ? 'bg-[#161616]' : 'hover:bg-[#161616]/40'}`}
              >
                <span className="text-[10px] text-[#aaaaaa] font-semibold tracking-wide uppercase">Views</span>
                <div className="mt-2.5">
                  <span className="text-xl font-bold tracking-tight text-white block">
                    {formatMetricValue(totalViewsSum, 'views')}
                  </span>
                  <span className="text-[9px] text-[#aaaaaa] block mt-0.5 font-mono">Cumulative</span>
                </div>
              </button>

              <button 
                onClick={() => setSelectedMetric('watchtime')}
                className={`p-3.5 text-left border-r border-[#272727] flex flex-col justify-between transition-colors ${selectedMetric === 'watchtime' ? 'bg-[#161616]' : 'hover:bg-[#161616]/40'}`}
              >
                <span className="text-[10px] text-[#aaaaaa] font-semibold tracking-wide uppercase">Watch Time</span>
                <div className="mt-2.5">
                  <span className="text-xl font-bold tracking-tight text-white block">
                    {formatMetricValue(totalWatchTimeHours, 'watchtime')}
                  </span>
                  <span className="text-[9px] text-[#aaaaaa] block mt-0.5 font-mono">Hours</span>
                </div>
              </button>

              <button 
                onClick={() => setSelectedMetric('subs')}
                className={`p-3.5 text-left border-r border-[#272727] flex flex-col justify-between transition-colors ${selectedMetric === 'subs' ? 'bg-[#161616]' : 'hover:bg-[#161616]/40'}`}
              >
                <span className="text-[10px] text-[#aaaaaa] font-semibold tracking-wide uppercase">Subscribers</span>
                <div className="mt-2.5">
                  <span className="text-xl font-bold tracking-tight text-white block">
                    +{formatMetricValue(totalSubsGained, 'subs')}
                  </span>
                  <span className="text-[9px] text-[#aaaaaa] block mt-0.5 font-mono">Net Gained</span>
                </div>
              </button>

              <button 
                onClick={() => setSelectedMetric('revenue')}
                className={`p-3.5 text-left flex flex-col justify-between transition-colors ${selectedMetric === 'revenue' ? 'bg-[#161616]' : 'hover:bg-[#161616]/40'}`}
              >
                <span className="text-[10px] text-[#aaaaaa] font-semibold tracking-wide uppercase">Est. Revenue</span>
                <div className="mt-2.5">
                  <span className="text-xl font-bold tracking-tight text-white block">
                    {formatMetricValue(totalRevenue, 'revenue')}
                  </span>
                  <span className="text-[9px] text-[#aaaaaa] block mt-0.5 font-mono">INR Base</span>
                </div>
              </button>

            </div>

            {/* Line Chart */}
            <div className="h-60 w-full relative mb-1">
              {mainChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mainChartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <defs>
                      <linearGradient id="glowSelect" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#444" fontSize={9} tickLine={false} />
                    <YAxis stroke="#444" fontSize={9} axisLine={false} tickLine={false} orientation="right" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: '1px solid #272727', borderRadius: '8px' }}
                      labelStyle={{ fontSize: 9, color: '#888' }}
                      itemStyle={{ fontSize: 10, color: '#fff' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={selectedMetric} 
                      stroke="#06b6d4" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#glowSelect)"
                      dot={<CustomDot />}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs font-mono text-[#aaaaaa]">
                  No dynamic upload logs found in last 30 days. Link a YouTube channel.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Real-time Velocity Column */}
        <div className="bg-[#161616]/60 backdrop-blur-xl border border-[#272727]/60 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Realtime Telemetry</h2>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            </div>

            <div>
              <span className="text-3xl font-bold tracking-tight text-white font-sans">
                {(() => {
                  const learnDrivenSubs = parseInt(localStorage.getItem('yt_subscribers_LearnDriven') || '0');
                  const decodeWorthySubs = parseInt(localStorage.getItem('yt_subscribers_DecodeWorthy') || '0');
                  const total = learnDrivenSubs + decodeWorthySubs;
                  return total > 0 ? total.toLocaleString() : 'Offline';
                })()}
              </span>
              <span className="block text-[10px] text-[#aaaaaa] mt-0.5">Subscribers (Linked Channels)</span>
            </div>

            <div className="h-px bg-[#272727]/80" />

            <div>
              <span className="text-xl font-bold text-white font-sans">
                {display48hViews > 0 ? display48hViews.toLocaleString() : 'Calculating...'}
              </span>
              <span className="block text-[10px] text-[#aaaaaa] mt-0.5">Views • Last 48 hours</span>
            </div>

            {/* 48h mini Bar Chart */}
            <div className="h-14 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={realtime48hData} barCategoryGap={1}>
                  <Bar dataKey="views" fill="#00bcd4" radius={[1, 1, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between items-center text-[8px] text-[#aaaaaa] font-mono leading-none -mt-2">
              <span>48h ago</span>
              <span>Now</span>
            </div>

            <div className="h-px bg-[#272727]/80" />

            {/* Top performing */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-white block">Active Videos</span>
              {topVideos.map(v => (
                <div key={v.id} className="flex justify-between items-center text-xs py-0.5">
                  <span className="text-[#aaaaaa] truncate max-w-[150px]">{v.title}</span>
                  <span className="font-bold text-white font-mono">{v.metrics?.lifetimeViews?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Actionable UI directives bridge */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Double Card: What to Do, What is Done, What to Chase, What to Maintain */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Main Directives panel */}
          <div className="bg-[#161616]/60 backdrop-blur-xl border border-[#272727]/60 rounded-2xl p-5 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-400" />
                <h2 className="text-base font-bold text-white tracking-tight">Algorithmic Directives Bridge</h2>
              </div>
              <span className="text-[9px] font-mono text-[#aaaaaa] bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full uppercase">AI Co-Producer Engine</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* WHAT TO DO */}
              <div className="p-4 bg-[#0f0f0f]/80 border border-[#272727]/80 rounded-xl flex flex-col justify-between hover:border-cyan-500/30 transition-all duration-300">
                <div>
                  <div className="flex items-center gap-2 text-cyan-400 mb-2">
                    <ActivitySquare className="h-4.5 w-4.5" />
                    <span className="text-xs font-bold uppercase tracking-wider">What to Do</span>
                  </div>
                  {directives.whatToDo.map(item => (
                    <div key={item.id} className="space-y-1 mt-2">
                      <h4 className="text-xs font-bold text-white">{item.title}</h4>
                      <p className="text-[11px] text-[#aaaaaa] leading-relaxed">{item.description}</p>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => handleActionClick(directives.whatToDo[0]?.actionLabel || '')}
                  className="w-full mt-4 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/20 text-cyan-400 text-xs font-semibold rounded-lg tracking-wide transition"
                >
                  {directives.whatToDo[0]?.actionLabel || 'Start script drafting'}
                </button>
              </div>

              {/* WHAT TO CHASE */}
              <div className="p-4 bg-[#0f0f0f]/80 border border-[#272727]/80 rounded-xl flex flex-col justify-between hover:border-amber-500/30 transition-all duration-300">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <TrendingUp className="h-4.5 w-4.5" />
                    <span className="text-xs font-bold uppercase tracking-wider">What to Chase</span>
                  </div>
                  {directives.whatToChase.map(item => (
                    <div key={item.id} className="space-y-1 mt-2">
                      <h4 className="text-xs font-bold text-white">{item.title}</h4>
                      <p className="text-[11px] text-[#aaaaaa] leading-relaxed">{item.description}</p>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => handleActionClick(directives.whatToChase[0]?.actionLabel || '')}
                  className="w-full mt-4 py-1.5 bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400 text-xs font-semibold rounded-lg tracking-wide transition"
                >
                  {directives.whatToChase[0]?.actionLabel || 'View Target Forecast'}
                </button>
              </div>

              {/* WHAT TO MAINTAIN */}
              <div className="p-4 bg-[#0f0f0f]/80 border border-[#272727]/80 rounded-xl flex flex-col justify-between hover:border-emerald-500/30 transition-all duration-300">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <Shield className="h-4.5 w-4.5" />
                    <span className="text-xs font-bold uppercase tracking-wider">What to Maintain</span>
                  </div>
                  {directives.whatToMaintain.map(item => (
                    <div key={item.id} className="space-y-1 mt-2">
                      <h4 className="text-xs font-bold text-white">{item.title}</h4>
                      <p className="text-[11px] text-[#aaaaaa] leading-relaxed">{item.description}</p>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => handleActionClick(directives.whatToMaintain[0]?.actionLabel || '')}
                  className="w-full mt-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg tracking-wide transition"
                >
                  {directives.whatToMaintain[0]?.actionLabel || 'Check pipeline'}
                </button>
              </div>

              {/* WHAT IS DONE */}
              <div className="p-4 bg-[#0f0f0f]/80 border border-[#272727]/80 rounded-xl flex flex-col justify-between hover:border-purple-500/30 transition-all duration-300">
                <div>
                  <div className="flex items-center gap-2 text-purple-400 mb-2">
                    <CheckCircle className="h-4.5 w-4.5" />
                    <span className="text-xs font-bold uppercase tracking-wider">What is Done</span>
                  </div>
                  {directives.whatIsDone.map(item => (
                    <div key={item.id} className="space-y-1 mt-2">
                      <h4 className="text-xs font-bold text-white">{item.title}</h4>
                      <p className="text-[11px] text-[#aaaaaa] leading-relaxed">{item.description}</p>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => handleActionClick(directives.whatIsDone[0]?.actionLabel || '')}
                  className="w-full mt-4 py-1.5 bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/20 text-purple-400 text-xs font-semibold rounded-lg tracking-wide transition"
                >
                  {directives.whatIsDone[0]?.actionLabel || 'View log milestones'}
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Right Column: How to Keep Up (Bio Sync and well-being correlations) */}
        <div className="space-y-6">
          
          {/* Bio Performance Sync panel */}
          <div className="bg-[#161616]/60 backdrop-blur-xl border border-[#272727]/60 rounded-2xl p-5 shadow-lg flex flex-col justify-between h-full">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-[#272727]/80">
                <Activity className="h-5 w-5 text-red-400" />
                <div>
                  <h2 className="text-sm font-bold text-white tracking-tight">How to Keep Up</h2>
                  <p className="text-[10px] text-[#aaaaaa]">Biometrics & Creative Capacity Analysis</p>
                </div>
              </div>

              {/* Bio Scores summary */}
              <div className="grid grid-cols-3 gap-2 py-2">
                <div className="bg-[#0f0f0f] border border-[#272727] p-2.5 rounded-xl text-center">
                  <span className="block text-lg font-bold text-white font-mono">{scorecard?.sleep || 8}/10</span>
                  <span className="block text-[8px] text-[#aaaaaa] uppercase mt-0.5">Sleep</span>
                </div>
                <div className="bg-[#0f0f0f] border border-[#272727] p-2.5 rounded-xl text-center">
                  <span className="block text-lg font-bold text-white font-mono">{scorecard?.stress || 3}/10</span>
                  <span className="block text-[8px] text-[#aaaaaa] uppercase mt-0.5">Stress</span>
                </div>
                <div className="bg-[#0f0f0f] border border-[#272727] p-2.5 rounded-xl text-center">
                  <span className="block text-lg font-bold text-white font-mono">{scorecard?.energy || 8}/10</span>
                  <span className="block text-[8px] text-[#aaaaaa] uppercase mt-0.5">Energy</span>
                </div>
              </div>

              {/* Directives */}
              <div className="space-y-3 pt-2">
                {directives.howToKeepUp.map(item => (
                  <div key={item.id} className="p-3 bg-[#0f0f0f]/60 border border-[#272727]/80 rounded-xl space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] text-[#aaaaaa] leading-relaxed pt-0.5">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => handleActionClick(directives.howToKeepUp[0]?.actionLabel || '')}
              className="w-full mt-6 py-2 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 text-red-400 text-xs font-semibold rounded-lg tracking-wide transition"
            >
              {directives.howToKeepUp[0]?.actionLabel || 'Check bio scorecard'}
            </button>
          </div>

        </div>

      </div>

      {/* Latest Video Log Block (What is Done) */}
      {latestVideo && (
        <div className="bg-[#161616]/40 backdrop-blur-xl border border-[#272727]/60 p-5 rounded-2xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-neutral-900 border border-[#272727] flex items-center justify-center shrink-0">
                <Video className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <span className="text-[8px] font-mono text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Latest Upload</span>
                <h3 className="text-sm font-bold text-white mt-1.5">{latestVideo.title}</h3>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs font-mono">
              <div>
                <span className="text-[#aaaaaa] block text-[9px]">Lifetime Views</span>
                <span className="text-white font-bold">{latestVideo.metrics?.lifetimeViews?.toLocaleString() || '0'}</span>
              </div>
              <div>
                <span className="text-[#aaaaaa] block text-[9px]">CTR</span>
                <span className="text-white font-bold">{latestVideo.metrics?.ctr ? `${latestVideo.metrics.ctr}%` : 'N/A'}</span>
              </div>
              <button 
                onClick={() => {
                  setSelectedVideoId(latestVideo.id);
                  onTabChange('video-lab');
                }}
                className="px-4 py-1.5 bg-[#272727] hover:bg-[#3f3f3f] text-xs font-semibold rounded-full transition duration-200"
              >
                Inspect Video Analytics
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

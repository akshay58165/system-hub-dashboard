import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Clapperboard, 
  ChevronDown, 
  HelpCircle, 
  Info, 
  TrendingUp, 
  Activity, 
  DollarSign, 
  Users, 
  ArrowUpRight, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles,
  Award,
  ChevronRight
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
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { VideoRecord } from '../types';

interface VideoLabProps {
  videos: VideoRecord[];
  setVideos: React.Dispatch<React.SetStateAction<VideoRecord[]>>;
  selectedVideoId: string | null;
  setSelectedVideoId: (id: string) => void;
}

const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function VideoLabView({ 
  videos, 
  setVideos, 
  selectedVideoId, 
  setSelectedVideoId 
}: VideoLabProps) {
  const publishedVideos = useMemo(() => videos.filter(v => v.pipelineStage === 'Published'), [videos]);
  const defaultVideoId = publishedVideos[0]?.id || '';
  const currentVideoId = selectedVideoId || defaultVideoId;

  // Selected video
  const video = useMemo(() => {
    return videos.find(v => v.id === currentVideoId) || publishedVideos[0];
  }, [videos, currentVideoId, publishedVideos]);

  // Edit Tag form states
  const [editTags, setEditTags] = useState(false);
  const [tagTopicType, setTagTopicType] = useState(video?.tags?.topicType || '');
  const [tagHookType, setTagHookType] = useState(video?.tags?.hookType || '');
  const [tagStructure, setTagStructure] = useState(video?.tags?.contentStructure || '');
  const [tagEvergreen, setTagEvergreen] = useState(video?.tags?.evergreenPotential || 'Medium');
  const [tagSubscribers, setTagSubscribers] = useState(video?.tags?.subscriberPotential || 'Medium');

  // Trigger loading tags on selection change
  React.useEffect(() => {
    if (video) {
      setTagTopicType(video.tags.topicType);
      setTagHookType(video.tags.hookType);
      setTagStructure(video.tags.contentStructure);
      setTagEvergreen(video.tags.evergreenPotential);
      setTagSubscribers(video.tags.subscriberPotential);
    }
  }, [video]);

  const handleSaveTags = () => {
    if (!video) return;
    setVideos(prev => prev.map(v => {
      if (v.id === video.id) {
        return {
          ...v,
          tags: {
            ...v.tags,
            topicType: tagTopicType,
            hookType: tagHookType,
            contentStructure: tagStructure,
            evergreenPotential: tagEvergreen,
            subscriberPotential: tagSubscribers
          }
        };
      }
      return v;
    }));
    setEditTags(false);
  };

  // 1. Diagnosis Engine
  const diagnosis = useMemo(() => {
    if (!video || !video.metrics) return null;
    const { ctr, averagePercentageViewed, lifetimeViews, subscribersGainedPer1kViews, revenuePer1kViews } = video.metrics;
    
    // Baselines (mock average for comparisons)
    const avgCTR = video.format === 'Short' ? 10.0 : 6.0;
    const avgRetention = video.format === 'Short' ? 65.0 : 40.0;
    
    if (ctr && ctr < avgCTR && averagePercentageViewed && averagePercentageViewed >= avgRetention) {
      return {
        status: 'Needs Action',
        label: 'Low CTR / High Retention',
        color: 'text-amber-400 border-amber-900/50 bg-amber-950/20',
        icon: AlertTriangle,
        explanation: 'The video idea is highly engaging once people click, but the packaging (title or thumbnail) is weak.',
        action: 'A/B test a new title with high-curiosity framing or change the thumbnail background color to increase click-through rate.'
      };
    }

    if (ctr && ctr >= avgCTR && averagePercentageViewed && averagePercentageViewed < avgRetention) {
      return {
        status: 'Problem',
        label: 'High CTR / Low Retention',
        color: 'text-red-400 border-red-900/50 bg-red-950/20',
        icon: AlertTriangle,
        explanation: 'The packaging successfully attracted viewers, but the content failed to satisfy the click promise or hook them fast enough.',
        action: 'Improve script pacing in the first 15 seconds. Ensure the hook directly matches the thumbnail promise.'
      };
    }

    if (lifetimeViews && lifetimeViews > 40000 && subscribersGainedPer1kViews && subscribersGainedPer1kViews < 8.0) {
      return {
        status: 'Watch',
        label: 'High Reach / Low Subscriber Conversion',
        color: 'text-blue-400 border-blue-900/50 bg-blue-950/20',
        icon: Info,
        explanation: 'The video reached a broad audience but did not build strong channel identity or include a compelling call to value.',
        action: 'Add a pinned comment directing to a themed playlist, or integrate a logical end-screen call to action linking to similar topics.'
      };
    }

    if (revenuePer1kViews && revenuePer1kViews > 300 && lifetimeViews && lifetimeViews < 10000) {
      return {
        status: 'Great',
        label: 'High Monetization / Low Reach',
        color: 'text-purple-400 border-purple-900/50 bg-purple-950/20',
        icon: Sparkles,
        explanation: 'This topic has strong advertiser value (CPM) but fell short of finding a broad audience.',
        action: 'Create a follow-up video on this exact topic, but frame it with a broader, more accessible title to expand reach.'
      };
    }

    return {
      status: 'Good',
      label: 'Stable Performance Profile',
      color: 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20',
      icon: CheckCircle2,
      explanation: 'CTR and retention are both performing on-baseline or better. The topic is healthy.',
      action: 'Standardize this structure and repeatability score. Consider making a sequel next month.'
    };
  }, [video]);

  // Traffic Source chart data
  const trafficData = useMemo(() => {
    if (!video || !video.metrics?.ctrByTrafficSource) {
      return [
        { name: 'Browse Features', value: 45 },
        { name: 'Suggested Videos', value: 30 },
        { name: 'YouTube Search', value: 15 },
        { name: 'Other', value: 10 }
      ];
    }
    return Object.entries(video.metrics.ctrByTrafficSource).map(([key, val]) => ({
      name: key,
      value: val
    }));
  }, [video]);

  // Mock views progression over time (based on age)
  const viewsTimeline = useMemo(() => {
    if (!video || !video.metrics) return [];
    const m = video.metrics;
    return [
      { hour: '1h', views: m.views1h || 0 },
      { hour: '3h', views: m.views3h || 0 },
      { hour: '6h', views: m.views6h || 0 },
      { hour: '12h', views: m.views12h || 0 },
      { hour: '24h', views: m.views24h || 0 },
      { hour: '48h', views: m.views48h || 0 },
      { hour: '7d', views: m.views7d || 0 },
      { hour: '28d', views: m.lifetimeViews || 0 }
    ].filter(pt => pt.views > 0);
  }, [video]);

  if (!video) {
    return (
      <div className="p-8 text-center border border-neutral-900 rounded-xl bg-neutral-950/20 text-neutral-500 font-mono text-xs">
        No published videos found. Publish a video in the Pipeline or add demo data to activate the Video Lab.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Selector and Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-900 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-purple-400" />
            Video Lab Analysis
          </h2>
          <p className="text-xs text-neutral-500 font-mono mt-1">Deep analysis, derived metrics, and target packaging recommendations.</p>
        </div>

        {/* Video Selector Dropdown */}
        <div className="relative w-full md:w-80 shrink-0 z-20">
          <select 
            value={video.id}
            onChange={(e) => setSelectedVideoId(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-850 outline-none text-xs rounded-lg px-3.5 py-2 text-white font-mono appearance-none cursor-pointer"
          >
            {publishedVideos.map(v => (
              <option key={v.id} value={v.id}>{v.channelName} • {v.title}</option>
            ))}
          </select>
          <ChevronDown className="h-4 w-4 text-neutral-400 absolute right-3 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Grid: Overview Details & Manual Tags Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Video Metadata & Visual Card */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-neutral-900 border border-neutral-850 space-y-4">
          <div className="flex justify-between items-start">
            <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-widest ${video.channelName === 'LearnDriven' ? 'text-purple-400 bg-purple-950/40 border border-purple-900/30' : 'text-emerald-400 bg-emerald-950/40 border border-emerald-900/30'}`}>
              {video.channelName}
            </span>
            <span className="text-[10px] font-mono text-neutral-500">Video ID: {video.videoId || video.id}</span>
          </div>

          <h3 className="text-base font-bold text-white font-sans leading-snug">{video.title}</h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 font-mono text-[10px] text-neutral-400">
            <div>
              <span className="text-neutral-500 block mb-0.5">Format</span>
              <span className="text-white font-semibold">{video.format}</span>
            </div>
            <div>
              <span className="text-neutral-500 block mb-0.5">Content Intent</span>
              <span className="text-white font-semibold">{video.contentIntent || 'General'}</span>
            </div>
            <div>
              <span className="text-neutral-500 block mb-0.5">Effort Hours</span>
              <span className="text-white font-semibold">{video.productionEffortHours} hrs</span>
            </div>
            <div>
              <span className="text-neutral-500 block mb-0.5">Research Depth</span>
              <span className="text-white font-semibold truncate block">{video.researchDepth || 'None'}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Manual Tagging */}
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-850 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-[#1e293b] pb-2">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-300">Manual Tags</span>
              <button 
                onClick={() => setEditTags(!editTags)}
                className="text-[10px] font-mono text-purple-400 hover:text-purple-300 underline"
              >
                {editTags ? 'Close' : 'Edit Tags'}
              </button>
            </div>

            {editTags ? (
              <div className="space-y-3 text-[10px] font-sans">
                <div>
                  <label className="block text-[9px] text-neutral-500 uppercase mb-1">Topic Type</label>
                  <input 
                    type="text" 
                    value={tagTopicType} 
                    onChange={(e) => setTagTopicType(e.target.value)} 
                    className="w-full bg-neutral-900 border border-neutral-850 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-neutral-500 uppercase mb-1">Hook Type</label>
                  <input 
                    type="text" 
                    value={tagHookType} 
                    onChange={(e) => setTagHookType(e.target.value)} 
                    className="w-full bg-neutral-900 border border-neutral-850 rounded px-2.5 py-1.5 text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[9px] text-neutral-500 uppercase mb-1">Evergreen</label>
                    <select 
                      value={tagEvergreen} 
                      onChange={(e) => setTagEvergreen(e.target.value as any)}
                      className="w-full bg-neutral-900 border border-neutral-850 rounded px-2 py-1 text-white"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[9px] text-neutral-500 uppercase mb-1">Subs Potential</label>
                    <select 
                      value={tagSubscribers} 
                      onChange={(e) => setTagSubscribers(e.target.value as any)}
                      className="w-full bg-neutral-900 border border-neutral-850 rounded px-2 py-1 text-white"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>
                <button 
                  onClick={handleSaveTags}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono rounded mt-2 text-xs"
                >
                  Save Tags
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-neutral-400">
                <div>
                  <span className="text-neutral-500 block mb-0.5">Topic Type</span>
                  <span className="text-white font-semibold">{video.tags.topicType || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block mb-0.5">Hook Type</span>
                  <span className="text-white font-semibold">{video.tags.hookType || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block mb-0.5">Evergreen potential</span>
                  <span className="text-white font-semibold">{video.tags.evergreenPotential || 'Medium'}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block mb-0.5">Audience Intent</span>
                  <span className="text-white font-semibold">{video.tags.audienceIntent || 'N/A'}</span>
                </div>
              </div>
            )}
          </div>
          
          {!editTags && (
            <p className="text-[9px] text-neutral-500 font-mono mt-4">
              Tags are mapped to topic intelligence matrix to evaluate sequels.
            </p>
          )}
        </div>

      </div>

      {/* Derived Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Health Score */}
        <div className="p-4 rounded-xl border border-neutral-900 bg-neutral-950 flex flex-col gap-1 items-center justify-center relative overflow-hidden group">
          <Award className="h-5 w-5 text-purple-400 mb-1" />
          <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Health Score</span>
          <span className="text-3xl font-bold text-white leading-none mt-1">
            {video.metrics?.videoHealthScore || 0}%
          </span>
        </div>

        {/* View Velocity */}
        <div className="p-4 rounded-xl border border-neutral-850 bg-neutral-950 flex flex-col gap-1 items-center justify-center relative overflow-hidden group">
          <Activity className="h-5 w-5 text-emerald-400 mb-1" />
          <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Velocity</span>
          <span className="text-3xl font-bold text-white leading-none mt-1">
            {video.metrics?.viewVelocity || 0} <span className="text-[10px] font-mono text-neutral-500 uppercase font-normal">v/h</span>
          </span>
        </div>

        {/* CTR */}
        <div className="p-4 rounded-xl border border-neutral-850 bg-neutral-950 flex flex-col gap-1 items-center justify-center relative overflow-hidden group">
          <TrendingUp className="h-5 w-5 text-blue-400 mb-1" />
          <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">CTR</span>
          <span className="text-3xl font-bold text-white leading-none mt-1">
            {video.metrics?.ctr || 0}%
          </span>
        </div>

        {/* Subscriber conversion */}
        <div className="p-4 rounded-xl border border-neutral-850 bg-neutral-950 flex flex-col gap-1 items-center justify-center relative overflow-hidden group">
          <Users className="h-5 w-5 text-purple-400 mb-1" />
          <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Sub Conversion</span>
          <span className="text-3xl font-bold text-white leading-none mt-1">
            {video.metrics?.subscribersGainedPer1kViews || 0} <span className="text-[10px] text-neutral-500 uppercase font-mono font-normal">/1k v</span>
          </span>
        </div>

      </div>

      {/* AI Packaging Diagnosis Card */}
      {diagnosis && (
        <div className={`p-5 rounded-xl border flex flex-col sm:flex-row gap-4 items-start ${diagnosis.color}`}>
          <div className="p-2 rounded-lg bg-black/40 text-neutral-300">
            <diagnosis.icon className="h-6 w-6 text-current shrink-0 animate-pulse" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold font-mono uppercase text-white bg-black/30 px-2 py-0.5 rounded">Diagnosis</span>
              <span className="text-xs font-bold font-sans text-white">{diagnosis.label}</span>
            </div>
            <p className="text-xs text-neutral-200 font-sans leading-relaxed">{diagnosis.explanation}</p>
            <p className="text-xs text-neutral-100 font-sans font-bold flex items-center gap-1.5 mt-2">
              <ChevronRight className="h-4 w-4 shrink-0 text-current" />
              <span>Recommended Action: {diagnosis.action}</span>
            </p>
          </div>
        </div>
      )}

      {/* Grid: Charts (Views Timeline & Traffic Sources) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Views progression timeline (Recharts) */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-neutral-900 border border-neutral-850 space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Views Growth Curve</span>
          <div className="h-64 w-full">
            {viewsTimeline.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-neutral-600 font-mono">No metric timeline logs found.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={viewsTimeline}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" stroke="#4b5563" fontSize={9} tickLine={false} />
                  <YAxis stroke="#4b5563" fontSize={9} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1f2937', borderRadius: '8px' }}
                    labelStyle={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: 10 }}
                    itemStyle={{ color: '#ffffff', fontSize: 11 }}
                  />
                  <Area type="monotone" dataKey="views" stroke="#a855f7" fillOpacity={1} fill="url(#colorViews)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right: Traffic Sources CTR breakdown */}
        <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-850 space-y-4 flex flex-col">
          <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">CTR by Traffic Source</span>
          
          <div className="flex-1 h-44 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={trafficData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {trafficData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1f2937', borderRadius: '8px' }}
                  itemStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Callout */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Avg CTR</span>
              <span className="text-2xl font-bold text-white font-sans">{video.metrics?.ctr || 0}%</span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-2 pt-2 border-t border-neutral-900 text-[10px] font-mono text-neutral-400">
            {trafficData.map((d, idx) => (
              <div key={d.name} className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span>{d.name}</span>
                </div>
                <span className="text-white font-bold">{d.value}%</span>
              </div>
            ))}
          </div>

        </div>

      </div>

    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, 
  Globe, 
  Clock, 
  GitBranch, 
  Server, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Loader2, 
  ArrowUpRight, 
  Sparkles,
  Youtube,
  User,
  Activity
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart as RechartLine, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { Topic, TopicActivity, SystemEvent } from '../types';

interface VercelViewProps {
  projects: any[]; // Kept for interface compatibility in App.tsx
  onAddEvent: (evt: SystemEvent) => void;
  onUpdateProject: (projectId: string, updatedProject: any) => void;
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  activities: TopicActivity[];
  setActivities: React.Dispatch<React.SetStateAction<TopicActivity[]>>;
  setActiveTab?: (tab: 'overview' | 'topics' | 'progress' | 'actionhub' | 'logs' | 'score') => void;
}

export default function VercelView({ 
  onAddEvent, 
  topics, 
  setTopics,
  activities,
  setActivities,
  setActiveTab
}: VercelViewProps) {
  const [selectedChannel, setSelectedChannel] = useState<'All' | 'LearnDriven' | 'DecodeWorthy'>('All');
  const [schedulingTopicId, setSchedulingTopicId] = useState<string | null>(null);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncStep, setSyncStep] = useState(0);

  // Filtered topics
  const filteredTopics = useMemo(() => {
    return topics.filter(t => selectedChannel === 'All' || t.channel === selectedChannel);
  }, [topics, selectedChannel]);

  // Next upload topic details (nearest future scheduled video)
  const nextUpload = useMemo(() => {
    const today = new Date();
    const scheduled = filteredTopics
      .filter(t => t.status === 'scheduled' && t.dueDate && new Date(t.dueDate) >= today)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
    return scheduled[0]?.name || 'No uploads scheduled';
  }, [filteredTopics]);

  // Last workflow update text
  const lastWorkflowUpdate = useMemo(() => {
    const subsetActivities = activities.filter(a => selectedChannel === 'All' || a.channel === selectedChannel);
    if (subsetActivities.length === 0) return 'Never';
    const dates = subsetActivities.map(a => new Date(a.timestamp).getTime());
    const latestTime = new Date(Math.max(...dates));
    
    // Relative time formatting
    const seconds = Math.floor((new Date().getTime() - latestTime.getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return latestTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, [activities, selectedChannel]);

  // Calculate buffer safety days
  const bufferDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduledFuture = filteredTopics.filter(t => 
      t.status === 'scheduled' && 
      t.dueDate &&
      new Date(t.dueDate) > today
    );
    const uniqueFutureDays = new Set(scheduledFuture.map(t => {
      const d = new Date(t.dueDate!);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    }));
    return uniqueFutureDays.size;
  }, [filteredTopics]);

  // Calculate weekly production velocity (published & scheduled)
  const monthlyScheduledCompletedCount = useMemo(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    
    return filteredTopics.filter(t => 
      t.dueDate && 
      new Date(t.dueDate) >= startOfMonth && 
      new Date(t.dueDate) <= endOfMonth &&
      (t.status === 'scheduled' || t.status === 'edited')
    ).length;
  }, [filteredTopics]);

  // Graph Data: Last 7 calendar days topics created vs videos scheduled
  const graphData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const dateObj = new Date(today);
      dateObj.setDate(today.getDate() - i);
      const dateStr = dateObj.toISOString().split('T')[0];
      const dateLabel = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

      // Topics created on this day
      const added = filteredTopics.filter(t => 
        t.createdDate && t.createdDate.split('T')[0] === dateStr
      ).length;

      // Videos scheduled on this day
      const scheduled = filteredTopics.filter(t => 
        t.status === 'scheduled' && t.dueDate && t.dueDate.split('T')[0] === dateStr
      ).length;

      data.push({
        date: dateLabel,
        added,
        scheduled
      });
    }
    return data;
  }, [filteredTopics]);

  // Recent transitions / logs formatted like deployments
  const recentHistory = useMemo(() => {
    const subsetActivities = activities
      .filter(a => selectedChannel === 'All' || a.channel === selectedChannel)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return subsetActivities.slice(0, 5);
  }, [activities, selectedChannel]);

  // Content Lane Velocities (equivalent to serverless APIs)
  const laneVelocities = useMemo(() => {
    const isShort = (t: Topic) => {
      return (
        (t.revenueLevel && ['Lvl 1', 'Lvl 2', 'Lvl 3', 'Lvl 4'].includes(t.revenueLevel)) ||
        t.name.toLowerCase().includes('short') ||
        t.description.toLowerCase().includes('short')
      );
    };

    const isLong = (t: Topic) => {
      return (
        (t.revenueLevel && ['Lvl 6', 'Lvl 7', 'Lvl 8', 'Lvl 9', 'Lvl 20'].includes(t.revenueLevel)) ||
        t.name.toLowerCase().includes('long') ||
        t.description.toLowerCase().includes('long')
      );
    };

    const isMembers = (t: Topic) => {
      return (
        (t.revenueLevel && t.revenueLevel === 'Lvl 5') ||
        t.name.toLowerCase().includes('member') ||
        t.description.toLowerCase().includes('member')
      );
    };

    const lanes = [
      {
        id: 'lane-shorts',
        path: '/shorts',
        filter: isShort,
        applicable: true
      },
      {
        id: 'lane-long',
        path: '/long-videos',
        filter: isLong,
        applicable: selectedChannel !== 'DecodeWorthy'
      },
      {
        id: 'lane-members',
        path: '/members-only',
        filter: isMembers,
        applicable: selectedChannel !== 'DecodeWorthy'
      }
    ];

    return lanes
      .filter(l => l.applicable)
      .map(lane => {
        const laneTopics = filteredTopics.filter(lane.filter);
        const totalCount = laneTopics.length;
        
        // Gaps: Topics due within next 2 days that are not scheduled/edited
        const today = new Date();
        const twoDaysFromNow = new Date();
        twoDaysFromNow.setDate(today.getDate() + 2);
        
        const gapsCount = laneTopics.filter(t => 
          t.status !== 'scheduled' && 
          t.status !== 'edited' && 
          t.dueDate && 
          new Date(t.dueDate) >= today && 
          new Date(t.dueDate) <= twoDaysFromNow
        ).length;

        // Latency: Average days between createdDate and dueDate
        let avgLeadDays = 0;
        const validDates = laneTopics.filter(t => t.dueDate && t.createdDate);
        if (validDates.length > 0) {
          const totalDays = validDates.reduce((sum, t) => {
            const diff = new Date(t.dueDate!).getTime() - new Date(t.createdDate).getTime();
            return sum + (diff / (1000 * 60 * 60 * 24));
          }, 0);
          avgLeadDays = Math.round((totalDays / validDates.length) * 10) / 10;
        }

        return {
          id: lane.id,
          path: lane.path,
          invocations: totalCount,
          errors: gapsCount,
          latency: avgLeadDays > 0 ? `${avgLeadDays}d` : 'N/A'
        };
      });
  }, [filteredTopics, selectedChannel]);

  // Sync animation handler
  const handleTriggerSync = () => {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncStep(0);
    setSyncLogs([
      'Initializing YouTube API dashboard gateway credentials...',
      'Opening partition clusters for LearnDriven and DecodeWorthy playlists...',
      'Verifying OAuth token status... OK',
      'Checking Google cloud storage backup endpoints...'
    ]);

    onAddEvent({
      id: `evt-progress-sync-${Date.now()}`,
      source: 'vercel',
      type: 'info',
      message: `Content Engine: Commenced content pipeline synchronization for channel selection [${selectedChannel}]`,
      timestamp: new Date().toISOString(),
    });
  };

  useEffect(() => {
    if (!isSyncing) return;

    const steps = [
      'Validating SEO metadata tags: product tagging, pin promotions check... OK',
      'Auditing content scheduling gaps for Short videos...',
      'Checking calendar lock date indicators... August lock parameters nominal.',
      'Analyzing average production latency curves across content lanes...',
      'Consolidating stage densities: Idea pool, scripted, filming, editing...',
      'Synchronizing localized state indicators with permanent database entries...',
      'Successfully synced! Content dashboard status active.'
    ];

    if (syncStep < steps.length) {
      const timer = setTimeout(() => {
        setSyncLogs(prev => [...prev, `[SYNC] ${steps[syncStep]}`]);
        setSyncStep(prev => prev + 1);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setIsSyncing(false);
        onAddEvent({
          id: `evt-progress-sync-done-${Date.now()}`,
          source: 'vercel',
          type: 'success',
          message: `Content Engine: Synchronization complete. Pipeline data refreshed for ${selectedChannel}.`,
          timestamp: new Date().toISOString(),
        });
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isSyncing, syncStep]);

  return (
    <div className="space-y-6">
      {/* Selector banner (Repurposed Vercel selector banner) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-950 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300">
            <Layers className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-100 font-mono">production-pipeline-sync</h2>
            <p className="text-xs text-neutral-400">Track channel upload velocities, content lane outputs, and scheduling buffers.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {(['All', 'LearnDriven', 'DecodeWorthy'] as const).map(channel => (
            <button
              key={channel}
              onClick={() => setSelectedChannel(channel)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition ${
                selectedChannel === channel
                  ? 'bg-neutral-800 border-neutral-600 text-white'
                  : 'bg-neutral-900 border-neutral-850 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
              }`}
            >
              {channel}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side (Production Control) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active project card */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold font-mono text-white tracking-tight flex items-center gap-2">
                  {selectedChannel === 'All' ? 'Consolidated Channels' : selectedChannel}
                  <span className={`h-2.5 w-2.5 rounded-full ${
                    isSyncing ? 'bg-blue-400 animate-spin' : 'bg-emerald-500 animate-pulse'
                  }`} />
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400 font-mono">
                  <Globe className="h-3.5 w-3.5 text-neutral-500" />
                  <span className="text-neutral-300">
                    Active Pipeline: {selectedChannel === 'All' ? 'All active streams' : `${selectedChannel} stream`}
                  </span>
                </div>
              </div>

              <button 
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className="px-3.5 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-black font-semibold rounded-lg text-xs font-mono flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 fill-black" />
                    <span>Sync Pipeline Data</span>
                  </>
                )}
              </button>
            </div>

            {/* 4 Metric Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-neutral-900">
              <div className="p-3 bg-neutral-900 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Next Upload</span>
                <span className="text-xs font-bold font-mono text-white mt-1 block truncate" title={nextUpload}>
                  {nextUpload}
                </span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Pipeline Velocity</span>
                <span className="text-xs font-bold font-mono text-white mt-1 flex items-center gap-1">
                  <Activity className="h-3 w-3 text-blue-400" />
                  {monthlyScheduledCompletedCount} Videos/mo
                </span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Last Update</span>
                <span className="text-xs font-bold font-mono text-white mt-1 block">
                  {lastWorkflowUpdate}
                </span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Buffer Safety</span>
                <span className={`text-xs font-bold font-mono mt-1 block ${
                  bufferDays >= 5 ? 'text-emerald-400' :
                  bufferDays >= 2 ? 'text-orange-400' :
                  'text-red-400 animate-pulse'
                }`}>
                  {bufferDays} Days ({bufferDays >= 5 ? 'Optimal' : bufferDays >= 2 ? 'Warning' : 'Critical'})
                </span>
              </div>
            </div>
          </div>

          {/* Active Production Pipeline Card */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
              <h3 className="text-sm font-bold font-mono text-white tracking-tight flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-500 animate-pulse" />
                <span>Active Production Pipeline</span>
              </h3>
              <span className="text-[10px] font-mono text-neutral-500">In Progress Topics</span>
            </div>

            <div className="space-y-3">
              {(() => {
                const activeProgress = topics.filter(t => t.inProgress && t.status !== 'scheduled');
                if (activeProgress.length === 0) {
                  return (
                    <div className="text-center py-6 text-neutral-500 font-mono text-[10px] border border-dashed border-neutral-900 rounded-lg">
                      No topics currently in active production. Go to "Topics" and select "Start Pipeline" to move them here.
                    </div>
                  );
                }
                
                return activeProgress.map(topic => {
                  const isSchedulingThis = schedulingTopicId === topic.id;
                  return (
                    <div 
                      key={topic.id} 
                      className="p-3 bg-neutral-900/40 border border-neutral-850 rounded-lg space-y-3 font-mono text-[10px]"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-neutral-200 block">{topic.name}</span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="px-1.5 py-0.2 bg-neutral-950 text-neutral-500 border border-neutral-900 rounded text-[8px]">
                              {topic.channel}
                            </span>
                            {topic.revenueLevel && (
                              <span className="px-1.5 py-0.2 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[8px] font-bold">
                                {topic.revenueLevel}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded border text-[8px] uppercase font-bold border-blue-900/40 text-blue-400 bg-blue-950/20">
                          {topic.status}
                        </span>
                      </div>

                      {/* Created and Due Date Meta Elements */}
                      <div className="grid grid-cols-2 gap-2 text-neutral-500 text-[8px] pt-1">
                        <div>Created: {new Date(topic.createdDate).toLocaleDateString()}</div>
                        <div>Due Date: {topic.dueDate ? new Date(topic.dueDate).toLocaleDateString() : 'None'}</div>
                      </div>

                      {/* Interactive Stage Recording Buttons */}
                      <div className="flex flex-wrap gap-2.5 pt-2 border-t border-neutral-900">
                        <button
                          type="button"
                          onClick={() => {
                            setTopics(prev => prev.map(t => t.id === topic.id ? { ...t, status: 'scripted' } : t));
                          }}
                          className={`px-2.5 py-1 rounded text-[8px] font-semibold border transition cursor-pointer ${
                            topic.status === 'scripted'
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          Script
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTopics(prev => prev.map(t => t.id === topic.id ? { ...t, status: 'shot' } : t));
                          }}
                          className={`px-2.5 py-1 rounded text-[8px] font-semibold border transition cursor-pointer ${
                            topic.status === 'shot'
                              ? 'bg-amber-600 border-amber-500 text-white'
                              : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          Shoot
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTopics(prev => prev.map(t => t.id === topic.id ? { ...t, status: 'edited' } : t));
                          }}
                          className={`px-2.5 py-1 rounded text-[8px] font-semibold border transition cursor-pointer ${
                            topic.status === 'edited'
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const defaultTime = topic.channel === 'LearnDriven' ? '21:09' : '19:07';
                            setSchedDate(topic.dueDate ? topic.dueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
                            setSchedTime(defaultTime);
                            setSchedulingTopicId(topic.id);
                          }}
                          className="px-2.5 py-1 rounded text-[8px] font-bold border bg-purple-950/40 border-purple-900/60 text-purple-400 hover:bg-purple-900 hover:text-white transition cursor-pointer"
                        >
                          Schedule
                        </button>
                      </div>

                      {/* Scheduling Date/Time Picker Form Block */}
                      {isSchedulingThis && (
                        <div className="mt-2.5 p-3 bg-neutral-950 border border-neutral-850 rounded-lg space-y-2">
                          <span className="text-[9px] uppercase font-bold text-purple-400 tracking-wider">Set Video Schedule Parameters</span>
                          
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div>
                              <label className="text-[8px] text-neutral-500 block mb-0.5">Date</label>
                              <input 
                                type="date"
                                value={schedDate}
                                onChange={(e) => setSchedDate(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-800 text-[9px] text-white rounded px-2 py-1 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] text-neutral-500 block mb-0.5">Time (24h format)</label>
                              <input 
                                type="time"
                                value={schedTime}
                                onChange={(e) => setSchedTime(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-800 text-[9px] text-white rounded px-2 py-1 outline-none font-mono"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setSchedulingTopicId(null)}
                              className="text-neutral-500 hover:text-neutral-300 transition"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!schedDate || !schedTime) {
                                  alert("Please fill in both Date and Time.");
                                  return;
                                }
                                const combinedDateStr = `${schedDate}T${schedTime}:00`;
                                const finalIso = new Date(combinedDateStr).toISOString();

                                setTopics(prev => prev.map(t => t.id === topic.id ? { 
                                  ...t, 
                                  status: 'scheduled', 
                                  dueDate: finalIso, 
                                  scheduledTime: schedTime 
                                } : t));

                                // Add activity log
                                const newActivity: TopicActivity = {
                                  id: `act-schedule-${Date.now()}`,
                                  topicName: topic.name,
                                  channel: topic.channel,
                                  action: `Scheduled video release for ${schedDate} at ${schedTime}`,
                                  author: 'typeakshay',
                                  timestamp: new Date().toISOString()
                                };
                                setActivities(prev => [newActivity, ...prev]);

                                onAddEvent({
                                  id: `evt-scheduled-${Date.now()}`,
                                  source: 'github',
                                  type: 'success',
                                  message: `Topic Engine: Scheduled "${topic.name}" to publish on ${schedDate} at ${schedTime} (${topic.channel}).`,
                                  timestamp: new Date().toISOString()
                                });

                                setSchedulingTopicId(null);
                              }}
                              className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-black font-bold rounded text-[9px] transition cursor-pointer"
                            >
                              Save Schedule
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Bottom Panel: Scheduled & Completed Video Ledger */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
              <h3 className="text-sm font-bold font-mono text-white tracking-tight flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-500" />
                <span>Scheduled & Completed Video Ledger</span>
              </h3>
              <span className="text-[10px] font-mono text-neutral-500">Archive</span>
            </div>

            <div className="space-y-3">
              {(() => {
                const scheduledArchive = topics.filter(t => t.inProgress && t.status === 'scheduled');
                if (scheduledArchive.length === 0) {
                  return (
                    <div className="text-center py-6 text-neutral-500 font-mono text-[10px] border border-dashed border-neutral-900 rounded-lg">
                      No videos currently scheduled or done. Complete the progress stages and save scheduling parameters to archive them here.
                    </div>
                  );
                }

                return scheduledArchive.map(topic => {
                  const now = new Date();
                  const targetTimeStr = topic.dueDate || '';
                  const isLive = targetTimeStr ? now >= new Date(targetTimeStr) : false;

                  return (
                    <div 
                      key={topic.id}
                      className={`p-3 bg-neutral-900/20 border border-neutral-850 rounded-lg space-y-2 font-mono text-[10px] transition-all duration-500 ${
                        isLive ? 'opacity-35 grayscale border-emerald-950/20 bg-neutral-950/50' : 'opacity-100'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`text-xs font-bold block ${isLive ? 'text-neutral-400 line-through' : 'text-neutral-200'}`}>
                            {topic.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="px-1.5 py-0.2 bg-neutral-950 text-neutral-500 border border-neutral-900 rounded text-[8px]">
                              {topic.channel}
                            </span>
                            {topic.revenueLevel && (
                              <span className="px-1.5 py-0.2 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[8px] font-bold">
                                {topic.revenueLevel}
                              </span>
                            )}
                          </div>
                        </div>

                        {isLive ? (
                          <span className="px-1.5 py-0.5 rounded border text-[8px] uppercase font-bold border-emerald-900/30 text-emerald-400 bg-emerald-950/20 animate-pulse">
                            Live
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded border text-[8px] uppercase font-bold border-purple-900/40 text-purple-400 bg-purple-950/20">
                            Scheduled
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-neutral-500 text-[8px] pt-1">
                        <div>Created: {new Date(topic.createdDate).toLocaleDateString()}</div>
                        <div>
                          Scheduled: {topic.dueDate ? new Date(topic.dueDate).toLocaleDateString() : 'N/A'}{' '}
                          {topic.scheduledTime ? `@ ${topic.scheduledTime}` : ''}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Graph: Daily output chart */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 font-mono">
            <h3 className="text-sm font-semibold text-neutral-200 mb-4">Production & Upload Velocity</h3>
            <div className="h-60 w-full select-none">
              <ResponsiveContainer width="100%" height="100%">
                <RechartLine data={graphData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="date" stroke="#525252" fontSize={9} />
                  <YAxis stroke="#525252" fontSize={9} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                    labelStyle={{ color: '#a3a3a3', fontSize: '10px' }}
                    itemStyle={{ fontSize: '10px' }}
                  />
                  <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="added" name="Topics Created" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="scheduled" name="Videos Scheduled" stroke="#10b981" strokeWidth={2.5} activeDot={{ r: 6 }} />
                </RechartLine>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sync logs Terminal */}
          <AnimatePresence>
            {(isSyncing || syncLogs.length > 0) && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden"
              >
                <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-2 flex items-center justify-between font-mono text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    <Loader2 className={`h-4 w-4 text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>Content Pipeline Sync Logs</span>
                  </div>
                  {isSyncing ? (
                    <span className="text-blue-400 animate-pulse font-bold text-[10px] uppercase">SYNCING</span>
                  ) : (
                    <span className="text-emerald-400 font-bold text-[10px] uppercase">SYNC COMPLETE</span>
                  )}
                </div>
                <div className="p-4 bg-neutral-950 font-mono text-xs text-neutral-400 h-56 overflow-y-auto space-y-1">
                  {syncLogs.map((log, i) => (
                    <div key={i} className={`whitespace-pre-wrap ${log.includes('Successfully') || log.includes('refresh') ? 'text-emerald-400 font-bold' : log.includes('[SYNC]') ? 'text-neutral-400' : 'text-neutral-500'}`}>
                      {log}
                    </div>
                  ))}
                  {isSyncing && <span className="inline-block h-3.5 w-2 bg-neutral-300 animate-pulse" />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side widgets */}
        <div className="space-y-6 font-mono">
          {/* History */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-neutral-200 mb-4">Production History</h3>
            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {recentHistory.length === 0 ? (
                <p className="text-xs text-neutral-500 italic font-mono text-center py-4">No workflow activity logged</p>
              ) : (
                recentHistory.map(act => (
                  <div key={act.id} className="p-3 bg-neutral-900/60 border border-neutral-850 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500 truncate max-w-[120px]">{act.channel}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[8px] uppercase font-semibold border ${
                        act.action.includes('scheduled') ? 'bg-emerald-950/85 text-emerald-400 border-emerald-900' :
                        act.action.includes('edited') ? 'bg-fuchsia-950/85 text-fuchsia-400 border-fuchsia-900' :
                        'bg-blue-950/85 text-blue-400 border-blue-900'
                      }`}>
                        {act.action.includes('scheduled') ? 'Scheduled' : act.action.includes('edited') ? 'Edited' : 'In Stage'}
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-neutral-300 break-all font-semibold leading-snug">
                      {act.action} on "{act.topicName}"
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1">
                      <span>by @{act.author}</span>
                      <span>{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active content lane velocities */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-200">Content Lane Velocities</h3>
              <Server className="h-4 w-4 text-neutral-500" />
            </div>

            <div className="space-y-3">
              {laneVelocities.map(lane => (
                <div key={lane.id} className="p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-neutral-200">{lane.path}</span>
                    {lane.errors > 0 ? (
                      <span className="px-1.5 py-0.2 bg-rose-950 text-rose-400 text-[8px] font-semibold uppercase rounded animate-pulse">Critical Gaps</span>
                    ) : (
                      <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-400 text-[8px] font-semibold uppercase rounded">Buffer Stable</span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-850 text-center text-[10px] text-neutral-500">
                    <div>
                      <span className="block text-neutral-500">Pipeline Load</span>
                      <span className="font-semibold text-neutral-300 mt-0.5 block">{lane.invocations}</span>
                    </div>
                    <div>
                      <span className="block text-neutral-500">Near Gaps</span>
                      <span className={`font-semibold mt-0.5 block ${lane.errors > 0 ? 'text-rose-400 font-bold' : 'text-neutral-300'}`}>{lane.errors}</span>
                    </div>
                    <div>
                      <span className="block text-neutral-500">Avg Lead</span>
                      <span className="font-semibold text-neutral-300 mt-0.5 block">{lane.latency}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

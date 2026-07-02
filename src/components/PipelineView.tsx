import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, 
  GitBranch, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  SlidersHorizontal,
  ChevronDown,
  Plus,
  Flame,
  CheckCircle,
  XCircle,
  Play,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { VideoRecord, Topic, TopicActivity, CycleGoal } from '../types';
import VercelView from './VercelView';

interface PipelineViewProps {
  videos: VideoRecord[];
  setVideos: React.Dispatch<React.SetStateAction<VideoRecord[]>>;
  onAddEvent: (evt: any) => void;
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  activities: TopicActivity[];
  setActivities: React.Dispatch<React.SetStateAction<TopicActivity[]>>;
  cycleGoals: CycleGoal | null;
  activeSubView?: 'videos' | 'topics';
  setActiveSubView?: (subView: 'videos' | 'topics') => void;
}

const STAGES = ['Topic', 'Script', 'Shoot', 'Edit', 'Thumbnail', 'Schedule', 'Published'] as const;

export default function PipelineView({ 
  videos, 
  setVideos, 
  onAddEvent,
  topics,
  setTopics,
  activities,
  setActivities,
  cycleGoals,
  activeSubView: propActiveSubView,
  setActiveSubView: propSetActiveSubView
}: PipelineViewProps) {
  const [localSubView, setLocalSubView] = useState<'videos' | 'topics'>('videos');
  const activeSubView = propActiveSubView || localSubView;
  const setActiveSubView = propSetActiveSubView || setLocalSubView;
  // Filters
  const [selectedChannel, setSelectedChannel] = useState<'All' | 'LearnDriven' | 'DecodeWorthy'>('All');
  const [selectedFormat, setSelectedFormat] = useState<'All' | 'Short' | 'Long' | 'Members'>('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'Blocked' | 'Safe'>('All');

  // Editing dialog modal
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editStage, setEditStage] = useState<typeof STAGES[number]>('Topic');
  const [editNotes, setEditNotes] = useState('');
  const [editBlocked, setEditBlocked] = useState('');
  const [editNextAction, setEditNextAction] = useState('');

  // Form for creating a new video from pipeline
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newChannel, setNewChannel] = useState<'LearnDriven' | 'DecodeWorthy'>('LearnDriven');
  const [newFormat, setNewFormat] = useState<'Short' | 'Long' | 'Members'>('Short');
  const [newTopic, setNewTopic] = useState('');

  // Handle advancing a video stage
  const handleAdvanceStage = (videoId: string) => {
    setVideos(prev => prev.map(v => {
      if (v.id === videoId) {
        const currentIndex = STAGES.indexOf(v.pipelineStage);
        if (currentIndex < STAGES.length - 1) {
          // Calculate next stage (skipping Thumbnail for Shorts if needed)
          let nextIndex = currentIndex + 1;
          if (STAGES[nextIndex] === 'Thumbnail' && v.format === 'Short') {
            nextIndex++; // Shorts bypass thumbnail stage
          }
          const nextStage = STAGES[nextIndex];
          
          // Auto update helper statuses
          const updated: Partial<VideoRecord> = {
            pipelineStage: nextStage,
            scriptStatus: nextStage === 'Script' ? 'in-progress' : (currentIndex >= 1 ? 'completed' : 'pending'),
            shootStatus: nextStage === 'Shoot' ? 'in-progress' : (currentIndex >= 2 ? 'completed' : 'pending'),
            editStatus: nextStage === 'Edit' ? 'in-progress' : (currentIndex >= 3 ? 'completed' : 'pending'),
            thumbnailStatus: nextStage === 'Thumbnail' ? 'in-progress' : (v.format === 'Short' ? 'not-applicable' : (currentIndex >= 4 ? 'completed' : 'pending')),
            scheduleStatus: nextStage === 'Schedule' ? 'completed' : 'pending',
            publishedStatus: nextStage === 'Published' ? 'completed' : 'pending',
          };

          if (nextStage === 'Published') {
            updated.uploadDate = new Date().toISOString();
          }

          onAddEvent({
            id: `evt-pipeline-advance-${Date.now()}`,
            source: 'system',
            type: 'info',
            message: `Pipeline: "${v.title}" advanced to ${nextStage}.`,
            timestamp: new Date().toISOString()
          });
          setActivities(current => [{
            id: `act-pipeline-advance-${Date.now()}-${v.id}`,
            topicName: v.title,
            channel: v.channelName,
            action: `Advanced pipeline stage from ${v.pipelineStage} to ${nextStage}`,
            author: 'Akshay',
            timestamp: new Date().toISOString(),
            topicId: v.id,
            targetTab: 'pipeline',
            targetSubView: 'videos'
          }, ...current]);

          return { ...v, ...updated };
        }
      }
      return v;
    }));
  };

  const handleMoveStage = (videoId: string, targetStage: typeof STAGES[number]) => {
    setVideos(prev => prev.map(v => {
      if (v.id === videoId) {
        if (v.pipelineStage === targetStage) return v;

        // Skip Thumbnail stage for Shorts if targetStage is Thumbnail
        if (targetStage === 'Thumbnail' && v.format === 'Short') {
          return v; 
        }

        const stageIdx = STAGES.indexOf(targetStage);
        const updated: Partial<VideoRecord> = {
          pipelineStage: targetStage,
          scriptStatus: stageIdx > 1 ? 'completed' : (stageIdx === 1 ? 'in-progress' : 'pending'),
          shootStatus: stageIdx > 2 ? 'completed' : (stageIdx === 2 ? 'in-progress' : 'pending'),
          editStatus: stageIdx > 3 ? 'completed' : (stageIdx === 3 ? 'in-progress' : 'pending'),
        };

        if (v.format === 'Short') {
          updated.thumbnailStatus = 'not-applicable';
        } else {
          updated.thumbnailStatus = stageIdx > 4 ? 'completed' : (stageIdx === 4 ? 'in-progress' : 'pending');
        }

        updated.scheduleStatus = targetStage === 'Schedule' || targetStage === 'Published' ? 'completed' : 'pending';
        updated.publishedStatus = targetStage === 'Published' ? 'completed' : 'pending';

        if (targetStage === 'Published' && !v.uploadDate) {
          updated.uploadDate = new Date().toISOString();
        }

        onAddEvent({
          id: `evt-pipeline-move-${Date.now()}`,
          source: 'system',
          type: 'info',
          message: `Pipeline: "${v.title}" moved to ${targetStage}.`,
          timestamp: new Date().toISOString()
        });
        setActivities(current => [{
          id: `act-pipeline-move-${Date.now()}-${v.id}`,
          topicName: v.title,
          channel: v.channelName,
          action: `Moved pipeline stage from ${v.pipelineStage} to ${targetStage}`,
          author: 'Akshay',
          timestamp: new Date().toISOString(),
          topicId: v.id,
          targetTab: 'pipeline',
          targetSubView: 'videos'
        }, ...current]);

        return { ...v, ...updated };
      }
      return v;
    }));
  };

  const handleOpenEdit = (video: VideoRecord) => {
    setEditingVideoId(video.id);
    setEditStage(video.pipelineStage);
    setEditNotes(video.notes || '');
    setEditBlocked(video.blockedReason || '');
    setEditNextAction(video.nextAction || '');
  };

  const handleSaveEdit = () => {
    if (!editingVideoId) return;

    setVideos(prev => prev.map(v => {
      if (v.id === editingVideoId) {
        const updated: Partial<VideoRecord> = {
          pipelineStage: editStage,
          notes: editNotes,
          blockedReason: editBlocked || undefined,
          nextAction: editNextAction || undefined
        };
        // sync helper status checkmarks
        const stageIdx = STAGES.indexOf(editStage);
        updated.scriptStatus = stageIdx > 1 ? 'completed' : (stageIdx === 1 ? 'in-progress' : 'pending');
        updated.shootStatus = stageIdx > 2 ? 'completed' : (stageIdx === 2 ? 'in-progress' : 'pending');
        updated.editStatus = stageIdx > 3 ? 'completed' : (stageIdx === 3 ? 'in-progress' : 'pending');
        
        if (v.format === 'Short') {
          updated.thumbnailStatus = 'not-applicable';
        } else {
          updated.thumbnailStatus = stageIdx > 4 ? 'completed' : (stageIdx === 4 ? 'in-progress' : 'pending');
        }

        updated.scheduleStatus = editStage === 'Schedule' || editStage === 'Published' ? 'completed' : 'pending';
        updated.publishedStatus = editStage === 'Published' ? 'completed' : 'pending';

        if (editStage === 'Published' && !v.uploadDate) {
          updated.uploadDate = new Date().toISOString();
        }

        return { ...v, ...updated };
      }
      return v;
    }));

    setEditingVideoId(null);
    onAddEvent({
      id: `evt-pipeline-update-${Date.now()}`,
      source: 'system',
      type: 'success',
      message: `Pipeline: Video record updated successfully.`,
      timestamp: new Date().toISOString()
    });
  };

  const handleDeleteVideo = () => {
    if (!editingVideoId) return;
    const video = videos.find(item => item.id === editingVideoId);
    if (!video || !window.confirm(`Delete "${video.title}"? This permanently removes it from the pipeline.`)) return;
    setVideos(prev => prev.filter(item => item.id !== editingVideoId));
    setEditingVideoId(null);
    onAddEvent({
      id: `evt-pipeline-delete-${Date.now()}`,
      source: 'system',
      type: 'warning',
      message: `Pipeline: Deleted "${video.title}".`,
      timestamp: new Date().toISOString()
    });
  };

  const handleCreateVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newVideo: VideoRecord = {
      id: `v-manual-${Date.now()}`,
      channelName: newChannel,
      title: newTitle,
      format: newFormat,
      contentType: newFormat === 'Short' ? 'News decode' : 'Deep explainer',
      topic: newTopic || 'General',
      pipelineStage: 'Topic',
      scriptStatus: 'pending',
      shootStatus: 'pending',
      editStatus: 'pending',
      thumbnailStatus: newFormat === 'Short' ? 'not-applicable' : 'pending',
      scheduleStatus: 'pending',
      publishedStatus: 'pending',
      productionEffortHours: 0,
      nextAction: 'Write the outline and script hook',
      tags: {
        topicType: newTopic || 'General',
        hookType: 'Question',
        contentStructure: 'Problem solution',
        productionStyle: 'Default',
        audienceIntent: 'Curiosity',
        difficulty: 'Medium',
        evergreenPotential: 'Medium',
        revenuePotential: 'Medium',
        subscriberPotential: 'Medium',
        repeatability: 'High'
      }
    };

    setVideos(prev => [newVideo, ...prev]);
    setIsCreateOpen(false);
    setNewTitle('');
    setNewTopic('');

    onAddEvent({
      id: `evt-video-created-${Date.now()}`,
      source: 'system',
      type: 'success',
      message: `Pipeline: Created new video topic "${newTitle}" under ${newChannel}.`,
      timestamp: new Date().toISOString()
    });
  };

  // Filter videos
  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      const matchChannel = selectedChannel === 'All' || v.channelName === selectedChannel;
      const matchFormat = selectedFormat === 'All' || v.format === selectedFormat;
      const matchStatus = selectedStatus === 'All' || 
                          (selectedStatus === 'Blocked' && !!v.blockedReason) || 
                          (selectedStatus === 'Safe' && !v.blockedReason);
      return matchChannel && matchFormat && matchStatus;
    });
  }, [videos, selectedChannel, selectedFormat, selectedStatus]);

  // Buffer and Pipeline risk logic
  const pipelineRisk = useMemo(() => {
    const learnDrivenBacklog = videos.filter(v => v.channelName === 'LearnDriven' && v.pipelineStage !== 'Published');
    const decodeWorthyBacklog = videos.filter(v => v.channelName === 'DecodeWorthy' && v.pipelineStage !== 'Published');
    
    const learnDrivenScheduled = videos.filter(v => v.channelName === 'LearnDriven' && v.pipelineStage === 'Schedule');
    const decodeWorthyScheduled = videos.filter(v => v.channelName === 'DecodeWorthy' && v.pipelineStage === 'Schedule');

    return {
      learnDriven: {
        status: learnDrivenScheduled.length >= 2 ? 'Safe' : (learnDrivenScheduled.length === 1 ? 'At Risk' : 'Behind'),
        color: learnDrivenScheduled.length >= 2 ? 'text-emerald-400' : (learnDrivenScheduled.length === 1 ? 'text-amber-400 animate-pulse' : 'text-red-400 animate-pulse'),
        count: learnDrivenBacklog.length
      },
      decodeWorthy: {
        status: decodeWorthyScheduled.length >= 2 ? 'Safe' : (decodeWorthyScheduled.length === 1 ? 'At Risk' : 'Behind'),
        color: decodeWorthyScheduled.length >= 2 ? 'text-emerald-400' : (decodeWorthyScheduled.length === 1 ? 'text-amber-400 animate-pulse' : 'text-red-400 animate-pulse'),
        count: decodeWorthyBacklog.length
      }
    };
  }, [videos]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Channels Integrity Status */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-neutral-900 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="h-5 w-5 text-amber-400" />
            Production Pipeline
          </h2>
          <p className="text-xs text-neutral-500 font-mono mt-1">Manage active content stages, thumbnails, and blockers.</p>
        </div>

        {/* Channels Health Status Grid */}
        <div className="flex gap-4 bg-neutral-900/30 border border-neutral-850 p-2 rounded-lg text-xs font-mono">
          <div className="flex items-center gap-2 px-2.5 py-1 border-r border-neutral-850">
            <span className="text-neutral-500 font-bold">LearnDriven:</span>
            <span className={pipelineRisk.learnDriven.color}>{pipelineRisk.learnDriven.status}</span>
            <span className="text-neutral-600">({pipelineRisk.learnDriven.count} in dev)</span>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1">
            <span className="text-neutral-500 font-bold">DecodeWorthy:</span>
            <span className={pipelineRisk.decodeWorthy.color}>{pipelineRisk.decodeWorthy.status}</span>
            <span className="text-neutral-600">({pipelineRisk.decodeWorthy.count} in dev)</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Toggle */}
      <div className="flex items-center gap-2 border-b border-neutral-900 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubView('videos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
            activeSubView === 'videos'
              ? 'bg-neutral-900 border border-neutral-850 text-white'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
          }`}
        >
          <span>Video Pipeline (Kanban)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubView('topics')}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition ${
            activeSubView === 'topics'
              ? 'bg-neutral-900 border border-neutral-850 text-white'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/30'
          }`}
        >
          <span>Topic Workflow</span>
        </button>
      </div>

      {activeSubView === 'videos' ? (
        <>
          {/* Control Bar: Filters & Actions */}
      <div className="flex flex-col md:flex-row justify-between gap-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Channel Filters */}
          <div className="flex bg-neutral-900 border border-neutral-850 rounded-lg p-0.5">
            {(['All', 'LearnDriven', 'DecodeWorthy'] as const).map(c => (
              <button 
                key={c}
                onClick={() => setSelectedChannel(c)}
                className={`px-3 py-1 rounded text-xs font-semibold font-mono transition ${selectedChannel === c ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                {c === 'All' ? 'All Channels' : c}
              </button>
            ))}
          </div>

          {/* Format Filter */}
          <div className="flex bg-neutral-900 border border-neutral-850 rounded-lg p-0.5">
            {(['All', 'Short', 'Long', 'Members'] as const).map(f => (
              <button 
                key={f}
                onClick={() => setSelectedFormat(f)}
                className={`px-3 py-1 rounded text-xs font-semibold font-mono transition ${selectedFormat === f ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                {f === 'All' ? 'All Formats' : f}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex bg-neutral-900 border border-neutral-850 rounded-lg p-0.5">
            {(['All', 'Blocked', 'Safe'] as const).map(s => (
              <button 
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={`px-3 py-1 rounded text-xs font-semibold font-mono transition ${selectedStatus === s ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                {s}
              </button>
            ))}
          </div>

        </div>

        {/* Add Video Button */}
        <motion.button 
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-black font-bold font-mono text-xs rounded-lg flex items-center gap-1.5 shrink-0 transition shadow-md"
        >
          <Plus className="h-4 w-4" /> Create Pipeline Item
        </motion.button>
      </div>

      {/* Kanban Board Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-2 overflow-x-auto pb-4 no-scrollbar">
        {STAGES.map(stage => {
          const items = filteredVideos.filter(v => v.pipelineStage === stage);

          return (
            <div 
              key={stage} 
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const videoId = e.dataTransfer.getData('text/plain');
                handleMoveStage(videoId, stage);
              }}
              className="min-w-[150px] bg-neutral-950/20 border border-neutral-900/30 rounded-lg p-2.5 flex flex-col gap-2 min-h-[420px]"
            >
              
              {/* Stage Header */}
              <div className="flex justify-between items-center pb-1.5 border-b border-neutral-900/40">
                <span className="text-[10px] font-bold text-neutral-500 font-mono tracking-wider uppercase">{stage}</span>
                <span className="px-1.5 py-0.2 bg-neutral-900/40 border border-neutral-900/30 text-neutral-500 rounded text-[8px] font-mono">{items.length}</span>
              </div>

              {/* Cards List */}
              <div className="flex flex-col gap-2 overflow-y-auto flex-1 max-h-[550px] scrollbar-none">
                {items.map(video => {
                  const isLearnDriven = video.channelName === 'LearnDriven';
                  return (
                    <motion.div
                      layout
                      key={video.id}
                      id={`pipeline-video-${video.id}`}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', video.id);
                      }}
                      onClick={() => handleOpenEdit(video)}
                      style={{ 
                        borderLeft: isLearnDriven 
                          ? '2px solid rgba(168, 85, 247, 0.3)' 
                          : '2px solid rgba(16, 185, 129, 0.3)' 
                      }}
                      className={`p-2.5 rounded bg-zinc-900/10 border border-zinc-900/20 hover:border-zinc-800/40 hover:bg-zinc-850/15 relative overflow-hidden transition-all duration-150 group cursor-grab active:cursor-grabbing hover:shadow-[0_0_8px_rgba(139,92,246,0.015)] ${video.blockedReason ? 'border-red-950/20 bg-red-950/3' : ''}`}
                    >
                      <div className="flex flex-col gap-1">
                        {/* Tags / Badges */}
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`text-[7px] font-mono font-bold px-1 py-0.2 rounded border uppercase ${isLearnDriven ? 'text-purple-400/80 bg-purple-950/5 border-purple-900/10' : 'text-emerald-400/80 bg-emerald-950/5 border-emerald-900/10'}`}>
                            {video.channelName === 'LearnDriven' ? 'LD' : 'DW'}
                          </span>
                          <span className="text-[7px] font-mono font-bold bg-zinc-900/30 text-zinc-500 px-1 py-0.2 rounded border border-zinc-900/30">
                            {video.format}
                          </span>
                          {video.blockedReason && (
                            <span className="text-[7px] font-mono font-bold bg-red-950/10 text-red-400/80 px-1 py-0.2 rounded border border-red-900/15 animate-pulse">
                              BLOCKED
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="text-[10px] font-semibold text-zinc-300 leading-snug font-sans line-clamp-2 pr-4">
                          {video.title}
                        </h4>

                        {/* Topic Label */}
                        <span className="text-[8px] font-mono text-zinc-650 flex items-center gap-1 select-none">
                          <GitBranch className="h-2.5 w-2.5 shrink-0 text-zinc-700" />
                          <span className="truncate">{video.topic}</span>
                        </span>

                        {/* Absolute positioned next button overlay (no layout shifting) */}
                        {stage !== 'Published' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdvanceStage(video.id);
                            }}
                            className="absolute bottom-2 right-2 p-1 bg-zinc-950 border border-zinc-850 rounded hover:border-zinc-800 text-indigo-400 hover:text-indigo-300 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center justify-center shadow-md cursor-pointer"
                            title="Move to next stage"
                          >
                            <Play className="h-2 w-2 fill-current" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}

                {items.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-6 text-neutral-800 text-[8px] font-mono select-none">
                    empty
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* Editing Dialog Modal */}
      <AnimatePresence>
        {editingVideoId && (() => {
          const video = videos.find(v => v.id === editingVideoId)!;
          return (
            <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.97, opacity: 0 }}
                className="bg-neutral-950 border border-neutral-900 rounded-xl max-w-md w-full p-6 shadow-2xl relative"
              >
                <div className="flex justify-between items-start mb-4 border-b border-neutral-900 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white font-sans tracking-tight">Edit Production Item</h3>
                    <p className="text-[10px] text-neutral-500 font-mono mt-0.5">{video.title}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-widest ${video.channelName === 'LearnDriven' ? 'text-purple-400 bg-purple-950/40 border border-purple-900/30' : 'text-emerald-400 bg-emerald-950/40 border border-emerald-900/30'}`}>
                    {video.channelName}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Pipeline Stage Select */}
                  <div>
                    <label className="block text-[9px] text-neutral-500 uppercase mb-1 font-mono">Pipeline Stage</label>
                    <div className="relative">
                      <select 
                        value={editStage}
                        onChange={(e) => setEditStage(e.target.value as any)}
                        className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-mono appearance-none cursor-pointer"
                      >
                        {STAGES.map(s => {
                          if (s === 'Thumbnail' && video.format === 'Short') return null;
                          return <option key={s} value={s}>{s}</option>;
                        })}
                      </select>
                      <ChevronDown className="h-4 w-4 text-neutral-400 absolute right-3 top-2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Next Action Directives */}
                  <div>
                    <label className="block text-[9px] text-neutral-500 uppercase mb-1 font-mono">Next Action</label>
                    <input
                      type="text"
                      placeholder="e.g. Write hook intro, film B-roll clip..."
                      value={editNextAction}
                      onChange={(e) => setEditNextAction(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-sans"
                    />
                  </div>

                  {/* Blocked Reason */}
                  <div>
                    <label className="block text-[9px] text-neutral-500 uppercase mb-1 font-mono flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-red-500 animate-pulse" />
                      <span>Blocked Reason (Leave blank if not blocked)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rendering issue, missing script review..."
                      value={editBlocked}
                      onChange={(e) => setEditBlocked(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-sans"
                    />
                  </div>

                  {/* Production Notes */}
                  <div>
                    <label className="block text-[9px] text-neutral-500 uppercase mb-1 font-mono">Production Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Add specific references, links, or ideas..."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-sans resize-none"
                    />
                  </div>

                  {/* Save/Cancel Controls */}
                  <div className="flex justify-between gap-2 text-[10px] pt-3 border-t border-neutral-900">
                    <button
                      type="button"
                      onClick={handleDeleteVideo}
                      className="px-3 py-1.5 text-rose-400 hover:text-rose-300 font-mono border border-rose-900/40 rounded"
                    >
                      Delete Item
                    </button>
                    <div className="flex gap-2">
                    <button
                      onClick={() => setEditingVideoId(null)}
                      className="px-3 py-1.5 text-neutral-500 hover:text-neutral-300 font-mono"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold font-mono rounded"
                    >
                      Save Changes
                    </button>
                    </div>
                  </div>
                </div>

              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Create Pipeline Item Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-neutral-950 border border-neutral-900 rounded-xl max-w-md w-full p-6 shadow-2xl"
            >
              <h3 className="text-sm font-bold text-white font-sans tracking-tight mb-4 border-b border-neutral-900 pb-3">
                Create New Content Pipeline Topic
              </h3>

              <form onSubmit={handleCreateVideo} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-[9px] text-neutral-500 uppercase mb-1 font-mono">Video Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Explaining Quantum Physics under 60s"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-sans"
                  />
                </div>

                {/* Channel Select */}
                <div>
                  <label className="block text-[9px] text-neutral-500 uppercase mb-1 font-mono">Target Channel</label>
                  <div className="relative">
                    <select
                      value={newChannel}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setNewChannel(val);
                        // DecodeWorthy only supports Shorts content format
                        if (val === 'DecodeWorthy') {
                          setNewFormat('Short');
                        }
                      }}
                      className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-mono appearance-none cursor-pointer"
                    >
                      <option value="LearnDriven">LearnDriven</option>
                      <option value="DecodeWorthy">DecodeWorthy</option>
                    </select>
                    <ChevronDown className="h-4 w-4 text-neutral-400 absolute right-3 top-2 pointer-events-none" />
                  </div>
                </div>

                {/* Format Select */}
                <div>
                  <label className="block text-[9px] text-neutral-500 uppercase mb-1 font-mono">Content Format</label>
                  <div className="relative">
                    <select
                      value={newFormat}
                      disabled={newChannel === 'DecodeWorthy'}
                      onChange={(e) => setNewFormat(e.target.value as any)}
                      className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-mono appearance-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="Short">Short</option>
                      <option value="Long">Long Video</option>
                      <option value="Members">Members-Only Video</option>
                    </select>
                    <ChevronDown className="h-4 w-4 text-neutral-400 absolute right-3 top-2 pointer-events-none" />
                  </div>
                </div>

                {/* Topic Input */}
                <div>
                  <label className="block text-[9px] text-neutral-500 uppercase mb-1 font-mono">Topic Domain</label>
                  <input
                    type="text"
                    placeholder="e.g. Science, Space, History..."
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-sans"
                  />
                </div>

                {/* Controls */}
                <div className="flex justify-end gap-2 text-[10px] pt-3 border-t border-neutral-900">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-3 py-1.5 text-neutral-500 hover:text-neutral-300 font-mono"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-black font-bold font-mono rounded"
                  >
                    Create Item
                  </button>
                </div>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      ) : (
        <VercelView
          projects={[]}
          onAddEvent={onAddEvent}
          onUpdateProject={() => {}}
          topics={topics}
          setTopics={setTopics}
          activities={activities}
          setActivities={setActivities}
          cycleGoals={cycleGoals}
        />
      )}

    </div>
  );
}

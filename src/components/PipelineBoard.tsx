import React, { useState } from 'react';
import { VideoItem, VideoStage, StageStatus, MonthlyGoals, RevenueLevelConfig, VideoRevenueEligibility, VideoStatus } from '../types';
import { 
  Plus, Calendar, HelpCircle, Check, ArrowRight, ArrowLeft, 
  Trash2, ShieldAlert, BadgeDollarSign, Tag, MessageSquare, Flame, Edit3, X, Sparkles, Activity
} from 'lucide-react';
import TactileLED from './TactileLED';
import { calculateRevenueLevel, EMPTY_REVENUE_ELIGIBILITY, getLocalDateString, getVideoStatus, inferRevenueEligibility, statusNeedsAttention } from '../videoLogic';

interface PipelineBoardProps {
  videos: VideoItem[];
  goals: MonthlyGoals;
  revenueLevels: RevenueLevelConfig[];
  onUpdateVideo: (video: VideoItem) => void;
  onAddVideo: (video: Omit<VideoItem, 'id' | 'completionPercentage'>) => void;
  onDeleteVideo: (id: string) => void;
}

const getStatusConfig = (status: VideoStatus) => {
  switch (status) {
    case 'neutral':
      return {
        color: 'white' as const,
        importance: 'low' as const,
        label: 'NEUTRAL',
        borderClass: 'border-zinc-700/70',
        bgClass: 'bg-zinc-900/35 border-zinc-700/60 text-zinc-300',
      };
    case 'good':
      return {
        color: 'emerald' as const,
        importance: 'low' as const,
        label: 'GOOD',
        borderClass: 'border-emerald-800/60',
        bgClass: 'bg-emerald-950/20 border-emerald-800/50 text-emerald-400',
      };
    case 'attention':
      return { 
        color: 'yellow' as const, 
        importance: 'low' as const, 
        label: 'ATTENTION',
        borderClass: 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]',
        bgClass: 'bg-yellow-950/20 border-yellow-900/40 text-yellow-450',
      };
    case 'warning':
      return { 
        color: 'orange' as const, 
        importance: 'medium' as const, 
        label: 'WARNING',
        borderClass: 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.15)]',
        bgClass: 'bg-orange-950/20 border-orange-900/40 text-orange-400',
      };
    case 'critical':
    default:
      return { 
        color: 'red' as const, 
        importance: 'critical' as const, 
        label: 'CRITICAL',
        borderClass: 'border-rose-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]',
        bgClass: 'bg-rose-950/20 border-rose-900/40 text-rose-400',
      };
  }
};

export default function PipelineBoard({ 
  videos, 
  goals, 
  revenueLevels,
  onUpdateVideo, 
  onAddVideo, 
  onDeleteVideo 
}: PipelineBoardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  
  // New Video Form State
  const [newTitle, setNewTitle] = useState('');
  const [newChannel, setNewChannel] = useState<'LearnDriven' | 'DecodeWorthy'>('LearnDriven');
  const [newLane, setNewLane] = useState<VideoItem['contentLane']>('LearnDriven Shorts');
  const [newEligibility, setNewEligibility] = useState<VideoRevenueEligibility>({ ...EMPTY_REVENUE_ELIGIBILITY });
  
  // Quick Edit Form State (for selected card)
  const [editStatusNote, setEditStatusNote] = useState('');
  const [editStatus, setEditStatus] = useState<VideoStatus>('neutral');

  const stages: VideoStage[] = ['Topic', 'Script', 'Shoot', 'Edit', 'Thumbnail', 'Schedule', 'Done'];
  const calculatedRevenueLevel = calculateRevenueLevel(newLane, newEligibility);
  const calculatedRevenueConfig = revenueLevels.find(level => level.level === calculatedRevenueLevel);
  const eligibilityOptions: Array<{ key: keyof VideoRevenueEligibility; label: string; description: string; visible: boolean }> = [
    { key: 'viralPotential', label: 'Viral topic potential', description: 'The idea has a strong timely or shareable hook.', visible: newLane !== 'LearnDriven Members-only Videos' },
    { key: 'productTag', label: 'Relevant product tag', description: 'A genuinely useful product can be attached to this topic.', visible: true },
    { key: 'pinnedComment', label: 'Pinned promotion or link', description: 'A relevant member video, resource, or offer can be pinned.', visible: newLane !== 'LearnDriven Members-only Videos' },
    { key: 'overEightMinutes', label: 'Can naturally exceed 8 minutes', description: 'The topic supports an 8+ minute video without padding.', visible: newLane === 'LearnDriven Long Videos' },
    { key: 'breakoutAttempt', label: 'Experimental breakout attempt', description: 'A high-risk idea intentionally designed for exceptional reach.', visible: newLane !== 'LearnDriven Members-only Videos' },
    { key: 'brandCollaboration', label: 'Brand collaboration attached', description: 'A confirmed sponsor or paid brand integration is attached.', visible: true },
  ];
  const statusOptions = [
    { value: 'neutral', label: 'Neutral', detail: 'No assessment yet', color: 'white', importance: 'low' },
    { value: 'good', label: 'Good', detail: 'No issues', color: 'emerald', importance: 'low' },
    { value: 'attention', label: 'Attention', detail: 'Keep an eye on it', color: 'yellow', importance: 'low' },
    { value: 'warning', label: 'Warning', detail: 'May cause a delay', color: 'orange', importance: 'medium' },
    { value: 'critical', label: 'Critical', detail: 'Cannot progress', color: 'red', importance: 'critical' },
  ] as const;

  const handleCreateVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // Set initial pipeline stages depending on type
    const initialPipeline: VideoItem['pipeline'] = {
      topic: 'In progress',
      script: 'Not started',
      shoot: 'Not started',
      edit: 'Not started',
      schedule: 'Not started'
    };

    if (newLane === 'LearnDriven Long Videos') {
      initialPipeline.thumbnail = 'Not started';
    }

    onAddVideo({
      channel: newChannel,
      contentLane: newLane,
      title: newTitle,
      createdAt: getLocalDateString(),
      revenueLevelTarget: calculateRevenueLevel(newLane, newEligibility),
      revenueEligibility: newEligibility,
      pipeline: initialPipeline,
      currentStage: 'Topic',
      isBlocked: false,
      status: 'neutral',
      statusNote: '',
      productTagStatus: newEligibility.productTag ? 'Available' : 'Unsuitable',
      pinnedCommentStatus: 'None',
      membersPromotionStatus: 'None',
      brandCollabStatus: newEligibility.brandCollaboration ? 'Attached' : 'None',
      notes: ''
    });

    setNewTitle('');
    setNewEligibility({ ...EMPTY_REVENUE_ELIGIBILITY });
    setIsAdding(false);
  };

  const moveStage = (video: VideoItem, direction: 'forward' | 'backward') => {
    const isLongVideo = video.contentLane === 'LearnDriven Long Videos';
    const stageFlow: VideoStage[] = isLongVideo
      ? ['Topic', 'Script', 'Shoot', 'Edit', 'Thumbnail', 'Schedule', 'Done']
      : ['Topic', 'Script', 'Shoot', 'Edit', 'Schedule', 'Done'];

    const currentIndex = stageFlow.indexOf(video.currentStage);
    let nextIndex = currentIndex;

    if (direction === 'forward') {
      nextIndex = Math.min(stageFlow.length - 1, currentIndex + 1);
    } else {
      nextIndex = Math.max(0, currentIndex - 1);
    }

    if (nextIndex === currentIndex) return;

    const nextStage = stageFlow[nextIndex];
    const updatedPipeline = { ...video.pipeline };

    // Update statuses based on movement
    stageFlow.forEach((stg, idx) => {
      const field = stg.toLowerCase() as keyof VideoItem['pipeline'];
      if (idx < nextIndex) {
        if (updatedPipeline[field]) updatedPipeline[field] = 'Done';
      } else if (idx === nextIndex) {
        if (nextStage === 'Done') {
          // All complete
          if (updatedPipeline.topic) updatedPipeline.topic = 'Done';
          if (updatedPipeline.script) updatedPipeline.script = 'Done';
          if (updatedPipeline.shoot) updatedPipeline.shoot = 'Done';
          if (updatedPipeline.edit) updatedPipeline.edit = 'Done';
          if (updatedPipeline.thumbnail) updatedPipeline.thumbnail = 'Done';
          if (updatedPipeline.schedule) updatedPipeline.schedule = 'Done';
        } else {
          if (updatedPipeline[field]) updatedPipeline[field] = 'In progress';
        }
      } else {
        if (updatedPipeline[field]) updatedPipeline[field] = 'Not started';
      }
    });

    onUpdateVideo({
      ...video,
      currentStage: nextStage,
      pipeline: updatedPipeline,
      actualScheduledDate: nextStage === 'Done' ? getLocalDateString() : undefined
    });
  };

  const openStatusEditor = (video: VideoItem) => {
    setSelectedVideo(video);
    setEditStatusNote(video.statusNote || video.blockerReason || '');
    setEditStatus(getVideoStatus(video));
  };

  const handleSaveStatus = () => {
    if (selectedVideo) {
      const needsAttention = statusNeedsAttention(editStatus);
      onUpdateVideo({
        ...selectedVideo,
        status: editStatus,
        statusNote: editStatusNote.trim(),
        isBlocked: needsAttention,
        blockerReason: needsAttention ? editStatusNote.trim() || undefined : undefined,
        blockerSeverity: needsAttention ? editStatus : undefined,
      });
      setSelectedVideo(null);
    }
  };

  const handleToggleProductTag = (video: VideoItem) => {
    const nextStatus = video.productTagStatus === 'Tagged' ? 'Available' : 'Tagged';
    const revenueEligibility = { ...inferRevenueEligibility(video), productTag: nextStatus !== 'Available' || video.productTagStatus !== 'Unsuitable' };
    onUpdateVideo({
      ...video,
      productTagStatus: nextStatus,
      revenueEligibility,
      revenueLevelTarget: calculateRevenueLevel(video.contentLane, revenueEligibility)
    });
  };

  return (
    <div className="space-y-4">
      {/* Header Board Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-900 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-emerald-400" />
          <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            VIDEO PRODUCTION BOARD
          </h2>
        </div>
        
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-3 py-1.5 rounded font-mono text-[10px] font-bold tracking-wider flex items-center gap-1 uppercase transition-colors"
        >
          {isAdding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {isAdding ? 'Close Form' : 'Add Video'}
        </button>
      </div>

      {/* Deploy Video Form Panel (Expandable) */}
      {isAdding && (
        <form onSubmit={handleCreateVideo} className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg space-y-4 font-mono text-[11px] animate-fadeIn">
          <div className="flex justify-between items-center border-b border-zinc-900 pb-1.5">
            <span className="text-white font-bold tracking-wide uppercase">Add a New Video</span>
            <span className="text-zinc-600">VIDEO DETAILS</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-zinc-500 block">Topic / Title Description</label>
              <input
                type="text"
                placeholder="e.g. Mastering Advanced Tailwind v4 Themes"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-850 rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-500 block">Channel</label>
              <select
                value={newChannel}
                onChange={e => {
                  const channel = e.target.value as 'LearnDriven' | 'DecodeWorthy';
                  setNewChannel(channel);
                  setNewLane(channel === 'LearnDriven' ? 'LearnDriven Shorts' : 'DecodeWorthy Shorts');
                }}
                className="w-full bg-zinc-900 border border-zinc-850 rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="LearnDriven">LearnDriven</option>
                <option value="DecodeWorthy">DecodeWorthy</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-zinc-500 block">Content Type</label>
              <select
                value={newLane}
                onChange={e => {
                  const lane = e.target.value as VideoItem['contentLane'];
                  setNewLane(lane);
                  if (lane !== 'LearnDriven Long Videos') {
                    setNewEligibility(prev => ({ ...prev, overEightMinutes: false }));
                  }
                }}
                className="w-full bg-zinc-900 border border-zinc-850 rounded px-2 py-1.5 text-zinc-200 focus:outline-none"
              >
                {newChannel === 'LearnDriven' ? (
                  <>
                    <option value="LearnDriven Shorts">LearnDriven Shorts</option>
                    <option value="LearnDriven Long Videos">LearnDriven Long Videos</option>
                    <option value="LearnDriven Members-only Videos">LearnDriven Members-only Videos</option>
                  </>
                ) : (
                  <option value="DecodeWorthy Shorts">DecodeWorthy Shorts</option>
                )}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-zinc-400 font-bold uppercase tracking-wider">What can this video genuinely include?</div>
              <p className="text-[9px] text-zinc-600 mt-0.5">Select only what fits the topic. Revenue level is calculated automatically.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {eligibilityOptions.filter(option => option.visible).map(option => (
                <label key={option.key} className={`border rounded p-2.5 flex items-start gap-2 cursor-pointer transition-colors ${newEligibility[option.key] ? 'border-emerald-500/50 bg-emerald-950/15' : 'border-zinc-850 bg-zinc-900/25 hover:border-zinc-700'}`}>
                  <input
                    type="checkbox"
                    checked={newEligibility[option.key]}
                    onChange={event => setNewEligibility(prev => ({ ...prev, [option.key]: event.target.checked }))}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <span>
                    <span className="block text-zinc-200 font-bold">{option.label}</span>
                    <span className="block text-[9px] text-zinc-600 leading-relaxed mt-0.5">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="border border-cyan-900/50 bg-cyan-950/10 rounded p-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <span className="text-[9px] text-cyan-500 uppercase tracking-wider block">Automatically assigned</span>
                <span className="text-cyan-300 font-bold text-sm">Revenue Level {calculatedRevenueLevel}</span>
              </div>
              <div className="md:text-right max-w-xl">
                <span className="text-zinc-300 block">{calculatedRevenueConfig?.description || 'Revenue rules will be applied from the current configuration.'}</span>
                <span className="text-[9px] text-zinc-600">Topic created date will be saved automatically as {getLocalDateString()}.</span>
                {!goals.enabledRevenueLevels.includes(calculatedRevenueLevel) && (
                  <span className="text-[9px] text-amber-400 block mt-1">This level is currently disabled in the monthly plan, so it will not count toward the earning outlook.</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-4 py-1.5 rounded uppercase font-mono tracking-wider text-[10px]"
            >
              ADD TO PRODUCTION BOARD
            </button>
          </div>
        </form>
      )}

      {/* Kanban Stages Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 w-full select-none">
        {stages.map((stage) => {
          // Filter items corresponding to this active stage
          const stageVideos = videos.filter(v => v.currentStage === stage);

          return (
            <div 
              key={stage} 
              className="bg-zinc-950 border border-zinc-900 rounded-lg p-3 flex flex-col justify-between space-y-3"
            >
              {/* Stage Header */}
              <div className="border-b border-zinc-900 pb-2 flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <TactileLED color={stage === 'Done' ? 'emerald' : 'zinc'} importance="low" active={stage === 'Done'} />
                  <span className="font-bold text-zinc-200 tracking-wider text-[11px] uppercase">{stage}</span>
                </div>
                <span className="font-mono text-[9px] bg-zinc-900 text-zinc-500 px-1.5 py-0.5 rounded font-bold">
                  {stageVideos.length}
                </span>
              </div>

              {/* Card List */}
              <div className="flex-1 space-y-2 max-h-[480px] overflow-y-auto pr-1 min-h-[120px]">
                {stageVideos.length === 0 ? (
                  <div className="h-full border border-dashed border-zinc-900/60 rounded flex flex-col items-center justify-center text-center p-6 text-zinc-600 font-mono text-[10px] space-y-1">
                    <span>NO VIDEOS HERE</span>
                    <span>This stage is currently empty</span>
                  </div>
                ) : (
                  stageVideos.map((video) => {
                      const videoStatus = getVideoStatus(video);
                      const config = getStatusConfig(videoStatus);
                      return (
                        <div 
                          key={video.id}
                          className={`bg-zinc-900/40 hover:bg-zinc-900/80 border transition-all rounded p-3 space-y-3 relative group ${config.borderClass}`}
                        >
                          {/* Channel / Lane Badges */}
                          <div className="flex flex-wrap items-center justify-between gap-1 text-[8px] font-mono">
                            <span className={`px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                              video.channel === 'LearnDriven' 
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50' 
                                : 'bg-cyan-950/40 text-cyan-400 border border-cyan-900/50'
                            }`}>
                              {video.channel}
                            </span>
                            <span className="text-zinc-500 truncate max-w-[130px]">
                              {video.contentLane}
                            </span>
                          </div>

                          {/* Title with potential alerts */}
                          <h4 className="text-[11px] font-semibold text-zinc-200 tracking-wide leading-tight group-hover:text-white transition-colors flex items-start gap-1.5">
                            <span className="pt-0.5">
                              <TactileLED color={config.color} importance={config.importance} />
                            </span>
                            {video.title}
                          </h4>

                          <div className={`border rounded p-1.5 text-[10px] font-mono flex items-start gap-1.5 ${videoStatus === 'critical' ? 'animate-pulse' : ''} ${config.bgClass}`}>
                              <Activity className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              <div className="leading-tight">
                                <span className="font-bold block uppercase text-[8px] tracking-wide">
                                  STATUS: {config.label}
                                </span>
                                {(video.statusNote || video.blockerReason) && <span>{video.statusNote || video.blockerReason}</span>}
                              </div>
                          </div>

                        {/* Upgrade and Target metadata */}
                        <div className="flex flex-wrap justify-between items-center gap-1 pt-1.5 border-t border-zinc-900/60 font-mono text-[9px] text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-zinc-600" />
                            ADDED: {video.createdAt || 'DATE UNKNOWN'}
                          </span>
                          <span className="bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded font-bold border border-zinc-850">
                            LVL {video.revenueLevelTarget}
                          </span>
                        </div>

                        {/* Control buttons & upgrades */}
                        <div className="flex items-center justify-between gap-1 pt-2 border-t border-zinc-900/80">
                          <div className="flex gap-1.5">
                            {/* Product tag click upgrade */}
                            {goals.productTagsAllowed && inferRevenueEligibility(video).productTag && (
                              <button
                                type="button"
                                onClick={() => handleToggleProductTag(video)}
                                className={`p-1 rounded border transition-colors ${
                                  video.productTagStatus === 'Tagged'
                                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-400'
                                    : 'border-zinc-850 text-zinc-500 hover:text-zinc-300'
                                }`}
                                title={video.productTagStatus === 'Tagged' ? 'Product Tagged' : 'Add Product Tag Opportunity'}
                              >
                                <Tag className="h-3 w-3" />
                              </button>
                            )}

                            {/* Video Status */}
                            <button
                              type="button"
                              onClick={() => openStatusEditor(video)}
                              className={`p-1 rounded border transition-colors ${config.bgClass}`}
                              title="Edit video status"
                            >
                              <Activity className="h-3 w-3" />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => onDeleteVideo(video.id)}
                              className="p-1 rounded border border-zinc-850 text-zinc-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
                              title="Delete video"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Progression Flow arrows */}
                          <div className="flex gap-1">
                            {stage !== 'Topic' && (
                              <button
                                type="button"
                                onClick={() => moveStage(video, 'backward')}
                                className="p-1 rounded border border-zinc-850 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                                title="Move to previous stage"
                              >
                                <ArrowLeft className="h-3 w-3" />
                              </button>
                            )}
                            {stage !== 'Done' && (
                              <button
                                type="button"
                                onClick={() => moveStage(video, 'forward')}
                                className="bg-emerald-950/20 hover:bg-emerald-500 hover:text-zinc-950 border border-emerald-900/40 text-emerald-400 p-1 rounded transition-all font-bold font-mono text-[9px] flex items-center gap-0.5"
                                title="Move to next stage"
                              >
                                NEXT
                                <ArrowRight className="h-3 w-3 font-bold" />
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Video status editor */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-mono text-xs">
          <div className={`bg-zinc-950 border rounded-lg p-5 space-y-5 w-full max-w-2xl transition-all ${getStatusConfig(editStatus).borderClass}`}>
            <div className="flex justify-between items-center border-b border-zinc-900 pb-3">
              <div>
                <span className="text-zinc-100 font-bold uppercase tracking-wider block">Video Status</span>
                <span className="text-[9px] text-zinc-600 block mt-1">{selectedVideo.title}</span>
              </div>
              <TactileLED color={getStatusConfig(editStatus).color} importance={getStatusConfig(editStatus).importance} />
            </div>

            <div className="space-y-2">
              <label className="text-zinc-500 block uppercase text-[10px] font-bold">Choose the current status</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {statusOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setEditStatus(option.value)}
                    className={`flex flex-col items-center gap-2 p-3 rounded border transition-all ${editStatus === option.value ? getStatusConfig(option.value).bgClass : 'bg-zinc-900/30 border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                  >
                    <TactileLED color={option.color} importance={option.importance} active={editStatus === option.value} />
                    <span className="text-[9px] font-bold tracking-wider uppercase">{option.label}</span>
                    <span className="text-[8px] normal-case leading-tight opacity-70">{option.detail}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-500 block uppercase text-[10px] font-bold">What is the status? <span className="normal-case font-normal">(optional)</span></label>
              <input
                type="text"
                value={editStatusNote}
                onChange={event => setEditStatusNote(event.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-500 rounded px-3 py-2.5 text-zinc-200 focus:outline-none"
                placeholder="e.g. Research complete, ready to script"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-900">
              <button type="button" onClick={() => setSelectedVideo(null)} className="bg-zinc-900 border border-zinc-800 px-3 py-2 text-zinc-400 rounded uppercase font-bold text-[10px]">
                Cancel
              </button>
              <button type="button" onClick={handleSaveStatus} className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-4 py-2 rounded uppercase tracking-wider text-[10px]">
                Save Status
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

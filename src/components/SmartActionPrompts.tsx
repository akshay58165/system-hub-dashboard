import React from 'react';
import { VideoItem, MonthlyGoals, ActionPromptLog, RevenueLevelConfig, DashboardActionTarget } from '../types';
import { 
  Sparkles, Clock, Flame, ShieldAlert, ChevronRight, Zap, Target, Star
} from 'lucide-react';
import { getEarningOutlook, getLocalDateString, isVideoInCycle } from '../videoLogic';
import YouTubePaymentCycle from './YouTubePaymentCycle';

interface SmartActionPromptsProps {
  videos: VideoItem[];
  goals: MonthlyGoals;
  revenueLevels: RevenueLevelConfig[];
  todayDay: number;
  totalDays: number;
  onApplyUpgrade: (video: VideoItem, upgradeType: 'product' | 'members' | 'brand') => void;
  onNavigate: (target: DashboardActionTarget) => void;
}

export default function SmartActionPrompts({ 
  videos, 
  goals, 
  revenueLevels,
  todayDay, 
  totalDays,
  onApplyUpgrade,
  onNavigate
}: SmartActionPromptsProps) {
  
  // Dynamic action prompt generation engine following the requested priority order
  const generatePrompts = (): ActionPromptLog[] => {
    const list: ActionPromptLog[] = [];
    const elapsedRatio = todayDay / totalDays;
    
    // LANE VIDEO GROUPING
    const ldShorts = videos.filter(v => v.channel === 'LearnDriven' && v.contentLane === 'LearnDriven Shorts');
    const ldLong = videos.filter(v => v.channel === 'LearnDriven' && v.contentLane === 'LearnDriven Long Videos');
    const ldMembers = videos.filter(v => v.channel === 'LearnDriven' && v.contentLane === 'LearnDriven Members-only Videos');
    const dwShorts = videos.filter(v => v.channel === 'DecodeWorthy' && v.contentLane === 'DecodeWorthy Shorts');

    const todayStr = getLocalDateString();
    const getBuffer = (laneVids: VideoItem[]) => laneVids.filter(v => v.currentStage === 'Done' && v.actualScheduledDate && v.actualScheduledDate > todayStr).length;

    const ldShortsBuffer = getBuffer(ldShorts);
    const ldLongBuffer = getBuffer(ldLong);
    const ldMembersBuffer = getBuffer(ldMembers);
    const dwShortsBuffer = getBuffer(dwShorts);

    // 1. URGENT CONSISTENCY RISK
    if (dwShortsBuffer === 0 && goals.dwShortsTarget > 0) {
      list.push({
        id: 'p1_dw_consistency',
        date: todayStr,
        prompt: 'Edit one DecodeWorthy Short immediately.',
        reason: 'DecodeWorthy Shorts has zero scheduled buffer and tomorrow requires a live upload.',
        impact: 'Protects short-form consistency and keeps the algorithm fed.',
        timeMode: 'medium',
        alternative: 'Schedule one already drafted topic idea instead of filming a new one.',
        priority: 'Urgent',
        completed: false
      });
    }

    if (ldShortsBuffer === 0 && goals.ldShortsTarget > 0) {
      list.push({
        id: 'p1_ld_consistency',
        date: todayStr,
        prompt: 'Record & Schedule one LearnDriven Short.',
        reason: 'There are no LearnDriven Shorts scheduled ahead.',
        impact: 'Prepares tomorrow’s upload in advance.',
        timeMode: 'quick',
        alternative: 'Batch schedule brief 30-second coding snippets using existing script notes.',
        priority: 'Urgent',
        completed: false
      });
    }

    // 2. BLOCKED VIDEOS
    const blockedVid = videos.find(v => v.isBlocked);
    if (blockedVid) {
      list.push({
        id: 'p2_blocked',
        date: todayStr,
        prompt: `Review the status of "${blockedVid.title}".`,
        reason: `This video needs attention in ${blockedVid.currentStage}: ${blockedVid.statusNote || blockedVid.blockerReason || 'No status note recorded'}.`,
        impact: 'Gets production moving again and frees up queued work.',
        timeMode: 'medium',
        alternative: 'Delegate the roadblock resolution or switch to an alternate shoot setup today.',
        priority: 'High',
        completed: false
      });
    }

    // 3. VIDEOS CLOSE TO COMPLETION
    const editBacklog = videos.filter(v => v.currentStage === 'Edit');
    const thumbnailStuck = videos.find(v => v.contentLane === 'LearnDriven Long Videos' && v.currentStage === 'Thumbnail');
    
    if (thumbnailStuck) {
      list.push({
        id: 'p3_thumbnail',
        date: todayStr,
        prompt: `Design thumbnail for "${thumbnailStuck.title}".`,
        reason: 'The edit is finished, but the video still needs a thumbnail before it can be scheduled.',
        impact: 'Makes the finished video ready to publish.',
        timeMode: 'quick',
        alternative: 'Use a high-contrast template canvas with big text instead of designing from scratch.',
        priority: 'High',
        completed: false
      });
    }

    // 4. BUFFER SHORTAGE
    if (ldLongBuffer === 0 && goals.ldLongTarget > 0) {
      list.push({
        id: 'p4_long_buffer',
        date: todayStr,
        prompt: 'Finalize and schedule your next LearnDriven Long Video.',
        reason: 'No long-form video is scheduled ahead for next week.',
        impact: 'Protects posting consistency and expected ad revenue.',
        timeMode: 'deep',
        alternative: 'Split a long topic into two parts, publishing Part 1 first to secure immediate scheduling.',
        priority: 'Medium',
        completed: false
      });
    }

    // 5. REVENUE UPGRADES (Must respect enabled levels)
    if (goals.productTagsAllowed) {
      const taggableVid = videos.find(v => v.productTagStatus === 'Available' && v.currentStage !== 'Done');
      if (taggableVid) {
        list.push({
          id: 'p5_product_tag',
          date: todayStr,
          prompt: `Attach a high-relevance Product Tag to "${taggableVid.title}".`,
          reason: 'This video topic naturally aligns with educational books or tech desk accessories.',
          impact: 'Potential upgrade from Level 2 to Level 3, increasing monetization power.',
          timeMode: 'quick',
          alternative: 'Pin a member promotion comment if you lack specific affiliate listings today.',
          priority: 'Medium',
          completed: false
        });
      }
    }

    // 6. BATCH EFFICIENCY
    if (editBacklog.length >= 2) {
      list.push({
        id: 'p6_batch_edit',
        date: todayStr,
        prompt: 'Stop adding new topics. Run a focused Batch Edit session today.',
        reason: `There are ${editBacklog.length} videos currently stuck at the edit stage.`,
        impact: 'Reduces the editing backlog and gets multiple videos closer to scheduling.',
        timeMode: 'deep',
        alternative: 'Batch edit only the first 60% drafts to lock down the core narratives.',
        priority: 'Medium',
        completed: false
      });
    }

    // 7. NEW TOPIC GENERATION
    const totalPipelineCount = videos.filter(v => v.currentStage !== 'Done').length;
    if (totalPipelineCount < 3) {
      list.push({
        id: 'p7_topics',
        date: todayStr,
        prompt: 'Run a 20-minute Technical Brainstorm to seed more Topic ideas.',
        reason: 'You have fewer than three active video ideas, so upcoming production could run out of topics.',
        impact: 'Keeps enough ideas ready for future production sessions.',
        timeMode: 'quick',
        alternative: 'Review top audience comments for recurring struggles to formulate titles.',
        priority: 'Low',
        completed: false
      });
    }

    // 8. OPTIONAL GROWTH IDEAS (e.g. Members only or Brand collaborations if enabled)
    if (goals.brandCollabsTargeted && goals.enabledRevenueLevels.includes(20) && !videos.some(video => video.brandCollabStatus === 'Attached')) {
      list.push({
        id: 'p8_brand_outreach',
        date: todayStr,
        prompt: 'Initiate brand partner outreach for Level 20 targets.',
        reason: 'Brand sponsorships are enabled this month, but no active collaborations are finalized.',
        impact: 'Substantially elevates expected revenue potentials.',
        timeMode: 'medium',
        alternative: 'Draft a clean template media deck instead of active pitch emailing today.',
        priority: 'Low',
        completed: false
      });
    }

    return list;
  };

  const activePrompts = generatePrompts();

  const getPromptTarget = (prompt: ActionPromptLog): DashboardActionTarget => {
    const quotedTitle = prompt.prompt.match(/"([^"]+)"/)?.[1];
    const matchedVideo = quotedTitle ? videos.find(video => video.title === quotedTitle) : undefined;
    if (matchedVideo) return { type: 'video', videoId: matchedVideo.id };
    if (prompt.id === 'p7_topics') return { type: 'add-video', lane: 'LearnDriven Shorts' };
    if (prompt.id.includes('dw_')) {
      const video = videos.find(item => item.contentLane === 'DecodeWorthy Shorts' && item.currentStage !== 'Done');
      return video ? { type: 'video', videoId: video.id } : { type: 'add-video', lane: 'DecodeWorthy Shorts' };
    }
    if (prompt.id.includes('ld_')) {
      const video = videos.find(item => item.contentLane === 'LearnDriven Shorts' && item.currentStage !== 'Done');
      return video ? { type: 'video', videoId: video.id } : { type: 'add-video', lane: 'LearnDriven Shorts' };
    }
    const nearest = videos.find(video => video.currentStage !== 'Done');
    return nearest ? { type: 'video', videoId: nearest.id } : { type: 'pipeline' };
  };

  const sessionVideos = videos.filter(video => isVideoInCycle(video, goals.cycleStartDate, goals.cycleEndDate));
  const levelGroups = revenueLevels
    .map(config => ({ config, videos: sessionVideos.filter(video => video.revenueLevelTarget === config.level) }))
    .filter(group => group.videos.length > 0)
    .sort((a, b) => a.config.level - b.config.level);
  const earningOutlook = getEarningOutlook(sessionVideos);
  const outlookClass = {
    Low: 'text-zinc-300 border-zinc-700 bg-zinc-900/40',
    Moderate: 'text-amber-400 border-amber-900/50 bg-amber-950/15',
    High: 'text-emerald-400 border-emerald-900/50 bg-emerald-950/15',
    'Very high': 'text-cyan-300 border-cyan-800/60 bg-cyan-950/20',
  }[earningOutlook.label];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      
      {/* Column 1 & 2: Dynamic Creator Command Prompts */}
      <div className="lg:col-span-2 self-start h-[70vh] min-h-[520px] max-h-[760px] bg-zinc-950 border border-zinc-900 rounded-lg p-4 flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between border-b border-zinc-900 pb-2 mb-3">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              SMART ACTION SUGGESTIONS
            </h3>
          </div>
          <span className="font-mono text-[9px] text-zinc-500 uppercase">
            {activePrompts.length} SUGGESTIONS
          </span>
        </div>

        {/* Fixed-height list: mouse wheel and trackpad scroll only the suggestions */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-2">
          {activePrompts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500 font-mono text-[10px] space-y-1">
              <Star className="h-6 w-6 text-emerald-400 animate-bounce mb-1" />
              <span>EVERYTHING IS ON TRACK</span>
              <span>No corrective action is currently needed</span>
            </div>
          ) : (
            activePrompts.map((prompt) => (
              <div 
                key={prompt.id}
                onClick={() => onNavigate(getPromptTarget(prompt))}
                className="bg-zinc-900/40 border border-zinc-850 hover:border-emerald-800 p-3 rounded-lg flex flex-col md:flex-row justify-between gap-4 transition-all relative overflow-hidden cursor-pointer"
              >
                {/* Decorative side indicator based on Priority */}
                <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                  prompt.priority === 'Urgent' ? 'bg-rose-500' :
                  prompt.priority === 'High' ? 'bg-amber-500' :
                  prompt.priority === 'Medium' ? 'bg-emerald-400' : 'bg-zinc-700'
                }`} />

                <div className="space-y-2 pl-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-mono border px-1.5 py-0.2 rounded font-bold uppercase ${
                      prompt.priority === 'Urgent' ? 'bg-rose-950/20 text-rose-400 border-rose-900/50' :
                      prompt.priority === 'High' ? 'bg-amber-950/20 text-amber-400 border-amber-900/40' :
                      'bg-zinc-900 text-zinc-400 border-zinc-850'
                    }`}>
                      {prompt.priority}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono flex items-center gap-1 uppercase">
                      <Clock className="h-3 w-3" />
                      TIME: {prompt.timeMode}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-zinc-100 tracking-wide font-mono">
                      ACTION: {prompt.prompt}
                    </h4>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">
                      <span className="text-zinc-600 uppercase text-[9px] mr-1">REASON:</span>
                      {prompt.reason}
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-mono">
                      <span className="text-zinc-600 uppercase text-[9px] mr-1">WHY IT MATTERS:</span>
                      {prompt.impact}
                    </p>
                  </div>
                </div>

                {/* Alternative and Button */}
                <div className="md:w-56 shrink-0 bg-zinc-950/40 border border-zinc-900 rounded p-2.5 flex flex-col justify-between space-y-2 text-[10px] font-mono">
                  <div className="space-y-0.5">
                    <span className="text-zinc-600 text-[8px] uppercase block">LOW ENERGY PATH:</span>
                    <p className="text-zinc-400 leading-tight text-[9px]">
                      {prompt.alternative}
                    </p>
                  </div>
                  <button type="button" className="flex items-center justify-center gap-1 rounded border border-emerald-900/60 px-2 py-1.5 text-[8px] font-bold uppercase text-emerald-400 hover:bg-emerald-950/30">Open action <ChevronRight className="h-3 w-3" /></button>
                </div>

              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 space-y-3 flex flex-col relative overflow-hidden">
        <div className="flex justify-between items-start border-b border-zinc-900 pb-2">
          <div className="flex items-center gap-1.5"><Target className="h-4 w-4 text-cyan-400" /><span className="text-xs font-mono font-bold text-zinc-200 uppercase tracking-wider">Earning Outlook</span></div>
          <span className="text-[8px] text-zinc-600 font-mono text-right">{goals.cycleStartDate}<br />TO {goals.cycleEndDate}</span>
        </div>

        <div className={`border rounded p-3 ${outlookClass}`}>
          <span className="text-[8px] font-mono uppercase opacity-70 block">Level mix + monthly frequency</span>
          <span className="text-xl font-bold uppercase tracking-wider block mt-0.5">{earningOutlook.label}</span>
          <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">This is a directional outlook, not a revenue amount. Higher video levels help, but consistent monthly frequency also matters.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono">
          <div className="border border-zinc-900 rounded p-2"><span className="text-[8px] text-zinc-600 block">VIDEOS IN ZONE</span><span className="text-sm text-zinc-200 font-bold">{earningOutlook.frequency}</span><span className="text-[8px] text-zinc-500 block">{earningOutlook.frequencyBand} frequency</span></div>
          <div className="border border-zinc-900 rounded p-2 text-right"><span className="text-[8px] text-zinc-600 block">LEVEL QUALITY</span><span className="text-sm text-cyan-400 font-bold">{earningOutlook.levelMixBand}</span><span className="text-[8px] text-zinc-500 block">across planned videos</span></div>
        </div>

        {levelGroups.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {levelGroups.map(({ config, videos: levelVideos }) => <span key={config.level} className="text-[8px] font-mono border border-zinc-800 bg-zinc-900/40 text-zinc-400 rounded px-2 py-1">L{config.level} × {levelVideos.length}</span>)}
          </div>
        )}

        <YouTubePaymentCycle />
      </div>

    </div>
  );
}

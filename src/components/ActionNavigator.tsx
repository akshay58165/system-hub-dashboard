import React, { useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, ChevronLeft, ChevronRight, Sparkles, Square, Zap } from 'lucide-react';
import { DashboardActionTarget, MonthlyGoals, ProductOpportunity, VideoItem } from '../types';
import { getLocalDateString, isVideoInCycle } from '../videoLogic';

interface Props {
  videos: VideoItem[];
  productOpportunities: ProductOpportunity[];
  goals: MonthlyGoals;
  onNavigate: (target: DashboardActionTarget) => void;
}

interface ActionStep {
  id: string;
  category: 'critical' | 'production' | 'monetization' | 'runway';
  title: string;
  description: string;
  impact: string;
  buttonLabel: string;
  channelContext?: VideoItem['channel'];
  target: DashboardActionTarget;
}

export default function ActionNavigator({ videos, productOpportunities, goals, onNavigate }: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const steps = useMemo<ActionStep[]>(() => {
    const result: ActionStep[] = [];
    const today = getLocalDateString();
    const getBuffer = (lane: VideoItem['contentLane']) => videos.filter(v => v.contentLane === lane && v.currentStage === 'Done' && Boolean(v.actualScheduledDate && v.actualScheduledDate > today)).length;
    const claimedVideoIds = new Set<string>();
    const stageRank: Record<VideoItem['currentStage'], number> = { Topic: 0, Script: 1, Shoot: 2, Edit: 3, Thumbnail: 4, Schedule: 5, Done: 6 };
    const cycleStart = new Date(`${goals.cycleStartDate}T00:00:00`);
    const cycleEnd = new Date(`${goals.cycleEndDate}T00:00:00`);
    const currentDate = new Date(`${today}T00:00:00`);
    const dayMs = 86_400_000;
    const totalDays = Math.max(1, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / dayMs) + 1);
    const elapsedDays = Math.max(0, Math.min(totalDays, Math.floor((currentDate.getTime() - cycleStart.getTime()) / dayMs) + 1));
    const lanePlans: Array<{ lane: VideoItem['contentLane']; target: number; label: string }> = [
      { lane: 'LearnDriven Shorts', target: goals.ldShortsTarget, label: 'LEARNDRIVEN SHORTS' },
      { lane: 'DecodeWorthy Shorts', target: goals.dwShortsTarget, label: 'DECODEWORTHY SHORTS' },
      { lane: 'LearnDriven Long Videos', target: goals.ldLongTarget, label: 'LEARNDRIVEN LONG' },
      { lane: 'LearnDriven Members-only Videos', target: goals.ldMembersTarget, label: 'MEMBERS-ONLY' },
    ];

    lanePlans.forEach(plan => {
      if (plan.target <= 0) return;
      const laneVideos = videos.filter(video => video.contentLane === plan.lane && isVideoInCycle(video, goals.cycleStartDate, goals.cycleEndDate));
      const completed = laneVideos.filter(video => video.currentStage === 'Done').length;
      const buffer = getBuffer(plan.lane);
      const expectedByTomorrow = Math.ceil(plan.target * Math.min(totalDays, elapsedDays + 1) / totalDays);
      const behindBy = Math.max(0, expectedByTomorrow - completed);
      const remaining = Math.max(0, plan.target - completed);
      const postsPerDay = plan.target / totalDays;
      const cadence = postsPerDay >= 0.75 ? 'daily' : postsPerDay >= 0.4 ? 'alternate-day' : postsPerDay >= 0.13 ? 'twice-weekly' : 'weekly';
      if (behindBy === 0 && (remaining === 0 || buffer > 0)) return;
      const candidate = laneVideos.filter(video => video.currentStage !== 'Done').sort((a, b) => stageRank[b.currentStage] - stageRank[a.currentStage])[0];
      if (candidate) {
        claimedVideoIds.add(candidate.id);
        const action = candidate.isBlocked ? `Resolve the blocker on "${candidate.title}" at ${candidate.currentStage}.` : `Finish the ${candidate.currentStage} step for "${candidate.title}" today.`;
        result.push({
          id: `goal-${plan.lane}-${candidate.id}`,
          category: 'critical',
          title: candidate.isBlocked ? 'RESOLVE THE PRODUCTION BLOCKER' : candidate.currentStage === 'Schedule' ? 'SCHEDULE THE VIDEO' : candidate.currentStage === 'Thumbnail' ? 'FINISH THE THUMBNAIL' : candidate.currentStage === 'Edit' ? 'FINISH THE VIDEO EDIT' : candidate.currentStage === 'Shoot' ? 'RECORD THE VIDEO' : 'WRITE THE SCRIPT',
          description: `${plan.label} ${cadence} cadence is at risk. The zone needs ${remaining} more ${remaining === 1 ? 'video' : 'videos'}, and there is no safe scheduled buffer. ${action}`,
          impact: `Advancing this video is the fastest available move toward protecting the ${cadence} posting goal.`,
          buttonLabel: `OPEN ${candidate.currentStage} STAGE`,
          channelContext: candidate.channel,
          target: { type: 'video', videoId: candidate.id },
        });
      } else {
        result.push({
          id: `goal-add-${plan.lane}`,
          category: 'critical',
          title: `${plan.label} PIPELINE EMPTY`,
          description: `The ${cadence} goal still needs ${remaining} ${remaining === 1 ? 'video' : 'videos'}, but no active video can be completed. Add the next topic now.`,
          impact: 'Creating the topic restores a path to the next required posting slot before the cadence slips further.',
          buttonLabel: 'CREATE REQUIRED TOPIC',
          channelContext: plan.lane === 'DecodeWorthy Shorts' ? 'DecodeWorthy' : 'LearnDriven',
          target: { type: 'add-video', lane: plan.lane },
        });
      }
    });
    const addVideoStep = (video: VideoItem, stage: 'blocked' | 'schedule' | 'thumbnail' | 'edit' | 'script' | 'shoot') => {
      const content = {
        blocked: ['critical', 'REVIEW VIDEO STATUS', `Resolve what is blocking “${video.title}” at ${video.currentStage}.`, 'OPEN BLOCKED VIDEO'],
        schedule: [getBuffer(video.contentLane) === 0 ? 'critical' : 'production', 'SCHEDULE THE VIDEO', `Schedule “${video.title}” and then move it to Done.`, 'GO TO SCHEDULE STAGE'],
        thumbnail: ['production', 'FINISH THUMBNAIL', `Create and approve the thumbnail for “${video.title}”.`, 'OPEN THUMBNAIL STAGE'],
        edit: ['production', 'FINISH VIDEO EDIT', `Complete the timeline, cuts, and audio for “${video.title}”.`, 'OPEN EDIT STAGE'],
        script: ['production', 'WRITE THE SCRIPT', `Draft and review the script for “${video.title}”.`, 'OPEN TOPIC / SCRIPT'],
        shoot: ['production', 'RECORD THE VIDEO', `Record the required footage for “${video.title}”.`, 'OPEN SHOOT STAGE'],
      }[stage] as [ActionStep['category'], string, string, string];
      const outcome = {
        blocked: 'Removing the blocker returns usable work to the production queue.',
        schedule: 'Scheduling converts finished work into protection against a missed posting day.',
        thumbnail: 'A finished thumbnail makes the edited video ready for the scheduling queue.',
        edit: 'Finishing the edit turns recorded footage into a publishable asset.',
        script: 'A finished script reduces recording uncertainty and prevents production delay.',
        shoot: 'Recording today gives the editing queue real material to advance.',
      }[stage];
      result.push({ id: `${stage}-${video.id}`, category: content[0], title: content[1], description: content[2], buttonLabel: content[3], channelContext: video.channel, impact: outcome, target: { type: 'video', videoId: video.id } });
    };
    videos.filter(v => !claimedVideoIds.has(v.id) && v.isBlocked).forEach(v => addVideoStep(v, 'blocked'));
    videos.filter(v => !claimedVideoIds.has(v.id) && v.currentStage === 'Schedule').forEach(v => addVideoStep(v, 'schedule'));
    videos.filter(v => !claimedVideoIds.has(v.id) && v.currentStage === 'Thumbnail').forEach(v => addVideoStep(v, 'thumbnail'));
    videos.filter(v => !claimedVideoIds.has(v.id) && v.currentStage === 'Edit').forEach(v => addVideoStep(v, 'edit'));
    videos.filter(v => !claimedVideoIds.has(v.id) && (v.currentStage === 'Topic' || v.currentStage === 'Script')).forEach(v => addVideoStep(v, 'script'));
    videos.filter(v => !claimedVideoIds.has(v.id) && v.currentStage === 'Shoot').forEach(v => addVideoStep(v, 'shoot'));

    productOpportunities.filter(o => o.status === 'Pending').forEach(opportunity => {
      const video = videos.find(v => v.title === opportunity.topic && v.productTagStatus !== 'Tagged');
      if (video) result.push({ id: `product-${opportunity.id}`, category: 'monetization', title: 'ADD A RELEVANT PRODUCT TAG', description: `Review “${opportunity.suggestedTag}” for “${video.title}”.`, impact: 'It clears only after the matching video is genuinely tagged.', buttonLabel: 'OPEN VIDEO', channelContext: video.channel, target: { type: 'video', videoId: video.id } });
    });

    result.forEach(step => {
      if (step.impact.startsWith('It clears only')) {
        step.impact = 'A genuinely relevant tag can compound revenue potential without weakening viewer trust.';
      }
    });

    const rank = { critical: 0, production: 1, monetization: 2, runway: 3 };
    return result.sort((a, b) => rank[a.category] - rank[b.category]);
  }, [videos, productOpportunities, goals]);

  const moveRail = (direction: number) => railRef.current?.scrollBy({ left: direction * Math.max(320, railRef.current.clientWidth * 0.75), behavior: 'smooth' });
  useEffect(() => {
    if (steps.length <= 3) return;
    const timer = window.setInterval(() => {
      const rail = railRef.current;
      if (!rail) return;
      const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 12;
      rail.scrollTo({ left: atEnd ? 0 : rail.scrollLeft + 360, behavior: 'smooth' });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  const theme = (category: ActionStep['category']) => ({ critical: 'border-rose-900/70 bg-rose-950/10 text-rose-400', production: 'border-emerald-900/60 bg-emerald-950/10 text-emerald-400', monetization: 'border-cyan-900/60 bg-cyan-950/10 text-cyan-400', runway: 'border-amber-900/60 bg-amber-950/10 text-amber-400' }[category]);
  const led = (category: ActionStep['category']) => ({
    critical: { gradient: 'linear-gradient(90deg, #ff8080 0%, #ef4444 50%, #b91c1c 100%)', border: 'border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.5)]', glow: '0 0 14px 4px rgba(239,68,68,0.95), 0 0 28px 8px rgba(239,68,68,0.5), inset 0 0 6px #ffc7c7', label: 'GOAL AT RISK', duration: 0.6 },
    production: { gradient: 'linear-gradient(90deg, #a7f3d0 0%, #10b981 50%, #047857 100%)', border: 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.4)]', glow: '0 0 12px 3px rgba(16,185,129,0.9), 0 0 24px 6px rgba(16,185,129,0.45), inset 0 0 5px #d1fae5', label: 'PRODUCTION MOVE', duration: 1.6 },
    monetization: { gradient: 'linear-gradient(90deg, #67e8f9 0%, #06b6d4 50%, #0e7490 100%)', border: 'border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.4)]', glow: '0 0 12px 3px rgba(6,182,212,0.9), 0 0 24px 6px rgba(6,182,212,0.45), inset 0 0 5px #cffafe', label: 'REVENUE OPPORTUNITY', duration: 1.1 },
    runway: { gradient: 'linear-gradient(90deg, #fde68a 0%, #f59e0b 50%, #b45309 100%)', border: 'border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.4)]', glow: '0 0 12px 3px rgba(245,158,11,0.9), 0 0 24px 6px rgba(245,158,11,0.45), inset 0 0 5px #fef3c7', label: 'PIPELINE CAPACITY', duration: 1.3 },
  }[category]);
  return <section className="space-y-3 font-mono" aria-label="Verified next actions">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2"><div className="flex items-center gap-2"><Zap className="h-4 w-4 text-emerald-400" /><h2 className="text-xs font-bold uppercase tracking-widest text-zinc-200">Verified next actions</h2><span className="text-[9px] text-zinc-600">{steps.length}</span></div>{steps.length > 1 && <div className="flex gap-1"><button onClick={() => moveRail(-1)} className="p-1.5 border border-zinc-800 rounded text-zinc-500 hover:text-white"><ChevronLeft className="h-3.5 w-3.5" /></button><button onClick={() => moveRail(1)} className="p-1.5 border border-zinc-800 rounded text-zinc-500 hover:text-white"><ChevronRight className="h-3.5 w-3.5" /></button></div>}</div>
    {steps.length ? <div ref={railRef} className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 scroll-smooth">{steps.map((step, index) => <motion.button key={step.id} onClick={() => onNavigate(step.target)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`min-w-[290px] md:min-w-[350px] max-w-[420px] snap-start text-left border rounded-lg p-4 space-y-3 hover:-translate-y-0.5 transition-all ${theme(step.category)}`}>
      {(() => { const details = led(step.category); return <div className="flex items-center gap-3 px-0.5 py-1">
        <div className={`relative h-2.5 w-14 rounded border bg-black/90 flex items-center p-[1.5px] ${details.border} shrink-0`}>
          <motion.div animate={{ opacity: [0.3, 1, 0.3], scaleY: [0.92, 1.08, 0.92] }} transition={{ repeat: Infinity, duration: details.duration, ease: 'easeInOut' }} className="h-full w-full rounded-sm" style={{ background: details.gradient, boxShadow: details.glow }} />
          <div className="absolute inset-x-0.5 top-[1px] h-[1px] bg-gradient-to-r from-white/60 via-white/20 to-transparent rounded pointer-events-none z-10" />
          <div className="absolute inset-0 rounded-[2px] border border-white/5 pointer-events-none z-10" />
        </div>
        <span className="text-[8px] font-bold tracking-widest uppercase">{details.label}</span>
      </div>; })()}
      <div className="flex items-center justify-between gap-2"><span className="text-[8px] uppercase font-bold">Action {String(index + 1).padStart(2, '0')} · {step.category}</span>{step.channelContext && <span className="text-[8px] text-zinc-500 uppercase">{step.channelContext}</span>}</div>
      <div className="flex items-start gap-2"><Square className="h-4 w-4 mt-0.5 shrink-0" /><div><h3 className="text-xs font-bold text-zinc-100 uppercase">{step.title}</h3><p className="text-[9px] text-zinc-500 mt-1 uppercase"><strong>Topic:</strong> {step.target.type === 'video' ? videos.find(video => video.id === step.target.videoId)?.title : step.target.type === 'add-video' ? step.target.lane : step.channelContext}</p><p className="text-[10px] text-zinc-400 mt-2 leading-relaxed">{step.description}</p></div></div>
      <div className="flex items-start gap-2 border-l-2 border-current bg-black/20 px-3 py-2"><Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span className="text-[9px] leading-relaxed"><strong className="uppercase">Expected result:</strong> {step.impact}</span></div>
      <div className="border-t border-zinc-900/70 pt-3"><span className="flex items-center justify-center gap-1 rounded border border-current px-3 py-2 text-[9px] font-bold uppercase">{step.buttonLabel}<ChevronRight className="h-3 w-3" /></span></div>
    </motion.button>)}</div> : <div className="border border-zinc-900 rounded-lg p-7 text-center text-zinc-500 text-[10px]"><AlertTriangle className="h-5 w-5 mx-auto mb-2 text-emerald-400" />No verified action is currently required.</div>}
  </section>;
}

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Clock3, Lightbulb, Tag, TrendingUp } from 'lucide-react';
import { VideoItem, ProductOpportunity, MonthlyGoals } from '../types';
import { getDaysSince, getLocalDateString, getVideoStatus, statusNeedsAttention } from '../videoLogic';

interface PriorityUpdatesProps {
  videos: VideoItem[];
  productOpportunities: ProductOpportunity[];
  goals: MonthlyGoals;
}

interface PriorityUpdate {
  label: string;
  message: string;
  action: string;
  tone: 'urgent' | 'attention' | 'info' | 'good';
  icon: React.ReactNode;
}

export default function PriorityUpdates({ videos, productOpportunities, goals }: PriorityUpdatesProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const updates = useMemo<PriorityUpdate[]>(() => {
    const items: PriorityUpdate[] = [];
    const today = getLocalDateString();
    const getBuffer = (lane: VideoItem['contentLane']) => videos.filter(video =>
      video.contentLane === lane && video.currentStage === 'Done' && Boolean(video.actualScheduledDate && video.actualScheduledDate > today)
    ).length;

    const statusVideo = videos.find(video => statusNeedsAttention(getVideoStatus(video)));
    if (statusVideo) {
      items.push({
        label: `${getVideoStatus(statusVideo).toUpperCase()} STATUS`,
        message: `“${statusVideo.title}” needs review at the ${statusVideo.currentStage} stage.`,
        action: statusVideo.statusNote || statusVideo.blockerReason || 'Open Video Status and record what needs attention.',
        tone: getVideoStatus(statusVideo) === 'critical' ? 'urgent' : 'attention',
        icon: <AlertCircle className="h-4 w-4" />,
      });
    }

    const staleTopic = videos.filter(video => video.currentStage === 'Topic' && getDaysSince(video.createdAt) >= 3).sort((a, b) => getDaysSince(b.createdAt) - getDaysSince(a.createdAt))[0];
    if (staleTopic) {
      const age = getDaysSince(staleTopic.createdAt);
      items.push({
        label: 'TOPIC WAITING',
        message: `“${staleTopic.title}” was added ${age} day${age === 1 ? '' : 's'} ago and is still at Topic.`,
        action: 'Start its script today, add a status note, or remove it if the idea is no longer useful.',
        tone: age >= 8 ? 'attention' : 'info',
        icon: <Clock3 className="h-4 w-4" />,
      });
    }

    if (goals.dwShortsTarget > 0 && getBuffer('DecodeWorthy Shorts') === 0) items.push({ label: 'NO DECODEWORTHY BUFFER', message: 'No DecodeWorthy Short is scheduled ahead.', action: 'Finish and schedule the nearest-to-complete Short before starting another topic.', tone: 'attention', icon: <Clock3 className="h-4 w-4" /> });
    if (goals.ldShortsTarget > 0 && getBuffer('LearnDriven Shorts') === 0) items.push({ label: 'NO LEARNDRIVEN BUFFER', message: 'No LearnDriven Short is scheduled ahead.', action: 'Finish one existing Short to create a one-day publishing buffer.', tone: 'attention', icon: <Clock3 className="h-4 w-4" /> });

    const opportunity = productOpportunities.find(item => item.status === 'Pending');
    if (opportunity) items.push({ label: 'REVENUE OPPORTUNITY', message: `“${opportunity.topic}” may support the product tag “${opportunity.suggestedTag}”.`, action: 'Use it only if the product is genuinely useful and relevant to the topic.', tone: 'info', icon: <Tag className="h-4 w-4" /> });

    const totalPlanned = goals.ldShortsTarget + goals.ldLongTarget + goals.ldMembersTarget + goals.dwShortsTarget;
    const completed = videos.filter(video => video.currentStage === 'Done').length;
    if (totalPlanned > 0) items.push({ label: 'MONTHLY PROGRESS', message: `${completed} of ${totalPlanned} planned videos are complete.`, action: completed >= totalPlanned ? 'The goal is complete. Protect your buffer and recovery time.' : `${Math.max(0, totalPlanned - completed)} videos remain in this mission zone.`, tone: completed >= totalPlanned ? 'good' : 'info', icon: <TrendingUp className="h-4 w-4" /> });

    return items.length ? items.slice(0, 6) : [{ label: 'ALL CLEAR', message: 'No urgent workflow issue needs your attention.', action: 'Continue with the next planned production step.', tone: 'good', icon: <Lightbulb className="h-4 w-4" /> }];
  }, [videos, productOpportunities, goals]);

  useEffect(() => {
    setActiveIndex(index => Math.min(index, updates.length - 1));
    if (updates.length <= 1) return;
    const timer = window.setInterval(() => setActiveIndex(index => (index + 1) % updates.length), 9000);
    return () => window.clearInterval(timer);
  }, [updates.length]);

  const update = updates[activeIndex] || updates[0];
  const toneClasses = { urgent: 'border-rose-900/70 bg-rose-950/20 text-rose-400', attention: 'border-amber-900/60 bg-amber-950/15 text-amber-400', info: 'border-cyan-900/50 bg-cyan-950/10 text-cyan-400', good: 'border-emerald-900/50 bg-emerald-950/10 text-emerald-400' };
  const move = (direction: number) => setActiveIndex(index => (index + direction + updates.length) % updates.length);

  return (
    <div className="bg-zinc-950 border-y border-zinc-900/80 px-4 py-2.5 font-mono relative">
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
        <div className={`flex items-center gap-2 border px-2.5 py-1.5 rounded shrink-0 ${toneClasses[update.tone]}`}>
          {update.icon}<span className="text-[9px] font-bold tracking-wider uppercase">{update.label}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] text-zinc-200 font-bold leading-relaxed">{update.message}</div>
          <div className="text-[9px] text-zinc-500 leading-relaxed mt-0.5"><span className="text-zinc-400 font-bold">NEXT:</span> {update.action}</div>
        </div>
        <div className="flex items-center justify-between md:justify-end gap-2 shrink-0">
          <span className="text-[9px] text-zinc-600">{activeIndex + 1} / {updates.length}</span>
          <button type="button" onClick={() => move(-1)} className="p-1.5 border border-zinc-800 rounded text-zinc-500 hover:text-white" title="Previous update"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => move(1)} className="p-1.5 border border-zinc-800 rounded text-zinc-500 hover:text-white" title="Next update"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

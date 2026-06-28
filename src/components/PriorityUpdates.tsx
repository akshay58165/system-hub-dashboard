import React, { useEffect, useMemo, useRef } from 'react';
import { AlertCircle, Clock3, Lightbulb, Tag, TrendingUp } from 'lucide-react';
import { VideoItem, ProductOpportunity, MonthlyGoals, DashboardActionTarget, CalibrationNode } from '../types';
import { getDaysSince, getLocalDateString, getVideoStatus, isVideoInCycle, statusNeedsAttention } from '../videoLogic';

interface PriorityUpdatesProps {
  videos: VideoItem[];
  productOpportunities: ProductOpportunity[];
  goals: MonthlyGoals;
  nodes: CalibrationNode[];
  onNavigate: (target: DashboardActionTarget) => void;
}

interface PriorityUpdate {
  label: string;
  message: string;
  action: string;
  tone: 'white' | 'green' | 'yellow' | 'orange' | 'crimson';
  icon: React.ReactNode;
  target?: DashboardActionTarget;
}

export default function PriorityUpdates({ videos, productOpportunities, goals, nodes, onNavigate }: PriorityUpdatesProps) {
  const railRef = useRef<HTMLDivElement>(null);

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
        tone: getVideoStatus(statusVideo) === 'critical' ? 'crimson' : getVideoStatus(statusVideo) === 'warning' ? 'orange' : 'yellow',
        icon: <AlertCircle className="h-4 w-4" />,
        target: { type: 'video', videoId: statusVideo.id },
      });
    }

    const staleTopic = videos.filter(video => video.currentStage === 'Topic' && getDaysSince(video.createdAt) >= 3).sort((a, b) => getDaysSince(b.createdAt) - getDaysSince(a.createdAt))[0];
    if (staleTopic) {
      const age = getDaysSince(staleTopic.createdAt);
      items.push({
        label: 'TOPIC WAITING',
        message: `“${staleTopic.title}” was added ${age} day${age === 1 ? '' : 's'} ago and is still at Topic.`,
        action: 'Start its script today, add a status note, or remove it if the idea is no longer useful.',
        tone: age >= 8 ? 'orange' : 'yellow',
        icon: <Clock3 className="h-4 w-4" />,
        target: { type: 'video', videoId: staleTopic.id },
      });
    }

    if (goals.dwShortsTarget > 0 && getBuffer('DecodeWorthy Shorts') === 0) items.push({ label: 'NO DECODEWORTHY BUFFER', message: 'No DecodeWorthy Short is scheduled ahead.', action: 'Finish and schedule the nearest-to-complete Short before starting another topic.', tone: 'orange', icon: <Clock3 className="h-4 w-4" /> });
    if (goals.ldShortsTarget > 0 && getBuffer('LearnDriven Shorts') === 0) items.push({ label: 'NO LEARNDRIVEN BUFFER', message: 'No LearnDriven Short is scheduled ahead.', action: 'Finish one existing Short to create a one-day publishing buffer.', tone: 'orange', icon: <Clock3 className="h-4 w-4" /> });

    const zoneVideos = videos.filter(video => isVideoInCycle(video, goals.cycleStartDate, goals.cycleEndDate));
    const stageRank: Record<VideoItem['currentStage'], number> = { Topic: 0, Script: 1, Shoot: 2, Edit: 3, Thumbnail: 4, Schedule: 5, Done: 6 };
    const cycleStart = new Date(`${goals.cycleStartDate}T00:00:00`);
    const cycleEnd = new Date(`${goals.cycleEndDate}T00:00:00`);
    const current = new Date(`${today}T00:00:00`);
    const totalDays = Math.max(1, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / 86_400_000) + 1);
    const elapsedDays = Math.max(0, Math.min(totalDays, Math.floor((current.getTime() - cycleStart.getTime()) / 86_400_000) + 1));
    const lanePlans: Array<{ lane: VideoItem['contentLane']; target: number; label: string; channel: VideoItem['channel'] }> = [
      { lane: 'LearnDriven Shorts', target: goals.ldShortsTarget, label: 'LEARNDRIVEN SHORTS', channel: 'LearnDriven' },
      { lane: 'LearnDriven Long Videos', target: goals.ldLongTarget, label: 'LEARNDRIVEN LONG', channel: 'LearnDriven' },
      { lane: 'LearnDriven Members-only Videos', target: goals.ldMembersTarget, label: 'MEMBERS-ONLY', channel: 'LearnDriven' },
      { lane: 'DecodeWorthy Shorts', target: goals.dwShortsTarget, label: 'DECODEWORTHY SHORTS', channel: 'DecodeWorthy' },
    ];

    lanePlans.forEach(plan => {
      if (plan.target <= 0) return;
      const laneVideos = zoneVideos.filter(video => video.contentLane === plan.lane);
      const completed = laneVideos.filter(video => video.currentStage === 'Done').length;
      const active = laneVideos.filter(video => video.currentStage !== 'Done');
      const remaining = Math.max(0, plan.target - completed);
      const expectedNow = Math.floor(plan.target * elapsedDays / totalDays);
      const nearest = [...active].sort((a, b) => stageRank[b.currentStage] - stageRank[a.currentStage])[0];
      const target: DashboardActionTarget = nearest ? { type: 'video', videoId: nearest.id } : remaining > 0 ? { type: 'add-video', lane: plan.lane } : { type: 'pipeline' };
      const tone: PriorityUpdate['tone'] = remaining === 0 ? 'green' : completed < expectedNow ? 'orange' : active.length === 0 ? 'crimson' : 'white';
      items.push({
        label: `${plan.label} GOAL`,
        message: `${completed}/${plan.target} complete · ${active.length} active · ${remaining} remaining.`,
        action: remaining === 0 ? 'Goal met; protect the scheduled buffer.' : nearest ? `Nearest progress: “${nearest.title}” at ${nearest.currentStage}.` : 'No active video exists; add the next topic.',
        tone,
        icon: <TrendingUp className="h-4 w-4" />,
        target,
      });
    });

    (['LearnDriven', 'DecodeWorthy'] as const).forEach(channel => {
      const channelVideos = zoneVideos.filter(video => video.channel === channel);
      if (channelVideos.length === 0) return;
      const shot = channelVideos.filter(video => video.pipeline.shoot === 'Done').length;
      const edited = channelVideos.filter(video => video.pipeline.edit === 'Done').length;
      const scheduled = channelVideos.filter(video => video.pipeline.schedule === 'Done').length;
      items.push({
        label: `${channel.toUpperCase()} FLOW`,
        message: `${shot} shot · ${edited} edited · ${scheduled} scheduled.`,
        action: scheduled < edited ? `${edited - scheduled} edited ${edited - scheduled === 1 ? 'video is' : 'videos are'} waiting to be scheduled.` : edited < shot ? `${shot - edited} shot ${shot - edited === 1 ? 'video is' : 'videos are'} waiting for editing.` : 'Production stages are currently balanced.',
        tone: scheduled === 0 && channelVideos.length > 0 ? 'yellow' : 'green',
        icon: <Clock3 className="h-4 w-4" />,
        target: { type: 'pipeline' },
      });
    });

    const editBacklog = zoneVideos.filter(video => video.currentStage === 'Edit');
    if (editBacklog.length > 0) items.push({ label: 'EDITING LOAD', message: `${editBacklog.length} ${editBacklog.length === 1 ? 'video is' : 'videos are'} currently in Edit.`, action: editBacklog.length >= 2 ? 'A focused edit block will release the largest production bottleneck.' : `Finish “${editBacklog[0].title}” to move it toward scheduling.`, tone: editBacklog.length >= 3 ? 'orange' : 'yellow', icon: <Clock3 className="h-4 w-4" />, target: { type: 'video', videoId: editBacklog[0].id } });

    nodes.filter(node => node.value <= 5).sort((a, b) => a.value - b.value).slice(0, 3).forEach(node => items.push({
      label: `${node.label} SIGNAL`,
      message: `${node.label} is currently ${node.value}/10.`,
      action: node.id === 'energy' ? 'Use a short, concrete work block.' : node.id === 'hydration' ? 'Hydrate before the next production block.' : node.id === 'sleep' ? 'Protect recovery and avoid extending the workday.' : 'Review the wellbeing panel before choosing the next demanding task.',
      tone: node.value <= 3 ? 'crimson' : 'yellow',
      icon: <AlertCircle className="h-4 w-4" />,
      target: { type: 'health' },
    }));

    const opportunity = productOpportunities.find(item => item.status === 'Pending');
    if (opportunity) items.push({ label: 'REVENUE OPPORTUNITY', message: `“${opportunity.topic}” may support the product tag “${opportunity.suggestedTag}”.`, action: 'Use it only if the product is genuinely useful and relevant to the topic.', tone: 'white', icon: <Tag className="h-4 w-4" /> });

    const totalPlanned = goals.ldShortsTarget + goals.ldLongTarget + goals.ldMembersTarget + goals.dwShortsTarget;
    const completed = videos.filter(video => video.currentStage === 'Done').length;
    if (totalPlanned > 0) items.push({ label: 'MONTHLY PROGRESS', message: `${completed} of ${totalPlanned} planned videos are complete.`, action: completed >= totalPlanned ? 'The goal is complete. Protect your buffer and recovery time.' : `${Math.max(0, totalPlanned - completed)} videos remain in this mission zone.`, tone: completed >= totalPlanned ? 'green' : 'white', icon: <TrendingUp className="h-4 w-4" /> });

    return items.length ? items : [{ label: 'ALL CLEAR', message: 'No urgent workflow issue needs your attention.', action: 'Continue with the next planned production step.', tone: 'green', icon: <Lightbulb className="h-4 w-4" /> }];
  }, [videos, productOpportunities, goals, nodes]);

  const marqueeUpdates = useMemo(
    () => Array.from({ length: Math.max(1, Math.ceil(8 / updates.length)) }, () => updates).flat(),
    [updates],
  );

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollLeft = 0;
    let frame = 0;
    let previous = performance.now();
    const tick = (time: number) => {
      const elapsed = Math.min(50, time - previous);
      previous = time;
      rail.scrollLeft += elapsed * 0.085;
      const loopWidth = rail.scrollWidth / 2;
      if (loopWidth > 0 && rail.scrollLeft >= loopWidth) rail.scrollLeft -= loopWidth;
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [marqueeUpdates]);

  const toneClasses = {
    white: 'text-zinc-100',
    green: 'text-emerald-400',
    yellow: 'text-yellow-300',
    orange: 'text-orange-400',
    crimson: 'text-rose-500',
  };

  return (
    <div className="border-y border-zinc-800 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black px-4 py-1 font-mono relative overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-1px_0_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0 border-r border-zinc-700 pr-3 text-zinc-200">
          <TrendingUp className="h-4 w-4" /><span className="text-[9px] font-black tracking-[0.18em] uppercase">LIVE STATUS</span>
        </div>
        <div ref={railRef} className="relative min-w-0 flex-1 overflow-hidden">
          <div className="flex w-max">
            {[0, 1].map(copy => <div key={copy} className="flex min-w-max items-center" aria-hidden={copy === 1}>
              {marqueeUpdates.map((update, index) => <React.Fragment key={`${copy}-${update.label}-${index}`}>
                <button type="button" onClick={() => onNavigate(update.target || { type: 'pipeline' })} className={`shrink-0 flex items-center gap-2 whitespace-nowrap px-3 text-left cursor-pointer hover:brightness-125 ${toneClasses[update.tone]}`}>
                  <span className="shrink-0">{update.icon}</span>
                  <span className="text-[9px] font-black tracking-wider">{update.label}</span>
                  <span className="text-[10px] font-bold">{update.message}</span>
                  <span className="text-[9px] opacity-75"><strong>NEXT:</strong> {update.action}</span>
                </button>
                <span className="px-2 text-zinc-600" aria-hidden="true">•</span>
              </React.Fragment>)}
            </div>)}
          </div>
        </div>
        <span className="shrink-0 text-[8px] text-zinc-600">{updates.length} LIVE</span>
      </div>
    </div>
  );
}

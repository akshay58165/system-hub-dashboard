import React from 'react';
import { VideoItem, MonthlyGoals } from '../types';
import { 
  Tv, Eye, Play, Sparkles, AlertTriangle, CheckCircle2, Shield, Activity
} from 'lucide-react';
import { motion } from 'motion/react';
import { getLocalDateString } from '../videoLogic';

function MarqueeText({ text }: { text: string }) {
  return (
    <div className="w-full overflow-hidden whitespace-nowrap relative flex items-center h-4">
      <motion.div
        animate={{ x: [0, "-50%"] }}
        className="inline-flex gap-8 pr-8 text-[10px] text-zinc-300 font-normal whitespace-nowrap"
        transition={{
          ease: "linear",
          duration: 12,
          repeat: Infinity,
        }}
      >
        <span>{text}</span>
        <span>{text}</span>
      </motion.div>
    </div>
  );
}

interface ChannelLanesProps {
  videos: VideoItem[];
  goals: MonthlyGoals;
  todayDay: number;
  totalDays: number;
}

export default function ChannelLanes({ videos, goals, todayDay, totalDays }: ChannelLanesProps) {
  const elapsedRatio = todayDay / totalDays;

  const lanes = [
    {
      id: 'ld_shorts',
      name: 'LearnDriven Shorts',
      target: goals.ldShortsTarget,
      filter: (v: VideoItem) => v.channel === 'LearnDriven' && v.contentLane === 'LearnDriven Shorts',
      color: 'border-emerald-500/20 text-emerald-400',
      badgeBg: 'bg-emerald-950/20 text-emerald-400 border-emerald-900/50',
      tagline: 'Technical micro-learning bites'
    },
    {
      id: 'ld_long',
      name: 'LearnDriven Long Videos',
      target: goals.ldLongTarget,
      filter: (v: VideoItem) => v.channel === 'LearnDriven' && v.contentLane === 'LearnDriven Long Videos',
      color: 'border-amber-500/20 text-amber-400',
      badgeBg: 'bg-amber-950/20 text-amber-400 border-amber-900/50',
      tagline: 'Deep dive tutorials (&gt;8m target)'
    },
    {
      id: 'ld_members',
      name: 'LearnDriven Members-only',
      target: goals.ldMembersTarget,
      filter: (v: VideoItem) => v.channel === 'LearnDriven' && v.contentLane === 'LearnDriven Members-only Videos',
      color: 'border-purple-500/20 text-purple-400',
      badgeBg: 'bg-purple-950/20 text-purple-400 border-purple-900/50',
      tagline: 'Premium member deep insights'
    },
    {
      id: 'dw_shorts',
      name: 'DecodeWorthy Shorts',
      target: goals.dwShortsTarget,
      filter: (v: VideoItem) => v.channel === 'DecodeWorthy' && v.contentLane === 'DecodeWorthy Shorts',
      color: 'border-cyan-500/20 text-cyan-400',
      badgeBg: 'bg-cyan-950/20 text-cyan-400 border-cyan-900/50',
      tagline: 'Fast tech news & explainers'
    }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            CONTENT GOALS BY FORMAT
          </h2>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">FOUR CONTENT TYPES TRACKED</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {lanes.map((lane) => {
          const laneVideos = videos.filter(lane.filter);
          const completed = laneVideos.filter(v => v.currentStage === 'Done').length;
          const remaining = Math.max(0, lane.target - completed);
          const inPipeline = laneVideos.filter(v => v.currentStage !== 'Done').length;
          
          // Future scheduled buffer count
          const todayStr = getLocalDateString();
          const bufferCount = laneVideos.filter(v => 
            v.currentStage === 'Done' && 
            v.actualScheduledDate && 
            v.actualScheduledDate > todayStr
          ).length;

          // Compute Bottleneck
          const stagesCount: Record<string, number> = {};
          laneVideos.forEach(v => {
            if (v.currentStage !== 'Done' && v.currentStage !== 'Topic') {
              stagesCount[v.currentStage] = (stagesCount[v.currentStage] || 0) + 1;
            }
          });
          let bottleneck = 'None (Clear)';
          let maxStuck = 0;
          Object.entries(stagesCount).forEach(([stage, count]) => {
            if (count > maxStuck) {
              maxStuck = count;
              bottleneck = stage;
            }
          });

          // Compute next required action
          let nextAction = 'Brainstorm topics';
          const earliestStuck = laneVideos.find(v => v.currentStage !== 'Done');
          if (earliestStuck) {
            nextAction = `${earliestStuck.currentStage} on "${earliestStuck.title}"`;
          }

          // Consistency Risk computation
          const expectedCompleted = lane.target * elapsedRatio;
          let riskColor = 'text-emerald-400';
          let riskLabel = 'LOW RISK';
          let riskBg = 'bg-emerald-950/20 border-emerald-900/50';

          if (completed < expectedCompleted - 2) {
            riskColor = 'text-rose-400';
            riskLabel = 'HIGH RISK';
            riskBg = 'bg-rose-950/20 border-rose-900/50';
          } else if (completed < expectedCompleted) {
            riskColor = 'text-amber-400';
            riskLabel = 'MODERATE';
            riskBg = 'bg-amber-950/20 border-amber-900/40';
          }

          // Revenue Opportunity
          let revenueOpp = 'Steady stream';
          const tagOpp = laneVideos.find(v => v.productTagStatus === 'Available' && goals.productTagsAllowed);
          const commentOpp = laneVideos.find(v => v.pinnedCommentStatus === 'None' && goals.pinnedCommentsAllowed && v.channel === 'LearnDriven' && v.contentLane === 'LearnDriven Shorts');
          
          if (tagOpp) {
            revenueOpp = `Tag products on "${tagOpp.title}"`;
          } else if (commentOpp) {
            revenueOpp = `Add promotional pin on "${commentOpp.title}"`;
          }

          const completionRate = lane.target > 0 ? Math.round((completed / lane.target) * 100) : 100;

          return (
            <div 
              key={lane.id} 
              className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 flex flex-col justify-between hover:border-zinc-800 transition-all group hover:shadow-[0_0_15px_rgba(255,255,255,0.01)] relative overflow-hidden"
            >
              {/* Subtle top indicator */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

              <div className="space-y-3">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-100 tracking-wide font-display group-hover:text-emerald-400 transition-colors uppercase">
                      {lane.name}
                    </h3>
                    <span className="text-[10px] text-zinc-500 font-mono font-normal">
                      {lane.tagline}
                    </span>
                  </div>
                  <span className={`text-[9px] font-mono border px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${lane.badgeBg}`}>
                    {completionRate}%
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="relative h-1 bg-zinc-900 rounded-full overflow-hidden">
                    <div 
                      className="absolute top-0 bottom-0 left-0 bg-emerald-500 transition-all duration-500"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-zinc-600 mt-1">
                    <span>GOAL: {lane.target}</span>
                    <span>DONE: {completed} / LEFT: {remaining}</span>
                  </div>
                </div>

                {/* Core metrics grid */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-900/60 font-mono text-[10px]">
                  <div>
                    <span className="text-zinc-500 uppercase block text-[8px]">In Production</span>
                    <span className="text-zinc-300 font-bold">{inPipeline} Videos</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase block text-[8px]">Scheduled Ahead</span>
                    <span className="text-sky-400 font-bold">{bufferCount} Videos</span>
                  </div>
                </div>

                {/* Status elements */}
                <div className="space-y-1.5 pt-2 border-t border-zinc-900/60 font-mono text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">BUSIEST STAGE:</span>
                    <span className={`font-bold ${bottleneck !== 'None (Clear)' ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {bottleneck.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-zinc-500">NEXT REQUIRED TASK:</span>
                    <span className="text-zinc-300 font-normal truncate" title={nextAction}>
                      {nextAction}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom stats: Consistency risk & Revenue Opportunity */}
              <div className="mt-4 pt-3 border-t border-zinc-900/80 space-y-2">
                <div className={`flex items-center justify-between p-1.5 rounded border ${riskBg}`}>
                  <span className="text-[9px] text-zinc-500 font-mono tracking-wider">CONSISTENCY:</span>
                  <span className={`text-[9px] font-mono font-bold ${riskColor}`}>
                    {riskLabel}
                  </span>
                </div>

                <div className="bg-zinc-900/20 border border-zinc-900/60 rounded p-1.5 flex items-center justify-between overflow-hidden">
                  <div className="flex-1 overflow-hidden min-w-0 pr-2">
                    <span className="text-[8px] text-zinc-500 block uppercase font-mono">REVENUE OPPORTUNITY</span>
                    <MarqueeText text={revenueOpp} />
                  </div>
                  <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}

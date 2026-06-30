import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ArrowRight,
  TrendingUp,
  Flame,
  Calendar
} from 'lucide-react';
import { CreatorInsight, VideoRecord } from '../types';

interface InsightsViewProps {
  insights: CreatorInsight[];
  videos: VideoRecord[];
  onTabChange: (tab: any) => void;
}

export default function InsightsView({ insights, videos, onTabChange }: InsightsViewProps) {
  
  // Calculate dynamic insights based on live data
  const mergedInsights = useMemo(() => {
    const list = [...insights];

    // Check consistency risk
    const learnDrivenScheduled = videos.filter(v => v.channelName === 'LearnDriven' && v.pipelineStage === 'Schedule');
    if (learnDrivenScheduled.length === 0) {
      list.push({
        id: 'dyn-ins-ld-consistency',
        title: 'Critical Consistency Alert',
        description: 'LearnDriven has no upcoming uploads scheduled. Algorithmic velocity will decay if consistency chain breaks.',
        type: 'warning',
        channel: 'LearnDriven',
        reason: 'Zero videos currently in "Schedule" phase. Action is required in Edit and Script lanes immediately.',
        actionLabel: 'Go to Pipeline'
      });
    }

    // Check for blocked videos
    const blockedVideos = videos.filter(v => v.blockedReason);
    blockedVideos.forEach(v => {
      list.push({
        id: `dyn-ins-blocked-${v.id}`,
        title: `Blocked Production Lane: "${v.title}"`,
        description: `This video is stuck in the ${v.pipelineStage} phase because: "${v.blockedReason}"`,
        type: 'warning',
        channel: v.channelName,
        reason: `Production pipeline bottleneck identified in ${v.pipelineStage}.`,
        actionLabel: 'Resolve Block'
      });
    });

    return list;
  }, [insights, videos]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-850 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            AI Insights & Directives
          </h2>
          <p className="text-xs text-neutral-500 font-mono mt-1">Smart recommendations, packaging diagnoses, and algorithmic strategy directives.</p>
        </div>
      </div>

      {/* Insights list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {mergedInsights.map((ins, index) => {
          let typeColor = 'border-neutral-850 bg-neutral-900 text-blue-400';
          let Icon = Info;

          if (ins.type === 'success') {
            typeColor = 'border-emerald-850/60 bg-[#0d2219] text-emerald-400';
            Icon = CheckCircle2;
          } else if (ins.type === 'warning') {
            typeColor = 'border-red-850/60 bg-[#281515] text-red-400';
            Icon = AlertTriangle;
          } else if (ins.type === 'recommendation') {
            typeColor = 'border-purple-850/60 bg-[#21172a] text-purple-400';
            Icon = Sparkles;
          }

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              key={ins.id}
              className={`p-5 rounded-xl border flex flex-col justify-between gap-4 h-60 relative overflow-hidden group ${typeColor}`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-current opacity-5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="space-y-2.5">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-current shrink-0" />
                    <span className="text-xs font-bold text-white font-sans">{ins.title}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-widest bg-black/30 text-white`}>
                    {ins.channel}
                  </span>
                </div>

                <p className="text-xs text-neutral-200 leading-relaxed font-sans font-medium line-clamp-3">
                  {ins.description}
                </p>

                <p className="text-[10px] text-neutral-400 leading-normal font-mono border-t border-white/5 pt-2 font-normal">
                  <span className="font-bold text-neutral-300">Reason:</span> {ins.reason}
                </p>
              </div>

              {ins.actionLabel && (
                <div className="mt-2 text-right">
                  <button 
                    onClick={() => {
                      if (ins.actionLabel === 'Go to Pipeline' || ins.actionLabel === 'Resolve Block' || ins.actionLabel === 'Schedule Next Video') {
                        onTabChange('progress');
                      } else if (ins.actionLabel === 'Repeat Space Topic') {
                        onTabChange('topics');
                      } else {
                        onTabChange('overview');
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-white hover:underline font-bold"
                  >
                    <span>{ins.actionLabel}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

    </div>
  );
}

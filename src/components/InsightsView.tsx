import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowRight
} from 'lucide-react';
import { CreatorInsight, SessionRecord, TaskTimerRecord, Topic, TopicActivity, VideoRecord, WorkdaySession } from '../types';
import ProductionPipelineMap from './ProductionPipelineMap';

interface InsightsViewProps {
  insights: CreatorInsight[];
  videos: VideoRecord[];
  topics: Topic[];
  activities: TopicActivity[];
  sessions: SessionRecord[];
  taskTimers: TaskTimerRecord[];
  workdaySession: WorkdaySession | null;
  onTabChange: (tab: any) => void;
}

export default function InsightsView({
  insights,
  videos,
  topics,
  activities,
  sessions,
  taskTimers,
  workdaySession,
  onTabChange
}: InsightsViewProps) {
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

  const focusTopic = useMemo(() => {
    const activeTimer = taskTimers
      .filter(timer => timer.status === 'running' || timer.status === 'paused')
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

    if (activeTimer) {
      return topics.find(topic => topic.id === activeTimer.topicId) ?? null;
    }

    const blocked = topics.find(topic => Boolean(topic.blockedReason));
    if (blocked) return blocked;

    const dueSoon = topics.find(topic => {
      if (!topic.dueDate) return false;
      const dueMs = new Date(topic.dueDate).getTime();
      return Number.isFinite(dueMs) && dueMs >= Date.now() && dueMs <= Date.now() + 24 * 60 * 60 * 1000;
    });

    return dueSoon ?? topics[0] ?? null;
  }, [taskTimers, topics]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-neutral-850 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
            <Sparkles className="h-5 w-5 text-purple-400" />
            AI Insights & Directives
          </h2>
          <p className="mt-1 text-xs font-mono text-neutral-500">
            Smart recommendations, packaging diagnoses, and algorithmic strategy directives.
          </p>
        </div>
      </div>

      <ProductionPipelineMap
        topics={topics}
        videos={videos}
        activities={activities}
        sessions={sessions}
        taskTimers={taskTimers}
        workdaySession={workdaySession}
        focusTopic={focusTopic}
        onOpenPipeline={() => onTabChange('progress')}
      />

      {/* Insights list */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
              key={ins.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className={`group relative flex h-60 flex-col justify-between overflow-hidden rounded-xl border p-5 gap-4 ${typeColor}`}
            >
              <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-current opacity-5 blur-2xl" />

              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-current" />
                    <span className="text-xs font-bold text-white font-sans">{ins.title}</span>
                  </div>
                  <span className="rounded bg-black/30 px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-widest text-white">
                    {ins.channel}
                  </span>
                </div>

                <p className="line-clamp-3 text-xs leading-relaxed font-medium text-neutral-200 font-sans">
                  {ins.description}
                </p>

                <p className="border-t border-white/5 pt-2 text-[10px] leading-normal font-mono text-neutral-400 font-normal">
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
                    className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-white hover:underline"
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

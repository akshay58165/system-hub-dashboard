import React, { useEffect, useState } from 'react';
import { 
  Play, Calendar, Zap, AlertCircle, DollarSign, Award, Clock, ArrowUpRight, Gauge, CheckSquare, Sparkles, AlertTriangle, ArrowRight, ShieldAlert, CheckCircle2, HeartPulse, TrendingUp, ListChecks
} from 'lucide-react';
import TactileLED from './TactileLED';
import { VideoItem, MonthlyGoals, VideoStage, CalibrationNode, WellbeingEntry } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { calculateRevenueLevel, getEarningOutlook, inferRevenueEligibility, isVideoInCycle } from '../videoLogic';
import { getReadiness, getWellbeingInsights } from '../wellbeingLogic';

type ExpertGuide = { category: string; title: string; why: string; steps: [string, string, string]; outcome: string; tone: 'rose' | 'amber' | 'cyan' | 'emerald' };

function ExpertGuidancePanel({ guides }: { guides: ExpertGuide[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (guides.length < 2) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % guides.length), 7000);
    return () => window.clearInterval(timer);
  }, [guides.length]);
  const active = guides[index % Math.max(1, guides.length)];
  const tones = { rose: 'border-rose-900/70 text-rose-400 from-rose-950/25', amber: 'border-amber-900/60 text-amber-400 from-amber-950/20', cyan: 'border-cyan-900/60 text-cyan-400 from-cyan-950/20', emerald: 'border-emerald-900/60 text-emerald-400 from-emerald-950/20' };
  if (!active) return null;
  return <div className={`min-w-0 h-[88px] overflow-hidden relative rounded-lg border bg-gradient-to-r ${tones[active.tone]} via-zinc-950/80 to-zinc-950/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`}>
    <motion.div className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/[0.035] to-transparent" animate={{ left: ['-15%', '110%'] }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }} />
    <AnimatePresence mode="wait">
      <motion.div key={`${index}-${active.title}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="absolute inset-0 grid grid-cols-[1.05fr_1.5fr_auto] gap-5 items-center px-5">
        <div className="min-w-0"><span className={`text-[8px] font-mono tracking-[0.16em] ${tones[active.tone].split(' ')[1]}`}>EXPERT GUIDANCE · {active.category}</span><strong className="text-[13px] text-white block mt-1 truncate">{active.title}</strong><span className="text-[9px] text-zinc-400 block truncate mt-1">WHY NOW: {active.why}</span></div>
        <div className="grid grid-cols-3 gap-4 min-w-0">{active.steps.map((step, stepIndex) => <div key={step} className="flex gap-2 items-start min-w-0"><span className={`h-6 w-6 rounded-full border ${tones[active.tone].split(' ')[0]} grid place-items-center shrink-0 text-[10px] font-bold ${tones[active.tone].split(' ')[1]}`}>{stepIndex + 1}</span><span className="text-[10px] text-zinc-300 leading-snug line-clamp-2">{step}</span></div>)}</div>
        <div className="min-w-32 text-right"><span className="text-[8px] text-zinc-500 font-mono block">EXPECTED BENEFIT</span><strong className={`text-[10px] ${tones[active.tone].split(' ')[1]}`}>{active.outcome}</strong><div className="flex justify-end gap-1 mt-2">{guides.map((_, dot) => <i key={dot} className={`h-1 rounded-full transition-all ${dot === index % guides.length ? `w-4 ${active.tone === 'rose' ? 'bg-rose-400' : active.tone === 'amber' ? 'bg-amber-400' : active.tone === 'cyan' ? 'bg-cyan-400' : 'bg-emerald-400'}` : 'w-1 bg-zinc-800'}`} />)}</div></div>
      </motion.div>
    </AnimatePresence>
  </div>;
}

interface MissionControlProps {
  month: string;
  todayDay: number;
  totalDays: number;
  totalPlanned: number;
  totalCompleted: number;
  totalRemaining: number;
  requiredDailyPace: number;
  actualDailyPace: number;
  bufferCount: number;
  safeBreakDays: number;
  pressureLevel: 'Low' | 'Stable' | 'Pressure' | 'Critical';
  requiredEffortToday: number;
  videos: VideoItem[];
  onUpdateVideo: (updated: VideoItem) => void;
  onAddVideo: (newVid: Omit<VideoItem, 'id' | 'completionPercentage'>) => void;
  goals: MonthlyGoals;
  wellbeingNodes: CalibrationNode[];
  wellbeingHistory: WellbeingEntry[];
}

export default function MissionControl({
  month,
  todayDay,
  totalDays,
  totalPlanned,
  totalCompleted,
  totalRemaining,
  requiredDailyPace,
  actualDailyPace,
  bufferCount,
  safeBreakDays,
  pressureLevel,
  requiredEffortToday,
  videos,
  onUpdateVideo,
  onAddVideo,
  goals,
  wellbeingNodes,
  wellbeingHistory
}: MissionControlProps) {
  
  const daysLeft = Math.max(0, totalDays - todayDay);
  const elapsedPercent = Math.round((todayDay / totalDays) * 100);
  const completionPercent = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;
  
  // Mission status selection based on pressure and pace
  const getMissionStatus = () => {
    if (pressureLevel === 'Critical' || (todayDay > 25 && completionPercent < 75)) {
      return { 
        label: 'WORKLOAD TOO HIGH', 
        color: 'text-rose-500', 
        bg: 'bg-rose-500/10', 
        border: 'border-rose-500/35 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse', 
        ledColor: 'red' as const, 
        ledImportance: 'critical' as const 
      };
    }
    if (pressureLevel === 'Pressure') {
      return { 
        label: 'WORKLOAD NEEDS REVIEW', 
        color: 'text-amber-500 font-bold', 
        bg: 'bg-amber-500/10', 
        border: 'border-amber-500/35', 
        ledColor: 'amber' as const, 
        ledImportance: 'high' as const 
      };
    }
    if (completionPercent >= elapsedPercent) {
      return { 
        label: 'COMFORTABLY ON TRACK', 
        color: 'text-cyan-400', 
        bg: 'bg-cyan-500/10', 
        border: 'border-cyan-500/35', 
        ledColor: 'cyan' as const, 
        ledImportance: 'low' as const 
      };
    }
    if (completionPercent >= elapsedPercent - 10) {
      return { 
        label: 'ON TRACK STATUS', 
        color: 'text-emerald-400', 
        bg: 'bg-emerald-500/10', 
        border: 'border-emerald-500/35', 
        ledColor: 'emerald' as const, 
        ledImportance: 'medium' as const 
      };
    }
    return { 
      label: 'SLIGHTLY BEHIND PLAN', 
      color: 'text-amber-400', 
      bg: 'bg-amber-500/5', 
      border: 'border-amber-500/20', 
      ledColor: 'amber' as const, 
      ledImportance: 'medium' as const 
    };
  };

  const status = getMissionStatus();

  // -----------------------------------------------------------------
  // CALCULATE GAUGES METRICS
  // -----------------------------------------------------------------
  
  // 1. Pace Velocity: actual pacing vs required pacing
  const paceRatio = requiredDailyPace > 0 ? (actualDailyPace / requiredDailyPace) * 100 : 100;
  let paceStatus: 'calm' | 'warning' | 'danger' = 'calm';
  let paceGlow: 'emerald' | 'amber' | 'red' | 'cyan' = 'emerald';
  if (paceRatio < 65) {
    paceStatus = 'danger';
    paceGlow = 'red';
  } else if (paceRatio < 100) {
    paceStatus = 'warning';
    paceGlow = 'amber';
  }

  // 2. Buffer Shield: secured buffers vs recommended 4 buffers
  let bufferStatus: 'calm' | 'warning' | 'danger' = 'calm';
  let bufferGlow: 'emerald' | 'amber' | 'red' | 'cyan' = 'emerald';
  if (bufferCount === 0) {
    bufferStatus = 'danger';
    bufferGlow = 'red';
  } else if (bufferCount <= 1) {
    bufferStatus = 'warning';
    bufferGlow = 'amber';
  }

  // 3. Workload Effort: required effort today (points/day)
  let effortStatus: 'calm' | 'warning' | 'danger' = 'calm';
  let effortGlow: 'emerald' | 'amber' | 'red' | 'cyan' = 'emerald';
  if (requiredEffortToday > 5) {
    effortStatus = 'danger';
    effortGlow = 'red';
  } else if (requiredEffortToday > 2.5) {
    effortStatus = 'warning';
    effortGlow = 'amber';
  }

  // 4. Pipeline Friction: status issues as a percentage of active videos
  const blockedCount = videos.filter(v => v.isBlocked).length;
  const totalCount = videos.length;
  const frictionPercent = totalCount > 0 ? (blockedCount / totalCount) * 100 : 0;
  let frictionStatus: 'calm' | 'warning' | 'danger' = 'calm';
  let frictionGlow: 'emerald' | 'amber' | 'red' | 'cyan' = 'cyan';
  if (blockedCount >= 2) {
    frictionStatus = 'danger';
    frictionGlow = 'red';
  } else if (blockedCount === 1) {
    frictionStatus = 'warning';
    frictionGlow = 'amber';
  }

  const earningOutlook = getEarningOutlook(videos.filter(video => isVideoInCycle(video, goals.cycleStartDate, goals.cycleEndDate)));
  const wellbeingReadiness = getReadiness(wellbeingNodes);
  const wellbeingInsights = getWellbeingInsights(wellbeingNodes, wellbeingHistory);
  const lowestSignals = [...wellbeingNodes].sort((a, b) => a.value - b.value).slice(0, 3);
  const dailyCapacity = Math.max(1, wellbeingReadiness / 10);
  const demandCapacityRatio = requiredEffortToday / dailyCapacity;
  const weakestSignal = lowestSignals[0];


  // -----------------------------------------------------------------
  // DETERMINISTIC "ONLY NEXT THING TO DO" RESOLUTION ALGORITHM
  // -----------------------------------------------------------------
  interface ActionDirective {
    type: 'blocker' | 'buffer' | 'advance' | 'product_tag' | 'pinned_comment';
    title: string;
    description: string;
    badge: string;
    buttonText: string;
    targetVideoId?: string;
    payload?: any;
  }

  const getNextActionDirective = (): ActionDirective => {
    // 1. Resolve pipeline blockers (highest priority)
    const blockedVideo = videos.find(v => v.isBlocked);
    if (blockedVideo) {
      return {
        type: 'blocker',
        title: `Review critical status on "${blockedVideo.title}"`,
        description: `This video needs attention at ${blockedVideo.currentStage}: "${blockedVideo.statusNote || blockedVideo.blockerReason || 'status note not recorded'}". Resolve the issue or update its status before continuing.`,
        badge: 'CRITICAL STATUS',
        buttonText: 'MARK ISSUE RESOLVED',
        targetVideoId: blockedVideo.id
      };
    }

    // 2. Buffer Shield level is completely depleted
    if (bufferCount === 0) {
      return {
        type: 'buffer',
        title: 'Build a one-day publishing buffer',
        description: 'You have no finished videos scheduled ahead. Complete a quick LearnDriven Short so one upload is ready in reserve.',
        badge: 'NO CONTENT BUFFER',
        buttonText: 'ADD QUICK SHORT (+1 BUFFER DAY)',
      };
    }

    // 3. Complete videos closest to Done (highest progress)
    // Map stages to numerical weights to sort
    const stageWeights: Record<VideoStage, number> = {
      'Done': 6,
      'Schedule': 5,
      'Thumbnail': 4,
      'Edit': 3,
      'Shoot': 2,
      'Script': 1,
      'Topic': 0
    };

    const advanceableVideos = [...videos]
      .filter(v => v.currentStage !== 'Done' && !v.isBlocked)
      .sort((a, b) => stageWeights[b.currentStage] - stageWeights[a.currentStage]);

    if (advanceableVideos.length > 0) {
      const topVid = advanceableVideos[0];
      const nextStageMap: Record<VideoStage, VideoStage> = {
        'Topic': 'Script',
        'Script': 'Shoot',
        'Shoot': 'Edit',
        'Edit': topVid.contentLane === 'LearnDriven Long Videos' ? 'Thumbnail' : 'Schedule',
        'Thumbnail': 'Schedule',
        'Schedule': 'Done',
        'Done': 'Done'
      };
      const nextStage = nextStageMap[topVid.currentStage];

      return {
        type: 'advance',
        title: `Move "${topVid.title}" to ${nextStage}`,
        description: `This video is currently at ${topVid.currentStage}. Finish that step to move it forward and reduce the work still required this month.`,
        badge: 'NEXT PRODUCTION STEP',
        buttonText: `MARK ${topVid.currentStage.toUpperCase()} COMPLETE`,
        targetVideoId: topVid.id,
        payload: { nextStage }
      };
    }

    // 4. Revenue tag opportunities for available videos
    const suitableForTags = videos.find(v => v.productTagStatus === 'Available' && goals.productTagsAllowed);
    if (suitableForTags) {
      return {
        type: 'product_tag',
        title: `Add a relevant product tag to "${suitableForTags.title}"`,
        description: 'This video can include a relevant affiliate product. Adding one may strengthen its earning potential.',
        badge: 'REVENUE BOOST',
        buttonText: 'ADD PRODUCT TAG',
        targetVideoId: suitableForTags.id
      };
    }

    // 5. Engagement booster comments
    const unpinnedComment = videos.find(v => v.pinnedCommentStatus === 'None' && goals.pinnedCommentsAllowed);
    if (unpinnedComment) {
      return {
        type: 'pinned_comment',
        title: `Add a pinned comment to "${unpinnedComment.title}"`,
        description: 'Pin a useful link or question so viewers have a clear next step and a reason to engage.',
        badge: 'ENGAGEMENT OPPORTUNITY',
        buttonText: 'ADD PINNED COMMENT',
        targetVideoId: unpinnedComment.id
      };
    }

    // Default: All parameters operational
    return {
      type: 'advance',
      title: 'Everything is on track',
      description: 'There are no urgent status issues. Your schedule, content buffer, and earning outlook are aligned with the current plan.',
      badge: 'STEADY STATE',
      buttonText: 'NO ACTION NEEDED',
    };
  };

  const currentDirective = getNextActionDirective();
  const expertGuides: ExpertGuide[] = [
    {
      category: 'CONSTRAINT FIRST',
      title: blockedCount > 0 ? 'Restore flow before increasing output' : 'Protect flow before adding more work',
      why: blockedCount > 0 ? `${blockedCount} unresolved issue is holding downstream work.` : `${bufferCount} buffer days leave little room for disruption.`,
      steps: ['Define the smallest decision that removes the constraint.', 'Time-box the repair or decision to 20 focused minutes.', 'If unresolved, switch to a fallback setup and preserve the schedule.'],
      outcome: 'LESS STALLED WORK',
      tone: 'rose',
    },
    {
      category: 'CAPACITY MATCHING',
      title: wellbeingReadiness < 60 ? 'Use recovery as a performance intervention' : 'Spend this capacity on the hardest useful task',
      why: `${wellbeingReadiness}% readiness with ${weakestSignal?.label || 'your lowest signal'} at ${weakestSignal?.value ?? 0}/10.`,
      steps: wellbeingReadiness < 60 ? ['Fix the lowest physical or mental signal first.', 'Choose a 15–25 minute low-friction task.', 'Re-score your state before committing to deep work.'] : ['Silence inputs and define one finish line.', 'Use a 50-minute protected focus block.', 'Stop when the finish line is reached—not when energy is gone.'],
      outcome: wellbeingReadiness < 60 ? 'BETTER ENERGY USE' : 'HIGH-VALUE OUTPUT',
      tone: wellbeingReadiness < 60 ? 'amber' : 'emerald',
    },
    {
      category: 'THROUGHPUT DESIGN',
      title: paceRatio < 100 ? 'Increase flow at the bottleneck, not everywhere' : 'Preserve the system that is working',
      why: `Production is moving at ${paceRatio.toFixed(0)}% of required pace with ${totalRemaining} videos remaining.`,
      steps: ['Identify the stage with the most waiting work.', 'Batch only that stage for the next session.', 'Measure completed handoffs, not hours spent.'],
      outcome: 'FASTER HANDOFFS',
      tone: paceRatio < 100 ? 'cyan' : 'emerald',
    },
    {
      category: 'RELIABILITY BUFFER',
      title: bufferCount === 0 ? 'Build one publish-ready safety asset' : 'Use buffer intentionally—not invisibly',
      why: bufferCount === 0 ? 'The next delay directly threatens publishing consistency.' : `${bufferCount} protected days are available in the plan.`,
      steps: ['Select the lowest-effort viable topic.', 'Finish it end-to-end before starting another.', 'Reserve it for the next disrupted publishing day.'],
      outcome: 'LOWER SCHEDULE RISK',
      tone: bufferCount === 0 ? 'rose' : 'cyan',
    },
  ];

  // Executing the action
  const handleExecuteAction = () => {
    if (!currentDirective.targetVideoId && currentDirective.type !== 'buffer') return;

    // Acknowledge the suggested action, apply status updates
    if (currentDirective.type === 'blocker' && currentDirective.targetVideoId) {
      const v = videos.find(x => x.id === currentDirective.targetVideoId);
      if (v) {
        onUpdateVideo({
          ...v,
          isBlocked: false,
          blockerReason: undefined,
          blockerSeverity: undefined,
          status: 'good',
          statusNote: 'Issue resolved'
        });
      }
    } 
    else if (currentDirective.type === 'buffer') {
      // Create and publish a quick short to act as emergency buffer
      onAddVideo({
        channel: 'LearnDriven',
        contentLane: 'LearnDriven Shorts',
        title: 'Quick Creator Workflow Tip',
        revenueLevelTarget: 3,
        expectedPublishDate: new Date().toISOString().split('T')[0],
        pipeline: {
          topic: 'Done',
          script: 'Done',
          shoot: 'Done',
          edit: 'Done',
          schedule: 'Done'
        },
        currentStage: 'Done',
        isBlocked: false,
        productTagStatus: 'Tagged',
        pinnedCommentStatus: 'None',
        membersPromotionStatus: 'None',
        brandCollabStatus: 'None'
      });
    } 
    else if (currentDirective.type === 'advance' && currentDirective.targetVideoId) {
      const v = videos.find(x => x.id === currentDirective.targetVideoId);
      if (v) {
        const next = currentDirective.payload.nextStage;
        const newPipeline = { ...v.pipeline };
        
        // Mark previous stages as done
        if (next === 'Script') { newPipeline.topic = 'Done'; newPipeline.script = 'In progress'; }
        else if (next === 'Shoot') { newPipeline.script = 'Done'; newPipeline.shoot = 'In progress'; }
        else if (next === 'Edit') { newPipeline.shoot = 'Done'; newPipeline.edit = 'In progress'; }
        else if (next === 'Thumbnail') { newPipeline.edit = 'Done'; newPipeline.thumbnail = 'In progress'; }
        else if (next === 'Schedule') { 
          newPipeline.edit = 'Done'; 
          if (newPipeline.thumbnail) newPipeline.thumbnail = 'Done';
          newPipeline.schedule = 'In progress'; 
        }
        else if (next === 'Done') {
          newPipeline.schedule = 'Done';
        }

        onUpdateVideo({
          ...v,
          currentStage: next,
          pipeline: newPipeline,
          actualScheduledDate: next === 'Done' ? new Date().toISOString().split('T')[0] : undefined
        });
      }
    } 
    else if (currentDirective.type === 'product_tag' && currentDirective.targetVideoId) {
      const v = videos.find(x => x.id === currentDirective.targetVideoId);
      if (v) {
        const revenueEligibility = { ...inferRevenueEligibility(v), productTag: true };
        onUpdateVideo({
          ...v,
          productTagStatus: 'Tagged',
          revenueEligibility,
          revenueLevelTarget: calculateRevenueLevel(v.contentLane, revenueEligibility)
        });
      }
    } 
    else if (currentDirective.type === 'pinned_comment' && currentDirective.targetVideoId) {
      const v = videos.find(x => x.id === currentDirective.targetVideoId);
      if (v) {
        onUpdateVideo({
          ...v,
          pinnedCommentStatus: 'Added'
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Creator Command Radar Scan & Master Telemetry Line */}
      <div className={`bg-zinc-950/80 border transition-all duration-500 rounded-lg p-4 font-mono text-xs relative overflow-hidden shadow-[0_0_15px_rgba(16,185,129,0.02)] grid grid-cols-1 lg:grid-cols-[1.05fr_1.25fr_auto] items-center gap-4 ${status.border}`}>
        {/* Radar green scanning bar effect */}
        <div className="absolute top-0 bottom-0 left-0 w-[2px] bg-emerald-500 shadow-[0_0_8px_#10b981] animate-[pulse_2.5s_infinite]" />
        
        <div className="space-y-1.5 pl-2">
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 tracking-widest uppercase">
            <TactileLED color="emerald" importance="medium" />
            CREATOR WORKFLOW CHECK
            <span className="text-zinc-700">//</span>
            <span>PRODUCTION DATA: UPDATED</span>
          </div>
          <h3 className="text-sm font-semibold tracking-wider text-zinc-100 flex items-center gap-3">
            CURRENT STATUS:
            <TactileLED color={status.ledColor} importance={status.ledImportance} />
            <span className={`${status.color} font-bold tracking-widest`}>
              {status.label}
            </span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 lg:border-l lg:border-zinc-900 lg:pl-4">
          <div className="bg-zinc-900/25 border border-zinc-900 rounded p-2"><span className="text-[7px] text-zinc-600 uppercase block">Pace consequence</span><strong className={`text-[9px] block mt-1 ${paceRatio < 100 ? 'text-rose-400' : 'text-emerald-400'}`}>{paceRatio < 75 ? 'Output is slipping sharply' : paceRatio < 100 ? 'Slightly behind the plan' : 'Current pace supports the plan'}</strong></div>
          <div className="bg-zinc-900/25 border border-zinc-900 rounded p-2"><span className="text-[7px] text-zinc-600 uppercase block">Schedule exposure</span><strong className={`text-[9px] block mt-1 ${bufferCount === 0 ? 'text-rose-400' : 'text-zinc-300'}`}>{bufferCount === 0 ? 'Next delay affects publishing' : `${bufferCount} protected days available`}</strong></div>
          <div className="bg-zinc-900/25 border border-zinc-900 rounded p-2"><span className="text-[7px] text-zinc-600 uppercase block">Capacity constraint</span><strong className="text-[9px] text-amber-400 block mt-1">{weakestSignal ? `${weakestSignal.label}: ${weakestSignal.value}/10` : 'No state data yet'}</strong></div>
        </div>

        {/* Top Mini Telemetry Counters */}
        <div className="flex flex-wrap gap-4 md:gap-8 self-stretch md:self-auto justify-between border-t md:border-t-0 border-zinc-900 pt-3 md:pt-0 pl-2">
          <div>
            <div className="text-[9px] text-zinc-500 tracking-wider uppercase">PACE VS. REQUIRED</div>
            <div className="text-xs font-bold text-cyan-400 tracking-widest">
              {requiredDailyPace > 0 ? (actualDailyPace / requiredDailyPace).toFixed(2) : '1.00'}x <span className="text-[10px] text-zinc-600 font-normal">PACE</span>
            </div>
          </div>
          <div>
            <div className="text-[9px] text-zinc-500 tracking-wider uppercase">CONTENT BUFFER</div>
            <div className="text-xs font-bold text-white tracking-widest">
              {bufferCount} <span className="text-[10px] text-zinc-500 font-normal">DAYS</span>
            </div>
          </div>
          <div>
            <div className="text-[9px] text-zinc-500 tracking-wider uppercase">DAILY WORKLOAD</div>
            <div className="text-xs font-bold text-amber-500 tracking-widest">
              {requiredEffortToday.toFixed(1)} <span className="text-[10px] text-zinc-600 font-normal">EFFORT/DAY</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ACTIVE CRITICAL BLOCKER & MISSION DIRECTIVE OVERWATCH PANEL   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-[#0b0c10] border border-zinc-900/90 rounded-lg p-5 shadow-2xl relative overflow-hidden">
        {/* Subtle grid mesh overlay to match retro cockpit panels */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[size:100%_4px] pointer-events-none opacity-40" />

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-zinc-900 pb-3 mb-5 relative z-10">
          <div className="flex items-center gap-2">
            <ShieldAlert className={`h-4 w-4 ${
              currentDirective.badge === 'STEADY STATE' ? 'text-emerald-500' :
              currentDirective.badge === 'REVENUE BOOST' || currentDirective.badge === 'ENGAGEMENT OPPORTUNITY' ? 'text-amber-400' : 'text-rose-500'
            }`} />
            <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
              RECOMMENDED NEXT ACTION
            </span>
          </div>
          <div className="hidden xl:block min-w-0 px-3">
            <ExpertGuidancePanel guides={expertGuides} />
          </div>
          <span className="text-[8px] font-mono text-zinc-600 tracking-wider uppercase hidden sm:inline">
            PRIORITY_ENGINE_ACTIVE
          </span>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* DAILY EFFORT CAPACITY OVERWATCH BANNER                        */}
        {/* ------------------------------------------------------------- */}
        <div className="mb-5 bg-zinc-950/40 border border-zinc-900 p-4 rounded-lg grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_auto] items-center gap-5 relative z-10 shadow-[inset_0_1px_5px_rgba(0,0,0,0.5)] overflow-hidden">
          <motion.div className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-rose-500/5 to-transparent pointer-events-none" animate={{ left: ['-10%', '110%'] }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }} />
          <div className="flex flex-col gap-1 relative z-10">
            <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase flex items-center gap-2 justify-center sm:justify-start">
              <span className={`h-2 w-2 rounded-full ${
                pressureLevel === 'Critical' ? 'bg-rose-500 animate-pulse' : pressureLevel === 'Pressure' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
              }`} />
              TODAY'S WORKLOAD ESTIMATE
            </span>
            <span className="text-[9px] font-sans text-zinc-500 max-w-md">
              Estimated effort needed each day, based on unfinished videos and current status issues.
            </span>
            <div className={`mt-2 inline-flex w-fit items-center gap-1.5 rounded border px-2 py-1 text-[8px] font-mono font-bold ${demandCapacityRatio > 1.5 ? 'border-rose-900/60 bg-rose-950/15 text-rose-400' : 'border-emerald-900/60 bg-emerald-950/15 text-emerald-400'}`}>
              <TrendingUp className="h-3 w-3" /> DEMAND IS {demandCapacityRatio.toFixed(1)}× CURRENT CAPACITY
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 font-mono max-w-lg">
              <div className="border border-zinc-900 bg-zinc-900/20 rounded p-2"><span className="text-[7px] text-zinc-600 uppercase block">State intervention</span><strong className="text-[8px] text-cyan-400 block mt-1 leading-snug">{wellbeingInsights[0]?.title}</strong></div>
              <div className="border border-zinc-900 bg-zinc-900/20 rounded p-2"><span className="text-[7px] text-zinc-600 uppercase block">Best task shape</span><strong className="text-[8px] text-zinc-300 block mt-1 leading-snug">{wellbeingReadiness < 60 ? 'One short resolving step, then reassess' : 'Use a focused block on the priority action'}</strong></div>
            </div>
          </div>

          <div className="space-y-3 relative z-10 font-mono">
            <div><div className="flex justify-between text-[8px] text-zinc-500 mb-1"><span>PLAN DEMAND</span><strong className="text-rose-400">{requiredEffortToday.toFixed(1)} PTS</strong></div><div className="h-2 bg-zinc-900 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, requiredEffortToday * 10)}%` }} className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full" /></div></div>
            <div><div className="flex justify-between text-[8px] text-zinc-500 mb-1"><span>HUMAN CAPACITY</span><strong className={wellbeingReadiness >= 70 ? 'text-emerald-400' : 'text-cyan-400'}>{dailyCapacity.toFixed(1)} PTS</strong></div><div className="h-2 bg-zinc-900 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${wellbeingReadiness}%` }} className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full" /></div></div>
          </div>

          <div className="flex items-center gap-6 relative z-10">
            {/* Needle Gauge */}
            <div className="relative flex justify-center w-24 h-12 shrink-0">
              <svg className="w-24 h-12" viewBox="0 0 100 50">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#27272a" strokeWidth="6" strokeLinecap="round" />
                <path 
                  d="M 10 50 A 40 40 0 0 1 90 50" 
                  fill="none" 
                  stroke={pressureLevel === 'Critical' ? '#ef4444' : pressureLevel === 'Pressure' ? '#f59e0b' : '#10b981'} 
                  strokeWidth="6" 
                  strokeLinecap="round" 
                  strokeDasharray={`${Math.min(125, (requiredEffortToday / 10) * 125)}, 125`}
                />
                <line 
                  x1="50" y1="50" 
                  x2={50 + 35 * Math.cos(Math.PI - (Math.min(10, requiredEffortToday) / 10) * Math.PI)} 
                  y2={50 - 35 * Math.sin(Math.PI - (Math.min(10, requiredEffortToday) / 10) * Math.PI)} 
                  stroke="#fff" strokeWidth="2.5" strokeLinecap="round" 
                />
                <circle cx="50" cy="50" r="3.5" fill="#fff" />
              </svg>
              <div className="absolute bottom-1 text-center flex flex-col items-center">
                <span className="text-[11px] font-bold text-white font-mono leading-none">{requiredEffortToday.toFixed(1)}</span>
                <span className="text-[6.5px] text-zinc-500 font-mono font-bold tracking-widest block uppercase">EFFORT/DAY</span>
              </div>
            </div>

            {/* Pressure Status Info */}
            <div className="font-mono text-xs flex flex-col justify-center min-w-[120px]">
              <div className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">WORKLOAD LEVEL</div>
              <div className="flex items-center gap-2">
                <span className={`text-[12px] font-bold tracking-wide uppercase ${
                  pressureLevel === 'Critical' ? 'text-rose-400 animate-pulse' : pressureLevel === 'Pressure' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {pressureLevel}
                </span>
                <span className="text-zinc-600">/</span>
                <span className="text-[10px] text-zinc-500">10.0 MAX</span>
              </div>
            </div>
          </div>
        </div>

        {/* Master Row Grid: Status Module on Left, Active Directive info on Right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
          
          {/* Human-state context: explains whether today's plan fits current capacity */}
          <div className="md:col-span-4 p-4 border border-zinc-900 bg-zinc-950/80 rounded-lg relative overflow-hidden shadow-[inset_0_1px_5px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-3 font-mono">
              <span className="text-[9px] text-zinc-400 font-bold tracking-wider flex items-center gap-1.5"><HeartPulse className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />YOUR CAPACITY NOW</span>
              <div className="h-11 w-11 rounded-full grid place-items-center" style={{ background: `conic-gradient(${wellbeingReadiness >= 70 ? '#34d399' : wellbeingReadiness >= 50 ? '#f59e0b' : '#f43f5e'} ${wellbeingReadiness * 3.6}deg, #18181b 0deg)` }}><div className="h-8 w-8 bg-zinc-950 rounded-full grid place-items-center"><span className={`text-[9px] font-black ${wellbeingReadiness >= 70 ? 'text-emerald-400' : wellbeingReadiness >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>{wellbeingReadiness}%</span></div></div>
            </div>
            <div className={`border rounded p-3 relative overflow-hidden ${wellbeingInsights[0]?.tone === 'act' ? 'border-rose-900/50 bg-rose-950/10' : wellbeingInsights[0]?.tone === 'watch' ? 'border-amber-900/50 bg-amber-950/10' : 'border-emerald-900/50 bg-emerald-950/10'}`}>
              <div className="absolute right-2 top-2"><AlertTriangle className={`h-7 w-7 ${wellbeingInsights[0]?.tone === 'act' ? 'text-rose-500/20 animate-pulse' : 'text-emerald-500/20'}`} /></div>
              <strong className="text-[10px] text-zinc-200 block pr-8">{wellbeingInsights[0]?.title}</strong>
              <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed pr-6">{wellbeingInsights[0]?.detail}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {lowestSignals.map(signal => <div key={signal.id} className="border border-zinc-900 rounded p-2 font-mono"><div className="flex justify-between gap-1"><span className="text-[7px] text-zinc-600 uppercase truncate">{signal.label}</span><strong className={`text-[9px] ${signal.value <= 4 ? 'text-rose-400' : 'text-zinc-300'}`}>{signal.value}</strong></div><div className="h-1 bg-zinc-900 rounded-full mt-2 overflow-hidden"><div className={`h-full rounded-full ${signal.value <= 4 ? 'bg-rose-500 animate-pulse' : 'bg-cyan-400'}`} style={{ width: `${signal.value * 10}%` }} /></div></div>)}
            </div>
            <p className="text-[8px] text-zinc-600 mt-3 font-mono">Update these in Daily State whenever your condition changes.</p>
          </div>

          {/* Active Directive Details (md:col-span-8) */}
          <div className="md:col-span-8 flex flex-col justify-between bg-zinc-950/50 border border-zinc-900 rounded-lg p-5 font-mono text-xs relative overflow-hidden shadow-[inset_0_1px_5px_rgba(0,0,0,0.6)]">
            
            {/* Top Indicator Strip */}
            <div className={`absolute top-0 left-0 right-0 h-[3px] transition-colors duration-500 ${
              currentDirective.badge === 'STEADY STATE' ? 'bg-emerald-500' :
                  currentDirective.badge === 'REVENUE BOOST' || currentDirective.badge === 'ENGAGEMENT OPPORTUNITY' ? 'bg-amber-400' : 'bg-rose-500'
            }`} />

            {/* Title, Badge & Text Content */}
            <div className="space-y-3 relative z-10">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${
                  currentDirective.badge === 'STEADY STATE' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60' :
                  currentDirective.badge === 'REVENUE BOOST' || currentDirective.badge === 'ENGAGEMENT OPPORTUNITY' ? 'bg-amber-950/40 text-amber-400 border-amber-900/60' :
                  'bg-rose-950/40 text-rose-400 border-rose-900/60 animate-pulse'
                }`}>
                  {currentDirective.badge}
                </span>
                
                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <span>WHY THIS IS NEXT</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    currentDirective.badge === 'STEADY STATE' ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'
                  }`} />
                </span>
              </div>

              <h4 className="text-sm font-bold text-zinc-200 tracking-wide uppercase leading-snug">
                {currentDirective.title}
              </h4>
              
              <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                {currentDirective.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <div className="border border-zinc-900 bg-zinc-900/25 rounded p-2.5 relative overflow-hidden"><AlertCircle className="h-4 w-4 text-rose-400 mb-2" /><span className="text-[7px] text-zinc-600 uppercase block">Trigger</span><strong className="text-[9px] text-zinc-300 block mt-0.5">{blockedCount > 0 ? `${blockedCount} status issue needs review` : `${totalRemaining} planned videos remain`}</strong></div>
                <div className="border border-zinc-900 bg-zinc-900/25 rounded p-2.5 relative overflow-hidden"><Gauge className="h-4 w-4 text-amber-400 mb-2" /><span className="text-[7px] text-zinc-600 uppercase block">Plan effect</span><strong className="text-[9px] text-zinc-300 block mt-0.5">{bufferCount === 0 ? 'No content buffer protects the schedule' : `${bufferCount} days of buffer available`}</strong><ArrowRight className="hidden sm:block absolute right-2 top-2 h-3 w-3 text-zinc-800" /></div>
                <div className="border border-zinc-900 bg-zinc-900/25 rounded p-2.5 relative overflow-hidden"><ListChecks className="h-4 w-4 text-cyan-400 mb-2" /><span className="text-[7px] text-zinc-600 uppercase block">Best response</span><strong className="text-[9px] text-zinc-300 block mt-0.5">{wellbeingReadiness < 60 ? 'Take the smallest resolving step first' : 'Resolve it in the current focus window'}</strong></div>
              </div>
            </div>

            {/* Bottom Section: Real Context Metadata & SATISFYING Exec Button */}
            <div className="mt-5 pt-3 border-t border-zinc-900/80 relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              
              {/* Core metrics snapshot for context validation */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[8.5px] text-zinc-500 uppercase font-mono max-w-xs">
                <div>Active Buffer: <span className="text-zinc-300 font-bold">{bufferCount} Days</span></div>
                <div>Workload: <span className={`font-bold ${
                  pressureLevel === 'Critical' ? 'text-red-400' : pressureLevel === 'Pressure' ? 'text-amber-400' : 'text-emerald-400'
                }`}>{pressureLevel}</span></div>
                <div>Needs Review: <span className={`font-bold ${blockedCount > 0 ? 'text-red-400' : 'text-zinc-400'}`}>{blockedCount} Items</span></div>
                <div>Daily Effort: <span className="text-zinc-300 font-bold">{requiredEffortToday.toFixed(1)} points</span></div>
              </div>

              {/* Action Button */}
              <div className="sm:min-w-[200px] shrink-0">
                {currentDirective.badge === 'STEADY STATE' ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-400 text-[9px] font-bold bg-emerald-950/10 py-2.5 px-4 border border-emerald-900/40 rounded">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span>NO URGENT ACTION NEEDED</span>
                  </div>
                ) : (
                  <button
                    id="tactile-execute-btn"
                    onClick={handleExecuteAction}
                    className={`w-full text-center flex items-center justify-center gap-2 py-2.5 px-4 rounded text-[9.5px] font-bold tracking-wider transition-all duration-300 relative group overflow-hidden ${
                      currentDirective.badge === 'CRITICAL STATUS' || currentDirective.badge === 'NO CONTENT BUFFER'
                        ? 'bg-rose-950/20 text-rose-400 border border-rose-900/80 hover:bg-rose-500 hover:text-zinc-950 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                        : 'bg-amber-950/20 text-amber-400 border border-amber-900/80 hover:bg-amber-500 hover:text-zinc-950 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0 animate-spin" style={{ animationDuration: '3.5s' }} />
                    <span>{currentDirective.buttonText}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-1" />
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Main Grid: 1. Mission Control Center Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Month Progress & Day metrics */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 flex flex-col justify-between space-y-4 hover:border-zinc-800 transition-colors">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase">MONTHLY TIME PROGRESS</span>
              <span className="font-mono text-zinc-400 text-[11px]">{todayDay}/{totalDays} DAYS</span>
            </div>
            <div className="relative h-2 bg-zinc-900 rounded overflow-hidden border border-zinc-900">
              <div 
                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                style={{ width: `${elapsedPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono mt-1 text-zinc-600">
              <span>{elapsedPercent}% COMPLETED</span>
              <span>{daysLeft} DAYS REMAINING</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-900">
            <div className="bg-zinc-900/30 border border-zinc-900/60 rounded p-2 text-center">
              <span className="text-[9px] text-zinc-500 font-mono block">ELAPSED MONTH</span>
              <span className="text-lg font-bold text-white font-mono tracking-tight">{elapsedPercent}%</span>
            </div>
            <div className="bg-zinc-900/30 border border-zinc-900/60 rounded p-2 text-center">
              <span className="text-[9px] text-zinc-500 font-mono block">DAYS REMAINING</span>
              <span className="text-lg font-bold text-emerald-400 font-mono tracking-tight">{daysLeft}D</span>
            </div>
          </div>
        </div>

        {/* Content Goals Status */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 flex flex-col justify-between space-y-4 hover:border-zinc-800 transition-colors">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase">CONTENT GOAL PROGRESS</span>
              <span className="font-mono text-emerald-400 text-[11px]">{completionPercent}%</span>
            </div>
            <div className="relative h-2 bg-zinc-900 rounded overflow-hidden border border-zinc-900">
              <div 
                className="absolute top-0 bottom-0 left-0 bg-emerald-500 shadow-[0_0_8px_#10b981] transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono mt-1 text-zinc-600">
              <span>{totalCompleted} DONE</span>
              <span>{totalRemaining} REMAINING</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-900">
            <div className="bg-zinc-900/30 border border-zinc-900/60 rounded p-1.5 text-center">
              <span className="text-[8px] text-zinc-500 block leading-tight">TOTAL TARGET</span>
              <span className="text-base font-bold text-white font-mono">{totalPlanned}</span>
            </div>
            <div className="bg-zinc-900/30 border border-zinc-900/60 rounded p-1.5 text-center">
              <span className="text-[8px] text-zinc-500 block leading-tight">COMPLETED</span>
              <span className="text-base font-bold text-emerald-400 font-mono">{totalCompleted}</span>
            </div>
            <div className="bg-zinc-900/30 border border-zinc-900/60 rounded p-1.5 text-center">
              <span className="text-[8px] text-zinc-500 block leading-tight">REMAINING</span>
              <span className="text-base font-bold text-amber-500 font-mono">{totalRemaining}</span>
            </div>
          </div>
        </div>

        {/* Buffer & Safe Break Analysis */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 flex flex-col justify-between space-y-3 hover:border-zinc-800 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase">SCHEDULED CONTENT BUFFER</span>
            <div className="flex items-center gap-1.5">
              <TactileLED color={bufferCount > 0 ? 'emerald' : 'red'} importance={bufferCount > 0 ? 'medium' : 'critical'} />
              <span className={`text-[10px] font-mono font-bold ${bufferCount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{bufferCount} DAYS READY</span>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-900 p-2.5 rounded flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full border border-sky-500/20 bg-sky-950/10 flex items-center justify-center font-mono font-bold text-sky-400 text-sm animate-pulse">
              {safeBreakDays}D
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-zinc-400 font-bold block">AVAILABLE BREAK TIME</span>
              <p className="text-[10px] text-zinc-500 leading-normal">
                {safeBreakDays > 0 
                  ? `You can take up to ${safeBreakDays} days off without missing a planned upload.`
                  : "No break day is available yet because the next upload is not ready in advance."}
              </p>
            </div>
          </div>

          <div className="flex justify-between text-[10px] font-mono text-zinc-500">
            <span>PACE REQ: {requiredDailyPace.toFixed(2)}/D</span>
            <span className={actualDailyPace >= requiredDailyPace ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              ACTUAL: {actualDailyPace.toFixed(2)}/D
            </span>
          </div>
        </div>

        {/* Directional earning outlook */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 flex flex-col justify-between space-y-3 hover:border-zinc-800 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase">EARNING OUTLOOK</span>
            <span className="text-[9px] text-zinc-600 font-bold">DIRECTIONAL</span>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-2xl font-black tracking-wide text-emerald-400 uppercase">{earningOutlook.label}</div>
              <div className="text-[9px] text-zinc-600 font-mono uppercase mt-1">Projected earning strength</div>
            </div>
            <div className="text-right font-mono">
              <div className="text-sm font-bold text-white">{earningOutlook.frequency} VIDEOS</div>
              <div className="text-[9px] text-zinc-500 uppercase">{earningOutlook.frequencyBand} frequency</div>
            </div>
          </div>

          <div className="bg-zinc-900/30 border border-zinc-900 rounded p-2">
            <div className="flex items-center justify-between text-[9px] font-mono uppercase">
              <span className="text-zinc-500">Video level mix</span>
              <span className="text-cyan-400 font-bold">{earningOutlook.levelMixBand}</span>
            </div>
            <p className="text-[9px] text-zinc-600 mt-1 leading-relaxed">
              Based on video levels and monthly frequency. This is a direction, not an exact income prediction.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

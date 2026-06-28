import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Zap, AlertTriangle, Play, Sparkles, CheckSquare, Square, 
  HelpCircle, ChevronRight, Tag, Plus, Layers, Heart, ShieldAlert, BadgeCent
} from 'lucide-react';
import { VideoItem, ProductOpportunity, MonthlyGoals, VideoStage } from '../types';
import { calculateRevenueLevel, getLocalDateString, inferRevenueEligibility } from '../videoLogic';

interface TacticalActionStepsProps {
  videos: VideoItem[];
  productOpportunities: ProductOpportunity[];
  goals: MonthlyGoals;
  onUpdateVideo: (updated: VideoItem) => void;
  onUpdateProductOpportunity: (updated: ProductOpportunity) => void;
}

interface ActionStep {
  id: string;
  category: 'critical' | 'production' | 'monetization' | 'runway' | 'maintenance';
  title: string;
  description: string;
  impact: string;
  buttonLabel: string;
  channelContext?: 'LearnDriven' | 'DecodeWorthy';
  execute: () => void;
}

export default function TacticalActionSteps({
  videos,
  productOpportunities,
  goals,
  onUpdateVideo,
  onUpdateProductOpportunity
}: TacticalActionStepsProps) {
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [completedAnimationId, setCompletedAnimationId] = useState<string | null>(null);

  // Generate the prioritized list of dynamic action steps
  const generateSteps = (): ActionStep[] => {
    const steps: ActionStep[] = [];
    const todayStr = getLocalDateString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const inTwoDays = new Date();
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    const tomorrowStr = getLocalDateString(tomorrow);
    const inTwoDaysStr = getLocalDateString(inTwoDays);

    // 1. CRITICAL ROADBLOCKS AND PIPELINE JAMS (Priority 1)
    const blockedVids = videos.filter(v => v.isBlocked);
    blockedVids.forEach(vid => {
      steps.push({
        id: `block_${vid.id}`,
        category: 'critical',
        title: 'REVIEW VIDEO STATUS',
        description: `Resolve the issue affecting "${vid.title}" at the ${vid.currentStage} stage: ${vid.statusNote || vid.blockerReason || 'status note not recorded'}.`,
        impact: 'Gets this video moving again and reduces pressure on the production schedule.',
        buttonLabel: 'MARK ISSUE RESOLVED',
        channelContext: vid.channel,
        execute: () => {
          onUpdateVideo({
            ...vid,
            isBlocked: false,
            blockerReason: undefined,
            blockerSeverity: undefined,
            status: 'good',
            statusNote: 'Issue resolved'
          });
        }
      });
    });

    // 2. CRITICAL BUFFER DEFICITS (Priority 2)
    const ldShorts = videos.filter(v => v.channel === 'LearnDriven' && v.contentLane === 'LearnDriven Shorts');
    const dwShorts = videos.filter(v => v.channel === 'DecodeWorthy' && v.contentLane === 'DecodeWorthy Shorts');
    
    const getBufferCount = (laneVids: VideoItem[]) => 
      laneVids.filter(v => v.currentStage === 'Done' && v.actualScheduledDate && v.actualScheduledDate > todayStr).length;

    const ldShortsBuffer = getBufferCount(ldShorts);
    const dwShortsBuffer = getBufferCount(dwShorts);

    if (dwShortsBuffer === 0 && goals.dwShortsTarget > 0) {
      // Find a DecodeWorthy Short that is not Done and move it to Done/Scheduled
      const nextShort = videos.find(v => v.contentLane === 'DecodeWorthy Shorts' && v.currentStage === 'Schedule');
      if (nextShort) {
        steps.push({
          id: `buffer_dw_${nextShort.id}`,
          category: 'critical',
          title: 'BUILD A ONE-DAY CONTENT BUFFER',
          description: `Schedule the completed video "${nextShort.title}" for tomorrow so you have one video ready ahead of time.`,
          impact: 'Gives DecodeWorthy Shorts one scheduled video in reserve.',
          buttonLabel: 'SCHEDULE NOW',
          channelContext: 'DecodeWorthy',
          execute: () => {
            onUpdateVideo({
              ...nextShort,
              currentStage: 'Done',
              actualScheduledDate: tomorrowStr,
              pipeline: { ...nextShort.pipeline, schedule: 'Done' }
            });
          }
        });
      }
    }

    if (ldShortsBuffer === 0 && goals.ldShortsTarget > 0) {
      const nextShort = videos.find(v => v.contentLane === 'LearnDriven Shorts' && v.currentStage === 'Schedule');
      if (nextShort) {
        steps.push({
          id: `buffer_ld_${nextShort.id}`,
          category: 'critical',
          title: 'BUILD A ONE-DAY CONTENT BUFFER',
          description: `Schedule the completed video "${nextShort.title}" so your posting schedule has breathing room.`,
          impact: 'Gives LearnDriven Shorts one scheduled video in reserve.',
          buttonLabel: 'SCHEDULE NOW',
          channelContext: 'LearnDriven',
          execute: () => {
            onUpdateVideo({
              ...nextShort,
              currentStage: 'Done',
              actualScheduledDate: tomorrowStr,
              pipeline: { ...nextShort.pipeline, schedule: 'Done' }
            });
          }
        });
      }
    }

    // 3. POST-PRODUCTION CONVERSIONS (Priority 3)
    // Thumbnail Stage backlog
    const thumbnailVids = videos.filter(v => v.currentStage === 'Thumbnail');
    thumbnailVids.forEach(vid => {
      steps.push({
        id: `thumb_${vid.id}`,
        category: 'production',
        title: 'FINISH THUMBNAIL',
        description: `Create and approve the thumbnail for "${vid.title}".`,
        impact: 'Makes the edited video ready to schedule.',
        buttonLabel: 'MARK THUMBNAIL DONE',
        channelContext: vid.channel,
        execute: () => {
          onUpdateVideo({
            ...vid,
            currentStage: 'Done',
            actualScheduledDate: inTwoDaysStr,
            pipeline: { ...vid.pipeline, thumbnail: 'Done', schedule: 'Done' }
          });
        }
      });
    });

    // Edit Stage backlog
    const editVids = videos.filter(v => v.currentStage === 'Edit');
    editVids.forEach(vid => {
      steps.push({
        id: `edit_${vid.id}`,
        category: 'production',
        title: 'FINISH VIDEO EDIT',
        description: `Complete the timeline, cuts, and audio for "${vid.title}".`,
        impact: 'Moves the video to thumbnail design, or marks a Short ready to schedule.',
        buttonLabel: 'MARK EDIT DONE',
        channelContext: vid.channel,
        execute: () => {
          onUpdateVideo({
            ...vid,
            currentStage: vid.contentLane.includes('Long') ? 'Thumbnail' : 'Done',
            actualScheduledDate: vid.contentLane.includes('Long') ? undefined : inTwoDaysStr,
            pipeline: { ...vid.pipeline, edit: 'Done' }
          });
        }
      });
    });

    // 4. MONETIZATION UPGRADES (Priority 4)
    const pendingOpps = productOpportunities.filter(o => o.status === 'Pending');
    pendingOpps.forEach(opp => {
      // Find if we have an active video that matches the topic or is general
      const matchingVideo = videos.find(v => v.title === opp.topic && v.productTagStatus !== 'Tagged' && v.currentStage !== 'Done');
      
      if (matchingVideo) {
        steps.push({
          id: `opp_map_${opp.id}`,
          category: 'monetization',
          title: 'ADD RELEVANT PRODUCT TAG',
          description: `Add the affiliate tag "${opp.suggestedTag}" to "${matchingVideo.title}".`,
          impact: `Raises its estimated earning level: ${opp.revenueUpgrade}.`,
          buttonLabel: 'ADD PRODUCT TAG',
          channelContext: opp.channel,
          execute: () => {
            onUpdateProductOpportunity({
              ...opp,
              status: 'Added'
            });
            const revenueEligibility = { ...inferRevenueEligibility(matchingVideo), productTag: true };
            onUpdateVideo({
              ...matchingVideo,
              productTagStatus: 'Tagged',
              revenueEligibility,
              revenueLevelTarget: calculateRevenueLevel(matchingVideo.contentLane, revenueEligibility)
            });
          }
        });
      }
    });

    // 5. PIPELINE MOVEMENT / PROGRESSION
    // Videos in topic or script stage
    const designDrafts = videos.filter(v => v.currentStage === 'Topic' || v.currentStage === 'Script');
    designDrafts.forEach(vid => {
      steps.push({
        id: `sprint_script_${vid.id}`,
        category: 'production',
        title: 'WRITE THE SCRIPT',
        description: `Draft and review the script for "${vid.title}" so it is ready to shoot.`,
        impact: 'Clarifies the video structure and moves it into production.',
        buttonLabel: 'MARK SCRIPT DONE',
        channelContext: vid.channel,
        execute: () => {
          onUpdateVideo({
            ...vid,
            currentStage: 'Shoot',
            pipeline: { ...vid.pipeline, script: 'Done' }
          });
        }
      });
    });

    const shootingVids = videos.filter(v => v.currentStage === 'Shoot');
    shootingVids.forEach(vid => {
      steps.push({
        id: `sprint_shoot_${vid.id}`,
        category: 'production',
        title: 'RECORD THE VIDEO',
        description: `Record the required footage for "${vid.title}".`,
        impact: 'Provides the raw footage needed to begin editing.',
        buttonLabel: 'MARK RECORDING DONE',
        channelContext: vid.channel,
        execute: () => {
          onUpdateVideo({
            ...vid,
            currentStage: 'Edit',
            pipeline: { ...vid.pipeline, shoot: 'Done' }
          });
        }
      });
    });

    return steps;
  };

  const allAvailableSteps = generateSteps();
  
  // Define priority ranks (lower is more critical)
  const categoryPriorityRanks: Record<string, number> = {
    'critical': 1,
    'production': 2,
    'monetization': 3
  };

  // Only show distinct, evidence-backed actions. Never fill empty slots with generic work.
  const sortedCandidates = allAvailableSteps
    .filter(step => !checkedIds[step.id])
    .sort((a, b) => {
      const pA = categoryPriorityRanks[a.category] ?? 99;
      const pB = categoryPriorityRanks[b.category] ?? 99;
      return pA - pB;
    });
  const activeSteps: ActionStep[] = [];
  const usedSubjects = new Set<string>();
  const usedActionTypes = new Set<string>();
  for (const step of sortedCandidates) {
    const quotedSubject = step.description.match(/"([^"]+)"/)?.[1]?.trim().toLowerCase();
    const actionType = step.title.trim().toLowerCase();
    if (quotedSubject && usedSubjects.has(quotedSubject)) continue;
    if (usedActionTypes.has(actionType)) continue;
    activeSteps.push(step);
    if (quotedSubject) usedSubjects.add(quotedSubject);
    usedActionTypes.add(actionType);
    if (activeSteps.length === 3) break;
  }

  const handleToggleCheck = (step: ActionStep) => {
    // 1. Mark checked in UI immediately
    setCheckedIds(prev => ({ ...prev, [step.id]: true }));
    setCompletedAnimationId(step.id);

    // 2. Perform the actual physical action on the dashboard state!
    setTimeout(() => {
      step.execute();
      setCompletedAnimationId(null);
    }, 450);
  };

  const getCardColorTheme = (category: string) => {
    switch (category) {
      case 'critical':
        return {
          border: 'border-rose-950 bg-rose-950/5 hover:border-rose-500/30',
          badge: 'bg-rose-950/20 text-rose-400 border-rose-900/40',
          iconColor: 'text-rose-500',
          accentGlow: 'shadow-[0_0_15px_rgba(239,68,68,0.06)]',
          buttonClass: 'bg-rose-950/40 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-900 hover:border-transparent',
        };
      case 'production':
        return {
          border: 'border-emerald-950 bg-emerald-950/5 hover:border-emerald-500/30',
          badge: 'bg-emerald-950/20 text-emerald-400 border-emerald-900/40',
          iconColor: 'text-emerald-400',
          accentGlow: 'shadow-[0_0_15px_rgba(16,185,129,0.05)]',
          buttonClass: 'bg-emerald-950/40 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-900 hover:border-transparent',
        };
      case 'monetization':
        return {
          border: 'border-cyan-950 bg-cyan-950/5 hover:border-cyan-500/30',
          badge: 'bg-cyan-950/20 text-cyan-400 border-cyan-900/40',
          iconColor: 'text-cyan-400',
          accentGlow: 'shadow-[0_0_15px_rgba(34,211,238,0.05)]',
          buttonClass: 'bg-cyan-950/40 hover:bg-cyan-600 text-cyan-400 hover:text-white border border-cyan-900 hover:border-transparent',
        };
      case 'runway':
        return {
          border: 'border-amber-950 bg-amber-950/5 hover:border-amber-500/30',
          badge: 'bg-amber-950/20 text-amber-400 border-amber-900/40',
          iconColor: 'text-amber-400',
          accentGlow: 'shadow-[0_0_15px_rgba(245,158,11,0.05)]',
          buttonClass: 'bg-amber-950/40 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-900 hover:border-transparent',
        };
      default:
        return {
          border: 'border-zinc-900 bg-zinc-900/10 hover:border-zinc-700/50',
          badge: 'bg-zinc-900 text-zinc-400 border-zinc-800',
          iconColor: 'text-zinc-500',
          accentGlow: '',
          buttonClass: 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-850 hover:border-zinc-750',
        };
    }
  };

  const getLedDetails = (category: string) => {
    switch (category) {
      case 'critical':
        return {
          bgGradient: 'linear-gradient(90deg, #ff8080 0%, #ef4444 50%, #b91c1c 100%)',
          textClass: 'text-red-400 font-bold tracking-wider',
          borderColor: 'border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.5)]',
          glowShadow: '0 0 14px 4px rgba(239, 68, 68, 0.95), 0 0 28px 8px rgba(239, 68, 68, 0.5), inset 0 0 6px #ffc7c7',
          label: '🚨 NEEDS ATTENTION // DO THIS FIRST',
          pulseDuration: 0.6,
          opacityRange: [0.15, 1.0, 0.15],
        };
      case 'monetization':
      case 'runway':
        return {
          bgGradient: 'linear-gradient(90deg, #ffb070 0%, #f97316 50%, #c2410c 100%)',
          textClass: 'text-orange-400 font-bold tracking-wider',
          borderColor: 'border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.4)]',
          glowShadow: '0 0 12px 3px rgba(249, 115, 22, 0.9), 0 0 24px 6px rgba(249, 115, 22, 0.45), inset 0 0 5px #ffedd5',
          label: '🔥 GROWTH OPPORTUNITY // REVIEW NEXT',
          pulseDuration: 1.1,
          opacityRange: [0.25, 1.0, 0.25],
        };
      case 'production':
        return {
          bgGradient: 'linear-gradient(90deg, #a7f3d0 0%, #10b981 50%, #047857 100%)',
          textClass: 'text-emerald-400 font-bold tracking-wider',
          borderColor: 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.4)]',
          glowShadow: '0 0 12px 3px rgba(16, 185, 129, 0.9), 0 0 24px 6px rgba(16, 185, 129, 0.45), inset 0 0 5px #d1fae5',
          label: '⚡ PRODUCTION TASK // READY TO MOVE',
          pulseDuration: 1.6,
          opacityRange: [0.3, 1.0, 0.3],
        };
      case 'maintenance':
      default:
        return {
          bgGradient: 'linear-gradient(90deg, #ffffff 0%, #cbd5e1 50%, #64748b 100%)',
          textClass: 'text-zinc-300 font-semibold tracking-wider',
          borderColor: 'border-zinc-500/50 shadow-[0_0_8px_rgba(255,255,255,0.3)]',
          glowShadow: '0 0 10px 2px rgba(255, 255, 255, 0.8), 0 0 20px 4px rgba(255, 255, 255, 0.35), inset 0 0 4px #ffffff',
          label: '⚙️ ROUTINE CHECK // WHEN YOU HAVE TIME',
          pulseDuration: 2.2,
          opacityRange: [0.4, 1.0, 0.4],
        };
    }
  };

  const getIntensityText = (mode: string) => {
    switch (mode) {
      case 'Relaxed': return 'RELAXED PACE // LIGHT TASK LOAD';
      case 'Balanced': return 'BALANCED PACE // NORMAL TASK LOAD';
      case 'Aggressive': return 'FOCUSED SPRINT // HIGH TASK LOAD';
      case 'War mode': return '🚨 DEADLINE SPRINT // ONLY ESSENTIAL TASKS';
      default: return 'PRIORITIZED NEXT ACTIONS';
    }
  };

  const getCategoryLabel = (category: string) => ({
    critical: 'top priority',
    production: 'production',
    monetization: 'revenue',
    runway: 'ideas',
    maintenance: 'routine check',
  }[category] || category);

  return (
    <div className="space-y-3 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-400 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-200">
            YOUR VERIFIED NEXT ACTIONS
          </h2>
        </div>
        <span className="text-[9px] text-zinc-500 uppercase font-semibold">
          {getIntensityText(goals.intensityMode)}
        </span>
      </div>

      <div className={`grid grid-cols-1 ${activeSteps.length > 1 ? 'md:grid-cols-2' : ''} ${activeSteps.length > 2 ? 'xl:grid-cols-3' : ''} gap-4`}>
          {activeSteps.map((step, idx) => {
            const colors = getCardColorTheme(step.category);
            const isCompleted = checkedIds[step.id];

            return (
              <motion.div
                key={step.id}
                layout
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className={`border rounded-lg p-4 flex flex-col justify-between space-y-4 transition-all duration-300 relative overflow-hidden group ${colors.border} ${colors.accentGlow}`}
              >
                {/* Micro Scanline Overlay */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_4px] opacity-10" />

                {/* Card Top Block */}
                <div className="space-y-3 relative z-10">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[8px] border px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${colors.badge}`}>
                      ACTION 0{idx + 1} // {getCategoryLabel(step.category)}
                    </span>
                    {step.channelContext && (
                      <span className="text-[8px] text-zinc-500 font-bold uppercase">
                        {step.channelContext}
                      </span>
                    )}
                  </div>

                  {/* Dynamic Long Dash LED Indicator */}
                  {(() => {
                    const led = getLedDetails(step.category);
                    return (
                      <div className="flex items-center gap-3 bg-zinc-950/90 border border-zinc-900/80 px-2.5 py-1.5 rounded-md shadow-inner">
                        {/* Metallic Dash LED Housing - Removed overflow-hidden so the intense glow blooms out */}
                        <div className={`relative h-2.5 w-14 rounded border bg-black/90 flex items-center p-[1.5px] ${led.borderColor} shrink-0`}>
                          <motion.div 
                            animate={{ 
                              opacity: led.opacityRange,
                              scaleY: [0.92, 1.08, 0.92],
                            }}
                            transition={{ 
                              repeat: Infinity, 
                              duration: led.pulseDuration, 
                              ease: "easeInOut" 
                            }}
                            className="h-full w-full rounded-sm"
                            style={{
                              background: led.bgGradient,
                              boxShadow: led.glowShadow,
                            }}
                          />
                          {/* 3D Glass Specular Reflection Highlight Overlay */}
                          <div className="absolute inset-x-0.5 top-[1px] h-[1px] bg-gradient-to-r from-white/60 via-white/20 to-transparent rounded pointer-events-none z-10" />
                          <div className="absolute inset-0 rounded-[2px] border border-white/5 pointer-events-none z-10" />
                        </div>
                        {/* Interactive Status Label */}
                        <span className={`text-[8px] font-mono tracking-widest uppercase transition-colors duration-300 ${led.textClass}`}>
                          {led.label}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2.5">
                      {/* Live Interactive Checkbox */}
                      <button
                        onClick={() => handleToggleCheck(step)}
                        className={`mt-0.5 transition-all p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 ${colors.iconColor}`}
                        title="Complete this action and update the dashboard"
                      >
                        {isCompleted ? (
                          <CheckSquare className="h-4.5 w-4.5 text-emerald-400 animate-bounce" />
                        ) : (
                          <Square className="h-4.5 w-4.5 hover:scale-110 transition-transform" />
                        )}
                      </button>

                      <h3 className="text-xs font-bold text-zinc-150 uppercase tracking-wide leading-tight group-hover:text-white transition-colors">
                        {step.title}
                      </h3>
                    </div>

                    <p className="text-[10px] text-zinc-400 leading-relaxed font-mono pl-7">
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Card Impact and Trigger Section */}
                <div className="space-y-3 pt-2.5 border-t border-zinc-900/60 relative z-10 font-mono">
                  <div className="text-[9px] text-zinc-500 flex items-start gap-1 leading-tight">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500/70 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-zinc-400 uppercase">WHY IT MATTERS:</strong> {step.impact}
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleCheck(step)}
                    className={`w-full py-2 px-3 text-[9px] font-bold uppercase tracking-wider rounded transition-all duration-300 flex items-center justify-center gap-1.5 ${colors.buttonClass}`}
                  >
                    <span>{step.buttonLabel}</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                {/* Animated complete overlay scanline */}
                {completedAnimationId === step.id && (
                  <motion.div
                    initial={{ y: '-100%' }}
                    animate={{ y: '100%' }}
                    className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent pointer-events-none z-20"
                    transition={{ duration: 0.4 }}
                  />
                )}
              </motion.div>
            );
          })}
        {activeSteps.length === 0 && (
          <div className="border border-zinc-900 bg-zinc-950/60 rounded-lg p-8 text-center col-span-full">
            <CheckSquare className="h-6 w-6 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-xs font-bold text-zinc-200">NO VERIFIED ACTION TO RECOMMEND</h3>
            <p className="text-[10px] text-zinc-500 mt-2 max-w-xl mx-auto leading-relaxed">There is not enough recorded evidence for a distinct next action. Add or update a video stage, status, schedule, or product opportunity and this board will recalculate.</p>
          </div>
        )}
      </div>
    </div>
  );
}

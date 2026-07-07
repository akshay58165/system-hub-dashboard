import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, 
  Globe, 
  Clock, 
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GitBranch, 
  Server, 
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  ArrowUpRight,
  Youtube,
  User,
  Activity,
  Pencil,
  Trash2,
  RotateCcw,
  ArrowUpDown,
  Shield,
  Bookmark,
  Coffee,
  Play,
  Pause,
  ThumbsUp,
  X
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart as RechartLine, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { Topic, TopicActivity, SystemEvent, CycleGoal, WorkdaySession } from '../types';
import { getTopicCurrentWorkflow, getTopicWorkflowState } from '../services/topicWorkflow';
import { useDismissOnOutsideClick } from '../hooks/useDismissOnOutsideClick';
import { useTaskTimers } from '../contexts/TaskTimerContext';

interface VercelViewProps {
  projects: any[]; // Kept for interface compatibility in App.tsx
  onAddEvent: (evt: SystemEvent) => void;
  onUpdateProject: (projectId: string, updatedProject: any) => void;
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  activities: TopicActivity[];
  setActivities: React.Dispatch<React.SetStateAction<TopicActivity[]>>;
  setActiveTab?: (tab: 'overview' | 'topics' | 'progress' | 'actionhub' | 'logs' | 'score') => void;
  cycleGoals: CycleGoal | null;
  workdaySession: WorkdaySession | null;
  setWorkdaySession?: React.Dispatch<React.SetStateAction<WorkdaySession | null>>;
  onEditTopic?: (topic: Topic) => void;
  onDeleteContentItem?: (itemId: string, label: string, topicName?: string) => void;
}

type TopicSortMode = 'goals' | 'due-date' | 'last-created' | 'level' | 'progress-most' | 'progress-least' | 'workload';

const topicSortLabels: Record<TopicSortMode, string> = {
  goals: "Today's goals first",
  'due-date': 'Due date / time',
  'last-created': 'Last created',
  level: 'Level: H to L',
  'progress-most': 'Most work left',
  'progress-least': 'Least work left',
  workload: 'Workload priority'
};

const topicDueTime = (topic: Topic) => {
  if (!topic.dueDate) return Number.MAX_SAFE_INTEGER;
  const datePart = topic.dueDate.split('T')[0];
  const embeddedTime = topic.dueDate.includes('T') ? topic.dueDate.split('T')[1]?.slice(0, 5) : '';
  const parsed = new Date(`${datePart}T${topic.scheduledTime || embeddedTime || '23:59'}:00`).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const topicLevel = (topic: Topic) => {
  const parsed = Number.parseFloat((topic.revenueLevel || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : -1;
};

const workRemaining = (topic: Topic) => ({ topic: 6, hooked: 5, scripted: 4, shot: 3, edited: 2, scheduled: 1, posted: 0 } as const)[topic.status];

const workloadScore = (topic: Topic) => {
  const due = topicDueTime(topic);
  const remaining = workRemaining(topic);
  if (due === Number.MAX_SAFE_INTEGER) return remaining;
  const hours = (due - Date.now()) / 36e5;
  if (hours <= 0) return 1_000_000 + remaining * 10_000 + Math.min(9_999, Math.abs(hours));
  return (remaining * 100_000) / Math.max(1, hours);
};

type WorkflowStage = 'hook' | 'script' | 'shoot' | 'edit' | 'schedule' | 'post';
type WorkflowState = 'pending' | 'in-progress' | 'completed';

const WORKFLOW_LABELS: Record<WorkflowStage, Record<WorkflowState, string>> = {
  hook: { pending: 'Hook', 'in-progress': 'Hooking', completed: 'Hooked' },
  script: { pending: 'Script', 'in-progress': 'Scripting', completed: 'Scripted' },
  shoot: { pending: 'Shoot', 'in-progress': 'Shooting', completed: 'Shot' },
  edit: { pending: 'Edit', 'in-progress': 'Editing', completed: 'Edited' },
  schedule: { pending: 'Schedule', 'in-progress': 'Scheduling', completed: 'Scheduled' },
  post: { pending: 'Post', 'in-progress': 'Posting', completed: 'Posted' },
};

export function WorkflowStatusButton({
  stage, state, onQuickPress, onLongPress, onReset, labelOverride, disabled, blinkClass, controlId, isGoalStage, tapResetsCompleted }: {
  stage: WorkflowStage;
  state: WorkflowState;
  onQuickPress: () => void;
  onLongPress: () => void;
  onReset: () => void;
  labelOverride?: string;
  disabled?: boolean;
  blinkClass?: string;
  controlId?: string;
  isGoalStage?: boolean;
  tapResetsCompleted?: boolean;
}) {
  const longPressFired = useRef(false);
  const [isHolding, setIsHolding] = useState(false);

  const startPress = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.stopPropagation();
    longPressFired.current = false;
    setIsHolding(true);
  };

  const finishPress = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    event.stopPropagation();
    const wasLongPress = longPressFired.current;
    setIsHolding(false);
    if (!wasLongPress) {
      if (state === 'completed') {
        if (tapResetsCompleted) onReset();
      } else {
        onQuickPress();
      }
    }
  };

  const handleAnimationEnd = (event: React.AnimationEvent) => {
    if (event.animationName === 'workflow-hold-border' || event.animationName === 'workflow-reset-border') {
      longPressFired.current = true;
      setIsHolding(false);
      if (state === 'completed') onReset();
      else onLongPress();
    }
  };

  return (
    <button
      id={controlId}
      type="button"
      disabled={disabled}
      onPointerDown={startPress}
      onPointerUp={finishPress}
      onPointerCancel={() => setIsHolding(false)}
      onPointerLeave={() => setIsHolding(false)}
      onContextMenu={(event) => event.preventDefault()}
      onAnimationEnd={handleAnimationEnd}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (state !== 'completed') onQuickPress();
        }
      }}
      title={disabled ? undefined : state === 'completed'
        ? 'Hold 3 seconds to reset this stage.'
        : 'Quick click: mark in progress. Hold 1 second to mark complete.'}
      className={`relative overflow-hidden px-2 py-0.5 rounded text-[8px] font-semibold border transition select-none touch-none ${
        disabled ? 'cursor-default opacity-85' : 'cursor-pointer'
      } ${
        state === 'pending'
          ? 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-neutral-200'
          : state === 'in-progress'
            ? 'workflow-in-progress bg-emerald-600 border-emerald-400 text-white ring-1 ring-white/20'
            : 'workflow-completed bg-neutral-900/25 border-neutral-800/50 text-neutral-500 opacity-55'
      } ${blinkClass || ''} ${isGoalStage ? 'goal-stage-highlight' : ''}`}
    >
      {isHolding && !disabled && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect
            className={state === 'completed' ? 'workflow-reset-stroke' : 'workflow-hold-stroke'}
            x="1"
            y="1"
            width="98"
            height="30"
            rx="5"
            pathLength="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      )}
      <span className="relative">{labelOverride || WORKFLOW_LABELS[stage][state]}</span>
    </button>
  );
}

export default function VercelView({ 
  onAddEvent, 
  topics, 
  setTopics,
  activities,
  setActivities,
  setActiveTab,
  cycleGoals,
  workdaySession,
  setWorkdaySession,
  onEditTopic,
  onDeleteContentItem
}: VercelViewProps) {
  const taskTimer = useTaskTimers();
  const [selectedChannel, setSelectedChannel] = useState<'All' | 'LearnDriven' | 'DecodeWorthy' | 'Later'>('All');
  const [topicSortOrder, setTopicSortOrder] = useState<TopicSortMode>('due-date');
  const [isTopicSortOpen, setIsTopicSortOpen] = useState(false);
  // Auto-switch to "Today's goals first" when a workday session has goals,
  // and back to "Due date" when it ends. The ref remembers the last auto-set
  // value so a user's manual change is not clobbered on re-render.
  const lastAutoSortRef = useRef<TopicSortMode | null>(null);
  useEffect(() => {
    const hasSessionGoals = Boolean(workdaySession && (workdaySession.goals || []).length);
    const target: TopicSortMode = hasSessionGoals ? 'goals' : 'due-date';
    if (lastAutoSortRef.current === target) return;
    // Only override if the current sort matches the previous auto-set value
    // (i.e. the user hasn't manually chosen something else since).
    if (lastAutoSortRef.current === null || topicSortOrder === lastAutoSortRef.current) {
      setTopicSortOrder(target);
    }
    lastAutoSortRef.current = target;
  }, [workdaySession?.startedAt, (workdaySession?.goals || []).length]);
  const topicSortRef = useDismissOnOutsideClick<HTMLDivElement>(
    isTopicSortOpen,
    true,
    () => setIsTopicSortOpen(false)
  );
  const [breakPrompt, setBreakPrompt] = useState<{ topicName: string; stage: string; durationMs: number } | null>(null);
  // Set when a stage is clicked while the workday timer is paused: offer to
  // resume so the task is counted in the session/goal, or just change the stage.
  const [resumePrompt, setResumePrompt] = useState<{ topic: Topic; stage: WorkflowStage } | null>(null);
  const [schedulingTopicId, setSchedulingTopicId] = useState<string | null>(null);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [editCalendarOpen, setEditCalendarOpen] = useState(false);
  const [editCalendarMonth, setEditCalendarMonth] = useState(() => ({ month: new Date().getMonth(), year: new Date().getFullYear() }));
  // Outside-click only dismisses this modal while it still exactly matches
  // the real topic (i.e. nothing has actually been edited yet) — the
  // instant a field changes, only the explicit X/Cancel controls can close it.
  const editingTopicIsUnchanged = editingTopic
    ? JSON.stringify(editingTopic) === JSON.stringify(topics.find(t => t.id === editingTopic.id))
    : true;
  const editTopicModalRef = useDismissOnOutsideClick<HTMLFormElement>(
    Boolean(editingTopic),
    editingTopicIsUnchanged,
    () => setEditingTopic(null)
  );

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Automatic transition: scheduled -> posted when current time reaches/passes scheduled time
  useEffect(() => {
    const scheduledTopicsToPost = topics.filter(t => 
      t.status === 'scheduled' && 
      !t.autoPostPaused &&
      t.dueDate && 
      new Date(t.dueDate) <= now
    );

    if (scheduledTopicsToPost.length > 0) {
      setTopics(prev => prev.map(t => {
        const matching = scheduledTopicsToPost.find(p => p.id === t.id);
        if (matching) {
          return {
            ...t,
            status: 'posted',
            inProgress: true,
            workflowStatuses: {
              ...t.workflowStatuses,
              schedule: 'completed',
              post: 'completed'
            },
            postedAt: new Date().toISOString(),
            autoPostPaused: false,
            lastUpdated: new Date().toISOString()
          };
        }
        return t;
      }));

      scheduledTopicsToPost.forEach(t => {
        onAddEvent({
          id: `evt-auto-posted-${t.id}-${Date.now()}`,
          source: 'system',
          type: 'success',
          message: `Workflow Engine: "${t.name}" scheduled release time reached. Auto-marked as Posted (${t.channel}).`,
          timestamp: new Date().toISOString()
        });

        setActivities(prev => [{
          id: `act-auto-posted-${t.id}-${Date.now()}`,
          topicName: t.name,
          channel: t.channel,
          action: `Auto-Posted: Release schedule reached for ${t.name}`,
          author: 'system',
          timestamp: new Date().toISOString()
        }, ...prev]);
      });
    }
  }, [now, topics, setTopics, onAddEvent, setActivities]);

  const getWorkflowState = getTopicWorkflowState;

  // Overdue tiers: a missed deadline shouldn't scream the same red countdown
  // forever with no way out. 0-2 days overdue still reads as an urgent
  // "breached" state (same as before); past that it becomes a "stuck" state
  // that demands an explicit decision (reschedule / backlog / block / drop)
  // instead of open-ended alarm fatigue.
  const getUrgencyInfo = (topic: Topic) => {
    const scheduleComplete = getWorkflowState(topic, 'schedule') === 'completed' || topic.status === 'scheduled' || topic.status === 'posted';
    if (!topic.dueDate || scheduleComplete || topic.blockedReason) return null;

    const dueTime = topicDueTime(topic);
    const differenceMs = dueTime - now.getTime();
    const dueDay = new Date(dueTime);
    dueDay.setHours(0, 0, 0, 0);
    const currentDay = new Date(now);
    currentDay.setHours(0, 0, 0, 0);
    const calendarDaysLeft = Math.round((dueDay.getTime() - currentDay.getTime()) / 86400000);
    const absoluteSeconds = Math.max(0, Math.floor(Math.abs(differenceMs) / 1000));
    const days = Math.floor(absoluteSeconds / 86400);
    const hours = Math.floor((absoluteSeconds % 86400) / 3600);
    const minutes = Math.floor((absoluteSeconds % 3600) / 60);
    const seconds = absoluteSeconds % 60;

    const clock = days > 0
      ? `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`
      : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const overdue = differenceMs <= 0;
    const daysOverdue = overdue ? Math.floor(-differenceMs / 86400000) : 0;
    const stuck = overdue && daysOverdue >= 2;
    const remaining = workRemaining(topic);
    const loadBoost = remaining >= 4 ? 0.82 : remaining >= 2 ? 0.92 : 1;
    const ledTone = overdue || calendarDaysLeft <= 1
      ? 'critical'
      : calendarDaysLeft === 2
        ? 'danger'
        : calendarDaysLeft === 3
          ? 'watch'
          : calendarDaysLeft < 7
            ? 'green'
            : 'blue';
    const ledSpeed = overdue || calendarDaysLeft <= 1
      ? `${Math.max(.38, .58 * loadBoost)}s`
      : calendarDaysLeft === 2
        ? `${.82 * loadBoost}s`
        : calendarDaysLeft === 3
          ? `${1.18 * loadBoost}s`
          : calendarDaysLeft < 7
            ? `${1.65 * loadBoost}s`
            : '0s';

    return {
      overdue,
      daysOverdue,
      stuck,
      calendarDaysLeft,
      fastBlink: differenceMs > 0 && differenceMs <= 24 * 60 * 60 * 1000,
      greenBlink: calendarDaysLeft >= 4 && calendarDaysLeft < 7,
      ledTone,
      ledSpeed,
      clock,
      message: overdue
        ? 'DEADLINE BREACHED - COMPLETE THE REMAINING STAGES NOW'
        : 'CRITICAL WINDOW - UTMOST ACTION REQUIRED',
    };
  };

  const getUrgencyPalette = (urgency: ReturnType<typeof getUrgencyInfo>) => {
    if (!urgency) {
      return {
        borderClass: 'border-neutral-800/70 bg-neutral-950/50',
        labelClass: 'text-neutral-400',
        clockClass: 'text-neutral-300',
        ledClass: 'text-neutral-500',
        style: {
          ['--emergency-rgb' as string]: '115 115 115',
          ['--emergency-core' as string]: '#737373',
          ['--emergency-soft' as string]: '115 115 115'
        }
      };
    }

    if (urgency.stuck) {
      return {
        borderClass: 'border-neutral-800/70 bg-neutral-950/50',
        labelClass: 'text-amber-300',
        clockClass: 'text-amber-200',
        ledClass: 'text-amber-400',
        style: {
          ['--emergency-rgb' as string]: '245 158 11',
          ['--emergency-core' as string]: '#f59e0b',
          ['--emergency-soft' as string]: '245 158 11'
        }
      };
    }

    if (urgency.overdue) {
      return {
        borderClass: 'border-neutral-800/70 bg-neutral-950/50',
        labelClass: 'text-[#ff6b80]',
        clockClass: 'text-[#ff6b80]',
        ledClass: 'text-[#ff6b80]',
        style: {
          ['--emergency-rgb' as string]: '255 107 128',
          ['--emergency-core' as string]: '#ff6b80',
          ['--emergency-soft' as string]: '255 107 128'
        }
      };
    }

    if (urgency.calendarDaysLeft <= 1) {
      return {
        borderClass: 'border-neutral-800/70 bg-neutral-950/50',
        labelClass: 'text-[#ff5a70]',
        clockClass: 'text-[#ff5a70]',
        ledClass: 'text-[#ff5a70]',
        style: {
          ['--emergency-rgb' as string]: '255 90 112',
          ['--emergency-core' as string]: '#ff5a70',
          ['--emergency-soft' as string]: '255 90 112'
        }
      };
    }

    if (urgency.calendarDaysLeft === 2) {
      return {
        borderClass: 'border-neutral-800/70 bg-neutral-950/50',
        labelClass: 'text-orange-400',
        clockClass: 'text-orange-300',
        ledClass: 'text-orange-400',
        style: {
          ['--emergency-rgb' as string]: '249 115 22',
          ['--emergency-core' as string]: '#f97316',
          ['--emergency-soft' as string]: '249 115 22'
        }
      };
    }

    if (urgency.calendarDaysLeft >= 7) {
      return {
        borderClass: 'border-neutral-800/70 bg-neutral-950/50',
        labelClass: 'text-blue-400',
        clockClass: 'text-blue-300',
        ledClass: 'text-blue-400',
        style: {
          ['--emergency-rgb' as string]: '59 130 246',
          ['--emergency-core' as string]: '#3b82f6',
          ['--emergency-soft' as string]: '59 130 246'
        }
      };
    }

    if (urgency.calendarDaysLeft >= 4) {
      return {
        borderClass: 'border-neutral-800/70 bg-neutral-950/50',
        labelClass: 'text-green-400',
        clockClass: 'text-green-300',
        ledClass: 'text-green-400',
        style: {
          ['--emergency-rgb' as string]: '34 197 94',
          ['--emergency-core' as string]: '#22c55e',
          ['--emergency-soft' as string]: '34 197 94'
        }
      };
    }

    return {
      borderClass: 'border-neutral-800/70 bg-neutral-950/50',
      labelClass: 'text-yellow-400',
      clockClass: 'text-yellow-300',
      ledClass: 'text-yellow-400',
      style: {
        ['--emergency-rgb' as string]: '234 179 8',
        ['--emergency-core' as string]: '#eab308',
        ['--emergency-soft' as string]: '234 179 8'
      }
    };
  };

  const handleClearDeadline = (topic: Topic) => {
    setTopics(prev => prev.map(t => t.id === topic.id ? { ...t, dueDate: null, lastUpdated: new Date().toISOString() } : t));
    setActivities(prev => [{
      id: `act-backlog-${Date.now()}`,
      topicName: topic.name,
      channel: topic.channel,
      action: `Moved to backlog (deadline cleared, was overdue)`,
      author: 'typeakshay',
      timestamp: new Date().toISOString()
    }, ...prev]);
  };

  const handleMarkBlocked = (topic: Topic) => {
    const reason = window.prompt(`Why is "${topic.name}" stuck? (This clears the overdue alarm and shows the reason instead.)`, topic.blockedReason || '');
    if (reason === null) return;
    const trimmed = reason.trim();
    if (!trimmed) return;
    setTopics(prev => prev.map(t => t.id === topic.id ? { ...t, blockedReason: trimmed, lastUpdated: new Date().toISOString() } : t));
    setActivities(prev => [{
      id: `act-blocked-${Date.now()}`,
      topicName: topic.name,
      channel: topic.channel,
      action: `Marked blocked: ${trimmed}`,
      author: 'typeakshay',
      timestamp: new Date().toISOString()
    }, ...prev]);
  };

  const handleUnblock = (topic: Topic) => {
    setTopics(prev => prev.map(t => t.id === topic.id ? { ...t, blockedReason: undefined, lastUpdated: new Date().toISOString() } : t));
    setActivities(prev => [{
      id: `act-unblocked-${Date.now()}`,
      topicName: topic.name,
      channel: topic.channel,
      action: `Unblocked`,
      author: 'typeakshay',
      timestamp: new Date().toISOString()
    }, ...prev]);
  };

  const handleLowerPriority = (topic: Topic) => {
    setTopics(prev => prev.map(t => t.id === topic.id ? { ...t, priority: 5, lastUpdated: new Date().toISOString() } : t));
    setActivities(prev => [{
      id: `act-deprioritized-${Date.now()}`,
      topicName: topic.name,
      channel: topic.channel,
      action: `Deprioritized (was overdue, lowered to priority 5)`,
      author: 'typeakshay',
      timestamp: new Date().toISOString()
    }, ...prev]);
  };

  const handleTransitionToStage = (topic: Topic, targetStage: WorkflowStage, targetState: WorkflowState) => {
    const completedStatusByStage: Record<WorkflowStage, Topic['status']> = {
      hook: 'hooked', script: 'scripted', shoot: 'shot', edit: 'edited', schedule: 'scheduled', post: 'posted'
    };

    const stagesOrder: WorkflowStage[] = ['hook', 'script', 'shoot', 'edit', 'schedule', 'post'];
    const targetIdx = stagesOrder.indexOf(targetStage);

    setTopics(prev => prev.map(item => {
      if (item.id !== topic.id) return item;

      const updatedStatuses: Record<string, WorkflowState> = { ...item.workflowStatuses };
      
      stagesOrder.forEach((stg, idx) => {
        if (idx < targetIdx) {
          updatedStatuses[stg] = 'completed';
        } else if (idx === targetIdx) {
          updatedStatuses[stg] = targetState;
        } else {
          delete updatedStatuses[stg];
        }
      });

      let newStatus: Topic['status'] = 'topic';
      if (targetState === 'completed') {
        newStatus = completedStatusByStage[targetStage];
      } else if (targetIdx > 0) {
        newStatus = completedStatusByStage[stagesOrder[targetIdx - 1]];
      }

      const updatedTopic: Topic = {
        ...item,
        status: newStatus,
        inProgress: true,
        workflowStatuses: updatedStatuses,
        lastUpdated: new Date().toISOString()
      };

      return updatedTopic;
    }));

    const previousLabel = getTopicCurrentWorkflow(topic).label;
    const label = WORKFLOW_LABELS[targetStage][targetState];
    setActivities(prev => [{
      id: `act-workflow-${targetStage}-${Date.now()}`,
      topicName: topic.name,
      channel: topic.channel,
      action: `Changed workflow from ${previousLabel} to ${label}`,
      author: 'Akshay',
      timestamp: new Date().toISOString(),
    }, ...prev]);

    // Completing a stage that the user *explicitly* added as today's goal
    // still surfaces the break prompt. Starting a stage never auto-creates
    // a goal — goals are only what the user chose in the workday setup.
    if (workdaySession && targetState === 'completed') {
      const goalTargetMap: Record<string, 'hooked' | 'scripted' | 'shot' | 'edited' | 'scheduled' | 'posted'> = {
        hook: 'hooked', script: 'scripted', shoot: 'shot', edit: 'edited', schedule: 'scheduled', post: 'posted'
      };
      const goalTarget = goalTargetMap[targetStage];
      const matchingGoal = (workdaySession.goals || []).find(
        g => g.topicId === topic.id && g.targetStatus === goalTarget
      );
      if (matchingGoal) {
        const durationMs = Date.now() - new Date(matchingGoal.addedAt).getTime();
        setBreakPrompt({ topicName: topic.name, stage: targetStage, durationMs });
      }
    }
  };

  const completeSchedule = (topic: Topic) => {
    const defaultTime = topic.channel === 'LearnDriven' ? '21:09' : '19:07';
    const finalDate = schedulingTopicId === topic.id && schedDate
      ? schedDate
      : (topic.dueDate?.split('T')[0] || new Date().toISOString().split('T')[0]);
    const finalTime = schedulingTopicId === topic.id && schedTime
      ? schedTime
      : (topic.scheduledTime || defaultTime);
    const finalIso = new Date(`${finalDate}T${finalTime}:00`).toISOString();

    setTopics(prev => prev.map(item => item.id === topic.id ? {
      ...item,
      status: 'scheduled',
      inProgress: true,
      dueDate: finalIso,
      scheduledTime: finalTime,
      workflowStatuses: {
        ...item.workflowStatuses,
        script: 'completed',
        shoot: 'completed',
        edit: 'completed',
        schedule: 'completed',
        post: 'pending',
      },
      autoPostPaused: false,
      lastUpdated: new Date().toISOString(),
    } : item));
    setActivities(prev => [{
      id: `act-schedule-complete-${Date.now()}`,
      topicName: topic.name,
      channel: topic.channel,
      action: `Scheduled video release for ${finalDate} at ${finalTime}`,
      author: 'typeakshay',
      timestamp: new Date().toISOString()
    }, ...prev]);
    setSchedulingTopicId(null);
  };

  const resetWorkflowStage = (topic: Topic, targetStage: WorkflowStage) => {
    const stagesOrder: WorkflowStage[] = ['hook', 'script', 'shoot', 'edit', 'schedule', 'post'];
    const completedStatusByStage: Record<WorkflowStage, Topic['status']> = {
      hook: 'hooked', script: 'scripted', shoot: 'shot', edit: 'edited', schedule: 'scheduled', post: 'posted'
    };
    const targetIndex = stagesOrder.indexOf(targetStage);

    setTopics(prev => prev.map(item => {
      if (item.id !== topic.id) return item;
      const workflowStatuses = { ...item.workflowStatuses };
      stagesOrder.forEach((stage, index) => {
        if (index >= targetIndex) delete workflowStatuses[stage];
      });
      return {
        ...item,
        status: targetIndex === 0 ? 'topic' : completedStatusByStage[stagesOrder[targetIndex - 1]],
        workflowStatuses,
        postedAt: undefined,
        autoPostPaused: targetStage === 'post',
        lastUpdated: new Date().toISOString(),
      };
    }));
    setActivities(prev => [{
      id: `act-stage-reset-${targetStage}-${Date.now()}`,
      topicName: topic.name,
      channel: topic.channel,
      action: `Reset stage from ${WORKFLOW_LABELS[targetStage][getTopicWorkflowState(topic, targetStage)]}: ${topic.name}`,
      author: 'typeakshay',
      timestamp: new Date().toISOString()
    }, ...prev]);
    if (targetStage === 'schedule' || targetStage === 'post') setSchedulingTopicId(null);
  };

  const saveEditedTopic = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTopic?.name.trim()) return;
    const trimmedName = editingTopic.name.trim();
    const original = topics.find(t => t.id === editingTopic.id);
    setTopics(prev => prev.map(topic => topic.id === editingTopic.id
      ? { ...editingTopic, name: trimmedName, lastUpdated: new Date().toISOString() }
      : topic));

    const changedFields: string[] = [];
    if (original) {
      if (original.name !== trimmedName) changedFields.push('name');
      if (original.description !== editingTopic.description) changedFields.push('description');
      if (original.channel !== editingTopic.channel) changedFields.push('channel');
      if (original.priority !== editingTopic.priority) changedFields.push('priority');
      if (original.dueDate !== editingTopic.dueDate) changedFields.push('due date');
      if (original.scheduledTime !== editingTopic.scheduledTime) changedFields.push('scheduled time');
    }
    if (changedFields.length > 0) {
      setActivities(prev => [{
        id: `act-edit-${Date.now()}`,
        topicName: trimmedName,
        channel: editingTopic.channel,
        action: `Edited topic (${changedFields.join(', ')})`,
        author: 'typeakshay',
        timestamp: new Date().toISOString()
      }, ...prev]);
    }
    setEditingTopic(null);
  };

  const deleteTopic = (topic: Topic) => {
    onDeleteContentItem?.(topic.id, topic.name, topic.name);
  };

  const toggleSavedForLater = (topic: Topic) => {
    const savedForLater = !topic.savedForLater;
    setTopics(prev => prev.map(item => item.id === topic.id ? {
      ...item,
      savedForLater,
      lastUpdated: new Date().toISOString()
    } : item));
    setActivities(prev => [{
      id: `act-later-${topic.id}-${Date.now()}`,
      topicName: topic.name,
      channel: topic.channel,
      action: savedForLater ? 'Saved topic for later' : 'Restored topic from Later',
      author: 'typeakshay',
      timestamp: new Date().toISOString()
    }, ...prev]);
  };

  const resetTopicWorkflow = (topic: Topic) => {
    setTopics(prev => prev.map(item => item.id === topic.id ? {
      ...item,
      status: 'topic',
      inProgress: false,
      workflowStatuses: {},
      scheduledTime: undefined,
      postedAt: undefined,
      dueDate: null,
      lastUpdated: new Date().toISOString(),
    } : item));
    setActivities(prev => [{
      id: `act-workflow-reset-${Date.now()}`,
      topicName: topic.name,
      channel: topic.channel,
      action: `Reset entire workflow back to Topic stage`,
      author: 'typeakshay',
      timestamp: new Date().toISOString()
    }, ...prev]);
    setSchedulingTopicId(current => current === topic.id ? null : current);
  };

  // Filtered topics
  // Scheduled/posted topics move to the "Scheduled & Completed Video Ledger"
  // section below, so exclude them from the main topic-controls list.
  const filteredTopics = useMemo(() => {
    return topics
      .filter(t => {
        const hasActiveTimer = taskTimer?.timers.some(timer => timer.topicId === t.id && (timer.status === 'running' || timer.status === 'paused')) ?? false;
        if (hasActiveTimer) return true;
        
        if (selectedChannel === 'Later') return Boolean(t.savedForLater);
        
        return !t.savedForLater
          && (selectedChannel === 'All' || t.channel === selectedChannel)
          && t.status !== 'scheduled'
          && t.status !== 'posted';
      })
      .sort((a, b) => {
        if (topicSortOrder === 'goals') {
          const goalIds = new Set((workdaySession?.goals || []).map(g => g.topicId));
          const aGoal = goalIds.has(a.id) ? 0 : 1;
          const bGoal = goalIds.has(b.id) ? 0 : 1;
          return aGoal - bGoal || topicDueTime(a) - topicDueTime(b) || new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
        }
        if (topicSortOrder === 'due-date') return topicDueTime(a) - topicDueTime(b) || new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
        if (topicSortOrder === 'last-created') return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
        if (topicSortOrder === 'level') return topicLevel(b) - topicLevel(a) || topicDueTime(a) - topicDueTime(b);
        if (topicSortOrder === 'progress-most') return workRemaining(b) - workRemaining(a) || topicDueTime(a) - topicDueTime(b);
        if (topicSortOrder === 'progress-least') return workRemaining(a) - workRemaining(b) || topicDueTime(a) - topicDueTime(b);
        return workloadScore(b) - workloadScore(a) || topicDueTime(a) - topicDueTime(b);
      });
  }, [topics, selectedChannel, topicSortOrder, workdaySession?.goals]);

  // Next upload topic details (nearest future scheduled video)
  const nextUpload = useMemo(() => {
    const today = new Date();
    const scheduled = filteredTopics
      .filter(t => t.status === 'scheduled' && t.dueDate && new Date(t.dueDate) >= today)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
    return scheduled[0]?.name || 'No uploads scheduled';
  }, [filteredTopics]);

  // Last workflow update text
  const lastWorkflowUpdate = useMemo(() => {
    const subsetActivities = activities.filter(a => selectedChannel === 'All' || a.channel === selectedChannel);
    if (subsetActivities.length === 0) return 'Never';
    const dates = subsetActivities.map(a => new Date(a.timestamp).getTime());
    const latestTime = new Date(Math.max(...dates));
    
    // Relative time formatting
    const seconds = Math.floor((new Date().getTime() - latestTime.getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return latestTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, [activities, selectedChannel]);

  // Calculate buffer safety days
  const bufferDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduledFuture = filteredTopics.filter(t => 
      t.status === 'scheduled' && 
      t.dueDate &&
      new Date(t.dueDate) > today
    );
    const uniqueFutureDays = new Set(scheduledFuture.map(t => {
      const d = new Date(t.dueDate!);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    }));
    return uniqueFutureDays.size;
  }, [filteredTopics]);

  // Calculate weekly production velocity (published & scheduled)
  const monthlyScheduledCompletedCount = useMemo(() => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    
    return filteredTopics.filter(t => 
      t.dueDate && 
      new Date(t.dueDate) >= startOfMonth && 
      new Date(t.dueDate) <= endOfMonth &&
      (t.status === 'scheduled' || t.status === 'edited')
    ).length;
  }, [filteredTopics]);

  // Graph Data: Last 7 calendar days topics created vs videos scheduled
  const graphData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const dateObj = new Date(today);
      dateObj.setDate(today.getDate() - i);
      const dateStr = dateObj.toISOString().split('T')[0];
      const dateLabel = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });

      // Topics created on this day
      const added = filteredTopics.filter(t => 
        t.createdDate && t.createdDate.split('T')[0] === dateStr
      ).length;

      // Videos scheduled on this day
      const scheduled = filteredTopics.filter(t => 
        t.status === 'scheduled' && t.dueDate && t.dueDate.split('T')[0] === dateStr
      ).length;

      data.push({
        date: dateLabel,
        added,
        scheduled
      });
    }
    return data;
  }, [filteredTopics]);

  // Recent transitions / logs formatted like deployments
  const recentHistory = useMemo(() => {
    const subsetActivities = activities
      .filter(a => selectedChannel === 'All' || a.channel === selectedChannel)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return subsetActivities.slice(0, 5);
  }, [activities, selectedChannel]);

  // Content Lane Velocities (equivalent to serverless APIs)
  const laneVelocities = useMemo(() => {
    const isShort = (t: Topic) => {
      return (
        (t.revenueLevel && ['Lvl 1', 'Lvl 2', 'Lvl 3', 'Lvl 4'].includes(t.revenueLevel)) ||
        t.name.toLowerCase().includes('short') ||
        t.description.toLowerCase().includes('short')
      );
    };

    const isLong = (t: Topic) => {
      return (
        (t.revenueLevel && ['Lvl 6', 'Lvl 7', 'Lvl 8', 'Lvl 9', 'Lvl 20'].includes(t.revenueLevel)) ||
        t.name.toLowerCase().includes('long') ||
        t.description.toLowerCase().includes('long')
      );
    };

    const isMembers = (t: Topic) => {
      return (
        (t.revenueLevel && t.revenueLevel === 'Lvl 5') ||
        t.name.toLowerCase().includes('member') ||
        t.description.toLowerCase().includes('member')
      );
    };

    const lanes = [
      {
        id: 'lane-shorts',
        path: '/shorts',
        filter: isShort,
        applicable: true
      },
      {
        id: 'lane-long',
        path: '/long-videos',
        filter: isLong,
        applicable: selectedChannel !== 'DecodeWorthy'
      },
      {
        id: 'lane-members',
        path: '/members-only',
        filter: isMembers,
        applicable: selectedChannel !== 'DecodeWorthy'
      }
    ];

    return lanes
      .filter(l => l.applicable)
      .map(lane => {
        const laneTopics = filteredTopics.filter(lane.filter);
        const totalCount = laneTopics.length;
        
        // Gaps: Topics due within next 2 days that are not scheduled/edited
        const today = new Date();
        const twoDaysFromNow = new Date();
        twoDaysFromNow.setDate(today.getDate() + 2);
        
        const gapsCount = laneTopics.filter(t => 
          t.status !== 'scheduled' && 
          t.status !== 'edited' && 
          t.dueDate && 
          new Date(t.dueDate) >= today && 
          new Date(t.dueDate) <= twoDaysFromNow
        ).length;

        // Latency: Average days between createdDate and dueDate
        let avgLeadDays = 0;
        const validDates = laneTopics.filter(t => t.dueDate && t.createdDate);
        if (validDates.length > 0) {
          const totalDays = validDates.reduce((sum, t) => {
            const diff = new Date(t.dueDate!).getTime() - new Date(t.createdDate).getTime();
            return sum + (diff / (1000 * 60 * 60 * 24));
          }, 0);
          avgLeadDays = Math.round((totalDays / validDates.length) * 10) / 10;
        }

        // Compute active cycle goals details
        let targetGoal: number | null = null;
        let scheduledInCycle = 0;

        if (cycleGoals) {
          const start = new Date(cycleGoals.startDate);
          const end = new Date(cycleGoals.endDate);
          
          // Count scheduled videos in cycle
          scheduledInCycle = laneTopics.filter(t => {
            if (t.status !== 'scheduled' || !t.dueDate) return false;
            const due = new Date(t.dueDate);
            return due >= start && due <= end;
          }).length;

          // Determine target goal based on lane ID
          if (lane.id === 'lane-shorts') {
            if (selectedChannel === 'All') {
              const ld = cycleGoals.learnDrivenShorts || 0;
              const dw = cycleGoals.decodeWorthyShorts || 0;
              targetGoal = (cycleGoals.learnDrivenShorts !== null || cycleGoals.decodeWorthyShorts !== null) ? (ld + dw) : null;
            } else if (selectedChannel === 'LearnDriven') {
              targetGoal = cycleGoals.learnDrivenShorts;
            } else {
              targetGoal = cycleGoals.decodeWorthyShorts;
            }
          } else if (lane.id === 'lane-long') {
            targetGoal = selectedChannel !== 'DecodeWorthy' ? cycleGoals.learnDrivenLong : null;
          } else if (lane.id === 'lane-members') {
            targetGoal = selectedChannel !== 'DecodeWorthy' ? cycleGoals.learnDrivenMembers : null;
          }
        }

        let bufferStatus: 'free-flow' | 'safe' | 'gaps' = 'free-flow';
        if (targetGoal !== null) {
          if (scheduledInCycle >= targetGoal) {
            bufferStatus = 'safe';
          } else {
            bufferStatus = 'gaps';
          }
        }

        return {
          id: lane.id,
          path: lane.path,
          invocations: totalCount,
          errors: gapsCount,
          latency: avgLeadDays > 0 ? `${avgLeadDays}d` : 'N/A',
          targetGoal,
          scheduledInCycle,
          bufferStatus
        };
      });
  }, [filteredTopics, selectedChannel, cycleGoals]);

  return (
    <div className="space-y-6">
      {/* Top header - matches the AI Insights design language */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-xl border border-neutral-900 bg-neutral-950 shadow-[0_4px_30px_rgba(0,0,0,0.3)]"
      >
        <motion.div
          className="absolute -top-16 -left-10 w-64 h-64 rounded-full bg-amber-500/8 blur-3xl pointer-events-none"
          animate={{ x: [0, 20, -10, 0], y: [0, -15, 10, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-8 w-8 rounded-lg bg-amber-950/30 border border-amber-900/40 text-amber-400">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-100 font-mono tracking-tight">Topic Workflow</h2>
              <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">Edit, delete, or correct the production status of every topic from one permanent workspace.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {(['All', 'LearnDriven', 'DecodeWorthy', 'Later'] as const).map(channel => (
              <button
                key={channel}
                onClick={() => setSelectedChannel(channel)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition ${
                  selectedChannel === channel
                    ? 'bg-neutral-800 border-neutral-600 text-white'
                    : 'bg-neutral-900 border-neutral-850 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
                }`}
              >
                {channel}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side (Production Control) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active project card */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold font-mono text-white tracking-tight flex items-center gap-2">
                  {selectedChannel === 'All' ? 'Consolidated Channels' : selectedChannel}
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-neutral-400 font-mono">
                  <Globe className="h-3.5 w-3.5 text-neutral-500" />
                  <span className="text-neutral-300">
                    Active Pipeline: {selectedChannel === 'All' ? 'All active streams' : `${selectedChannel} stream`}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Metric Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-neutral-900">
              <div className="p-3 bg-neutral-900 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Next Upload</span>
                <span className="text-xs font-bold font-mono text-white mt-1 block truncate" title={nextUpload}>
                  {nextUpload}
                </span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Pipeline Velocity</span>
                <span className="text-xs font-bold font-mono text-white mt-1 flex items-center gap-1">
                  <Activity className="h-3 w-3 text-blue-400" />
                  {monthlyScheduledCompletedCount} Videos/mo
                </span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Last Update</span>
                <span className="text-xs font-bold font-mono text-white mt-1 block">
                  {lastWorkflowUpdate}
                </span>
              </div>

              <div className="p-3 bg-neutral-900 rounded-lg">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Buffer Safety</span>
                <span className={`text-xs font-bold font-mono mt-1 block ${
                  bufferDays >= 5 ? 'text-emerald-400' :
                  bufferDays >= 2 ? 'text-orange-400' :
                  'text-red-400 animate-pulse'
                }`}>
                  {bufferDays} Days ({bufferDays >= 5 ? 'Optimal' : bufferDays >= 2 ? 'Warning' : 'Critical'})
                </span>
              </div>
            </div>
          </div>

          {/* Active Production Pipeline Card */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-900 pb-2">
              <h3 className="text-sm font-bold font-mono text-white tracking-tight flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-500 animate-pulse" />
                <span>All Topic Controls</span>
              </h3>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-[10px] font-mono text-neutral-500">{filteredTopics.length} topics · quick click / hold 1s</span>
                <div ref={topicSortRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTopicSortOpen(open => !open)}
                    className="flex items-center gap-1.5 rounded border border-neutral-800 bg-neutral-900/70 py-1 pl-2 pr-1.5 text-[9px] font-mono text-neutral-300 outline-none transition hover:border-neutral-700 hover:text-white focus:border-rose-800"
                    title="Sort topic controls"
                    aria-haspopup="listbox"
                    aria-expanded={isTopicSortOpen}
                  >
                    <ArrowUpDown className="h-3 w-3 text-rose-400" />
                    <span>{topicSortLabels[topicSortOrder]}</span>
                    <ChevronDown className={`h-3 w-3 text-neutral-600 transition-transform ${isTopicSortOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {isTopicSortOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-full overflow-hidden rounded border border-neutral-800 bg-neutral-950 p-1 shadow-2xl shadow-black/70"
                        role="listbox"
                        aria-label="Sort topic controls"
                      >
                        {(Object.entries(topicSortLabels) as Array<[TopicSortMode, string]>).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setTopicSortOrder(value);
                              setIsTopicSortOpen(false);
                            }}
                            className={`block w-full whitespace-nowrap rounded px-3 py-2 text-left text-[10px] font-mono transition-colors ${
                              value === topicSortOrder
                                ? 'bg-rose-500/15 text-rose-300'
                                : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                            }`}
                            role="option"
                            aria-selected={value === topicSortOrder}
                          >
                            {label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {(() => {
              const stuckCount = filteredTopics.filter(t => getUrgencyInfo(t)?.stuck).length;
              const blockedCount = filteredTopics.filter(t => t.blockedReason).length;
              if (stuckCount === 0 && blockedCount === 0) return null;
              return (
                <div className="flex flex-wrap items-center gap-2 bg-amber-950/15 border border-amber-900/30 rounded-lg px-3 py-2 text-[10px] font-mono">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="text-amber-300">
                    {stuckCount > 0 && <>{stuckCount} topic{stuckCount === 1 ? '' : 's'} overdue and need{stuckCount === 1 ? 's' : ''} a decision</>}
                    {stuckCount > 0 && blockedCount > 0 && ' · '}
                    {blockedCount > 0 && <>{blockedCount} topic{blockedCount === 1 ? '' : 's'} marked blocked</>}
                  </span>
                </div>
              );
            })()}

            <div className="space-y-2">
              {(() => {
                const activeProgress = filteredTopics;
                if (activeProgress.length === 0) {
                  return (
                    <div className="text-center py-6 text-neutral-500 font-mono text-[10px] border border-dashed border-neutral-900 rounded-lg">
                      No topics match this channel. Add one from Topic Inventory to begin.
                    </div>
                  );
                }
                
                return activeProgress.map(topic => {
                  const isSchedulingThis = schedulingTopicId === topic.id;
                  const urgency = getUrgencyInfo(topic);
                  const currentWorkflow = getTopicCurrentWorkflow(topic);
                  const topicGoal = workdaySession?.goals?.find(goal => goal.topicId === topic.id);
                  const openTopicEditor = () => {
                    if (onEditTopic) {
                      onEditTopic(topic);
                      return;
                    }
                    const defaultTime = topic.channel === 'LearnDriven' ? '21:09' : '19:07';
                    const initialTopic = { ...topic };
                    if (!initialTopic.scheduledTime) {
                      initialTopic.scheduledTime = defaultTime;
                    }
                    const initialDate = initialTopic.dueDate ? new Date(initialTopic.dueDate) : new Date();
                    setEditCalendarMonth({ month: initialDate.getMonth(), year: initialDate.getFullYear() });
                    setEditCalendarOpen(false);
                    setEditingTopic(initialTopic);
                  };
                  return (
                    <div
                      key={topic.id}
                      id={`topic-control-${topic.id}`}
                      className="p-2.5 bg-neutral-900/40 border border-neutral-850 rounded-lg space-y-2 font-mono text-[10px]"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div
                          className="min-w-0 cursor-pointer"
                          onClick={openTopicEditor}
                          title="Open topic editor"
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-xs font-bold text-neutral-200 ${topicGoal ? 'underline decoration-purple-500 decoration-2 underline-offset-2' : ''}`}>{topic.name}</span>
                            {topicGoal && <span className="rounded border border-purple-700/60 bg-purple-950/35 px-1.5 py-0.5 text-[8px] font-bold text-purple-200 shadow-[0_0_10px_rgba(168,85,247,.18)]" title={`Today's goal: reach ${topicGoal.targetStatus}`}>🎯 Today&apos;s aim</span>}
                            <span className="px-1.5 py-0.2 bg-neutral-950 text-neutral-500 border border-neutral-900 rounded text-[8px]">
                              {topic.channel}
                            </span>
                            {topic.revenueLevel && (
                              <span className="px-1.5 py-0.2 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[8px] font-bold">
                                {topic.revenueLevel}
                              </span>
                            )}
                            <span className="px-1.5 py-0.2 rounded border text-[8px] uppercase font-bold border-blue-900/40 text-blue-400 bg-blue-950/20">
                              {currentWorkflow.label}
                            </span>
                          </div>
                          <div className="text-[8px] text-neutral-600 mt-0.5 truncate">
                            Created {new Date(topic.createdDate).toLocaleDateString()} · Due {topic.dueDate ? new Date(topic.dueDate).toLocaleDateString() : 'None'}
                          </div>
                        </div>
                          <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={openTopicEditor}
                            className="p-1 rounded border border-neutral-800 text-neutral-400 hover:text-blue-300 hover:border-blue-800 transition"
                            title="Edit topic"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSavedForLater(topic)}
                            className={`p-1 rounded border transition cursor-pointer ${topic.savedForLater ? 'border-blue-900 text-blue-400' : 'border-neutral-800 text-neutral-400 hover:text-blue-400 hover:border-blue-900'}`}
                            title={topic.savedForLater ? 'Restore from Later' : 'Save for later'}
                            aria-label={topic.savedForLater ? 'Restore from Later' : 'Save for later'}
                          >
                            <Bookmark className={`h-3 w-3 ${topic.savedForLater ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => resetTopicWorkflow(topic)}
                            className="p-1 rounded border border-neutral-800 text-neutral-400 hover:text-amber-300 hover:border-amber-800 transition"
                            title="Reset all workflow statuses"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTopic(topic)}
                            className="p-1 rounded border border-neutral-800 text-neutral-400 hover:text-rose-400 hover:border-rose-900 transition"
                            title="Delete topic"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {topic.blockedReason && (
                        <div className="flex items-center justify-between gap-2 rounded-md border border-neutral-700 bg-neutral-800/40 px-2 py-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Shield className="h-3 w-3 text-neutral-400 shrink-0" />
                            <span className="text-[9px] text-neutral-300 truncate" title={topic.blockedReason}>
                              Blocked: {topic.blockedReason}
                            </span>
                          </div>
                          <button
                            id={`topic-action-${topic.id}-unblock`}
                            type="button"
                            onClick={() => handleUnblock(topic)}
                            className="text-[8px] font-bold uppercase text-blue-400 hover:text-blue-300 shrink-0 cursor-pointer"
                          >
                            Unblock
                          </button>
                        </div>
                      )}

                      {urgency && !urgency.stuck && (() => {
                        const urgencyPalette = getUrgencyPalette(urgency);
                        return (
                          <div
                            className={`emergency-countdown flex items-center justify-between gap-2 rounded-md border px-2 py-1 ${urgencyPalette.borderClass}`}
                            title="Warning remains active until scheduling is completed."
                            style={urgencyPalette.style as React.CSSProperties}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`topic-led topic-led--${urgency.ledTone} shrink-0`} title={urgency.message} style={{ '--topic-led-speed': urgency.ledSpeed } as React.CSSProperties} aria-hidden="true">
                                <span className="topic-led__bezel"><span className="topic-led__lens"><span className="topic-led__glint" /></span></span>
                              </span>
                              <span className={`text-[8px] font-black uppercase tracking-wide truncate ${urgencyPalette.labelClass}`}>
                                {urgency.overdue ? 'Overdue' : urgency.calendarDaysLeft >= 7 ? 'Upcoming' : urgency.greenBlink ? 'Advance warning' : 'Critical window'}
                              </span>
                            </div>
                            <span className={`emergency-clock text-[10px] font-black tabular-nums tracking-wider shrink-0 ${urgencyPalette.clockClass}`}>
                              {urgency.clock}
                            </span>
                          </div>
                        );
                      })()}

                      {urgency && urgency.stuck && (
                        <div className="rounded-md border border-amber-700/50 bg-amber-950/15 px-2 py-1.5 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                            <span className="text-[9px] font-bold text-amber-300">
                              {urgency.daysOverdue}d overdue - decide what to do
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const defaultTime = topic.channel === 'LearnDriven' ? '21:09' : '19:07';
                                const initialTopic = { ...topic };
                                if (!initialTopic.scheduledTime) initialTopic.scheduledTime = defaultTime;
                                setEditingTopic(initialTopic);
                              }}
                              className="px-1.5 py-0.5 bg-neutral-950 border border-neutral-800 hover:border-blue-800 text-neutral-300 hover:text-blue-400 rounded text-[8px] font-bold uppercase transition cursor-pointer"
                            >
                              Reschedule
                            </button>
                            <button
                              type="button"
                              onClick={() => handleClearDeadline(topic)}
                              className="px-1.5 py-0.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-600 text-neutral-300 hover:text-white rounded text-[8px] font-bold uppercase transition cursor-pointer"
                            >
                              Move to Backlog
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLowerPriority(topic)}
                              className="px-1.5 py-0.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-600 text-neutral-300 hover:text-white rounded text-[8px] font-bold uppercase transition cursor-pointer"
                            >
                              Deprioritize
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkBlocked(topic)}
                              className="px-1.5 py-0.5 bg-neutral-950 border border-neutral-800 hover:border-amber-700 text-neutral-300 hover:text-amber-400 rounded text-[8px] font-bold uppercase transition cursor-pointer"
                            >
                              Mark Blocked
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTopic(topic)}
                              className="px-1.5 py-0.5 bg-neutral-950 border border-neutral-800 hover:border-rose-800 text-neutral-300 hover:text-rose-400 rounded text-[8px] font-bold uppercase transition cursor-pointer"
                            >
                              Drop
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Topic-level total time — sums every task timer this
                          topic has across every stage, plus a live tick for the
                          currently-running stage. Shows the running total for
                          "how long has this topic taken so far", independent of
                          whether a workday session is active. */}
                      {(() => {
                        const allTopicTimers = taskTimer?.timers.filter(t => t.topicId === topic.id) || [];
                        if (allTopicTimers.length === 0) return null;
                        const topicTotalMs = allTopicTimers.reduce((total, t) => total + t.accumulatedActiveMs + (
                          t.status === 'running' && t.activeSince ? Math.max(0, now.getTime() - new Date(t.activeSince).getTime()) : 0
                        ), 0);
                        const topicTotalSittings = allTopicTimers.reduce((total, t) => total + t.breaksCount + 1, 0);
                        const stagesTouched = new Set(allTopicTimers.map(t => t.stage)).size;
                        const anyRunning = allTopicTimers.some(t => t.status === 'running');
                        const anyPaused = allTopicTimers.some(t => t.status === 'paused');
                        const format = (ms: number) => `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
                        return (
                          <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-neutral-900 font-mono text-[9px]">
                            <span className="text-[8px] uppercase tracking-wider text-neutral-500">Topic total</span>
                            <span className={`font-bold ${anyRunning ? 'text-emerald-300' : anyPaused ? 'text-amber-300' : 'text-neutral-300'}`}>{format(topicTotalMs)}</span>
                            <span className="text-neutral-600">·</span>
                            <span className="text-cyan-300 font-bold">{topicTotalSittings}</span>
                            <span className="text-neutral-500">sitting{topicTotalSittings === 1 ? '' : 's'}</span>
                            <span className="text-neutral-600">·</span>
                            <span className="text-neutral-500">{stagesTouched} of 6 stages</span>
                          </div>
                        );
                      })()}

                      {/* Interactive Stage Recording Buttons */}
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-neutral-900">
                        {(['hook', 'script', 'shoot', 'edit', 'schedule', 'post'] as WorkflowStage[]).map(stage => {
                          const stageTimers = taskTimer?.timers.filter(timer => timer.topicId === topic.id && timer.stage === stage) || [];
                          // Stage tracking works regardless of workday state — a
                          // running/paused timer surfaces its LIVE/PAUSED chip and
                          // pause button so a stage can be tracked with or without
                          // a workday session, with or without a goal set.
                          const liveStageTimer = stageTimers.find(timer => timer.status === 'running' || timer.status === 'paused');
                          
                          // If there's an active timer running/paused for this stage, visually force it to in-progress
                          const baseState = getWorkflowState(topic, stage);
                          const state = (liveStageTimer?.status === 'running' || liveStageTimer?.status === 'paused') 
                            ? 'in-progress' 
                            : baseState;

                          const stageActiveMs = stageTimers.reduce((total, timer) => total + timer.accumulatedActiveMs + (
                            timer.status === 'running' && timer.activeSince ? Math.max(0, now.getTime() - new Date(timer.activeSince).getTime()) : 0
                          ), 0);
                          const stageTimeLabel = stageActiveMs > 0
                            ? `${String(Math.floor(stageActiveMs / 3600000)).padStart(2, '0')}:${String(Math.floor(stageActiveMs / 60000) % 60).padStart(2, '0')}:${String(Math.floor(stageActiveMs / 1000) % 60).padStart(2, '0')}`
                            : '';
                          // "Sittings" = one continuous stretch of active work.
                          // Each timer starts as 1 sitting; every pause+resume
                          // adds another. Summed across every timer this topic
                          // has for the stage, so it carries across sessions
                          // (deferred timers stay counted in the total).
                          const stageSittings = stageTimers.reduce((total, timer) => total + timer.breaksCount + 1, 0);
                          let labelOverride = undefined;
                          let isDisabled = false;

                          const stagesOrder: WorkflowStage[] = ['hook', 'script', 'shoot', 'edit', 'schedule', 'post'];
                          const goalStageForControl: Record<WorkflowStage, NonNullable<WorkdaySession['goals']>[number]['targetStatus']> = { hook: 'hooked', script: 'scripted', shoot: 'shot', edit: 'edited', schedule: 'scheduled', post: 'posted' };
                          const isGoalTarget = topicGoal?.targetStatus === goalStageForControl[stage];
                          const goalStatusOrder = ['topic', 'hooked', 'scripted', 'shot', 'edited', 'scheduled', 'posted'];
                          const isGoalStage = topicGoal && goalStatusOrder.indexOf(goalStageForControl[stage]) <= goalStatusOrder.indexOf(topicGoal.targetStatus) && goalStatusOrder.indexOf(goalStageForControl[stage]) > goalStatusOrder.indexOf(topic.status);
                          const stageIndex = stagesOrder.indexOf(stage);
                          const previousStage = stageIndex > 0 ? stagesOrder[stageIndex - 1] : null;
                          if (stage !== 'post' && state === 'pending' && previousStage && getWorkflowState(topic, previousStage) !== 'completed') {
                            isDisabled = true;
                          }

                          if (stage === 'post') {
                            isDisabled = state !== 'completed';
                            if (topic.status === 'scheduled' && topic.dueDate && !topic.autoPostPaused) {
                              const diff = new Date(topic.dueDate).getTime() - now.getTime();
                              if (diff > 0) {
                                const secs = Math.floor(diff / 1000);
                                const mins = Math.floor(secs / 60);
                                const hours = Math.floor(mins / 60);
                                const days = Math.floor(hours / 24);

                                if (days > 0) {
                                  labelOverride = `Posting in ${days}d ${hours % 24}h`;
                                } else if (hours > 0) {
                                  labelOverride = `Posting in ${hours}h ${mins % 60}m`;
                                } else if (mins > 0) {
                                  labelOverride = `Posting in ${mins}m ${secs % 60}s`;
                                } else {
                                  labelOverride = `Posting in ${secs}s`;
                                }
                              } else {
                                const formattedDate = new Date(topic.dueDate).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
                                labelOverride = `Posted (${formattedDate})`;
                              }
                            } else if (topic.status === 'posted') {
                              const formattedDate = topic.postedAt || topic.dueDate
                                ? new Date(topic.postedAt || topic.dueDate!).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                                : '';
                              labelOverride = formattedDate ? `Posted (${formattedDate})` : 'Posted';
                            } else {
                              labelOverride = 'Post';
                            }
                          }

                          return (
                            <div key={stage} className="flex flex-col items-start gap-1">
                              <WorkflowStatusButton
                                controlId={`topic-action-${topic.id}-${stage}`}
                                stage={stage}
                                state={state}
                                disabled={isDisabled}
                                labelOverride={labelOverride}
                                onQuickPress={() => {
                                  if (stage === 'schedule') {
                                    taskTimer?.startTimer(topic.id, stage);
                                    const defaultTime = topic.channel === 'LearnDriven' ? '21:09' : '19:07';
                                    setSchedDate(topic.dueDate ? topic.dueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
                                    setSchedTime(topic.scheduledTime || defaultTime);
                                    setSchedulingTopicId(topic.id);
                                    handleTransitionToStage(topic, 'schedule', 'in-progress');
                                  } else {
                                    if (state !== 'in-progress') {
                                      // Timer paused → ask whether to resume so this
                                      // task can be counted in the session and goal.
                                      // (The stage still changes on decline.)
                                      if (workdaySession?.status === 'paused') {
                                        setResumePrompt({ topic, stage });
                                        return;
                                      }
                                      handleTransitionToStage(topic, stage, 'in-progress');
                                      taskTimer?.startTimer(topic.id, stage);
                                      // Timer running → clicking a stage makes it a goal.
                                      if (workdaySession?.status === 'running') {
                                        taskTimer?.addStageGoal(topic.id, stage);
                                      }
                                    } else {
                                      // Toggle the running/paused stage timer via the context's
                                      // actual method names — the old pauseActiveTaskTimer /
                                      // resumeActiveTaskTimer names don't exist on the context, so
                                      // the click was silently no-op and breaksCount never grew
                                      // (which is why the sittings ×N badge got stuck).
                                      if (liveStageTimer?.status === 'running') {
                                        taskTimer?.pauseTimer();
                                      } else if (liveStageTimer?.status === 'paused') {
                                        taskTimer?.resumeTimer();
                                      } else {
                                        // Stage is in-progress from a persisted workflow
                                        // status (e.g. left over from a previous session)
                                        // but no live timer exists — the click should still
                                        // start a fresh timer so it can actually be tracked.
                                        taskTimer?.startTimer(topic.id, stage);
                                        if (workdaySession?.status === 'running') {
                                          taskTimer?.addStageGoal(topic.id, stage);
                                        }
                                      }
                                    }
                                  }
                                }}
                                onLongPress={() => {
                                  if (stage === 'schedule') {
                                    if (state === 'in-progress') {
                                      completeSchedule(topic);
                                      taskTimer?.completeStageTimer(topic.id, stage);
                                    }
                                  } else {
                                    handleTransitionToStage(topic, stage, 'completed');
                                    taskTimer?.completeStageTimer(topic.id, stage);
                                  }
                                }}
                                onReset={() => resetWorkflowStage(topic, stage)}
                                isGoalStage={!!isGoalStage}
                              />
                              {isGoalTarget && (() => {
                                const isGoalAchieved = topicGoal && goalStatusOrder.indexOf(topic.status) >= goalStatusOrder.indexOf(topicGoal.targetStatus);
                                return isGoalAchieved ? (
                                  <motion.div
                                    className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-emerald-400"
                                    initial={{ opacity: 0, scale: 0.6 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                  >
                                    <motion.span
                                      animate={{ rotate: [0, -12, 12, -6, 6, 0] }}
                                      transition={{ duration: 0.9, delay: 0.1 }}
                                      className="inline-flex"
                                    >
                                      <ThumbsUp className="h-3 w-3 fill-current" />
                                    </motion.span>
                                    <span>Goaled</span>
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-amber-400"
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                  >
                                    <motion.svg
                                      viewBox="0 0 16 16"
                                      className="h-3 w-3"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth={1.5}
                                      animate={{ x: [0, 2, 0], y: [0, -1, 0] }}
                                      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                                    >
                                      <path d="M2 14 L12 4" strokeLinecap="round" />
                                      <path d="M8 3 L12.5 3 L12.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
                                      <circle cx="13.5" cy="2.5" r="1.5" fill="currentColor" stroke="none" />
                                    </motion.svg>
                                    <span>Goal</span>
                                  </motion.div>
                                );
                              })()}
                              {(liveStageTimer || stageTimeLabel) && (
                                <div className="flex items-center gap-1">
                                  <span className={`font-mono text-[7px] ${liveStageTimer?.status === 'running' ? 'text-emerald-300' : liveStageTimer?.status === 'paused' ? 'text-amber-300' : 'text-neutral-600'}`}>
                                    {liveStageTimer?.status === 'running' ? 'LIVE ' : liveStageTimer?.status === 'paused' ? 'PAUSED ' : ''}{stageTimeLabel}
                                  </span>
                                  {stageSittings > 1 && (
                                    <span
                                      title={`${stageSittings} sittings on this stage — each pause split the work.`}
                                      className="rounded border border-cyan-900/50 bg-cyan-950/30 px-1 py-[1px] font-mono text-[7px] font-bold text-cyan-300"
                                    >
                                      ×{stageSittings}
                                    </span>
                                  )}
                                  {liveStageTimer?.status === 'running' && (
                                    <button
                                      type="button"
                                      onClick={(event) => { event.stopPropagation(); taskTimer?.pauseTimer(); }}
                                      title="Pause this task timer"
                                      aria-label="Pause this task timer"
                                      className="flex h-3.5 w-3.5 items-center justify-center rounded border border-amber-800/60 bg-amber-500/10 text-amber-300 transition hover:border-amber-500 hover:bg-amber-500/25"
                                    >
                                      <Pause className="h-2 w-2 fill-current" />
                                    </button>
                                  )}
                                  {liveStageTimer?.status === 'paused' && (
                                    <button
                                      type="button"
                                      onClick={(event) => { event.stopPropagation(); taskTimer?.startTimer(topic.id, stage); }}
                                      title="Resume this task timer"
                                      aria-label="Resume this task timer"
                                      className="flex h-3.5 w-3.5 items-center justify-center rounded border border-emerald-800/60 bg-emerald-500/15 text-emerald-300 transition hover:border-emerald-500 hover:bg-emerald-500/30"
                                    >
                                      <Play className="h-2 w-2 fill-current" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Scheduling Date/Time Picker Form Block */}
                      {isSchedulingThis && (
                        <div className="mt-2.5 p-3 bg-neutral-950 border border-neutral-850 rounded-lg space-y-2">
                          <span className="text-[9px] uppercase font-bold text-purple-400 tracking-wider">Set Video Schedule Parameters</span>
                          
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div>
                              <label className="text-[8px] text-neutral-500 block mb-0.5">Date</label>
                              <input 
                                type="date"
                                value={schedDate}
                                onChange={(e) => setSchedDate(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-800 text-[9px] text-white rounded px-2 py-1 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] text-neutral-500 block mb-0.5">Time (24h format)</label>
                              <input 
                                type="time"
                                value={schedTime}
                                onChange={(e) => setSchedTime(e.target.value)}
                                className="w-full bg-neutral-900 border border-neutral-800 text-[9px] text-white rounded px-2 py-1 outline-none font-mono"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setSchedulingTopicId(null)}
                              className="text-neutral-500 hover:text-neutral-300 transition"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!schedDate) {
                                  alert("Please select a Date.");
                                  return;
                                }
                                const finalTime = schedTime || (topic.channel === 'LearnDriven' ? '21:09' : '19:07');
                                const combinedDateStr = `${schedDate}T${finalTime}:00`;
                                const finalIso = new Date(combinedDateStr).toISOString();

                                setTopics(prev => prev.map(t => t.id === topic.id ? { 
                                  ...t, 
                                  status: 'scheduled', 
                                  dueDate: finalIso, 
                                  scheduledTime: finalTime,
                                  workflowStatuses: { ...t.workflowStatuses, schedule: 'completed' },
                                  autoPostPaused: false,
                                  lastUpdated: new Date().toISOString(),
                                } : t));

                                // Add activity log
                                const newActivity: TopicActivity = {
                                  id: `act-schedule-${Date.now()}`,
                                  topicName: topic.name,
                                  channel: topic.channel,
                                  action: `Scheduled video release for ${schedDate} at ${finalTime}`,
                                  author: 'typeakshay',
                                  timestamp: new Date().toISOString()
                                };
                                setActivities(prev => [newActivity, ...prev]);

                                onAddEvent({
                                  id: `evt-scheduled-${Date.now()}`,
                                  source: 'github',
                                  type: 'success',
                                  message: `Topic Engine: Scheduled "${topic.name}" to publish on ${schedDate} at ${finalTime} (${topic.channel}).`,
                                  timestamp: new Date().toISOString()
                                });

                                setSchedulingTopicId(null);
                              }}
                              className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-black font-bold rounded text-[9px] transition cursor-pointer"
                            >
                              Save Schedule
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Bottom Panel: Scheduled & Completed Video Ledger */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
              <h3 className="text-sm font-bold font-mono text-white tracking-tight flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-500" />
                <span>Scheduled & Completed Video Ledger</span>
              </h3>
              <span className="text-[10px] font-mono text-neutral-500">Archive</span>
            </div>

            <div className="space-y-3">
              {(() => {
                const scheduledItems = topics.filter(t => t.status === 'scheduled');
                const postedItems = topics.filter(t => t.status === 'posted');

                if (scheduledItems.length === 0 && postedItems.length === 0) {
                  return (
                    <div className="text-center py-6 text-neutral-500 font-mono text-[10px] border border-dashed border-neutral-900 rounded-lg">
                      No videos currently scheduled or done. Complete the progress stages and save scheduling parameters to archive them here.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {scheduledItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-[9px] uppercase font-bold text-purple-400 tracking-wider font-mono">Scheduled Releases</div>
                        {scheduledItems.map(topic => {
                          const dueMs = topic.dueDate ? new Date(topic.dueDate).getTime() : null;
                          const remainingMs = dueMs !== null ? Math.max(0, dueMs - now.getTime()) : null;
                          const isImminent = remainingMs !== null && remainingMs <= 60 * 60 * 1000;
                          let countdown = '';
                          if (remainingMs !== null) {
                            const secs = Math.floor(remainingMs / 1000);
                            const d = Math.floor(secs / 86400);
                            const h = Math.floor((secs % 86400) / 3600);
                            const m = Math.floor((secs % 3600) / 60);
                            const s = secs % 60;
                            countdown = d > 0
                              ? `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`
                              : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                          }
                          return (
                          <div
                            key={topic.id}
                            className="p-3 bg-neutral-900/20 border border-neutral-850 rounded-lg space-y-2 font-mono text-[10px]"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <span className="text-xs font-bold block text-neutral-200">
                                  {topic.name}
                                </span>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="px-1.5 py-0.2 bg-neutral-950 text-neutral-500 border border-neutral-900 rounded text-[8px]">
                                    {topic.channel}
                                  </span>
                                  {topic.revenueLevel && (
                                    <span className="px-1.5 py-0.2 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[8px] font-bold">
                                      {topic.revenueLevel}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="px-1.5 py-0.5 rounded border text-[8px] uppercase font-bold border-purple-900/40 text-purple-400 bg-purple-950/20">
                                  Scheduled
                                </span>
                                {countdown && (
                                  <div
                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold tabular-nums ${
                                      isImminent
                                        ? 'border-rose-900/50 bg-rose-950/25 text-rose-300 animate-pulse'
                                        : 'border-purple-900/40 bg-purple-950/15 text-purple-300'
                                    }`}
                                    title={`Auto-posts at ${new Date(topic.dueDate!).toLocaleString()}`}
                                  >
                                    <Clock className="h-2.5 w-2.5" />
                                    <span>Posts in {countdown}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-neutral-500 text-[8px] pt-1">
                              <div>Created: {new Date(topic.createdDate).toLocaleDateString()}</div>
                              <div>
                                Release: {topic.dueDate ? new Date(topic.dueDate).toLocaleDateString() : 'N/A'}{' '}
                                {topic.scheduledTime ? `@ ${topic.scheduledTime}` : ''}
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}

                    {postedItems.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-neutral-900/50">
                        <div className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider font-mono">Posted & Completed Archive</div>
                        {postedItems.map(topic => (
                          <div 
                            key={topic.id}
                            className="p-3 bg-neutral-900/10 border border-neutral-850/60 rounded-lg space-y-2 font-mono text-[10px] opacity-75 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-xs font-bold block text-neutral-300 line-through">
                                  {topic.name}
                                </span>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="px-1.5 py-0.2 bg-neutral-950 text-neutral-500 border border-neutral-900 rounded text-[8px]">
                                    {topic.channel}
                                  </span>
                                  {topic.revenueLevel && (
                                    <span className="px-1.5 py-0.2 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[8px] font-bold">
                                      {topic.revenueLevel}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className="px-1.5 py-0.5 rounded border text-[8px] uppercase font-bold border-emerald-900/30 text-emerald-400 bg-emerald-950/20">
                                Live
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-neutral-500 text-[8px] pt-1">
                              <div>Created: {new Date(topic.createdDate).toLocaleDateString()}</div>
                              <div>
                                Published: {topic.dueDate ? new Date(topic.dueDate).toLocaleDateString() : 'N/A'}{' '}
                                {topic.scheduledTime ? `@ ${topic.scheduledTime}` : ''}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Graph: Daily output chart */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 font-mono">
            <h3 className="text-sm font-semibold text-neutral-200 mb-4">Production & Upload Velocity</h3>
            <div className="h-60 w-full select-none">
              <ResponsiveContainer width="100%" height="100%">
                <RechartLine data={graphData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="date" stroke="#525252" fontSize={9} />
                  <YAxis stroke="#525252" fontSize={9} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                    labelStyle={{ color: '#a3a3a3', fontSize: '10px' }}
                    itemStyle={{ fontSize: '10px' }}
                  />
                  <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="added" name="Topics Created" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="scheduled" name="Videos Scheduled" stroke="#10b981" strokeWidth={2.5} activeDot={{ r: 6 }} />
                </RechartLine>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Side widgets */}
        <div className="space-y-6 font-mono">
          {/* History */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-neutral-200 mb-4">Production History</h3>
            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {recentHistory.length === 0 ? (
                <p className="text-xs text-neutral-500 italic font-mono text-center py-4">No workflow activity logged</p>
              ) : (
                recentHistory.map(act => (
                  <div key={act.id} className="p-3 bg-neutral-900/60 border border-neutral-850 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-neutral-500 truncate max-w-[120px]">{act.channel}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[8px] uppercase font-semibold border ${
                        act.action.includes('scheduled') ? 'bg-emerald-950/85 text-emerald-400 border-emerald-900' :
                        act.action.includes('edited') ? 'bg-fuchsia-950/85 text-fuchsia-400 border-fuchsia-900' :
                        'bg-blue-950/85 text-blue-400 border-blue-900'
                      }`}>
                        {act.action.includes('scheduled') ? 'Scheduled' : act.action.includes('edited') ? 'Edited' : 'In Stage'}
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-neutral-300 break-all font-semibold leading-snug">
                      {act.action} on "{act.topicName}"
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1">
                      <span>by @{act.author}</span>
                      <span>{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active content lane velocities */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-200">Content Lane Velocities</h3>
              <Server className="h-4 w-4 text-neutral-500" />
            </div>

            <div className="space-y-3">
              {laneVelocities.map(lane => (
                <div key={lane.id} className="p-3 bg-neutral-900 rounded-lg border border-neutral-850">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-neutral-200">{lane.path}</span>
                    {lane.bufferStatus === 'free-flow' ? (
                      <span className="px-1.5 py-0.2 bg-neutral-900 border border-neutral-800 text-neutral-400 text-[8px] font-semibold uppercase rounded">
                        Free Flow
                      </span>
                    ) : lane.bufferStatus === 'safe' ? (
                      <span className="px-1.5 py-0.2 bg-emerald-950 border border-emerald-900 text-emerald-400 text-[8px] font-semibold uppercase rounded">
                        Safe Buffer
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 bg-amber-950/80 border border-amber-900/60 text-amber-400 text-[8px] font-semibold uppercase rounded animate-pulse">
                        Gaps: {lane.scheduledInCycle}/{lane.targetGoal}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-850 text-center text-[10px] text-neutral-500">
                    <div>
                      <span className="block text-[8px] text-neutral-500 uppercase">Pipeline Load</span>
                      <span className="font-semibold text-neutral-300 mt-0.5 block">{lane.invocations}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] text-neutral-500 uppercase">Cycle Target</span>
                      <span className="font-semibold text-neutral-300 mt-0.5 block">
                        {lane.targetGoal !== null ? lane.targetGoal : 'Free'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[8px] text-neutral-500 uppercase">Scheduled</span>
                      <span className={`font-semibold mt-0.5 block ${
                        lane.bufferStatus === 'gaps' ? 'text-amber-400 font-bold' : 'text-neutral-300'
                      }`}>
                        {lane.scheduledInCycle}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {editingTopic && (
          <div className="fixed inset-0 z-50 bg-neutral-950/85 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.form
              ref={editTopicModalRef}
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              onSubmit={saveEditedTopic}
              className="max-h-[calc(100vh-2rem)] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl [scrollbar-color:#3f3f46_#0a0a0a] [scrollbar-width:thin]"
            >
              <div className="flex items-start justify-between border-b border-neutral-900 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Edit Topic</h3>
                  <p className="text-[10px] text-neutral-500 mt-1">Changes sync everywhere this topic appears.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] uppercase text-blue-400 border border-blue-900/40 bg-blue-950/20 rounded px-2 py-1">{editingTopic.status}</span>
                  <button
                    type="button"
                    onClick={() => setEditingTopic(null)}
                    className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <label className="block text-[9px] uppercase text-neutral-500 font-mono">
                Title
                <input
                  required
                  value={editingTopic.name}
                  onChange={event => setEditingTopic({ ...editingTopic, name: event.target.value })}
                  className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs normal-case text-white outline-none"
                />
              </label>

              <label className="block text-[9px] uppercase text-neutral-500 font-mono">
                Description
                <textarea
                  rows={3}
                  value={editingTopic.description}
                  onChange={event => setEditingTopic({ ...editingTopic, description: event.target.value })}
                  className="mt-1 w-full resize-none rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs normal-case text-white outline-none"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <label className="block text-[9px] uppercase text-neutral-500 font-mono">
                  Channel
                  <select
                    value={editingTopic.channel}
                    onChange={event => {
                      const newChannel = event.target.value as Topic['channel'];
                      const oldDefault = editingTopic.channel === 'LearnDriven' ? '21:09' : '19:07';
                      const newDefault = newChannel === 'LearnDriven' ? '21:09' : '19:07';
                      
                      let finalTime = editingTopic.scheduledTime;
                      if (!finalTime || finalTime === oldDefault) {
                        finalTime = newDefault;
                      }

                      setEditingTopic({ 
                        ...editingTopic, 
                        channel: newChannel,
                        scheduledTime: finalTime,
                        dueDate: editingTopic.dueDate ? new Date(`${editingTopic.dueDate.split('T')[0]}T${finalTime}:00`).toISOString() : null
                      });
                    }}
                    className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-2 text-xs normal-case text-white outline-none"
                  >
                    <option value="LearnDriven">LearnDriven</option>
                    <option value="DecodeWorthy">DecodeWorthy</option>
                  </select>
                </label>
                <label className="block text-[9px] uppercase text-neutral-500 font-mono">
                  Priority
                  <select
                    value={editingTopic.priority}
                    onChange={event => setEditingTopic({ ...editingTopic, priority: Number(event.target.value) as Topic['priority'] })}
                    className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-2 text-xs normal-case text-white outline-none"
                  >
                    {[1, 2, 3, 4, 5].map(priority => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </label>
                <div className="block text-[9px] uppercase text-neutral-500 font-mono">
                  Due date
                  <button type="button" onClick={() => setEditCalendarOpen(open => !open)} className={`mt-1 flex w-full items-center justify-between rounded border px-2 py-2 text-xs normal-case outline-none transition ${editCalendarOpen ? 'border-blue-600 bg-blue-950/20 text-blue-100' : 'border-neutral-800 bg-neutral-900 text-white hover:border-neutral-700'}`}>
                    <span>{editingTopic.dueDate?.split('T')[0] || 'Select date'}</span><Calendar className="h-3.5 w-3.5 text-blue-400" />
                  </button>
                </div>
                <label className="block text-[9px] uppercase text-neutral-500 font-mono">
                  Sched Time
                  <input
                    type="time"
                    value={editingTopic.scheduledTime || ''}
                    onChange={event => {
                      const datePart = editingTopic.dueDate ? editingTopic.dueDate.split('T')[0] : new Date().toISOString().split('T')[0];
                      const defaultTime = editingTopic.channel === 'LearnDriven' ? '21:09' : '19:07';
                      const finalTime = event.target.value || defaultTime;
                      setEditingTopic({ 
                        ...editingTopic, 
                        scheduledTime: event.target.value || undefined,
                        dueDate: new Date(`${datePart}T${finalTime}:00`).toISOString()
                      });
                    }}
                    className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-2 text-xs normal-case text-white outline-none font-mono"
                  />
                </label>
              </div>

              <AnimatePresence initial={false}>
                {editCalendarOpen && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="rounded-xl border border-blue-900/40 bg-neutral-900/45 p-3 font-mono shadow-[0_0_28px_rgba(59,130,246,.08)]">
                  <div className="mb-3 flex items-center justify-between">
                    <button type="button" onClick={() => setEditCalendarMonth(current => current.month === 0 ? { month: 11, year: current.year - 1 } : { ...current, month: current.month - 1 })} className="rounded-md border border-neutral-800 bg-neutral-950 p-1.5 text-neutral-400 hover:border-blue-800 hover:text-blue-300"><ChevronLeft className="h-3.5 w-3.5" /></button>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-200">{new Date(editCalendarMonth.year, editCalendarMonth.month).toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>
                    <button type="button" onClick={() => setEditCalendarMonth(current => current.month === 11 ? { month: 0, year: current.year + 1 } : { ...current, month: current.month + 1 })} className="rounded-md border border-neutral-800 bg-neutral-950 p-1.5 text-neutral-400 hover:border-blue-800 hover:text-blue-300"><ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[7px] font-bold uppercase text-neutral-600">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}</div>
                  <div className="grid grid-cols-7 gap-1">{(() => {
                    const cells: React.ReactNode[] = [];
                    const firstDay = new Date(editCalendarMonth.year, editCalendarMonth.month, 1).getDay();
                    const days = new Date(editCalendarMonth.year, editCalendarMonth.month + 1, 0).getDate();
                    for (let blank = 0; blank < firstDay; blank++) cells.push(<span key={`blank-${blank}`} />);
                    for (let day = 1; day <= days; day++) {
                      const dateKey = `${editCalendarMonth.year}-${String(editCalendarMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const scheduled = topics.filter(topic => topic.dueDate?.split('T')[0] === dateKey);
                      const selected = editingTopic.dueDate?.split('T')[0] === dateKey;
                      const hasLearnDriven = scheduled.some(topic => topic.channel === 'LearnDriven');
                      const hasDecodeWorthy = scheduled.some(topic => topic.channel === 'DecodeWorthy');
                      cells.push(<button key={dateKey} type="button" title={scheduled.length ? `${scheduled.length} topic${scheduled.length === 1 ? '' : 's'} on this date` : 'No topics on this date'} onClick={() => { const defaultTime = editingTopic.channel === 'LearnDriven' ? '21:09' : '19:07'; const timePart = editingTopic.scheduledTime || defaultTime; setEditingTopic({ ...editingTopic, dueDate: new Date(`${dateKey}T${timePart}:00`).toISOString() }); setEditCalendarOpen(false); }} className={`relative min-h-10 rounded-lg border p-1 text-left transition ${selected ? 'border-blue-400 bg-blue-500/25 text-white shadow-[0_0_14px_rgba(59,130,246,.22)]' : scheduled.length ? 'border-neutral-700 bg-neutral-950 text-neutral-200 hover:border-blue-700' : 'border-neutral-900 bg-neutral-950/50 text-neutral-600 hover:border-neutral-700 hover:text-neutral-300'}`}>
                        <span className="text-[8px] font-bold">{day}</span>{scheduled.length > 0 && <span className="absolute right-1 top-1 rounded bg-neutral-800 px-1 text-[7px] font-black text-white">{scheduled.length}</span>}<span className="absolute bottom-1 left-1 flex gap-0.5">{hasLearnDriven && <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_5px_#60a5fa]" />}{hasDecodeWorthy && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_#34d399]" />}</span>
                      </button>);
                    }
                    return cells;
                  })()}</div>
                  <div className="mt-3 flex items-center justify-between border-t border-neutral-800 pt-2 text-[8px]"><div className="flex gap-3 text-neutral-500"><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />LearnDriven</span><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />DecodeWorthy</span></div><button type="button" onClick={() => { setEditingTopic({ ...editingTopic, dueDate: null }); setEditCalendarOpen(false); }} className="text-neutral-500 hover:text-rose-300">Clear date</button></div>
                </div></motion.div>}
              </AnimatePresence>

              <div className="flex justify-end gap-2 border-t border-neutral-900 pt-3 text-[10px] font-mono">
                <button type="button" onClick={() => setEditingTopic(null)} className="px-3 py-1.5 text-neutral-400 hover:text-white">Cancel</button>
                <button type="submit" className="rounded bg-blue-500 px-4 py-1.5 font-bold text-black hover:bg-blue-400">Save Changes</button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Break prompt after completing a goal */}
      {breakPrompt && createPortal(
        <AnimatePresence>
          <motion.div
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-emerald-900/60 bg-neutral-950 p-6 shadow-[0_0_60px_rgba(16,185,129,.12)] text-center"
            >
              <CheckCircle className="mx-auto h-10 w-10 text-emerald-400" />
              <h3 className="mt-3 text-base font-bold text-white">Goal completed!</h3>
              <p className="mt-1 text-xs text-neutral-400">
                <span className="text-emerald-300 font-semibold">{breakPrompt.topicName}</span> — {breakPrompt.stage} finished in {Math.round(breakPrompt.durationMs / 60000)} min
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    if (setWorkdaySession) {
                      const stamp = new Date().toISOString();
                      setWorkdaySession(prev => prev ? { ...prev, status: 'paused', pausedAt: stamp, updatedAt: stamp, breaksCount: (prev.breaksCount || 0) + 1 } : prev);
                    }
                    setBreakPrompt(null);
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-amber-900/50 bg-amber-950/30 py-3 text-sm font-bold text-amber-300 hover:bg-amber-950/50"
                >
                  <Coffee className="h-4 w-4" />Take a break
                </button>
                <button
                  onClick={() => setBreakPrompt(null)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500"
                >
                  <Play className="h-4 w-4" />Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Stage clicked while the workday timer is paused */}
      {resumePrompt && createPortal(
        <AnimatePresence>
          <motion.div
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-amber-900/60 bg-neutral-950 p-6 shadow-[0_0_60px_rgba(245,158,11,.12)] text-center"
            >
              <Pause className="mx-auto h-9 w-9 text-amber-400" />
              <h3 className="mt-3 text-base font-bold text-white">Timer is paused</h3>
              <p className="mt-1 text-xs text-neutral-400">
                Resume the timer so <span className="text-amber-200 font-semibold">{resumePrompt.topic.name}</span> — {WORKFLOW_LABELS[resumePrompt.stage]['in-progress']} is counted in this session and added as a goal?
              </p>
              <div className="mt-5 grid grid-cols-1 gap-2">
                <button
                  onClick={() => {
                    const { topic, stage } = resumePrompt;
                    taskTimer?.resumeWorkdayAndStart(topic.id, stage);
                    handleTransitionToStage(topic, stage, 'in-progress');
                    taskTimer?.addStageGoal(topic.id, stage);
                    setResumePrompt(null);
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500"
                >
                  <Play className="h-4 w-4" />Resume &amp; count it
                </button>
                <button
                  onClick={() => {
                    const { topic, stage } = resumePrompt;
                    handleTransitionToStage(topic, stage, 'in-progress');
                    setResumePrompt(null);
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-neutral-800 py-3 text-sm font-bold text-neutral-300 hover:bg-neutral-900/50"
                >
                  Just change the stage
                </button>
                <button
                  onClick={() => setResumePrompt(null)}
                  className="mt-1 text-center text-[10px] text-neutral-500 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

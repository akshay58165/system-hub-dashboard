import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layers, 
  Globe, 
  Clock, 
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
  RotateCcw
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
import { Topic, TopicActivity, SystemEvent, CycleGoal } from '../types';
import { getTopicCurrentWorkflow, getTopicWorkflowState } from '../services/topicWorkflow';

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
}

type WorkflowStage = 'script' | 'shoot' | 'edit' | 'schedule' | 'post';
type WorkflowState = 'pending' | 'in-progress' | 'completed';

const WORKFLOW_LABELS: Record<WorkflowStage, Record<WorkflowState, string>> = {
  script: { pending: 'Script', 'in-progress': 'Scripting', completed: 'Scripted' },
  shoot: { pending: 'Shoot', 'in-progress': 'Shooting', completed: 'Shot' },
  edit: { pending: 'Edit', 'in-progress': 'Editing', completed: 'Edited' },
  schedule: { pending: 'Schedule', 'in-progress': 'Scheduling', completed: 'Scheduled' },
  post: { pending: 'Post', 'in-progress': 'Posting', completed: 'Posted' },
};

function WorkflowStatusButton({ stage, state, onQuickPress, onLongPress, onReset, labelOverride, disabled, blinkClass }: {
  stage: WorkflowStage;
  state: WorkflowState;
  onQuickPress: () => void;
  onLongPress: () => void;
  onReset: () => void;
  labelOverride?: string;
  disabled?: boolean;
  blinkClass?: string;
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
    if (!wasLongPress && state !== 'completed') onQuickPress();
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
      className={`relative overflow-hidden px-2.5 py-1 rounded text-[8px] font-semibold border transition select-none touch-none ${
        disabled ? 'cursor-default opacity-85' : 'cursor-pointer'
      } ${
        state === 'pending'
          ? 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-neutral-200'
          : state === 'in-progress'
            ? 'workflow-in-progress bg-emerald-600 border-emerald-400 text-white ring-1 ring-white/20'
            : 'workflow-completed bg-neutral-900/25 border-neutral-800/50 text-neutral-500 opacity-55'
      } ${blinkClass || ''}`}
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
  cycleGoals
}: VercelViewProps) {
  const [selectedChannel, setSelectedChannel] = useState<'All' | 'LearnDriven' | 'DecodeWorthy'>('All');
  const [schedulingTopicId, setSchedulingTopicId] = useState<string | null>(null);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

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

  const getUrgencyInfo = (topic: Topic) => {
    const scheduleComplete = getWorkflowState(topic, 'schedule') === 'completed' || topic.status === 'scheduled' || topic.status === 'posted';
    if (!topic.dueDate || scheduleComplete) return null;

    const differenceMs = new Date(topic.dueDate).getTime() - now.getTime();
    const absoluteSeconds = Math.max(0, Math.floor(Math.abs(differenceMs) / 1000));
    const days = Math.floor(absoluteSeconds / 86400);
    const hours = Math.floor((absoluteSeconds % 86400) / 3600);
    const minutes = Math.floor((absoluteSeconds % 3600) / 60);
    const seconds = absoluteSeconds % 60;

    if (differenceMs > 72 * 60 * 60 * 1000) return null;

    const clock = days > 0
      ? `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`
      : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return {
      overdue: differenceMs <= 0,
      clock,
      message: differenceMs <= 0
        ? 'DEADLINE BREACHED — COMPLETE THE REMAINING STAGES NOW'
        : 'CRITICAL WINDOW — UTMOST ACTION REQUIRED',
    };
  };

  const handleTransitionToStage = (topic: Topic, targetStage: WorkflowStage, targetState: WorkflowState) => {
    const completedStatusByStage: Record<WorkflowStage, Topic['status']> = {
      script: 'scripted', shoot: 'shot', edit: 'edited', schedule: 'scheduled', post: 'posted'
    };

    const stagesOrder: WorkflowStage[] = ['script', 'shoot', 'edit', 'schedule', 'post'];
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

    const label = WORKFLOW_LABELS[targetStage][targetState];
    setActivities(prev => [{
      id: `act-workflow-${targetStage}-${Date.now()}`,
      topicName: topic.name,
      channel: topic.channel,
      action: `Moved stage to ${label}: ${topic.name}`,
      author: 'typeakshay',
      timestamp: new Date().toISOString(),
    }, ...prev]);
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
    const stagesOrder: WorkflowStage[] = ['script', 'shoot', 'edit', 'schedule', 'post'];
    const completedStatusByStage: Record<WorkflowStage, Topic['status']> = {
      script: 'scripted', shoot: 'shot', edit: 'edited', schedule: 'scheduled', post: 'posted'
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
    if (!window.confirm(`Delete "${topic.name}"? This permanently removes it from every topic view.`)) return;
    setTopics(prev => prev.filter(item => item.id !== topic.id));
    setActivities(prev => [{
      id: `act-delete-${Date.now()}`,
      topicName: topic.name,
      channel: topic.channel,
      action: `Deleted topic`,
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
  const filteredTopics = useMemo(() => {
    return topics.filter(t => selectedChannel === 'All' || t.channel === selectedChannel);
  }, [topics, selectedChannel]);

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
      {/* Top header — matches the AI Insights design language */}
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
            {(['All', 'LearnDriven', 'DecodeWorthy'] as const).map(channel => (
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
            <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
              <h3 className="text-sm font-bold font-mono text-white tracking-tight flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-500 animate-pulse" />
                <span>All Topic Controls</span>
              </h3>
              <span className="text-[10px] font-mono text-neutral-500">{filteredTopics.length} topics · quick click / hold 1s</span>
            </div>

            <div className="space-y-3">
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
                  return (
                    <div 
                      key={topic.id} 
                      className="p-3 bg-neutral-900/40 border border-neutral-850 rounded-lg space-y-3 font-mono text-[10px]"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-xs font-bold text-neutral-200 block">{topic.name}</span>
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
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded border text-[8px] uppercase font-bold border-blue-900/40 text-blue-400 bg-blue-950/20">
                            {currentWorkflow.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const defaultTime = topic.channel === 'LearnDriven' ? '21:09' : '19:07';
                              const initialTopic = { ...topic };
                              if (!initialTopic.scheduledTime) {
                                initialTopic.scheduledTime = defaultTime;
                              }
                              setEditingTopic(initialTopic);
                            }}
                            className="p-1 rounded border border-neutral-800 text-neutral-400 hover:text-blue-300 hover:border-blue-800 transition"
                            title="Edit topic"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          {topic.status !== 'posted' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!window.confirm(`Manually archive "${topic.name}" as Posted?`)) return;
                                setTopics(prev => prev.map(t => t.id === topic.id ? {
                                  ...t,
                                  status: 'posted',
                                  inProgress: true,
                                  workflowStatuses: {
                                    ...t.workflowStatuses,
                                    script: 'completed',
                                    shoot: 'completed',
                                    edit: 'completed',
                                    schedule: 'completed',
                                    post: 'completed'
                                  },
                                  postedAt: new Date().toISOString(),
                                  autoPostPaused: false,
                                  lastUpdated: new Date().toISOString()
                                } : t));

                                onAddEvent({
                                  id: `evt-manual-archive-${topic.id}-${Date.now()}`,
                                  source: 'system',
                                  type: 'success',
                                  message: `Workflow Engine: "${topic.name}" manually archived as Posted.`,
                                  timestamp: new Date().toISOString()
                                });

                                setActivities(prev => [{
                                  id: `act-manual-archive-${topic.id}-${Date.now()}`,
                                  topicName: topic.name,
                                  channel: topic.channel,
                                  action: `Manually Archived: Mark "${topic.name}" as Posted`,
                                  author: 'typeakshay',
                                  timestamp: new Date().toISOString()
                                }, ...prev]);
                              }}
                              className="p-1 rounded border border-neutral-800 text-neutral-400 hover:text-emerald-400 hover:border-emerald-900 transition flex items-center gap-0.5 cursor-pointer"
                              title="Manually archive as Posted"
                            >
                              <CheckCircle className="h-3 w-3 text-emerald-500" />
                              <span className="text-[8px] font-mono px-0.5 text-emerald-400">Archive</span>
                            </button>
                          )}
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

                      {/* Created and Due Date Meta Elements */}
                      <div className="grid grid-cols-2 gap-2 text-neutral-500 text-[8px] pt-1">
                        <div>Created: {new Date(topic.createdDate).toLocaleDateString()}</div>
                        <div>Due Date: {topic.dueDate ? new Date(topic.dueDate).toLocaleDateString() : 'None'}</div>
                      </div>

                      {urgency && (
                        <div className="emergency-countdown relative overflow-hidden rounded-lg border border-red-500/60 bg-red-950/25 px-3 py-2.5 shadow-[0_0_22px_rgba(239,68,68,0.18)]">
                          <div className="emergency-shimmer pointer-events-none absolute inset-y-0 -left-1/2 w-1/3" />
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="emergency-led-housing relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full" aria-hidden="true">
                                <span className="emergency-led-lens relative block h-[11px] w-[11px] rounded-full">
                                  <span className="emergency-led-specular absolute left-[2px] top-[1px] h-[3px] w-[4px] rounded-full" />
                                </span>
                              </span>
                              <div className="min-w-0">
                                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-red-400">{urgency.message}</div>
                                <div className="mt-0.5 text-[8px] text-red-200/60">Warning remains active until scheduling is completed.</div>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-[7px] font-bold uppercase tracking-widest text-red-400/70">{urgency.overdue ? 'Overdue by' : 'Time remaining'}</div>
                              <div className="emergency-clock mt-0.5 text-sm font-black tabular-nums tracking-wider text-red-300">{urgency.clock}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Interactive Stage Recording Buttons */}
                      <div className="flex flex-wrap gap-2.5 pt-2 border-t border-neutral-900">
                        {(['script', 'shoot', 'edit', 'schedule', 'post'] as WorkflowStage[]).map(stage => {
                          const state = getWorkflowState(topic, stage);
                          let labelOverride = undefined;
                          let isDisabled = false;
                          let blinkClass = undefined;

                          const scheduleComplete = getWorkflowState(topic, 'schedule') === 'completed' || topic.status === 'scheduled' || topic.status === 'posted';
                          if (state !== 'completed' && !scheduleComplete && topic.dueDate) {
                            const due = new Date(topic.dueDate);
                            due.setHours(0, 0, 0, 0);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const diffTime = due.getTime() - today.getTime();
                            const daysLeft = Math.round(diffTime / (1000 * 60 * 60 * 24));

                            if (daysLeft === 2) {
                              blinkClass = 'blink-yellow';
                            } else if (daysLeft === 1) {
                              blinkClass = 'blink-orange';
                            } else if (daysLeft <= 0) {
                              blinkClass = 'blink-red';
                            }
                          }

                          const stagesOrder: WorkflowStage[] = ['script', 'shoot', 'edit', 'schedule', 'post'];
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
                            <React.Fragment key={stage}>
                              <WorkflowStatusButton
                                stage={stage}
                                state={state}
                                disabled={isDisabled}
                                labelOverride={labelOverride}
                                blinkClass={blinkClass}
                                onQuickPress={() => {
                                  if (stage === 'schedule') {
                                    const defaultTime = topic.channel === 'LearnDriven' ? '21:09' : '19:07';
                                    setSchedDate(topic.dueDate ? topic.dueDate.split('T')[0] : new Date().toISOString().split('T')[0]);
                                    setSchedTime(topic.scheduledTime || defaultTime);
                                    setSchedulingTopicId(topic.id);
                                    handleTransitionToStage(topic, 'schedule', 'in-progress');
                                  } else {
                                    handleTransitionToStage(topic, stage, 'in-progress');
                                  }
                                }}
                                onLongPress={() => {
                                  if (stage === 'schedule') {
                                    if (state === 'in-progress') completeSchedule(topic);
                                  } else {
                                    handleTransitionToStage(topic, stage, 'completed');
                                  }
                                }}
                                onReset={() => resetWorkflowStage(topic, stage)}
                              />
                            </React.Fragment>
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
                const scheduledItems = topics.filter(t => t.inProgress && t.status === 'scheduled');
                const postedItems = topics.filter(t => t.inProgress && t.status === 'posted');

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
                        {scheduledItems.map(topic => (
                          <div 
                            key={topic.id}
                            className="p-3 bg-neutral-900/20 border border-neutral-850 rounded-lg space-y-2 font-mono text-[10px]"
                          >
                            <div className="flex justify-between items-start">
                              <div>
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

                              <span className="px-1.5 py-0.5 rounded border text-[8px] uppercase font-bold border-purple-900/40 text-purple-400 bg-purple-950/20">
                                Scheduled
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-neutral-500 text-[8px] pt-1">
                              <div>Created: {new Date(topic.createdDate).toLocaleDateString()}</div>
                              <div>
                                Release: {topic.dueDate ? new Date(topic.dueDate).toLocaleDateString() : 'N/A'}{' '}
                                {topic.scheduledTime ? `@ ${topic.scheduledTime}` : ''}
                              </div>
                            </div>
                          </div>
                        ))}
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
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              onSubmit={saveEditedTopic}
              className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between border-b border-neutral-900 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Edit Topic</h3>
                  <p className="text-[10px] text-neutral-500 mt-1">Changes sync everywhere this topic appears.</p>
                </div>
                <span className="text-[9px] uppercase text-blue-400 border border-blue-900/40 bg-blue-950/20 rounded px-2 py-1">{editingTopic.status}</span>
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
                <label className="block text-[9px] uppercase text-neutral-500 font-mono">
                  Due date
                  <input
                    type="date"
                    value={editingTopic.dueDate?.split('T')[0] || ''}
                    onChange={event => {
                      const defaultTime = editingTopic.channel === 'LearnDriven' ? '21:09' : '19:07';
                      const timePart = editingTopic.scheduledTime || defaultTime;
                      setEditingTopic({ ...editingTopic, dueDate: event.target.value ? new Date(`${event.target.value}T${timePart}:00`).toISOString() : null });
                    }}
                    className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 px-2 py-2 text-xs normal-case text-white outline-none"
                  />
                </label>
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

              <div className="flex justify-end gap-2 border-t border-neutral-900 pt-3 text-[10px] font-mono">
                <button type="button" onClick={() => setEditingTopic(null)} className="px-3 py-1.5 text-neutral-400 hover:text-white">Cancel</button>
                <button type="submit" className="rounded bg-blue-500 px-4 py-1.5 font-bold text-black hover:bg-blue-400">Save Changes</button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

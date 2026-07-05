import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity, AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2,
  CircleDot, Clock3, Flame, Gauge, Layers3, ListTodo, Radio,
  ShieldCheck, Sparkles, Target, TrendingUp, Zap
} from 'lucide-react';
import type { CycleGoal, Experiment, CreatorInsight, Topic, TopicActivity, VideoRecord, SessionRecord, WorkdaySession, TaskTimerRecord } from '../types';
import { getTopicCurrentWorkflow } from '../services/topicWorkflow';
import ProductionPipelineMap from './ProductionPipelineMap';

interface CommandCenterViewProps {
  topics: Topic[];
  videos: VideoRecord[];
  experiments: Experiment[];
  sessions: SessionRecord[];
  workdaySession: WorkdaySession | null;
  taskTimers: TaskTimerRecord[];
  insights: CreatorInsight[];
  cycleGoals: CycleGoal | null;
  scorecard: any;
  activities: TopicActivity[];
  onTabChange: (tab: string) => void;
  onOpenTopicPipeline: (topicId?: string, action?: 'script' | 'shoot' | 'edit' | 'schedule' | 'post' | 'unblock') => void;
  setSelectedVideoId: (videoId: string | null) => void;
}

const stageMeta = [
  { key: 'topic', label: 'Ideas', color: '#a855f7' },
  { key: 'scripted', label: 'Scripted', color: '#3b82f6' },
  { key: 'shot', label: 'Shot', color: '#f59e0b' },
  { key: 'edited', label: 'Edited', color: '#10b981' },
  { key: 'scheduled', label: 'Scheduled', color: '#ec4899' },
  { key: 'posted', label: 'Posted', color: '#22c55e' }
] as const;

const timeValue = (value?: string | null) => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const relativeTime = (value: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - timeValue(value)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const deadlineText = (dueDate: string | null) => {
  if (!dueDate) return 'No deadline';
  const hours = Math.round((timeValue(dueDate) - Date.now()) / 36e5);
  if (hours < 0) return `${Math.abs(hours)}h overdue`;
  if (hours < 24) return `${hours}h remaining`;
  return `${Math.ceil(hours / 24)}d remaining`;
};

const compactDuration = (ms: number) => {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  if (totalMinutes === 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const nextActionForTopic = (topic: Topic) => {
  if (topic.blockedReason) return `Resolve blocker: ${topic.blockedReason}`;
  const workflow = getTopicCurrentWorkflow(topic);
  if (workflow.state === 'in-progress') {
    return ({
      script: 'Finish the script, then hold Script to mark it Scripted',
      shoot: 'Finish recording, then hold Shoot to mark it Shot',
      edit: 'Finish the edit, then hold Edit to mark it Edited',
      schedule: 'Choose the publish date and time, then complete scheduling',
      post: 'Finish publishing, then hold Post to mark it Posted'
    } as const)[workflow.stage];
  }
  return ({
    topic: topic.inProgress ? 'Start scripting - click Script' : 'Start the pipeline, then begin scripting',
    scripted: 'Start recording - click Shoot',
    shot: 'Start post-production - click Edit',
    edited: 'Set the publish date and time - click Schedule',
    scheduled: 'Verify the release and publish at the scheduled time',
    posted: 'Review performance and capture learnings'
  } as const)[topic.status];
};

const actionTargetForTopic = (topic: Topic): 'script' | 'shoot' | 'edit' | 'schedule' | 'post' | 'unblock' => {
  if (topic.blockedReason) return 'unblock';
  const workflow = getTopicCurrentWorkflow(topic);
  if (workflow.state === 'in-progress') return workflow.stage;
  return ({ topic: 'script', scripted: 'shoot', shot: 'edit', edited: 'schedule', scheduled: 'post', posted: 'post' } as const)[topic.status];
};

export default function CommandCenterView({
  topics, videos, experiments, sessions, workdaySession, taskTimers, insights, cycleGoals, activities, onTabChange, onOpenTopicPipeline
}: CommandCenterViewProps) {
  const [showAttentionPreview, setShowAttentionPreview] = useState(false);
  const attentionPreviewCloseTimer = useRef<number | null>(null);
  const goalTopicIds = useMemo(
    () => new Set((workdaySession?.goals || []).map(goal => goal.topicId)),
    [workdaySession]
  );

  const model = useMemo(() => {
    const now = Date.now();
    const incomplete = topics.filter(topic => topic.status !== 'posted');
    const blocked = incomplete.filter(topic => Boolean(topic.blockedReason));
    const overdue = incomplete.filter(topic => topic.dueDate && timeValue(topic.dueDate) < now);
    const dueSoon = incomplete.filter(topic => {
      const due = timeValue(topic.dueDate);
      return due >= now && due <= now + 24 * 36e5;
    });

    // Score each topic for urgency — the higher the score, the higher in queue
    const urgencyScore = (topic: Topic): number => {
      let score = 0;
      if (topic.blockedReason) score += 1000;
      if (topic.dueDate && timeValue(topic.dueDate) < now) score += 500; // overdue
      if (dueSoon.includes(topic)) score += 300; // due in 24h
      if (goalTopicIds.has(topic.id)) score += 200; // in today's goals
      if (topic.inProgress) score += 100;
      score += (topic.priority || 1) * 20; // higher priority = higher rank
      // Closer due date = more urgent (invert: smaller remaining = higher score)
      if (topic.dueDate) {
        const remaining = timeValue(topic.dueDate) - now;
        // +150 if within 7 days, +80 if within 14 days
        if (remaining < 7 * 864e5) score += 150;
        else if (remaining < 14 * 864e5) score += 80;
      }
      return score;
    };

    // Sort ALL incomplete topics by urgency score descending, then show at least 5
    const queue = [...incomplete]
      .sort((a, b) => urgencyScore(b) - urgencyScore(a))
      .slice(0, Math.max(5, Math.min(8, incomplete.length)));

    // "attention" set remains for the stat tile (blocked + overdue + due soon)
    const attention = incomplete.filter(t => t.blockedReason || overdue.includes(t) || dueSoon.includes(t));

    const posted = topics.filter(topic => topic.status === 'posted').length;
    const scheduled = topics.filter(topic => topic.status === 'scheduled').length;
    const completion = topics.length ? Math.round((posted / topics.length) * 100) : 0;
    const todayKey = new Date().toDateString();
    const actionsToday = activities.filter(item => new Date(item.timestamp).toDateString() === todayKey).length;
    const recent = [...activities].sort((a, b) => timeValue(b.timestamp) - timeValue(a.timestamp)).slice(0, 7);
    const maxStage = Math.max(1, ...stageMeta.map(stage => topics.filter(topic => topic.status === stage.key).length));
    const stages = stageMeta.map(stage => ({
      ...stage,
      count: topics.filter(topic => topic.status === stage.key).length,
      width: Math.max(4, Math.round((topics.filter(topic => topic.status === stage.key).length / maxStage) * 100))
    }));
    const channels = (['LearnDriven', 'DecodeWorthy'] as const).map(channel => {
      const channelTopics = topics.filter(topic => topic.channel === channel);
      const done = channelTopics.filter(topic => topic.status === 'posted').length;
      const atRisk = channelTopics.filter(topic => topic.blockedReason || overdue.includes(topic)).length;
      return { channel, total: channelTopics.length, done, atRisk, active: channelTopics.length - done };
    });
    const activityDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now - (6 - index) * 864e5);
      const count = activities.filter(item => new Date(item.timestamp).toDateString() === date.toDateString()).length;
      return { label: date.toLocaleDateString([], { weekday: 'short' }).slice(0, 2), count };
    });
    const maxActivity = Math.max(1, ...activityDays.map(day => day.count));
    return {
      incomplete, blocked, overdue, dueSoon, attention, queue, posted, scheduled,
      completion, actionsToday, recent, stages, channels, activityDays, maxActivity
    };
  }, [topics, activities, goalTopicIds]);

  const warningInsights = insights.filter(item => item.type === 'warning' || item.type === 'recommendation').slice(0, 3);
  const cycleTarget = cycleGoals ? [
    cycleGoals.learnDrivenShorts, cycleGoals.learnDrivenLong,
    cycleGoals.learnDrivenMembers, cycleGoals.decodeWorthyShorts
  ].reduce<number>((sum, value) => sum + (value || 0), 0) : 0;
  const cycleDelivered = topics.filter(topic => topic.status === 'posted').length;
  const cycleProgress = cycleTarget ? Math.min(100, Math.round((cycleDelivered / cycleTarget) * 100)) : 0;
  const weekExecution = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return {
        key: date.toDateString(),
        label: date.toLocaleDateString([], { weekday: 'short' }).slice(0, 2),
        dateLabel: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        sessions: [] as SessionRecord[],
        activeMs: 0,
        productiveMs: 0,
        completedGoals: 0,
        touchedGoals: 0,
        droppedGoals: 0,
        pendingGoals: 0,
        breaks: 0,
        taskTimers: 0
      };
    });
    const dayIndex = new Map(days.map((day, index) => [day.key, index] as const));

    sessions.forEach(session => {
      const index = dayIndex.get(new Date(session.endedAt).toDateString());
      if (index === undefined) return;
      const bucket = days[index];
      bucket.sessions.push(session);
      bucket.activeMs += session.accumulatedActiveMs;
      bucket.productiveMs += session.productiveActiveMs ?? Math.round(session.accumulatedActiveMs * ((session.productivityPercent ?? 100) / 100));
      bucket.completedGoals += session.achievedGoals.length;
      bucket.touchedGoals += session.achievedGoals.length + session.pendingGoals.length + session.droppedGoals.length;
      bucket.droppedGoals += session.droppedGoals.length;
      bucket.pendingGoals += session.pendingGoals.length;
      bucket.breaks += session.breaksCount ?? 0;
      bucket.taskTimers += session.taskTimers?.length ?? 0;
    });

    const totals = days.reduce((sum, day) => {
      sum.activeMs += day.activeMs;
      sum.productiveMs += day.productiveMs;
      sum.completedGoals += day.completedGoals;
      sum.touchedGoals += day.touchedGoals;
      sum.droppedGoals += day.droppedGoals;
      sum.pendingGoals += day.pendingGoals;
      sum.breaks += day.breaks;
      sum.taskTimers += day.taskTimers;
      return sum;
    }, { activeMs: 0, productiveMs: 0, completedGoals: 0, touchedGoals: 0, droppedGoals: 0, pendingGoals: 0, breaks: 0, taskTimers: 0 });

    const productivity = totals.activeMs ? Math.round((totals.productiveMs / totals.activeMs) * 100) : 0;
    const completionRate = totals.touchedGoals ? Math.round((totals.completedGoals / totals.touchedGoals) * 100) : 0;
    const activeHours = totals.activeMs / 36e5;
    const throughput = activeHours ? (totals.completedGoals / activeHours) : 0;
    const loadCleared = totals.completedGoals - totals.droppedGoals;
    const firstHalf = days.slice(0, 3);
    const secondHalf = days.slice(4);
    const averageProductivity = (segment: typeof days) => {
      const active = segment.reduce((sum, day) => sum + day.activeMs, 0);
      const productive = segment.reduce((sum, day) => sum + day.productiveMs, 0);
      return active ? Math.round((productive / active) * 100) : 0;
    };
    const productivityMomentum = averageProductivity(secondHalf) - averageProductivity(firstHalf);
    const maxActive = Math.max(1, ...days.map(day => day.activeMs));

    return {
      days,
      totals,
      productivity,
      completionRate,
      throughput,
      loadCleared,
      productivityMomentum,
      maxActive
    };
  }, [sessions]);
  const systemTone = model.blocked.length || model.overdue.length ? 'ACTION REQUIRED' : model.dueSoon.length ? 'WATCH CLOSELY' : 'SYSTEM CLEAR';
  const systemColor = model.blocked.length || model.overdue.length ? 'rose' : model.dueSoon.length ? 'amber' : 'emerald';
  const attentionItems = model.queue.filter(topic => model.attention.some(item => item.id === topic.id));
  const visibleAttentionItems = attentionItems.length > 0 ? attentionItems : model.attention;
  const openTopic = (topic: Topic) => onOpenTopicPipeline(topic.id, actionTargetForTopic(topic));
  const openAttentionQueue = () => {
    const section = document.getElementById('attention-queue-panel');
    if (!section) {
      onOpenTopicPipeline();
      return;
    }
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('command-action-target');
    window.setTimeout(() => section.classList.remove('command-action-target'), 1400);
  };
  const showAttentionPopover = () => {
    if (attentionPreviewCloseTimer.current) {
      window.clearTimeout(attentionPreviewCloseTimer.current);
      attentionPreviewCloseTimer.current = null;
    }
    setShowAttentionPreview(true);
  };
  const hideAttentionPopover = () => {
    if (attentionPreviewCloseTimer.current) {
      window.clearTimeout(attentionPreviewCloseTimer.current);
    }
    attentionPreviewCloseTimer.current = window.setTimeout(() => {
      setShowAttentionPreview(false);
      attentionPreviewCloseTimer.current = null;
    }, 160);
  };
  useEffect(() => () => {
    if (attentionPreviewCloseTimer.current) window.clearTimeout(attentionPreviewCloseTimer.current);
  }, []);
  const openActivity = (activity: TopicActivity) => {
    const topic = activity.topicId ? topics.find(item => item.id === activity.topicId) : undefined;
    if (topic) return onOpenTopicPipeline(topic.id, actionTargetForTopic(topic));
    onTabChange(activity.targetTab || 'logs');
  };

  return (
    <div className="space-y-5 pb-10">
      <ProductionPipelineMap
        topics={topics}
        videos={videos}
        activities={activities}
        sessions={sessions}
        taskTimers={taskTimers}
        workdaySession={workdaySession}
        focusTopic={model.queue[0] ?? null}
        dueSoonCount={model.dueSoon.length}
        firstAttentionTopicId={model.attention[0]?.id}
        firstAttentionAction={model.attention[0] ? actionTargetForTopic(model.attention[0]) : undefined}
        onOpenPipeline={(topicId, action) => onOpenTopicPipeline(topicId, action)}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Needs attention', value: model.attention.length, note: `${model.blocked.length} blocked`, icon: AlertTriangle, iconClass: 'text-rose-400', action: openAttentionQueue },
          { label: 'In production', value: model.incomplete.length, note: `${model.scheduled} scheduled`, icon: Layers3, iconClass: 'text-amber-400', action: () => onOpenTopicPipeline() },
          { label: 'Completion', value: `${model.completion}%`, note: `${model.posted} posted`, icon: Gauge, iconClass: 'text-emerald-400', action: () => onOpenTopicPipeline() },
          { label: 'Actions today', value: model.actionsToday, note: 'live audit events', icon: Activity, iconClass: 'text-blue-400', action: () => onTabChange('logs') },
          { label: 'Sessions', value: sessions.length, note: 'completed', icon: Sparkles, iconClass: 'text-purple-400', action: () => onTabChange('sessions') }
        ].map(card => (
          <div
            key={card.label}
            className="relative"
            onMouseEnter={() => card.label === 'Needs attention' && showAttentionPopover()}
            onMouseLeave={() => card.label === 'Needs attention' && hideAttentionPopover()}
            onFocus={() => card.label === 'Needs attention' && showAttentionPopover()}
            onBlur={() => card.label === 'Needs attention' && hideAttentionPopover()}
          >
            <button type="button" onClick={card.action} className="group w-full rounded-xl border border-neutral-850 bg-neutral-950/65 p-4 text-left backdrop-blur transition hover:-translate-y-0.5 hover:border-neutral-600 hover:bg-neutral-900/70">
            <div className="flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">{card.label}</span><span className="flex items-center gap-2"><card.icon className={`h-4 w-4 ${card.iconClass}`} /><ArrowUpRight className="h-3 w-3 text-neutral-700 group-hover:text-neutral-300" /></span></div>
            <div className="mt-3 text-2xl font-bold text-neutral-100">{card.value}</div>
              <div className="mt-1 font-mono text-[9px] text-neutral-600">
                {card.label === 'Needs attention' && visibleAttentionItems[0]
                  ? `Next: ${visibleAttentionItems[0].name} · ${nextActionForTopic(visibleAttentionItems[0])}`
                  : card.note}
              </div>
            </button>
            {card.label === 'Needs attention' && showAttentionPreview && visibleAttentionItems.length > 0 && (
              <div
                className="absolute left-0 top-[calc(100%+10px)] z-20 w-[320px] overflow-hidden rounded-xl border border-rose-900/40 bg-neutral-950/95 p-3 shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur"
                onMouseEnter={showAttentionPopover}
                onMouseLeave={hideAttentionPopover}
                onFocus={showAttentionPopover}
                onBlur={hideAttentionPopover}
              >
                <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                  <span className="font-mono text-[9px] uppercase tracking-[.24em] text-rose-300">Next attention</span>
                  <span className="font-mono text-[9px] text-neutral-500">{visibleAttentionItems.length} item{visibleAttentionItems.length === 1 ? '' : 's'}</span>
                </div>
                <div className="mt-2 space-y-2">
                  {visibleAttentionItems.slice(0, 3).map((topic, index) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => openTopic(topic)}
                    title={`Open ${topic.name}`}
                    className="flex w-full items-start gap-2 rounded-lg border border-neutral-900 bg-neutral-900/40 px-2 py-2 text-left transition hover:border-rose-900/50 hover:bg-rose-950/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400 cursor-pointer"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neutral-950 font-mono text-[8px] text-neutral-500">
                      0{index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-neutral-100">{topic.name}</span>
                      <span className="mt-0.5 block font-mono text-[8px] text-rose-300">
                        {nextActionForTopic(topic)}
                      </span>
                    </span>
                    <span className="mt-0.5 rounded border border-rose-900/40 bg-rose-950/20 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-rose-200">
                      Go
                    </span>
                  </button>
                  ))}
                </div>
                <div className="mt-2 font-mono text-[9px] text-neutral-600">
                  Click any item to jump straight to that exact action.
                </div>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div id="attention-queue-panel" className="rounded-2xl border border-rose-950/50 bg-neutral-950/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-white"><Flame className="h-4 w-4 text-rose-400" /> Attention spotlight</div>
              <p className="mt-1 text-[11px] text-neutral-500">All items that need your immediate attention, listed with the exact next action.</p>
            </div>
            <button onClick={() => onOpenTopicPipeline()} className="flex items-center gap-1 font-mono text-[10px] text-rose-400 hover:text-rose-300">Open pipeline <ArrowUpRight className="h-3 w-3" /></button>
          </div>
          {visibleAttentionItems.length > 0 ? (
            <div className="mb-4 space-y-2">
              {visibleAttentionItems.map((topic, index) => {
                const isBlocked = Boolean(topic.blockedReason);
                const isOverdue = Boolean(topic.dueDate && timeValue(topic.dueDate) < Date.now());
                const isDueSoon = Boolean(topic.dueDate && !isOverdue && timeValue(topic.dueDate) <= Date.now() + 24 * 36e5);
                const actionTarget = actionTargetForTopic(topic);
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => openTopic(topic)}
                    title={`Open ${topic.name}`}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                      isBlocked || isOverdue
                        ? 'border-rose-950/50 bg-rose-950/5 hover:border-rose-900/60 hover:bg-rose-950/10'
                        : isDueSoon
                          ? 'border-amber-950/40 bg-amber-950/5 hover:border-amber-900/50 hover:bg-amber-950/10'
                          : 'border-neutral-850 bg-neutral-900/30 hover:border-neutral-700 hover:bg-neutral-900/50'
                    } cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400`}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-950 font-mono text-[10px] text-neutral-500">0{index + 1}</span>
                    <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${isBlocked ? 'bg-rose-500 shadow-[0_0_9px_#f43f5e]' : isOverdue ? 'bg-rose-400' : isDueSoon ? 'bg-amber-400 shadow-[0_0_9px_#f59e0b]' : 'bg-neutral-500'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs font-semibold text-neutral-200">{topic.name}</span>
                        {isOverdue && <span className="rounded bg-rose-950/60 px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase text-rose-300 border border-rose-900/40">Overdue</span>}
                        {isDueSoon && !isOverdue && <span className="rounded bg-amber-950/40 px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase text-amber-300 border border-amber-900/30">Due Soon</span>}
                        {isBlocked && <span className="rounded bg-rose-950/60 px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase text-rose-400 border border-rose-900/40">Blocked</span>}
                      </span>
                      <span className="mt-1 block text-[10px] font-medium text-rose-300">
                        <span className="mr-1 font-mono text-[8px] uppercase tracking-wider text-neutral-600">Next</span>{nextActionForTopic(topic)}
                      </span>
                    </span>
                    <span className="mt-1 rounded border border-rose-900/40 bg-rose-950/20 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-rose-200">
                      Open
                    </span>
                    <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-700 transition group-hover:text-rose-400" />
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="space-y-2.5">
            {model.queue.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-4"><ShieldCheck className="h-5 w-5 text-emerald-400" /><div><div className="text-sm font-semibold text-emerald-300">No open topics</div><div className="text-[11px] text-neutral-500">Everything is published. Add a topic to start the next cycle.</div></div></div>
            ) : model.queue.map((topic, index) => {
              const isBlocked = Boolean(topic.blockedReason);
              const isOverdue = Boolean(topic.dueDate && timeValue(topic.dueDate) < Date.now());
              const isDueSoon = Boolean(topic.dueDate && !isOverdue && timeValue(topic.dueDate) <= Date.now() + 24 * 36e5);
              const isRisk = isBlocked || isOverdue;
              const isGoal = goalTopicIds.has(topic.id);
              const nextAction = nextActionForTopic(topic);
              const actionTarget = actionTargetForTopic(topic);
              const priorityLabel = ({ 1: 'Neutral', 2: 'Attention', 3: 'Hot', 4: 'Important', 5: 'Automatic' } as const)[topic.priority as 1|2|3|4|5] ?? 'Normal';
              const eligibilityTags = [
                topic.neutral && 'Neutral',
                topic.productTag && 'Product Tag',
                topic.viral && 'Viral',
                topic.pinnedPromo && 'Pinned Promo',
                topic.below8Min && '<8 min',
              ].filter(Boolean) as string[];
              return (
                <button key={topic.id} onClick={() => onOpenTopicPipeline(topic.id, actionTarget)} className={`group flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${isRisk ? 'border-rose-950/50 bg-rose-950/5 hover:border-rose-900/60 hover:bg-rose-950/10' : isDueSoon ? 'border-amber-950/40 bg-amber-950/5 hover:border-amber-900/50 hover:bg-amber-950/10' : 'border-neutral-850 bg-neutral-900/30 hover:border-neutral-700 hover:bg-neutral-900/50'}`}>
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-950 font-mono text-[10px] text-neutral-500">0{index + 1}</span>
                  <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${isBlocked ? 'bg-rose-500 shadow-[0_0_9px_#f43f5e]' : isOverdue ? 'bg-rose-400' : isDueSoon ? 'bg-amber-400 shadow-[0_0_9px_#f59e0b]' : isGoal ? 'bg-purple-400' : 'bg-neutral-500'}`} />
                  <span className="min-w-0 flex-1">
                    {/* Title + urgent/goal badges */}
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-neutral-200">{topic.name}</span>
                      {isOverdue && <span className="rounded bg-rose-950/60 px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase text-rose-300 border border-rose-900/40">Overdue</span>}
                      {isDueSoon && !isOverdue && <span className="rounded bg-amber-950/40 px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase text-amber-300 border border-amber-900/30">Due Soon</span>}
                      {isGoal && <span className="rounded bg-purple-950/40 px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase text-purple-300 border border-purple-900/40">Today Goal</span>}
                      {isBlocked && <span className="rounded bg-rose-950/60 px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase text-rose-400 border border-rose-900/40">Blocked</span>}
                    </span>
                    {/* Metadata chips row 1: channel, status, priority, lane */}
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[8px] uppercase">
                      <span className="rounded bg-neutral-950 px-1.5 py-0.5 text-neutral-500 border border-neutral-800">{topic.channel}</span>
                      <span className="rounded bg-blue-950/30 px-1.5 py-0.5 text-blue-300 border border-blue-900/30">{topic.status}</span>
                      <span className={`rounded px-1.5 py-0.5 border ${topic.priority >= 4 ? 'bg-rose-950/20 text-rose-300 border-rose-900/30' : topic.priority === 3 ? 'bg-amber-950/20 text-amber-300 border-amber-900/30' : 'bg-neutral-950 text-neutral-400 border-neutral-800'}`}>P{topic.priority} · {priorityLabel}</span>
                      {topic.lane && <span className="rounded bg-indigo-950/20 px-1.5 py-0.5 text-indigo-300 border border-indigo-900/30">{topic.lane}</span>}
                      {topic.revenueLevel && <span className="rounded bg-emerald-950/20 px-1.5 py-0.5 text-emerald-400 border border-emerald-900/30">{topic.revenueLevel}</span>}
                    </span>
                    {/* Eligibility tags if any */}
                    {eligibilityTags.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap items-center gap-1 font-mono text-[7px]">
                        {eligibilityTags.map(tag => (
                          <span key={tag} className="rounded bg-cyan-950/20 px-1.5 py-0.5 text-cyan-400 border border-cyan-900/20">{tag}</span>
                        ))}
                      </span>
                    )}
                    {/* Next action hint */}
                    <span className={`mt-1.5 block text-[10px] font-medium ${isRisk ? 'text-rose-300' : isDueSoon ? 'text-amber-200' : 'text-neutral-400'}`}>
                      <span className="mr-1 font-mono text-[8px] uppercase tracking-wider text-neutral-600">Next</span>{nextAction}
                    </span>
                  </span>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 ml-1">
                    <span className={`rounded-md px-2 py-1 font-mono text-[9px] ${isBlocked ? 'bg-rose-950/40 text-rose-400' : isOverdue ? 'bg-rose-950/40 text-rose-400' : topic.dueDate ? 'bg-amber-950/30 text-amber-300' : 'bg-neutral-900 text-neutral-500'}`}>{isBlocked ? 'BLOCKED' : deadlineText(topic.dueDate)}</span>
                    <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 text-neutral-700 transition group-hover:text-rose-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5">
          <div className="mb-5 flex items-center justify-between"><div><div className="flex items-center gap-2 text-sm font-bold text-white"><TrendingUp className="h-4 w-4 text-cyan-400" /> Production flow</div><p className="mt-1 text-[11px] text-neutral-500">Live density by completed stage.</p></div><span className="font-mono text-[9px] text-neutral-600">{topics.length} TOTAL</span></div>
          <div className="space-y-3.5">
            {model.stages.map(stage => (
              <button type="button" onClick={() => onOpenTopicPipeline()} key={stage.key} className="grid w-full grid-cols-[74px_1fr_28px] items-center gap-3 rounded-md text-left transition hover:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-cyan-500">
                <span className="font-mono text-[10px] text-neutral-500">{stage.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-900"><motion.div initial={{ width: 0 }} animate={{ width: `${stage.width}%` }} transition={{ duration: .6 }} className="h-full rounded-full" style={{ backgroundColor: stage.color, boxShadow: `0 0 10px ${stage.color}55` }} /></div>
                <span className="text-right font-mono text-[10px] font-bold" style={{ color: stage.color }}>{stage.count}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => onTabChange('logs')} className="mt-6 block w-full border-t border-neutral-900 pt-4 text-left transition hover:border-cyan-900">
            <div className="mb-3 flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-wider text-neutral-600">7-day action pulse</span><span className="font-mono text-[9px] text-cyan-500">{activities.length} logged</span></div>
            <div className="flex h-20 items-end gap-2">
              {model.activityDays.map(day => <div key={day.label} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t bg-gradient-to-t from-cyan-900/50 to-cyan-400" style={{ height: `${Math.max(5, (day.count / model.maxActivity) * 58)}px` }} /><span className="font-mono text-[8px] text-neutral-600">{day.label}</span></div>)}
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-[1.05fr_.95fr]">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-950/40 bg-emerald-950/10 p-3">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Goal execution</div>
                  <div className="mt-2 text-lg font-bold text-white">{weekExecution.totals.completedGoals}/{weekExecution.totals.touchedGoals || 0}</div>
                  <div className="mt-1 font-mono text-[9px] text-emerald-200/70">completed this week</div>
                </div>
                <div className="rounded-xl border border-cyan-950/40 bg-cyan-950/10 p-3">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-cyan-300"><Gauge className="h-3.5 w-3.5" />Productivity</div>
                  <div className="mt-2 text-lg font-bold text-white">{weekExecution.productivity}%</div>
                  <div className="mt-1 font-mono text-[9px] text-cyan-200/70">{compactDuration(weekExecution.totals.productiveMs)} focused</div>
                </div>
                <div className="rounded-xl border border-purple-950/40 bg-purple-950/10 p-3">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-purple-300"><Layers3 className="h-3.5 w-3.5" />Load cleared</div>
                  <div className="mt-2 text-lg font-bold text-white">{weekExecution.loadCleared}</div>
                  <div className="mt-1 font-mono text-[9px] text-purple-200/70">{weekExecution.totals.droppedGoals} dropped, {weekExecution.totals.pendingGoals} carried</div>
                </div>
              </div>
              <div className="rounded-xl border border-neutral-900 bg-neutral-950/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">Goal behavior trend</div>
                  <div className={`rounded border px-1.5 py-0.5 font-mono text-[8px] uppercase ${weekExecution.productivityMomentum >= 0 ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-300' : 'border-rose-900/40 bg-rose-950/20 text-rose-300'}`}>
                    {weekExecution.productivityMomentum >= 0 ? '+' : ''}{weekExecution.productivityMomentum}% vs early week
                  </div>
                </div>
                <div className="mt-1 font-mono text-[8px] text-neutral-600">{weekExecution.completionRate}% of goal outcomes finished</div>
                <div className="mt-3 space-y-2">
                  {weekExecution.days.map(day => {
                    const dayProductivity = day.activeMs ? Math.round((day.productiveMs / day.activeMs) * 100) : 0;
                    const goalRate = day.touchedGoals ? Math.round((day.completedGoals / day.touchedGoals) * 100) : 0;
                    return (
                      <div key={day.key} className="grid grid-cols-[40px_1fr_94px] items-center gap-2">
                        <div>
                          <div className="font-mono text-[9px] uppercase tracking-wider text-neutral-400">{day.label}</div>
                          <div className="font-mono text-[8px] text-neutral-600">{day.dateLabel}</div>
                        </div>
                        <div className="relative h-3 overflow-hidden rounded-full bg-neutral-900">
                          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-900/60 via-cyan-400 to-emerald-300" style={{ width: `${day.activeMs ? Math.max(8, Math.round((day.activeMs / weekExecution.maxActive) * 100)) : 8}%` }} />
                          <div className="absolute inset-y-0 right-0 rounded-full bg-emerald-400/80" style={{ width: `${Math.max(0, Math.min(100, dayProductivity))}%`, opacity: 0.35 }} />
                        </div>
                        <div className="text-right font-mono text-[8px] text-neutral-500">
                          <div className="text-neutral-300">{compactDuration(day.activeMs)} · {day.completedGoals} done</div>
                          <div className="text-neutral-600">{dayProductivity}% prod · {goalRate}% goal hit</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-neutral-900 pt-3">
                  <div className="rounded-lg border border-neutral-900 bg-neutral-950/60 px-2 py-1.5">
                    <div className="font-mono text-[8px] uppercase tracking-wider text-neutral-600">Avg throughput</div>
                    <div className="mt-1 text-sm font-bold text-white">{weekExecution.throughput.toFixed(1)}</div>
                  </div>
                  <div className="rounded-lg border border-neutral-900 bg-neutral-950/60 px-2 py-1.5">
                    <div className="font-mono text-[8px] uppercase tracking-wider text-neutral-600">Task timers</div>
                    <div className="mt-1 text-sm font-bold text-white">{weekExecution.totals.taskTimers}</div>
                  </div>
                  <div className="rounded-lg border border-neutral-900 bg-neutral-950/60 px-2 py-1.5">
                    <div className="font-mono text-[8px] uppercase tracking-wider text-neutral-600">Breaks logged</div>
                    <div className="mt-1 text-sm font-bold text-white">{weekExecution.totals.breaks}</div>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between"><div><div className="flex items-center gap-2 text-sm font-bold text-white"><Activity className="h-4 w-4 text-blue-400" /> Latest movement</div><p className="mt-1 text-[11px] text-neutral-500">Newest user actions across production.</p></div><button onClick={() => onTabChange('logs')} className="font-mono text-[10px] text-blue-400 hover:text-blue-300">View all →</button></div>
          <div className="divide-y divide-neutral-900">
            {model.recent.length ? model.recent.map(item => (
              <button type="button" onClick={() => openActivity(item)} key={item.id} className="group flex w-full items-center gap-3 py-3 text-left transition hover:bg-blue-950/10 focus-visible:ring-1 focus-visible:ring-blue-500"><CircleDot className={`h-4 w-4 shrink-0 ${item.channel === 'LearnDriven' ? 'text-blue-400' : 'text-emerald-400'}`} /><div className="min-w-0 flex-1"><div className="truncate text-xs text-neutral-300"><span className="font-semibold text-white group-hover:text-blue-300">{item.topicName}</span> - {item.action}</div><div className="mt-1 font-mono text-[9px] uppercase text-neutral-600">{item.channel}</div></div><span className="shrink-0 font-mono text-[9px] text-neutral-600">{relativeTime(item.timestamp)}</span><ArrowUpRight className="h-3 w-3 shrink-0 text-neutral-700 group-hover:text-blue-400" /></button>
            )) : <div className="py-12 text-center font-mono text-[10px] text-neutral-600">No content movement logged yet.</div>}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><Target className="h-4 w-4 text-purple-400" /> Channel balance</div>
            <div className="space-y-4">{model.channels.map(channel => (
              <button type="button" onClick={() => onOpenTopicPipeline()} key={channel.channel} className="group block w-full rounded-lg p-1 text-left transition hover:bg-neutral-900/50"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-neutral-300 group-hover:text-white">{channel.channel}</span><span className="font-mono text-[9px] text-neutral-600">{channel.active} active - {channel.done} done</span></div><div className="flex h-2 overflow-hidden rounded-full bg-neutral-900"><div className={channel.channel === 'LearnDriven' ? 'bg-blue-500' : 'bg-emerald-500'} style={{ width: `${channel.total ? (channel.done / channel.total) * 100 : 0}%` }} /><div className={channel.channel === 'LearnDriven' ? 'bg-blue-950' : 'bg-emerald-950'} style={{ flex: 1 }} /></div>{channel.atRisk > 0 && <div className="mt-1.5 font-mono text-[9px] text-rose-400">{channel.atRisk} need attention</div>}</button>
            ))}</div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Safety signals</div>
            <div className="space-y-2">
              {[
                { ok: model.blocked.length === 0, label: model.blocked.length ? `${model.blocked.length} blocked topics` : 'No blocked production', action: () => { const t = model.blocked[0]; t ? onOpenTopicPipeline(t.id, 'unblock') : onOpenTopicPipeline(); } },
                { ok: model.overdue.length === 0, label: model.overdue.length ? `${model.overdue.length} overdue deadlines` : 'Deadlines controlled', action: () => { const t = model.overdue[0]; t ? onOpenTopicPipeline(t.id, actionTargetForTopic(t)) : onOpenTopicPipeline(); } },
                { ok: model.scheduled > 0, label: model.scheduled ? `${model.scheduled} releases scheduled` : 'No release scheduled', action: () => onOpenTopicPipeline() },
                { ok: activities.length > 0, label: activities.length ? 'Audit trail active' : 'No activity history', action: () => onTabChange('logs') }
              ].map(signal => <button type="button" onClick={signal.action} key={signal.label} className="group flex w-full items-center gap-2 rounded-lg bg-neutral-900/35 px-3 py-2 text-left transition hover:bg-neutral-800/60"><span className={`h-1.5 w-1.5 rounded-full ${signal.ok ? 'bg-emerald-400' : 'bg-rose-500'}`} /><span className={`flex-1 text-[10px] ${signal.ok ? 'text-neutral-400' : 'text-rose-300'}`}>{signal.label}</span><ArrowUpRight className="h-3 w-3 text-neutral-700 group-hover:text-neutral-300" /></button>)}
            </div>
          </div>
        </div>
      </section>

      {(warningInsights.length > 0 || sessions.length > 0 || cycleGoals) && (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5"><button type="button" onClick={() => onTabChange('insights')} className="group mb-4 flex w-full items-center justify-between text-left text-sm font-bold text-white"><span className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-400" /> Strategic watchlist</span><ArrowUpRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-amber-400" /></button><div className="space-y-2.5">{warningInsights.length ? warningInsights.map(item => <button type="button" onClick={() => onTabChange('insights')} key={item.id} className="group block w-full rounded-xl border border-neutral-900 bg-neutral-900/25 p-3 text-left transition hover:border-amber-900/50"><div className="flex items-center justify-between gap-2 text-xs font-semibold text-neutral-200"><span>{item.title}</span><ArrowUpRight className="h-3 w-3 text-neutral-700 group-hover:text-amber-400" /></div><div className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-neutral-500">{item.description}</div></button>) : <div className="text-[10px] text-neutral-600">No strategic warnings.</div>}</div></div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5"><button type="button" onClick={() => onTabChange('sessions')} className="group mb-4 flex w-full items-center justify-between text-left text-sm font-bold text-white"><span className="flex items-center gap-2"><ListTodo className="h-4 w-4 text-purple-400" /> Active initiatives</span><ArrowUpRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-purple-400" /></button><div className="space-y-2.5">{cycleGoals && <button type="button" onClick={() => onTabChange('actionhub')} className="group block w-full rounded-xl border border-purple-900/25 bg-purple-950/10 p-3 text-left transition hover:border-purple-700/60"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-neutral-200">{cycleGoals.monthName} publishing cycle</span><span className="flex items-center gap-2 font-mono text-[10px] text-purple-300">{cycleDelivered}/{cycleTarget || '-'}<ArrowUpRight className="h-3 w-3" /></span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-900"><div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-cyan-400" style={{ width: `${cycleProgress}%` }} /></div><div className="mt-1.5 font-mono text-[9px] text-neutral-600">{cycleProgress}% of target delivered</div></button>}{sessions.length > 0 && (() => {
            const latest = [...sessions].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime())[0];
            const totalGoals = latest.achievedGoals.length + latest.droppedGoals.length + latest.pendingGoals.length;
            return <button type="button" onClick={() => onTabChange('sessions')} className="flex w-full items-center justify-between rounded-xl border border-neutral-900 bg-neutral-900/25 p-3 text-left hover:border-purple-900/50"><span><span className="block text-xs font-semibold text-neutral-200">Last session · {new Date(latest.endedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span><span className="mt-1 block text-[10px] text-neutral-500">{latest.achievedGoals.length}/{totalGoals || 0} goals achieved</span></span><ArrowUpRight className="h-3.5 w-3.5 text-purple-400" /></button>;
          })()}{sessions.length === 0 && !cycleGoals && <div className="text-[10px] text-neutral-600">No sessions recorded yet.</div>}</div></div>
        </section>
      )}
    </div>
  );
}

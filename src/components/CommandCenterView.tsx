import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Activity, AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2,
  CircleDot, Clock3, Flame, Gauge, Layers3, ListTodo, Radio,
  ShieldCheck, Sparkles, Target, TrendingUp, Zap
} from 'lucide-react';
import type { CycleGoal, Experiment, CreatorInsight, Topic, TopicActivity, VideoRecord } from '../types';
import { getTopicCurrentWorkflow } from '../services/topicWorkflow';

interface CommandCenterViewProps {
  topics: Topic[];
  videos: VideoRecord[];
  experiments: Experiment[];
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
    topic: topic.inProgress ? 'Start scripting — click Script' : 'Start the pipeline, then begin scripting',
    scripted: 'Start recording — click Shoot',
    shot: 'Start post-production — click Edit',
    edited: 'Set the publish date and time — click Schedule',
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
  topics, videos, experiments, insights, cycleGoals, activities, onTabChange, onOpenTopicPipeline
}: CommandCenterViewProps) {
  const model = useMemo(() => {
    const now = Date.now();
    const incomplete = topics.filter(topic => topic.status !== 'posted');
    const blocked = incomplete.filter(topic => Boolean(topic.blockedReason));
    const overdue = incomplete.filter(topic => topic.dueDate && timeValue(topic.dueDate) < now);
    const dueSoon = incomplete.filter(topic => {
      const due = timeValue(topic.dueDate);
      return due >= now && due <= now + 24 * 36e5;
    });
    const attention = [...incomplete]
      .filter(topic => topic.blockedReason || overdue.includes(topic) || dueSoon.includes(topic))
      .sort((a, b) => {
        const risk = (topic: Topic) => topic.blockedReason ? 0 : overdue.includes(topic) ? 1 : 2;
        return risk(a) - risk(b) || timeValue(a.dueDate) - timeValue(b.dueDate) || a.priority - b.priority;
      });
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
      incomplete, blocked, overdue, dueSoon, attention, posted, scheduled,
      completion, actionsToday, recent, stages, channels, activityDays, maxActivity
    };
  }, [topics, activities]);

  const activeExperiments = experiments.filter(item => item.status === 'active');
  const warningInsights = insights.filter(item => item.type === 'warning' || item.type === 'recommendation').slice(0, 3);
  const cycleTarget = cycleGoals ? [
    cycleGoals.learnDrivenShorts, cycleGoals.learnDrivenLong,
    cycleGoals.learnDrivenMembers, cycleGoals.decodeWorthyShorts
  ].reduce<number>((sum, value) => sum + (value || 0), 0) : 0;
  const cycleDelivered = topics.filter(topic => topic.status === 'posted').length;
  const cycleProgress = cycleTarget ? Math.min(100, Math.round((cycleDelivered / cycleTarget) * 100)) : 0;
  const systemTone = model.blocked.length || model.overdue.length ? 'ACTION REQUIRED' : model.dueSoon.length ? 'WATCH CLOSELY' : 'SYSTEM CLEAR';
  const systemColor = model.blocked.length || model.overdue.length ? 'rose' : model.dueSoon.length ? 'amber' : 'emerald';

  return (
    <div className="space-y-5 pb-10">
      <section className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-[linear-gradient(120deg,rgba(15,12,24,.98),rgba(5,14,18,.98))] p-5 md:p-6">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-purple-500/8 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.24em] text-cyan-400">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> Live content operations
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Creator Command Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-400">One screen for what needs action now, where production is accumulating, and what is safely moving forward.</p>
          </div>
          <div className={`min-w-[250px] rounded-xl border p-4 ${systemColor === 'rose' ? 'border-rose-900/50 bg-rose-950/20' : systemColor === 'amber' ? 'border-amber-900/50 bg-amber-950/20' : 'border-emerald-900/50 bg-emerald-950/20'}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-500">Operational state</span>
              <span className={`h-2.5 w-2.5 rounded-full ${systemColor === 'rose' ? 'bg-rose-500 shadow-[0_0_12px_#f43f5e]' : systemColor === 'amber' ? 'bg-amber-400 shadow-[0_0_12px_#f59e0b]' : 'bg-emerald-400 shadow-[0_0_12px_#10b981]'}`} />
            </div>
            <div className={`mt-2 font-mono text-lg font-bold ${systemColor === 'rose' ? 'text-rose-400' : systemColor === 'amber' ? 'text-amber-300' : 'text-emerald-400'}`}>{systemTone}</div>
            <div className="mt-1 text-xs text-neutral-500">{model.blocked.length} blocked · {model.overdue.length} overdue · {model.dueSoon.length} due soon</div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Needs attention', value: model.attention.length, note: `${model.blocked.length} blocked`, icon: AlertTriangle, iconClass: 'text-rose-400' },
          { label: 'In production', value: model.incomplete.length, note: `${model.scheduled} scheduled`, icon: Layers3, iconClass: 'text-amber-400' },
          { label: 'Completion', value: `${model.completion}%`, note: `${model.posted} posted`, icon: Gauge, iconClass: 'text-emerald-400' },
          { label: 'Actions today', value: model.actionsToday, note: 'live audit events', icon: Activity, iconClass: 'text-blue-400' },
          { label: 'Experiments', value: activeExperiments.length, note: 'currently active', icon: Sparkles, iconClass: 'text-purple-400' }
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-neutral-850 bg-neutral-950/65 p-4 backdrop-blur transition hover:border-neutral-700">
            <div className="flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">{card.label}</span><card.icon className={`h-4 w-4 ${card.iconClass}`} /></div>
            <div className="mt-3 text-2xl font-bold text-neutral-100">{card.value}</div>
            <div className="mt-1 font-mono text-[9px] text-neutral-600">{card.note}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-rose-950/50 bg-neutral-950/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div><div className="flex items-center gap-2 text-sm font-bold text-white"><Flame className="h-4 w-4 text-rose-400" /> Action queue</div><p className="mt-1 text-[11px] text-neutral-500">Ordered by consequence and deadline.</p></div>
            <button onClick={() => onOpenTopicPipeline()} className="flex items-center gap-1 font-mono text-[10px] text-rose-400 hover:text-rose-300">Open pipeline <ArrowUpRight className="h-3 w-3" /></button>
          </div>
          <div className="space-y-2.5">
            {model.attention.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-4"><ShieldCheck className="h-5 w-5 text-emerald-400" /><div><div className="text-sm font-semibold text-emerald-300">No urgent production risk</div><div className="text-[11px] text-neutral-500">Deadlines and blockers are currently controlled.</div></div></div>
            ) : model.attention.slice(0, 6).map((topic, index) => {
              const isBlocked = Boolean(topic.blockedReason);
              const isOverdue = topic.dueDate && timeValue(topic.dueDate) < Date.now();
              const nextAction = nextActionForTopic(topic);
              const actionTarget = actionTargetForTopic(topic);
              return (
                <button key={topic.id} onClick={() => onOpenTopicPipeline(topic.id, actionTarget)} className="group flex w-full items-center gap-3 rounded-xl border border-neutral-850 bg-neutral-900/30 p-3 text-left transition hover:border-rose-900/60 hover:bg-rose-950/10">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-950 font-mono text-[10px] text-neutral-500">0{index + 1}</span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${isBlocked || isOverdue ? 'bg-rose-500 shadow-[0_0_9px_#f43f5e]' : 'bg-amber-400'}`} />
                  <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-xs font-semibold text-neutral-200">{topic.name}</span><span className="font-mono text-[8px] uppercase text-neutral-600">{topic.channel} · {topic.status}</span></span><span className={`mt-1 block text-[10px] font-medium ${isBlocked || isOverdue ? 'text-rose-300' : 'text-amber-200'}`}><span className="mr-1 font-mono text-[8px] uppercase tracking-wider text-neutral-600">Next</span>{nextAction}</span></span>
                  <span className={`rounded-md px-2 py-1 font-mono text-[9px] ${isBlocked || isOverdue ? 'bg-rose-950/40 text-rose-400' : 'bg-amber-950/30 text-amber-300'}`}>{isBlocked ? 'BLOCKED' : deadlineText(topic.dueDate)}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-neutral-700 transition group-hover:text-rose-400" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5">
          <div className="mb-5 flex items-center justify-between"><div><div className="flex items-center gap-2 text-sm font-bold text-white"><TrendingUp className="h-4 w-4 text-cyan-400" /> Production flow</div><p className="mt-1 text-[11px] text-neutral-500">Live density by completed stage.</p></div><span className="font-mono text-[9px] text-neutral-600">{topics.length} TOTAL</span></div>
          <div className="space-y-3.5">
            {model.stages.map(stage => (
              <div key={stage.key} className="grid grid-cols-[74px_1fr_28px] items-center gap-3">
                <span className="font-mono text-[10px] text-neutral-500">{stage.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-900"><motion.div initial={{ width: 0 }} animate={{ width: `${stage.width}%` }} transition={{ duration: .6 }} className="h-full rounded-full" style={{ backgroundColor: stage.color, boxShadow: `0 0 10px ${stage.color}55` }} /></div>
                <span className="text-right font-mono text-[10px] font-bold" style={{ color: stage.color }}>{stage.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-neutral-900 pt-4">
            <div className="mb-3 flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-wider text-neutral-600">7-day action pulse</span><span className="font-mono text-[9px] text-cyan-500">{activities.length} logged</span></div>
            <div className="flex h-20 items-end gap-2">
              {model.activityDays.map(day => <div key={day.label} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t bg-gradient-to-t from-cyan-900/50 to-cyan-400" style={{ height: `${Math.max(5, (day.count / model.maxActivity) * 58)}px` }} /><span className="font-mono text-[8px] text-neutral-600">{day.label}</span></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between"><div><div className="flex items-center gap-2 text-sm font-bold text-white"><Activity className="h-4 w-4 text-blue-400" /> Latest movement</div><p className="mt-1 text-[11px] text-neutral-500">Newest user actions across production.</p></div><button onClick={() => onTabChange('logs')} className="font-mono text-[10px] text-blue-400 hover:text-blue-300">View all →</button></div>
          <div className="divide-y divide-neutral-900">
            {model.recent.length ? model.recent.map(item => (
              <div key={item.id} className="flex items-center gap-3 py-3"><CircleDot className={`h-4 w-4 shrink-0 ${item.channel === 'LearnDriven' ? 'text-blue-400' : 'text-emerald-400'}`} /><div className="min-w-0 flex-1"><div className="truncate text-xs text-neutral-300"><span className="font-semibold text-white">{item.topicName}</span> · {item.action}</div><div className="mt-1 font-mono text-[9px] uppercase text-neutral-600">{item.channel}</div></div><span className="shrink-0 font-mono text-[9px] text-neutral-600">{relativeTime(item.timestamp)}</span></div>
            )) : <div className="py-12 text-center font-mono text-[10px] text-neutral-600">No content movement logged yet.</div>}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><Target className="h-4 w-4 text-purple-400" /> Channel balance</div>
            <div className="space-y-4">{model.channels.map(channel => (
              <div key={channel.channel}><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-neutral-300">{channel.channel}</span><span className="font-mono text-[9px] text-neutral-600">{channel.active} active · {channel.done} done</span></div><div className="flex h-2 overflow-hidden rounded-full bg-neutral-900"><div className={channel.channel === 'LearnDriven' ? 'bg-blue-500' : 'bg-emerald-500'} style={{ width: `${channel.total ? (channel.done / channel.total) * 100 : 0}%` }} /><div className={channel.channel === 'LearnDriven' ? 'bg-blue-950' : 'bg-emerald-950'} style={{ flex: 1 }} /></div>{channel.atRisk > 0 && <div className="mt-1.5 font-mono text-[9px] text-rose-400">{channel.atRisk} need attention</div>}</div>
            ))}</div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Safety signals</div>
            <div className="space-y-2">
              {[
                { ok: model.blocked.length === 0, label: model.blocked.length ? `${model.blocked.length} blocked topics` : 'No blocked production' },
                { ok: model.overdue.length === 0, label: model.overdue.length ? `${model.overdue.length} overdue deadlines` : 'Deadlines controlled' },
                { ok: model.scheduled > 0, label: model.scheduled ? `${model.scheduled} releases scheduled` : 'No release scheduled' },
                { ok: activities.length > 0, label: activities.length ? 'Audit trail active' : 'No activity history' }
              ].map(signal => <div key={signal.label} className="flex items-center gap-2 rounded-lg bg-neutral-900/35 px-3 py-2"><span className={`h-1.5 w-1.5 rounded-full ${signal.ok ? 'bg-emerald-400' : 'bg-rose-500'}`} /><span className={`text-[10px] ${signal.ok ? 'text-neutral-400' : 'text-rose-300'}`}>{signal.label}</span></div>)}
            </div>
          </div>
        </div>
      </section>

      {(warningInsights.length > 0 || activeExperiments.length > 0 || cycleGoals) && (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5"><div className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><Zap className="h-4 w-4 text-amber-400" /> Strategic watchlist</div><div className="space-y-2.5">{warningInsights.length ? warningInsights.map(item => <div key={item.id} className="rounded-xl border border-neutral-900 bg-neutral-900/25 p-3"><div className="text-xs font-semibold text-neutral-200">{item.title}</div><div className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-neutral-500">{item.description}</div></div>) : <div className="text-[10px] text-neutral-600">No strategic warnings.</div>}</div></div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5"><div className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><ListTodo className="h-4 w-4 text-purple-400" /> Active initiatives</div><div className="space-y-2.5">{cycleGoals && <div className="rounded-xl border border-purple-900/25 bg-purple-950/10 p-3"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-neutral-200">{cycleGoals.monthName} publishing cycle</span><span className="font-mono text-[10px] text-purple-300">{cycleDelivered}/{cycleTarget || '—'}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-900"><div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-cyan-400" style={{ width: `${cycleProgress}%` }} /></div><div className="mt-1.5 font-mono text-[9px] text-neutral-600">{cycleProgress}% of target delivered</div></div>}{activeExperiments.map(item => <button key={item.id} onClick={() => onTabChange('experiments')} className="flex w-full items-center justify-between rounded-xl border border-neutral-900 bg-neutral-900/25 p-3 text-left hover:border-purple-900/50"><span><span className="block text-xs font-semibold text-neutral-200">{item.name}</span><span className="mt-1 block text-[10px] text-neutral-500">Testing {item.metricBeingTested}</span></span><ArrowUpRight className="h-3.5 w-3.5 text-purple-400" /></button>)}{activeExperiments.length === 0 && !cycleGoals && <div className="text-[10px] text-neutral-600">No experiments currently running.</div>}</div></div>
        </section>
      )}
    </div>
  );
}

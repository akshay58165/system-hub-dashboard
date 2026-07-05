import React, { useState } from 'react';
import { Check, ChevronDown, Clock3, Coffee, Target, Timer, Trash2, TrendingUp } from 'lucide-react';
import type { SessionRecord, TaskTimerStage } from '../types';

interface SessionsViewProps {
  sessions: SessionRecord[];
  embedded?: boolean;
}

const formatDuration = (ms: number) => {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};
const stageLabels: Record<TaskTimerStage, string> = { script: 'Scripting', shoot: 'Shooting', edit: 'Editing', schedule: 'Scheduling', post: 'Publishing' };

export default function SessionsView({ sessions, embedded = false }: SessionsViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const ordered = [...sessions].sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());

  if (ordered.length === 0) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-8 text-center">
        <Target className="mx-auto h-8 w-8 text-purple-400" />
        {!embedded && <h1 className="mt-3 text-xl font-bold text-white">Sessions</h1>}
        <p className="mt-2 text-sm text-neutral-500">No completed work sessions yet. Start the day from the header, then end it to see the full record here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {!embedded && <div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-purple-400">
          <Clock3 className="h-4 w-4" />Session history
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">Sessions</h1>
        <p className="mt-1 text-sm text-neutral-500">{ordered.length} completed session{ordered.length === 1 ? '' : 's'} — real recorded time, breaks, and goal outcomes for each.</p>
      </div>}

      <div className="space-y-1.5">
        {ordered.map(session => {
          const isExpanded = expandedId === session.id;
          const targetMs = (session.targetMinutes + session.extensionMinutes) * 60_000;
          const completionPct = targetMs ? Math.min(100, Math.round((session.accumulatedActiveMs / targetMs) * 100)) : 0;
          const totalGoals = session.achievedGoals.length + session.droppedGoals.length + session.pendingGoals.length;
          const productivity = Math.round(session.productivityPercent ?? 100);

          return (
            <div key={session.id} className="rounded-xl border border-neutral-800/80 bg-neutral-950/70 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-neutral-900/40 transition"
              >
                {/* Date + time range */}
                <div className="min-w-[135px] shrink-0">
                  <div className="text-[11px] font-bold text-white leading-tight">{new Date(session.startedAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  <div className="mt-0.5 font-mono text-[9px] text-neutral-500">
                    {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–{new Date(session.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* Inline stats — no card grid, just labeled numbers on one row */}
                <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px]">
                  <span><span className="text-emerald-300 font-bold">{formatDuration(session.accumulatedActiveMs)}</span> <span className="text-neutral-600">active</span></span>
                  <span><span className="text-amber-300 font-bold">{formatDuration(session.accumulatedPausedMs)}</span> <span className="text-neutral-600">paused</span></span>
                  <span><span className="text-cyan-300 font-bold">{session.breaksCount}</span> <span className="text-neutral-600">brk</span></span>
                  <span><span className="text-purple-300 font-bold">{completionPct}%</span> <span className="text-neutral-600">quota</span></span>
                  <span><span className={`font-bold ${productivity >= 70 ? 'text-emerald-300' : productivity >= 40 ? 'text-amber-300' : 'text-rose-300'}`}>{productivity}%</span> <span className="text-neutral-600">prod</span></span>
                  <span><span className={`font-bold ${session.achievedGoals.length === totalGoals && totalGoals > 0 ? 'text-emerald-300' : 'text-white'}`}>{session.achievedGoals.length}/{totalGoals}</span> <span className="text-neutral-600">goals</span></span>
                  {session.extensionMinutes > 0 && (
                    <span className="rounded border border-amber-900/40 bg-amber-950/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-amber-300">+{session.extensionMinutes}m ext</span>
                  )}
                </div>

                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {isExpanded && (
                <div className="border-t border-neutral-900 p-5 space-y-4">
                  {(session.taskTimers?.length || 0) > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-cyan-400"><Timer className="h-3.5 w-3.5" />Goal task sessions</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {session.taskTimers!.map(timer => (
                          <div key={timer.id} className="rounded-lg border border-cyan-950/60 bg-cyan-950/10 p-3">
                            <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-semibold text-neutral-200">{timer.topicName}</div><div className="mt-1 text-[8px] font-bold uppercase text-cyan-300">{stageLabels[timer.stage]}</div></div><span className={`rounded px-2 py-1 text-[7px] font-bold uppercase ${timer.endReason === 'done' ? 'bg-emerald-950/40 text-emerald-300' : 'bg-amber-950/40 text-amber-300'}`}>{timer.endReason === 'done' ? 'Completed' : 'Deferred'}</span></div>
                            <div className="mt-3 grid grid-cols-4 gap-2 text-center"><div><div className="font-mono text-[10px] font-bold text-emerald-300">{formatDuration(timer.accumulatedActiveMs)}</div><div className="text-[6px] uppercase text-neutral-600">Active</div></div><div><div className="font-mono text-[10px] font-bold text-amber-300">{formatDuration(timer.accumulatedPausedMs)}</div><div className="text-[6px] uppercase text-neutral-600">Paused</div></div><div><div className="font-mono text-[10px] font-bold text-cyan-300">{timer.breaksCount}</div><div className="text-[6px] uppercase text-neutral-600">Breaks</div></div><div><div className="font-mono text-[10px] font-bold text-purple-300">{timer.productivityScore ? `${timer.productivityScore * 10}%` : '--'}</div><div className="text-[6px] uppercase text-neutral-600">Productive</div></div></div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-cyan-950/40 pt-2 font-mono text-[7px] text-neutral-500"><span>Started {new Date(timer.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><span>{timer.completedAt ? `Ended ${new Date(timer.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Still active'}</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {session.achievedGoals.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-emerald-400"><Check className="h-3.5 w-3.5" />Achieved</div>
                      <div className="mt-2 space-y-1.5">
                        {session.achievedGoals.map((goal, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-emerald-900/30 bg-emerald-950/10 px-3 py-2 text-[10px]">
                            <span className="font-semibold text-neutral-200">{goal.topicName}</span>
                            <span className="uppercase text-emerald-300">Reached {goal.targetStatus}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {session.droppedGoals.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-rose-400"><Trash2 className="h-3.5 w-3.5" />Dropped</div>
                      <div className="mt-2 space-y-1.5">
                        {session.droppedGoals.map((goal, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-rose-900/30 bg-rose-950/10 px-3 py-2 text-[10px]">
                            <span className="font-semibold text-neutral-200">{goal.topicName}</span>
                            <span className="uppercase text-rose-300">Was targeting {goal.targetStatus}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {session.pendingGoals.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-neutral-400"><TrendingUp className="h-3.5 w-3.5" />Still open when session ended</div>
                      <div className="mt-2 space-y-1.5">
                        {session.pendingGoals.map((goal, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-[10px]">
                            <span className="font-semibold text-neutral-200">{goal.topicName}</span>
                            <span className="uppercase text-neutral-500">Targeting {goal.targetStatus}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {totalGoals === 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-600"><Coffee className="h-3.5 w-3.5" />No goals were set for this session.</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

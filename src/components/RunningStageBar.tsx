import { useEffect, useState } from 'react';
import { Play, Pause, CheckCircle } from 'lucide-react';
import { TaskTimerRecord, Topic } from '../types';

interface RunningStageBarProps {
  timers: TaskTimerRecord[];
  topics: Topic[];
  onPause: () => void;
  onResume: () => void;
  onDone: (topicId: string, stage: string) => void;
}

export default function RunningStageBar({ timers, topics, onPause, onResume, onDone }: RunningStageBarProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const activeTimer = timers.find(t => t.status === 'running') || timers.find(t => t.status === 'paused');

  useEffect(() => {
    if (!activeTimer) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeTimer?.id]);

  if (!activeTimer) return null;
  const topic = topics.find(t => t.id === activeTimer.topicId);
  if (!topic) return null;

  const isRunning = activeTimer.status === 'running';
  const elapsedMs = activeTimer.accumulatedActiveMs + (isRunning && activeTimer.activeSince ? Math.max(0, nowMs - new Date(activeTimer.activeSince).getTime()) : 0);
  const fmt = (ms: number) => `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

  let dueLabel = 'No due date';
  if (topic.dueDate) {
    const due = new Date(topic.dueDate).getTime();
    const diff = due - nowMs;
    const abs = Math.abs(diff);
    const days = Math.floor(abs / 86400000);
    const hours = Math.floor((abs % 86400000) / 3600000);
    const mins = Math.floor((abs % 3600000) / 60000);
    const parts = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    dueLabel = diff >= 0 ? `Due in ${parts}` : `Overdue by ${parts}`;
  }
  const stageLabel = activeTimer.stage.charAt(0).toUpperCase() + activeTimer.stage.slice(1);

  return (
    <div className={`w-full flex flex-wrap items-center gap-3 border-b px-4 py-2 font-mono text-[10px] ${isRunning ? 'border-emerald-800/60 bg-emerald-950/30' : 'border-amber-800/60 bg-amber-950/25'}`}>
      <span className={`h-2 w-2 rounded-full shrink-0 ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} aria-hidden="true" />
      <span className={`text-[9px] font-bold uppercase tracking-wider ${isRunning ? 'text-emerald-300' : 'text-amber-300'}`}>{isRunning ? 'Running' : 'Paused'} · {stageLabel}</span>
      <button
        type="button"
        onClick={() => {
          const el = document.getElementById(`topic-control-${topic.id}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
        className="text-xs font-bold text-neutral-100 hover:text-white truncate max-w-[320px]"
        title="Jump to topic"
      >
        {topic.name}
      </button>
      <span className="text-neutral-500">·</span>
      <span className="text-neutral-300">{dueLabel}</span>
      <span className="text-neutral-500">·</span>
      <span className={`tabular-nums font-bold text-xs ${isRunning ? 'text-emerald-200' : 'text-amber-200'}`}>{fmt(elapsedMs)}</span>
      <div className="flex items-center gap-1 ml-auto">
        {isRunning ? (
          <button
            type="button"
            onClick={onPause}
            className="flex items-center gap-1 rounded border border-amber-800 bg-amber-950/40 px-2 py-1 text-[9px] font-bold uppercase text-amber-200 hover:border-amber-600 hover:text-amber-100"
          >
            <Pause className="h-3 w-3" /> Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={onResume}
            className="flex items-center gap-1 rounded border border-emerald-800 bg-emerald-950/40 px-2 py-1 text-[9px] font-bold uppercase text-emerald-200 hover:border-emerald-600 hover:text-emerald-100"
          >
            <Play className="h-3 w-3" /> Resume
          </button>
        )}
        <button
          type="button"
          onClick={() => onDone(topic.id, activeTimer.stage)}
          className="flex items-center gap-1 rounded border border-blue-800 bg-blue-950/40 px-2 py-1 text-[9px] font-bold uppercase text-blue-200 hover:border-blue-600 hover:text-blue-100"
          title="Mark stage done — closes this bar"
        >
          <CheckCircle className="h-3 w-3" /> Done
        </button>
      </div>
    </div>
  );
}

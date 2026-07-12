import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, Check, ChevronLeft, ChevronRight, GripVertical, Plus, Pencil } from 'lucide-react';
import type { Topic } from '../types';
import { getTopicWorkflowState } from '../services/topicWorkflow';

interface CalendarViewProps {
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  onCreateTopic: () => void;
  onEditTopic?: (topic: Topic) => void;
}

type CalendarCell = {
  dateKey: string;
  dayNumber: number;
  weekdayLabel: string;
  isCurrentMonth: boolean;
};

const DEFAULT_TIME_BY_CHANNEL: Record<Topic['channel'], string> = {
  LearnDriven: '21:09',
  DecodeWorthy: '19:07'
};

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDateKey(value?: string | null) {
  if (!value) return '';
  const dateKey = value.split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : '';
}

function getTimePart(topic: Topic) {
  if (topic.scheduledTime && /^\d{2}:\d{2}$/.test(topic.scheduledTime)) return topic.scheduledTime;
  if (topic.dueDate) {
    const embedded = topic.dueDate.includes('T') ? topic.dueDate.split('T')[1]?.slice(0, 5) : '';
    if (embedded && /^\d{2}:\d{2}$/.test(embedded)) return embedded;
  }
  return DEFAULT_TIME_BY_CHANNEL[topic.channel];
}

function getTopicDisplayColor(topic: Topic) {
  return topic.channel === 'LearnDriven' ? 'text-purple-400' : 'text-yellow-300';
}

function getStageLetterState(topic: Topic, stage: 'hook' | 'script' | 'shoot' | 'edit') {
  return getTopicWorkflowState(topic, stage);
}

function formatCountdown(targetIso?: string | null, nowMs = Date.now()) {
  if (!targetIso) return '';
  const targetMs = new Date(targetIso).getTime();
  if (!Number.isFinite(targetMs)) return '';
  const delta = targetMs - nowMs;
  const abs = Math.abs(delta);
  const totalSeconds = Math.floor(abs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const core = days > 0
    ? `${days}d ${String(hours).padStart(2, '0')}h`
    : `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;

  return delta < 0 ? `Overdue ${core}` : `Due in ${core}`;
}

function getWeekdayLabel(date: Date) {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][((date.getDay() + 6) % 7)];
}

function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1);
  const cells: CalendarCell[] = [];
  const startOffset = (firstDay.getDay() + 6) % 7;

  const gridStart = new Date(year, month, 1);
  gridStart.setDate(gridStart.getDate() - startOffset);

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    cells.push({
      dateKey: toDateKey(date),
      dayNumber: date.getDate(),
      weekdayLabel: getWeekdayLabel(date),
      isCurrentMonth: date.getMonth() === month
    });
  }

  return cells;
}

export default function CalendarView({ topics, setTopics, onCreateTopic, onEditTopic }: CalendarViewProps) {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [draggedTopicId, setDraggedTopicId] = useState<string | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const monthLabel = useMemo(() => new Date(selectedYear, selectedMonth).toLocaleDateString([], {
    month: 'long',
    year: 'numeric'
  }), [selectedMonth, selectedYear]);

  const calendarCells = useMemo(() => buildMonthGrid(selectedYear, selectedMonth), [selectedMonth, selectedYear]);

  const unscheduledTopics = useMemo(() => {
    return [...topics]
      .filter(topic => !getDateKey(topic.dueDate))
      .sort((a, b) => {
        const priorityDiff = (b.priority || 0) - (a.priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      });
  }, [topics]);

  const topicsByDate = useMemo(() => {
    return topics.reduce<Record<string, Topic[]>>((acc, topic) => {
      const dateKey = getDateKey(topic.dueDate);
      if (!dateKey) return acc;
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(topic);
      return acc;
    }, {});
  }, [topics]);

  const moveTopicToDate = (topicId: string, dateKey: string) => {
    const targetDate = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(targetDate.getTime())) return;

    setTopics(prev => prev.map(topic => {
      if (topic.id !== topicId) return topic;

      const timePart = getTimePart(topic);
      return {
        ...topic,
        dueDate: new Date(`${dateKey}T${timePart}:00`).toISOString(),
        scheduledTime: timePart,
        lastUpdated: new Date().toISOString()
      };
    }));
  };

  const renderTopicCard = (topic: Topic, compact = false) => {
    const stageStates = {
      hook: getStageLetterState(topic, 'hook'),
      script: getStageLetterState(topic, 'script'),
      shoot: getStageLetterState(topic, 'shoot'),
      edit: getStageLetterState(topic, 'edit')
    };
    const boxClass = (state: 'pending' | 'in-progress' | 'completed') => {
      if (state === 'completed') return 'border-emerald-500 bg-emerald-500 text-black shadow-[0_0_14px_rgba(16,185,129,.25)]';
      if (state === 'in-progress') return 'border-amber-500 bg-amber-500/20 text-amber-200';
      return 'border-neutral-800 bg-neutral-950 text-neutral-500';
    };
    const rawCountdown = formatCountdown(topic.dueDate, nowMs);
    let countdown = rawCountdown;
    let countdownClass = rawCountdown.startsWith('Overdue')
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
      : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
    if (topic.status === 'posted') {
      countdown = 'Posted';
      countdownClass = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    } else if (topic.status === 'scheduled') {
      countdown = rawCountdown.startsWith('Overdue') ? 'Scheduled' : rawCountdown;
      countdownClass = 'border-purple-500/30 bg-purple-500/10 text-purple-300';
    }

    return (
      <div
        key={topic.id}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', topic.id);
          setDraggedTopicId(topic.id);
        }}
        onDragEnd={() => {
          setDraggedTopicId(null);
          setDragOverDateKey(null);
        }}
        onClick={() => onEditTopic?.(topic)}
        className={`group cursor-grab active:cursor-grabbing rounded-xl border bg-neutral-950/45 backdrop-blur-md transition-all duration-200 ${
          compact
            ? 'border-white/10 hover:border-white/20'
            : 'border-white/10 hover:border-white/20'
        } ${draggedTopicId === topic.id ? 'opacity-50 scale-[0.99]' : ''}`}
      >
        <div className="flex items-start gap-2 p-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex min-w-0 items-start gap-2">
              <span className={`min-w-0 flex-1 break-words text-[12px] font-black leading-tight ${getTopicDisplayColor(topic)} line-clamp-2`}>
                {topic.name}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-0.5">
              {(['hook', 'script', 'shoot', 'edit'] as const).map(stage => (
                <div
                  key={stage}
                  className={`flex h-4 items-center justify-center rounded border text-[7px] font-black uppercase tracking-[0.16em] ${boxClass(stageStates[stage])}`}
                  title={`${stage.toUpperCase()} ${stageStates[stage]}`}
                >
                  {stage === 'shoot' ? 'C' : stage[0].toUpperCase()}
                </div>
              ))}
            </div>
            {countdown && (
              <div className={`inline-flex w-full items-center justify-center rounded border px-2 py-0.5 text-[8px] font-mono font-bold ${countdownClass}`}>
                {countdown}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEditTopic?.(topic);
              }}
              className="rounded border border-neutral-800 p-1 text-neutral-500 transition hover:border-blue-800 hover:text-blue-300"
              title="Edit topic"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <GripVertical className="mt-0.5 h-3.5 w-3.5 text-neutral-700" />
          </div>
        </div>
      </div>
    );
  };

  const scheduledCount = topics.filter(topic => getDateKey(topic.dueDate)).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4 shadow-2xl shadow-black/20 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-900/40 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-300">
              Calendar
            </span>
            <span className="rounded-full border border-neutral-800 bg-neutral-900/80 px-2.5 py-1 text-[10px] font-mono text-neutral-400">
              {unscheduledTopics.length} unscheduled
            </span>
            <span className="rounded-full border border-neutral-800 bg-neutral-900/80 px-2.5 py-1 text-[10px] font-mono text-neutral-400">
              {scheduledCount} on calendar
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Drag topics onto the month grid</h2>
          <p className="max-w-2xl text-xs leading-relaxed text-neutral-500">
            Unscheduled topics stay in the left rail until you drop them on a date. You can also move any scheduled topic to a new day, and open the same topic form to edit details without leaving the page.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateTopic}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-900/40 bg-emerald-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-300 transition hover:border-emerald-500 hover:bg-emerald-500/20"
        >
          <Plus className="h-4 w-4" />
          New Topic
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-start">
        <aside className="sticky top-32 z-20 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl xl:h-[calc(100vh-10rem)] xl:w-[18rem]">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-neutral-950/80 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarIcon className="h-4 w-4 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-500">Unscheduled</div>
                <div className="text-[11px] font-mono text-neutral-400">{unscheduledTopics.length} topics</div>
              </div>
            </div>
            <button
              type="button"
              onClick={onCreateTopic}
              className="rounded border border-neutral-800 p-1 text-neutral-500 transition hover:border-emerald-800 hover:text-emerald-300"
              title="Create topic"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-[calc(100vh-12rem)] space-y-2 overflow-y-auto p-3">
            {unscheduledTopics.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-[11px] text-neutral-500">
                Everything has a due date.
              </div>
            ) : (
              unscheduledTopics.map(topic => renderTopicCard(topic, true))
            )}
          </div>
        </aside>

        <section className="space-y-3 xl:min-w-0">
          <div className="flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedMonth === 0) {
                    setSelectedMonth(11);
                    setSelectedYear(year => year - 1);
                  } else {
                    setSelectedMonth(month => month - 1);
                  }
                }}
                className="rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-neutral-400 transition hover:border-neutral-700 hover:text-white"
                title="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Calendar view</div>
                <div className="text-lg font-black text-white">{monthLabel}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (selectedMonth === 11) {
                    setSelectedMonth(0);
                    setSelectedYear(year => year + 1);
                  } else {
                    setSelectedMonth(month => month + 1);
                  }
                }}
                className="rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-neutral-400 transition hover:border-neutral-700 hover:text-white"
                title="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500">
              <span className="rounded-full border border-neutral-800 bg-neutral-950 px-2 py-1">Drop to set due date</span>
              <span className="rounded-full border border-neutral-800 bg-neutral-950 px-2 py-1">Click a topic to edit</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[980px] space-y-2">
              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map(cell => {
                  const dayTopics = topicsByDate[cell.dateKey] || [];
                  const isToday = cell.dateKey === toDateKey(today);
                  const isOver = dragOverDateKey === cell.dateKey;
                  const hasPosted = dayTopics.some(topic => topic.status === 'posted');

                  return (
                    <div
                      key={cell.dateKey}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverDateKey(cell.dateKey);
                      }}
                      onDragLeave={() => {
                        if (dragOverDateKey === cell.dateKey) setDragOverDateKey(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const topicId = event.dataTransfer.getData('text/plain');
                        if (topicId) moveTopicToDate(topicId, cell.dateKey);
                        setDraggedTopicId(null);
                        setDragOverDateKey(null);
                      }}
                      className={`min-h-[14rem] rounded-2xl border p-3 transition flex flex-col ${
                        cell.isCurrentMonth ? 'bg-neutral-950/70' : 'bg-neutral-950/30 opacity-50'
                      } ${
                        isOver
                          ? 'border-emerald-500 bg-emerald-950/25 shadow-[0_0_0_1px_rgba(16,185,129,.35)]'
                          : isToday
                            ? 'border-neutral-500 ring-1 ring-neutral-400/40'
                            : 'border-neutral-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="text-[9px] font-bold uppercase tracking-[0.32em] text-neutral-500">
                            {cell.weekdayLabel}
                          </div>
                          <span className={`text-sm font-black ${isToday ? 'text-emerald-300' : 'text-white'}`}>{cell.dayNumber}</span>
                        </div>
                        {hasPosted && (
                          <div
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.35)]"
                            title="Posted"
                          >
                            <Check className="h-3 w-3 text-black" strokeWidth={3} />
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex-1 space-y-2">
                        {dayTopics.map(topic => renderTopicCard(topic))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

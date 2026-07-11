import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, GripVertical, Plus, Pencil, Dot } from 'lucide-react';
import type { Topic } from '../types';

interface CalendarViewProps {
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  onCreateTopic: () => void;
  onEditTopic?: (topic: Topic) => void;
}

type CalendarCell = {
  dateKey: string;
  dayNumber: number;
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

function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1);
  const firstDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let index = firstDow - 1; index >= 0; index -= 1) {
    const dayNumber = prevMonthDays - index;
    const date = new Date(year, month - 1, dayNumber);
    cells.push({
      dateKey: toDateKey(date),
      dayNumber,
      isCurrentMonth: false
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({
      dateKey: toDateKey(date),
      dayNumber: day,
      isCurrentMonth: true
    });
  }

  while (cells.length < 42) {
    const extraIndex = cells.length - (firstDow + daysInMonth) + 1;
    const date = new Date(year, month + 1, extraIndex);
    cells.push({
      dateKey: toDateKey(date),
      dayNumber: date.getDate(),
      isCurrentMonth: false
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
    const isUnscheduled = !getDateKey(topic.dueDate);
    const dateKey = getDateKey(topic.dueDate);
    const timePart = getTimePart(topic);

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
        className={`group cursor-grab active:cursor-grabbing rounded-xl border bg-neutral-950/70 transition-all duration-200 ${
          compact
            ? 'border-neutral-900 hover:border-neutral-700'
            : 'border-neutral-800 hover:border-neutral-700'
        } ${draggedTopicId === topic.id ? 'opacity-50 scale-[0.99]' : ''}`}
      >
        <div className="flex items-start gap-2 p-2.5">
          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            topic.channel === 'LearnDriven'
              ? 'border-purple-900/40 bg-purple-950/35 text-purple-300'
              : 'border-emerald-900/40 bg-emerald-950/35 text-emerald-300'
          }`}>
            <Dot className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[11px] font-bold text-white">{topic.name}</span>
              <span className={`rounded border px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider ${
                topic.channel === 'LearnDriven'
                  ? 'border-purple-900/40 bg-purple-950/25 text-purple-300'
                  : 'border-emerald-900/40 bg-emerald-950/25 text-emerald-300'
              }`}>
                {topic.channel}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[9px] font-mono text-neutral-500">
              <span className="rounded border border-neutral-900 bg-neutral-950 px-1.5 py-0.5">
                {topic.status}
              </span>
              <span className="rounded border border-cyan-900/40 bg-cyan-950/20 px-1.5 py-0.5 text-cyan-300">
                {timePart}
              </span>
              {topic.priority && (
                <span className="rounded border border-amber-900/40 bg-amber-950/20 px-1.5 py-0.5 text-amber-300">
                  P{topic.priority}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[8px] font-mono text-neutral-600">
              {isUnscheduled ? (
                <span>Unscheduled</span>
              ) : (
                <span>Due {dateKey}</span>
              )}
              {topic.savedForLater && <span className="text-blue-300">Saved for later</span>}
            </div>
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
            <GripVertical className="mt-0.5 h-4 w-4 text-neutral-700" />
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

      <div className="grid gap-4 xl:grid-cols-[4.5rem_minmax(0,1fr)]">
        <aside className="group z-20 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/70 transition-all duration-300 xl:sticky xl:top-4 xl:h-[calc(100vh-8rem)] xl:w-16 xl:hover:w-[18rem] xl:relative">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
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
              <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/40 p-4 text-center text-[11px] text-neutral-500">
                Everything has a due date.
              </div>
            ) : (
              unscheduledTopics.map(topic => renderTopicCard(topic, true))
            )}
          </div>
        </aside>

        <section className="space-y-3 xl:pl-3">
          <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/50 px-4 py-3">
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
              <div className="grid grid-cols-7 gap-2 px-1 text-center text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-1">{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map(cell => {
                  const dayTopics = topicsByDate[cell.dateKey] || [];
                  const isToday = cell.dateKey === toDateKey(today);
                  const isOver = dragOverDateKey === cell.dateKey;

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
                      className={`min-h-[11.5rem] rounded-2xl border p-3 transition ${
                        cell.isCurrentMonth ? 'bg-neutral-950/70' : 'bg-neutral-950/30 opacity-50'
                      } ${
                        isOver
                          ? 'border-emerald-500 bg-emerald-950/25 shadow-[0_0_0_1px_rgba(16,185,129,.35)]'
                          : isToday
                            ? 'border-neutral-500 ring-1 ring-neutral-400/40'
                            : 'border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${isToday ? 'text-emerald-300' : 'text-white'}`}>{cell.dayNumber}</span>
                          {dayTopics.length > 0 && (
                            <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[10px] font-mono text-neutral-400">
                              {dayTopics.length}
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-600">
                          {cell.dateKey}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2">
                        {dayTopics.slice(0, 3).map(topic => renderTopicCard(topic))}
                        {dayTopics.length > 3 && (
                          <div className="rounded-xl border border-dashed border-neutral-800 px-3 py-2 text-center text-[10px] text-neutral-500">
                            +{dayTopics.length - 3} more
                          </div>
                        )}
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

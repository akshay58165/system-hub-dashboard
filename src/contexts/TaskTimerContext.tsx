import { createContext, useContext } from 'react';
import type { TaskTimerRecord, TaskTimerStage, WorkdaySession } from '../types';

export interface TaskTimerContextValue {
  timers: TaskTimerRecord[];
  activeTimer: TaskTimerRecord | null;
  workdaySession: WorkdaySession | null;
  startTimer: (topicId: string, stage: TaskTimerStage) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: (endReason: 'done' | 'deferred', productivityScore?: number) => void;
  completeStageTimer: (topicId: string, stage: TaskTimerStage) => void;
  // Clicking a stage while the workday timer runs makes it a session goal.
  addStageGoal: (topicId: string, stage: TaskTimerStage) => void;
  // Resume a paused workday and immediately count the clicked stage as a task.
  resumeWorkdayAndStart: (topicId: string, stage: TaskTimerStage) => void;
  // Add manual time (ms) to a stage — creates a completed timer record so the
  // stage totals reflect it even though no live stopwatch was run.
  addManualStageTime: (topicId: string, stage: TaskTimerStage, activeMs: number) => void;
  // Replace all time for a topic+stage with an exact value.
  replaceStageTime: (topicId: string, stage: TaskTimerStage, activeMs: number) => void;
  // Overwrite both total time and sittings count atomically.
  setStageTotals: (topicId: string, stage: TaskTimerStage, totalMs: number, sittings: number) => void;
  // Update or delete an existing stage timer (used by the Time view).
  updateStageTimer: (timerId: string, patch: Partial<TaskTimerRecord>) => void;
  deleteStageTimer: (timerId: string) => void;
}

export const TaskTimerContext = createContext<TaskTimerContextValue | null>(null);

export function useTaskTimers() {
  return useContext(TaskTimerContext);
}

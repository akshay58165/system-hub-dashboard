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
}

export const TaskTimerContext = createContext<TaskTimerContextValue | null>(null);

export function useTaskTimers() {
  return useContext(TaskTimerContext);
}

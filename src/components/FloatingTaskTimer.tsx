import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock3, Pause, Play, Square, Check, Timer, X, MoonStar, ArrowUpRight, Layers3
} from 'lucide-react';
import type { TaskTimerRecord, WorkdaySession } from '../types';

interface FloatingTaskTimerProps {
  activeTaskTimer: TaskTimerRecord | null;
  workdaySession: WorkdaySession | null;
  onPauseTaskTimer: (productivityScore?: number) => void;
  onResumeTaskTimer: () => void;
  onStopTaskTimer: (endReason: 'done' | 'deferred', productivityScore: number) => void;
  onPauseMainTimer: () => void;
  onResumeMainTimer: () => void;
  onOpenSessions?: () => void;
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const PRODUCTIVITY_PROMPT_THRESHOLD_MS = 10 * 60 * 1000;

const stageLabel: Record<string, string> = {
  script: 'Scripting', shoot: 'Shooting', edit: 'Editing',
  schedule: 'Scheduling', post: 'Publishing'
};

type DocumentPictureInPicture = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};

const getDocumentPictureInPicture = () =>
  (window as Window & { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;

export default function FloatingTaskTimer({
  activeTaskTimer,
  workdaySession,
  onPauseTaskTimer,
  onResumeTaskTimer,
  onStopTaskTimer,
  onPauseMainTimer,
  onResumeMainTimer,
  onOpenSessions,
}: FloatingTaskTimerProps) {
  const [now, setNow] = useState(Date.now());
  const [pos, setPos] = useState({ x: 20, y: 80 });
  const [dragging, setDragging] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showTaskProductivityPrompt, setShowTaskProductivityPrompt] = useState(false);
  const [stopReason, setStopReason] = useState<'done' | 'deferred'>('deferred');
  const [productivity, setProductivity] = useState(7);
  const [taskPauseProductivity, setTaskPauseProductivity] = useState(7);
  const [pendingTaskTimer, setPendingTaskTimer] = useState<TaskTimerRecord | null>(null);
  const [desktopWindow, setDesktopWindow] = useState<Window | null>(null);
  const [browserActive, setBrowserActive] = useState(() => {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible' && document.hasFocus();
  });
  const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);
  const [dismissedUntilFocus, setDismissedUntilFocus] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const activePointerIdRef = useRef<number | null>(null);
  const timerRef = useRef<HTMLDivElement>(null);
  const openingDesktopWindowRef = useRef(false);

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => {
    if (desktopWindow && !desktopWindow.closed) desktopWindow.close();
  }, [desktopWindow]);

  useEffect(() => {
    const updateBrowserActive = () => {
      setBrowserActive(document.visibilityState === 'visible' && document.hasFocus());
    };

    updateBrowserActive();
    window.addEventListener('focus', updateBrowserActive);
    window.addEventListener('blur', updateBrowserActive);
    document.addEventListener('visibilitychange', updateBrowserActive);
    return () => {
      window.removeEventListener('focus', updateBrowserActive);
      window.removeEventListener('blur', updateBrowserActive);
      document.removeEventListener('visibilitychange', updateBrowserActive);
    };
  }, []);

  useEffect(() => {
    if (!snoozeUntil) return;
    const remaining = snoozeUntil - Date.now();
    if (remaining <= 0) {
      setSnoozeUntil(null);
      return;
    }
    const timeout = window.setTimeout(() => setSnoozeUntil(null), remaining);
    return () => window.clearTimeout(timeout);
  }, [snoozeUntil]);

  const closeDesktopTimer = () => {
    if (desktopWindow && !desktopWindow.closed) desktopWindow.close();
    setDesktopWindow(null);
    openingDesktopWindowRef.current = false;
  };

  // Drag handlers
  const startDrag = useCallback((x: number, y: number, pointerId?: number) => {
    setDragging(true);
    dragOffset.current = { x: x - pos.x, y: y - pos.y };
    if (typeof pointerId === 'number') activePointerIdRef.current = pointerId;
  }, [pos]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    startDrag(e.clientX, e.clientY, e.pointerId);
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Some embedded browsers may not support pointer capture.
    }
  }, [startDrag]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
      const maxX = window.innerWidth - (timerRef.current?.offsetWidth || 180) - 8;
      const maxY = window.innerHeight - (timerRef.current?.offsetHeight || 48) - 8;
      setPos({
        x: Math.max(8, Math.min(maxX, e.clientX - dragOffset.current.x)),
        y: Math.max(8, Math.min(maxY, e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = (e: PointerEvent) => {
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
      activePointerIdRef.current = null;
      setDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging]);

  useEffect(() => {
    const hasSession = Boolean(activeTaskTimer || workdaySession);

    if (!hasSession) {
      setDismissedUntilFocus(false);
      setSnoozeUntil(null);
      closeDesktopTimer();
      return;
    }

    if (browserActive) {
      setDismissedUntilFocus(false);
      closeDesktopTimer();
      return;
    }

    if (dismissedUntilFocus) return;
    if (snoozeUntil && snoozeUntil > Date.now()) return;
    if (desktopWindow && !desktopWindow.closed) return;
    if (openingDesktopWindowRef.current) return;

    void openDesktopTimer();
  }, [activeTaskTimer, browserActive, dismissedUntilFocus, desktopWindow, snoozeUntil, workdaySession]);

  // Compute active elapsed ms for the displayed timer
  const taskActiveMs = activeTaskTimer
    ? activeTaskTimer.accumulatedActiveMs + (
        activeTaskTimer.status === 'running' && activeTaskTimer.activeSince
          ? Math.max(0, now - new Date(activeTaskTimer.activeSince).getTime())
          : 0
      )
    : 0;

  const mainActiveMs = workdaySession
    ? workdaySession.accumulatedActiveMs + (
        workdaySession.status === 'running' && workdaySession.activeSince
          ? Math.max(0, now - new Date(workdaySession.activeSince).getTime())
          : 0
      )
    : 0;

  // Show task timer if active task exists, otherwise main timer
  const showTaskTimer = Boolean(activeTaskTimer);
  const showMainTimer = !showTaskTimer && Boolean(workdaySession);

  if (!showTaskTimer && !showMainTimer) return null;

  const isTaskRunning = activeTaskTimer?.status === 'running';
  const isTaskPaused = activeTaskTimer?.status === 'paused';
  const isMainRunning = workdaySession?.status === 'running';

  const handleStop = () => {
    onStopTaskTimer(stopReason, productivity);
    setShowStopModal(false);
  };

  const isTimerRunning = showTaskTimer ? isTaskRunning : isMainRunning;
  const toggleTimer = () => {
    if (showTaskTimer) {
      if (isTaskRunning) {
        requestTaskPause();
      } else {
        onResumeTaskTimer();
      }
      return;
    }

    if (isMainRunning) {
      onPauseMainTimer();
    } else {
      onResumeMainTimer();
    }
  };

  const requestTaskPause = () => {
    if (!activeTaskTimer || activeTaskTimer.status !== 'running') return;
    if (taskActiveMs >= PRODUCTIVITY_PROMPT_THRESHOLD_MS) {
      setTaskPauseProductivity(7);
      setPendingTaskTimer(activeTaskTimer);
      setShowTaskProductivityPrompt(true);
      return;
    }
    onPauseTaskTimer(10);
  };

  const openDesktopTimer = async () => {
    const hasSession = Boolean(activeTaskTimer || workdaySession);
    if (!hasSession || browserActive) return;
    const documentPictureInPicture = getDocumentPictureInPicture();
    if (!documentPictureInPicture) return;

    if (desktopWindow && !desktopWindow.closed) {
      desktopWindow.focus();
      return;
    }

    if (openingDesktopWindowRef.current) return;

    try {
      openingDesktopWindowRef.current = true;
      const pipWindow = await documentPictureInPicture.requestWindow({ width: 280, height: 112 });
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
        pipWindow.document.head.appendChild(node.cloneNode(true));
      });
      pipWindow.document.title = 'Work Dashboard';
      pipWindow.document.documentElement.className = 'm-0 h-full overflow-hidden bg-neutral-950';
      pipWindow.document.body.className = 'm-0 h-full overflow-hidden bg-neutral-950';
      pipWindow.addEventListener('pagehide', () => {
        setDesktopWindow(null);
        openingDesktopWindowRef.current = false;
      }, { once: true });
      setDesktopWindow(pipWindow);
    } catch {
      // The browser may reject the request when Picture-in-Picture is disabled.
    } finally {
      openingDesktopWindowRef.current = false;
    }
  };

  const snoozeDesktopTimer = () => {
    setSnoozeUntil(Date.now() + 5 * 60 * 1000);
    closeDesktopTimer();
  };

  const dismissDesktopTimer = () => {
    setDismissedUntilFocus(true);
    setSnoozeUntil(null);
    closeDesktopTimer();
  };

  return (
    <>
      {/* Floating pill fallback when the browser is not active and the PiP window is unavailable. */}
      {!browserActive && (!desktopWindow || desktopWindow.closed) && (
        <motion.div
          ref={timerRef}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            zIndex: 9999,
            cursor: dragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none'
          }}
          onPointerDown={onPointerDown}
        >
          <div
            className={`relative overflow-hidden rounded-3xl border font-mono text-[11px] font-bold backdrop-blur-3xl shadow-[0_0_42px_rgba(244,63,94,.22)] ${
              showTaskTimer && activeTaskTimer
                ? isTaskRunning
                  ? 'border-rose-400/25 bg-rose-950/35 text-rose-100'
                  : 'border-rose-400/15 bg-rose-950/22 text-rose-100/80'
                : isMainRunning
                  ? 'border-rose-400/25 bg-rose-950/35 text-rose-100'
                  : 'border-rose-400/15 bg-rose-950/22 text-rose-100/80'
            }`}
          >
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[-35%] opacity-80"
              style={{
                background:
                  'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0) 35deg, rgba(255,255,255,.45) 55deg, rgba(248,113,113,.95) 85deg, rgba(255,255,255,0) 120deg, transparent 180deg, rgba(248,113,113,.45) 250deg, rgba(255,255,255,0) 300deg, transparent 360deg)'
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 10, ease: 'linear', repeat: Infinity }}
            />
            <div className="relative">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-2.5 py-1.5">
                <button
                  type="button"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => onOpenSessions?.()}
                  className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-rose-100/80 transition hover:bg-white/10 hover:text-white"
                  title="Open Sessions"
                  aria-label="Open Sessions"
                >
                  <Layers3 className="h-3 w-3" />
                  <span>Work Dashboard</span>
                  <ArrowUpRight className="h-3 w-3" />
                </button>

                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={toggleTimer}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-rose-100 transition hover:bg-white/15 hover:text-white"
                    title={isTimerRunning ? 'Pause timer' : 'Resume timer'}
                    aria-label={isTimerRunning ? 'Pause timer' : 'Resume timer'}
                  >
                    {isTimerRunning ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  </button>
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={snoozeDesktopTimer}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-rose-100/80 transition hover:bg-rose-500/15 hover:text-white"
                    title="Snooze timer for 5 minutes"
                    aria-label="Snooze timer for 5 minutes"
                  >
                    <MoonStar className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={dismissDesktopTimer}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-rose-100/70 transition hover:bg-black/20 hover:text-white"
                    title="Close floating timer"
                    aria-label="Close floating timer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {showTaskTimer && activeTaskTimer ? (
                <div className="flex items-stretch">
                  <div className="flex flex-1 items-center gap-2 px-3 py-2.5 bg-black/10">
                    <Timer className={`h-3.5 w-3.5 shrink-0 ${isTaskRunning ? 'text-rose-300 animate-pulse' : 'text-rose-200/60'}`} />
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-wider text-rose-200/70">
                        {stageLabel[activeTaskTimer.stage] || activeTaskTimer.stage}
                      </span>
                      <span className={`text-sm font-black tabular-nums ${isTaskRunning ? 'text-white' : 'text-rose-50'}`}>
                        {fmt(taskActiveMs)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : showMainTimer && workdaySession ? (
                <div className="flex items-stretch">
                  <div className="flex flex-1 items-center gap-2 px-3 py-2.5 bg-black/10">
                    <Clock3 className={`h-3.5 w-3.5 shrink-0 ${isMainRunning ? 'text-rose-300' : 'text-rose-200/60'}`} />
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-wider text-rose-200/70">Day timer</span>
                      <span className={`text-sm font-black tabular-nums ${isMainRunning ? 'text-white' : 'text-rose-50'}`}>
                        {fmt(mainActiveMs)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </motion.div>
      )}

      {desktopWindow && !desktopWindow.closed && createPortal(
        <div className={`relative flex h-full min-h-[112px] w-full items-stretch overflow-hidden rounded-none border font-mono text-[11px] font-bold backdrop-blur-3xl ${
          showTaskTimer
            ? isTaskRunning
              ? 'border-rose-400/25 bg-rose-950/40 text-rose-100'
              : 'border-rose-400/15 bg-rose-950/22 text-rose-100/80'
            : isMainRunning
              ? 'border-rose-400/25 bg-rose-950/40 text-rose-100'
              : 'border-rose-400/15 bg-rose-950/22 text-rose-100/80'
        }`}>
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-[-35%] opacity-80"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0) 35deg, rgba(255,255,255,.45) 55deg, rgba(248,113,113,.95) 85deg, rgba(255,255,255,0) 120deg, transparent 180deg, rgba(248,113,113,.45) 250deg, rgba(255,255,255,0) 300deg, transparent 360deg)'
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 10, ease: 'linear', repeat: Infinity }}
          />
          <div className="relative flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-3 py-2">
              <button
                type="button"
                onClick={() => onOpenSessions?.()}
                className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-rose-100/80 transition hover:bg-white/10 hover:text-white"
                title="Open Sessions"
                aria-label="Open Sessions"
              >
                <Layers3 className="h-3 w-3" />
                <span>Work Dashboard</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleTimer}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-rose-100 transition hover:bg-white/15 hover:text-white"
                  title={isTimerRunning ? 'Pause timer' : 'Resume timer'}
                  aria-label={isTimerRunning ? 'Pause timer' : 'Resume timer'}
                >
                  {isTimerRunning ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                </button>
                <button
                  onClick={snoozeDesktopTimer}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-rose-100/80 transition hover:bg-rose-500/15 hover:text-white"
                  title="Snooze floating timer for 5 minutes"
                  aria-label="Snooze floating timer for 5 minutes"
                >
                  <MoonStar className="h-4 w-4" />
                </button>
                <button
                  onClick={dismissDesktopTimer}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-rose-100/70 transition hover:bg-black/20 hover:text-white"
                  title="Close floating timer"
                  aria-label="Close floating timer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
              {showTaskTimer
                ? <Timer className={`h-4 w-4 ${isTaskRunning ? 'text-rose-300' : 'text-rose-200/60'}`} />
                : <Clock3 className={`h-4 w-4 ${isMainRunning ? 'text-rose-300' : 'text-rose-200/60'}`} />}
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-rose-200/70">
                  {showTaskTimer && activeTaskTimer ? stageLabel[activeTaskTimer.stage] || activeTaskTimer.stage : 'Day timer'}
                </span>
                <span className="text-lg font-black tabular-nums text-rose-50">
                  {fmt(showTaskTimer ? taskActiveMs : mainActiveMs)}
                </span>
              </div>
            </div>
          </div>
        </div>,
        desktopWindow.document.body
      )}

      <AnimatePresence>
        {showTaskProductivityPrompt && pendingTaskTimer && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-amber-900/50 bg-neutral-950 p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Pause task timer</h3>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    {stageLabel[pendingTaskTimer.stage] || pendingTaskTimer.stage} · {pendingTaskTimer.topicName}
                  </p>
                </div>
                <button onClick={() => { setShowTaskProductivityPrompt(false); setPendingTaskTimer(null); }} className="text-neutral-600 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] uppercase tracking-wider text-neutral-500">Session productivity</p>
                  <span className={`font-mono text-sm font-bold ${taskPauseProductivity >= 8 ? 'text-emerald-400' : taskPauseProductivity >= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {taskPauseProductivity * 10}%
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      onClick={() => setTaskPauseProductivity(n)}
                      className={`flex-1 h-7 rounded text-[9px] font-bold transition border ${
                        n <= taskPauseProductivity
                          ? n >= 8 ? 'bg-emerald-500/30 border-emerald-600/60 text-emerald-300'
                            : n >= 5 ? 'bg-amber-500/30 border-amber-600/60 text-amber-300'
                            : 'bg-rose-500/30 border-rose-600/60 text-rose-300'
                          : 'border-neutral-800 bg-neutral-900/50 text-neutral-600 hover:border-neutral-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[8px] text-neutral-600 mt-1.5 text-center">
                  {taskPauseProductivity <= 3 ? 'Low productivity — lots of distractions'
                    : taskPauseProductivity <= 6 ? 'Moderate — some focus gaps'
                    : taskPauseProductivity <= 8 ? 'Good flow — mostly productive'
                    : 'Deep work — fully in the zone'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onPauseTaskTimer(taskPauseProductivity);
                    setShowTaskProductivityPrompt(false);
                    setPendingTaskTimer(null);
                  }}
                  className="flex-1 rounded-xl bg-amber-400 py-2.5 text-xs font-bold text-black transition hover:bg-amber-300"
                >
                  Pause work
                </button>
                <button
                  onClick={() => { setShowTaskProductivityPrompt(false); setPendingTaskTimer(null); }}
                  className="rounded-xl border border-neutral-800 px-4 py-2.5 text-xs font-bold text-neutral-300 hover:bg-neutral-900"
                >
                  Keep running
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stop modal - productivity score + end reason */}
      <AnimatePresence>
        {showStopModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Stop task timer</h3>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    {stageLabel[activeTaskTimer?.stage || '']} · {fmt(taskActiveMs)} active
                  </p>
                </div>
                <button onClick={() => setShowStopModal(false)} className="text-neutral-600 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* End reason */}
              <div className="mb-4">
                <p className="text-[9px] uppercase tracking-wider text-neutral-500 mb-2">Why are you stopping?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setStopReason('done')}
                    className={`rounded-lg border px-3 py-2.5 text-left transition ${
                      stopReason === 'done'
                        ? 'border-emerald-600 bg-emerald-950/50 text-emerald-300'
                        : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5 mb-1 text-emerald-400" />
                    <div className="text-[10px] font-bold">Task Done</div>
                    <div className="text-[9px] opacity-60 mt-0.5">Stage fully completed</div>
                  </button>
                  <button
                    onClick={() => setStopReason('deferred')}
                    className={`rounded-lg border px-3 py-2.5 text-left transition ${
                      stopReason === 'deferred'
                        ? 'border-amber-600 bg-amber-950/50 text-amber-300'
                        : 'border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <Pause className="h-3.5 w-3.5 mb-1 text-amber-400" />
                    <div className="text-[10px] font-bold">Coming Back</div>
                    <div className="text-[9px] opacity-60 mt-0.5">Resume in another sitting</div>
                  </button>
                </div>
              </div>

              {/* Productivity score */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] uppercase tracking-wider text-neutral-500">Session productivity</p>
                  <span className={`font-mono text-sm font-bold ${productivity >= 8 ? 'text-emerald-400' : productivity >= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {productivity * 10}%
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      onClick={() => setProductivity(n)}
                      className={`flex-1 h-7 rounded text-[9px] font-bold transition border ${
                        n <= productivity
                          ? n >= 8 ? 'bg-emerald-500/30 border-emerald-600/60 text-emerald-300'
                            : n >= 5 ? 'bg-amber-500/30 border-amber-600/60 text-amber-300'
                            : 'bg-rose-500/30 border-rose-600/60 text-rose-300'
                          : 'border-neutral-800 bg-neutral-900/50 text-neutral-600 hover:border-neutral-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[8px] text-neutral-600 mt-1.5 text-center">
                  {productivity <= 3 ? 'Low productivity — lots of distractions'
                    : productivity <= 6 ? 'Moderate — some focus gaps'
                    : productivity <= 8 ? 'Good flow — mostly productive'
                    : 'Deep work — fully in the zone'}
                </p>
              </div>

              <button
                onClick={handleStop}
                className={`w-full rounded-xl py-2.5 text-xs font-bold text-black transition ${
                  stopReason === 'done' ? 'bg-emerald-400 hover:bg-emerald-300' : 'bg-amber-400 hover:bg-amber-300'
                }`}
              >
                {stopReason === 'done' ? '✓ Mark as Done' : '⏸ Defer to Later'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

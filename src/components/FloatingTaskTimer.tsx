import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock3, Pause, Play, Square, Check, Timer, X, PictureInPicture2
} from 'lucide-react';
import type { TaskTimerRecord, WorkdaySession } from '../types';

interface FloatingTaskTimerProps {
  activeTaskTimer: TaskTimerRecord | null;
  workdaySession: WorkdaySession | null;
  onPauseTaskTimer: () => void;
  onResumeTaskTimer: () => void;
  onStopTaskTimer: (endReason: 'done' | 'deferred', productivityScore: number) => void;
  onPauseMainTimer: () => void;
  onResumeMainTimer: () => void;
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

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
}: FloatingTaskTimerProps) {
  const [now, setNow] = useState(Date.now());
  const [pos, setPos] = useState({ x: 20, y: 80 });
  const [dragging, setDragging] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [stopReason, setStopReason] = useState<'done' | 'deferred'>('deferred');
  const [productivity, setProductivity] = useState(7);
  const [desktopWindow, setDesktopWindow] = useState<Window | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const timerRef = useRef<HTMLDivElement>(null);

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => {
    if (desktopWindow && !desktopWindow.closed) desktopWindow.close();
  }, [desktopWindow]);

  // Drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setDragging(true);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const maxX = window.innerWidth - (timerRef.current?.offsetWidth || 180) - 8;
      const maxY = window.innerHeight - (timerRef.current?.offsetHeight || 48) - 8;
      setPos({
        x: Math.max(8, Math.min(maxX, e.clientX - dragOffset.current.x)),
        y: Math.max(8, Math.min(maxY, e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

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

  const openDesktopTimer = async () => {
    const documentPictureInPicture = getDocumentPictureInPicture();
    if (!documentPictureInPicture) {
      window.alert('Desktop timer requires a recent version of Chrome or Edge.');
      return;
    }

    if (desktopWindow && !desktopWindow.closed) {
      desktopWindow.focus();
      return;
    }

    try {
      const pipWindow = await documentPictureInPicture.requestWindow({ width: 240, height: 72 });
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => {
        pipWindow.document.head.appendChild(node.cloneNode(true));
      });
      pipWindow.document.title = 'Unicorn Day Timer';
      pipWindow.document.documentElement.className = 'm-0 h-full overflow-hidden bg-neutral-950';
      pipWindow.document.body.className = 'm-0 h-full overflow-hidden bg-neutral-950';
      pipWindow.addEventListener('pagehide', () => setDesktopWindow(null), { once: true });
      setDesktopWindow(pipWindow);
    } catch {
      // The browser may reject the request when Picture-in-Picture is disabled.
    }
  };

  return (
    <>
      {/* Floating pill */}
      <motion.div
        ref={timerRef}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
        onMouseDown={onMouseDown}
      >
        {showTaskTimer && activeTaskTimer ? (
          <div className={`flex items-stretch overflow-hidden rounded-xl border shadow-2xl font-mono text-[11px] font-bold backdrop-blur-xl ${
            isTaskRunning
              ? 'border-amber-700/60 bg-amber-950/90 text-amber-200 shadow-amber-900/30'
              : 'border-neutral-700/60 bg-neutral-900/95 text-neutral-300'
          }`}>
            {/* Stage label */}
            <div className="flex items-center gap-2 px-3 py-2">
              <Timer className={`h-3.5 w-3.5 shrink-0 ${isTaskRunning ? 'text-amber-400 animate-pulse' : 'text-neutral-500'}`} />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider opacity-70">
                  {stageLabel[activeTaskTimer.stage] || activeTaskTimer.stage}
                </span>
                <span className={`text-sm font-black tabular-nums ${isTaskRunning ? 'text-amber-100' : 'text-neutral-200'}`}>
                  {fmt(taskActiveMs)}
                </span>
              </div>
            </div>

            {/* Pause / Resume */}
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={openDesktopTimer}
              className="flex w-8 items-center justify-center border-l border-neutral-700/40 text-neutral-500 transition hover:bg-blue-500/20 hover:text-blue-300"
              title="Keep timer above desktop windows"
              aria-label="Open desktop timer"
            >
              <PictureInPicture2 className="h-3.5 w-3.5" />
            </button>

            {/* Pause / Resume */}
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={isTaskRunning ? onPauseTaskTimer : onResumeTaskTimer}
              className={`flex w-8 items-center justify-center border-l transition ${
                isTaskRunning
                  ? 'border-amber-700/40 hover:bg-amber-500/20 text-amber-300'
                  : 'border-neutral-700/40 hover:bg-emerald-500/20 text-emerald-300'
              }`}
              title={isTaskRunning ? 'Pause task' : 'Resume task'}
            >
              {isTaskRunning ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            </button>

            {/* Stop / Done */}
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setShowStopModal(true)}
              className="flex w-8 items-center justify-center border-l border-neutral-700/40 hover:bg-rose-500/20 text-neutral-500 hover:text-rose-300 transition"
              title="Stop task timer"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          </div>
        ) : showMainTimer && workdaySession ? (
          <div className={`flex items-stretch overflow-hidden rounded-xl border shadow-2xl font-mono text-[11px] font-bold backdrop-blur-xl ${
            isMainRunning
              ? 'border-emerald-800/60 bg-emerald-950/90 text-emerald-200 shadow-emerald-900/30'
              : 'border-amber-800/60 bg-amber-950/90 text-amber-200'
          }`}>
            <div className="flex items-center gap-2 px-3 py-2">
              <Clock3 className={`h-3.5 w-3.5 shrink-0 ${isMainRunning ? 'text-emerald-400' : 'text-amber-400'}`} />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider opacity-70">Day timer</span>
                <span className={`text-sm font-black tabular-nums ${isMainRunning ? 'text-emerald-100' : 'text-amber-100'}`}>
                  {fmt(mainActiveMs)}
                </span>
              </div>
            </div>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={openDesktopTimer}
              className="flex w-8 items-center justify-center border-l border-emerald-800/40 text-emerald-500 transition hover:bg-blue-500/20 hover:text-blue-300"
              title="Keep timer above desktop windows"
              aria-label="Open desktop timer"
            >
              <PictureInPicture2 className="h-3.5 w-3.5" />
            </button>
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={isMainRunning ? onPauseMainTimer : onResumeMainTimer}
              className={`flex w-8 items-center justify-center border-l transition ${
                isMainRunning
                  ? 'border-emerald-800/40 hover:bg-amber-500/20 text-amber-300'
                  : 'border-amber-800/40 hover:bg-emerald-500/20 text-emerald-300'
              }`}
              title={isMainRunning ? 'Pause day' : 'Resume day'}
            >
              {isMainRunning ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            </button>
          </div>
        ) : null}
      </motion.div>

      {desktopWindow && !desktopWindow.closed && createPortal(
        <div className={`flex h-screen w-screen items-stretch overflow-hidden border font-mono text-[11px] font-bold ${
          showTaskTimer
            ? isTaskRunning ? 'border-amber-700/60 bg-amber-950 text-amber-200' : 'border-neutral-700 bg-neutral-900 text-neutral-300'
            : isMainRunning ? 'border-emerald-800/60 bg-emerald-950 text-emerald-200' : 'border-amber-800/60 bg-amber-950 text-amber-200'
        }`}>
          <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
            {showTaskTimer
              ? <Timer className={`h-4 w-4 ${isTaskRunning ? 'text-amber-400' : 'text-neutral-500'}`} />
              : <Clock3 className={`h-4 w-4 ${isMainRunning ? 'text-emerald-400' : 'text-amber-400'}`} />}
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider opacity-70">
                {showTaskTimer && activeTaskTimer ? stageLabel[activeTaskTimer.stage] || activeTaskTimer.stage : 'Day timer'}
              </span>
              <span className="text-lg font-black tabular-nums">
                {fmt(showTaskTimer ? taskActiveMs : mainActiveMs)}
              </span>
            </div>
          </div>
          <button
            onClick={showTaskTimer
              ? isTaskRunning ? onPauseTaskTimer : onResumeTaskTimer
              : isMainRunning ? onPauseMainTimer : onResumeMainTimer}
            className="flex w-12 items-center justify-center border-l border-current/20 text-amber-300 transition hover:bg-white/10"
            title={showTaskTimer ? isTaskRunning ? 'Pause task' : 'Resume task' : isMainRunning ? 'Pause day' : 'Resume day'}
          >
            {(showTaskTimer ? isTaskRunning : isMainRunning)
              ? <Pause className="h-4 w-4 fill-current" />
              : <Play className="h-4 w-4 fill-current" />}
          </button>
        </div>,
        desktopWindow.document.body
      )}

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

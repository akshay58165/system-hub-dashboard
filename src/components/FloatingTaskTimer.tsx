import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Clock3, Pause, Play, X, MoonStar, ArrowUpRight, Layers3 } from 'lucide-react';
import type { WorkdaySession } from '../types';

interface FloatingTaskTimerProps {
  workdaySession: WorkdaySession | null;
  onPauseMainTimer: () => void;
  onResumeMainTimer: () => void;
  onOpenSessions?: () => void;
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

type DocumentPictureInPicture = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};

const getDocumentPictureInPicture = () =>
  (window as Window & { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;

function TimerGlow() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <motion.div
        className="absolute inset-[-42%] opacity-90 blur-3xl"
        style={{
          background: [
            'radial-gradient(circle at 18% 50%, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.10) 12%, rgba(255,255,255,0) 34%)',
            'radial-gradient(circle at 50% 18%, rgba(248,113,113,0.34) 0%, rgba(248,113,113,0.14) 14%, rgba(248,113,113,0) 36%)',
            'radial-gradient(circle at 82% 50%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.08) 12%, rgba(255,255,255,0) 34%)',
            'radial-gradient(circle at 50% 82%, rgba(251,65,89,0.42) 0%, rgba(251,65,89,0.16) 14%, rgba(251,65,89,0) 36%)',
            'radial-gradient(circle at 50% 50%, rgba(127,29,29,0.08) 0%, rgba(127,29,29,0) 58%)',
          ].join(', '),
        }}
        animate={{ rotate: 360, scale: [1, 1.02, 1] }}
        transition={{ duration: 14, ease: 'linear', repeat: Infinity }}
      />
      <motion.div
        className="absolute inset-[1px] rounded-[inherit] opacity-80"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(248,113,113,0.12) 0%, rgba(248,113,113,0.06) 40%, rgba(248,113,113,0) 72%)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 18px rgba(248,113,113,0.08)',
        }}
        animate={{ opacity: [0.72, 0.96, 0.72] }}
        transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity }}
      />
    </div>
  );
}

export default function FloatingTaskTimer({
  workdaySession,
  onPauseMainTimer,
  onResumeMainTimer,
  onOpenSessions,
}: FloatingTaskTimerProps) {
  const [now, setNow] = useState(Date.now());
  const [pos, setPos] = useState({ x: 20, y: 80 });
  const [dragging, setDragging] = useState(false);
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

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
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

  const closeDesktopTimer = useCallback(() => {
    if (desktopWindow && !desktopWindow.closed) desktopWindow.close();
    setDesktopWindow(null);
    openingDesktopWindowRef.current = false;
  }, [desktopWindow]);

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
    if (!workdaySession) {
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
  }, [browserActive, closeDesktopTimer, dismissedUntilFocus, desktopWindow, snoozeUntil, workdaySession]);

  const mainActiveMs = workdaySession
    ? workdaySession.accumulatedActiveMs + (
        workdaySession.status === 'running' && workdaySession.activeSince
          ? Math.max(0, now - new Date(workdaySession.activeSince).getTime())
          : 0
      )
    : 0;

  if (!workdaySession) return null;

  const isMainRunning = workdaySession.status === 'running';

  const toggleTimer = () => {
    if (isMainRunning) onPauseMainTimer();
    else onResumeMainTimer();
  };

  async function openDesktopTimer() {
    if (!workdaySession || browserActive) return;
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
  }

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
            touchAction: 'none',
          }}
          onPointerDown={onPointerDown}
        >
          <div className="relative overflow-hidden rounded-3xl border border-rose-400/20 bg-rose-950/32 font-mono text-[11px] font-bold text-rose-50 shadow-[0_0_42px_rgba(244,63,94,.22)] backdrop-blur-3xl">
            <TimerGlow />
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
                    title={isMainRunning ? 'Pause timer' : 'Resume timer'}
                    aria-label={isMainRunning ? 'Pause timer' : 'Resume timer'}
                  >
                    {isMainRunning ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
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

              <div className="flex items-stretch">
                <div className="flex flex-1 items-center gap-2 bg-black/10 px-3 py-2.5">
                  <Clock3 className={`h-3.5 w-3.5 shrink-0 ${isMainRunning ? 'text-rose-300' : 'text-rose-200/60'}`} />
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider text-rose-200/70">Day timer</span>
                    <span className={`text-sm font-black tabular-nums ${isMainRunning ? 'text-white' : 'text-rose-50'}`}>
                      {fmt(mainActiveMs)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {desktopWindow && !desktopWindow.closed && createPortal(
        <div className="relative flex h-full min-h-[112px] w-full items-stretch overflow-hidden rounded-none border border-rose-400/20 bg-rose-950/35 font-mono text-[11px] font-bold text-rose-50 backdrop-blur-3xl">
          <TimerGlow />
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
                  title={isMainRunning ? 'Pause timer' : 'Resume timer'}
                  aria-label={isMainRunning ? 'Pause timer' : 'Resume timer'}
                >
                  {isMainRunning ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
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
              <Clock3 className={`h-4 w-4 ${isMainRunning ? 'text-rose-300' : 'text-rose-200/60'}`} />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-rose-200/70">Day timer</span>
                <span className="text-lg font-black tabular-nums text-rose-50">{fmt(mainActiveMs)}</span>
              </div>
            </div>
          </div>
        </div>,
        desktopWindow.document.body
      )}
    </>
  );
}

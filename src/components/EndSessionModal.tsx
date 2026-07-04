import { AlertTriangle, Check, Clock3, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface EndSessionModalProps {
  isOpen: boolean;
  activeMs: number;
  pausedMs: number;
  completedGoals: number;
  totalGoals: number;
  onCancel: () => void;
  onConfirm: () => void;
}

const formatDuration = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export default function EndSessionModal({ isOpen, activeMs, pausedMs, completedGoals, totalGoals, onCancel, onConfirm }: EndSessionModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="end-session-title" initial={{ opacity: 0, y: 10, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .96 }} className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-900/60 bg-neutral-950 shadow-[0_0_60px_rgba(244,63,94,.14)]">
            <div className="flex items-start justify-between border-b border-neutral-900 p-5">
              <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-900/60 bg-rose-950/30 text-rose-400"><AlertTriangle className="h-5 w-5" /></span><div><h2 id="end-session-title" className="text-base font-bold text-white">End today&apos;s work session?</h2><p className="mt-1 text-[10px] leading-relaxed text-neutral-500">Your day, goal outcomes, task timers, pauses, and stage history will be saved to Sessions.</p></div></div>
              <button type="button" onClick={onCancel} className="ml-3 text-neutral-600 transition hover:text-white" aria-label="Cancel ending session"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-5">
              <div className="rounded-xl border border-neutral-900 bg-neutral-900/40 p-3"><Clock3 className="h-3.5 w-3.5 text-emerald-400" /><div className="mt-2 font-mono text-sm font-black text-emerald-300">{formatDuration(activeMs)}</div><div className="mt-1 text-[7px] uppercase text-neutral-600">Active work</div></div>
              <div className="rounded-xl border border-neutral-900 bg-neutral-900/40 p-3"><Clock3 className="h-3.5 w-3.5 text-amber-400" /><div className="mt-2 font-mono text-sm font-black text-amber-300">{formatDuration(pausedMs)}</div><div className="mt-1 text-[7px] uppercase text-neutral-600">Paused</div></div>
              <div className="rounded-xl border border-neutral-900 bg-neutral-900/40 p-3"><Check className="h-3.5 w-3.5 text-purple-400" /><div className="mt-2 font-mono text-sm font-black text-purple-300">{completedGoals}/{totalGoals}</div><div className="mt-1 text-[7px] uppercase text-neutral-600">Goals hit</div></div>
            </div>
            <div className="flex gap-2 border-t border-neutral-900 p-4">
              <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 py-2.5 text-xs font-bold text-neutral-300 transition hover:border-neutral-600 hover:text-white">Keep working</button>
              <button type="button" onClick={onConfirm} className="flex-1 rounded-xl bg-rose-500 py-2.5 text-xs font-bold text-white transition hover:bg-rose-400">End &amp; save session</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

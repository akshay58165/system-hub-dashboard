import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock3, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface EndSessionModalProps {
  isOpen: boolean;
  activeMs: number;
  pausedMs: number;
  completedGoals: number;
  totalGoals: number;
  onCancel: () => void;
  // Score (1-10) rates the FINAL active segment (last resume → end). It scales
  // just like the pause-time productivity score. Ending mid-work without
  // completing stages doesn't mean zero productivity — the user tells us.
  onConfirm: (finalProductivityScore?: number) => void;
  onDiscard?: () => void;
}

const formatDuration = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export default function EndSessionModal({ isOpen, activeMs, pausedMs, completedGoals, totalGoals, onCancel, onConfirm, onDiscard }: EndSessionModalProps) {
  // Score (1-10) for the final active segment. Reset each time the modal
  // opens so an old session's rating doesn't leak into the next one.
  const [productivity, setProductivity] = useState<number>(7);
  useEffect(() => { if (isOpen) setProductivity(7); }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-sm sm:items-center sm:py-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-labelledby="end-session-title"
            initial={{ opacity: 0, y: 10, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .96 }}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-900/60 bg-neutral-950 shadow-[0_0_60px_rgba(244,63,94,.14)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-neutral-900 p-5">
              <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-900/60 bg-rose-950/30 text-rose-400"><AlertTriangle className="h-5 w-5" /></span><div><h2 id="end-session-title" className="text-base font-bold text-white">End today&apos;s work session?</h2><p className="mt-1 text-[14px] leading-relaxed text-neutral-500">Your day, goal outcomes, task timers, pauses, and stage history will be saved to Sessions.</p></div></div>
              <button type="button" onClick={onCancel} className="ml-3 text-neutral-600 transition hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-5">
              <div className="rounded-xl border border-neutral-900 bg-neutral-900/40 p-3"><Clock3 className="h-3.5 w-3.5 text-emerald-400" /><div className="mt-2 font-mono text-sm font-black text-emerald-300">{formatDuration(activeMs)}</div><div className="mt-1 text-[12px] uppercase text-neutral-600">Active work</div></div>
              <div className="rounded-xl border border-neutral-900 bg-neutral-900/40 p-3"><Clock3 className="h-3.5 w-3.5 text-amber-400" /><div className="mt-2 font-mono text-sm font-black text-amber-300">{formatDuration(pausedMs)}</div><div className="mt-1 text-[12px] uppercase text-neutral-600">Paused</div></div>
              <div className="rounded-xl border border-neutral-900 bg-neutral-900/40 p-3"><Check className="h-3.5 w-3.5 text-purple-400" /><div className="mt-2 font-mono text-sm font-black text-purple-300">{completedGoals}/{totalGoals}</div><div className="mt-1 text-[12px] uppercase text-neutral-600">Goals hit</div></div>
            </div>
            <div className="border-t border-neutral-900 px-5 pb-4 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] uppercase tracking-wider text-neutral-500">How productive was this last stretch?</span>
                <span className={`font-mono text-sm font-bold ${productivity >= 8 ? 'text-emerald-400' : productivity >= 5 ? 'text-amber-400' : 'text-rose-400'}`}>{productivity * 10}%</span>
              </div>
              <div className="mt-2 flex gap-1.5">
                {[1,2,3,4,5,6,7,8,9,10].map(score => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setProductivity(score)}
                    className={`flex-1 rounded border px-0 py-2 text-[13px] font-bold transition ${score <= productivity ? score >= 8 ? 'border-emerald-600/60 bg-emerald-500/25 text-emerald-200' : score >= 5 ? 'border-amber-600/60 bg-amber-500/20 text-amber-200' : 'border-rose-600/60 bg-rose-500/20 text-rose-200' : 'border-neutral-800 bg-neutral-900/50 text-neutral-600 hover:border-neutral-700'}`}
                  >
                    {score}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[13px] text-neutral-600 text-center">
                Rates just the final active segment — earlier pauses already have their own ratings.
              </p>
            </div>
            <div className="flex gap-2 border-t border-neutral-900 p-4">
              <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 py-2.5 text-xs font-bold text-neutral-300 transition hover:border-neutral-600 hover:text-white">Keep working</button>
              <button type="button" onClick={() => onConfirm(productivity)} className="flex-1 rounded-xl bg-rose-500 py-2.5 text-xs font-bold text-white transition hover:bg-rose-400">End &amp; save session</button>
            </div>
            {onDiscard && <div className="border-t border-neutral-900 px-4 pb-4 pt-2"><button type="button" onClick={onDiscard} className="w-full rounded-xl border border-neutral-800 py-2 text-[14px] font-bold text-neutral-500 transition hover:border-rose-900 hover:text-rose-400">Discard session without saving</button></div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

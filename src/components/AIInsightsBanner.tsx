// ============================================================================
// AI Insights Banner — live, animated "what should I do next" panel.
//
// PLACEHOLDER DATA NOTICE: the `PLACEHOLDER_INSIGHTS` array below is sample
// content standing in for a future real AI integration. It is intentionally
// NOT derived from real topics/activities yet — it exists so the visual
// design can be reviewed and polished before wiring the actual model call.
// When the AI integration lands, replace `PLACEHOLDER_INSIGHTS` with the
// model's structured response (same `Insight` shape) and delete this notice.
// ============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  ArrowRight,
  Flame,
  AlertTriangle,
  TrendingUp,
  Target,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

type InsightCategory = 'next' | 'risk' | 'opportunity' | 'momentum';

interface Insight {
  id: string;
  category: InsightCategory;
  title: string;
  description: string;
  meta: string;
  confidence: number; // 0-100, cosmetic for now
}

const CATEGORY_META: Record<InsightCategory, { label: string; icon: React.ReactNode; color: string; bg: string; border: string; dot: string }> = {
  next: {
    label: 'Next Action',
    icon: <Target className="h-4 w-4" />,
    color: 'text-blue-400',
    bg: 'bg-blue-950/20',
    border: 'border-blue-900/30',
    dot: 'bg-blue-400'
  },
  risk: {
    label: 'Risk',
    icon: <AlertTriangle className="h-4 w-4" />,
    color: 'text-rose-400',
    bg: 'bg-rose-950/20',
    border: 'border-rose-900/30',
    dot: 'bg-rose-400'
  },
  opportunity: {
    label: 'Smart Move',
    icon: <TrendingUp className="h-4 w-4" />,
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/20',
    border: 'border-emerald-900/30',
    dot: 'bg-emerald-400'
  },
  momentum: {
    label: 'Momentum',
    icon: <Flame className="h-4 w-4" />,
    color: 'text-amber-400',
    bg: 'bg-amber-950/20',
    border: 'border-amber-900/30',
    dot: 'bg-amber-400'
  }
};

// TODO(ai-integration): replace with the live model response.
const PLACEHOLDER_INSIGHTS: Insight[] = [
  {
    id: 'sample-1',
    category: 'next',
    title: 'Finish editing "How Git Stores Code Internally"',
    description: 'This LearnDriven Long is 80% complete and your highest-priority item. Wrap the edit today to keep the Tuesday slot.',
    meta: 'LearnDriven · Long',
    confidence: 92
  },
  {
    id: 'sample-2',
    category: 'risk',
    title: 'DecodeWorthy posting streak at risk',
    description: 'Nothing scheduled for DecodeWorthy in the next 2 days. Your streak resets if nothing posts by tomorrow evening.',
    meta: 'DecodeWorthy · Shorts',
    confidence: 87
  },
  {
    id: 'sample-3',
    category: 'opportunity',
    title: 'Shorts are outperforming Long-form 3:1 this month',
    description: 'Consider shifting one Long-form slot to two extra Shorts on LearnDriven to capture more reach this week.',
    meta: 'LearnDriven · All formats',
    confidence: 76
  },
  {
    id: 'sample-4',
    category: 'momentum',
    title: '5-day creation streak on LearnDriven',
    description: "You've added or advanced a topic every day this week. Keep the chain alive with one more action today.",
    meta: 'LearnDriven · Streak',
    confidence: 95
  },
  {
    id: 'sample-5',
    category: 'risk',
    title: '3 topics overdue across both channels',
    description: 'These have sat untouched past their due date. Review each one and either reschedule or fast-track it.',
    meta: 'LearnDriven + DecodeWorthy',
    confidence: 81
  },
  {
    id: 'sample-6',
    category: 'opportunity',
    title: 'Best engagement window: Tue/Thu 6-8PM',
    description: 'Your last 4 scheduled posts in this window outperformed others. Align upcoming Shorts to this slot.',
    meta: 'Pattern across 4 posts',
    confidence: 68
  }
];

const THINKING_STATUSES = [
  'Scanning pipeline for risk signals...',
  'Cross-referencing streak history...',
  'Evaluating channel balance...',
  'Modeling optimal posting windows...',
  'Weighing priority against due dates...'
];

export default function AIInsightsBanner() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const insights = PLACEHOLDER_INSIGHTS;
  const active = insights[activeIndex];
  const meta = CATEGORY_META[active.category];
  const timerRef = useRef<number | null>(null);

  // Auto-rotate the headline insight
  useEffect(() => {
    if (paused) return;
    timerRef.current = window.setInterval(() => {
      setActiveIndex(prev => (prev + 1) % insights.length);
    }, 5000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [paused, insights.length]);

  // Cycle the "thinking" status line independently, faster, for a busy/alive feel
  useEffect(() => {
    const t = window.setInterval(() => {
      setStatusIndex(prev => (prev + 1) % THINKING_STATUSES.length);
    }, 2600);
    return () => window.clearInterval(t);
  }, []);

  const categoryCounts = useMemo(() => {
    return insights.reduce((acc, i) => {
      acc[i.category] = (acc[i.category] ?? 0) + 1;
      return acc;
    }, {} as Record<InsightCategory, number>);
  }, [insights]);

  const goTo = (i: number) => {
    setActiveIndex(((i % insights.length) + insights.length) % insights.length);
    setPaused(true);
    window.setTimeout(() => setPaused(false), 8000);
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-neutral-900 bg-neutral-950 shadow-[0_4px_30px_rgba(0,0,0,0.3)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Animated background glows — slow drifting blobs for a "living" feel */}
      <motion.div
        className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"
        animate={{ x: [0, 40, -10, 0], y: [0, 20, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"
        animate={{ x: [0, -30, 10, 0], y: [0, -20, -40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 right-1/4 w-56 h-56 rounded-full bg-purple-500/5 blur-3xl pointer-events-none"
        animate={{ x: [0, 20, -20, 0], y: [0, -15, 15, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Scanning sweep line across the top border */}
      <div className="absolute top-0 left-0 right-0 h-px overflow-hidden">
        <motion.div
          className="h-full w-1/3 bg-gradient-to-r from-transparent via-blue-400/80 to-transparent"
          animate={{ x: ['-100%', '400%'] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      <div className="relative z-10 p-5 sm:p-6">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <motion.div
              className="grid place-items-center h-8 w-8 rounded-lg bg-blue-950/30 border border-blue-900/40 text-blue-400"
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="h-4 w-4" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-100 font-mono tracking-tight">AI Insights</h2>
                <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  Live
                </span>
                <span className="px-1.5 py-0.2 rounded bg-neutral-900 border border-neutral-850 text-neutral-500 text-[9px] font-mono uppercase tracking-wider">
                  Preview · sample data
                </span>
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={statusIndex}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.3 }}
                  className="text-[10px] text-neutral-500 font-mono mt-0.5"
                >
                  {THINKING_STATUSES[statusIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          {/* Category breakdown chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {(Object.keys(CATEGORY_META) as InsightCategory[]).map(cat => (
              <div key={cat} className="flex items-center gap-1 text-[10px] font-mono text-neutral-500">
                <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_META[cat].dot}`} />
                <span>{CATEGORY_META[cat].label}</span>
                <span className="text-neutral-700">({categoryCounts[cat] ?? 0})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Headline insight — large, auto-rotating */}
        <div className="relative min-h-[148px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={`p-4 rounded-lg border ${meta.bg} ${meta.border}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 shrink-0 ${meta.color}`}>{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${meta.color}`}>{meta.label}</span>
                    <span className="text-[9px] text-neutral-600 font-mono">{active.meta}</span>
                  </div>
                  <h3 className="text-sm font-bold text-neutral-100 leading-snug">{active.title}</h3>
                  <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed font-sans">{active.description}</p>

                  <div className="flex items-center gap-3 mt-3">
                    <button className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-bold ${meta.color} ${meta.bg} border ${meta.border} hover:brightness-125 transition cursor-pointer`}>
                      <span>Take action</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-neutral-600 font-mono uppercase tracking-wider">Confidence</span>
                      <div className="w-16 h-1 bg-neutral-900 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${meta.dot}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${active.confidence}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                      <span className="text-[9px] text-neutral-500 font-mono">{active.confidence}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel controls + dots */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-1.5">
            {insights.map((ins, i) => (
              <button
                key={ins.id}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === activeIndex ? `w-6 ${CATEGORY_META[ins.category].dot}` : 'w-1.5 bg-neutral-800 hover:bg-neutral-700'
                }`}
                title={ins.title}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goTo(activeIndex - 1)}
              className="p-1 rounded text-neutral-600 hover:text-neutral-300 hover:bg-neutral-900 transition cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => goTo(activeIndex + 1)}
              className="p-1 rounded text-neutral-600 hover:text-neutral-300 hover:bg-neutral-900 transition cursor-pointer"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

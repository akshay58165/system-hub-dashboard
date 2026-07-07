import React, { useMemo, useState } from 'react';
import {
  ArrowDownAZ,
  BadgeInfo,
  CheckCircle2,
  CircleAlert,
  Filter,
  Layers,
  ListChecks,
  Lock,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  Zap
} from 'lucide-react';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, Cell } from 'recharts';
import type { Topic } from '../types';
import {
  getAllowedForShootTopics,
  getBlockedReasons,
  getHookGrade,
  getNextAction,
  getNeedsWorkGroups,
  getReadinessStatus,
  getScoreInsights,
  getScriptAverage,
  getTopicGrade,
  getTotalScore,
  getTotalScoreBand,
  isScriptUnlocked,
  isShootAllowed,
  type ReadinessStatus,
  type WeaknessCategory
} from '../services/topicScoring';

interface TopicScoreViewProps {
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
}


type ScoreField =
  | 'topicScore'
  | 'hookScore'
  | 'scriptQualityScore'
  | 'scriptAccuracyScore'
  | 'scriptOriginalityScore';

type FilterTab =
  | 'all'
  | 'topicPassed'
  | 'hookPassed'
  | 'scriptUnlocked'
  | 'allowedForShoot'
  | 'needsTopicRework'
  | 'hookWeak'
  | 'scriptWeak'
  | 'incomplete';

type SortMode =
  | 'totalDesc'
  | 'totalAsc'
  | 'topicDesc'
  | 'topicAsc'
  | 'hookDesc'
  | 'hookAsc'
  | 'readyFirst'
  | 'needsWorkFirst';

const SCORE_FIELDS: Array<{ key: ScoreField; label: string; short: string }> = [
  { key: 'topicScore', label: 'Topic Score', short: 'Topic' },
  { key: 'hookScore', label: 'Hook Score', short: 'Hook' },
  { key: 'scriptQualityScore', label: 'Script Quality', short: 'Quality' },
  { key: 'scriptAccuracyScore', label: 'Script Accuracy', short: 'Accuracy' },
  { key: 'scriptOriginalityScore', label: 'Script Originality', short: 'Originality' }
];

function scoreTone(score: number) {
  if (score >= 9) return 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300';
  if (score >= 7) return 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300';
  if (score >= 5) return 'border-amber-500/40 bg-amber-950/20 text-amber-300';
  return 'border-rose-500/40 bg-rose-950/20 text-rose-300';
}

function activeBg(n: number) {
  return n >= 9 ? 'bg-emerald-500'
    : n >= 7 ? 'bg-cyan-500'
    : n >= 5 ? 'bg-amber-500'
    : 'bg-rose-500';
}

function gradeBadgeTone(grade: string): string {
  switch (grade) {
    case 'A+': return 'border-emerald-500/40 bg-emerald-950/25 text-emerald-300';
    case 'A': return 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300';
    case 'B': return 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300';
    case 'C': return 'border-rose-500/40 bg-rose-950/20 text-rose-300';
    case 'H10': return 'border-emerald-500/40 bg-emerald-950/25 text-emerald-300';
    case 'H2': return 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300';
    case 'H3': return 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300';
    case 'Low H': return 'border-amber-500/40 bg-amber-950/20 text-amber-300';
    case 'Failed Hook': return 'border-rose-500/40 bg-rose-950/25 text-rose-300';
    default: return 'border-neutral-800 bg-neutral-950 text-neutral-500';
  }
}

function readinessTone(status: ReadinessStatus): string {
  switch (status) {
    case 'Allowed For Shoot': return 'border-emerald-500/40 bg-emerald-950/25 text-emerald-300';
    case 'Script Unlocked': return 'border-cyan-500/40 bg-cyan-950/25 text-cyan-300';
    case 'Topic Passed, Hook Weak':
    case 'Script Quality Needs Work':
    case 'Script Accuracy Needs Work':
    case 'Script Originality Needs Work':
      return 'border-amber-500/40 bg-amber-950/20 text-amber-300';
    case 'Hook Not Scored':
    case 'Topic Not Scored':
    case 'Incomplete Scoring':
      return 'border-neutral-700 bg-neutral-900 text-neutral-400';
    case 'Needs Topic Rework': return 'border-rose-500/40 bg-rose-950/25 text-rose-300';
    default: return 'border-neutral-700 bg-neutral-900 text-neutral-400';
  }
}

type ScoreTier = 'topic' | 'hook' | 'script';

// Tier markers rendered beneath specific buttons so the user can see
// what each number earns them (Pass threshold, A, A+, etc.) — a visual
// target for what to aim at.
const TIER_MARKERS: Record<ScoreTier, Record<number, { label: string; tone: 'emerald' | 'cyan' | 'amber' | 'rose' }>> = {
  topic: {
    6:  { label: 'B · Pass',   tone: 'cyan' },
    8:  { label: 'A',          tone: 'emerald' },
    10: { label: 'A+',         tone: 'emerald' }
  },
  hook: {
    5:  { label: 'Low H',      tone: 'amber' },
    8:  { label: 'H3 · Pass',  tone: 'cyan' },
    9:  { label: 'H2',         tone: 'emerald' },
    10: { label: 'H10',        tone: 'emerald' }
  },
  script: {
    8:  { label: 'Pass',       tone: 'cyan' },
    9:  { label: 'Strong',     tone: 'emerald' },
    10: { label: 'Perfect',    tone: 'emerald' }
  }
};

const PASS_THRESHOLD: Record<ScoreTier, number> = { topic: 6, hook: 8, script: 8 };

function markerToneClass(tone: 'emerald' | 'cyan' | 'amber' | 'rose') {
  return tone === 'emerald' ? 'text-emerald-300 border-emerald-600/50'
    : tone === 'cyan' ? 'text-cyan-300 border-cyan-600/50'
    : tone === 'amber' ? 'text-amber-300 border-amber-600/50'
    : 'text-rose-300 border-rose-600/50';
}

// Compact one-tap 1–10 button strip. Tapping the active number clears the
// score (undefined) so unscored stays honestly unscored.
function ScorePicker({
  value,
  onChange,
  compact,
  tier
}: {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  compact?: boolean;
  tier?: ScoreTier;
}) {
  const markers = tier ? TIER_MARKERS[tier] : {};
  const pass = tier ? PASS_THRESHOLD[tier] : null;
  return (
    <div className="space-y-1">
      <div className={`flex items-stretch ${compact ? 'gap-0.5' : 'gap-1'}`}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
          const active = value === n;
          const isPass = pass !== null && n === pass;
          const belowPass = pass !== null && n < pass;
          const marker = markers[n];
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(active ? undefined : n)}
              aria-pressed={active}
              aria-label={active ? `Clear score (currently ${n})` : `Set score to ${n}${marker ? ` (${marker.label})` : ''}`}
              title={marker ? `${n} — ${marker.label}` : (active ? 'Tap to clear' : `Set to ${n}`)}
              className={`flex-1 ${compact ? 'h-6 text-[10px]' : 'h-7 text-[11px]'} rounded font-mono font-bold transition cursor-pointer ${
                active
                  ? `${activeBg(n)} text-black`
                  : belowPass
                    ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-500 border border-neutral-850'
                    : isPass
                      ? 'bg-neutral-900 hover:bg-neutral-800 text-cyan-200 border border-dashed border-cyan-600/60'
                      : marker
                        ? `bg-neutral-900 hover:bg-neutral-800 border ${markerToneClass(marker.tone)}`
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-850'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {tier && (
        <div className={`flex items-stretch ${compact ? 'gap-0.5' : 'gap-1'}`}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
            const marker = markers[n];
            return (
              <div key={n} className="flex-1 text-center">
                {marker ? (
                  <span className={`inline-block text-[8px] font-mono font-bold uppercase tracking-wider ${
                    marker.tone === 'emerald' ? 'text-emerald-400'
                    : marker.tone === 'cyan' ? 'text-cyan-400'
                    : marker.tone === 'amber' ? 'text-amber-400'
                    : 'text-rose-400'
                  }`}>
                    {marker.label}
                  </span>
                ) : <span>&nbsp;</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Small pill used for filter tabs and sort dropdown.
function Pill({
  active,
  onClick,
  children,
  tone = 'neutral'
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'neutral' | 'emerald' | 'amber' | 'rose';
}) {
  const activeToneClass =
    tone === 'emerald' ? 'border-emerald-700 bg-emerald-950/40 text-emerald-200'
    : tone === 'amber' ? 'border-amber-700 bg-amber-950/40 text-amber-200'
    : tone === 'rose' ? 'border-rose-700 bg-rose-950/40 text-rose-200'
    : 'border-purple-700 bg-purple-950/40 text-purple-200';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-mono font-semibold transition ${
        active ? activeToneClass : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
      }`}
    >
      {children}
    </button>
  );
}

// ---------------- Component ----------------

export default function TopicScoreView({
  topics,
  setTopics,
}: TopicScoreViewProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortMode>('totalDesc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const updateScore = (topicId: string, field: ScoreField, nextScore: number | undefined) => {
    setTopics(prev => prev.map(t =>
      t.id === topicId
        ? { ...t, [field]: nextScore, lastUpdated: new Date().toISOString() }
        : t
    ));
  };

  const insights = useMemo(() => getScoreInsights(topics), [topics]);
  const allowedList = useMemo(() => getAllowedForShootTopics(topics), [topics]);
  const needsWork = useMemo(() => getNeedsWorkGroups(topics), [topics]);

  const filteredTopics = useMemo(() => {
    const readinessById = new Map<string, ReadinessStatus>();
    topics.forEach(t => readinessById.set(t.id, getReadinessStatus(t)));
    const match = (t: Topic) => {
      const r = readinessById.get(t.id)!;
      switch (filter) {
        case 'topicPassed': return typeof t.topicScore === 'number' && t.topicScore >= 6;
        case 'hookPassed': return typeof t.hookScore === 'number' && t.hookScore >= 8;
        case 'scriptUnlocked': return isScriptUnlocked(t);
        case 'allowedForShoot': return isShootAllowed(t);
        case 'needsTopicRework': return typeof t.topicScore === 'number' && t.topicScore <= 5;
        case 'hookWeak': return r === 'Topic Passed, Hook Weak' || (typeof t.hookScore === 'number' && t.hookScore < 8);
        case 'scriptWeak':
          return r === 'Script Quality Needs Work'
            || r === 'Script Accuracy Needs Work'
            || r === 'Script Originality Needs Work';
        case 'incomplete':
          return SCORE_FIELDS.some(f => (t[f.key] as number | undefined) === undefined || t[f.key] === null) && !isShootAllowed(t);
        default: return true;
      }
    };
    const list = topics.filter(match);
    const cmp = (a: Topic, b: Topic) => {
      const totalA = getTotalScore(a);
      const totalB = getTotalScore(b);
      switch (sort) {
        case 'totalAsc': return totalA - totalB;
        case 'topicDesc': return (b.topicScore ?? -1) - (a.topicScore ?? -1);
        case 'topicAsc': return (a.topicScore ?? 999) - (b.topicScore ?? 999);
        case 'hookDesc': return (b.hookScore ?? -1) - (a.hookScore ?? -1);
        case 'hookAsc': return (a.hookScore ?? 999) - (b.hookScore ?? 999);
        case 'readyFirst': {
          const ra = isShootAllowed(a) ? 0 : 1;
          const rb = isShootAllowed(b) ? 0 : 1;
          return ra - rb || totalB - totalA;
        }
        case 'needsWorkFirst': {
          const ra = isShootAllowed(a) ? 1 : 0;
          const rb = isShootAllowed(b) ? 1 : 0;
          return ra - rb || totalA - totalB;
        }
        default: return totalB - totalA;
      }
    };
    return list.sort(cmp);
  }, [topics, filter, sort]);

  const gradeChartData = [
    { name: 'A+', count: insights.gradeCounts['A+'], fill: '#34d399' },
    { name: 'A', count: insights.gradeCounts['A'], fill: '#10b981' },
    { name: 'B', count: insights.gradeCounts['B'], fill: '#06b6d4' },
    { name: 'C', count: insights.gradeCounts['C'], fill: '#f43f5e' },
    { name: 'Not Scored', count: insights.gradeCounts['Not Scored'], fill: '#525252' }
  ];
  const hookChartData = [
    { name: 'H10', count: insights.hookCounts['H10'], fill: '#34d399' },
    { name: 'H2', count: insights.hookCounts['H2'], fill: '#10b981' },
    { name: 'H3', count: insights.hookCounts['H3'], fill: '#06b6d4' },
    { name: 'Low H', count: insights.hookCounts['Low H'], fill: '#f59e0b' },
    { name: 'Failed', count: insights.hookCounts['Failed Hook'], fill: '#f43f5e' },
    { name: 'Not Scored', count: insights.hookCounts['Not Scored'], fill: '#525252' }
  ];
  const weaknessChartData: Array<{ name: string; count: number; fill: string }> = [
    { name: 'Topic', count: insights.weaknessCounts['Needs Topic Rework'], fill: '#f43f5e' },
    { name: 'Hook', count: insights.weaknessCounts['Hook Weak'], fill: '#f97316' },
    { name: 'Quality', count: insights.weaknessCounts['Quality Weak'], fill: '#a3e635' },
    { name: 'Accuracy', count: insights.weaknessCounts['Accuracy Weak'], fill: '#22d3ee' },
    { name: 'Originality', count: insights.weaknessCounts['Originality Weak'], fill: '#a78bfa' },
    { name: 'Missing', count: insights.weaknessCounts['Incomplete Scoring'], fill: '#737373' }
  ];
  const funnelData = [
    { name: 'Total', count: insights.funnel.total, fill: '#a3a3a3' },
    { name: 'Topic Passed', count: insights.funnel.topicPassed, fill: '#06b6d4' },
    { name: 'Hook Passed', count: insights.funnel.hookPassed, fill: '#22d3ee' },
    { name: 'Script Unlocked', count: insights.funnel.scriptUnlocked, fill: '#0ea5e9' },
    { name: 'Script Passed', count: insights.funnel.scriptPassed, fill: '#10b981' },
    { name: 'Allowed', count: insights.funnel.allowedForShoot, fill: '#34d399' }
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <ListChecks className="h-4 w-4 text-amber-400" />
              Topic Score & Shoot Readiness
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Score each topic on 5 dimensions — Topic and Hook decide script access; Quality, Accuracy, and Originality decide shoot access. Tap a number to set it; tap the same number to clear.
            </p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-[10px] font-mono text-neutral-400">
            {insights.totalTopics} topic{insights.totalTopics === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Insight cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <InsightCard icon={<Layers className="h-4 w-4" />} label="Total topics" value={insights.totalTopics} tone="neutral" />
        <InsightCard icon={<Zap className="h-4 w-4" />} label="Script unlocked" value={insights.scriptUnlocked} tone="cyan" />
        <InsightCard icon={<CheckCircle2 className="h-4 w-4" />} label="Allowed for shoot" value={insights.allowedForShoot} tone="emerald" />
        <InsightCard icon={<Lock className="h-4 w-4" />} label="Blocked" value={insights.blocked} tone="rose" />
        <InsightCard icon={<Star className="h-4 w-4" />} label="Strong topics (8–10)" value={insights.strongTopics} tone="emerald" />
        <InsightCard icon={<Target className="h-4 w-4" />} label="B grade (6–7)" value={insights.bTopics} tone="cyan" />
        <InsightCard icon={<ShieldAlert className="h-4 w-4" />} label="C grade (≤5)" value={insights.cTopics} tone="rose" />
        <InsightCard icon={<Sparkles className="h-4 w-4" />} label="Strong hooks (8–10)" value={insights.strongHooks} tone="emerald" />
        <InsightCard icon={<CircleAlert className="h-4 w-4" />} label="Weak hooks (<8)" value={insights.weakHooks} tone="amber" />
        <InsightCard icon={<BadgeInfo className="h-4 w-4" />} label="Avg topic score" value={insights.avgTopicScore ?? '—'} tone="neutral" />
        <InsightCard icon={<BadgeInfo className="h-4 w-4" />} label="Avg hook score" value={insights.avgHookScore ?? '—'} tone="neutral" />
        <InsightCard icon={<BadgeInfo className="h-4 w-4" />} label="Avg total (of 100)" value={insights.avgTotalScore ?? '—'} tone="neutral" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <ChartCard title="Grade distribution" data={gradeChartData} />
        <ChartCard title="Hook distribution" data={hookChartData} />
        <ChartCard title="Weakness breakdown" data={weaknessChartData} />
        <ChartCard title="Readiness funnel" data={funnelData} />
      </div>

      {/* Filters + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-neutral-500" />
          <Pill active={filter === 'all'} onClick={() => setFilter('all')}>All</Pill>
          <Pill active={filter === 'topicPassed'} onClick={() => setFilter('topicPassed')} tone="emerald">Topic Passed</Pill>
          <Pill active={filter === 'hookPassed'} onClick={() => setFilter('hookPassed')} tone="emerald">Hook Passed</Pill>
          <Pill active={filter === 'scriptUnlocked'} onClick={() => setFilter('scriptUnlocked')} tone="emerald">Script Unlocked</Pill>
          <Pill active={filter === 'allowedForShoot'} onClick={() => setFilter('allowedForShoot')} tone="emerald">Allowed For Shoot</Pill>
          <Pill active={filter === 'needsTopicRework'} onClick={() => setFilter('needsTopicRework')} tone="rose">Needs Topic Rework</Pill>
          <Pill active={filter === 'hookWeak'} onClick={() => setFilter('hookWeak')} tone="amber">Hook Weak</Pill>
          <Pill active={filter === 'scriptWeak'} onClick={() => setFilter('scriptWeak')} tone="amber">Script Weak</Pill>
          <Pill active={filter === 'incomplete'} onClick={() => setFilter('incomplete')}>Incomplete Scoring</Pill>
        </div>
        <label className="flex items-center gap-2 text-xs font-mono text-neutral-400">
          <ArrowDownAZ className="h-3.5 w-3.5 text-rose-400" />
          Sort
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortMode)}
            className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-white outline-none"
          >
            <option value="totalDesc">Total Score: High → Low</option>
            <option value="totalAsc">Total Score: Low → High</option>
            <option value="topicDesc">Topic Score: High → Low</option>
            <option value="topicAsc">Topic Score: Low → High</option>
            <option value="hookDesc">Hook Score: High → Low</option>
            <option value="hookAsc">Hook Score: Low → High</option>
            <option value="readyFirst">Ready For Shoot First</option>
            <option value="needsWorkFirst">Needs Work First</option>
          </select>
        </label>
      </div>

      {/* Topic list */}
      {filteredTopics.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-8 text-center text-sm text-neutral-500">
          No topics match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTopics.map((topic, index) => {
            const topicGrade = getTopicGrade(topic.topicScore);
            const hookGrade = getHookGrade(topic.hookScore);
            const total = getTotalScore(topic);
            const band = getTotalScoreBand(total);
            const status = getReadinessStatus(topic);
            const nextAction = getNextAction(topic);
            const blockers = getBlockedReasons(topic);
            const shootAllowed = isShootAllowed(topic);
            const scriptAvg = getScriptAverage(topic);
            // Thresholds are advisory now — every score is always editable so
            // you can jump ahead. The Pass/Low/H/A+ badges and readiness label
            // still reflect whether the threshold is met.



            const isExpanded = expandedId === topic.id;
            return (
              <div key={topic.id} className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                  aria-expanded={isExpanded}
                  className="flex w-full flex-wrap items-start justify-between gap-3 text-left cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-xs font-bold text-neutral-300">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{topic.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] font-mono text-neutral-500">
                        <span>{topic.channel}</span>
                        <span>·</span>
                        <span>{topic.status}</span>
                        <span>·</span>
                        <span>Priority {topic.priority}</span>
                        <span>·</span>
                        <span>Updated {new Date(topic.lastUpdated).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary chips */}
                  <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                    <span className={`rounded border px-2 py-1 font-bold ${gradeBadgeTone(topicGrade)}`}>Topic {topicGrade}</span>
                    <span className={`rounded border px-2 py-1 font-bold ${gradeBadgeTone(hookGrade)}`}>Hook {hookGrade}</span>
                    <span className={`rounded border px-2 py-1 font-bold ${scoreTone(total / 10)}`}>{total}/100 · {band.label}</span>
                    <span className={`rounded border px-2 py-1 font-bold ${readinessTone(status)}`}>{status}</span>
                    {shootAllowed
                      ? <span className="rounded border border-emerald-600 bg-emerald-500 px-2 py-1 font-bold text-black">Shoot ✓</span>
                      : <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 font-bold text-neutral-400">Shoot ✕</span>}
                    <span className="ml-1 rounded border border-neutral-800 bg-neutral-900 px-2 py-1 font-bold text-neutral-400">{isExpanded ? '−' : '+'}</span>
                  </div>
                </button>

                {isExpanded && (
                <div>
                {/* Topic + Hook decide whether the script is unlocked. Once
                    unlocked, the three script scores decide shoot eligibility. */}
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                    <div className="mb-2 font-mono">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Topic stage (Topic · Hook)</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <ScoreRow
                        label={SCORE_FIELDS[0].label}
                        value={topic[SCORE_FIELDS[0].key] as number | undefined}
                        onChange={n => updateScore(topic.id, SCORE_FIELDS[0].key, n)}
                        accent="rose"
                        tier="topic"
                      />
                      <ScoreRow
                        label={SCORE_FIELDS[1].label}
                        value={topic[SCORE_FIELDS[1].key] as number | undefined}
                        onChange={n => updateScore(topic.id, SCORE_FIELDS[1].key, n)}
                        accent="cyan"
                        tier="hook"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                    <div className="mb-2 flex items-center justify-between font-mono">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Script stage (Quality · Accuracy · Originality)
                      </span>
                      <span className={`text-[10px] font-bold ${scriptAvg === null ? 'text-neutral-500' : 'text-white'}`}>
                        Avg {scriptAvg === null ? '—' : scriptAvg.toFixed(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      {SCORE_FIELDS.slice(2).map(f => (
                        <ScoreRow
                          key={f.key}
                          label={f.label}
                          value={topic[f.key] as number | undefined}
                          onChange={n => updateScore(topic.id, f.key, n)}
                          accent="cyan"
                          tier="script"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Why blocked + Next action */}
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className={`rounded-lg border p-3 ${blockers.length === 0 ? 'border-emerald-900/40 bg-emerald-950/15' : 'border-rose-900/40 bg-rose-950/15'}`}>
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${blockers.length === 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {blockers.length === 0 ? 'No blockers' : 'Why blocked?'}
                    </div>
                    {blockers.length === 0 ? (
                      <p className="mt-1 text-[11px] text-emerald-200/80 font-mono">All required scores meet the threshold.</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-[11px] text-rose-200/85 font-mono">
                        {blockers.map((r, i) => <li key={i}>• {r}</li>)}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-lg border border-cyan-900/40 bg-cyan-950/15 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Next action</div>
                    <p className="mt-1 text-[11px] font-mono text-cyan-100/85">{nextAction}</p>
                  </div>
                </div>
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Allowed For Shoot list */}
      <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/10 p-5">
        <div className="flex items-center gap-2 border-b border-emerald-900/30 pb-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Allowed For Shoot</h3>
          <span className="ml-auto rounded border border-emerald-700 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
            {allowedList.length} topic{allowedList.length === 1 ? '' : 's'}
          </span>
        </div>
        {allowedList.length === 0 ? (
          <p className="mt-3 text-xs text-neutral-500 font-mono">No topics have cleared every threshold yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {allowedList.map(t => {
              const scriptAvg = getScriptAverage(t);
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-900/30 bg-emerald-950/15 px-3 py-2 text-xs font-mono">
                  <span className="min-w-0 truncate text-sm font-semibold text-white">{t.name}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded border px-2 py-1 font-bold ${gradeBadgeTone(getTopicGrade(t.topicScore))}`}>Topic {getTopicGrade(t.topicScore)}</span>
                    <span className={`rounded border px-2 py-1 font-bold ${gradeBadgeTone(getHookGrade(t.hookScore))}`}>Hook {getHookGrade(t.hookScore)}</span>
                    <span className="rounded border border-emerald-700 bg-emerald-950/50 px-2 py-1 font-bold text-emerald-300">{getTotalScore(t)}/100</span>
                    <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-neutral-300">Script avg {scriptAvg ? scriptAvg.toFixed(1) : '—'}</span>
                    <span className="rounded border border-emerald-700 bg-emerald-500 px-2 py-1 font-bold text-black">Allowed For Shoot</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Needs Work grouped */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5">
        <div className="flex items-center gap-2 border-b border-neutral-900 pb-3">
          <ShieldAlert className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Needs Work</h3>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(needsWork) as WeaknessCategory[]).map(cat => (
            <div key={cat} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">{cat}</span>
                <span className="rounded border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">
                  {needsWork[cat].length}
                </span>
              </div>
              {needsWork[cat].length === 0 ? (
                <p className="mt-2 text-[11px] text-neutral-500 font-mono">None.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-[11px] font-mono text-neutral-300">
                  {needsWork[cat].slice(0, 5).map(t => (
                    <li key={t.id} className="truncate">• {t.name}</li>
                  ))}
                  {needsWork[cat].length > 5 && (
                    <li className="text-neutral-500">+ {needsWork[cat].length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- Sub-components ----------------

function InsightCard({
  icon,
  label,
  value,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: 'neutral' | 'emerald' | 'cyan' | 'amber' | 'rose';
}) {
  const iconTone =
    tone === 'emerald' ? 'text-emerald-400 bg-emerald-950/30 border-emerald-900/40'
    : tone === 'cyan' ? 'text-cyan-400 bg-cyan-950/30 border-cyan-900/40'
    : tone === 'amber' ? 'text-amber-400 bg-amber-950/30 border-amber-900/40'
    : tone === 'rose' ? 'text-rose-400 bg-rose-950/30 border-rose-900/40'
    : 'text-neutral-400 bg-neutral-900 border-neutral-800';
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-3">
      <div className="flex items-center justify-between">
        <span className={`grid h-6 w-6 place-items-center rounded border ${iconTone}`}>{icon}</span>
        <span className="text-lg font-bold font-mono text-white">{value}</span>
      </div>
      <div className="mt-1.5 text-[10px] uppercase tracking-wider text-neutral-500 font-mono">{label}</div>
    </div>
  );
}

function ScoreRow({
  label,
  value,
  onChange,
  disabled,
  disabledHint,
  accent,
  tier
}: {
  label: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  disabled?: boolean;
  disabledHint?: string;
  accent?: 'rose' | 'cyan';
  tier?: ScoreTier;
  key?: string;
}) {
  return (
    <div className={`rounded-lg border p-2.5 ${disabled ? 'border-neutral-900 bg-neutral-950/40 opacity-70' : accent === 'cyan' ? 'border-cyan-900/30 bg-cyan-950/10' : 'border-rose-900/30 bg-rose-950/10'}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold uppercase tracking-wider font-mono ${accent === 'cyan' ? 'text-cyan-300' : 'text-rose-300'}`}>
          {label}
        </span>
        <span className={`font-mono text-[11px] font-bold ${value === undefined ? 'text-neutral-500' : 'text-white'}`}>
          {value === undefined ? 'Unscored' : `${value}/10`}
        </span>
      </div>
      {disabled ? (
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-neutral-500 font-mono">
          <Lock className="h-3 w-3" />
          {disabledHint}
        </div>
      ) : (
        <div className="mt-1.5">
          <ScorePicker value={value} onChange={onChange} compact tier={tier} />
        </div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  data
}: {
  title: string;
  data: Array<{ name: string; count: number; fill: string }>;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
      <div className="text-xs font-bold text-neutral-200 mb-2">{title}</div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke="#525252" fontSize={9} />
            <YAxis stroke="#525252" fontSize={9} allowDecimals={false} />
            <RTooltip
              contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#262626', borderRadius: '8px', fontSize: 11 }}
              labelStyle={{ color: '#a3a3a3', fontSize: 10 }}
              itemStyle={{ fontSize: 11 }}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {data.map(entry => <Cell key={entry.name} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

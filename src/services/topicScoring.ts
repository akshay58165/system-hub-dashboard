// Pure helpers for the topic-scoring / shoot-readiness system.
//
// Every function here is intentionally derivable from a Topic-shaped input —
// scores are stored on Topic, grades / readiness / blocked reasons are all
// derived on-the-fly so we never have to migrate stale computed columns.
//
// Required scores for the main flow are:
//   Topic Score  (topic stage)
//   Hook Score   (topic stage)
//   Script Quality Score      (script stage)
//   Script Accuracy Score     (script stage)
//   Script Originality Score  (script stage)
//
// midScore / endScore remain on the Topic type as optional notes for
// backwards compatibility, but they are intentionally excluded from every
// pass rule, blocker, insight, filter, chart, and total-score calculation.

import type { Topic } from '../types';

export type TopicScoreInput = Pick<
  Topic,
  | 'topicScore'
  | 'hookScore'
  | 'scriptQualityScore'
  | 'scriptAccuracyScore'
  | 'scriptOriginalityScore'
>;

export type TopicGrade = 'A+' | 'A' | 'B' | 'C' | 'Not Scored';
export type HookGrade = 'H10' | 'H2' | 'H3' | 'Low H' | 'Failed Hook' | 'Not Scored';

export type ReadinessStatus =
  | 'Topic Not Scored'
  | 'Needs Topic Rework'
  | 'Hook Not Scored'
  | 'Topic Passed, Hook Weak'
  | 'Script Unlocked'
  | 'Script Quality Needs Work'
  | 'Script Accuracy Needs Work'
  | 'Script Originality Needs Work'
  | 'Allowed For Shoot'
  | 'Incomplete Scoring';

export type WeaknessCategory =
  | 'Needs Topic Rework'
  | 'Hook Weak'
  | 'Quality Weak'
  | 'Accuracy Weak'
  | 'Originality Weak'
  | 'Incomplete Scoring';

const SCRIPT_KEYS = ['scriptQualityScore', 'scriptAccuracyScore', 'scriptOriginalityScore'] as const;
const SHOOT_THRESHOLD = 8;
const TOPIC_PASS = 6;

// ---------------- Grade & average helpers ----------------

export function getTopicGrade(score: number | undefined | null): TopicGrade {
  if (score === undefined || score === null) return 'Not Scored';
  if (score >= 10) return 'A+';
  if (score >= 8) return 'A';
  if (score >= 6) return 'B';
  return 'C';
}

export function getHookGrade(score: number | undefined | null): HookGrade {
  if (score === undefined || score === null) return 'Not Scored';
  if (score >= 10) return 'H10';
  if (score === 9) return 'H2';
  if (score === 8) return 'H3';
  if (score >= 5) return 'Low H';
  return 'Failed Hook';
}

function avg(values: Array<number | undefined | null>): number | null {
  const filled = values.filter((v): v is number => typeof v === 'number');
  if (filled.length === 0) return null;
  return filled.reduce((sum, v) => sum + v, 0) / filled.length;
}

export function getScriptAverage(scores: TopicScoreInput): number | null {
  return avg([scores.scriptQualityScore, scores.scriptAccuracyScore, scores.scriptOriginalityScore]);
}

// Weighted total out of 100. Missing values contribute 0 (honest — you don't
// "earn" the weight of a score you never gave).
// Weights: Topic 30%, Hook 25%, Quality 20%, Accuracy 15%, Originality 10%.
export function getTotalScore(scores: TopicScoreInput): number {
  const t = scores.topicScore ?? 0;
  const h = scores.hookScore ?? 0;
  const q = scores.scriptQualityScore ?? 0;
  const a = scores.scriptAccuracyScore ?? 0;
  const o = scores.scriptOriginalityScore ?? 0;
  const raw = t * 3 + h * 2.5 + q * 2 + a * 1.5 + o;
  return Math.round(raw * 10) / 10;
}

export function getTotalScoreBand(totalScore: number): {
  label: string;
  tone: 'excellent' | 'strong' | 'usable' | 'weak' | 'not-ready';
} {
  if (totalScore >= 90) return { label: 'Excellent', tone: 'excellent' };
  if (totalScore >= 80) return { label: 'Strong', tone: 'strong' };
  if (totalScore >= 70) return { label: 'Usable, needs work', tone: 'usable' };
  if (totalScore >= 60) return { label: 'Weak', tone: 'weak' };
  return { label: 'Not ready', tone: 'not-ready' };
}

// ---------------- Pass rules ----------------

const isScored = (v: number | undefined | null): v is number => typeof v === 'number';

export function isScriptUnlocked(scores: TopicScoreInput): boolean {
  return (
    isScored(scores.topicScore) && scores.topicScore >= TOPIC_PASS &&
    isScored(scores.hookScore) && scores.hookScore >= SHOOT_THRESHOLD
  );
}

export function isShootAllowed(scores: TopicScoreInput): boolean {
  return (
    isScriptUnlocked(scores) &&
    isScored(scores.scriptQualityScore) && scores.scriptQualityScore >= SHOOT_THRESHOLD &&
    isScored(scores.scriptAccuracyScore) && scores.scriptAccuracyScore >= SHOOT_THRESHOLD &&
    isScored(scores.scriptOriginalityScore) && scores.scriptOriginalityScore >= SHOOT_THRESHOLD
  );
}

// ---------------- Blocked reasons / readiness / next action ----------------

export function getBlockedReasons(scores: TopicScoreInput): string[] {
  const reasons: string[] = [];

  if (!isScored(scores.topicScore)) {
    reasons.push('Topic score is missing.');
  } else if (scores.topicScore < TOPIC_PASS) {
    reasons.push(`Topic score is ${scores.topicScore}. Needs 6 or above.`);
  }

  if (!isScored(scores.hookScore)) {
    reasons.push('Hook score is missing.');
  } else if (scores.hookScore < SHOOT_THRESHOLD) {
    reasons.push(`Hook score is ${scores.hookScore}. Needs 8 or above.`);
  }

  const check = (value: number | undefined, key: string) => {
    if (!isScored(value)) reasons.push(`${key} is missing.`);
    else if (value < SHOOT_THRESHOLD) reasons.push(`${key} is ${value}. Needs 8 or above.`);
  };
  check(scores.scriptQualityScore, 'Script quality');
  check(scores.scriptAccuracyScore, 'Script accuracy');
  check(scores.scriptOriginalityScore, 'Script originality');

  return reasons;
}

export function getReadinessStatus(scores: TopicScoreInput): ReadinessStatus {
  const { topicScore, hookScore, scriptQualityScore, scriptAccuracyScore, scriptOriginalityScore } = scores;

  if (!isScored(topicScore)) return 'Topic Not Scored';
  if (topicScore < TOPIC_PASS) return 'Needs Topic Rework';

  if (!isScored(hookScore)) return 'Hook Not Scored';
  if (hookScore < SHOOT_THRESHOLD) return 'Topic Passed, Hook Weak';

  const scriptScored = SCRIPT_KEYS.every(k => isScored(scores[k]));
  if (!scriptScored) return 'Script Unlocked';

  // At this point every script field is scored. Report the first sub-8 slot
  // so the readiness label points at the exact fix the user needs.
  if (isScored(scriptQualityScore) && scriptQualityScore < SHOOT_THRESHOLD) return 'Script Quality Needs Work';
  if (isScored(scriptAccuracyScore) && scriptAccuracyScore < SHOOT_THRESHOLD) return 'Script Accuracy Needs Work';
  if (isScored(scriptOriginalityScore) && scriptOriginalityScore < SHOOT_THRESHOLD) return 'Script Originality Needs Work';

  if (isShootAllowed(scores)) return 'Allowed For Shoot';
  return 'Incomplete Scoring';
}

export function getNextAction(scores: TopicScoreInput): string {
  const s = scores;
  if (!isScored(s.topicScore)) return 'Add a topic score first.';
  if (s.topicScore < TOPIC_PASS) return 'Rework the topic angle until it reaches at least 6.';
  if (!isScored(s.hookScore)) return 'Write and score the hook.';
  if (s.hookScore < SHOOT_THRESHOLD) return 'Rewrite the hook. Strengthen the first 5 seconds.';
  if (!isScored(s.scriptQualityScore) || !isScored(s.scriptAccuracyScore) || !isScored(s.scriptOriginalityScore)) {
    return 'Write the script and score Quality, Accuracy, and Originality.';
  }
  if (s.scriptQualityScore < SHOOT_THRESHOLD) return 'Improve writing quality, clarity, flow, and viewer payoff.';
  if (s.scriptAccuracyScore < SHOOT_THRESHOLD) return 'Verify claims, improve factual correctness, and strengthen research.';
  if (s.scriptOriginalityScore < SHOOT_THRESHOLD) return 'Add a fresher angle, unique perspective, or less generic explanation.';
  return 'Ready for shoot.';
}

// ---------------- Aggregations across the topic list ----------------

export interface TopicScoreInsights {
  totalTopics: number;
  scriptUnlocked: number;
  allowedForShoot: number;
  blocked: number;
  strongTopics: number;
  bTopics: number;
  cTopics: number;
  strongHooks: number;
  weakHooks: number;
  avgTopicScore: number | null;
  avgHookScore: number | null;
  avgScriptScore: number | null;
  avgTotalScore: number | null;
  gradeCounts: { 'A+': number; A: number; B: number; C: number; 'Not Scored': number };
  hookCounts: { H10: number; H2: number; H3: number; 'Low H': number; 'Failed Hook': number; 'Not Scored': number };
  weaknessCounts: Record<WeaknessCategory, number>;
  funnel: {
    total: number;
    topicPassed: number;
    hookPassed: number;
    scriptUnlocked: number;
    scriptPassed: number;
    allowedForShoot: number;
  };
}

export function getScoreInsights(topics: Topic[]): TopicScoreInsights {
  const gradeCounts = { 'A+': 0, A: 0, B: 0, C: 0, 'Not Scored': 0 } as TopicScoreInsights['gradeCounts'];
  const hookCounts = { H10: 0, H2: 0, H3: 0, 'Low H': 0, 'Failed Hook': 0, 'Not Scored': 0 } as TopicScoreInsights['hookCounts'];
  const weaknessCounts: Record<WeaknessCategory, number> = {
    'Needs Topic Rework': 0,
    'Hook Weak': 0,
    'Quality Weak': 0,
    'Accuracy Weak': 0,
    'Originality Weak': 0,
    'Incomplete Scoring': 0
  };

  let scriptUnlocked = 0;
  let allowedForShoot = 0;
  let strongTopics = 0;
  let bTopics = 0;
  let cTopics = 0;
  let strongHooks = 0;
  let weakHooks = 0;

  const topicScores: number[] = [];
  const hookScores: number[] = [];
  const scriptScores: number[] = [];
  const totalScores: number[] = [];

  // Funnel counters
  let fTotal = 0;
  let fTopicPassed = 0;
  let fHookPassed = 0;
  let fScriptUnlocked = 0;
  let fScriptPassed = 0;
  let fAllowed = 0;

  topics.forEach(t => {
    fTotal += 1;

    const tg = getTopicGrade(t.topicScore);
    gradeCounts[tg] += 1;
    const hg = getHookGrade(t.hookScore);
    hookCounts[hg] += 1;

    if (typeof t.topicScore === 'number') topicScores.push(t.topicScore);
    if (typeof t.hookScore === 'number') hookScores.push(t.hookScore);
    const scriptAvg = getScriptAverage(t);
    if (scriptAvg !== null) scriptScores.push(scriptAvg);
    totalScores.push(getTotalScore(t));

    if (typeof t.topicScore === 'number') {
      if (t.topicScore >= 8) strongTopics += 1;
      else if (t.topicScore >= 6) bTopics += 1;
      else cTopics += 1;
    }
    if (typeof t.hookScore === 'number') {
      if (t.hookScore >= 8) strongHooks += 1;
      else weakHooks += 1;
    }

    const passesTopic = typeof t.topicScore === 'number' && t.topicScore >= TOPIC_PASS;
    if (passesTopic) fTopicPassed += 1;

    const passesHook = passesTopic && typeof t.hookScore === 'number' && t.hookScore >= SHOOT_THRESHOLD;
    if (passesHook) {
      fHookPassed += 1;
      fScriptUnlocked += 1; // script unlocks the moment topic + hook pass
      scriptUnlocked += 1;

      const scriptFilled =
        typeof t.scriptQualityScore === 'number' &&
        typeof t.scriptAccuracyScore === 'number' &&
        typeof t.scriptOriginalityScore === 'number';
      const scriptPasses =
        scriptFilled &&
        t.scriptQualityScore! >= SHOOT_THRESHOLD &&
        t.scriptAccuracyScore! >= SHOOT_THRESHOLD &&
        t.scriptOriginalityScore! >= SHOOT_THRESHOLD;
      if (scriptPasses) fScriptPassed += 1;
    }

    const shoot = isShootAllowed(t);
    if (shoot) {
      allowedForShoot += 1;
      fAllowed += 1;
    }

    // Weakness bucketing — count every distinct weakness the topic has.
    if (typeof t.topicScore === 'number' && t.topicScore < TOPIC_PASS) weaknessCounts['Needs Topic Rework'] += 1;
    if (typeof t.hookScore === 'number' && t.hookScore < SHOOT_THRESHOLD) weaknessCounts['Hook Weak'] += 1;
    if (typeof t.scriptQualityScore === 'number' && t.scriptQualityScore < SHOOT_THRESHOLD) weaknessCounts['Quality Weak'] += 1;
    if (typeof t.scriptAccuracyScore === 'number' && t.scriptAccuracyScore < SHOOT_THRESHOLD) weaknessCounts['Accuracy Weak'] += 1;
    if (typeof t.scriptOriginalityScore === 'number' && t.scriptOriginalityScore < SHOOT_THRESHOLD) weaknessCounts['Originality Weak'] += 1;
    if (
      typeof t.topicScore !== 'number' ||
      typeof t.hookScore !== 'number' ||
      typeof t.scriptQualityScore !== 'number' ||
      typeof t.scriptAccuracyScore !== 'number' ||
      typeof t.scriptOriginalityScore !== 'number'
    ) {
      weaknessCounts['Incomplete Scoring'] += 1;
    }
  });

  const mean = (list: number[]): number | null =>
    list.length === 0 ? null : Math.round((list.reduce((s, v) => s + v, 0) / list.length) * 10) / 10;

  return {
    totalTopics: topics.length,
    scriptUnlocked,
    allowedForShoot,
    blocked: topics.length - allowedForShoot,
    strongTopics,
    bTopics,
    cTopics,
    strongHooks,
    weakHooks,
    avgTopicScore: mean(topicScores),
    avgHookScore: mean(hookScores),
    avgScriptScore: mean(scriptScores),
    avgTotalScore: mean(totalScores),
    gradeCounts,
    hookCounts,
    weaknessCounts,
    funnel: {
      total: fTotal,
      topicPassed: fTopicPassed,
      hookPassed: fHookPassed,
      scriptUnlocked: fScriptUnlocked,
      scriptPassed: fScriptPassed,
      allowedForShoot: fAllowed
    }
  };
}

export function getAllowedForShootTopics(topics: Topic[]): Topic[] {
  return topics
    .filter(isShootAllowed)
    .sort((a, b) => getTotalScore(b) - getTotalScore(a));
}

export function getNeedsWorkGroups(topics: Topic[]): Record<WeaknessCategory, Topic[]> {
  const groups: Record<WeaknessCategory, Topic[]> = {
    'Needs Topic Rework': [],
    'Hook Weak': [],
    'Quality Weak': [],
    'Accuracy Weak': [],
    'Originality Weak': [],
    'Incomplete Scoring': []
  };
  topics.forEach(t => {
    if (isShootAllowed(t)) return;
    // Primary blocker only — a topic shows in the highest-priority category
    // that applies. This keeps the "Needs Work" board readable.
    if (typeof t.topicScore === 'number' && t.topicScore < TOPIC_PASS) groups['Needs Topic Rework'].push(t);
    else if (typeof t.hookScore === 'number' && t.hookScore < SHOOT_THRESHOLD) groups['Hook Weak'].push(t);
    else if (typeof t.scriptQualityScore === 'number' && t.scriptQualityScore < SHOOT_THRESHOLD) groups['Quality Weak'].push(t);
    else if (typeof t.scriptAccuracyScore === 'number' && t.scriptAccuracyScore < SHOOT_THRESHOLD) groups['Accuracy Weak'].push(t);
    else if (typeof t.scriptOriginalityScore === 'number' && t.scriptOriginalityScore < SHOOT_THRESHOLD) groups['Originality Weak'].push(t);
    else groups['Incomplete Scoring'].push(t);
  });
  return groups;
}

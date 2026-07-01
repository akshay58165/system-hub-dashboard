// Pure rule-based Daily Readiness insight engine — no AI, no network calls.
// Input is the 12 raw 1-10 parameter values (or null if unset). Output is a
// structured, human-readable interpretation of the day, computed entirely
// from if/else layers as specified, not a giant lookup table of every
// combination.
//
// Variable names follow the spec's short codes internally:
//   R=restfulness N=nutrition H=hydration SS=stomachStatus PA=physicalActivity
//   STR=stressLevel D=endorphinsDistraction(hidden) P=pleasantness
//   SA=scheduleAdherence SO=socialization REL=relationshipDynamic TB=technicalBlockers
//
// D is never surfaced to the user as "horniness"/"arousal" — only as
// "reward drive", "distraction pressure", "stimulation load", or
// "attention pull".

export interface WellbeingParams {
  R: number | null;
  N: number | null;
  H: number | null;
  SS: number | null;
  PA: number | null;
  STR: number | null;
  D: number | null;
  P: number | null;
  SA: number | null;
  SO: number | null;
  REL: number | null;
  TB: number | null;
}

export interface DailyHistoryEntry {
  date: string;
  R: number | null; N: number | null; H: number | null; SS: number | null; PA: number | null;
  STR: number | null; D: number | null; P: number | null; SA: number | null; SO: number | null;
  REL: number | null; TB: number | null;
}

export interface WellbeingInsight {
  dataConfidence: 'insufficient' | 'partial' | 'reliable';
  dataNote: string;
  bottleneck: string;
  dayType: string;
  physical: string;
  stressMood: string;
  stimulation: string;
  execution: string;
  social: string;
  risks: string[];
  action: string;
  trend: string | null;
  headline: { title: string; lines: string[] } | null;
  scores: {
    physicalScore: number; mentalScore: number; executionScore: number; socialScore: number;
    frictionScore: number; recoveryNeedScore: number; distractionRiskScore: number; flatnessRiskScore: number;
  };
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function average(...vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ---- Step 1: value buckets (kept for future use / debugging, not required for current text rules) ----
export function bucket(value: number | null): 'missing' | 'low' | 'medium' | 'high' | 'extreme' {
  if (value === null) return 'missing';
  if (value <= 3) return 'low';
  if (value <= 6) return 'medium';
  if (value <= 8) return 'high';
  return 'extreme';
}

export function stressBucket(STR: number): 'calm' | 'manageable' | 'high' | 'overload' {
  if (STR <= 3) return 'calm';
  if (STR <= 6) return 'manageable';
  if (STR <= 8) return 'high';
  return 'overload';
}

export function blockerBucket(TB: number): 'clean' | 'friction' | 'blocked' | 'severely_blocked' {
  if (TB <= 3) return 'clean';
  if (TB <= 6) return 'friction';
  if (TB <= 8) return 'blocked';
  return 'severely_blocked';
}

export function distractionBucket(D: number): 'flat' | 'stable' | 'high_pull' | 'overstimulated' {
  if (D <= 3) return 'flat';
  if (D <= 6) return 'stable';
  if (D <= 8) return 'high_pull';
  return 'overstimulated';
}

function scoreLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 7.5) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

// Treat an unset (null) parameter as a neutral midpoint (5.5) so composite
// scores stay computable with partial data, while missingCount still drives
// the confidence note separately.
function n(val: number | null): number {
  return val === null ? 5.5 : val;
}

export function generateWellbeingInsight(raw: WellbeingParams, dailyHistory: DailyHistoryEntry[]): WellbeingInsight {
  const R = n(raw.R), N = n(raw.N), H = n(raw.H), SS = n(raw.SS), PA = n(raw.PA);
  const STR = n(raw.STR), D = n(raw.D), P = n(raw.P);
  const SA = n(raw.SA), SO = n(raw.SO), REL = n(raw.REL), TB = n(raw.TB);

  // ---- Step 2: direction correction ----
  const stressGood = 11 - STR;
  const blockerGood = 11 - TB;
  let distractionBalance = 10 - Math.abs(D - 5.5) * 2;
  distractionBalance = clamp(distractionBalance, 1, 10);

  // ---- Step 3: composite scores ----
  const physicalScore = average(R, N, H, SS, PA);
  const mentalScore = average(stressGood, P, distractionBalance);
  const executionScore = average(SA, blockerGood, R, stressGood, distractionBalance);
  const socialScore = average(SO, REL, P, stressGood);
  const frictionScore = average(STR, TB, 11 - SA, 11 - R);
  const recoveryNeedScore = average(11 - R, 11 - N, 11 - H, 11 - SS, STR, 11 - P);
  const distractionRiskScore = average(D, STR, 11 - SA, 11 - P, TB);
  const flatnessRiskScore = average(11 - D, 11 - P, 11 - PA, 11 - SO);

  // ---- Step 4: missing data ----
  const allRaw = [raw.R, raw.N, raw.H, raw.SS, raw.PA, raw.STR, raw.D, raw.P, raw.SA, raw.SO, raw.REL, raw.TB];
  const missingCount = allRaw.filter(v => v === null).length;

  let dataConfidence: WellbeingInsight['dataConfidence'];
  let dataNote: string;
  if (missingCount >= 6) {
    dataConfidence = 'insufficient';
    dataNote = 'Not enough data to generate a reliable daily read.';
  } else if (missingCount >= 3) {
    dataConfidence = 'partial';
    dataNote = 'Daily read is partial. Insight confidence is medium because several inputs are missing.';
  } else {
    dataConfidence = 'reliable';
    dataNote = 'Daily read is reliable.';
  }

  // ---- Step 5: main bottleneck ----
  let bottleneck: string;
  if (recoveryNeedScore >= 7) {
    bottleneck = 'Your main bottleneck today is recovery. The body is not giving enough support for high-output work.';
  } else if (frictionScore >= 7) {
    bottleneck = 'Your main bottleneck today is friction. The issue is not only discipline, the system around you is making execution harder.';
  } else if (mentalScore <= 4.5) {
    bottleneck = 'Your main bottleneck today is mental load. Work may feel heavier than it actually is.';
  } else if (socialScore <= 4.5) {
    bottleneck = 'Your main bottleneck today is social or emotional background noise.';
  } else if (executionScore <= 4.5) {
    bottleneck = 'Your main bottleneck today is execution structure. Energy may exist, but it is not converting into planned action.';
  } else {
    bottleneck = 'No major bottleneck is visible today. The day is usable.';
  }

  // ---- Step 6: day type ----
  let dayType: string;
  if (R >= 7 && STR <= 3 && TB <= 3 && SA >= 7 && D >= 4 && D <= 6) {
    dayType = 'This is a deep work day. Use it for scripting, editing, planning, difficult decisions, or focused creative work.';
  } else if (physicalScore >= 7 && executionScore >= 7 && mentalScore >= 6) {
    dayType = 'This is an execution day. Push important output forward before the state changes.';
  } else if (P >= 7 && R >= 6 && STR <= 5 && TB <= 4 && D >= 4 && D <= 7) {
    dayType = 'This is a creative day. It is suitable for ideation, writing, brainstorming, and content thinking.';
  } else if (recoveryNeedScore >= 7) {
    dayType = 'This is a recovery day. Forcing maximum output may create more resistance tomorrow.';
  } else if (TB >= 7 || (TB >= 6 && SA <= 4)) {
    dayType = 'This is a friction day. Fix tools, systems, pending setup, or blockers before expecting clean productivity.';
  } else if (D >= 8 && SA <= 5) {
    dayType = 'This is a distraction control day. Avoid open-ended digital spaces and keep tasks closed, short, and timed.';
  } else if (REL <= 3 && (STR >= 6 || P <= 4)) {
    dayType = 'This is an emotional reset day. Relationship noise may affect focus and decision quality.';
  } else {
    dayType = 'This is a maintenance day. Use it for moderate tasks, cleanup, admin, and steady progress.';
  }

  // ---- Step 7: physical insight ----
  let physical: string;
  if (R <= 3 && H <= 4) {
    physical = 'Low rest and low hydration are combining. Fatigue today may be physical, not motivational.';
  } else if (R >= 7 && N <= 4) {
    physical = 'Recovery is decent, but fuel quality is weak. You may start well and dip later.';
  } else if (N <= 4 && H <= 4) {
    physical = 'Nutrition and hydration are both weak. Energy stability may be poor today.';
  } else if (SS <= 3 && N >= 7) {
    physical = 'Food intake may be present, but the body is not responding cleanly. Keep work lighter until the stomach settles.';
  } else if (PA <= 3 && R <= 4) {
    physical = 'Low activity and low rest can create a sluggish loop. A small walk or body reset may help more than forcing work.';
  } else if (physicalScore >= 7) {
    physical = 'Physical readiness is strong. The body can support meaningful work today.';
  } else {
    physical = 'Physical readiness is moderate. Do not overestimate stamina.';
  }

  // ---- Step 8: stress and mood ----
  let stressMood: string;
  if (STR >= 8 && P <= 3) {
    stressMood = 'Stress is high and pleasantness is low. This is a heavy mental state, so avoid emotionally expensive decisions.';
  } else if (STR >= 7 && P >= 7) {
    stressMood = 'Stress is present, but mood is still holding. This is manageable pressure, not a full crash.';
  } else if (STR <= 3 && P <= 3) {
    stressMood = 'Stress is low but pleasantness is also low. This may be a flat or under-stimulated day, not a crisis.';
  } else if (STR <= 3 && P >= 7) {
    stressMood = 'The emotional state is clean. This is a good window for calm, focused work.';
  } else {
    stressMood = 'Mental state is mixed. Choose tasks that do not require perfect mood.';
  }

  // ---- Step 9: hidden metric (D) — public-safe wording only ----
  let stimulation: string;
  if (D >= 9 && STR >= 7) {
    stimulation = 'Reward drive and stress are both high. This is an escape-seeking state. Keep the environment controlled.';
  } else if (D >= 8 && SA <= 5) {
    stimulation = 'Attention pull is high and schedule adherence is weak. The day can easily drift into reactive behavior.';
  } else if (D >= 8 && P >= 7) {
    stimulation = 'Mood is good, but stimulation load is high. Use the energy creatively before it turns into distraction.';
  } else if (D <= 3 && P <= 4) {
    stimulation = 'Reward drive and pleasantness are both low. This may feel dull, flat, or emotionally muted.';
  } else if (D <= 3 && STR >= 7) {
    stimulation = 'Stress is high but reward drive is low. This looks more like exhausted pressure than active distraction.';
  } else if (D >= 4 && D <= 6 && STR <= 5) {
    stimulation = 'Stimulation load is stable. This is a good state for focused work.';
  } else {
    stimulation = 'Stimulation load is uneven. Keep tasks short and avoid relying on willpower alone.';
  }

  // ---- Step 10: execution ----
  let execution: string;
  if (SA >= 7 && TB <= 3) {
    execution = 'The execution system is clean. Planned work can move smoothly.';
  } else if (SA <= 4 && TB <= 3) {
    execution = 'Blockers are low but schedule adherence is weak. This points to self-drift, not system friction.';
  } else if (SA >= 7 && TB >= 7) {
    execution = 'You are trying to stay disciplined despite blockers. Fix friction before adding more pressure.';
  } else if (SA <= 4 && TB >= 7) {
    execution = 'Schedule and systems are both breaking. Today needs simplification, not ambition.';
  } else if (SA <= 4 && STR >= 7) {
    execution = 'Stress is damaging schedule adherence. Start with a small controlled task.';
  } else if (SA >= 7 && STR >= 7) {
    execution = 'You are following the plan under pressure. Keep the workload contained to avoid a delayed crash.';
  } else {
    execution = 'Execution is average. The day needs structure but not emergency correction.';
  }

  // ---- Step 11: social and relationship ----
  let social: string;
  if (SO >= 7 && REL >= 7) {
    social = 'Social connection looks supportive today.';
  } else if (SO >= 7 && REL <= 4) {
    social = 'There is social contact, but the quality is not clean. This can leave you mentally crowded but not supported.';
  } else if (SO <= 3 && REL >= 7) {
    social = 'Low socialization is not necessarily a problem today because relationship quality is stable.';
  } else if (SO <= 3 && REL <= 3) {
    social = 'Social and relationship support are both low. Isolation may affect mood or discipline.';
  } else if (REL <= 3 && STR >= 7) {
    social = 'Relationship strain and stress are combining. Avoid sensitive conversations during peak load.';
  } else if (REL >= 7 && P >= 7) {
    social = 'Relationship quality is supporting mood today.';
  } else {
    social = 'Social state is neutral. It is not the main driver today.';
  }

  // ---- Step 12: risk flags (max 2) ----
  const risks: string[] = [];
  if (recoveryNeedScore >= 7) risks.push('Crash risk');
  if (distractionRiskScore >= 7) risks.push('Distraction drift risk');
  if (STR >= 8 && REL <= 4) risks.push('Emotional spillover risk');
  if (TB >= 7 && SA <= 5) risks.push('System failure risk');
  if (R <= 3 && STR >= 7) risks.push('Burnout pressure risk');
  if (N <= 3 && H <= 3) risks.push('Energy dip risk');
  if (D <= 3 && P <= 3) risks.push('Flat mood risk');
  const topRisks = risks.slice(0, 2);

  // ---- Step 13: single highest-priority action ----
  let action: string;
  if (H <= 3) {
    action = 'Fix hydration first before judging your energy.';
  } else if (R <= 3) {
    action = "Reduce today's workload and protect recovery.";
  } else if (TB >= 7) {
    action = 'Fix one technical blocker before starting important work.';
  } else if (STR >= 8) {
    action = 'Start with a low-pressure task for 20 minutes.';
  } else if (D >= 8) {
    action = 'Use timers, avoid open-ended browsing, and keep the phone away during work blocks.';
  } else if (SA <= 4) {
    action = 'Create a smaller plan for the next 3 hours instead of trying to fix the whole day.';
  } else if (REL <= 3 && STR >= 6) {
    action = 'Avoid reactive conversations until stress comes down.';
  } else if (PA <= 3 && P <= 4) {
    action = 'Use a short walk or movement reset to break the flat state.';
  } else {
    action = 'Use the day normally. Push one meaningful task forward.';
  }

  // ---- Full priority order: single overall headline for the day ----
  let headline: WellbeingInsight['headline'] = null;
  if (missingCount < 6) {
    type Kind =
      | 'high_recovery_need' | 'mental_overload' | 'system_blocked' | 'high_distraction_pressure'
      | 'deep_work_day' | 'execution_day' | 'creative_day' | 'relationship_stress_spillover'
      | 'self_drift' | 'disciplined_but_blocked' | 'maintenance_day';

    let kind: Kind;
    if (recoveryNeedScore >= 8) kind = 'high_recovery_need';
    else if (STR >= 9 && P <= 3) kind = 'mental_overload';
    else if (TB >= 8 && SA <= 4) kind = 'system_blocked';
    else if (D >= 9 && SA <= 5) kind = 'high_distraction_pressure';
    else if (R >= 7 && STR <= 3 && TB <= 3 && SA >= 7 && D >= 4 && D <= 6) kind = 'deep_work_day';
    else if (physicalScore >= 7 && executionScore >= 7) kind = 'execution_day';
    else if (P >= 7 && STR <= 5 && D >= 4 && D <= 7) kind = 'creative_day';
    else if (REL <= 3 && STR >= 6) kind = 'relationship_stress_spillover';
    else if (SA <= 4 && TB <= 3) kind = 'self_drift';
    else if (SA >= 7 && TB >= 7) kind = 'disciplined_but_blocked';
    else kind = 'maintenance_day';

    const HEADLINE_TITLES: Record<Kind, string> = {
      high_recovery_need: 'Recovery day',
      mental_overload: 'Mental overload',
      system_blocked: 'System blocked',
      high_distraction_pressure: 'Distraction control day',
      deep_work_day: 'Deep work day',
      execution_day: 'Execution day',
      creative_day: 'Creative day',
      relationship_stress_spillover: 'Relationship stress spillover',
      self_drift: 'Self-drift',
      disciplined_but_blocked: 'Disciplined but blocked',
      maintenance_day: 'Maintenance day'
    };

    headline = {
      title: HEADLINE_TITLES[kind],
      lines: [dayType, bottleneck, `Best action: ${action}`]
    };
  }

  // ---- Trend logic — only once at least 6 prior days of history exist ----
  let trend: string | null = null;
  if (dailyHistory.length >= 6) {
    const last3 = dailyHistory.slice(-3);
    const prev3 = dailyHistory.slice(-6, -3);
    const avg = (arr: DailyHistoryEntry[], key: keyof DailyHistoryEntry) => {
      const vals = arr.map(e => e[key]).filter((v): v is number => typeof v === 'number');
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const stressLast3 = avg(last3, 'STR'), stressPrev3 = avg(prev3, 'STR');
    const scheduleLast3 = avg(last3, 'SA'), schedulePrev3 = avg(prev3, 'SA');
    const restLast3 = avg(last3, 'R');
    const tbLast3 = avg(last3, 'TB');
    const dLast3 = avg(last3, 'D');
    const relLast3 = avg(last3, 'REL');

    if (stressLast3 !== null && stressPrev3 !== null && stressLast3 > stressPrev3 + 2) {
      trend = 'Stress is rising quickly. Reduce load before it affects consistency.';
    } else if (scheduleLast3 !== null && schedulePrev3 !== null && scheduleLast3 < schedulePrev3 - 2) {
      trend = 'Schedule adherence is falling. The current routine is losing stability.';
    } else if (restLast3 !== null && restLast3 <= 4 && stressLast3 !== null && stressLast3 >= 7) {
      trend = 'Low rest and high stress are repeating. This is a recovery warning.';
    } else if (tbLast3 !== null && tbLast3 >= 7) {
      trend = 'Technical blockers are becoming a pattern. Fixing the system may give more benefit than pushing harder.';
    } else if (dLast3 !== null && dLast3 >= 8 && scheduleLast3 !== null && scheduleLast3 <= 5) {
      trend = 'High attention pull is repeatedly weakening schedule adherence.';
    } else if (relLast3 !== null && relLast3 <= 4 && stressLast3 !== null && stressLast3 >= 6) {
      trend = 'Relationship quality may be contributing to stress.';
    } else {
      trend = 'No strong negative trend detected.';
    }
  }

  return {
    dataConfidence,
    dataNote,
    bottleneck,
    dayType,
    physical,
    stressMood,
    stimulation,
    execution,
    social,
    risks: topRisks,
    action,
    trend,
    headline,
    scores: { physicalScore, mentalScore, executionScore, socialScore, frictionScore, recoveryNeedScore, distractionRiskScore, flatnessRiskScore }
  };
}

// ---- Daily archive for trend detection ----
// Stores one snapshot per calendar day in localStorage (capped) so the trend
// rules above have something to compare against once enough days exist.
const ARCHIVE_KEY = 'unicorn_wellbeing_daily_archive';
const ARCHIVE_MAX_DAYS = 30;

export function loadDailyArchive(): DailyHistoryEntry[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordTodayInArchive(todayDateStr: string, params: WellbeingParams): DailyHistoryEntry[] {
  const archive = loadDailyArchive();
  const entry: DailyHistoryEntry = { date: todayDateStr, ...params };
  const existingIdx = archive.findIndex(e => e.date === todayDateStr);
  if (existingIdx >= 0) {
    archive[existingIdx] = entry;
  } else {
    archive.push(entry);
  }
  const trimmed = archive.slice(-ARCHIVE_MAX_DAYS);
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore quota errors */
  }
  return trimmed;
}

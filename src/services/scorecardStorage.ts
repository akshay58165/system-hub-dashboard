// Date-keyed scorecard state: owns "what day is it", day-rollover (today ->
// archive), and migration from the old flat single-day shape. Pure functions
// only - no localStorage/network access - so App.tsx stays the single place
// that decides when to persist/sync.

import { ScorecardDayEntry, ScorecardParams, ScorecardState } from '../types';
import { DailyHistoryEntry } from './wellbeingInsights';

export const PARAM_LABELS: Record<keyof ScorecardParams, string> = {
  restfulness: 'Restfulness',
  nutrition: 'Nutrition',
  hydration: 'Hydration',
  physicalActivity: 'Physical Activity',
  endorphins: 'Endorphins',
  schedule: 'Schedule Adherence',
  pleasantness: 'Pleasantness',
  socialization: 'Socialization',
  stomach: 'Stomach Status',
  technicalities: 'Technical Blockers',
  relations: 'Relationship Dynamic',
  stress: 'Stress Level'
};

const PARAM_KEYS = Object.keys(PARAM_LABELS) as (keyof ScorecardParams)[];

const ARCHIVE_MAX_DAYS = 90;

// Local calendar day, zero-padded - the single source of truth for "what day
// is it" used everywhere in the scorecard. (Previously built inline as
// `${y}-${m}-${d}` with no zero-padding, producing malformed strings like
// "2026-7-2" that could never match a correctly padded string.)
export function getLocalDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initHistoryEntry(): ScorecardDayEntry['history'][number] {
  return {
    id: 'init',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    parameter: 'System',
    oldVal: 'None',
    newVal: 'Initialized',
    scoreEffect: 0,
    description: 'Daily Readiness Scorecard initialized with baseline levels.'
  };
}

export function createEmptyDayEntry(dateKey: string): ScorecardDayEntry {
  return {
    restfulness: null,
    nutrition: null,
    hydration: null,
    physicalActivity: null,
    endorphins: null,
    schedule: null,
    pleasantness: null,
    socialization: null,
    stomach: null,
    technicalities: null,
    relations: null,
    stress: null,
    history: [initHistoryEntry()],
    date: dateKey
  };
}

export function countFilled(params: ScorecardParams): number {
  return PARAM_KEYS.reduce((count, key) => count + (params[key] !== null ? 1 : 0), 0);
}

export function getMissingParamLabels(params: ScorecardParams): string[] {
  return PARAM_KEYS.filter(key => params[key] === null).map(key => PARAM_LABELS[key]);
}

function hasAnyData(entry: ScorecardDayEntry): boolean {
  return PARAM_KEYS.some(key => entry[key] !== null);
}

function isValidDayEntry(value: any): value is ScorecardDayEntry {
  return !!value && typeof value === 'object' && typeof value.date === 'string' && Array.isArray(value.history);
}

// If `state.today` is still dated for the current local day, this is a no-op
// (same reference returned, so callers can skip a re-render). Otherwise the
// stale `today` is archived (dropped if it was never touched) and a fresh
// empty entry is created for the new day.
export function rolloverScorecard(state: ScorecardState): ScorecardState {
  const todayKey = getLocalDateKey();
  if (state.today.date === todayKey) return state;

  const archive = [...state.archive];
  if (hasAnyData(state.today)) {
    const existingIdx = archive.findIndex(e => e.date === state.today.date);
    if (existingIdx >= 0) archive[existingIdx] = state.today;
    else archive.push(state.today);
  }
  archive.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = archive.slice(-ARCHIVE_MAX_DAYS);

  return {
    today: createEmptyDayEntry(todayKey),
    archive: trimmed
  };
}

// Accepts anything currently stored under `scorecard` - a fresh/empty value,
// the old flat single-day shape, or the current { today, archive } shape -
// and always returns a valid, rollover-correct ScorecardState. Safe to call
// on every read of remote/local scorecard data.
export function normalizeScorecard(raw: any): ScorecardState {
  const todayKey = getLocalDateKey();

  if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) {
    return { today: createEmptyDayEntry(todayKey), archive: [] };
  }

  if (isValidDayEntry(raw.today)) {
    const archive = Array.isArray(raw.archive) ? raw.archive.filter(isValidDayEntry) : [];
    return rolloverScorecard({ today: raw.today, archive });
  }

  // Old flat shape: 12 params + history + date directly on the object.
  const legacyDate = typeof raw.date === 'string' && raw.date.length > 0 ? raw.date : todayKey;
  const legacyToday: ScorecardDayEntry = {
    restfulness: raw.restfulness ?? null,
    nutrition: raw.nutrition ?? null,
    hydration: raw.hydration ?? null,
    physicalActivity: raw.physicalActivity ?? null,
    endorphins: raw.endorphins ?? null,
    schedule: raw.schedule ?? null,
    pleasantness: raw.pleasantness ?? null,
    socialization: raw.socialization ?? null,
    stomach: raw.stomach ?? null,
    technicalities: raw.technicalities ?? null,
    relations: raw.relations ?? null,
    stress: raw.stress ?? null,
    history: Array.isArray(raw.history) && raw.history.length > 0 ? raw.history : [initHistoryEntry()],
    date: legacyDate
  };

  return rolloverScorecard({ today: legacyToday, archive: [] });
}

export function toDailyHistoryEntry(day: ScorecardDayEntry): DailyHistoryEntry {
  return {
    date: day.date,
    R: day.restfulness,
    N: day.nutrition,
    H: day.hydration,
    SS: day.stomach,
    PA: day.physicalActivity,
    STR: day.stress,
    D: day.endorphins,
    P: day.pleasantness,
    SA: day.schedule,
    SO: day.socialization,
    REL: day.relations,
    TB: day.technicalities
  };
}

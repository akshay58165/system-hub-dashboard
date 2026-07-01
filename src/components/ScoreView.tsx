import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Heart,
  TrendingUp,
  SlidersHorizontal,
  Flame,
  ShieldAlert,
  Zap,
  WifiOff,
  UserCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar
} from 'recharts';
import { GitHubRepo, VercelProject, SupabaseProject } from '../types';
import {
  generateWellbeingInsight,
  recordTodayInArchive,
  WellbeingParams,
  WellbeingInsight as WellbeingInsightResult
} from '../services/wellbeingInsights';

interface ScoreViewProps {
  repos: GitHubRepo[];
  vercelProjects: VercelProject[];
  supabase: SupabaseProject;
  scorecard: any;
  setScorecard: React.Dispatch<React.SetStateAction<any>>;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  parameter: string;
  oldVal: string;
  newVal: string;
  scoreEffect: number;
  description: string;
}

export default function ScoreView({ repos, vercelProjects, supabase, scorecard, setScorecard }: ScoreViewProps) {
  // 12 Daily parameters mapped to props
  const restfulness = scorecard.restfulness;
  const setRestfulness = (val: number | null) => setScorecard(prev => ({ ...prev, restfulness: val }));

  const nutrition = scorecard.nutrition;
  const setNutrition = (val: number | null) => setScorecard(prev => ({ ...prev, nutrition: val }));

  const hydration = scorecard.hydration;
  const setHydration = (val: number | null) => setScorecard(prev => ({ ...prev, hydration: val }));

  const physicalActivity = scorecard.physicalActivity;
  const setPhysicalActivity = (val: number | null) => setScorecard(prev => ({ ...prev, physicalActivity: val }));

  const endorphins = scorecard.endorphins;
  const setEndorphins = (val: number | null) => setScorecard(prev => ({ ...prev, endorphins: val }));

  const schedule = scorecard.schedule;
  const setSchedule = (val: number | null) => setScorecard(prev => ({ ...prev, schedule: val }));

  const pleasantness = scorecard.pleasantness;
  const setPleasantness = (val: number | null) => setScorecard(prev => ({ ...prev, pleasantness: val }));

  const socialization = scorecard.socialization;
  const setSocialization = (val: number | null) => setScorecard(prev => ({ ...prev, socialization: val }));

  const stomach = scorecard.stomach;
  const setStomach = (val: number | null) => setScorecard(prev => ({ ...prev, stomach: val }));

  const technicalities = scorecard.technicalities;
  const setTechnicalities = (val: number | null) => setScorecard(prev => ({ ...prev, technicalities: val }));

  const relations = scorecard.relations;
  const setRelations = (val: number | null) => setScorecard(prev => ({ ...prev, relations: val }));

  const stress = scorecard.stress;
  const setStress = (val: number | null) => setScorecard(prev => ({ ...prev, stress: val }));

  const history = scorecard.history || [];
  const setHistory = (val: any) => setScorecard((prev: any) => ({
    ...prev,
    history: typeof val === 'function' ? val(prev.history || []) : val
  }));

  // Load data from LocalStorage on mount
  useEffect(() => {
    const today = new Date();
    const currentDateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const storedDate = localStorage.getItem('unicorn_scorecard_date');

    if (storedDate === currentDateStr) {
      const loadParam = (key: string) => {
        const val = localStorage.getItem(`unicorn_scorecard_${key}`);
        return val ? parseInt(val, 10) : null;
      };
      
      let storedHistory = [];
      try {
        const hist = localStorage.getItem('unicorn_scorecard_history');
        if (hist) storedHistory = JSON.parse(hist);
      } catch (e) {
        // ignore
      }

      setScorecard({
        restfulness: loadParam('restfulness'),
        nutrition: loadParam('nutrition'),
        hydration: loadParam('hydration'),
        physicalActivity: loadParam('physicalActivity'),
        endorphins: loadParam('endorphins'),
        schedule: loadParam('schedule'),
        pleasantness: loadParam('pleasantness'),
        socialization: loadParam('socialization'),
        stomach: loadParam('stomach'),
        technicalities: loadParam('technicalities'),
        relations: loadParam('relations'),
        stress: loadParam('stress'),
        history: storedHistory.length > 0 ? storedHistory : [
          {
            id: 'init',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            parameter: 'System',
            oldVal: 'None',
            newVal: 'Initialized',
            scoreEffect: 0,
            description: 'Daily Readiness Scorecard initialized with baseline levels.'
          }
        ],
        date: currentDateStr
      });
    } else {
      localStorage.setItem('unicorn_scorecard_date', currentDateStr);
      const initialHistory = [
        {
          id: 'init',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          parameter: 'System',
          oldVal: 'None',
          newVal: 'Initialized',
          scoreEffect: 0,
          description: 'Daily Readiness Scorecard initialized with baseline levels.'
        }
      ];
      setScorecard({
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
        history: initialHistory,
        date: currentDateStr
      });
      
      const keys = ['restfulness', 'nutrition', 'hydration', 'physicalActivity', 'endorphins', 'schedule', 'pleasantness', 'socialization', 'stomach', 'technicalities', 'relations', 'stress'];
      keys.forEach(k => localStorage.removeItem(`unicorn_scorecard_${k}`));
      localStorage.setItem('unicorn_scorecard_history', JSON.stringify(initialHistory));
    }
  }, []);

  // Debouncing refs to prevent micro-increment logging spam
  const logTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const originalValuesRef = useRef<Record<string, number | null>>({});
  const latestParamsRef = useRef<Record<string, number | null>>({});

  // Maintain the latest values in a ref on every render to prevent stale closure loops
  latestParamsRef.current = {
    restfulness,
    nutrition,
    hydration,
    physicalActivity,
    endorphins,
    schedule,
    pleasantness,
    socialization,
    stomach,
    technicalities,
    relations,
    stress
  };

  // Compile calculations (aggregated Bio-Score and Radar Chart vectors)
  const computedMetrics = useMemo(() => {
    const getPoints = (name: string, val: number | null) => {
      if (val === null) return 0;
      if (['restfulness', 'nutrition', 'hydration', 'schedule', 'pleasantness', 'stomach'].includes(name)) {
        return val;
      }
      if (name === 'physicalActivity') {
        if (val >= 5 && val <= 7) return 10;
        if (val === 3 || val === 4 || val === 8 || val === 9) return 6;
        return 3;
      }
      if (name === 'endorphins') {
        if (val <= 2) return 10;
        if (val <= 4) return 8;
        if (val <= 6) return 5;
        if (val <= 8) return 3;
        return 1;
      }
      if (name === 'socialization') {
        if (val >= 5 && val <= 7) return 10;
        if (val === 3 || val === 4 || val === 8 || val === 9) return 6;
        return 4;
      }
      if (name === 'technicalities') {
        if (val <= 2) return 10;
        if (val <= 4) return 8;
        if (val <= 6) return 5;
        if (val <= 8) return 3;
        return 1;
      }
      if (name === 'relations') {
        if (val >= 9) return 10;
        if (val >= 7) return 8;
        if (val >= 5) return 6;
        if (val >= 3) return 3;
        return 1;
      }
      if (name === 'stress') {
        if (val <= 2) return 10;
        if (val <= 4) return 8;
        if (val <= 6) return 5;
        if (val <= 8) return 3;
        return 1;
      }
      return 0;
    };

    const paramsList = [
      { name: 'restfulness', val: restfulness },
      { name: 'nutrition', val: nutrition },
      { name: 'hydration', val: hydration },
      { name: 'physicalActivity', val: physicalActivity },
      { name: 'endorphins', val: endorphins },
      { name: 'schedule', val: schedule },
      { name: 'pleasantness', val: pleasantness },
      { name: 'socialization', val: socialization },
      { name: 'stomach', val: stomach },
      { name: 'technicalities', val: technicalities },
      { name: 'relations', val: relations },
      { name: 'stress', val: stress }
    ];

    const activeParams = paramsList.filter(p => p.val !== null);
    const activeCount = activeParams.length;

    let aggregate = 0;
    if (activeCount > 0) {
      const activePointsSum = activeParams.reduce((sum, p) => sum + getPoints(p.name, p.val), 0);
      aggregate = Math.round((activePointsSum / (activeCount * 10)) * 100);
    }

    // Compute composite metrics for Recharts Radar Chart (bound 10-100)
    const physActive = [restfulness, nutrition, hydration, physicalActivity].filter(v => v !== null) as number[];
    const physEnergy = physActive.length > 0
      ? Math.min(100, Math.max(10, Math.round(
          (physActive.reduce((sum, v) => sum + v, 0) / physActive.length) * 10
        )))
      : 10;

    const focusActive = [endorphins, stress, technicalities].filter(v => v !== null) as number[];
    const focusBandwidth = focusActive.length > 0
      ? Math.min(100, Math.max(10, Math.round(
          ((10 - (focusActive[0] || 0)) + (10 - (focusActive[1] || 0)) + (10 - (focusActive[2] || 0))) / focusActive.length * 10
        )))
      : 10;

    const timeActive = [schedule, socialization].filter(v => v !== null) as number[];
    const timeEfficiency = timeActive.length > 0
      ? Math.min(100, Math.max(10, Math.round(
          (timeActive.reduce((sum, v) => sum + v, 0) / timeActive.length) * 10
        )))
      : 10;

    const emotionalActive = [pleasantness, stomach, relations].filter(v => v !== null) as number[];
    const emotionalVibe = emotionalActive.length > 0
      ? Math.min(100, Math.max(10, Math.round(
          (emotionalActive.reduce((sum, v) => sum + v, 0) / emotionalActive.length) * 10
        )))
      : 10;

    const socialActive = [socialization, relations].filter(v => v !== null) as number[];
    const socialHarmony = socialActive.length > 0
      ? Math.min(100, Math.max(10, Math.round(
          (socialActive.reduce((sum, v) => sum + v, 0) / socialActive.length) * 10
        )))
      : 10;

    const bioActive = [stomach, stress, restfulness].filter(v => v !== null) as number[];
    const biologicalComfort = bioActive.length > 0
      ? Math.min(100, Math.max(10, Math.round(
          ((bioActive[0] || 0) + (10 - (bioActive[1] || 0)) + (bioActive[2] || 0)) / bioActive.length * 10
        )))
      : 10;

    return {
      aggregate,
      physEnergy,
      focusBandwidth,
      timeEfficiency,
      emotionalVibe,
      socialHarmony,
      biologicalComfort
    };
  }, [restfulness, nutrition, hydration, physicalActivity, endorphins, schedule, pleasantness, socialization, stomach, technicalities, relations, stress]);

  // ---- Live Insight Engine (rule-based, no AI) ----
  // Watches every Daily Parameter. The instant ANY value changes, the old
  // insight is cleared and an "analyzing" state shows. A single global timer
  // resets on every change and only fires 10 seconds after the LAST change
  // across any parameter — so a burst of edits (hydration, then stomach 5s
  // later, etc.) produces exactly one consolidated insight once everything
  // has actually settled, not one per click and not one per parameter.
  const [wellbeingInsight, setWellbeingInsight] = useState<WellbeingInsightResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insightTimestamp, setInsightTimestamp] = useState<string | null>(null);
  const insightTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Snapshot of the 12 raw values as of the last effect run — used to tell a
  // genuine single-parameter user tap apart from a bulk data load (initial
  // localStorage hydration, or a remote Supabase sync landing later). A real
  // tap changes exactly one value in a commit; a bulk load replaces several
  // at once, so it's skipped instead of being mistaken for user activity.
  const prevSnapshotRef = useRef<(number | null)[] | null>(null);

  useEffect(() => {
    const currentSnapshot = [restfulness, nutrition, hydration, stomach, physicalActivity, stress, endorphins, pleasantness, schedule, socialization, relations, technicalities];

    if (prevSnapshotRef.current === null) {
      // First run ever for this mount — record the baseline, don't analyze.
      prevSnapshotRef.current = currentSnapshot;
      return;
    }

    const changedCount = currentSnapshot.reduce((count, v, i) => count + (v !== prevSnapshotRef.current![i] ? 1 : 0), 0);
    prevSnapshotRef.current = currentSnapshot;

    if (changedCount === 0) return;
    if (changedCount > 1) {
      // Several values moved together in one commit — a data load, not a tap.
      return;
    }

    // Exactly one parameter changed — a real user interaction.
    setWellbeingInsight(null);
    setIsAnalyzing(true);

    if (insightTimerRef.current) clearTimeout(insightTimerRef.current);

    insightTimerRef.current = setTimeout(() => {
      const params: WellbeingParams = {
        R: restfulness, N: nutrition, H: hydration, SS: stomach, PA: physicalActivity,
        STR: stress, D: endorphins, P: pleasantness, SA: schedule, SO: socialization,
        REL: relations, TB: technicalities
      };

      const today = new Date();
      const todayDateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
      const archive = recordTodayInArchive(todayDateStr, params);
      // Exclude today's just-written entry from the trend comparison itself.
      const priorDays = archive.filter(e => e.date !== todayDateStr);

      const result = generateWellbeingInsight(params, priorDays);
      setWellbeingInsight(result);
      setInsightTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setIsAnalyzing(false);
    }, 10000);

    return () => {
      if (insightTimerRef.current) clearTimeout(insightTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restfulness, nutrition, hydration, stomach, physicalActivity, stress, endorphins, pleasantness, schedule, socialization, relations, technicalities]);

  // Write final transition logs when timer fires after input inactivity
  const writeFinalLog = (paramName: string, oldVal: number | null, newVal: number) => {
    const getPoints = (name: string, val: number | null) => {
      if (val === null) return 0;
      if (['restfulness', 'nutrition', 'hydration', 'schedule', 'pleasantness', 'stomach'].includes(name)) {
        return val;
      }
      if (name === 'physicalActivity') {
        if (val >= 5 && val <= 7) return 10;
        if (val === 3 || val === 4 || val === 8 || val === 9) return 6;
        return 3;
      }
      if (name === 'endorphins') {
        if (val <= 2) return 10;
        if (val <= 4) return 8;
        if (val <= 6) return 5;
        if (val <= 8) return 3;
        return 1;
      }
      if (name === 'socialization') {
        if (val >= 5 && val <= 7) return 10;
        if (val === 3 || val === 4 || val === 8 || val === 9) return 6;
        return 4;
      }
      if (name === 'technicalities') {
        if (val <= 2) return 10;
        if (val <= 4) return 8;
        if (val <= 6) return 5;
        if (val <= 8) return 3;
        return 1;
      }
      if (name === 'relations') {
        if (val >= 9) return 10;
        if (val >= 7) return 8;
        if (val >= 5) return 6;
        if (val >= 3) return 3;
        return 1;
      }
      if (name === 'stress') {
        if (val <= 2) return 10;
        if (val <= 4) return 8;
        if (val <= 6) return 5;
        if (val <= 8) return 3;
        return 1;
      }
      return 0;
    };

    const oldPts = oldVal !== null ? getPoints(paramName, oldVal) : 5;
    const newPts = getPoints(paramName, newVal);
    const diffScore = Math.round(((newPts - oldPts) / 120) * 100);

    let explanation = '';
    const oldCompareVal = oldVal !== null ? oldVal : 5;
    switch (paramName) {
      case 'restfulness':
        explanation = newVal > oldCompareVal ? 'Better rest restores vital energy.' : 'Reduced rest triggers cognitive fatigue.';
        break;
      case 'nutrition':
        explanation = newVal > oldCompareVal ? 'Nutrition boosts daily metabolic thresholds.' : 'Poor nutrition drains physical and mental stamina.';
        break;
      case 'hydration':
        explanation = newVal > oldCompareVal ? 'Hydration levels normalized.' : 'Dehydration risk triggers mental sluggishness.';
        break;
      case 'physicalActivity':
        explanation = newVal >= 5 && newVal <= 7 ? 'Optimal active physical movement.' : newVal === 10 ? 'Exhaustive workout loads reduce active energy reservoirs.' : 'Sedentary state blocks optimal metabolic circulation.';
        break;
      case 'endorphins':
        explanation = newVal <= 2 ? 'Laser focused states restored.' : newVal >= 7 ? 'Dopamine spikes trigger active distraction vulnerabilities.' : 'Mild sensory endorphin buzz present.';
        break;
      case 'schedule':
        explanation = newVal > oldCompareVal ? 'Calendar alignment restores time slots.' : 'Schedule slips reduce active work windows.';
        break;
      case 'pleasantness':
        explanation = newVal > oldCompareVal ? 'Positive attitude boosts day value.' : 'Negative mood dampens productivity outcomes.';
        break;
      case 'socialization':
        explanation = newVal >= 5 && newVal <= 7 ? 'Balanced socialization boosts mental motivation.' : newVal === 10 ? 'Excessive socialization cuts available schedule windows.' : 'Low socialization for today is negligible.';
        break;
      case 'stomach':
        explanation = newVal >= 7 ? 'Clear stomach secures stable mood.' : 'Gut irritation damages focus and physical energy.';
        break;
      case 'technicalities':
        explanation = newVal <= 2 ? 'Seamless technology interfaces.' : 'Device faults or connection lag block development loops.';
        break;
      case 'relations':
        explanation = newVal >= 7 ? 'Warm relationship dynamics boost focus.' : 'Interpersonal friction drains emotional reservoirs.';
        break;
      case 'stress':
        explanation = newVal <= 2 ? 'Low stress improves cognitive clarity.' : 'Stress spikes trigger anxiety and restrict focus.';
        break;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newLogEntry = {
      id: `log-${Date.now()}`,
      timestamp,
      parameter: paramName.charAt(0).toUpperCase() + paramName.slice(1),
      oldVal: oldVal !== null ? `${oldVal}/10` : 'N/A',
      newVal: `${newVal}/10`,
      scoreEffect: diffScore,
      description: explanation
    };

    setHistory(prev => {
      const updated = [newLogEntry, ...prev.slice(0, 14)];
      localStorage.setItem('unicorn_scorecard_history', JSON.stringify(updated));
      return updated;
    });

    // Save to persistent all-time database logs
    const dbLogsStr = localStorage.getItem('unicorn_scorecard_db_logs');
    let dbLogs = [];
    if (dbLogsStr) {
      try {
        dbLogs = JSON.parse(dbLogsStr);
      } catch (e) {}
    }
    dbLogs.push({
      ...newLogEntry,
      date: new Date().toISOString().split('T')[0]
    });
    localStorage.setItem('unicorn_scorecard_db_logs', JSON.stringify(dbLogs));
  };

  // Central trigger to update parameters, debouncing log outcomes
  const handleParamChange = (paramName: string, newVal: number, setter: (val: number | null) => void, oldVal: number | null) => {
    setter(newVal);
    latestParamsRef.current[paramName] = newVal;
    localStorage.setItem(`unicorn_scorecard_${paramName}`, String(newVal));

    if (originalValuesRef.current[paramName] === undefined) {
      originalValuesRef.current[paramName] = oldVal;
    }

    if (logTimeoutsRef.current[paramName]) {
      clearTimeout(logTimeoutsRef.current[paramName]);
    }

    logTimeoutsRef.current[paramName] = setTimeout(() => {
      const initialVal = originalValuesRef.current[paramName];
      const finalVal = latestParamsRef.current[paramName];

      if (initialVal !== finalVal) {
        writeFinalLog(paramName, initialVal !== undefined ? initialVal : null, finalVal !== undefined && finalVal !== null ? finalVal : 5);
      }

      delete originalValuesRef.current[paramName];
      delete logTimeoutsRef.current[paramName];
    }, 1200);
  };

  // Dynamic labels for discrete options rendered as 10-step sliders
  const getStomachLabel = (val: number) => {
    if (val >= 9) return { text: 'Optimal / Light Gut', color: 'text-emerald-400' };
    if (val >= 7) return { text: 'Clear / Stable', color: 'text-emerald-400' };
    if (val >= 5) return { text: 'Tolerable / Heavy', color: 'text-amber-400' };
    if (val >= 3) return { text: 'Acidic / Discomfort', color: 'text-rose-400' };
    return { text: 'Bloated / Irritated', color: 'text-rose-400 animate-pulse' };
  };

  const getPhysicalActivityLabel = (val: number) => {
    if (val === 10) return { text: 'Exhaustive / Fatigued', color: 'text-rose-400 animate-pulse' };
    if (val >= 8) return { text: 'Heavy Training', color: 'text-blue-400' };
    if (val >= 5) return { text: 'Optimal / Active', color: 'text-emerald-400' };
    if (val >= 3) return { text: 'Light Activity', color: 'text-blue-400' };
    return { text: 'Sedentary', color: 'text-amber-400' };
  };

  const getStressLabel = (val: number) => {
    if (val >= 9) return { text: 'Overwhelmed', color: 'text-rose-400 animate-pulse' };
    if (val >= 7) return { text: 'High Tension', color: 'text-rose-400' };
    if (val >= 5) return { text: 'Moderate Stress', color: 'text-amber-400' };
    if (val >= 3) return { text: 'Focused / Alert', color: 'text-emerald-400' };
    return { text: 'Zen / Calm', color: 'text-emerald-400' };
  };

  const getEndorphinsLabel = (val: number) => {
    if (val >= 9) return { text: 'Mind Hijacked', color: 'text-rose-400 animate-pulse' };
    if (val >= 7) return { text: 'High Dopamine', color: 'text-rose-400' };
    if (val >= 5) return { text: 'Mild Buzz', color: 'text-amber-400' };
    if (val >= 3) return { text: 'Grounded / Steady', color: 'text-emerald-400' };
    return { text: 'Laser Focus / Stoic', color: 'text-emerald-400' };
  };

  const getSocializationLabel = (val: number) => {
    if (val === 10) return { text: 'Over-Socialized', color: 'text-rose-400 animate-pulse' };
    if (val >= 8) return { text: 'Highly Social', color: 'text-blue-400' };
    if (val >= 5) return { text: 'Optimal Synergy', color: 'text-emerald-400' };
    if (val >= 3) return { text: 'Minimal Social', color: 'text-blue-400' };
    return { text: 'Isolated', color: 'text-amber-400' };
  };

  const getRelationsLabel = (val: number) => {
    if (val >= 9) return { text: 'Harmonious / Synergized', color: 'text-emerald-400' };
    if (val >= 7) return { text: 'Supportive / Warm', color: 'text-emerald-400' };
    if (val >= 5) return { text: 'Neutral / Quiet', color: 'text-blue-400' };
    if (val >= 3) return { text: 'Tense / Friction', color: 'text-rose-400' };
    return { text: 'High Conflict', color: 'text-rose-400 animate-pulse' };
  };

  const getTechnicalitiesLabel = (val: number) => {
    if (val >= 9) return { text: 'Critical Failure', color: 'text-rose-400 animate-pulse' };
    if (val >= 7) return { text: 'Device Glitch', color: 'text-rose-400' };
    if (val >= 5) return { text: 'Slow Wifi / Latency', color: 'text-amber-400' };
    if (val >= 3) return { text: 'Minor Glitches', color: 'text-amber-400' };
    return { text: 'Perfect / Seamless', color: 'text-emerald-400' };
  };

  // Radar Data Mapping
  const radarData = [
    { subject: 'Physical Energy', A: computedMetrics.physEnergy, fullMark: 100 },
    { subject: 'Focus Bandwidth', A: computedMetrics.focusBandwidth, fullMark: 100 },
    { subject: 'Time Efficiency', A: computedMetrics.timeEfficiency, fullMark: 100 },
    { subject: 'Emotional Vibe', A: computedMetrics.emotionalVibe, fullMark: 100 },
    { subject: 'Social Harmony', A: computedMetrics.socialHarmony, fullMark: 100 },
    { subject: 'Bio Comfort', A: computedMetrics.biologicalComfort, fullMark: 100 },
  ];

  // Dynamic status parameters
  const statusInfo = useMemo(() => {
    const score = computedMetrics.aggregate;
    if (score >= 90) return { label: 'OPTIMAL', color: 'text-emerald-400', border: 'border-emerald-950/40', bg: 'bg-emerald-500/10' };
    if (score >= 75) return { label: 'STABLE', color: 'text-blue-400', border: 'border-blue-950/40', bg: 'bg-blue-500/10' };
    if (score >= 50) return { label: 'CAUTIOUS', color: 'text-amber-400', border: 'border-amber-950/40', bg: 'bg-amber-500/10' };
    return { label: 'IMPAIRED', color: 'text-rose-400', border: 'border-rose-950/40', bg: 'bg-rose-500/10' };
  }, [computedMetrics.aggregate]);

  const statusInfoColor = statusInfo.color;

  // Dynamic recommendations list
  const activeWarnings = useMemo(() => {
    const warnings = [];
    if (hydration < 6) {
      warnings.push({
        id: 'w-hydr',
        title: 'Hydration Level Low',
        desc: 'Drink 500ml water immediately. Mild dehydration degrades visual focus and response latency.',
        color: 'text-blue-400',
        borderColor: 'border-blue-950/30',
        bg: 'bg-blue-950/10',
        icon: <Zap className="h-4 w-4" />
      });
    }
    if (stress >= 7) {
      warnings.push({
        id: 'w-stress',
        title: 'Cognitive Stress High',
        desc: 'Sympathetic nerve load detected. Take a 10-minute mindfulness break to re-establish focus.',
        color: 'text-amber-400',
        borderColor: 'border-amber-950/30',
        bg: 'bg-amber-950/10',
        icon: <Activity className="h-4 w-4" />
      });
    }
    if (endorphins >= 7) {
      warnings.push({
        id: 'w-endo',
        title: 'Distraction Overload Alert',
        desc: 'High endorphins trigger distraction loop vulnerability. Lock phone, use Focus mode, block social tabs.',
        color: 'text-rose-400',
        borderColor: 'border-rose-950/30',
        bg: 'bg-rose-950/10',
        icon: <ShieldAlert className="h-4 w-4" />
      });
    }
    if (stomach <= 4) {
      warnings.push({
        id: 'w-stom',
        title: 'Gut Clarity Irritation',
        desc: 'Stomach irritation triggers direct emotional dampening. Avoid heavy meals; hydrate with warm water.',
        color: 'text-rose-400',
        borderColor: 'border-rose-950/30',
        bg: 'bg-rose-950/10',
        icon: <AlertTriangle className="h-4 w-4" />
      });
    }
    if (technicalities >= 7) {
      warnings.push({
        id: 'w-tech',
        title: 'Active Technical Blockers',
        desc: 'Tech issues (wifi, device) present. Troubleshoot infrastructure immediately before workflow starts.',
        color: 'text-rose-400',
        borderColor: 'border-rose-950/30',
        bg: 'bg-rose-950/10',
        icon: <WifiOff className="h-4 w-4" />
      });
    }
    if (physicalActivity === 10) {
      warnings.push({
        id: 'w-phys-hi',
        title: 'Physical Load Heavy',
        desc: 'High physical exertion can exhaust focus pools. Shift schedule to restfulness and hydrate.',
        color: 'text-amber-400',
        borderColor: 'border-amber-950/30',
        bg: 'bg-amber-950/10',
        icon: <Activity className="h-4 w-4" />
      });
    }
    if (physicalActivity <= 2) {
      warnings.push({
        id: 'w-phys-lo',
        title: 'Low Activity Sluggishness',
        desc: 'Insufficient circulation may cause mental sleepiness. Walk for 10 minutes to normalize pulse.',
        color: 'text-blue-400',
        borderColor: 'border-blue-950/30',
        bg: 'bg-blue-950/10',
        icon: <TrendingUp className="h-4 w-4" />
      });
    }
    if (relations <= 4) {
      warnings.push({
        id: 'w-rel',
        title: 'Relationship Friction Load',
        desc: 'External emotional load detected. Disengage from communication channels; allocate deep flow hours.',
        color: 'text-rose-400',
        borderColor: 'border-rose-950/30',
        bg: 'bg-rose-950/10',
        icon: <UserCheck className="h-4 w-4" />
      });
    }
    return warnings;
  }, [hydration, stress, endorphins, stomach, technicalities, physicalActivity, relations]);

  return (
    <div className="space-y-6">
      {/* Top Banner Header — sticky so live readiness/score stay visible while you fill in parameters.
          Same visual language as AI Insights: icon badge, glow blob, motion entrance. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-28 z-20 relative overflow-hidden rounded-xl border border-neutral-850 bg-neutral-900 shadow-[0_4px_30px_rgba(0,0,0,0.3)]"
      >
        <motion.div
          className="absolute -top-16 -right-10 w-72 h-72 rounded-full bg-rose-500/8 blur-3xl pointer-events-none"
          animate={{ x: [0, -20, 10, 0], y: [0, 15, -10, 0] }}
          transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-6">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center h-8 w-8 rounded-lg bg-rose-950/30 border border-rose-900/40 text-rose-400">
              <Trophy className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-100 font-mono tracking-tight">Creator Bio-Performance Scorecard</h2>
              <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">
                Consolidated evaluation of personal biometrics, mental focus, and environment readiness.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 bg-neutral-950 border border-neutral-850 px-5 py-3 rounded-xl font-mono">
            <div className="text-center">
              <span className="text-[10px] uppercase text-neutral-500 tracking-wider block font-bold">Daily Readiness</span>
              <span className={`text-sm font-bold mt-0.5 block flex items-center justify-center gap-1 ${statusInfoColor}`}>
                <ShieldCheck className="h-4 w-4" />
                {statusInfo.label}
              </span>
            </div>
            <div className="w-px h-8 bg-neutral-850" />
            <div className="text-center">
              <span className="text-[10px] uppercase text-neutral-500 tracking-wider block font-bold">Bio-Focus Score</span>
              <span className={`text-xl font-bold mt-0.5 block ${statusInfoColor}`}>
                {computedMetrics.aggregate}/100
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Daily Insight Engine — pure rule-based read on your parameters, no AI.
          Any change clears the current insight and starts a 10-second settle
          timer; the timer resets on every further change, so a burst of
          edits produces exactly one consolidated insight once you actually
          stop, not one per click. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-xl border border-blue-900/30 bg-neutral-900 shadow-[0_4px_30px_rgba(0,0,0,0.3)]"
      >
        <motion.div
          className="absolute -top-16 -left-10 w-64 h-64 rounded-full bg-blue-500/8 blur-3xl pointer-events-none"
          animate={{ x: [0, 20, -10, 0], y: [0, -15, 10, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative z-10 p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid place-items-center h-8 w-8 rounded-lg bg-blue-950/30 border border-blue-900/40 text-blue-400">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-neutral-100 font-mono tracking-tight">Daily Insight Engine</h3>
                  <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 text-[9px] font-bold uppercase tracking-wider">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    Watching
                  </span>
                </div>
                <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                  Reads your parameters 10 seconds after your last change and tells you what kind of day this is.
                </p>
              </div>
            </div>
            {insightTimestamp && !isAnalyzing && (
              <span className="text-[9px] text-neutral-600 font-mono shrink-0">Updated {insightTimestamp}</span>
            )}
          </div>

          <AnimatePresence mode="wait">
            {isAnalyzing ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2.5 p-3 rounded-lg bg-blue-950/10 border border-blue-900/20 text-blue-400 text-xs font-mono"
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                </span>
                <span>Waiting for your inputs to settle...</span>
              </motion.div>
            ) : wellbeingInsight ? (
              (() => {
                const CATEGORY_ROWS: { label: string; text: string }[] = [
                  { label: 'Bottleneck', text: wellbeingInsight.bottleneck },
                  { label: 'Day Type', text: wellbeingInsight.dayType },
                  { label: 'Physical', text: wellbeingInsight.physical },
                  { label: 'Stress & Mood', text: wellbeingInsight.stressMood },
                  { label: 'Stimulation', text: wellbeingInsight.stimulation },
                  { label: 'Execution', text: wellbeingInsight.execution },
                  { label: 'Social', text: wellbeingInsight.social }
                ];
                const confidenceColor = wellbeingInsight.dataConfidence === 'reliable' ? 'text-emerald-400' : wellbeingInsight.dataConfidence === 'partial' ? 'text-amber-400' : 'text-rose-400';

                return (
                  <motion.div
                    key="insight"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <span className={`inline-block text-[9px] font-bold uppercase tracking-wider font-mono ${confidenceColor}`}>
                      {wellbeingInsight.dataNote}
                    </span>

                    {/* Headline block — the single overall read for the day */}
                    {wellbeingInsight.headline && (
                      <div className="rounded-lg border border-blue-900/30 bg-blue-950/10 p-4">
                        <h4 className="text-sm font-bold text-neutral-100 leading-snug mb-1.5">{wellbeingInsight.headline.title}</h4>
                        <div className="space-y-1">
                          {wellbeingInsight.headline.lines.map((line, i) => (
                            <p key={i} className="text-xs text-neutral-400 font-sans leading-relaxed">{line}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Risk flags */}
                    {wellbeingInsight.risks.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {wellbeingInsight.risks.map((r, i) => (
                          <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/20 border border-rose-900/30 text-rose-400 text-[10px] font-bold font-mono uppercase tracking-wide">
                            <AlertTriangle className="h-3 w-3" />
                            {r}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action */}
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-blue-950/20 border border-blue-900/30">
                      <Zap className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span className="text-xs text-blue-200 font-sans font-medium">{wellbeingInsight.action}</span>
                    </div>

                    {/* Full category breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CATEGORY_ROWS.map((row, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-neutral-950/50 border border-neutral-850">
                          <span className="text-[9px] font-bold uppercase tracking-wider font-mono text-neutral-500">{row.label}</span>
                          <p className="text-[11px] text-neutral-400 font-sans mt-0.5 leading-snug">{row.text}</p>
                        </div>
                      ))}
                    </div>

                    {/* Trend — only shown once enough day-over-day history exists */}
                    {wellbeingInsight.trend && (
                      <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-purple-950/15 border border-purple-900/30">
                        <TrendingUp className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                        <span className="text-xs text-purple-200 font-sans">{wellbeingInsight.trend}</span>
                      </div>
                    )}
                  </motion.div>
                );
              })()
            ) : (
              <motion.p
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-neutral-500 font-mono p-3"
              >
                Change a parameter on the left and I'll read what kind of day this is once you settle for 10 seconds.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Main Content Layout Grid — items-start lets the right side stick without stretching to match the (independently scrolling) parameters column */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Parameter Inputs */}
        <div className="bg-neutral-900 border border-neutral-850 rounded-xl p-5 space-y-5 xl:col-span-1 shadow-sm">
          <div className="flex items-center gap-2 border-b border-neutral-850 pb-3">
            <SlidersHorizontal className="h-4 w-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-neutral-200">Daily Parameters</h3>
          </div>

          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1 scrollbar-thin">
            
            {/* Dynamic Parameter Cards */}
            {(() => {
              const parameterDefs = [
                {
                  group: 'Physical Health',
                  items: [
                    { key: 'restfulness', label: 'Restfulness', colorClass: 'text-emerald-400', accent: 'accent-emerald-400', val: restfulness, setter: setRestfulness },
                    { key: 'nutrition', label: 'Nutrition', colorClass: 'text-emerald-400', accent: 'accent-emerald-400', val: nutrition, setter: setNutrition },
                    { key: 'hydration', label: 'Hydration', colorClass: 'text-blue-400', accent: 'accent-blue-400', val: hydration, setter: setHydration },
                    { 
                      key: 'stomach', 
                      label: 'Stomach Status', 
                      val: stomach, 
                      setter: setStomach,
                      customLabel: (v: number) => {
                        const lbl = getStomachLabel(v);
                        return { text: `${v}/10 (${lbl.text})`, color: lbl.color };
                      },
                      getAccent: (v: number) => v >= 7 ? 'accent-emerald-400' : v >= 5 ? 'accent-amber-400' : 'accent-rose-400'
                    },
                    { 
                      key: 'physicalActivity', 
                      label: 'Physical Activity', 
                      val: physicalActivity, 
                      setter: setPhysicalActivity,
                      customLabel: (v: number) => {
                        const lbl = getPhysicalActivityLabel(v);
                        return { text: `${v}/10 (${lbl.text})`, color: lbl.color };
                      },
                      getAccent: (v: number) => v >= 5 && v <= 7 ? 'accent-emerald-400' : v === 10 ? 'accent-rose-400' : 'accent-blue-400'
                    }
                  ]
                },
                {
                  group: 'Mental Focus',
                  items: [
                    { 
                      key: 'stress', 
                      label: 'Stress Level', 
                      val: stress, 
                      setter: setStress,
                      customLabel: (v: number) => {
                        const lbl = getStressLabel(v);
                        return { text: `${v}/10 (${lbl.text})`, color: lbl.color };
                      },
                      getAccent: (v: number) => v <= 4 ? 'accent-emerald-400' : v <= 6 ? 'accent-amber-400' : 'accent-rose-400'
                    },
                    { 
                      key: 'endorphins', 
                      label: 'Endorphins (Distraction)', 
                      val: endorphins, 
                      setter: setEndorphins,
                      customLabel: (v: number) => {
                        const lbl = getEndorphinsLabel(v);
                        return { text: `${v}/10 (${lbl.text})`, color: lbl.color };
                      },
                      getAccent: (v: number) => v <= 4 ? 'accent-emerald-400' : v <= 6 ? 'accent-amber-400' : 'accent-rose-400'
                    },
                    { key: 'pleasantness', label: 'Pleasantness', colorClass: 'text-emerald-400', accent: 'accent-emerald-400', val: pleasantness, setter: setPleasantness }
                  ]
                },
                {
                  group: 'Environment & Sync',
                  items: [
                    { key: 'schedule', label: 'Schedule Adherence', colorClass: 'text-emerald-400', accent: 'accent-emerald-400', val: schedule, setter: setSchedule },
                    { 
                      key: 'socialization', 
                      label: 'Socialization', 
                      val: socialization, 
                      setter: setSocialization,
                      customLabel: (v: number) => {
                        const lbl = getSocializationLabel(v);
                        return { text: `${v}/10 (${lbl.text})`, color: lbl.color };
                      },
                      getAccent: (v: number) => v >= 5 && v <= 7 ? 'accent-emerald-400' : v === 10 ? 'accent-rose-400' : 'accent-blue-400'
                    },
                    { 
                      key: 'relations', 
                      label: 'Relationship Dynamic', 
                      val: relations, 
                      setter: setRelations,
                      customLabel: (v: number) => {
                        const lbl = getRelationsLabel(v);
                        return { text: `${v}/10 (${lbl.text})`, color: lbl.color };
                      },
                      getAccent: (v: number) => v >= 7 ? 'accent-emerald-400' : v >= 5 ? 'accent-blue-400' : 'accent-rose-400'
                    },
                    { 
                      key: 'technicalities', 
                      label: 'Technical Blockers', 
                      val: technicalities, 
                      setter: setTechnicalities,
                      customLabel: (v: number) => {
                        const lbl = getTechnicalitiesLabel(v);
                        return { text: `${v}/10 (${lbl.text})`, color: lbl.color };
                      },
                      getAccent: (v: number) => v <= 2 ? 'accent-emerald-400' : v <= 6 ? 'accent-amber-400' : 'accent-rose-400'
                    }
                  ]
                }
              ];

              return parameterDefs.map((group, gIdx) => (
                <div key={group.group} className={`space-y-2 ${gIdx > 0 ? 'pt-2' : ''}`}>
                  <h4 className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider font-mono">{group.group}</h4>
                  {group.items.map(item => {
                    const displayValue = item.val !== null
                      ? (item.customLabel ? item.customLabel(item.val).text : `${item.val}/10`)
                      : 'N/A';
                    const displayColor = item.val !== null
                      ? (item.customLabel ? item.customLabel(item.val).color : (item.colorClass || 'text-emerald-400'))
                      : 'text-neutral-500';

                    const dotColorClass = (n: number) => {
                      if (item.val === n) {
                        const c = item.customLabel
                          ? item.customLabel(n).color
                          : (item.getAccent ? item.getAccent(n).replace('accent-', 'text-') : (item.colorClass || 'text-emerald-400'));
                        return c;
                      }
                      return 'text-neutral-600';
                    };

                    return (
                      <div key={item.key} className="px-3 py-2 bg-neutral-950 border border-neutral-850 rounded-lg space-y-1.5 font-sans">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-neutral-300">{item.label}</span>
                          <span className={`${displayColor} font-bold`}>{displayValue}</span>
                        </div>
                        {/* One-tap value selector — tap a number to set it instantly, no dragging/repeated clicks */}
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                            const active = item.val === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => handleParamChange(item.key, n, item.setter, item.val)}
                                className={`flex-1 h-6 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                                  active
                                    ? `${dotColorClass(n).replace('text-', 'bg-').replace('-400', '-500')} text-black`
                                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-500 border border-neutral-850'
                                }`}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Right side: Radar, Log History & Recommendations — sticky so the live view stays put while you fill in parameters on the left.
            Offset clears the app header+nav (top-28) plus the sticky banner's own height above it. */}
        <div className="space-y-6 xl:col-span-2 xl:sticky xl:top-[15rem] z-10">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Radar Visual */}
            <div className="bg-neutral-900 border border-neutral-850 rounded-xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">System Metric Radar</h3>
                <p className="text-xs text-neutral-500 font-sans">Multilateral biometric & focus alignment mapping.</p>
              </div>

              <div className="h-64 w-full flex justify-center items-center font-mono select-none">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#1f1f24" />
                    <PolarAngleAxis dataKey="subject" stroke="#a3a3a3" fontSize={8} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#2b2b35" fontSize={8} />
                    <Radar
                      name="Bio Performance"
                      dataKey="A"
                      stroke={computedMetrics.aggregate >= 90 ? '#34d399' : computedMetrics.aggregate >= 75 ? '#60a5fa' : computedMetrics.aggregate >= 50 ? '#fbbf24' : '#f87171'}
                      fill={computedMetrics.aggregate >= 90 ? '#34d399' : computedMetrics.aggregate >= 75 ? '#60a5fa' : computedMetrics.aggregate >= 50 ? '#fbbf24' : '#f87171'}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Score Logs History Timeline */}
            <div className="bg-neutral-900 border border-neutral-850 rounded-xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">Log History</h3>
                <p className="text-xs text-neutral-500 font-sans">Timeline of parameters changed during the day.</p>
              </div>

              <div className="h-64 overflow-y-auto pr-1 space-y-2.5 font-mono text-[9px] scrollbar-thin">
                <AnimatePresence initial={false}>
                  {history.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-2.5 bg-neutral-950 border border-neutral-850 rounded-lg flex flex-col gap-1 hover:bg-neutral-800 transition animate-fade-in"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-neutral-300 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 bg-rose-400 rounded-full" />
                          {log.parameter}
                        </span>
                        <div className="flex items-center gap-1.5 text-neutral-500">
                          <span>{log.timestamp}</span>
                          {log.scoreEffect !== 0 && (
                            <span className={`px-1 rounded font-bold ${log.scoreEffect > 0 ? 'bg-emerald-950/20 text-emerald-400' : 'bg-rose-950/20 text-rose-400'}`}>
                              {log.scoreEffect > 0 ? `+${log.scoreEffect}` : log.scoreEffect}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-neutral-400 font-sans leading-normal">{log.description}</p>
                      {log.oldVal !== 'None' && (
                        <div className="text-[8px] text-neutral-500 mt-0.5">
                          Transition: {log.oldVal} ➔ {log.newVal}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

          </div>

          {/* Bottom Row: Dynamic Live recommendations & blinking alarms */}
          <div className="bg-neutral-900 border border-neutral-850 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-neutral-850 pb-3">
              <Activity className="h-4 w-4 text-rose-400" />
              <h3 className="text-sm font-semibold text-neutral-200">Bio-Performance Recommendations</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
              <AnimatePresence>
                {activeWarnings.length > 0 ? (
                  activeWarnings.map((warn) => (
                    <motion.div
                      key={warn.id}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className={`p-3 border rounded-lg flex items-start gap-2.5 font-mono text-[10px] leading-relaxed transition ${warn.bg} ${warn.borderColor}`}
                    >
                      <div className={`mt-0.5 shrink-0 animate-pulse ${warn.color}`}>
                        {warn.icon}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <span className={`font-bold tracking-wide uppercase ${warn.color}`}>{warn.title}</span>
                        <p className="text-[9px] text-neutral-400 font-sans leading-relaxed">{warn.desc}</p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 bg-emerald-950/10 border border-emerald-900/30 text-emerald-400 rounded-lg flex items-center gap-3 font-mono text-[10px] col-span-2 justify-center"
                  >
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    <div className="text-center md:text-left">
                      <span className="font-bold">ALL BIO-SYSTEMS STABLE</span>
                      <p className="text-[9px] text-neutral-400 font-sans mt-0.5 leading-relaxed">
                        Metrics are aligned in optimal boundaries. Daily focus capacity is maximized. Keep it up!
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

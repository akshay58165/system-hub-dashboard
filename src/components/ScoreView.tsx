import React, { useState, useMemo, useRef } from 'react';
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
  ThumbsUp,
  Smile,
  ShieldAlert,
  Zap,
  Coffee,
  Sparkles,
  WifiOff,
  UserCheck,
  TrendingDown
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

interface ScoreViewProps {
  repos: GitHubRepo[];
  vercelProjects: VercelProject[];
  supabase: SupabaseProject;
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

export default function ScoreView({ repos, vercelProjects, supabase }: ScoreViewProps) {
  // 12 Daily parameters state variables (All standardized to 1-10 range)
  const [restfulness, setRestfulness] = useState<number>(8); // 1-10
  const [nutrition, setNutrition] = useState<number>(7); // 1-10
  const [hydration, setHydration] = useState<number>(8); // 1-10
  const [physicalActivity, setPhysicalActivity] = useState<number>(6); // 1-10
  const [endorphins, setEndorphins] = useState<number>(2); // 1-10
  const [schedule, setSchedule] = useState<number>(8); // 1-10
  const [pleasantness, setPleasantness] = useState<number>(8); // 1-10
  const [socialization, setSocialization] = useState<number>(6); // 1-10
  const [stomach, setStomach] = useState<number>(8); // 1-10
  const [technicalities, setTechnicalities] = useState<number>(1); // 1-10
  const [relations, setRelations] = useState<number>(8); // 1-10
  const [stress, setStress] = useState<number>(2); // 1-10

  // Change Log History
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      id: 'init',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      parameter: 'System',
      oldVal: 'None',
      newVal: 'Initialized',
      scoreEffect: 0,
      description: 'Daily Readiness Scorecard initialized with baseline levels.'
    }
  ]);

  // Debouncing refs to prevent micro-increment logging spam
  const logTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const originalValuesRef = useRef<Record<string, number>>({});
  const latestParamsRef = useRef<Record<string, number>>({});

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
    const getPoints = (name: string, val: number) => {
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

    const restScore = getPoints('restfulness', restfulness);
    const nutrScore = getPoints('nutrition', nutrition);
    const hydrScore = getPoints('hydration', hydration);
    const physPoints = getPoints('physicalActivity', physicalActivity);
    const endoPoints = getPoints('endorphins', endorphins);
    const schedScore = getPoints('schedule', schedule);
    const pleasScore = getPoints('pleasantness', pleasantness);
    const socPoints = getPoints('socialization', socialization);
    const stomPoints = getPoints('stomach', stomach);
    const techPoints = getPoints('technicalities', technicalities);
    const relPoints = getPoints('relations', relations);
    const stressPoints = getPoints('stress', stress);

    const totalPoints = restScore + nutrScore + hydrScore + physPoints + endoPoints + 
                        schedScore + pleasScore + socPoints + stomPoints + techPoints + 
                        relPoints + stressPoints;
    
    const aggregate = Math.round((totalPoints / 120) * 100);

    // Compute composite metrics for Recharts Radar Chart (bound 10-100)
    const physEnergy = Math.min(100, Math.max(10, Math.round(
      (restfulness * 1.5 + nutrition * 1.5 + hydration * 1.5 + physPoints * 2.0 + 35)
    )));
    const focusBandwidth = Math.min(100, Math.max(10, Math.round(
      (endoPoints * 3.0 + stressPoints * 4.0 + techPoints * 3.0) * 1.0
    )));
    const timeEfficiency = Math.min(100, Math.max(10, Math.round(
      (schedule * 6.0 + socPoints * 4.0) * 1.0
    )));
    const emotionalVibe = Math.min(100, Math.max(10, Math.round(
      (pleasantness * 5.0 + stomPoints * 2.5 + relPoints * 2.5) * 1.0
    )));
    const socialHarmony = Math.min(100, Math.max(10, Math.round(
      (socPoints * 5.0 + relPoints * 5.0) * 1.0
    )));
    const biologicalComfort = Math.min(100, Math.max(10, Math.round(
      (stomPoints * 5.0 + stressPoints * 3.0 + restfulness * 2.0) * 1.0
    )));

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

  // Write final transition logs when timer fires after input inactivity
  const writeFinalLog = (paramName: string, oldVal: number, newVal: number) => {
    const getPoints = (name: string, val: number) => {
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

    const oldPts = getPoints(paramName, oldVal);
    const newPts = getPoints(paramName, newVal);
    const diffScore = Math.round(((newPts - oldPts) / 120) * 100);

    let explanation = '';
    switch (paramName) {
      case 'restfulness':
        explanation = newVal > oldVal ? 'Better rest restores vital energy.' : 'Reduced rest triggers cognitive fatigue.';
        break;
      case 'nutrition':
        explanation = newVal > oldVal ? 'Nutrition boosts daily metabolic thresholds.' : 'Poor nutrition drains physical and mental stamina.';
        break;
      case 'hydration':
        explanation = newVal > oldVal ? 'Hydration levels normalized.' : 'Dehydration risk triggers mental sluggishness.';
        break;
      case 'physicalActivity':
        explanation = newVal >= 5 && newVal <= 7 ? 'Optimal active physical movement.' : newVal === 10 ? 'Exhaustive workout loads reduce active energy reservoirs.' : 'Sedentary state blocks optimal metabolic circulation.';
        break;
      case 'endorphins':
        explanation = newVal <= 2 ? 'Laser focused states restored.' : newVal >= 7 ? 'Dopamine spikes trigger active distraction vulnerabilities.' : 'Mild sensory endorphin buzz present.';
        break;
      case 'schedule':
        explanation = newVal > oldVal ? 'Calendar alignment restores time slots.' : 'Schedule slips reduce active work windows.';
        break;
      case 'pleasantness':
        explanation = newVal > oldVal ? 'Positive attitude boosts day value.' : 'Negative mood dampens productivity outcomes.';
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
    setHistory(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp,
        parameter: paramName.charAt(0).toUpperCase() + paramName.slice(1),
        oldVal: `${oldVal}/10`,
        newVal: `${newVal}/10`,
        scoreEffect: diffScore,
        description: explanation
      },
      ...prev.slice(0, 14)
    ]);
  };

  // Central trigger to update parameters, debouncing log outcomes
  const handleParamChange = (paramName: string, newVal: number, setter: (val: number) => void, oldVal: number) => {
    setter(newVal);
    latestParamsRef.current[paramName] = newVal;

    if (originalValuesRef.current[paramName] === undefined) {
      originalValuesRef.current[paramName] = oldVal;
    }

    if (logTimeoutsRef.current[paramName]) {
      clearTimeout(logTimeoutsRef.current[paramName]);
    }

    logTimeoutsRef.current[paramName] = setTimeout(() => {
      const initialVal = originalValuesRef.current[paramName];
      const finalVal = latestParamsRef.current[paramName];

      if (initialVal !== undefined && finalVal !== undefined && initialVal !== finalVal) {
        writeFinalLog(paramName, initialVal, finalVal);
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
      {/* Top Banner Header */}
      <div className="bg-neutral-900 border border-neutral-900 rounded-xl p-6 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100 tracking-tight flex items-center gap-2">
              <Trophy className="h-5 w-5 text-rose-400 animate-pulse" />
              Creator Bio-Performance Scorecard
            </h2>
            <p className="text-xs text-neutral-400 mt-1 font-sans">
              Consolidated evaluation of personal biometrics, mental focus, and environment readiness.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-neutral-950/60 border border-neutral-900 px-5 py-3 rounded-xl font-mono">
            <div className="text-center">
              <span className="text-[10px] uppercase text-neutral-500 tracking-wider block font-bold">Daily Readiness</span>
              <span className={`text-sm font-bold mt-0.5 block flex items-center justify-center gap-1 ${statusInfoColor}`}>
                <ShieldCheck className="h-4 w-4" />
                {statusInfo.label}
              </span>
            </div>
            <div className="w-px h-8 bg-neutral-900" />
            <div className="text-center">
              <span className="text-[10px] uppercase text-neutral-500 tracking-wider block font-bold">Bio-Focus Score</span>
              <span className={`text-xl font-bold mt-0.5 block ${statusInfoColor}`}>
                {computedMetrics.aggregate}/100
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Parameter Inputs */}
        <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 space-y-5 xl:col-span-1 shadow-sm">
          <div className="flex items-center gap-2 border-b border-neutral-900 pb-3">
            <SlidersHorizontal className="h-4 w-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-neutral-200">Daily Parameters</h3>
          </div>

          <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin">
            
            {/* Group 1: Physical Parameters */}
            <div className="space-y-3">
              <h4 className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider font-mono">Physical Health</h4>
              
              {/* Restfulness Card */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Restfulness</span>
                  <span className="text-emerald-400 font-bold">{restfulness}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('restfulness', Math.max(1, restfulness - 1), setRestfulness, restfulness)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={restfulness}
                    onChange={(e) => handleParamChange('restfulness', Number(e.target.value), setRestfulness, restfulness)}
                    className="flex-1 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer accent-emerald-400 outline-none border-none animate-none"
                  />
                  <button 
                    onClick={() => handleParamChange('restfulness', Math.min(10, restfulness + 1), setRestfulness, restfulness)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Nutrition Card */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Nutrition</span>
                  <span className="text-emerald-400 font-bold">{nutrition}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('nutrition', Math.max(1, nutrition - 1), setNutrition, nutrition)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={nutrition}
                    onChange={(e) => handleParamChange('nutrition', Number(e.target.value), setNutrition, nutrition)}
                    className="flex-1 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer accent-emerald-400 outline-none border-none animate-none"
                  />
                  <button 
                    onClick={() => handleParamChange('nutrition', Math.min(10, nutrition + 1), setNutrition, nutrition)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Hydration Card */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Hydration</span>
                  <span className="text-blue-400 font-bold">{hydration}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('hydration', Math.max(1, hydration - 1), setHydration, hydration)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={hydration}
                    onChange={(e) => handleParamChange('hydration', Number(e.target.value), setHydration, hydration)}
                    className="flex-1 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer accent-blue-400 outline-none border-none animate-none"
                  />
                  <button 
                    onClick={() => handleParamChange('hydration', Math.min(10, hydration + 1), setHydration, hydration)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Stomach Status Card (10-steps with descriptions) */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Stomach Status</span>
                  <span className={`font-bold ${getStomachLabel(stomach).color}`}>{stomach}/10 ({getStomachLabel(stomach).text})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('stomach', Math.max(1, stomach - 1), setStomach, stomach)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={stomach}
                    onChange={(e) => handleParamChange('stomach', Number(e.target.value), setStomach, stomach)}
                    className={`flex-1 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer outline-none border-none ${stomach >= 7 ? 'accent-emerald-400' : stomach >= 5 ? 'accent-amber-400' : 'accent-rose-400'}`}
                  />
                  <button 
                    onClick={() => handleParamChange('stomach', Math.min(10, stomach + 1), setStomach, stomach)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Physical Activity Card (10-steps with descriptions) */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Physical Activity</span>
                  <span className={`font-bold ${getPhysicalActivityLabel(physicalActivity).color}`}>{physicalActivity}/10 ({getPhysicalActivityLabel(physicalActivity).text})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('physicalActivity', Math.max(1, physicalActivity - 1), setPhysicalActivity, physicalActivity)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={physicalActivity}
                    onChange={(e) => handleParamChange('physicalActivity', Number(e.target.value), setPhysicalActivity, physicalActivity)}
                    className={`flex-1 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer outline-none border-none ${physicalActivity >= 5 && physicalActivity <= 7 ? 'accent-emerald-400' : physicalActivity === 10 ? 'accent-rose-400' : 'accent-blue-400'}`}
                  />
                  <button 
                    onClick={() => handleParamChange('physicalActivity', Math.min(10, physicalActivity + 1), setPhysicalActivity, physicalActivity)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Group 2: Cognitive & Mood Parameters */}
            <div className="space-y-3 pt-2">
              <h4 className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider font-mono">Mental Focus</h4>

              {/* Stress Card (10-steps with descriptions) */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Stress Level</span>
                  <span className={`font-bold ${getStressLabel(stress).color}`}>{stress}/10 ({getStressLabel(stress).text})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('stress', Math.max(1, stress - 1), setStress, stress)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={stress}
                    onChange={(e) => handleParamChange('stress', Number(e.target.value), setStress, stress)}
                    className={`flex-1 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer outline-none border-none ${stress <= 4 ? 'accent-emerald-400' : stress <= 6 ? 'accent-amber-400' : 'accent-rose-400'}`}
                  />
                  <button 
                    onClick={() => handleParamChange('stress', Math.min(10, stress + 1), setStress, stress)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Endorphins Card (10-steps with descriptions) */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Endorphins (Distraction)</span>
                  <span className={`font-bold ${getEndorphinsLabel(endorphins).color}`}>{endorphins}/10 ({getEndorphinsLabel(endorphins).text})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('endorphins', Math.max(1, endorphins - 1), setEndorphins, endorphins)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={endorphins}
                    onChange={(e) => handleParamChange('endorphins', Number(e.target.value), setEndorphins, endorphins)}
                    className={`flex-1 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer outline-none border-none ${endorphins <= 4 ? 'accent-emerald-400' : endorphins <= 6 ? 'accent-amber-400' : 'accent-rose-400'}`}
                  />
                  <button 
                    onClick={() => handleParamChange('endorphins', Math.min(10, endorphins + 1), setEndorphins, endorphins)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Pleasantness Card */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Pleasantness</span>
                  <span className="text-emerald-400 font-bold">{pleasantness}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('pleasantness', Math.max(1, pleasantness - 1), setPleasantness, pleasantness)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={pleasantness}
                    onChange={(e) => handleParamChange('pleasantness', Number(e.target.value), setPleasantness, pleasantness)}
                    className="flex-1 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer accent-emerald-400 outline-none border-none animate-none"
                  />
                  <button 
                    onClick={() => handleParamChange('pleasantness', Math.min(10, pleasantness + 1), setPleasantness, pleasantness)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Group 3: Execution and Context Parameters */}
            <div className="space-y-3 pt-2">
              <h4 className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider font-mono">Environment & Sync</h4>

              {/* Schedule Card */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Schedule adherence</span>
                  <span className="text-emerald-400 font-bold">{schedule}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('schedule', Math.max(1, schedule - 1), setSchedule, schedule)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={schedule}
                    onChange={(e) => handleParamChange('schedule', Number(e.target.value), setSchedule, schedule)}
                    className="flex-1 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer accent-emerald-400 outline-none border-none animate-none"
                  />
                  <button 
                    onClick={() => handleParamChange('schedule', Math.min(10, schedule + 1), setSchedule, schedule)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Socialization Card (10-steps with descriptions) */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Socialization</span>
                  <span className={`font-bold ${getSocializationLabel(socialization).color}`}>{socialization}/10 ({getSocializationLabel(socialization).text})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('socialization', Math.max(1, socialization - 1), setSocialization, socialization)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={socialization}
                    onChange={(e) => handleParamChange('socialization', Number(e.target.value), setSocialization, socialization)}
                    className={`flex-1 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer outline-none border-none ${socialization >= 5 && socialization <= 7 ? 'accent-emerald-400' : socialization === 10 ? 'accent-rose-400' : 'accent-blue-400'}`}
                  />
                  <button 
                    onClick={() => handleParamChange('socialization', Math.min(10, socialization + 1), setSocialization, socialization)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Relations Card (10-steps with descriptions) */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Relationship Dynamic</span>
                  <span className={`font-bold ${getRelationsLabel(relations).color}`}>{relations}/10 ({getRelationsLabel(relations).text})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('relations', Math.max(1, relations - 1), setRelations, relations)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={relations}
                    onChange={(e) => handleParamChange('relations', Number(e.target.value), setRelations, relations)}
                    className={`flex-1 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer outline-none border-none ${relations >= 7 ? 'accent-emerald-400' : relations >= 5 ? 'accent-blue-400' : 'accent-rose-400'}`}
                  />
                  <button 
                    onClick={() => handleParamChange('relations', Math.min(10, relations + 1), setRelations, relations)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Technical Blockers Card (10-steps with descriptions) */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Technical Blockers</span>
                  <span className={`font-bold ${getTechnicalitiesLabel(technicalities).color}`}>{technicalities}/10 ({getTechnicalitiesLabel(technicalities).text})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('technicalities', Math.max(1, technicalities - 1), setTechnicalities, technicalities)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    -
                  </button>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    value={technicalities}
                    onChange={(e) => handleParamChange('technicalities', Number(e.target.value), setTechnicalities, technicalities)}
                    className={`flex-1 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer outline-none border-none ${technicalities <= 2 ? 'accent-emerald-400' : technicalities <= 6 ? 'accent-amber-400' : 'accent-rose-400'}`}
                  />
                  <button 
                    onClick={() => handleParamChange('technicalities', Math.min(10, technicalities + 1), setTechnicalities, technicalities)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer select-none"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Middle Column: Radar Chart & Live Alerts */}
        <div className="space-y-6 xl:col-span-2">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Radar Visual */}
            <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
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
            <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
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
                      className="p-2.5 bg-neutral-900/30 border border-neutral-900 rounded-lg flex flex-col gap-1 hover:bg-neutral-900/50 transition animate-fade-in"
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
          <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 border-b border-neutral-900 pb-3">
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

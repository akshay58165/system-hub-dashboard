import React, { useState, useMemo } from 'react';
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
  // 12 Daily parameters state variables
  const [restfulness, setRestfulness] = useState<number>(8); // 1-10
  const [nutrition, setNutrition] = useState<number>(7); // 1-10
  const [hydration, setHydration] = useState<number>(8); // 1-10
  const [physicalActivity, setPhysicalActivity] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [endorphins, setEndorphins] = useState<'Low' | 'Medium' | 'High'>('Low');
  const [schedule, setSchedule] = useState<number>(8); // 1-10
  const [pleasantness, setPleasantness] = useState<number>(8); // 1-10
  const [socialization, setSocialization] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [stomach, setStomach] = useState<'Clear' | 'Unclear'>('Clear');
  const [technicalities, setTechnicalities] = useState<'Present' | 'Absent'>('Absent');
  const [relations, setRelations] = useState<'Low' | 'Medium' | 'High'>('High');
  const [stress, setStress] = useState<'Low' | 'Medium' | 'High'>('Low');

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

  // Handle parameter value change, logging effect details
  const handleParamChange = (paramName: string, newVal: any, setter: (val: any) => void, oldVal: any) => {
    setter(newVal);

    const getPoints = (name: string, val: any) => {
      if (['restfulness', 'nutrition', 'hydration', 'schedule', 'pleasantness'].includes(name)) {
        return Number(val);
      }
      if (name === 'physicalActivity') {
        return val === 'Medium' ? 10 : val === 'Low' ? 4 : 3;
      }
      if (name === 'endorphins') {
        return val === 'Low' ? 10 : val === 'Medium' ? 6 : 2;
      }
      if (name === 'socialization') {
        return val === 'Medium' ? 10 : val === 'Low' ? 6 : 4;
      }
      if (name === 'stomach') {
        return val === 'Clear' ? 10 : 2;
      }
      if (name === 'technicalities') {
        return val === 'Absent' ? 10 : 2;
      }
      if (name === 'relations') {
        return val === 'High' ? 10 : val === 'Medium' ? 6 : 2;
      }
      if (name === 'stress') {
        return val === 'Low' ? 10 : val === 'Medium' ? 5 : 1;
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
        explanation = newVal === 'Medium' ? 'Optimal physical load helps productivity.' : 'Excessive or insufficient physical load harms focus.';
        break;
      case 'endorphins':
        explanation = newVal === 'Low' ? 'Low endorphins limits distraction loops.' : 'Elevated endorphins triggers higher distraction risk.';
        break;
      case 'schedule':
        explanation = newVal > oldVal ? 'Calendar alignment restores time slots.' : 'Schedule slips reduce active work windows.';
        break;
      case 'pleasantness':
        explanation = newVal > oldVal ? 'Positive attitude boosts day value.' : 'Negative mood dampens productivity outcomes.';
        break;
      case 'socialization':
        explanation = newVal === 'Medium' ? 'Healthy mood-boosting socialization.' : newVal === 'High' ? 'Over-socializing drains available schedule time.' : 'Low socialization for today has negligible effect.';
        break;
      case 'stomach':
        explanation = newVal === 'Clear' ? 'Clear stomach secures stable mood.' : 'Stomach irritation directly damages focus and mood.';
        break;
      case 'technicalities':
        explanation = newVal === 'Absent' ? 'No tech issues present.' : 'Device or connectivity failure blocks workflow.';
        break;
      case 'relations':
        explanation = newVal === 'High' ? 'Healthy social dynamics boost performance.' : 'Friction in relationships dampens emotional stamina.';
        break;
      case 'stress':
        explanation = newVal === 'Low' ? 'Low stress improves cognitive clarity.' : 'High stress induces anxiety and drains performance.';
        break;
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setHistory(prev => [
      {
        id: `log-${Date.now()}`,
        timestamp,
        parameter: paramName.charAt(0).toUpperCase() + paramName.slice(1),
        oldVal: String(oldVal),
        newVal: String(newVal),
        scoreEffect: diffScore,
        description: explanation
      },
      ...prev.slice(0, 14)
    ]);
  };

  // Compile calculations (aggregated Bio-Score and Radar Chart vectors)
  const computedMetrics = useMemo(() => {
    const restScore = restfulness;
    const nutrScore = nutrition;
    const hydrScore = hydration;
    const physPoints = physicalActivity === 'Medium' ? 10 : physicalActivity === 'Low' ? 4 : 3;
    const endoPoints = endorphins === 'Low' ? 10 : endorphins === 'Medium' ? 6 : 2;
    const schedScore = schedule;
    const pleasScore = pleasantness;
    const socPoints = socialization === 'Medium' ? 10 : socialization === 'Low' ? 6 : 4;
    const stomPoints = stomach === 'Clear' ? 10 : 2;
    const techPoints = technicalities === 'Absent' ? 10 : 2;
    const relPoints = relations === 'High' ? 10 : relations === 'Medium' ? 6 : 2;
    const stressPoints = stress === 'Low' ? 10 : stress === 'Medium' ? 5 : 1;

    const totalPoints = restScore + nutrScore + hydrScore + physPoints + endoPoints + 
                        schedScore + pleasScore + socPoints + stomPoints + techPoints + 
                        relPoints + stressPoints;
    
    const aggregate = Math.round((totalPoints / 120) * 100);

    // Compute composite metrics for Recharts Radar Chart (bound 10-100)
    const physEnergy = Math.min(100, Math.max(10, Math.round(
      (restScore * 1.5 + nutrScore * 1.5 + hydrScore * 1.5 + physPoints * 2.0 + 35)
    )));
    const focusBandwidth = Math.min(100, Math.max(10, Math.round(
      (endoPoints * 3.0 + stressPoints * 4.0 + techPoints * 3.0) * 1.0
    )));
    const timeEfficiency = Math.min(100, Math.max(10, Math.round(
      (schedScore * 6.0 + socPoints * 4.0) * 1.0
    )));
    const emotionalVibe = Math.min(100, Math.max(10, Math.round(
      (pleasScore * 5.0 + stomPoints * 2.5 + relPoints * 2.5) * 1.0
    )));
    const socialHarmony = Math.min(100, Math.max(10, Math.round(
      (socPoints * 5.0 + relPoints * 5.0) * 1.0
    )));
    const biologicalComfort = Math.min(100, Math.max(10, Math.round(
      (stomPoints * 5.0 + stressPoints * 3.0 + restScore * 2.0) * 1.0
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
    if (stress === 'High') {
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
    if (endorphins === 'High') {
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
    if (stomach === 'Unclear') {
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
    if (technicalities === 'Present') {
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
    if (physicalActivity === 'High') {
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
    if (physicalActivity === 'Low') {
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
    if (relations === 'Low') {
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
              <span className={`text-sm font-bold mt-0.5 block flex items-center justify-center gap-1 ${statusInfo.color}`}>
                <ShieldCheck className="h-4 w-4" />
                {statusInfo.label}
              </span>
            </div>
            <div className="w-px h-8 bg-neutral-900" />
            <div className="text-center">
              <span className="text-[10px] uppercase text-neutral-500 tracking-wider block font-bold">Bio-Focus Score</span>
              <span className={`text-xl font-bold mt-0.5 block ${statusInfo.color}`}>
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
              
              {/* Restfulness Slider */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Restfulness</span>
                  <span className="text-emerald-400 font-bold">{restfulness}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('restfulness', Math.max(1, restfulness - 1), setRestfulness, restfulness)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${restfulness * 10}%` }} />
                  </div>
                  <button 
                    onClick={() => handleParamChange('restfulness', Math.min(10, restfulness + 1), setRestfulness, restfulness)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Nutrition Slider */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Nutrition</span>
                  <span className="text-emerald-400 font-bold">{nutrition}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('nutrition', Math.max(1, nutrition - 1), setNutrition, nutrition)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${nutrition * 10}%` }} />
                  </div>
                  <button 
                    onClick={() => handleParamChange('nutrition', Math.min(10, nutrition + 1), setNutrition, nutrition)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Hydration Slider */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Hydration</span>
                  <span className="text-blue-400 font-bold">{hydration}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('hydration', Math.max(1, hydration - 1), setHydration, hydration)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${hydration * 10}%` }} />
                  </div>
                  <button 
                    onClick={() => handleParamChange('hydration', Math.min(10, hydration + 1), setHydration, hydration)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Stomach (Clear / Unclear) */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Stomach Status</span>
                  <span className={stomach === 'Clear' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{stomach}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
                  <button
                    onClick={() => handleParamChange('stomach', 'Clear', setStomach, stomach)}
                    className={`py-1 rounded border transition cursor-pointer ${
                      stomach === 'Clear' ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400 font-bold' : 'bg-neutral-900 border-neutral-850 text-neutral-500'
                    }`}
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => handleParamChange('stomach', 'Unclear', setStomach, stomach)}
                    className={`py-1 rounded border transition cursor-pointer ${
                      stomach === 'Unclear' ? 'bg-rose-950/20 border-rose-500/50 text-rose-400 font-bold animate-pulse' : 'bg-neutral-900 border-neutral-850 text-neutral-500'
                    }`}
                  >
                    Unclear
                  </button>
                </div>
              </div>

              {/* Physical Activity Selector */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Physical Activity</span>
                  <span className="text-blue-400 font-bold">{physicalActivity}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[9px]">
                  {['Low', 'Medium', 'High'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleParamChange('physicalActivity', opt as any, setPhysicalActivity, physicalActivity)}
                      className={`py-1 rounded border transition cursor-pointer ${
                        physicalActivity === opt 
                          ? opt === 'Medium' ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400 font-bold' : 'bg-blue-950/20 border-blue-500/50 text-blue-400'
                          : 'bg-neutral-900 border-neutral-850 text-neutral-500'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Group 2: Cognitive & Mood Parameters */}
            <div className="space-y-3 pt-2">
              <h4 className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider font-mono">Mental Focus</h4>

              {/* Stress Selector */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Stress Level</span>
                  <span className={stress === 'High' ? 'text-rose-400 font-bold' : stress === 'Medium' ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                    {stress}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[9px]">
                  {['Low', 'Medium', 'High'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleParamChange('stress', opt as any, setStress, stress)}
                      className={`py-1 rounded border transition cursor-pointer ${
                        stress === opt 
                          ? opt === 'Low' ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400 font-bold' : opt === 'Medium' ? 'bg-amber-950/20 border-amber-500/50 text-amber-400' : 'bg-rose-950/20 border-rose-500/50 text-rose-400 font-bold animate-pulse'
                          : 'bg-neutral-900 border-neutral-850 text-neutral-500'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Endorphins (Distraction check) */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Endorphins (Distraction Risk)</span>
                  <span className={endorphins === 'High' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>{endorphins}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[9px]">
                  {['Low', 'Medium', 'High'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleParamChange('endorphins', opt as any, setEndorphins, endorphins)}
                      className={`py-1 rounded border transition cursor-pointer ${
                        endorphins === opt 
                          ? opt === 'Low' ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400 font-bold' : opt === 'Medium' ? 'bg-amber-950/20 border-amber-500/50 text-amber-400' : 'bg-rose-950/20 border-rose-500/50 text-rose-400 font-bold animate-pulse'
                          : 'bg-neutral-900 border-neutral-850 text-neutral-500'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pleasantness Slider */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Pleasantness</span>
                  <span className="text-emerald-400 font-bold">{pleasantness}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('pleasantness', Math.max(1, pleasantness - 1), setPleasantness, pleasantness)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${pleasantness * 10}%` }} />
                  </div>
                  <button 
                    onClick={() => handleParamChange('pleasantness', Math.min(10, pleasantness + 1), setPleasantness, pleasantness)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Group 3: Execution and Context Parameters */}
            <div className="space-y-3 pt-2">
              <h4 className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider font-mono">Environment & Sync</h4>

              {/* Schedule Slider */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Schedule adherence</span>
                  <span className="text-emerald-400 font-bold">{schedule}/10</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleParamChange('schedule', Math.max(1, schedule - 1), setSchedule, schedule)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-neutral-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${schedule * 10}%` }} />
                  </div>
                  <button 
                    onClick={() => handleParamChange('schedule', Math.min(10, schedule + 1), setSchedule, schedule)}
                    className="px-2 py-0.5 bg-neutral-900 border border-neutral-855 text-xs rounded hover:bg-neutral-800 text-neutral-400 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Socialization Selector */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Socialization</span>
                  <span className="text-blue-400 font-bold">{socialization}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[9px]">
                  {['Low', 'Medium', 'High'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleParamChange('socialization', opt as any, setSocialization, socialization)}
                      className={`py-1 rounded border transition cursor-pointer ${
                        socialization === opt 
                          ? opt === 'Medium' ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400 font-bold' : 'bg-blue-950/20 border-blue-500/50 text-blue-400'
                          : 'bg-neutral-900 border-neutral-850 text-neutral-500'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Relations Selector */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Relationship Dynamic</span>
                  <span className={relations === 'Low' ? 'text-rose-400 font-bold animate-pulse' : 'text-emerald-400 font-bold'}>{relations}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[9px]">
                  {['Low', 'Medium', 'High'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleParamChange('relations', opt as any, setRelations, relations)}
                      className={`py-1 rounded border transition cursor-pointer ${
                        relations === opt 
                          ? opt === 'High' ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400 font-bold' : opt === 'Medium' ? 'bg-blue-950/20 border-blue-500/50 text-blue-400' : 'bg-rose-950/20 border-rose-500/50 text-rose-400 font-bold animate-pulse'
                          : 'bg-neutral-900 border-neutral-850 text-neutral-500'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Technicalities (Present / Absent) */}
              <div className="p-3 bg-neutral-900/30 border border-neutral-900 rounded-lg space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-neutral-300">Technical Blockers</span>
                  <span className={technicalities === 'Present' ? 'text-rose-400 font-bold animate-pulse' : 'text-emerald-400 font-bold'}>{technicalities}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
                  <button
                    onClick={() => handleParamChange('technicalities', 'Absent', setTechnicalities, technicalities)}
                    className={`py-1 rounded border transition cursor-pointer ${
                      technicalities === 'Absent' ? 'bg-emerald-950/20 border-emerald-500/50 text-emerald-400 font-bold' : 'bg-neutral-900 border-neutral-850 text-neutral-500'
                    }`}
                  >
                    Absent
                  </button>
                  <button
                    onClick={() => handleParamChange('technicalities', 'Present', setTechnicalities, technicalities)}
                    className={`py-1 rounded border transition cursor-pointer ${
                      technicalities === 'Present' ? 'bg-rose-950/20 border-rose-500/50 text-rose-400 font-bold animate-pulse' : 'bg-neutral-900 border-neutral-850 text-neutral-500'
                    }`}
                  >
                    Present
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
                      className="p-2.5 bg-neutral-900/30 border border-neutral-900 rounded-lg flex flex-col gap-1 hover:bg-neutral-900/50 transition"
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

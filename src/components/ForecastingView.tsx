import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Target, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle,
  Activity,
  Layers,
  Sparkles,
  BarChart2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import { VideoRecord, CycleGoal } from '../types';

interface ForecastingProps {
  videos: VideoRecord[];
  cycleGoals: CycleGoal | null;
}

export default function ForecastingView({ videos, cycleGoals }: ForecastingProps) {
  
  const elapsedDays = 14; 
  const totalDays = 30;
  const remainingDays = totalDays - elapsedDays;
  const multiplier = totalDays / elapsedDays;

  // 1. Calculate historical metrics to extrapolate
  const stats = useMemo(() => {
    const published = videos.filter(v => v.pipelineStage === 'Published' && v.metrics);
    
    const totalViews = published.reduce((acc, v) => acc + (v.metrics?.lifetimeViews || 0), 0);
    const totalSubs = published.reduce((acc, v) => acc + (v.metrics?.lifetimeViews || 0) * (v.metrics?.subscribersGainedPer1kViews || 0) / 1000, 0);
    const totalRev = published.reduce((acc, v) => acc + (v.metrics?.lifetimeViews || 0) * (v.metrics?.revenuePer1kViews || 0) / 1000, 0);
    const totalHours = published.reduce((acc, v) => acc + (v.productionEffortHours || 0), 0);

    return {
      views: totalViews,
      subs: totalSubs,
      rev: totalRev,
      hours: totalHours,
      count: published.length
    };
  }, [videos]);

  // 2. Extrapolations (Projected month-end)
  const projection = useMemo(() => {
    return {
      expectedViews: Math.round(stats.views * multiplier),
      expectedSubscribers: Math.round(stats.subs * multiplier),
      expectedRevenueINR: Math.round(stats.rev * multiplier),
      expectedUploads: Math.round(stats.count * multiplier),
      expectedHours: Math.round(stats.hours * multiplier)
    };
  }, [stats, multiplier]);

  // 3. Goal Tracker math
  const goals = useMemo(() => {
    const targets = {
      learnDrivenShorts: cycleGoals?.learnDrivenShorts || 12,
      learnDrivenLong: cycleGoals?.learnDrivenLong || 4,
      learnDrivenMembers: cycleGoals?.learnDrivenMembers || 2,
      decodeWorthyShorts: cycleGoals?.decodeWorthyShorts || 13,
    };

    const totalTarget = targets.learnDrivenShorts + targets.learnDrivenLong + targets.learnDrivenMembers + targets.decodeWorthyShorts;
    
    // Count currently published in cycle (simulate subset matching current month)
    const publishedInCycle = videos.filter(v => v.pipelineStage === 'Published').length;
    
    // Count currently scheduled
    const scheduled = videos.filter(v => v.pipelineStage === 'Schedule').length;

    const completedSoFar = publishedInCycle + scheduled;
    const requiredUploads = Math.max(0, totalTarget - completedSoFar);
    
    // Consistency risk assessment
    const paceRequiredPerDay = totalTarget / totalDays;
    const currentPacePerDay = publishedInCycle / elapsedDays;
    
    let consistencyRisk: 'Low' | 'Medium' | 'High' = 'Low';
    let riskColor = 'text-emerald-400 border-emerald-900/50 bg-emerald-950/20';
    
    if (currentPacePerDay < paceRequiredPerDay * 0.7) {
      consistencyRisk = 'High';
      riskColor = 'text-red-400 border-red-900/50 bg-red-950/20 animate-pulse';
    } else if (currentPacePerDay < paceRequiredPerDay * 0.9) {
      consistencyRisk = 'Medium';
      riskColor = 'text-amber-400 border-amber-900/50 bg-amber-950/20';
    }

    return {
      targets,
      totalTarget,
      completedSoFar,
      requiredUploads,
      consistencyRisk,
      riskColor,
      paceRequiredPerDay: parseFloat(paceRequiredPerDay.toFixed(2)),
      currentPacePerDay: parseFloat(currentPacePerDay.toFixed(2))
    };
  }, [videos, cycleGoals, elapsedDays, totalDays]);

  // Chart data: Target vs Projected uploads
  const formatChartData = useMemo(() => {
    return [
      {
        name: 'LearnDriven Shorts',
        Target: goals.targets.learnDrivenShorts,
        Projected: Math.round(videos.filter(v => v.channelName === 'LearnDriven' && v.format === 'Short' && v.pipelineStage === 'Published').length * multiplier)
      },
      {
        name: 'LearnDriven Long',
        Target: goals.targets.learnDrivenLong,
        Projected: Math.round(videos.filter(v => v.channelName === 'LearnDriven' && v.format === 'Long' && v.pipelineStage === 'Published').length * multiplier)
      },
      {
        name: 'LearnDriven Members',
        Target: goals.targets.learnDrivenMembers,
        Projected: Math.round(videos.filter(v => v.channelName === 'LearnDriven' && v.format === 'Members' && v.pipelineStage === 'Published').length * multiplier)
      },
      {
        name: 'DecodeWorthy Shorts',
        Target: goals.targets.decodeWorthyShorts,
        Projected: Math.round(videos.filter(v => v.channelName === 'DecodeWorthy' && v.format === 'Short' && v.pipelineStage === 'Published').length * multiplier)
      }
    ];
  }, [goals, videos, multiplier]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-900 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-400" />
            Forecasting & Projections
          </h2>
          <p className="text-xs text-neutral-500 font-mono mt-1">Month-end extrapolations, posting velocities, and consistency risk scoring.</p>
        </div>
      </div>

      {/* Grid: Forecast stats (Views, Subs, Revenue) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Expected Views */}
        <div className="p-5 rounded-xl border border-neutral-850 bg-neutral-900 flex flex-col justify-between h-36 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-neutral-450 uppercase tracking-widest">Views Projection</span>
            <h3 className="text-3xl font-bold text-white tracking-tight font-sans">
              {projection.expectedViews.toLocaleString()}
            </h3>
          </div>
          <div className="text-[10px] font-mono text-neutral-400 flex justify-between items-center">
            <span>Current: {stats.views.toLocaleString()}</span>
            <span className="text-emerald-400">+{((projection.expectedViews - stats.views) / stats.views * 100).toFixed(0)}% projected</span>
          </div>
        </div>

        {/* Expected Subscribers */}
        <div className="p-5 rounded-xl border border-neutral-850 bg-neutral-900 flex flex-col justify-between h-36 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-neutral-450 uppercase tracking-widest">Subs Projection</span>
            <h3 className="text-3xl font-bold text-white tracking-tight font-sans">
              +{projection.expectedSubscribers.toLocaleString()}
            </h3>
          </div>
          <div className="text-[10px] font-mono text-neutral-400 flex justify-between items-center">
            <span>Current: +{Math.round(stats.subs).toLocaleString()}</span>
            <span className="text-emerald-400">Pace on Track</span>
          </div>
        </div>

        {/* Expected Revenue INR */}
        <div className="p-5 rounded-xl border border-neutral-850 bg-neutral-900 flex flex-col justify-between h-36 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-purple-400/80 uppercase tracking-widest font-bold">Revenue projection</span>
            <h3 className="text-3xl font-bold text-purple-400 tracking-tight font-sans">
              ₹{projection.expectedRevenueINR.toLocaleString()}
            </h3>
          </div>
          <div className="text-[10px] font-mono text-neutral-400 flex justify-between items-center">
            <span>Current: ₹{Math.round(stats.rev).toLocaleString()}</span>
            <span className="text-purple-300">₹{(projection.expectedRevenueINR * 12).toLocaleString()} /yr pace</span>
          </div>
        </div>

      </div>

      {/* Upload Goals and Consistency Risk Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Consistency Risk Callout */}
        <div className={`p-5 rounded-xl border flex flex-col justify-between h-48 ${goals.riskColor}`}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-current shrink-0" />
              <span className="text-xs font-bold font-mono uppercase tracking-widest text-white">Consistency Risk: {goals.consistencyRisk}</span>
            </div>
            <p className="text-xs text-neutral-200 font-sans leading-relaxed">
              Target monthly uploads: <span className="font-bold text-white">{goals.totalTarget}</span>. You have completed <span className="font-bold text-white">{goals.completedSoFar}</span> (including scheduled queue).
            </p>
          </div>

          <div className="text-[10px] font-mono text-neutral-300 space-y-1">
            <div className="flex justify-between">
              <span>Required Daily Pace:</span>
              <span className="text-white font-bold">{goals.paceRequiredPerDay} uploads/day</span>
            </div>
            <div className="flex justify-between">
              <span>Your Current Pace:</span>
              <span className="text-white font-bold">{goals.currentPacePerDay} uploads/day</span>
            </div>
          </div>
        </div>

        {/* Right: Production Capacity Forecast */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-neutral-850 bg-neutral-900 flex flex-col justify-between h-48 relative overflow-hidden group">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-300 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-purple-400 animate-pulse" />
              <span>Production Capacity Forecast</span>
            </span>
            <p className="text-xs text-neutral-400 font-sans leading-relaxed">
              Based on your completed uploads, you are investing an average of <span className="font-bold text-white">{(stats.hours / stats.count).toFixed(1)} hours</span> of production effort per video.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 border-t border-neutral-850 pt-4 text-center font-mono text-[10px] text-neutral-400">
            <div>
              <span className="text-neutral-500 block mb-0.5">Effort Invested</span>
              <span className="text-white font-bold">{stats.hours.toFixed(0)} hrs</span>
            </div>
            <div>
              <span className="text-neutral-500 block mb-0.5">Expected Monthly</span>
              <span className="text-white font-bold">{projection.expectedHours} hrs</span>
            </div>
            <div>
              <span className="text-neutral-500 block mb-0.5">Capacity Yield</span>
              <span className="text-emerald-400 font-bold">{(projection.expectedViews / (projection.expectedHours || 1)).toFixed(0)} v/hr</span>
            </div>
          </div>
        </div>

      </div>

      {/* Recharts Bar Chart: Targets vs Projected uploads */}
      <div className="p-5 rounded-xl bg-neutral-900 border border-neutral-850 space-y-4">
        <span className="text-xs font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
          <BarChart2 className="h-4 w-4 text-purple-400" />
          <span>Format-wise Target vs Projection</span>
        </span>
        
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <XAxis dataKey="name" stroke="#4b5563" fontSize={9} tickLine={false} />
              <YAxis stroke="#4b5563" fontSize={9} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1f2937', borderRadius: '8px' }}
                labelStyle={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: 10 }}
                itemStyle={{ fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', color: '#9ca3af' }} />
              <Bar dataKey="Target" fill="#1e293b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Projected" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}

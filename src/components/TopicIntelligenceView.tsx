import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Brain, 
  TrendingUp, 
  ArrowUpRight, 
  Layers, 
  Timer, 
  BadgeIndianRupee, 
  UserPlus, 
  HelpCircle,
  TrendingDown,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { VideoRecord } from '../types';

interface TopicIntelligenceProps {
  videos: VideoRecord[];
}

interface TopicStats {
  topic: string;
  totalVideos: number;
  avgViews: number;
  avgSubscribers: number;
  avgRevenueINR: number;
  avgWatchTimeHours: number;
  avgEffortHours: number;
  revenuePerEffortHour: number;
  subsPerEffortHour: number;
  avgEvergreenScore: number;
  recommendation: 'Make more' | 'Make long video' | 'Make members-only' | 'Use as Shorts only' | 'Pause' | 'Avoid' | 'Needs packaging';
  recommendationColor: string;
  longPotential: number; // 0-100
  memberPotential: number; // 0-100
}

export default function TopicIntelligenceView({ videos }: TopicIntelligenceProps) {
  
  const topicStatsList = useMemo(() => {
    const published = videos.filter(v => v.pipelineStage === 'Published' && v.metrics);
    
    // Group videos by topic
    const groups: Record<string, VideoRecord[]> = {};
    published.forEach(v => {
      const topicName = v.topic || 'General';
      if (!groups[topicName]) groups[topicName] = [];
      groups[topicName].push(v);
    });

    const list: TopicStats[] = [];

    Object.entries(groups).forEach(([topic, items]) => {
      const count = items.length;
      
      let totalViews = 0;
      let totalSubs = 0;
      let totalRev = 0;
      let totalWatchTime = 0;
      let totalEffort = 0;
      let totalEvergreen = 0;
      
      items.forEach(v => {
        const m = v.metrics!;
        totalViews += m.lifetimeViews || 0;
        totalSubs += (m.lifetimeViews || 0) * (m.subscribersGainedPer1kViews || 0) / 1000;
        totalRev += (m.lifetimeViews || 0) * (m.revenuePer1kViews || 0) / 1000;
        totalWatchTime += m.watchTimeHours || 0;
        totalEffort += v.productionEffortHours || 0;
        totalEvergreen += m.evergreenScore || 50;
      });

      const avgViews = Math.round(totalViews / count);
      const avgSubscribers = Math.round(totalSubs / count);
      const avgRevenueINR = Math.round(totalRev / count);
      const avgWatchTimeHours = Math.round(totalWatchTime / count);
      const avgEffortHours = totalEffort / count;
      const avgEvergreenScore = Math.round(totalEvergreen / count);

      const revenuePerEffortHour = avgEffortHours > 0 ? (avgRevenueINR / avgEffortHours) : 0;
      const subsPerEffortHour = avgEffortHours > 0 ? (avgSubscribers / avgEffortHours) : 0;

      // Determine recommendation logic
      let recommendation: TopicStats['recommendation'] = 'Make more';
      let recommendationColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-900/30';
      
      // Let's rate potential
      let longPotential = 50;
      let memberPotential = 30;

      if (avgViews > 50000 && subsPerEffortHour > 20) {
        recommendation = 'Make more';
        recommendationColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-900/30';
        longPotential = 95;
        memberPotential = 70;
      } else if (items.some(v => v.format === 'Short') && avgViews > 30000 && !items.some(v => v.format === 'Long')) {
        recommendation = 'Make long video';
        recommendationColor = 'text-purple-400 bg-purple-950/40 border-purple-900/30';
        longPotential = 90;
        memberPotential = 50;
      } else if (revenuePerEffortHour > 800) {
        recommendation = 'Make members-only';
        recommendationColor = 'text-blue-400 bg-blue-950/40 border-blue-900/30';
        longPotential = 60;
        memberPotential = 95;
      } else if (avgViews > 40000 && avgRevenueINR < 100) {
        recommendation = 'Use as Shorts only';
        recommendationColor = 'text-amber-400 bg-amber-950/40 border-amber-900/30';
        longPotential = 20;
        memberPotential = 15;
      } else if (avgViews < 5000 && avgEffortHours > 10) {
        recommendation = 'Avoid';
        recommendationColor = 'text-red-400 bg-red-950/40 border-red-900/30';
        longPotential = 10;
        memberPotential = 5;
      } else if (avgViews < 10000 && avgEffortHours > 5) {
        recommendation = 'Pause';
        recommendationColor = 'text-neutral-400 bg-neutral-900 border-neutral-800';
        longPotential = 30;
        memberPotential = 20;
      } else {
        recommendation = 'Needs packaging';
        recommendationColor = 'text-amber-400 bg-amber-950/40 border-amber-900/30';
        longPotential = 70;
        memberPotential = 45;
      }

      list.push({
        topic,
        totalVideos: count,
        avgViews,
        avgSubscribers,
        avgRevenueINR,
        avgWatchTimeHours,
        avgEffortHours: parseFloat(avgEffortHours.toFixed(1)),
        revenuePerEffortHour: Math.round(revenuePerEffortHour),
        subsPerEffortHour: parseFloat(subsPerEffortHour.toFixed(1)),
        avgEvergreenScore,
        recommendation,
        recommendationColor,
        longPotential,
        memberPotential
      });
    });

    return list.sort((a, b) => b.avgViews - a.avgViews);
  }, [videos]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-900 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            Topic Intelligence Matrix
          </h2>
          <p className="text-xs text-neutral-500 font-mono mt-1">Evaluate topic repeatability, production efficiencies, and long-form expansion opportunities.</p>
        </div>
      </div>

      {/* Grid: Recommendation summary buckets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Repeat List */}
        <div className="p-4 rounded-xl border border-neutral-850 bg-neutral-900 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold font-mono uppercase">
            <Sparkles className="h-4 w-4" />
            <span>Top Repeat Topics</span>
          </div>
          <p className="text-[14px] text-neutral-400 font-sans leading-relaxed">
            {topicStatsList.filter(t => t.recommendation === 'Make more').map(t => t.topic).join(', ') || 'None detected yet.'}
          </p>
        </div>

        {/* Expand List */}
        <div className="p-4 rounded-xl border border-neutral-850 bg-neutral-900 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-purple-400 text-xs font-bold font-mono uppercase">
            <TrendingUp className="h-4 w-4" />
            <span>Shorts to Long</span>
          </div>
          <p className="text-[14px] text-neutral-400 font-sans leading-relaxed">
            {topicStatsList.filter(t => t.recommendation === 'Make long video').map(t => t.topic).join(', ') || 'None detected yet.'}
          </p>
        </div>

        {/* Members Exclusive */}
        <div className="p-4 rounded-xl border border-neutral-850 bg-neutral-900 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold font-mono uppercase">
            <Layers className="h-4 w-4" />
            <span>Members-Only Potential</span>
          </div>
          <p className="text-[14px] text-neutral-400 font-sans leading-relaxed">
            {topicStatsList.filter(t => t.recommendation === 'Make members-only').map(t => t.topic).join(', ') || 'None detected yet.'}
          </p>
        </div>

        {/* Avoid list */}
        <div className="p-4 rounded-xl border border-neutral-850 bg-neutral-900 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold font-mono uppercase">
            <TrendingDown className="h-4 w-4" />
            <span>Pause / Avoid</span>
          </div>
          <p className="text-[14px] text-neutral-400 font-sans leading-relaxed">
            {topicStatsList.filter(t => t.recommendation === 'Avoid' || t.recommendation === 'Pause').map(t => t.topic).join(', ') || 'None.'}
          </p>
        </div>
      </div>

      {/* Main Stats Table */}
      <div className="rounded-xl border border-neutral-850 bg-neutral-900 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="bg-neutral-950 text-neutral-400 uppercase font-mono text-[13px] border-b border-neutral-850">
                <th className="p-4 font-semibold">Topic Domain</th>
                <th className="p-4 font-semibold text-center">Videos</th>
                <th className="p-4 font-semibold">Avg Views</th>
                <th className="p-4 font-semibold">Avg Subs</th>
                <th className="p-4 font-semibold">Revenue/Hour</th>
                <th className="p-4 font-semibold">Production Effort</th>
                <th className="p-4 font-semibold text-center">Evergreen</th>
                <th className="p-4 font-semibold text-right">AI Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-850 text-neutral-300">
              {topicStatsList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-600 font-mono">No published topics available for statistical matrix.</td>
                </tr>
              ) : (
                topicStatsList.map(t => (
                  <tr key={t.topic} className="hover:bg-neutral-800 transition-colors">
                    <td className="p-4 font-bold text-white font-mono">{t.topic}</td>
                    <td className="p-4 text-center font-mono text-neutral-500">{t.totalVideos}</td>
                    <td className="p-4 font-bold font-mono">{t.avgViews.toLocaleString()}</td>
                    <td className="p-4 text-emerald-400 font-bold font-mono">+{t.avgSubscribers}</td>
                    <td className="p-4 text-purple-400 font-bold font-mono">
                      ₹{t.revenuePerEffortHour} <span className="text-[13px] text-neutral-500 font-normal">/hr</span>
                    </td>
                    <td className="p-4 font-mono text-neutral-400 flex items-center gap-1 mt-1">
                      <Timer className="h-3.5 w-3.5 text-neutral-500" />
                      <span>{t.avgEffortHours} hrs avg</span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="inline-flex items-center justify-center h-6 w-12 bg-neutral-900 border border-neutral-850 rounded font-mono font-bold text-white text-[14px]">
                        {t.avgEvergreenScore}%
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className={`px-2.5 py-1 rounded-lg border text-[13px] font-mono font-bold uppercase tracking-wider ${t.recommendationColor}`}>
                        {t.recommendation}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Trophy, 
  Award, 
  TrendingUp, 
  Zap, 
  ShieldCheck, 
  AlertTriangle,
  Activity,
  ThumbsUp,
  Flame,
  ArrowUpRight,
  Target
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import { GitHubRepo, VercelProject, SupabaseProject } from '../types';

interface ScoreViewProps {
  repos: GitHubRepo[];
  vercelProjects: VercelProject[];
  supabase: SupabaseProject;
}

export default function ScoreView({ repos, vercelProjects, supabase }: ScoreViewProps) {
  // Calculate specific scores out of 100
  const scores = useMemo(() => {
    // 1. Repo Health (stars, lack of issues, successful workflows)
    const totalRepos = repos.length;
    let repoScore = 80; // default base
    if (totalRepos > 0) {
      const openIssuesCount = repos.reduce((sum, r) => sum + r.openIssues, 0);
      const totalWorkflows = repos.reduce((sum, r) => sum + r.workflows.length, 0);
      const successfulWorkflows = repos.reduce((sum, r) => sum + r.workflows.filter(w => w.status === 'success').length, 0);
      
      // deduct points for too many open issues
      const issuePenalty = Math.min(20, (openIssuesCount / totalRepos) * 2);
      // add points for workflow success rate
      const workflowRatio = totalWorkflows > 0 ? (successfulWorkflows / totalWorkflows) * 20 : 20;

      repoScore = Math.round(60 - issuePenalty + workflowRatio);
    }

    // 2. Deployment Speed & Core Web Vitals score
    let speedScore = 90;
    if (vercelProjects.length > 0) {
      const vitals = vercelProjects[0].analytics.webVitals;
      // perfect score would be: LCP < 1000ms, FID < 10ms, CLS < 0.01
      const lcpFactor = Math.max(0, 100 - (vitals.lcp - 1000) / 10);
      const fidFactor = Math.max(0, 100 - (vitals.fid - 10) * 2);
      const clsFactor = Math.max(0, 100 - vitals.cls * 1000);
      speedScore = Math.round((lcpFactor + fidFactor + clsFactor) / 3);
    }

    // 3. Database & API efficiency
    const dbSizeNum = parseFloat(supabase.metrics.dbSize) || 45.2; // default
    const dbPenalty = dbSizeNum > 100 ? 5 : 0;
    const cpuEfficiency = Math.max(0, 100 - supabase.metrics.cpuUsage);
    const memEfficiency = Math.max(0, 100 - supabase.metrics.memoryUsage);
    const dbScore = Math.round((cpuEfficiency * 0.4) + (memEfficiency * 0.4) + (100 - dbPenalty) * 0.2);

    // 4. Overall SLA / Reliability Score
    const reliabilityScore = 99.98; // Fixed high SLA standard

    // Calculate aggregate score
    const aggregate = Math.round((repoScore + speedScore + dbScore + 99.98) / 4);

    return {
      repoScore,
      speedScore,
      dbScore,
      reliabilityScore,
      aggregate
    };
  }, [repos, vercelProjects, supabase]);

  // Radar data
  const radarData = [
    { subject: 'Code Quality', A: scores.repoScore, fullMark: 100 },
    { subject: 'Load Performance', A: scores.speedScore, fullMark: 100 },
    { subject: 'DB Efficiency', A: scores.dbScore, fullMark: 100 },
    { subject: 'Uptime SLA', A: Math.round(scores.reliabilityScore), fullMark: 100 },
    { subject: 'Security Headers', A: 95, fullMark: 100 },
    { subject: 'SEO Score', A: 92, fullMark: 100 },
  ];

  // Colors based on score
  const getScoreColorClass = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 75) return 'text-blue-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getScoreBgClass = (score: number) => {
    if (score >= 90) return 'bg-emerald-500/10 border-emerald-950/40';
    if (score >= 75) return 'bg-blue-500/10 border-blue-950/40';
    if (score >= 50) return 'bg-amber-500/10 border-amber-950/40';
    return 'bg-rose-500/10 border-rose-950/40';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100 tracking-tight flex items-center gap-2">
              <Trophy className="h-5 w-5 text-rose-400 animate-bounce" />
              System Performance Scorecard
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Consolidated evaluation metrics assessing overall speed, quality, and platform availability.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-neutral-950/60 border border-neutral-850 px-5 py-3 rounded-xl font-mono">
            <div className="text-center">
              <span className="text-[10px] uppercase text-neutral-500 tracking-wider block font-bold">Health Status</span>
              <span className="text-sm font-bold text-emerald-400 mt-0.5 block flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" />
                EXCELLENT
              </span>
            </div>
            <div className="w-px h-8 bg-neutral-800" />
            <div className="text-center">
              <span className="text-[10px] uppercase text-neutral-500 tracking-wider block font-bold">Aggregated Score</span>
              <span className={`text-xl font-bold mt-0.5 block ${getScoreColorClass(scores.aggregate)}`}>
                {scores.aggregate}/100
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Radar Chart vs Score Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Map (2 columns) */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 lg:col-span-2 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">System Metric Radar</h3>
            <p className="text-xs text-neutral-500">Multilateral coverage of platform engineering parameters.</p>
          </div>

          <div className="h-80 w-full flex justify-center items-center font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="#262626" />
                <PolarAngleAxis dataKey="subject" stroke="#a3a3a3" fontSize={10} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#404040" fontSize={9} />
                <Radar 
                  name="Metrics" 
                  dataKey="A" 
                  stroke="#fb7185" 
                  fill="#fb7185" 
                  fillOpacity={0.15} 
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score Breakdown (1 column) */}
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">Metric Breakdown</h3>
            <p className="text-xs text-neutral-500">Target scores for individual system segments.</p>
          </div>

          <div className="space-y-3.5">
            {[
              { title: 'Code Quality Score', score: scores.repoScore, desc: 'Assesses pull requests, issue resolution, and workflow status.' },
              { title: 'Vitals Speed Index', score: scores.speedScore, desc: 'Analyzes user browser paint speeds, layout shift, and edge latency.' },
              { title: 'Resource Allocation DB', score: scores.dbScore, desc: 'Evaluates DB connection load, CPU utilization and disk overhead.' },
              { title: 'Platform SLA Uptime', score: 100, desc: 'Assures cloud synchronizer node availability & server uptime.' }
            ].map((item, idx) => (
              <div key={idx} className={`p-4 border rounded-xl font-mono flex items-start justify-between gap-4 ${getScoreBgClass(item.score)}`}>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-neutral-200">{item.title}</h4>
                  <p className="text-[10px] text-neutral-400 font-sans leading-relaxed">{item.desc}</p>
                </div>
                <span className={`text-lg font-bold shrink-0 ${getScoreColorClass(item.score)}`}>
                  {item.score}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gamified recommendations or improvements */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-4 w-4 text-rose-400" />
          <h3 className="text-sm font-semibold text-neutral-200">Recommended Enhancements</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[11px]">
          <div className="p-4 bg-neutral-900/40 border border-neutral-850 rounded-lg space-y-2">
            <div className="flex items-center gap-1.5 text-blue-400 font-bold">
              <Flame className="h-3.5 w-3.5" />
              <span>Optimize Next.js LCP</span>
            </div>
            <p className="text-neutral-400 font-sans leading-relaxed">
              Your Largest Contentful Paint (LCP) is 1.2s. Preload large content blocks and resolve custom fonts faster to hit the maximum 100% score.
            </p>
          </div>

          <div className="p-4 bg-neutral-900/40 border border-neutral-850 rounded-lg space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <ThumbsUp className="h-3.5 w-3.5" />
              <span>Reduce Open Git Issues</span>
            </div>
            <p className="text-neutral-400 font-sans leading-relaxed">
              Open issues increase repo debt. Close obsolete tickets in Topic Repos to boost code quality indicators to 95%.
            </p>
          </div>

          <div className="p-4 bg-neutral-900/40 border border-neutral-850 rounded-lg space-y-2">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <Activity className="h-3.5 w-3.5" />
              <span>Database Connection Pool</span>
            </div>
            <p className="text-neutral-400 font-sans leading-relaxed">
              Fluctuations in connections can increase database size overhead. Synchronize pooling intervals on your active schemas in the Action Hub.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  GitBranch, Layers, Database, Activity, CheckCircle2, AlertTriangle, Clock, Users, Wifi, Clapperboard
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { VideoItem, WorkWindowSession, MonthlyGoals } from '../types';

interface StudioHealthProps {
  videos: VideoItem[];
  workSessions: WorkWindowSession[];
  goals: MonthlyGoals;
  totalCompleted: number;
  totalPlanned: number;
  onNavigate: (tab: 'pipeline' | 'sessions' | 'channels') => void;
}

function calcWorkedMinutes(session: WorkWindowSession): number {
  const [startH, startM] = session.startTime.split(':').map(Number);
  const [endH, endM] = session.endTime.split(':').map(Number);
  const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  const pausedMinutes = session.pausePeriods.reduce((sum, pause) => {
    const pStart = new Date(pause.startTime).getTime();
    const pEnd = new Date(pause.endTime).getTime();
    return sum + Math.max(0, (pEnd - pStart) / 60000);
  }, 0);
  return Math.max(0, totalMinutes - pausedMinutes);
}

export default function StudioHealth({ videos, workSessions, goals, totalCompleted, totalPlanned, onNavigate }: StudioHealthProps) {
  const stats = useMemo(() => {
    const stageCounts: Record<string, number> = {};
    videos.forEach(v => { stageCounts[v.currentStage] = (stageCounts[v.currentStage] || 0) + 1; });

    const totalWorkedMinutes = workSessions.reduce((sum, s) => sum + calcWorkedMinutes(s), 0);
    const totalPausedMinutes = workSessions.reduce((sum, s) => sum + s.pausePeriods.reduce((pSum, pause) => {
      const pStart = new Date(pause.startTime).getTime();
      const pEnd = new Date(pause.endTime).getTime();
      return pSum + Math.max(0, (pEnd - pStart) / 60000);
    }, 0), 0);

    const stageMinutes: Record<string, number> = {};
    workSessions.forEach(s => {
      if (s.stage) stageMinutes[s.stage] = (stageMinutes[s.stage] || 0) + calcWorkedMinutes(s);
    });

    const blockedCount = videos.filter(v => v.isBlocked).length;
    const criticalCount = videos.filter(v => v.status === 'critical').length;
    const doneCount = stageCounts['Done'] || 0;

    // Build a 7-day trend of created vs completed videos for the area chart
    const trendDays: { date: string; created: number; completed: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const created = videos.filter(v => v.createdAt === dateStr).length;
      const completed = videos.filter(v => v.currentStage === 'Done' && v.actualScheduledDate === dateStr).length;
      trendDays.push({ date: label, created, completed });
    }

    const activityLog = [...videos]
      .filter(v => v.createdAt)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 8)
      .map(v => ({
        id: v.id,
        message: `${v.title} moved to ${v.currentStage}`,
        channel: v.channel,
        time: v.createdAt || '',
        type: v.status === 'critical' ? 'error' : v.currentStage === 'Done' ? 'success' : 'info'
      }));

    return { stageCounts, totalWorkedMinutes, totalPausedMinutes, stageMinutes, blockedCount, criticalCount, doneCount, trendDays, activityLog };
  }, [videos, workSessions]);

  const completionPct = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;
  const blockedPct = videos.length > 0 ? Math.round(((videos.length - stats.blockedCount) / videos.length) * 100) : 100;
  const healthPct = videos.length > 0 ? Math.round(((videos.length - stats.criticalCount) / videos.length) * 100) : 100;
  const workedHours = Math.floor(stats.totalWorkedMinutes / 60);
  const workedMins = Math.round(stats.totalWorkedMinutes % 60);
  const activeSessionCount = workSessions.filter(s => s.isActive).length;
  const monthlyTargets = (goals.ldShortsTarget ?? 0) + (goals.ldLongTarget ?? 0) + (goals.dwShortsTarget ?? 0);

  return (
    <div className="space-y-6 font-sans">
      {/* Integrated Pipeline Flow */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100 tracking-tight flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              Studio Pipeline Flow
            </h2>
            <p className="text-xs text-neutral-400">Real-time interconnection of your topics, work sessions, and channel targets.</p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-neutral-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Pipeline Live</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-300">
              <span className={`h-2 w-2 rounded-full ${activeSessionCount > 0 ? 'bg-emerald-500' : 'bg-neutral-600'}`} />
              <span>Sessions {activeSessionCount > 0 ? 'Active' : 'Idle'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-neutral-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Channels Synced</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center relative py-4">
          <div
            onClick={() => onNavigate('pipeline')}
            className="md:col-span-1 p-4 bg-neutral-950 border border-neutral-800 rounded-lg hover:border-neutral-700 transition cursor-pointer flex flex-col items-center text-center group"
          >
            <div className="p-3 bg-neutral-900 rounded-full border border-neutral-800 group-hover:border-neutral-600 transition text-neutral-300 mb-2">
              <GitBranch className="h-5 w-5 text-neutral-300" />
            </div>
            <span className="text-xs font-mono font-semibold text-neutral-200">video.pipeline</span>
            <span className="text-[10px] text-neutral-500 mt-1">{videos.length} Active Items</span>
            <span className="text-[10px] text-emerald-400 font-mono mt-0.5">{stats.criticalCount === 0 ? 'All Clear' : `${stats.criticalCount} Critical`}</span>
          </div>

          <div className="hidden md:flex md:col-span-1 justify-center items-center">
            <div className="w-full relative h-1 bg-neutral-800 rounded-full">
              <motion.div
                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full"
                animate={{ left: ['0%', '100%'], width: ['10%', '30%', '10%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          </div>

          <div
            onClick={() => onNavigate('sessions')}
            className="md:col-span-1 p-4 bg-neutral-950 border border-neutral-800 rounded-lg hover:border-neutral-700 transition cursor-pointer flex flex-col items-center text-center group"
          >
            <div className="p-3 bg-neutral-900 rounded-full border border-neutral-800 group-hover:border-neutral-600 transition text-neutral-300 mb-2">
              <Layers className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-xs font-mono font-semibold text-neutral-200">work.sessions</span>
            <span className="text-[10px] text-neutral-500 mt-1">{workSessions.length} Windows Today</span>
            <span className="text-[10px] text-blue-400 font-mono mt-0.5">{activeSessionCount > 0 ? 'Session Active' : 'No Active Session'}</span>
          </div>

          <div className="hidden md:flex md:col-span-1 justify-center items-center">
            <div className="w-full relative h-1 bg-neutral-800 rounded-full">
              <motion.div
                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full"
                animate={{ left: ['0%', '100%'], width: ['10%', '30%', '10%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear', delay: 1.2 }}
              />
            </div>
          </div>

          <div
            onClick={() => onNavigate('channels')}
            className="md:col-span-1 p-4 bg-neutral-950 border border-neutral-800 rounded-lg hover:border-neutral-700 transition cursor-pointer flex flex-col items-center text-center group"
          >
            <div className="p-3 bg-neutral-900 rounded-full border border-neutral-800 group-hover:border-neutral-600 transition text-neutral-300 mb-2">
              <Database className="h-5 w-5 text-emerald-400" />
            </div>
            <span className="text-xs font-mono font-semibold text-neutral-200">channel.lanes</span>
            <span className="text-[10px] text-neutral-500 mt-1">{monthlyTargets} Monthly Targets</span>
            <span className="text-[10px] text-emerald-400 font-mono mt-0.5">{totalCompleted}/{totalPlanned} Done</span>
          </div>
        </div>
      </div>

      {/* Grid of 4 Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider font-mono">Pipeline Load</span>
            <Users className="h-4 w-4 text-neutral-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">{videos.length - stats.doneCount}</span>
            <span className="text-xs text-emerald-400 font-mono">{completionPct}%</span>
          </div>
          <div className="mt-2 text-xs text-neutral-500 font-mono flex items-center justify-between">
            <span>In progress items</span>
            <span className="text-neutral-400">{stats.doneCount} completed</span>
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider font-mono">Worked Today</span>
            <Activity className="h-4 w-4 text-neutral-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">{workedHours}h {workedMins}m</span>
          </div>
          <div className="mt-2 text-xs text-neutral-500 font-mono flex items-center justify-between">
            <span>Active focus time</span>
            <span className="text-amber-400">{Math.round(stats.totalPausedMinutes)}m paused</span>
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider font-mono">Pipeline Volume</span>
            <Database className="h-4 w-4 text-neutral-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">{videos.length}</span>
            <span className="text-xs text-neutral-400 font-mono">total items</span>
          </div>
          <div className="mt-2 text-xs text-neutral-500 font-mono flex items-center justify-between">
            <span>Blocked items</span>
            <span className={stats.blockedCount > 0 ? 'text-rose-400' : 'text-neutral-400'}>{stats.blockedCount}</span>
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 hover:border-neutral-700 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider font-mono">Focus Stage</span>
            <Clapperboard className="h-4 w-4 text-neutral-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">
              {Object.entries(stats.stageMinutes).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || '—'}
            </span>
          </div>
          <div className="mt-2 text-xs text-neutral-500 font-mono flex items-center justify-between">
            <span>Most logged time</span>
            <span className="text-neutral-400">
              {Math.round((Object.entries(stats.stageMinutes).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[1] as number) || 0)}m
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-200">Topic Velocity</h3>
              <p className="text-xs text-neutral-500">Created vs. completed videos over the last 7 days.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1 text-blue-400">
                <span className="h-1.5 w-1.5 bg-blue-500 rounded-full" />
                <span>Created</span>
              </div>
              <div className="flex items-center gap-1 text-emerald-400">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />
                <span>Completed</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendDays} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#525252" fontSize={10} fontStyle="italic" />
                <YAxis stroke="#525252" fontSize={10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '8px' }}
                  labelStyle={{ color: '#a3a3a3', fontStyle: 'italic', fontSize: '11px' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="created" name="Created" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCreated)" strokeWidth={2} />
                <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">Pipeline Vitals</h3>
            <p className="text-xs text-neutral-500 font-mono">Health signals derived from your actual video data.</p>
          </div>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-neutral-400">Completion Rate</span>
                <span className="text-emerald-400 font-semibold">{completionPct}%</span>
              </div>
              <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-neutral-400">Unblocked Ratio</span>
                <span className={`font-semibold ${blockedPct > 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{blockedPct}%</span>
              </div>
              <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                <div className={`h-1.5 rounded-full transition-all ${blockedPct > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${blockedPct}%` }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-neutral-400">Critical-Free Ratio</span>
                <span className={`font-semibold ${healthPct > 80 ? 'text-emerald-400' : 'text-rose-400'}`}>{healthPct}%</span>
              </div>
              <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                <div className={`h-1.5 rounded-full transition-all ${healthPct > 80 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${healthPct}%` }} />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-800 grid grid-cols-2 gap-4">
            <div className="p-3 bg-neutral-900 rounded-lg text-center">
              <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono block">Active Sessions</span>
              <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">{activeSessionCount}</span>
            </div>
            <div className="p-3 bg-neutral-900 rounded-lg text-center">
              <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono block">Blocked Items</span>
              <span className="text-lg font-bold font-mono text-blue-400 mt-1 block">{stats.blockedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Console Telemetry Log */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">Console Telemetry Log</h3>
            <p className="text-xs text-neutral-500">Recent topic creation and stage transition activity.</p>
          </div>
          <span className="px-2 py-0.5 bg-neutral-900 text-neutral-400 font-mono text-[10px] border border-neutral-800 rounded-full">
            {stats.activityLog.length} logs
          </span>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {stats.activityLog.length === 0 ? (
            <div className="text-xs text-neutral-600 text-center py-8">No activity recorded yet.</div>
          ) : (
            stats.activityLog.map((evt) => (
              <div
                key={evt.id}
                className="p-3 bg-neutral-900/60 border border-neutral-800/80 rounded-lg flex items-start gap-3 hover:bg-neutral-900 transition text-xs"
              >
                <div className="mt-0.5">
                  {evt.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {evt.type === 'info' && <Wifi className="h-4 w-4 text-blue-400" />}
                  {evt.type === 'error' && <AlertTriangle className="h-4 w-4 text-rose-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-neutral-300 tracking-wide font-mono break-all">{evt.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] uppercase font-semibold tracking-wider ${
                      evt.channel === 'LearnDriven' ? 'bg-emerald-950 text-emerald-400' : 'bg-blue-950 text-blue-400'
                    }`}>
                      {evt.channel}
                    </span>
                    <span className="text-neutral-500 font-mono text-[10px] italic">{evt.time}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

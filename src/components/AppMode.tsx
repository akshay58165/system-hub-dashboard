import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarRange,
  CircleGauge,
  Clapperboard,
  Command,
  Film,
  HeartPulse,
  LayoutDashboard,
  ListVideo,
  Radio,
  Settings2,
  Target,
  Video,
  Zap,
} from 'lucide-react';
import { DashboardActionTarget, MonthlyGoals, RevenueLevelConfig, VideoItem, WellbeingEntry, CalibrationNode } from '../types';
import { getReadiness } from '../wellbeingLogic';
import PipelineBoard from './PipelineBoard';
import ChannelLanes from './ChannelLanes';
import DailyStateDashboard from './DailyStateDashboard';
import TactileLED from './TactileLED';

type AppSection = 'command' | 'production' | 'channels' | 'wellbeing';

interface AppModeProps {
  goals: MonthlyGoals;
  videos: VideoItem[];
  revenueLevels: RevenueLevelConfig[];
  nodes: CalibrationNode[];
  wellbeingHistory: WellbeingEntry[];
  todayDay: number;
  totalDays: number;
  daysRemaining: number;
  totalPlanned: number;
  totalCompleted: number;
  requiredEffortToday: number;
  pressureLevel: 'Low' | 'Stable' | 'Pressure' | 'Critical';
  onUpdateVideo: (video: VideoItem) => void;
  onAddVideo: (video: Omit<VideoItem, 'id' | 'completionPercentage'>) => void;
  onDeleteVideo: (id: string) => void;
  onUpdateNode: (nodeId: string, value: number, record?: boolean) => void;
  onOpenZone: () => void;
}

const SECTIONS: Array<{ id: AppSection; label: string; detail: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'command', label: 'Command', detail: 'Today at a glance', icon: LayoutDashboard },
  { id: 'production', label: 'Production', detail: 'Move the work', icon: Clapperboard },
  { id: 'channels', label: 'Channels', detail: 'Targets and pace', icon: Radio },
  { id: 'wellbeing', label: 'Wellbeing', detail: 'Personal capacity', icon: HeartPulse },
];

const STAGE_INDEX: Record<VideoItem['currentStage'], number> = {
  Topic: 0,
  Script: 1,
  Shoot: 2,
  Edit: 3,
  Thumbnail: 4,
  Schedule: 5,
  Done: 6,
};

const NEXT_MOVE: Record<VideoItem['currentStage'], string> = {
  Topic: 'Develop the topic',
  Script: 'Finish the script',
  Shoot: 'Complete the shoot',
  Edit: 'Finish the edit',
  Thumbnail: 'Lock the thumbnail',
  Schedule: 'Schedule the video',
  Done: 'Published and protected',
};

function laneTarget(goals: MonthlyGoals, lane: VideoItem['contentLane']) {
  if (lane === 'LearnDriven Shorts') return goals.ldShortsTarget;
  if (lane === 'LearnDriven Long Videos') return goals.ldLongTarget;
  if (lane === 'LearnDriven Members-only Videos') return goals.ldMembersTarget;
  return goals.dwShortsTarget;
}

function toneForPressure(pressure: AppModeProps['pressureLevel']) {
  if (pressure === 'Critical') return 'text-rose-400 border-rose-900/60 bg-rose-950/20';
  if (pressure === 'Pressure') return 'text-amber-400 border-amber-900/60 bg-amber-950/20';
  return 'text-emerald-400 border-emerald-900/60 bg-emerald-950/20';
}

export default function AppMode({
  goals,
  videos,
  revenueLevels,
  nodes,
  wellbeingHistory,
  todayDay,
  totalDays,
  daysRemaining,
  totalPlanned,
  totalCompleted,
  requiredEffortToday,
  pressureLevel,
  onUpdateVideo,
  onAddVideo,
  onDeleteVideo,
  onUpdateNode,
  onOpenZone,
}: AppModeProps) {
  const [section, setSection] = useState<AppSection>('command');
  const [focusRequest, setFocusRequest] = useState<DashboardActionTarget | null>(null);

  const readiness = getReadiness(nodes);
  const completion = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;
  const cycleProgress = Math.min(100, Math.round((todayDay / Math.max(1, totalDays)) * 100));

  const laneHealth = useMemo(() => {
    const lanes: VideoItem['contentLane'][] = ['LearnDriven Shorts', 'LearnDriven Long Videos', 'LearnDriven Members-only Videos', 'DecodeWorthy Shorts'];
    return lanes.map(lane => {
      const target = laneTarget(goals, lane);
      const done = videos.filter(video => video.contentLane === lane && video.currentStage === 'Done').length;
      const active = videos.filter(video => video.contentLane === lane && video.currentStage !== 'Done').length;
      return { lane, target, done, active, gap: target === null ? null : Math.max(0, target - done) };
    });
  }, [goals, videos]);

  const priorityVideo = useMemo(() => {
    const atRiskLane = [...laneHealth]
      .filter(lane => lane.target !== null && lane.gap !== null && lane.gap > 0)
      .sort((a, b) => ((b.gap || 0) / Math.max(1, b.target || 1)) - ((a.gap || 0) / Math.max(1, a.target || 1)))[0];
    return [...videos]
      .filter(video => video.currentStage !== 'Done')
      .sort((a, b) => {
        const blockDelta = Number(b.isBlocked) - Number(a.isBlocked);
        if (blockDelta) return blockDelta;
        const laneDelta = Number(b.contentLane === atRiskLane?.lane) - Number(a.contentLane === atRiskLane?.lane);
        if (laneDelta) return laneDelta;
        return STAGE_INDEX[b.currentStage] - STAGE_INDEX[a.currentStage];
      })[0];
  }, [laneHealth, videos]);

  const openVideo = (video: VideoItem) => {
    setFocusRequest({ type: 'video', videoId: video.id, requestId: Date.now() });
    setSection('production');
  };

  const productionCounts = (channel: VideoItem['channel']) => ({
    shot: videos.filter(video => video.channel === channel && ['Edit', 'Thumbnail', 'Schedule', 'Done'].includes(video.currentStage)).length,
    edited: videos.filter(video => video.channel === channel && ['Thumbnail', 'Schedule', 'Done'].includes(video.currentStage)).length,
    scheduled: videos.filter(video => video.channel === channel && (video.currentStage === 'Done' || video.pipeline.schedule === 'Done')).length,
  });

  const activeSection = SECTIONS.find(item => item.id === section) || SECTIONS[0];

  return (
    <div className="min-h-[760px] overflow-visible rounded-xl border border-zinc-900/90 bg-zinc-950/55 shadow-[0_18px_70px_rgba(0,0,0,0.28)]">
      <div className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl lg:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-emerald-800/60 bg-emerald-950/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_18px_rgba(16,185,129,0.08)]">
            <Command className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[8px] font-mono font-bold tracking-[0.2em] text-emerald-400"><TactileLED color="emerald" importance="low" active />APP MODE / {activeSection.label.toUpperCase()}</div>
            <h2 className="truncate text-sm font-semibold text-white">{activeSection.detail}</h2>
          </div>
        </div>
        <div className="hidden items-center gap-6 md:flex">
          <div className="text-right font-mono"><span className="block text-[7px] tracking-wider text-zinc-600">ZONE PROGRESS</span><strong className="text-xs text-zinc-200">{completion}%</strong></div>
          <div className="text-right font-mono"><span className="block text-[7px] tracking-wider text-zinc-600">DAYS LEFT</span><strong className="text-xs text-amber-400">{daysRemaining}</strong></div>
          <div className={`rounded-md border px-2.5 py-1.5 text-[8px] font-mono font-bold ${toneForPressure(pressureLevel)}`}>{pressureLevel.toUpperCase()} LOAD</div>
          <button onClick={onOpenZone} className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-[9px] font-mono font-bold text-zinc-400 transition hover:border-zinc-700 hover:text-white"><Settings2 className="h-3.5 w-3.5" />SET ZONE</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="sticky top-16 z-20 self-start border-b border-zinc-900 bg-zinc-950/85 p-2 backdrop-blur-xl lg:h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r lg:p-3">
          <nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
            {SECTIONS.map(item => {
              const Icon = item.icon;
              const active = section === item.id;
              return <button key={item.id} onClick={() => setSection(item.id)} className={`group flex min-w-max items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition lg:w-full ${active ? 'border-emerald-900/60 bg-emerald-950/25 text-emerald-400 shadow-[inset_2px_0_0_rgba(52,211,153,0.75)]' : 'border-transparent text-zinc-500 hover:border-zinc-900 hover:bg-zinc-900/45 hover:text-zinc-300'}`}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span><strong className="block text-[9px] font-mono tracking-wide">{item.label.toUpperCase()}</strong><small className="hidden text-[7px] text-zinc-600 lg:block">{item.detail}</small></span>
              </button>;
            })}
          </nav>
          <div className="mt-5 hidden border-t border-zinc-900 pt-4 lg:block">
            <div className="px-2 text-[7px] font-mono tracking-widest text-zinc-700">LIVE CAPACITY</div>
            <div className="mt-2 rounded-lg border border-zinc-900 bg-black/20 p-3">
              <div className="flex items-center justify-between text-[8px] font-mono"><span className="text-zinc-500">READINESS</span><strong className={readiness === 0 ? 'text-zinc-600' : readiness < 50 ? 'text-rose-400' : readiness < 70 ? 'text-amber-400' : 'text-emerald-400'}>{readiness === 0 ? 'N/A' : `${readiness}%`}</strong></div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-900"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-400" style={{ width: `${readiness}%` }} /></div>
              <p className="mt-3 text-[7px] leading-relaxed text-zinc-600">{requiredEffortToday.toFixed(1)} effort points needed today.</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 p-3 md:p-5">
          {section === 'command' && (
            <div className="space-y-4">
              <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {[
                  { label: 'Zone completion', value: `${completion}%`, detail: `${totalCompleted} of ${totalPlanned || 0} complete`, icon: Target, tone: 'text-emerald-400' },
                  { label: 'Cycle elapsed', value: `${cycleProgress}%`, detail: `Day ${todayDay} of ${totalDays}`, icon: CalendarRange, tone: 'text-cyan-400' },
                  { label: 'Active work', value: videos.filter(video => video.currentStage !== 'Done').length, detail: `${videos.filter(video => video.isBlocked).length} blocked`, icon: Film, tone: 'text-amber-400' },
                  { label: 'Readiness', value: readiness === 0 ? 'N/A' : `${readiness}%`, detail: readiness === 0 ? 'Record today’s check-in' : readiness < 55 ? 'Protect your capacity' : 'Capacity supports progress', icon: CircleGauge, tone: readiness === 0 ? 'text-zinc-600' : readiness < 55 ? 'text-rose-400' : 'text-violet-400' },
                ].map(card => <article key={card.label} className="rounded-xl border border-zinc-900 bg-zinc-950/75 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"><div className="flex items-center justify-between"><span className="text-[8px] font-mono tracking-wider text-zinc-600">{card.label.toUpperCase()}</span><card.icon className={`h-3.5 w-3.5 ${card.tone}`} /></div><strong className={`mt-2 block text-2xl font-mono ${card.tone}`}>{card.value}</strong><span className="mt-1 block text-[8px] text-zinc-600">{card.detail}</span></article>)}
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.75fr)]">
                <article className="relative overflow-hidden rounded-xl border border-emerald-900/50 bg-gradient-to-br from-emerald-950/25 via-zinc-950 to-zinc-950 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
                  <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-emerald-500/[0.045] blur-3xl" />
                  <div className="relative flex items-center gap-2 text-[8px] font-mono font-bold tracking-[0.18em] text-emerald-400"><Zap className="h-3.5 w-3.5" />BEST NEXT MOVE</div>
                  {priorityVideo ? <div className="relative mt-5"><div className="flex flex-wrap items-center gap-2"><span className={`rounded border px-2 py-1 text-[7px] font-mono font-bold ${priorityVideo.isBlocked ? 'border-rose-900/60 bg-rose-950/30 text-rose-400' : 'border-amber-900/50 bg-amber-950/20 text-amber-400'}`}>{priorityVideo.isBlocked ? 'BLOCKED' : priorityVideo.currentStage.toUpperCase()}</span><span className="text-[8px] font-mono text-zinc-600">{priorityVideo.channel.toUpperCase()} · {priorityVideo.contentLane.replace(priorityVideo.channel, '').trim()}</span></div><h3 className="mt-3 text-lg font-semibold text-white">{NEXT_MOVE[priorityVideo.currentStage]}</h3><p className="mt-1 text-sm text-zinc-400">{priorityVideo.title}</p><p className="mt-4 max-w-2xl text-[9px] leading-relaxed text-zinc-500">{priorityVideo.isBlocked ? `Clear the blocker: ${priorityVideo.blockerReason || 'this video cannot advance until its blocker is resolved'}.` : 'Completing the nearest meaningful production step protects posting consistency and reduces unfinished work competing for attention.'}</p><button onClick={() => openVideo(priorityVideo)} className="mt-5 flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2.5 text-[9px] font-mono font-black text-zinc-950 transition hover:bg-emerald-400">OPEN IN PRODUCTION <ArrowRight className="h-3.5 w-3.5" /></button></div> : <div className="relative mt-5"><h3 className="text-lg font-semibold text-white">Production queue is clear.</h3><p className="mt-2 text-[9px] text-zinc-500">Add the next topic when you are ready to build more buffer.</p><button onClick={() => { setFocusRequest({ type: 'add-video', lane: 'LearnDriven Shorts', requestId: Date.now() }); setSection('production'); }} className="mt-5 rounded-md border border-emerald-800/60 bg-emerald-950/30 px-4 py-2.5 text-[9px] font-mono font-bold text-emerald-400">ADD A TOPIC</button></div>}
                </article>

                <article className="rounded-xl border border-zinc-900 bg-zinc-950/75 p-4">
                  <div className="flex items-center justify-between"><div><span className="text-[8px] font-mono tracking-widest text-zinc-600">CHANNEL BUFFER</span><h3 className="mt-1 text-xs font-semibold text-white">Production readiness</h3></div><ListVideo className="h-4 w-4 text-cyan-400" /></div>
                  <div className="mt-4 space-y-3">{(['LearnDriven', 'DecodeWorthy'] as const).map(channel => { const counts = productionCounts(channel); return <div key={channel} className="rounded-lg border border-zinc-900 bg-black/20 p-3"><div className="mb-2 flex items-center justify-between text-[9px] font-mono font-bold text-zinc-300"><span>{channel.toUpperCase()}</span><TactileLED color={channel === 'LearnDriven' ? 'emerald' : 'blue'} importance="low" active /></div><div className="grid grid-cols-3 gap-2">{[['SHOT', counts.shot], ['EDITED', counts.edited], ['SCHEDULED', counts.scheduled]].map(([label, value]) => <div key={label} className="rounded border border-zinc-900 bg-zinc-900/25 py-2 text-center"><strong className="block text-sm font-mono text-zinc-200">{value}</strong><span className="text-[6px] font-mono text-zinc-600">{label}</span></div>)}</div></div>; })}</div>
                </article>
              </section>

              <section className="rounded-xl border border-zinc-900 bg-zinc-950/70 p-4">
                <div className="flex items-center justify-between"><div><span className="text-[8px] font-mono tracking-widest text-zinc-600">GOAL COVERAGE</span><h3 className="mt-1 text-xs font-semibold text-white">Every lane, one clear status</h3></div><button onClick={() => setSection('channels')} className="flex items-center gap-1 text-[8px] font-mono text-emerald-400 hover:text-emerald-300">VIEW CHANNELS <ArrowRight className="h-3 w-3" /></button></div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{laneHealth.map(lane => { const percent = lane.target === null ? null : Math.min(100, Math.round((lane.done / Math.max(1, lane.target)) * 100)); return <div key={lane.lane} className="rounded-lg border border-zinc-900 bg-black/20 p-3"><span className="block min-h-7 text-[8px] font-mono leading-snug text-zinc-400">{lane.lane.toUpperCase()}</span><div className="mt-2 flex items-end justify-between"><strong className="text-lg font-mono text-zinc-200">{lane.done}<small className="text-[8px] text-zinc-600">/{lane.target ?? 'N/A'}</small></strong><span className={`text-[7px] font-mono ${percent === null ? 'text-zinc-600' : percent >= cycleProgress ? 'text-emerald-400' : 'text-amber-400'}`}>{percent === null ? `${lane.active} TRACKED` : `${percent}%`}</span></div><div className="mt-2 h-1 rounded-full bg-zinc-900"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${percent || 0}%` }} /></div></div>; })}</div>
              </section>
            </div>
          )}

          {section === 'production' && <div className="space-y-3"><div className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-950/70 px-4 py-3"><div><span className="text-[8px] font-mono tracking-widest text-emerald-400">FOCUSED WORKSPACE</span><h3 className="text-sm font-semibold text-white">Production pipeline</h3></div><Video className="h-4 w-4 text-zinc-600" /></div><PipelineBoard videos={videos} goals={goals} revenueLevels={revenueLevels} onUpdateVideo={onUpdateVideo} onAddVideo={onAddVideo} onDeleteVideo={onDeleteVideo} focusRequest={focusRequest} /></div>}

          {section === 'channels' && <div className="space-y-3"><div className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-950/70 px-4 py-3"><div><span className="text-[8px] font-mono tracking-widest text-cyan-400">FOCUSED WORKSPACE</span><h3 className="text-sm font-semibold text-white">Channel pace and commitments</h3></div><Radio className="h-4 w-4 text-zinc-600" /></div><ChannelLanes videos={videos} goals={goals} todayDay={todayDay} totalDays={totalDays} /></div>}

          {section === 'wellbeing' && <div className="space-y-3"><div className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-950/70 px-4 py-3"><div><span className="text-[8px] font-mono tracking-widest text-violet-400">FOCUSED WORKSPACE</span><h3 className="text-sm font-semibold text-white">Capacity and wellbeing</h3></div><Activity className="h-4 w-4 text-zinc-600" /></div><DailyStateDashboard nodes={nodes} history={wellbeingHistory} onUpdateNode={onUpdateNode} /></div>}
        </div>
      </div>
    </div>
  );
}

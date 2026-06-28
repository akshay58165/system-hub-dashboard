import { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import { CalibrationNode, MonthlyGoals, ProductOpportunity, RevenueLevelConfig, VideoItem, WellbeingEntry } from './types';
import { migrateVideo } from './videoLogic';
import { supabase, useCloud } from './cloud';

export interface DashboardSnapshot {
  goals: MonthlyGoals;
  videos: VideoItem[];
  revenueLevels: RevenueLevelConfig[];
  productOpportunities: ProductOpportunity[];
  nodes: CalibrationNode[];
  wellbeingHistory: WellbeingEntry[];
}

export function normalizeMonthlyGoals(goals: MonthlyGoals): MonthlyGoals {
  const normalizeTarget = (value: number | null | undefined) => {
    if (value === null || value === undefined || value <= 0) return null;
    return value;
  };
  return {
    ...goals,
    ldShortsTarget: normalizeTarget(goals.ldShortsTarget),
    ldLongTarget: normalizeTarget(goals.ldLongTarget),
    ldMembersTarget: normalizeTarget(goals.ldMembersTarget),
    dwShortsTarget: normalizeTarget(goals.dwShortsTarget),
  };
}

export function normalizeRevenueLevels(levels: RevenueLevelConfig[]): RevenueLevelConfig[] {
  if (levels.some(level => level.level === 0.5)) return levels;
  return [{ level: 0.5, description: 'Neutral revenue potential', difficulty: 'Easy', requiredConditions: [], suggestedActions: [] }, ...levels];
}

type SyncArguments = DashboardSnapshot & {
  setGoals: Dispatch<SetStateAction<MonthlyGoals>>;
  setVideos: Dispatch<SetStateAction<VideoItem[]>>;
  setRevenueLevels: Dispatch<SetStateAction<RevenueLevelConfig[]>>;
  setProductOpportunities: Dispatch<SetStateAction<ProductOpportunity[]>>;
  setNodes: Dispatch<SetStateAction<CalibrationNode[]>>;
  setWellbeingHistory: Dispatch<SetStateAction<WellbeingEntry[]>>;
};

export function useDashboardCloudSync(args: SyncArguments) {
  const { userId, setSyncStatus } = useCloud();
  const ready = useRef(false);
  const latest = useRef<DashboardSnapshot>(args);
  latest.current = args;

  useEffect(() => {
    ready.current = false;
    if (!supabase || !userId) return;
    let cancelled = false;
    const load = async () => {
      setSyncStatus('loading');
      const { data, error } = await supabase.from('dashboard_state').select('state').eq('user_id', userId).maybeSingle();
      if (cancelled) return;
      if (error) { setSyncStatus('error'); return; }
      const cloudState = data?.state as Partial<DashboardSnapshot> | undefined;
      if (cloudState) {
        if (cloudState.goals) args.setGoals(normalizeMonthlyGoals(cloudState.goals));
        if (cloudState.videos) args.setVideos(cloudState.videos.map(migrateVideo));
        if (cloudState.revenueLevels) args.setRevenueLevels(normalizeRevenueLevels(cloudState.revenueLevels));
        if (cloudState.productOpportunities) args.setProductOpportunities(cloudState.productOpportunities);
        if (cloudState.nodes) args.setNodes(cloudState.nodes);
        if (cloudState.wellbeingHistory) args.setWellbeingHistory(cloudState.wellbeingHistory);
      } else {
        const { error: uploadError } = await supabase.from('dashboard_state').upsert({ user_id: userId, state: latest.current, updated_at: new Date().toISOString() });
        if (uploadError) { setSyncStatus('error'); return; }
      }
      ready.current = true;
      setSyncStatus('saved');
    };
    load();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!supabase || !userId || !ready.current) return;
    setSyncStatus('saving');
    const timer = window.setTimeout(async () => {
      const { error } = await supabase.from('dashboard_state').upsert({ user_id: userId, state: latest.current, updated_at: new Date().toISOString() });
      setSyncStatus(error ? 'error' : 'saved');
    }, 800);
    return () => window.clearTimeout(timer);
  }, [userId, args.goals, args.videos, args.revenueLevels, args.productOpportunities, args.nodes, args.wellbeingHistory]);
}

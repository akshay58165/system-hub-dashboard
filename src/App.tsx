import React, { useState, useEffect } from 'react';
import {
  MonthlyGoals, VideoItem, RevenueLevelConfig, ProductOpportunity, CalibrationNode, WellbeingEntry, DashboardActionTarget, WorkWindowSession
} from './types';
import Header from './components/Header';
import MissionControl from './components/MissionControl';
import StudioHealth from './components/StudioHealth';
import ChannelLanes from './components/ChannelLanes';
import PipelineBoard from './components/PipelineBoard';
import SmartActionPrompts from './components/SmartActionPrompts';
import SidePanel from './components/SidePanel';
import WorkWindowManager from './components/WorkWindowManager';
import DailyStateDashboard from './components/DailyStateDashboard';
import RawDataViewer from './components/RawDataViewer';
import MonthlySetupWizard from './components/MonthlySetupWizard';
import PriorityUpdates from './components/PriorityUpdates';
import ActionNavigator from './components/ActionNavigator';
import TimeAwareCoach from './components/TimeAwareCoach';
import CommandPalette from './components/CommandPalette';
import { AlertTriangle, Clapperboard, Clock, Cloud, Database, LogOut, Plus, RefreshCw, Search, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { calculateRevenueLevel, getLocalDateString, inferRevenueEligibility, migrateVideo } from './videoLogic';
import { normalizeMonthlyGoals, normalizeRevenueLevels, useDashboardCloudSync } from './cloudSync';
import { supabase, useCloud } from './cloud';

const LOCAL_STORAGE_KEY_GOALS = 'creator_os_goals';
const LOCAL_STORAGE_KEY_VIDEOS = 'creator_os_videos';
const LOCAL_STORAGE_KEY_REV_LEVELS = 'creator_os_rev_levels';
const LOCAL_STORAGE_KEY_PRODUCTS = 'creator_os_products';
const LOCAL_STORAGE_KEY_NODES = 'creator_os_nodes';
const LOCAL_STORAGE_KEY_WELLBEING_HISTORY = 'creator_os_wellbeing_history';
const LEGACY_DEMO_VIDEO_IDS = new Set(['vid_1', 'vid_2', 'vid_3', 'vid_4', 'vid_5', 'vid_6', 'vid_7', 'vid_8', 'vid_9']);
const LEGACY_GENERATED_TOPICS = new Set([
  'React 19 Server Actions: Ultimate Security Checklist',
  'The CSS @theme Guide (No More TailindConfig.js)',
  'Why I Am Leaving Prisma for Drizzle ORM in 2026',
  'Building a Full-Stack Local LLM App with WebGPU',
  'Master CSS Container Queries in 50 Seconds',
  'We Built a High-Speed Rust Compiler in 80 Lines',
  'Why Bun is Actually Faster than Node.js (Real Benchmarks)',
  'The JavaScript Feature Nobody Knows Exists',
  'How Hackers Steal Your LocalStorage Session Keys',
  'Writing Assembly on an iPad: The Brutalist Guide'
]);

const INITIAL_GOALS: MonthlyGoals = {
  month: '2026-06',
  cycleStartDate: '2026-06-01',
  cycleEndDate: '2026-06-30',
  intensityMode: 'Balanced',
  workdaysAvailable: 22,
  plannedBreakDays: 8,
  hoursPerDay: 6,
  workWindowStart: '11:00',
  workWindowEnd: '20:00',
  enabledRevenueLevels: [0.5, 1, 2, 3, 4, 5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 20],
  brandCollabsTargeted: true,
  longVideoAbove8MinTargeted: true,
  viralTopicsTargeted: true,
  productTagsAllowed: true,
  pinnedCommentsAllowed: true,
  ldShortsTarget: null,
  ldLongTarget: null,
  ldMembersTarget: null,
  dwShortsTarget: null,
  ldLongWeeklyTarget: 1,
  ldMembersWeeklyTarget: 1,
  dwShortsScheduleType: 'Weekly'
};

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

const INITIAL_VIDEOS: VideoItem[] = [
  {
    id: 'vid_1',
    channel: 'LearnDriven',
    contentLane: 'LearnDriven Long Videos',
    title: 'Intro to React 19 Server Components',
    revenueLevelTarget: 8.5,
    createdAt: daysAgo(6),
    expectedPublishDate: '2026-06-28',
    pipeline: {
      topic: 'Done',
      script: 'Done',
      shoot: 'Done',
      edit: 'In progress',
      thumbnail: 'Not started',
      schedule: 'Not started'
    },
    currentStage: 'Edit',
    isBlocked: false,
    productTagStatus: 'Tagged',
    pinnedCommentStatus: 'None',
    membersPromotionStatus: 'None',
    brandCollabStatus: 'None'
  },
  {
    id: 'vid_2',
    channel: 'LearnDriven',
    contentLane: 'LearnDriven Shorts',
    title: 'CSS Container Queries are Mind-Blowing!',
    revenueLevelTarget: 3,
    createdAt: daysAgo(6),
    expectedPublishDate: '2026-06-25',
    actualScheduledDate: '2026-06-25',
    pipeline: {
      topic: 'Done',
      script: 'Done',
      shoot: 'Done',
      edit: 'Done',
      schedule: 'Done'
    },
    currentStage: 'Done',
    isBlocked: false,
    productTagStatus: 'Tagged',
    pinnedCommentStatus: 'None',
    membersPromotionStatus: 'None',
    brandCollabStatus: 'None'
  },
  {
    id: 'vid_3',
    channel: 'LearnDriven',
    contentLane: 'LearnDriven Long Videos',
    title: 'How to Deploy Express to Cloud Run',
    revenueLevelTarget: 7,
    createdAt: daysAgo(5),
    expectedPublishDate: '2026-06-26',
    actualScheduledDate: '2026-06-26',
    pipeline: {
      topic: 'Done',
      script: 'Done',
      shoot: 'Done',
      edit: 'Done',
      thumbnail: 'Done',
      schedule: 'Done'
    },
    currentStage: 'Done',
    isBlocked: false,
    productTagStatus: 'Available',
    pinnedCommentStatus: 'None',
    membersPromotionStatus: 'None',
    brandCollabStatus: 'None'
  },
  {
    id: 'vid_4',
    channel: 'DecodeWorthy',
    contentLane: 'DecodeWorthy Shorts',
    title: 'Is Rust Actually Faster than JavaScript?',
    revenueLevelTarget: 2,
    createdAt: daysAgo(4),
    expectedPublishDate: '2026-06-28',
    pipeline: {
      topic: 'Done',
      script: 'Done',
      shoot: 'Done',
      edit: 'In progress',
      schedule: 'Not started'
    },
    currentStage: 'Edit',
    isBlocked: false,
    productTagStatus: 'Available',
    pinnedCommentStatus: 'None',
    membersPromotionStatus: 'None',
    brandCollabStatus: 'None'
  },
  {
    id: 'vid_5',
    channel: 'DecodeWorthy',
    contentLane: 'DecodeWorthy Shorts',
    title: 'We Built a Real-Time Compiler in 100 Lines of C',
    revenueLevelTarget: 3,
    createdAt: daysAgo(3),
    expectedPublishDate: '2026-06-29',
    pipeline: {
      topic: 'Done',
      script: 'In progress',
      shoot: 'Not started',
      edit: 'Not started',
      schedule: 'Not started'
    },
    currentStage: 'Script',
    isBlocked: false,
    productTagStatus: 'Available',
    pinnedCommentStatus: 'None',
    membersPromotionStatus: 'None',
    brandCollabStatus: 'None'
  },
  {
    id: 'vid_6',
    channel: 'LearnDriven',
    contentLane: 'LearnDriven Long Videos',
    title: 'How I Accidentally Drained my AWS Wallet',
    revenueLevelTarget: 9.5,
    createdAt: daysAgo(3),
    expectedPublishDate: '2026-06-29',
    pipeline: {
      topic: 'Done',
      script: 'Done',
      shoot: 'Done',
      edit: 'Done',
      thumbnail: 'In progress',
      schedule: 'Not started'
    },
    currentStage: 'Thumbnail',
    isBlocked: false,
    productTagStatus: 'Tagged',
    pinnedCommentStatus: 'None',
    membersPromotionStatus: 'None',
    brandCollabStatus: 'None'
  },
  {
    id: 'vid_7',
    channel: 'LearnDriven',
    contentLane: 'LearnDriven Members-only Videos',
    title: 'My Secret System to Edit Videos 2x Faster',
    revenueLevelTarget: 5,
    createdAt: daysAgo(2),
    expectedPublishDate: '2026-06-30',
    pipeline: {
      topic: 'Done',
      script: 'Done',
      shoot: 'Blocked',
      edit: 'Not started',
      schedule: 'Not started'
    },
    currentStage: 'Shoot',
    isBlocked: true,
    blockerReason: 'Main camera SD card corrupted',
    blockerSeverity: 'critical',
    productTagStatus: 'Unsuitable',
    pinnedCommentStatus: 'None',
    membersPromotionStatus: 'None',
    brandCollabStatus: 'None'
  },
  {
    id: 'vid_8',
    channel: 'LearnDriven',
    contentLane: 'LearnDriven Shorts',
    title: 'Next.js App Router vs Pages Router in 2026',
    revenueLevelTarget: 1,
    createdAt: daysAgo(1),
    expectedPublishDate: '2026-06-30',
    pipeline: {
      topic: 'Done',
      script: 'In progress',
      shoot: 'Not started',
      edit: 'Not started',
      schedule: 'Not started'
    },
    currentStage: 'Script',
    isBlocked: false,
    productTagStatus: 'Available',
    pinnedCommentStatus: 'None',
    membersPromotionStatus: 'None',
    brandCollabStatus: 'None'
  },
  {
    id: 'vid_9',
    channel: 'LearnDriven',
    contentLane: 'LearnDriven Long Videos',
    title: 'Building Creator.OS from Scratch',
    revenueLevelTarget: 20,
    createdAt: daysAgo(0),
    expectedPublishDate: '2026-07-02',
    pipeline: {
      topic: 'Done',
      script: 'Done',
      shoot: 'In progress',
      edit: 'Not started',
      thumbnail: 'Not started',
      schedule: 'Not started'
    },
    currentStage: 'Shoot',
    isBlocked: false,
    productTagStatus: 'Available',
    pinnedCommentStatus: 'None',
    membersPromotionStatus: 'None',
    brandCollabStatus: 'None'
  }
];

const INITIAL_REVENUE_CONFIGS: RevenueLevelConfig[] = [
  { level: 0.5, description: 'Neutral revenue potential', difficulty: 'Easy', requiredConditions: [], suggestedActions: [] },
  { level: 1, description: 'Short video, cold topic', difficulty: 'Easy', requiredConditions: [], suggestedActions: [] },
  { level: 2, description: 'Short video, viral topic', difficulty: 'Medium', requiredConditions: [], suggestedActions: [] },
  { level: 3, description: 'Viral short video + tagged product', difficulty: 'Medium', requiredConditions: [], suggestedActions: [] },
  { level: 4, description: 'Viral short + relevant product + pinned promotion', difficulty: 'Hard', requiredConditions: [], suggestedActions: [] },
  { level: 5, description: 'Members-only subscription value (high risk, high reward)', difficulty: 'Hard', requiredConditions: [], suggestedActions: [] },
  { level: 6, description: 'Long video under 8 minutes, steady topic', difficulty: 'Medium', requiredConditions: [], suggestedActions: [] },
  { level: 6.5, description: 'Long video under 8 minutes with a tagged product', difficulty: 'Medium', requiredConditions: [], suggestedActions: [] },
  { level: 7, description: 'Long video over 8 minutes, steady topic', difficulty: 'Hard', requiredConditions: [], suggestedActions: [] },
  { level: 7.5, description: 'Long video over 8 minutes with a tagged product', difficulty: 'Hard', requiredConditions: [], suggestedActions: [] },
  { level: 8, description: 'Long video under 8 minutes with strong reach potential', difficulty: 'Hard', requiredConditions: [], suggestedActions: [] },
  { level: 8.5, description: 'Strong-reach long video under 8 minutes with a tagged product', difficulty: 'Hard', requiredConditions: [], suggestedActions: [] },
  { level: 9, description: 'Long video over 8 minutes with strong reach potential', difficulty: 'Very hard', requiredConditions: [], suggestedActions: [] },
  { level: 9.5, description: 'Strong-reach long video over 8 minutes with a tagged product', difficulty: 'Very hard', requiredConditions: [], suggestedActions: [] },
  { level: 10, description: 'Breakout video attempt', difficulty: 'Unpredictable', requiredConditions: [], suggestedActions: [] },
  { level: 20, description: 'Brand collaboration attached', difficulty: 'Very hard', requiredConditions: [], suggestedActions: [] }
];

const INITIAL_PRODUCT_OPPORTUNITIES: ProductOpportunity[] = [
  { id: 'p_1', topic: 'Intro to React 19 Server Components', channel: 'LearnDriven', productCategory: 'Creator or Tech Desk Accessories', relevanceScore: 8, revenueUpgrade: 'Level 8 to Level 8.5', forcedRisk: 'Low', suggestedTag: 'SSD or Editing Accessories', status: 'Pending' },
  { id: 'p_2', topic: 'Is Rust Actually Faster than JavaScript?', channel: 'DecodeWorthy', productCategory: 'Science/Education Books', relevanceScore: 6, revenueUpgrade: 'Level 2 to Level 3', forcedRisk: 'Medium', suggestedTag: 'Hardware Architecture Books', status: 'Pending' },
  { id: 'p_3', topic: 'We Built a Real-Time Compiler in 100 Lines of C', channel: 'DecodeWorthy', productCategory: 'Creator desk gear', relevanceScore: 9, revenueUpgrade: 'Level 2 to Level 3', forcedRisk: 'Low', suggestedTag: 'Mechanical Coding Keyboard', status: 'Pending' }
];

const INITIAL_CALIBRATION_NODES: CalibrationNode[] = [
  { id: 'sleep', label: 'SLEEP', value: 0, color: '#818cf8' },
  { id: 'freshness', label: 'FRESHNESS', value: 0, color: '#22d3ee' },
  { id: 'eyeComfort', label: 'EYE COMFORT', value: 0, color: '#38bdf8' },
  { id: 'pleasantness', label: 'PLEASANTNESS', value: 0, color: '#2dd4bf' },
  { id: 'nutrition', label: 'NUTRITION', value: 0, color: '#f59e0b' },
  { id: 'hydration', label: 'HYDRATION', value: 0, color: '#0ea5e9' },
  { id: 'physicalComfort', label: 'PHYSICAL COMFORT', value: 0, color: '#10b981' },
  { id: 'mood', label: 'MOOD', value: 0, color: '#f43f5e' },
  { id: 'mindfulness', label: 'MINDFULNESS', value: 0, color: '#a78bfa' },
  { id: 'energy', label: 'ENERGY', value: 0, color: '#f43f5e' },
  { id: 'finances', label: 'FINANCES', value: 0, color: '#fbbf24' },
  { id: 'environment', label: 'ENVIRONMENT', value: 0, color: '#34d399' },
  { id: 'endorphins', label: 'ENDORPHINS', value: 0, color: '#fb7185' }
];

const SAMPLE_WELLBEING_HISTORY: WellbeingEntry[] = (() => {
  const today = getLocalDateString();
  const values: Record<string, number> = {
    sleep: 7, freshness: 8, eyeComfort: 6, pleasantness: 8, nutrition: 7,
    hydration: 6, physicalComfort: 7, mood: 8, mindfulness: 6, energy: 7,
    finances: 7, environment: 8, endorphins: 7
  };
  return Object.entries(values).map(([nodeId, value], idx) => ({
    id: `wb_sample_${idx}`,
    nodeId,
    value,
    timestamp: `${today}T0${8 + idx}:30:00.000Z`
  }));
})();

const SAMPLE_WORK_SESSIONS: WorkWindowSession[] = (() => {
  const today = getLocalDateString();
  return [
    {
      id: 'session_sample_1',
      date: today,
      startTime: '09:00',
      endTime: '12:00',
      stage: 'Script',
      isActive: false,
      isPaused: false,
      pausePeriods: [
        { startTime: `${today}T10:15:00.000Z`, endTime: `${today}T10:25:00.000Z` }
      ]
    },
    {
      id: 'session_sample_2',
      date: today,
      startTime: '13:30',
      endTime: '16:00',
      stage: 'Edit',
      isActive: false,
      isPaused: false,
      pausePeriods: []
    }
  ];
})();

function migrateWellbeingNodes(savedNodes: CalibrationNode[]): CalibrationNode[] {
  const legacyValues: Record<string, number> = {};
  savedNodes.forEach(node => { legacyValues[node.id] = node.value; });
  const fallbackMap: Record<string, string> = { freshness: 'fresh', eyeComfort: 'eyes', nutrition: 'fuel', hydration: 'fuel', physicalComfort: 'body', finances: 'finance', environment: 'env', endorphins: 'vibe' };
  return INITIAL_CALIBRATION_NODES.map(node => ({ ...node, value: legacyValues[node.id] ?? legacyValues[fallbackMap[node.id]] ?? node.value }));
}

// EFFORT MATRIX DEFINITION VALUES
const EFFORT_CONFIG = {
  shorts: { topic: 1, script: 2, shoot: 2, edit: 3, schedule: 0.5 },
  members: { topic: 1, script: 2.5, shoot: 2, edit: 2.5, schedule: 0.5 },
  long: { topic: 2, script: 5, shoot: 4, edit: 8, thumbnail: 3, schedule: 1 },
  dwShorts: { topic: 1.5, script: 2.5, shoot: 2, edit: 3, schedule: 0.5 }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'mission' | 'health'>('mission');
  const [colorTheme, setColorTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('creator_os_theme') === 'light' ? 'light' : 'dark');
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isZoneChoiceOpen, setIsZoneChoiceOpen] = useState(false);
  const [zoneSetupMode, setZoneSetupMode] = useState<'edit' | 'new'>('edit');
  const [wizardGoals, setWizardGoals] = useState<MonthlyGoals>(INITIAL_GOALS);
  const [actionTarget, setActionTarget] = useState<DashboardActionTarget | null>(null);
  const [dailyDate, setDailyDate] = useState(() => getLocalDateString());
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [topBarTime, setTopBarTime] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const updateClock = () => setTopBarTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('creator_os_theme', colorTheme);
    document.documentElement.classList.toggle('theme-light', colorTheme === 'light');
  }, [colorTheme]);

  // Core Database States
  const [goals, setGoals] = useState<MonthlyGoals>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_GOALS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.cycleStartDate || !parsed.cycleEndDate) {
        parsed.cycleStartDate = '2026-06-01';
        parsed.cycleEndDate = '2026-06-30';
      }
      return normalizeMonthlyGoals(parsed);
    }
    return INITIAL_GOALS;
  });

  const [videos, setVideos] = useState<VideoItem[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_VIDEOS);
    if (!saved) return INITIAL_VIDEOS.map(migrateVideo);
    const source: VideoItem[] = JSON.parse(saved);
    return source
      .filter(video => !LEGACY_GENERATED_TOPICS.has(video.title))
      .map(migrateVideo);
  });

  const [revenueLevels, setRevenueLevels] = useState<RevenueLevelConfig[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_REV_LEVELS);
    return saved ? normalizeRevenueLevels(JSON.parse(saved)) : INITIAL_REVENUE_CONFIGS;
  });

  const [productOpportunities, setProductOpportunities] = useState<ProductOpportunity[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PRODUCTS);
    const source: ProductOpportunity[] = saved ? JSON.parse(saved) : [];
    return source.filter(opportunity => !['p_1', 'p_2', 'p_3'].includes(opportunity.id));
  });

  const [nodes, setNodes] = useState<CalibrationNode[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_NODES);
    return saved ? migrateWellbeingNodes(JSON.parse(saved)) : INITIAL_CALIBRATION_NODES;
  });

  const [wellbeingHistory, setWellbeingHistory] = useState<WellbeingEntry[]>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_WELLBEING_HISTORY);
    return saved ? JSON.parse(saved) : SAMPLE_WELLBEING_HISTORY;
  });

  const [workSessions, setWorkSessions] = useState<WorkWindowSession[]>(() => {
    const saved = localStorage.getItem('creator_os_work_sessions');
    if (!saved) return SAMPLE_WORK_SESSIONS;
    const sessions: WorkWindowSession[] = JSON.parse(saved);
    const today = new Date().toISOString().split('T')[0];
    return sessions.filter(s => s.date === today);
  });

  const { email, userId, syncStatus, signOut } = useCloud();
  useDashboardCloudSync({ goals, videos, revenueLevels, productOpportunities, nodes, wellbeingHistory, setGoals, setVideos, setRevenueLevels, setProductOpportunities, setNodes, setWellbeingHistory });

  useEffect(() => {
    const timer = window.setInterval(() => setDailyDate(getLocalDateString()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (syncStatus === 'loading') return;
    const todayEntries = wellbeingHistory
      .filter(entry => getLocalDateString(new Date(entry.timestamp)) === dailyDate)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    setNodes(current => {
      const next = current.map(node => ({ ...node, value: todayEntries.find(entry => entry.nodeId === node.id)?.value ?? 0 }));
      return next.every((node, index) => node.value === current[index]?.value) ? current : next;
    });
  }, [dailyDate, wellbeingHistory, syncStatus]);

  // Cinematic reset triggers
  const [isResetting, setIsResetting] = useState(false);
  const [resetLogs, setResetLogs] = useState<string[]>([]);
  const [isFactoryResetModalOpen, setIsFactoryResetModalOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');

  // Persistent storage synchronizations
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_GOALS, JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_VIDEOS, JSON.stringify(videos));
  }, [videos]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_REV_LEVELS, JSON.stringify(revenueLevels));
  }, [revenueLevels]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_PRODUCTS, JSON.stringify(productOpportunities));
  }, [productOpportunities]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_NODES, JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_WELLBEING_HISTORY, JSON.stringify(wellbeingHistory));
  }, [wellbeingHistory]);

  useEffect(() => {
    localStorage.setItem('creator_os_work_sessions', JSON.stringify(workSessions));
  }, [workSessions]);

  // Update active status of work sessions every minute
  useEffect(() => {
    const updateActiveSessions = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setWorkSessions(prev => prev.map(session => ({
        ...session,
        isActive: session.startTime <= currentTime && currentTime <= session.endTime
      })));
    };
    updateActiveSessions();
    const timer = window.setInterval(updateActiveSessions, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // CALCULATION LOGIC SUITE
  const getCycleStats = () => {
    const start = new Date(goals.cycleStartDate || '2026-06-01');
    const end = new Date(goals.cycleEndDate || '2026-06-30');
    
    const today = new Date();
    const isMockYear = today.getFullYear() === 2026;
    const current = isMockYear ? today : new Date('2026-06-27');
    
    const dStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const dEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const dCurrent = new Date(current.getFullYear(), current.getMonth(), current.getDate());

    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDaysCount = Math.round((dEnd.getTime() - dStart.getTime()) / msPerDay) + 1;
    
    let daysRemainingCount = 0;
    if (dCurrent < dStart) {
      daysRemainingCount = totalDaysCount;
    } else if (dCurrent > dEnd) {
      daysRemainingCount = 0;
    } else {
      daysRemainingCount = Math.round((dEnd.getTime() - dCurrent.getTime()) / msPerDay);
    }

    const elapsedDays = Math.max(1, totalDaysCount - daysRemainingCount);

    return {
      totalDays: Math.max(1, totalDaysCount),
      daysRemaining: daysRemainingCount,
      elapsedDays,
      todayDay: elapsedDays,
      todayStr: getLocalDateString(dCurrent)
    };
  };

  const cycleStats = getCycleStats();
  const todayDay = cycleStats.todayDay;
  const totalDays = cycleStats.totalDays;
  const daysRemaining = cycleStats.daysRemaining;
  const todayStr = cycleStats.todayStr;

  // Total videos planned across lanes
  const totalPlanned = (goals.ldShortsTarget ?? 0) + (goals.ldLongTarget ?? 0) + (goals.ldMembersTarget ?? 0) + (goals.dwShortsTarget ?? 0);
  const totalCompleted = videos.filter(v => v.currentStage === 'Done').length;
  const totalRemaining = Math.max(0, totalPlanned - totalCompleted);

  const requiredDailyPace = totalPlanned / (goals.workdaysAvailable || 22);
  const actualDailyPace = totalCompleted / todayDay;

  // Compute scheduled future buffer count across all lanes
  const bufferCount = videos.filter(v => 
    v.currentStage === 'Done' && v.actualScheduledDate && v.actualScheduledDate > todayStr
  ).length;

  const requiredPostingPace = totalPlanned / totalDays; // pacing per day in general calendar
  const safeBreakDays = requiredPostingPace > 0 ? Math.round(bufferCount / requiredPostingPace) : 0;

  // Effort value computations
  const calculateRemainingEffort = () => {
    let sum = 0;
    videos.forEach(v => {
      if (v.currentStage === 'Done') return;

      const isLong = v.contentLane === 'LearnDriven Long Videos';
      const isMembers = v.contentLane === 'LearnDriven Members-only Videos';
      const isShort = v.contentLane === 'LearnDriven Shorts';
      const isDwShort = v.contentLane === 'DecodeWorthy Shorts';

      const config = isLong ? EFFORT_CONFIG.long :
                     isMembers ? EFFORT_CONFIG.members :
                     isShort ? EFFORT_CONFIG.shorts : EFFORT_CONFIG.dwShorts;

      // Add points for each remaining stage
      if (v.pipeline.topic !== 'Done') sum += config.topic;
      if (v.pipeline.script !== 'Done') sum += config.script;
      if (v.pipeline.shoot !== 'Done') sum += config.shoot;
      if (v.pipeline.edit !== 'Done') sum += config.edit;
      if (isLong && v.pipeline.thumbnail !== 'Done') sum += EFFORT_CONFIG.long.thumbnail;
      if (v.pipeline.schedule !== 'Done') sum += config.schedule;
    });
    return sum;
  };

  const remainingEffort = calculateRemainingEffort();
  const workdaysRemaining = Math.max(1, goals.workdaysAvailable - Math.round(goals.workdaysAvailable * (todayDay / totalDays)));
  const requiredEffortToday = remainingEffort / workdaysRemaining;

  // Effort levels status categorization
  const getPressureLevel = () => {
    if (requiredEffortToday === 0) return 'Low';
    if (requiredEffortToday <= 2) return 'Stable';
    if (requiredEffortToday <= 5) return 'Pressure';
    return 'Critical';
  };

  const pressureLevel = getPressureLevel();

  // SYSTEM MODIFIERS
  const handleUpdateVideo = (updated: VideoItem) => {
    // Bidirectional sync: if title changed, update matching product opportunity topic
    const oldVideo = videos.find(v => v.id === updated.id);
    if (oldVideo && oldVideo.title !== updated.title) {
      setProductOpportunities(prev => prev.map(opp => 
        opp.topic === oldVideo.title ? { ...opp, topic: updated.title } : opp
      ));
    }
    setVideos(prev => prev.map(v => v.id === updated.id ? migrateVideo(updated) : v));
  };

  const handleUpdateProductOpportunity = (updated: ProductOpportunity) => {
    // Bidirectional sync: if topic changed, update matching video title
    const oldOpp = productOpportunities.find(o => o.id === updated.id);
    if (oldOpp && oldOpp.topic !== updated.topic) {
      setVideos(prev => prev.map(vid => 
        vid.title === oldOpp.topic ? { ...vid, title: updated.topic } : vid
      ));
    }
    setProductOpportunities(prev => prev.map(o => o.id === updated.id ? updated : o));
  };

  const handleAddProductOpportunity = (newOpp: Omit<ProductOpportunity, 'id'>) => {
    const id = `opp_${Date.now()}`;
    const item: ProductOpportunity = { ...newOpp, id };
    setProductOpportunities(prev => [...prev, item]);
  };

  const handleDeleteProductOpportunity = (id: string) => {
    setProductOpportunities(prev => prev.filter(o => o.id !== id));
  };

  const handleAddVideo = (newVid: Omit<VideoItem, 'id' | 'completionPercentage'>) => {
    const id = `vid_${Date.now()}`;
    const item = migrateVideo({
      ...newVid,
      id,
      createdAt: newVid.createdAt || getLocalDateString()
    });
    setVideos(prev => [...prev, item]);
  };

  const handleDeleteVideo = (id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id));
  };

  const handleUpdateBiometric = (nodeId: string, newValue: number, record = true) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, value: newValue } : n));
    if (record) {
      setWellbeingHistory(prev => {
        const now = new Date();
        const lastIndex = prev.findLastIndex(entry => entry.nodeId === nodeId);
        const last = lastIndex >= 0 ? prev[lastIndex] : null;
        const isSameAdjustment = last && now.getTime() - new Date(last.timestamp).getTime() < 120000;
        const nextEntry = { id: `state_${Date.now()}_${nodeId}`, nodeId, value: newValue, timestamp: now.toISOString() };
        if (!isSameAdjustment) return [...prev, nextEntry];
        return prev.map((entry, index) => index === lastIndex ? { ...nextEntry, id: entry.id } : entry);
      });
    }
  };

  const handleApplyUpgrade = (video: VideoItem, type: 'product' | 'members' | 'brand') => {
    if (type === 'product' && goals.productTagsAllowed) {
      const revenueEligibility = { ...inferRevenueEligibility(video), productTag: true };
      handleUpdateVideo({
        ...video,
        productTagStatus: 'Tagged',
        revenueEligibility,
        revenueLevelTarget: calculateRevenueLevel(video.contentLane, revenueEligibility)
      });
    }
  };

  const navigateToAction = (target: DashboardActionTarget) => {
    const nextTarget = { ...target, requestId: Date.now() } as DashboardActionTarget;
    if (target.type === 'health') {
      setActiveTab('health');
      window.setTimeout(() => document.getElementById('wellbeing-dashboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      return;
    }
    setActiveTab('mission');
    setActionTarget(nextTarget);
    window.setTimeout(() => document.getElementById('pipeline-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  };

  const navigateToInventory = () => {
    setActiveTab('mission');
    window.setTimeout(() => document.getElementById('inventory-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 140);
  };

  const openZoneSetup = () => {
    const hasActiveZone = goals.workdaysAvailable > 0 || ((goals.ldShortsTarget ?? 0) + (goals.ldLongTarget ?? 0) + (goals.ldMembersTarget ?? 0) + (goals.dwShortsTarget ?? 0)) > 0;
    if (hasActiveZone) {
      setIsZoneChoiceOpen(true);
    } else {
      setZoneSetupMode('new');
      setWizardGoals(goals);
      setIsSetupOpen(true);
    }
  };

  const startZoneSetup = (mode: 'edit' | 'new') => {
    setZoneSetupMode(mode);
    setWizardGoals(mode === 'edit' ? goals : { ...INITIAL_GOALS, month: getLocalDateString().slice(0, 7) });
    setIsZoneChoiceOpen(false);
    setIsSetupOpen(true);
  };

  const saveZone = (nextGoals: MonthlyGoals) => {
    if (zoneSetupMode === 'new') {
      setVideos([]);
      setProductOpportunities([]);
    }
    setGoals(nextGoals);
    setIsSetupOpen(false);
  };

  // Trigger reset verification
  const handleTriggerResetModal = () => {
    setIsFactoryResetModalOpen(true);
    setResetPassword('');
    setResetPasswordError('');
  };

  // Verify correct decryption password
  const handleVerifyResetPassword = async () => {
    if (resetPassword === 'itisakshaysorder') {
      if (supabase && userId) {
        const { error } = await supabase.from('dashboard_state').delete().eq('user_id', userId);
        if (error) {
          setResetPasswordError('CLOUD DATABASE RESET FAILED. NOTHING WAS DELETED.');
          return;
        }
      }
      setIsFactoryResetModalOpen(false);
      handleFactoryHardReset();
    } else {
      setResetPasswordError('INCORRECT RESET PASSWORD');
    }
  };

  // Cinematic factory reset executor
  const handleFactoryHardReset = () => {
    setIsResetting(true);
    setResetLogs([]);

    const logs = [
      '>>> STARTING COMPLETE WORKSPACE RESET...',
      '>>> CHECKING RESET PASSWORD...',
      '>>> PASSWORD ACCEPTED.',
      '>>> CLEARING ACTIVE VIDEO WORKFLOWS...',
      '>>> CLEARING DASHBOARD METRICS... OK',
      '>>> CLEARING SAVED BROWSER DATA... OK',
      '>>> WIPING YOUR CLOUD DATABASE RECORD... OK',
      '>>> DELETING ALL VIDEO RECORDS... OK',
      '>>> RESETTING WELLBEING SCORES... OK',
      '>>> RESETTING MONTHLY GOALS... OK',
      '>>> RESET COMPLETE. WORKSPACE IS READY FOR A NEW PLAN.',
    ];

    logs.forEach((log, idx) => {
      setTimeout(() => {
        setResetLogs(prev => [...prev, log]);
      }, (idx + 1) * 320);
    });

    setTimeout(() => {
      const resetGoals: MonthlyGoals = {
        month: '2026-06',
        cycleStartDate: '2026-06-01',
        cycleEndDate: '2026-06-30',
        intensityMode: 'Balanced',
        workdaysAvailable: 0,
        plannedBreakDays: 0,
        hoursPerDay: 0,
        workWindowStart: '00:00',
        workWindowEnd: '00:00',
        enabledRevenueLevels: [],
        brandCollabsTargeted: false,
        longVideoAbove8MinTargeted: false,
        viralTopicsTargeted: false,
        productTagsAllowed: false,
        pinnedCommentsAllowed: false,
        ldShortsTarget: null,
        ldLongTarget: null,
        ldMembersTarget: null,
        dwShortsTarget: null,
        ldLongWeeklyTarget: 0,
        ldMembersWeeklyTarget: 0,
        dwShortsScheduleType: 'Weekly'
      };

      setGoals(resetGoals);
      setVideos([]);
      setRevenueLevels(INITIAL_REVENUE_CONFIGS);
      setProductOpportunities([]);
      setNodes(INITIAL_CALIBRATION_NODES.map(n => ({ ...n, value: 0 })));
      setWellbeingHistory([]);
      [LOCAL_STORAGE_KEY_GOALS, LOCAL_STORAGE_KEY_VIDEOS, LOCAL_STORAGE_KEY_REV_LEVELS, LOCAL_STORAGE_KEY_PRODUCTS, LOCAL_STORAGE_KEY_NODES, LOCAL_STORAGE_KEY_WELLBEING_HISTORY].forEach(key => localStorage.removeItem(key));
      setIsResetting(false);
    }, 3200);
  };

  return (
    <div className="min-h-screen bg-[#060607] text-zinc-300 relative bg-grid-pattern selection:bg-emerald-500/20 selection:text-emerald-400">
      {/* Reset matrix/glitch effect overlay */}
      <AnimatePresence>
        {isResetting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6 font-mono scanlines"
          >
            <div className="max-w-xl w-full bg-zinc-950 border border-red-500/30 p-6 rounded shadow-[0_0_50px_rgba(239,68,68,0.2)]">
              <div className="flex items-center gap-2 text-red-500 font-bold mb-4 border-b border-red-900/40 pb-3">
                <AlertTriangle className="h-5 w-5 animate-bounce" />
                RESETTING ALL WORKSPACE DATA
              </div>
              
              <div className="space-y-2 text-xs text-zinc-400 min-h-[160px]">
                {resetLogs.map((log, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={log.includes('OK') ? 'text-emerald-400' : log.includes('WARNING') ? 'text-red-500' : 'text-zinc-300'}
                  >
                    {log}
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between text-[10px] text-zinc-600 border-t border-zinc-900 pt-3">
                <span>OS CODE: a224a13e-465f-45cf-81e5-df247bac8593</span>
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin text-red-500" />
                  PREPARING EMPTY WORKSPACE...
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full flex flex-col min-h-screen bg-zinc-950/20 shadow-2xl">
        {/* Sticky Command Bar */}
        <header className="border-b border-zinc-850 bg-zinc-950 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <span className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-emerald-400 font-bold tracking-tight text-xs font-mono">COS</span>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">Creator OS</h1>
                <p className="text-[10px] text-zinc-500 font-mono hidden sm:block">Private production workspace</p>
              </div>
            </div>

            <div className="flex-1 max-w-sm hidden md:block">
              <button
                onClick={() => setIsPaletteOpen(true)}
                className="w-full flex items-center justify-between gap-3 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-lg transition text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Search videos or actions...</span>
                </div>
                <span className="text-[9px] text-zinc-600 font-semibold uppercase bg-zinc-950 px-1.5 py-0.5 border border-zinc-850 rounded">⌘K</span>
              </button>
            </div>

            <div className="flex items-center gap-4 shrink-0 font-mono text-[11px] text-zinc-400">
              <div className="flex items-center gap-1.5 text-zinc-500 bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded-lg">
                <Clock className="h-3.5 w-3.5" />
                <span>{topBarTime || 'Loading...'}</span>
              </div>
              <div className="hidden lg:flex items-center gap-1.5 text-zinc-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>Workspace Nominal</span>
              </div>
            </div>
          </div>
        </header>

        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          videos={videos}
          onSetTab={setActiveTab}
          onAddTopic={() => navigateToAction({ type: 'add-video', lane: 'LearnDriven Shorts' })}
          onOpenPipeline={() => navigateToAction({ type: 'pipeline' })}
          onOpenVideo={(videoId) => navigateToAction({ type: 'video', videoId })}
        />

        {/* Navigation / Header Strip */}
        <Header
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          openSetupWizard={openZoneSetup}
          isHardReset={isResetting}
          selectedMonth={goals.month}
          intensityMode={goals.intensityMode}
          cycleStartDate={goals.cycleStartDate}
          cycleEndDate={goals.cycleEndDate}
          totalDays={totalDays}
          daysRemaining={daysRemaining}
          colorTheme={colorTheme}
          toggleColorTheme={() => setColorTheme(theme => theme === 'dark' ? 'light' : 'dark')}
        />

        {/* Live Scrolling Suggestions Feed */}
        <PriorityUpdates 
          videos={videos} 
          productOpportunities={productOpportunities} 
          goals={goals} 
          nodes={nodes}
          onNavigate={navigateToAction}
        />

        <TimeAwareCoach
          goals={goals}
          nodes={nodes}
          wellbeingHistory={wellbeingHistory}
          onNavigate={navigateToAction}
        />

        {/* Quick action dock */}
        <div className="border-b border-zinc-900 bg-zinc-950 px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2 font-mono">
            <span className="mr-1 text-[8px] font-bold tracking-[0.16em] text-zinc-600">QUICK ACTIONS</span>
            <button type="button" onClick={() => navigateToAction({ type: 'add-video', lane: 'LearnDriven Shorts' })} className="flex items-center gap-1.5 rounded-md border border-emerald-900/60 bg-emerald-950/15 px-3 py-2 text-[9px] font-bold text-emerald-400 transition hover:border-emerald-700 hover:bg-emerald-950/30"><Plus className="h-3.5 w-3.5" />ADD A TOPIC</button>
            <button type="button" onClick={() => navigateToAction({ type: 'pipeline' })} className="flex items-center gap-1.5 rounded-md border border-cyan-900/60 bg-cyan-950/15 px-3 py-2 text-[9px] font-bold text-cyan-400 transition hover:border-cyan-700 hover:bg-cyan-950/30"><Clapperboard className="h-3.5 w-3.5" />VIDEO PRODUCTION BOARD</button>
            <button type="button" onClick={navigateToInventory} className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/35 px-3 py-2 text-[9px] font-bold text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"><Database className="h-3.5 w-3.5" />INVENTORY RECORDS</button>
          </div>
        </div>

        {/* Workspace Hub Info strip */}
        <div className="px-4 sm:px-6 lg:px-8 py-2.5 bg-zinc-950 border-b border-zinc-900 text-[10px] font-mono">
          <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-4 text-zinc-500">
            <span>WORKLOAD STATUS: <strong className="text-zinc-300">SAFE</strong></span>
            <span className="text-zinc-700">|</span>
            <span>DATA SAVING: <strong className="text-zinc-300">BROWSER STORAGE ACTIVE</strong></span>
            <span className="text-zinc-700">|</span>
            <span>WORK PACE: <strong className="text-amber-400">{goals.intensityMode === 'War mode' ? 'DEADLINE SPRINT' : goals.intensityMode.toUpperCase()}</strong></span>
          </div>
          </div>
        </div>

        {/* Main Workspace content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'mission' ? (
              <motion.div
                key="mission"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Dynamic Tactical Action Steps Board */}
                <ActionNavigator
                  videos={videos}
                  productOpportunities={productOpportunities}
                  goals={goals}
                  onNavigate={navigateToAction}
                />

                {/* Row 0: Studio Health overview */}
                <StudioHealth
                  videos={videos}
                  workSessions={workSessions}
                  goals={goals}
                  totalCompleted={totalCompleted}
                  totalPlanned={totalPlanned}
                  onNavigate={() => undefined}
                />

                {/* Row 1: Top level summary stats */}
                <MissionControl
                  month={goals.month}
                  todayDay={todayDay}
                  totalDays={totalDays}
                  totalPlanned={totalPlanned}
                  totalCompleted={totalCompleted}
                  totalRemaining={totalRemaining}
                  requiredDailyPace={requiredDailyPace}
                  actualDailyPace={actualDailyPace}
                  bufferCount={bufferCount}
                  safeBreakDays={safeBreakDays}
                  pressureLevel={pressureLevel}
                  requiredEffortToday={requiredEffortToday}
                  videos={videos}
                  onUpdateVideo={handleUpdateVideo}
                  onAddVideo={handleAddVideo}
                  goals={goals}
                  wellbeingNodes={nodes}
                  wellbeingHistory={wellbeingHistory}
                />

                {/* Grid separating primary layout from side panels */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                  
                  {/* Left Column: Lanes */}
                  <div className="lg:col-span-3 space-y-6">
                    {/* Row 2: Channel Lanes */}
                    <ChannelLanes 
                      videos={videos}
                      goals={goals}
                      todayDay={todayDay}
                      totalDays={totalDays}
                    />
                  </div>

                  {/* Right Column: Side panel controls & stats */}
                  <div className="space-y-6">
                    <SidePanel 
                      goals={goals}
                      videos={videos}
                      todayDay={todayDay}
                      totalDays={totalDays}
                      onUpdateGoals={setGoals}
                      requiredEffortToday={requiredEffortToday}
                      pressureLevel={pressureLevel}
                    />
                  </div>

                </div>

                {/* Row 2.5: Work Window Manager (Full Width) */}
                <WorkWindowManager
                  sessions={workSessions}
                  onSessionAdd={(session) => {
                    const newSession: WorkWindowSession = {
                      ...session,
                      id: `session_${Date.now()}`,
                      isActive: false,
                      isPaused: false,
                      pausePeriods: []
                    };
                    setWorkSessions([...workSessions, newSession]);
                  }}
                  onSessionUpdate={(session) => {
                    setWorkSessions(workSessions.map(s => s.id === session.id ? session : s));
                  }}
                  onSessionRemove={(sessionId) => {
                    setWorkSessions(workSessions.filter(s => s.id !== sessionId));
                  }}
                />

                {/* Row 3: Pipeline Board (Full Width) */}
                <PipelineBoard
                  videos={videos}
                  goals={goals}
                  revenueLevels={revenueLevels}
                  onUpdateVideo={handleUpdateVideo}
                  onAddVideo={handleAddVideo}
                  onDeleteVideo={handleDeleteVideo}
                  focusRequest={actionTarget}
                  workSessions={workSessions}
                />

                {/* Row 4: Smart Action Prompts (Full Width) */}
                <SmartActionPrompts 
                  videos={videos}
                  goals={goals}
                  revenueLevels={revenueLevels}
                  todayDay={todayDay}
                  totalDays={totalDays}
                  onApplyUpgrade={handleApplyUpgrade}
                  onNavigate={navigateToAction}
                />

                {/* Structured Database records */}
                <RawDataViewer 
                  goals={goals}
                  videos={videos}
                  revenueLevels={revenueLevels}
                  productOpportunities={productOpportunities}
                  onUpdateVideo={handleUpdateVideo}
                  onAddVideo={handleAddVideo}
                  onDeleteVideo={handleDeleteVideo}
                  onUpdateProductOpportunity={handleUpdateProductOpportunity}
                  onAddProductOpportunity={handleAddProductOpportunity}
                  onDeleteProductOpportunity={handleDeleteProductOpportunity}
                />
              </motion.div>
            ) : (
              <motion.div
                key="health"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <DailyStateDashboard
                  nodes={nodes}
                  history={wellbeingHistory}
                  onUpdateNode={handleUpdateBiometric}
                />
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </main>

        {/* Footer Area */}
        <footer className="border-t border-zinc-900 bg-zinc-950/40 p-6 text-center font-mono text-[10px] text-zinc-600 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span>CREATOR.OS PRODUCTION HUB © 2026. YOUR PERSONAL CREATOR WORKSPACE.</span>
          <div className="flex items-center gap-2 rounded border border-zinc-900 bg-black/20 px-3 py-2">
            <Cloud className={`h-3.5 w-3.5 ${syncStatus === 'error' ? 'text-rose-400' : syncStatus === 'saving' || syncStatus === 'loading' ? 'text-amber-400 animate-pulse' : syncStatus === 'saved' ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <span className="text-[8px] text-zinc-500 uppercase">{syncStatus === 'local' ? 'Local storage' : syncStatus === 'loading' ? 'Loading cloud data' : syncStatus === 'saving' ? 'Saving' : syncStatus === 'saved' ? 'Cloud saved' : 'Cloud sync error'}</span>
            {email && <button onClick={signOut} title={`Sign out ${email}`} className="ml-1 border-l border-zinc-800 pl-2 text-zinc-600 hover:text-white"><LogOut className="h-3.5 w-3.5" /></button>}
          </div>
          <button onClick={handleTriggerResetModal} className="flex items-center gap-1.5 rounded border border-rose-950/70 bg-rose-950/10 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-rose-500 hover:border-rose-800 hover:bg-rose-950/30" title="Permanently delete all dashboard data"><RefreshCw className="h-3.5 w-3.5" />Hard Reset</button>
        </footer>

        {/* Month constraints Wizard overlay */}
        <MonthlySetupWizard 
          isOpen={isSetupOpen}
          onClose={() => setIsSetupOpen(false)}
          currentGoals={wizardGoals}
          onSave={saveZone}
        />

        <AnimatePresence>
          {isZoneChoiceOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono">
              <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }} className="w-full max-w-md rounded-lg border border-amber-900/50 bg-zinc-950 p-5 shadow-2xl space-y-4">
                <div className="flex items-center gap-2 text-amber-400 font-bold uppercase text-sm"><AlertTriangle className="h-4 w-4" /> Zone already active</div>
                <p className="text-xs leading-relaxed text-zinc-400">Starting a new zone will clear the current video progress and product opportunities when you save the new zone. Your wellbeing history will remain available.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button type="button" onClick={() => startZoneSetup('new')} className="rounded border border-rose-900/60 bg-rose-950/20 px-4 py-3 text-[10px] font-bold uppercase text-rose-400 hover:bg-rose-950/40">Start a new zone</button>
                  <button type="button" onClick={() => startZoneSetup('edit')} className="rounded border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-[10px] font-bold uppercase text-emerald-400 hover:bg-emerald-950/40">Edit current zone</button>
                </div>
                <button type="button" onClick={() => setIsZoneChoiceOpen(false)} className="w-full text-[9px] uppercase text-zinc-600 hover:text-zinc-300">Cancel</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Factory Reset Password Modal */}
        <AnimatePresence>
          {isFactoryResetModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono text-xs"
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="bg-zinc-950 border border-red-500/30 p-5 rounded-lg w-full max-w-sm shadow-[0_0_30px_rgba(239,68,68,0.15)] space-y-4"
              >
                <div className="flex items-center justify-between font-bold border-b border-zinc-900 pb-2 text-red-500 uppercase">
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4 animate-pulse" />
                    Reset Password Required
                  </span>
                  <button
                    onClick={() => setIsFactoryResetModalOpen(false)}
                    className="text-zinc-500 hover:text-zinc-300 text-sm font-sans"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-zinc-500 leading-normal uppercase">
                    Warning: This permanently deletes every saved input, video, goal, wellbeing entry, and dashboard setting from this browser and your signed-in cloud database record.
                  </p>
                  <div className="space-y-1">
                    <label className="text-[9px] text-zinc-400 block font-bold uppercase tracking-wider">
                      Enter Reset Password
                    </label>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => {
                        setResetPassword(e.target.value);
                        setResetPasswordError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleVerifyResetPassword();
                        }
                      }}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-500 rounded px-3 py-2 text-zinc-200 focus:outline-none transition-colors text-center font-sans tracking-widest text-sm"
                      placeholder="•••••••••••••••"
                      autoFocus
                    />
                  </div>
                  {resetPasswordError && (
                    <p className="text-[10px] text-red-500 font-bold animate-pulse text-center">
                      ✕ {resetPasswordError}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
                  <button
                    type="button"
                    onClick={() => setIsFactoryResetModalOpen(false)}
                    className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 px-3 py-1.5 text-zinc-400 rounded uppercase font-bold text-[10px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyResetPassword}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-1.5 rounded uppercase tracking-wider text-[10px]"
                  >
                    Delete Everything
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

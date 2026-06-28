export interface MonthlyGoals {
  month: string; // e.g. "2026-06"
  cycleStartDate: string; // YYYY-MM-DD start of cycle
  cycleEndDate: string; // YYYY-MM-DD end of cycle
  intensityMode: 'Relaxed' | 'Balanced' | 'Aggressive' | 'War mode';
  workdaysAvailable: number;
  plannedBreakDays: number;
  hoursPerDay: number;
  workWindowStart: string; // "11:00"
  workWindowEnd: string; // "20:00"
  
  // Toggles
  enabledRevenueLevels: number[];
  brandCollabsTargeted: boolean;
  longVideoAbove8MinTargeted: boolean;
  viralTopicsTargeted: boolean;
  productTagsAllowed: boolean;
  pinnedCommentsAllowed: boolean;

  // Lane targets
  ldShortsTarget: number;
  ldLongTarget: number;
  ldMembersTarget: number;
  dwShortsTarget: number;

  ldLongWeeklyTarget: number;
  ldMembersWeeklyTarget: number;
  dwShortsScheduleType: 'Daily' | 'Weekly' | 'Monthly';
}

export type StageStatus = 'Not started' | 'In progress' | 'Done' | 'Blocked';

export interface VideoPipeline {
  topic: StageStatus;
  script: StageStatus;
  shoot: StageStatus;
  edit: StageStatus;
  thumbnail?: StageStatus; // Only present for Long Videos
  schedule: StageStatus;
}

export type VideoStage = 'Topic' | 'Script' | 'Shoot' | 'Edit' | 'Thumbnail' | 'Schedule' | 'Done';

export type VideoStatus = 'neutral' | 'good' | 'attention' | 'warning' | 'critical';

export interface VideoRevenueEligibility {
  viralPotential: boolean;
  productTag: boolean;
  pinnedComment: boolean;
  overEightMinutes: boolean;
  breakoutAttempt: boolean;
  brandCollaboration: boolean;
}

export interface VideoItem {
  id: string;
  channel: 'LearnDriven' | 'DecodeWorthy';
  contentLane: 'LearnDriven Shorts' | 'LearnDriven Long Videos' | 'LearnDriven Members-only Videos' | 'DecodeWorthy Shorts';
  title: string;
  revenueLevelTarget: number;
  createdAt?: string; // YYYY-MM-DD, automatically recorded when the topic is added
  expectedPublishDate?: string; // YYYY-MM-DD, optional until publishing is planned
  actualScheduledDate?: string; // YYYY-MM-DD
  pipeline: VideoPipeline;
  currentStage: VideoStage;
  isBlocked: boolean;
  blockerReason?: string;
  blockerSeverity?: 'attention' | 'warning' | 'critical';
  status?: VideoStatus;
  statusNote?: string;
  revenueEligibility?: VideoRevenueEligibility;
  productTagStatus: 'Unsuitable' | 'Available' | 'Tagged';
  pinnedCommentStatus: 'None' | 'Added';
  membersPromotionStatus: 'None' | 'Promoted';
  brandCollabStatus: 'None' | 'Attached';
  notes?: string;
}

export interface RevenueLevelConfig {
  level: number;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Very hard' | 'Unpredictable';
  requiredConditions: string[];
  suggestedActions: string[];
}

export interface ProductOpportunity {
  id: string;
  topic: string;
  channel: 'LearnDriven' | 'DecodeWorthy';
  productCategory: string;
  relevanceScore: number; // 1-10
  revenueUpgrade: string; // e.g. "Level 2 to Level 3"
  forcedRisk: 'Low' | 'Medium' | 'High';
  suggestedTag: string;
  status: 'Pending' | 'Added' | 'Ignored';
}

export interface CalibrationNode {
  id: string;
  label: string;
  value: number; // 1-10
  color: string;
}

export interface WellbeingEntry {
  id: string;
  nodeId: string;
  value: number;
  timestamp: string;
}

export interface ClimateData {
  temp: string;
  humidity: string;
  wind: string;
  sunrise: string;
  sunset: string;
  pressure: string;
  airQuality: string;
  precipitation: string;
  stationId: string;
  moonPhase: string;
}

export interface ActionPromptLog {
  id: string;
  date: string;
  prompt: string;
  reason: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  completed: boolean;
  timeMode: 'quick' | 'medium' | 'deep';
  alternative: string;
  impact: string;
  target?: DashboardActionTarget;
}

export type DashboardActionTarget =
  | { type: 'video'; videoId: string; requestId?: number }
  | { type: 'add-video'; lane: VideoItem['contentLane']; requestId?: number }
  | { type: 'health'; requestId?: number }
  | { type: 'pipeline'; requestId?: number };

import { VideoItem, VideoRevenueEligibility, VideoStatus } from './types';

export const EMPTY_REVENUE_ELIGIBILITY: VideoRevenueEligibility = {
  viralPotential: false,
  productTag: false,
  pinnedComment: false,
  overEightMinutes: false,
  breakoutAttempt: false,
  brandCollaboration: false,
};

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateRevenueLevel(
  lane: VideoItem['contentLane'],
  eligibility: VideoRevenueEligibility,
): number {
  // Members-only work is subscription value rather than direct per-video revenue.
  // It is deliberately fixed at the high-risk/high-reward Level 5.
  if (lane === 'LearnDriven Members-only Videos') return 5;
  if (eligibility.brandCollaboration) return 20;
  if (eligibility.breakoutAttempt) return 10;

  if (lane === 'LearnDriven Long Videos') {
    if (eligibility.viralPotential) {
      if (eligibility.overEightMinutes) return eligibility.productTag ? 9.5 : 9;
      return eligibility.productTag ? 8.5 : 8;
    }

    if (eligibility.overEightMinutes) return eligibility.productTag ? 7.5 : 7;
    return eligibility.productTag ? 6.5 : 6;
  }

  // A pinned promotion is not valuable by itself. Level 4 represents the
  // compounding combination of reach + a relevant product + a pinned path.
  if (eligibility.viralPotential && eligibility.productTag && eligibility.pinnedComment) return 4;
  if (eligibility.viralPotential && eligibility.productTag) return 3;
  if (eligibility.viralPotential) return 2;
  return 1;
}

export function inferRevenueEligibility(video: VideoItem): VideoRevenueEligibility {
  if (video.revenueEligibility) return video.revenueEligibility;

  const level = video.revenueLevelTarget;
  return {
    viralPotential: [2, 3, 4, 8, 8.5, 9, 9.5, 10].includes(level),
    productTag: video.productTagStatus === 'Tagged' || [3, 4, 6.5, 7.5, 8.5, 9.5].includes(level),
    pinnedComment: video.pinnedCommentStatus === 'Added' || level === 4,
    overEightMinutes: [7, 7.5, 9, 9.5].includes(level),
    breakoutAttempt: level === 10,
    brandCollaboration: video.brandCollabStatus === 'Attached' || level === 20,
  };
}

export function getVideoStatus(video: VideoItem): VideoStatus {
  if (video.status) return video.status;
  if (video.isBlocked) return video.blockerSeverity || 'critical';
  return 'good';
}

export function statusNeedsAttention(status: VideoStatus): status is Extract<VideoStatus, 'attention' | 'warning' | 'critical'> {
  return status === 'attention' || status === 'warning' || status === 'critical';
}

export function migrateVideo(video: VideoItem): VideoItem {
  const status = getVideoStatus(video);
  const revenueEligibility = inferRevenueEligibility(video);
  const createdAt = video.createdAt || video.expectedPublishDate || getLocalDateString();
  const statusNote = video.statusNote || video.blockerReason || '';

  return {
    ...video,
    createdAt,
    status,
    statusNote,
    revenueEligibility,
    isBlocked: statusNeedsAttention(status),
    blockerReason: statusNeedsAttention(status) ? statusNote || undefined : undefined,
    blockerSeverity: statusNeedsAttention(status) ? status : undefined,
  };
}

export function isVideoInCycle(video: VideoItem, start: string, end: string): boolean {
  const date = video.createdAt || video.expectedPublishDate || video.actualScheduledDate;
  return Boolean(date && date >= start && date <= end);
}

export function getDaysSince(dateString?: string): number {
  if (!dateString) return 0;
  const created = new Date(`${dateString}T00:00:00`);
  const today = new Date(`${getLocalDateString()}T00:00:00`);
  return Math.max(0, Math.floor((today.getTime() - created.getTime()) / 86_400_000));
}

export type EarningOutlook = 'Low' | 'Moderate' | 'High' | 'Very high';

function classifyBand(score: number, thresholds: [number, number, number]): EarningOutlook {
  if (score < thresholds[0]) return 'Low';
  if (score < thresholds[1]) return 'Moderate';
  if (score < thresholds[2]) return 'High';
  return 'Very high';
}

export function getEarningOutlook(videos: VideoItem[]) {
  const levelWeight = (level: number) => {
    if (level <= 2) return 1;
    if (level <= 5) return 2;
    if (level <= 7.5) return 3;
    if (level <= 9.5) return 4;
    if (level <= 10) return 5;
    return 6;
  };

  const frequency = videos.length;
  const weights = videos.map(video => levelWeight(video.revenueLevelTarget));
  const momentum = weights.reduce((sum, weight) => sum + weight, 0);
  const averageWeight = frequency > 0 ? momentum / frequency : 0;

  return {
    label: classifyBand(momentum, [12, 30, 80]),
    frequency,
    frequencyBand: classifyBand(frequency, [5, 12, 25]),
    levelMixBand: classifyBand(averageWeight, [1.5, 2.75, 4]),
  };
}

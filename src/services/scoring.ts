import { VideoRecord } from '../types';

// Calculate overall video health score on a scale of 0 to 100
export function calculateVideoHealthScore(video: VideoRecord): number {
  if (!video.metrics) return 0;
  
  const m = video.metrics;
  
  if (video.format === 'Short') {
    // Shorts: Swipe resistance (40%), Average percentage viewed (30%), CTR (20%), Subscriber conversion (10%)
    const swipeResistanceWeight = (m.swipeResistance || 50) * 0.4;
    const avgPercentageViewedWeight = Math.min(100, m.averagePercentageViewed || 50) * 0.3;
    const ctrWeight = Math.min(100, (m.ctr || 5) * 5) * 0.2; // normalize 5% CTR -> 25pts, 10% CTR -> 50pts etc.
    const subWeight = Math.min(100, (m.subscribersGainedPer1kViews || 5) * 4) * 0.1;
    return Math.round(swipeResistanceWeight + avgPercentageViewedWeight + ctrWeight + subWeight);
  } else if (video.format === 'Long') {
    // Long videos: CTR (30%), Average percentage viewed (35%), Subscribers Gained (20%), Watch time per impression (15%)
    const ctrWeight = Math.min(100, (m.ctr || 5) * 10) * 0.3; // normalize 10% CTR to max
    const avgPercentageViewedWeight = Math.min(100, m.averagePercentageViewed || 40) * 0.35;
    const subWeight = Math.min(100, (m.subscribersGainedPer1kViews || 5) * 5) * 0.2;
    const watchTimeWeight = Math.min(100, (m.watchTimePerImpression || 10) * 4) * 0.15;
    return Math.round(ctrWeight + avgPercentageViewedWeight + subWeight + watchTimeWeight);
  } else {
    // Members only: Completion rate (40%), Member value score (30%), Retention quality (30%)
    const completionWeight = (m.completionRate || 50) * 0.4;
    const valWeight = (m.memberValueScore || 50) * 0.3;
    const retentionWeight = (m.retentionQuality === 'High' ? 100 : (m.retentionQuality === 'Medium' ? 60 : 20)) * 0.3;
    return Math.round(completionWeight + valWeight + retentionWeight);
  }
}

// Calculate repeatability score for a topic
export function calculateTopicRepeatScore(videos: VideoRecord[], topic: string): number {
  const published = videos.filter(v => v.pipelineStage === 'Published' && v.topic === topic && v.metrics);
  if (published.length === 0) return 50; // Neutral baseline

  const avgViews = published.reduce((acc, v) => acc + (v.metrics?.lifetimeViews || 0), 0) / published.length;
  const avgHealth = published.reduce((acc, v) => acc + calculateVideoHealthScore(v), 0) / published.length;
  
  // Normalize views (e.g. 50k views = 50pts, max 100k views = 100pts)
  const viewPts = Math.min(100, avgViews / 500);
  return Math.round(viewPts * 0.5 + avgHealth * 0.5);
}

// Calculate format efficiency score
export function calculateFormatEfficiencyScore(videos: VideoRecord[], format: string): number {
  const published = videos.filter(v => v.pipelineStage === 'Published' && v.format === format && v.metrics);
  if (published.length === 0) return 50;

  const totalViews = published.reduce((acc, v) => acc + (v.metrics?.lifetimeViews || 0), 0);
  const totalEffort = published.reduce((acc, v) => acc + (v.productionEffortHours || 1), 0);

  const viewsPerProductionHour = totalViews / (totalEffort || 1);
  // Normalize views per hour (e.g. 5,000 views per hour = 100 score)
  return Math.round(Math.min(100, viewsPerProductionHour / 50));
}

// Assess consistency risk (0 = low, 100 = critical)
export function assessConsistencyRiskScore(videos: VideoRecord[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const scheduled = videos.filter(v => 
    v.pipelineStage === 'Schedule' && 
    v.dueDate && 
    new Date(v.dueDate) > today
  );

  if (scheduled.length >= 3) return 10; // Secure
  if (scheduled.length === 2) return 30; // Normal
  if (scheduled.length === 1) return 70; // At risk
  return 100; // Behind
}

// Generate the recommended next action for a specific pipeline stage
export function generateRecommendedNextAction(video: VideoRecord): string {
  if (video.blockedReason) {
    return `Resolve blocker: "${video.blockedReason}"`;
  }

  switch (video.pipelineStage) {
    case 'Topic':
      return 'Draft the script outline and hook segment options';
    case 'Script':
      return 'Complete script copywriting and voiceover pacing review';
    case 'Shoot':
      return 'Set up equipment, record voiceover audio, and capture A-roll clips';
    case 'Edit':
      return 'Merge visual graphic overlays and adjust background music volume tracks';
    case 'Thumbnail':
      return 'Generate A/B thumbnail mockups and request metadata feedback';
    case 'Schedule':
      return 'Write descriptions, assign keyword tags, and queue up release timings';
    case 'Published':
      return 'Analyze realtime analytics and reply to viewer comments';
    default:
      return 'Advance pipeline stage';
  }
}

import { CalibrationNode, WellbeingEntry } from './types';

export const WELLBEING_ORDER = [
  'sleep', 'freshness', 'eyeComfort', 'pleasantness', 'nutrition', 'hydration',
  'physicalComfort', 'mood', 'mindfulness', 'energy', 'finances', 'environment', 'endorphins'
];

export function getReadiness(nodes: CalibrationNode[]) {
  if (!nodes.length) return 0;
  return Math.round((nodes.reduce((sum, node) => sum + node.value, 0) / nodes.length) * 10);
}

export function getNodeValue(nodes: CalibrationNode[], id: string, fallback = 5) {
  return nodes.find(node => node.id === id)?.value ?? fallback;
}

export function formatEntryTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function isToday(timestamp: string) {
  const date = new Date(timestamp);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

export type WellbeingInsight = {
  title: string;
  detail: string;
  tone: 'good' | 'watch' | 'act';
};

export function getWellbeingInsights(nodes: CalibrationNode[], history: WellbeingEntry[]): WellbeingInsight[] {
  const eye = getNodeValue(nodes, 'eyeComfort');
  const hydration = getNodeValue(nodes, 'hydration');
  const nutrition = getNodeValue(nodes, 'nutrition');
  const energy = getNodeValue(nodes, 'energy');
  const freshness = getNodeValue(nodes, 'freshness');
  const comfort = getNodeValue(nodes, 'physicalComfort');
  const mood = getNodeValue(nodes, 'mood');
  const mindfulness = getNodeValue(nodes, 'mindfulness');
  const pleasantness = getNodeValue(nodes, 'pleasantness');
  const insights: WellbeingInsight[] = [];

  if (eye <= 4) insights.push({ tone: 'act', title: 'Take a 10-minute screen break', detail: `Eye comfort is ${eye}/10. Look into the distance and return to screen work after the break.` });
  if (hydration <= 4) insights.push({ tone: 'act', title: 'Hydrate before the next deep-work block', detail: `Hydration is ${hydration}/10. Drink water now and re-check it in 20–30 minutes.` });
  if (nutrition <= 4 && energy <= 5) insights.push({ tone: 'act', title: 'Fuel first, then choose demanding work', detail: `Nutrition is ${nutrition}/10 and energy is ${energy}/10. A nourishing meal may be more useful than forcing focus.` });
  if (freshness <= 4 || energy <= 4) insights.push({ tone: 'watch', title: 'Use a lighter work block', detail: `Freshness is ${freshness}/10 and energy is ${energy}/10. Prefer scheduling, review, or a short edit over a complex shoot.` });
  if (comfort <= 4) insights.push({ tone: 'watch', title: 'Reset your physical setup', detail: `Physical comfort is ${comfort}/10. Change posture, walk briefly, or adjust the desk before continuing.` });
  if (mood <= 4 && mindfulness <= 5) insights.push({ tone: 'watch', title: 'Reduce context switching', detail: `Mood is ${mood}/10 and mindfulness is ${mindfulness}/10. Pick one small finish line for the next 25 minutes.` });

  const todayHistory = history.filter(entry => isToday(entry.timestamp)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const latest = todayHistory[0];
  if (latest) {
    const node = nodes.find(item => item.id === latest.nodeId);
    const previous = todayHistory.find(entry => entry.nodeId === latest.nodeId && entry.id !== latest.id);
    if (node && previous && latest.value > previous.value) {
      insights.push({ tone: 'good', title: `${node.label} improved at ${formatEntryTime(latest.timestamp)}`, detail: `It moved from ${previous.value}/10 to ${latest.value}/10. This is a useful window for the next focused task.` });
    }
  }

  const focusCapacity = Math.round((freshness + energy + eye + mindfulness + pleasantness) / 5 * 10);
  if (focusCapacity >= 75) insights.push({ tone: 'good', title: 'Strong focus window available', detail: `Your current focus-supporting signals average ${focusCapacity}%. Use this window for the hardest meaningful task.` });

  if (!insights.length) insights.push({ tone: 'good', title: 'Your current state looks balanced', detail: 'No strong wellbeing constraint is visible. Continue the planned task and update a slider when something changes.' });
  return insights.slice(0, 4);
}

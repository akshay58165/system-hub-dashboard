import { CalibrationNode, WellbeingEntry } from './types';

export const WELLBEING_ORDER = [
  'sleep', 'freshness', 'eyeComfort', 'pleasantness', 'nutrition', 'hydration',
  'physicalComfort', 'mood', 'mindfulness', 'energy', 'finances', 'environment', 'endorphins'
];

export function getReadiness(nodes: CalibrationNode[]) {
  const recorded = nodes.filter(node => node.value > 0);
  if (!recorded.length) return 0;
  return Math.round((recorded.reduce((sum, node) => sum + node.value, 0) / recorded.length) * 10);
}

export function getNodeValue(nodes: CalibrationNode[], id: string, fallback = 0) {
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

  if (eye > 0 && eye <= 4) insights.push({ tone: 'act', title: 'Take a 10-minute screen break', detail: `Eye comfort is ${eye}/10. Look into the distance and return to screen work after the break.` });
  if (hydration > 0 && hydration <= 4) insights.push({ tone: 'act', title: 'Hydrate before the next deep-work block', detail: `Hydration is ${hydration}/10. Drink water now and re-check it in 20–30 minutes.` });
  if (nutrition > 0 && energy > 0 && nutrition <= 4 && energy <= 5) insights.push({ tone: 'act', title: 'Fuel first, then choose demanding work', detail: `Nutrition is ${nutrition}/10 and energy is ${energy}/10. A nourishing meal may be more useful than forcing focus.` });
  if ((freshness > 0 && freshness <= 4) || (energy > 0 && energy <= 4)) insights.push({ tone: 'watch', title: 'Use a lighter work block', detail: 'A recorded freshness or energy signal supports lighter work. Prefer scheduling, review, or a short edit over a complex shoot.' });
  if (comfort > 0 && comfort <= 4) insights.push({ tone: 'watch', title: 'Reset your physical setup', detail: `Physical comfort is ${comfort}/10. Change posture, walk briefly, or adjust the desk before continuing.` });
  if (mood > 0 && mindfulness > 0 && mood <= 4 && mindfulness <= 5) insights.push({ tone: 'watch', title: 'Reduce context switching', detail: `Mood is ${mood}/10 and mindfulness is ${mindfulness}/10. Pick one small finish line for the next 25 minutes.` });

  const todayHistory = history.filter(entry => isToday(entry.timestamp)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const latest = todayHistory[0];
  if (latest) {
    const node = nodes.find(item => item.id === latest.nodeId);
    const previous = todayHistory.find(entry => entry.nodeId === latest.nodeId && entry.id !== latest.id);
    if (node && previous && latest.value > previous.value) {
      insights.push({ tone: 'good', title: `${node.label} improved at ${formatEntryTime(latest.timestamp)}`, detail: `It moved from ${previous.value}/10 to ${latest.value}/10. This is a useful window for the next focused task.` });
    }
  }

  const focusSignals = [freshness, energy, eye, mindfulness, pleasantness].filter(value => value > 0);
  const focusCapacity = focusSignals.length ? Math.round((focusSignals.reduce((sum, value) => sum + value, 0) / focusSignals.length) * 10) : 0;
  if (focusSignals.length >= 3 && focusCapacity >= 75) insights.push({ tone: 'good', title: 'Strong focus window available', detail: `Your recorded focus-supporting signals average ${focusCapacity}%. Use this window for the hardest meaningful task.` });

  if (!nodes.some(node => node.value > 0)) insights.push({ tone: 'watch', title: 'Complete today’s check-in', detail: 'No wellbeing parameter has been recorded today, so capacity guidance is intentionally unavailable.' });
  else if (!insights.length) insights.push({ tone: 'good', title: 'No constraint in the recorded signals', detail: 'The parameters entered today show no strong constraint. Unrecorded parameters remain excluded.' });
  return insights.slice(0, 4);
}

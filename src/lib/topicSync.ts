import type { Topic } from '../types';

export const visibleCreatorTopics = (topics: Topic[] = []) => topics.filter(topic =>
  !topic.isDemo && !topic.id.startsWith('t-manual-demo-infotainment-')
);

const topicTime = (topic: Topic) => {
  const parsed = new Date(topic.lastUpdated || topic.createdDate).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

export const mergeTopicsByNewest = (
  remoteTopics: Topic[], localTopics: Topic[], deletedTopicIds: Record<string, string> = {}
) => {
  const merged = new Map<string, Topic>();
  [...visibleCreatorTopics(remoteTopics), ...visibleCreatorTopics(localTopics)].forEach(topic => {
    const deletedAt = deletedTopicIds[topic.id];
    if (deletedAt && new Date(deletedAt).getTime() >= topicTime(topic)) return;
    const existing = merged.get(topic.id);
    if (!existing || topicTime(topic) >= topicTime(existing)) merged.set(topic.id, topic);
  });
  return Array.from(merged.values());
};

export const mergeRemoteWithPendingTopics = (
  remoteTopics: Topic[], localTopics: Topic[], dirtyTopicIds: ReadonlySet<string>,
  deletedTopicIds: Record<string, string> = {}
) => mergeTopicsByNewest(
  remoteTopics, localTopics.filter(topic => dirtyTopicIds.has(topic.id)), deletedTopicIds
);

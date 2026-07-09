import type { Topic } from '../types';

export const normalizeTopicWorkflowState = (topic: Topic): Topic => {
  const hasWorkflowProgress = Object.values(topic.workflowStatuses || {}).some(
    state => state === 'in-progress' || state === 'completed'
  );
  const shouldBeInPipeline = Boolean(topic.inProgress || topic.status !== 'topic' || hasWorkflowProgress);
  return topic.inProgress === shouldBeInPipeline ? topic : { ...topic, inProgress: shouldBeInPipeline };
};

export const visibleCreatorTopics = (topics: Topic[] = []) => topics
  .filter(topic => !topic.isDemo && !topic.id.startsWith('t-manual-demo-infotainment-'))
  .map(normalizeTopicWorkflowState);

const comparableTopic = (topic: Topic) => {
  const { lastUpdated: _lastUpdated, ...rest } = topic;
  return JSON.stringify(rest);
};

// Every local edit passes through this function. Components only describe the
// desired fields; synchronization metadata is stamped centrally and cannot be
// forgotten by an individual button or form.
export const prepareLocalTopicMutation = (
  previousTopics: Topic[], nextTopics: Topic[], changedAt = new Date().toISOString()
) => {
  const previousById = new Map(previousTopics.map(topic => [topic.id, topic]));
  return nextTopics.map(rawTopic => {
    const topic = normalizeTopicWorkflowState(rawTopic);
    const previous = previousById.get(topic.id);
    if (!previous) return topic.lastUpdated ? topic : { ...topic, lastUpdated: changedAt };
    if (comparableTopic(previous) === comparableTopic(topic)) return previous;
    return { ...topic, lastUpdated: changedAt };
  });
};

// A valid committed snapshot never contains both a topic and its deletion
// tombstone. Older clients produced that impossible state; the topic is the
// recoverable user data, so it wins when normalizing that same snapshot.
export const normalizeCommittedTombstones = (
  topics: Topic[] = [], deletedTopicIds: Record<string, string> = {}
) => {
  const normalized = { ...deletedTopicIds };
  topics.forEach(topic => delete normalized[topic.id]);
  return normalized;
};

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
) => {
  // Never infer deletion from absence in a snapshot. Only an explicit
  // tombstone may remove a topic. This lets a healthy client repair an empty
  // or partial snapshot written by a stale tab instead of echoing the loss.
  const merged = mergeTopicsByNewest(remoteTopics, localTopics, deletedTopicIds);
  if (dirtyTopicIds.size === 0) return merged;
  // Any topic the user just edited locally but hasn't been confirmed on the
  // server yet MUST keep the local version, regardless of what lastUpdated
  // timestamps say. Otherwise a slightly-off clock or an echo from another
  // tab can clobber a fresh Save Schedule/Save Edit the moment realtime
  // fires — the user sees their change appear then vanish.
  const localById = new Map(localTopics.map(topic => [topic.id, topic]));
  return merged.map(topic => {
    if (!dirtyTopicIds.has(topic.id)) return topic;
    const local = localById.get(topic.id);
    return local || topic;
  });
};

export const topicCollectionsEqual = (left: Topic[], right: Topic[]) => {
  if (left.length !== right.length) return false;
  const rightById = new Map(right.map(topic => [topic.id, topic]));
  return left.every(topic => {
    const other = rightById.get(topic.id);
    return other !== undefined && JSON.stringify(topic) === JSON.stringify(other);
  });
};

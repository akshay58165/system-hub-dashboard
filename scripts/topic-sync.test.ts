import assert from 'node:assert/strict';
import type { Topic } from '../src/types';
import { mergeRemoteWithPendingTopics, mergeTopicsByNewest, normalizeCommittedTombstones, normalizeTopicWorkflowState, prepareLocalTopicMutation } from '../src/lib/topicSync';

const topic = (id: string, lastUpdated: string, name = id): Topic => ({
  id, name, description: '', channel: 'LearnDriven', status: 'topic', priority: 3,
  dueDate: null, createdDate: lastUpdated, lastUpdated
});

const oldTime = '2026-07-02T10:00:00.000Z';
const newTime = '2026-07-02T10:00:01.000Z';

// The production incident: stale realtime arrives before the local create saves.
assert.deepEqual(
  mergeRemoteWithPendingTopics([], [topic('a-for-apple', newTime)], new Set(['a-for-apple'])).map(t => t.id),
  ['a-for-apple']
);

// Independent creations on two devices converge to a union.
assert.deepEqual(
  mergeTopicsByNewest([topic('remote', oldTime)], [topic('local', newTime)]).map(t => t.id).sort(),
  ['local', 'remote']
);

// The newest status/title mutation wins for the same stable topic id.
assert.equal(
  mergeTopicsByNewest([topic('same', oldTime, 'old')], [topic('same', newTime, 'new')])[0].name,
  'new'
);

// Snapshot absence is never treated as deletion; stale tabs can write partial
// snapshots, and only an explicit tombstone is allowed to remove user data.
assert.deepEqual(
  mergeRemoteWithPendingTopics([topic('server', newTime)], [topic('stale-local', oldTime)], new Set()).map(t => t.id),
  ['server', 'stale-local']
);

// A deletion tombstone defeats a snapshot older than the deletion.
assert.deepEqual(
  mergeTopicsByNewest([topic('deleted', oldTime)], [], { deleted: newTime }),
  []
);

// Repair the exact cross-device incident: an old client committed a topic and
// a stale tombstone for the same id. The recoverable topic wins on hydration.
assert.deepEqual(
  normalizeCommittedTombstones([topic('a-for-apple', oldTime)], { 'a-for-apple': newTime, genuinelyDeleted: newTime }),
  { genuinelyDeleted: newTime }
);

// A durable five-topic browser replica repairs an intermittently empty cloud
// document instead of allowing the visible inventory to flash to zero.
const durableFive = ['a', 'b', 'c', 'd', 'e'].map(id => topic(id, newTime));
assert.equal(mergeTopicsByNewest([], durableFive).length, 5);

// The Start Pipeline action can no longer retain its old timestamp and lose a
// tie against another device's pre-pipeline representation.
const beforePipeline = { ...topic('pipeline', oldTime), inProgress: false };
const afterPipeline = prepareLocalTopicMutation(
  [beforePipeline], [{ ...beforePipeline, inProgress: true }], newTime
)[0];
assert.equal(afterPipeline.inProgress, true);
assert.equal(afterPipeline.lastUpdated, newTime);

// Progressed status/workflow fields normalize pipeline membership even when
// legacy data omitted the redundant inProgress flag.
assert.equal(normalizeTopicWorkflowState({ ...beforePipeline, status: 'scripted' }).inProgress, true);

console.log('topic sync race, convergence, newest-write and deletion tests passed');

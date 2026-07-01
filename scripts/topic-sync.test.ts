import assert from 'node:assert/strict';
import type { Topic } from '../src/types';
import { mergeRemoteWithPendingTopics, mergeTopicsByNewest } from '../src/lib/topicSync';

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

// A clean local copy is replaced by the current server snapshot.
assert.deepEqual(
  mergeRemoteWithPendingTopics([topic('server', newTime)], [topic('stale-local', oldTime)], new Set()).map(t => t.id),
  ['server']
);

// A deletion tombstone defeats a snapshot older than the deletion.
assert.deepEqual(
  mergeTopicsByNewest([topic('deleted', oldTime)], [], { deleted: newTime }),
  []
);

console.log('topic sync race, convergence, newest-write and deletion tests passed');

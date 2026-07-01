import assert from 'node:assert/strict';
import type { Topic } from '../src/types';
import { mergeRemoteWithPendingTopics, mergeTopicsByNewest } from '../src/lib/topicSync';

const makeTopic = (id: string, status: Topic['status'] = 'topic'): Topic => ({
  id, name: id === 'soak-primary' ? 'A for apple' : 'Second device topic', description: '',
  channel: 'LearnDriven', status, priority: 3, dueDate: null,
  createdDate: new Date().toISOString(), lastUpdated: new Date().toISOString()
});

let local = [makeTopic('soak-primary')];
let remote: Topic[] = [];
let dirty = new Set(['soak-primary']);
const statuses: Topic['status'][] = ['topic', 'scripted', 'shot', 'edited', 'scheduled', 'posted'];

for (let second = 0; second < 60; second++) {
  // Reproduce stale realtime/reconciliation repeatedly while a mutation is pending.
  local = mergeRemoteWithPendingTopics(remote, local, dirty);
  assert(local.some(topic => topic.id === 'soak-primary'), `primary vanished at second ${second}`);

  if (second > 0 && second % 8 === 0) {
    const nextStatus = statuses[Math.min(second / 8, statuses.length - 1)];
    local = local.map(topic => topic.id === 'soak-primary'
      ? { ...topic, status: nextStatus, lastUpdated: new Date().toISOString() }
      : topic);
    dirty.add('soak-primary');
  }

  // Successful versioned acknowledgement and a concurrent device create.
  if (second === 3) {
    remote = mergeTopicsByNewest(remote, local);
    dirty.clear();
  }
  if (second === 15) remote = mergeTopicsByNewest(remote, [makeTopic('soak-secondary')]);
  if (second >= 15) {
    local = mergeRemoteWithPendingTopics(remote, local, dirty);
    assert(local.some(topic => topic.id === 'soak-secondary'), `second-device topic missing at second ${second}`);
  }

  // Acknowledge each later workflow mutation, as Supabase would after its CAS write.
  if (dirty.size && second % 8 === 2) {
    remote = mergeTopicsByNewest(remote, local);
    dirty.clear();
  }
  await new Promise(resolve => setTimeout(resolve, 1000));
}

assert.equal(local.find(topic => topic.id === 'soak-primary')?.status, 'posted');
assert.equal(new Set(local.map(topic => topic.id)).size, 2);
console.log('60-second topic persistence/status/concurrent-device soak passed');

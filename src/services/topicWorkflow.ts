import { Topic } from '../types';

export type TopicWorkflowStage = 'script' | 'shoot' | 'edit' | 'schedule' | 'post';
export type TopicWorkflowState = 'pending' | 'in-progress' | 'completed';

export const TOPIC_WORKFLOW_STAGES: TopicWorkflowStage[] = ['script', 'shoot', 'edit', 'schedule', 'post'];

const COMPLETED_STATUS: Record<TopicWorkflowStage, Topic['status']> = {
  script: 'scripted',
  shoot: 'shot',
  edit: 'edited',
  schedule: 'scheduled',
  post: 'posted',
};

const LABELS: Record<TopicWorkflowStage, Record<TopicWorkflowState, string>> = {
  script: { pending: 'Script', 'in-progress': 'Scripting', completed: 'Scripted' },
  shoot: { pending: 'Shoot', 'in-progress': 'Shooting', completed: 'Shot' },
  edit: { pending: 'Edit', 'in-progress': 'Editing', completed: 'Edited' },
  schedule: { pending: 'Schedule', 'in-progress': 'Scheduling', completed: 'Scheduled' },
  post: { pending: 'Post', 'in-progress': 'Posting', completed: 'Posted' },
};

export function getTopicWorkflowState(topic: Topic, stage: TopicWorkflowStage): TopicWorkflowState {
  const explicitState = topic.workflowStatuses?.[stage];
  if (explicitState) return explicitState;

  const legacyOrder: Topic['status'][] = ['topic', 'scripted', 'shot', 'edited', 'scheduled', 'posted'];
  return legacyOrder.indexOf(topic.status) >= legacyOrder.indexOf(COMPLETED_STATUS[stage])
    ? 'completed'
    : 'pending';
}

export function getTopicCurrentWorkflow(topic: Topic) {
  const inProgressStage = [...TOPIC_WORKFLOW_STAGES]
    .reverse()
    .find(stage => getTopicWorkflowState(topic, stage) === 'in-progress');
  if (inProgressStage) {
    return { stage: inProgressStage, state: 'in-progress' as const, label: LABELS[inProgressStage]['in-progress'] };
  }

  const completedStage = [...TOPIC_WORKFLOW_STAGES]
    .reverse()
    .find(stage => getTopicWorkflowState(topic, stage) === 'completed');
  if (completedStage) {
    return { stage: completedStage, state: 'completed' as const, label: LABELS[completedStage].completed };
  }

  return { stage: 'script' as const, state: 'pending' as const, label: 'Topic' };
}

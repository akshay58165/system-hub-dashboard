import { GitHubRepo, VercelProject, SupabaseProject, SystemEvent, Topic, TopicActivity } from './types';

export const initialSystemEvents: SystemEvent[] = [];
export const initialGitHubRepos: GitHubRepo[] = [];
export const initialVercelProjects: VercelProject[] = [];

export const initialSupabaseProject: SupabaseProject = {
  id: 'sub-proj-1',
  name: 'content-pipeline',
  status: 'active',
  region: 'default',
  dbVersion: 'Content Engine v1.0',
  tables: [],
  authUsers: [],
  apiLogs: [],
  metrics: {
    dbSize: '0 MB',
    activeConnections: 0,
    cpuUsage: 0,
    memoryUsage: 0,
  },
};

// Real accounts start with zero topics/activities — there is no sample/demo
// seed data. Every topic and activity a user sees must come from something
// they actually did (added via Inventory, or auto-logged from a real action).
export const initialTopics: Topic[] = [];
export const initialActivities: TopicActivity[] = [];

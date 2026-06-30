import { GitHubRepo, VercelProject, SupabaseProject, SystemEvent, Topic, TopicActivity, VideoRecord, Experiment, CreatorInsight } from './types';

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

export const initialTopics: Topic[] = [];
export const initialActivities: TopicActivity[] = [];

// Clean datasets: no fabricated or placeholder data. Everything is populated live via APIs or User Input.
export const initialVideos: VideoRecord[] = [];
export const initialExperiments: Experiment[] = [];
export const initialCreatorInsights: CreatorInsight[] = [];

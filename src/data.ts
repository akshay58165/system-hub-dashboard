import { GitHubRepo, VercelProject, SupabaseProject, SystemEvent, SupabaseTable, Topic, TopicActivity } from './types';

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

// SQL parser simulation for the interactive query console
export function runSqlSimulation(sql: string, tables: SupabaseTable[]): { success: boolean; message: string; rows?: Record<string, any>[]; columns?: string[] } {
  const cleanSql = sql.trim().replace(/;$/, '').toLowerCase();
  
  if (cleanSql.startsWith('select')) {
    const match = sql.match(/from\s+([a-zA-Z0-9_]+)/i);
    if (!match) {
      return { success: false, message: 'SQL Error: Syntax error or unsupported SELECT. Provide "FROM <table_name>".' };
    }
    const tableName = match[1].toLowerCase();
    const table = tables.find(t => t.name.toLowerCase() === tableName);
    if (!table) {
      return { success: false, message: `SQL Error: relation "${tableName}" does not exist` };
    }
    
    let resultRows = [...table.rows];
    
    const whereMatch = sql.match(/where\s+(.+)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].toLowerCase();
      if (whereClause.includes('status')) {
        const statusMatch = whereClause.match(/status\s*=\s*['"](.+)['"]/i);
        if (statusMatch) {
          const status = statusMatch[1];
          resultRows = resultRows.filter(r => r.status && r.status.toLowerCase() === status.toLowerCase());
        }
      } else if (whereClause.includes('channel')) {
        const channelMatch = whereClause.match(/channel\s*=\s*['"](.+)['"]/i);
        if (channelMatch) {
          const channel = channelMatch[1];
          resultRows = resultRows.filter(r => r.channel && r.channel.toLowerCase() === channel.toLowerCase());
        }
      }
    }
    
    const columns = table.columns.map(c => c.name);
    return {
      success: true,
      message: `Success: SELECT returned ${resultRows.length} rows from "${table.name}".`,
      rows: resultRows,
      columns,
    };
  }
  
  if (cleanSql.startsWith('insert')) {
    const match = sql.match(/into\s+([a-zA-Z0-9_]+)/i);
    if (!match) {
      return { success: false, message: 'SQL Error: Syntax error in INSERT statement.' };
    }
    const tableName = match[1].toLowerCase();
    const table = tables.find(t => t.name.toLowerCase() === tableName);
    if (!table) {
      return { success: false, message: `SQL Error: relation "${tableName}" does not exist` };
    }
    
    return {
      success: true,
      message: `Row simulated successfully! Use the Table Editor to write persistent rows, or execute 'SELECT * FROM ${table.name}' to see current items.`,
    };
  }
  
  return {
    success: false,
    message: 'SQL execution error: Only SELECT statements are fully supported in the query console. Use SELECT queries or the interactive Table Editor.',
  };
}

export const initialTopics: Topic[] = [];

export const initialActivities: TopicActivity[] = [];

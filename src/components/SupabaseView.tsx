import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clapperboard, 
  Terminal, 
  Users, 
  Plus, 
  Trash2, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  FileSpreadsheet, 
  Clock
} from 'lucide-react';
import { SupabaseProject, SupabaseApiLog, SystemEvent, Topic, TopicActivity } from '../types';

interface SupabaseViewProps {
  supabase: SupabaseProject;
  onAddEvent: (evt: SystemEvent) => void;
  onUpdateSupabase: (updated: Partial<SupabaseProject>) => void;
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  activities: TopicActivity[];
  setActivities: React.Dispatch<React.SetStateAction<TopicActivity[]>>;
}

export default function SupabaseView({ 
  supabase, 
  onAddEvent, 
  onUpdateSupabase,
  topics,
  setTopics,
  activities,
  setActivities
}: SupabaseViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'tables' | 'sql' | 'auth' | 'logs'>('tables');
  
  // Mapped Table Editor states
  const [selectedTableName, setSelectedTableName] = useState<string>('topics');
  const [isAddRowOpen, setIsAddRowOpen] = useState(false);
  const [rowInputs, setRowInputs] = useState<Record<string, string>>({});

  // SQL Editor states
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM topics;');
  const [sqlResult, setSqlResult] = useState<{ success: boolean; message: string; rows?: Record<string, any>[]; columns?: string[] } | null>(null);

  // Auth/Collaborators states
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserProvider, setNewUserProvider] = useState('github');

  // Load biometrics logs from localStorage
  const biometricsLogs = useMemo(() => {
    try {
      const stored = localStorage.getItem('unicorn_scorecard_db_logs');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }
    return [
      { id: 'log-1', timestamp: new Date().toISOString(), parameter: 'Sleep Quality', oldValue: 'N/A', newValue: 8.5 },
      { id: 'log-2', timestamp: new Date(Date.now() - 3600000).toISOString(), parameter: 'Deep Work Session', oldValue: 'N/A', newValue: 4 }
    ];
  }, [supabase.apiLogs]); // Refresh logs when actions occur

  // Active relations mock metadata definitions
  const activeTables = useMemo(() => {
    return [
      {
        name: 'topics',
        rowCount: topics.length,
        columns: [
          { name: 'id', type: 'text' },
          { name: 'name', type: 'text' },
          { name: 'channel', type: 'text' },
          { name: 'status', type: 'text' },
          { name: 'priority', type: 'bigint' },
          { name: 'dueDate', type: 'timestamp' }
        ],
        rows: topics
      },
      {
        name: 'activities',
        rowCount: activities.length,
        columns: [
          { name: 'id', type: 'text' },
          { name: 'topicName', type: 'text' },
          { name: 'channel', type: 'text' },
          { name: 'action', type: 'text' },
          { name: 'author', type: 'text' },
          { name: 'timestamp', type: 'timestamp' }
        ],
        rows: activities
      },
      {
        name: 'biometrics_logs',
        rowCount: biometricsLogs.length,
        columns: [
          { name: 'id', type: 'text' },
          { name: 'timestamp', type: 'timestamp' },
          { name: 'parameter', type: 'text' },
          { name: 'oldValue', type: 'text' },
          { name: 'newValue', type: 'numeric' }
        ],
        rows: biometricsLogs
      }
    ];
  }, [topics, activities, biometricsLogs]);

  const selectedTable = activeTables.find(t => t.name === selectedTableName) || activeTables[0];

  // SQL Quick Templates
  const sqlTemplates = [
    { label: 'Select Topics', sql: 'SELECT * FROM topics;' },
    { label: 'Select Activities', sql: 'SELECT * FROM activities;' },
    { label: 'Select Biometrics', sql: 'SELECT * FROM biometrics_logs;' },
  ];

  // Execute SQL simulation
  const handleRunSql = (query: string) => {
    const q = query.trim().toLowerCase();
    
    let resultRows: Record<string, any>[] = [];
    let resultColumns: string[] = [];
    
    if (q.includes('from topics')) {
      let filtered = [...topics];
      if (q.includes("status = 'scheduled'") || q.includes("status='scheduled'")) {
        filtered = filtered.filter(t => t.status === 'scheduled');
      } else if (q.includes("channel = 'learndriven'") || q.includes("channel='learndriven'")) {
        filtered = filtered.filter(t => t.channel === 'LearnDriven');
      } else if (q.includes("channel = 'decodeworthy'") || q.includes("channel='decodeworthy'")) {
        filtered = filtered.filter(t => t.channel === 'DecodeWorthy');
      }
      resultRows = filtered;
      resultColumns = ['id', 'name', 'channel', 'status', 'priority', 'dueDate'];
    } else if (q.includes('from activities')) {
      resultRows = activities;
      resultColumns = ['id', 'topicName', 'channel', 'action', 'author', 'timestamp'];
    } else if (q.includes('from biometrics_logs')) {
      resultRows = biometricsLogs;
      resultColumns = ['id', 'timestamp', 'parameter', 'oldValue', 'newValue'];
    } else {
      setSqlResult({
        success: false,
        message: 'ERROR: Table target not found or syntax error in query console.'
      });
      return;
    }

    setSqlResult({
      success: true,
      message: `Success: SQL query returned ${resultRows.length} rows.`,
      rows: resultRows,
      columns: resultColumns
    });

    onAddEvent({
      id: `evt-sb-sql-${Date.now()}`,
      source: 'supabase',
      type: 'success',
      message: `Action Hub SQL: Executed query "${query.substring(0, 45)}${query.length > 45 ? '...' : ''}"`,
      timestamp: new Date().toISOString()
    });
  };

  // Create Row inside Table Editor
  const handleAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;

    if (selectedTableName === 'topics') {
      const newTopic: Topic = {
        id: rowInputs.id || `t-manual-${Date.now()}`,
        name: rowInputs.name || 'Untitled Content Idea',
        description: rowInputs.description || '',
        channel: (rowInputs.channel as 'LearnDriven' | 'DecodeWorthy') || 'LearnDriven',
        status: (rowInputs.status as 'topic' | 'scripted' | 'shot' | 'edited' | 'scheduled') || 'topic',
        priority: (parseInt(rowInputs.priority) as 1 | 2 | 3 | 4 | 5) || 1,
        dueDate: rowInputs.dueDate ? new Date(rowInputs.dueDate).toISOString() : null,
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      setTopics(prev => [newTopic, ...prev]);

      // Add log
      const newActivity: TopicActivity = {
        id: `act-manual-${Date.now()}`,
        topicName: newTopic.name,
        channel: newTopic.channel,
        action: `Inserted topic row manually in ${newTopic.status} stage`,
        author: 'db_admin',
        timestamp: new Date().toISOString()
      };
      setActivities(prev => [newActivity, ...prev]);
    } else if (selectedTableName === 'activities') {
      const newAct: TopicActivity = {
        id: rowInputs.id || `act-manual-${Date.now()}`,
        topicName: rowInputs.topicName || 'Generic Topic Task',
        channel: (rowInputs.channel as 'LearnDriven' | 'DecodeWorthy') || 'LearnDriven',
        action: rowInputs.action || 'Performed database schema update',
        author: rowInputs.author || 'db_admin',
        timestamp: rowInputs.timestamp || new Date().toISOString()
      };
      setActivities(prev => [newAct, ...prev]);
    } else if (selectedTableName === 'biometrics_logs') {
      const newLog = {
        id: rowInputs.id || `log-${Date.now()}`,
        timestamp: rowInputs.timestamp || new Date().toISOString(),
        parameter: rowInputs.parameter || 'Sleep Quality',
        oldValue: rowInputs.oldValue || 'N/A',
        newValue: parseFloat(rowInputs.newValue) || 7.5
      };
      const updatedLogs = [newLog, ...biometricsLogs];
      localStorage.setItem('unicorn_scorecard_db_logs', JSON.stringify(updatedLogs));
    }

    // Add API connection telemetry log
    const newApiLog: SupabaseApiLog = {
      id: `log-${Date.now()}`,
      method: 'POST',
      path: `/rest/v1/${selectedTable.name}`,
      status: 201,
      latencyMs: 22,
      timestamp: new Date().toISOString()
    };

    onUpdateSupabase({
      apiLogs: [newApiLog, ...supabase.apiLogs]
    });

    onAddEvent({
      id: `evt-sb-cr-${Date.now()}`,
      source: 'supabase',
      type: 'success',
      message: `Action Hub: Created a new record in relation table "${selectedTable.name}"`,
      timestamp: new Date().toISOString()
    });

    setRowInputs({});
    setIsAddRowOpen(false);
  };

  // Delete Row from Table Editor
  const handleDeleteRow = (id: string, index: number) => {
    if (selectedTableName === 'topics') {
      setTopics(prev => prev.filter(t => t.id !== id));
    } else if (selectedTableName === 'activities') {
      setActivities(prev => prev.filter(a => a.id !== id));
    } else if (selectedTableName === 'biometrics_logs') {
      const updatedLogs = biometricsLogs.filter((l: any) => l.id !== id);
      localStorage.setItem('unicorn_scorecard_db_logs', JSON.stringify(updatedLogs));
    }

    // Add API telemetry log
    const newApiLog: SupabaseApiLog = {
      id: `log-${Date.now()}`,
      method: 'DELETE',
      path: `/rest/v1/${selectedTable.name}?id=eq.${id}`,
      status: 200,
      latencyMs: 15,
      timestamp: new Date().toISOString()
    };

    onUpdateSupabase({
      apiLogs: [newApiLog, ...supabase.apiLogs]
    });

    onAddEvent({
      id: `evt-sb-dl-${Date.now()}`,
      source: 'supabase',
      type: 'warning',
      message: `Action Hub: Deleted a record from relation table "${selectedTable.name}"`,
      timestamp: new Date().toISOString()
    });
  };

  // Create Auth User (Collaborators)
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail) return;

    const newUser = {
      id: `usr-${Date.now()}`,
      email: newUserEmail,
      provider: newUserProvider,
      lastSignIn: 'Never signed in',
      createdAt: new Date().toISOString(),
      status: 'active' as const
    };

    onUpdateSupabase({
      authUsers: [newUser, ...supabase.authUsers]
    });

    const newApiLog: SupabaseApiLog = {
      id: `log-${Date.now()}`,
      method: 'POST',
      path: '/auth/v1/invite',
      status: 200,
      latencyMs: 38,
      timestamp: new Date().toISOString()
    };

    onUpdateSupabase({
      apiLogs: [newApiLog, ...supabase.apiLogs]
    });

    onAddEvent({
      id: `evt-sb-usr-${Date.now()}`,
      source: 'supabase',
      type: 'success',
      message: `Action Hub: Invited collaborator "${newUserEmail}" with access role provider "${newUserProvider}"`,
      timestamp: new Date().toISOString()
    });

    setNewUserEmail('');
    setIsAddUserOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Selector banner (Supabase cluster header) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-950 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300">
            <Clapperboard className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-100 font-mono">content-engine/pipeline-control</h2>
            <p className="text-xs text-neutral-400">Manage content tables, run queries on topics & activities, and coordinate team collaborators.</p>
          </div>
        </div>

        <div className="flex gap-1.5 font-mono text-xs bg-neutral-900 p-1 border border-neutral-800 rounded-lg">
          <span className="px-2 py-0.5 text-neutral-400">Channels: 2 Active</span>
          <span className="text-neutral-600">|</span>
          <span className="px-2 py-0.5 text-emerald-400 font-bold">● PIPELINE OK</span>
        </div>
      </div>

      {/* Hardware Performance Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(() => {
          const totalTopics = topics.length;
          const scheduledTopics = topics.filter(t => t.status === 'scheduled').length;
          const inProgressTopics = topics.filter(t => t.status !== 'topic' && t.status !== 'scheduled').length;
          const pendingTopics = topics.filter(t => t.status === 'topic').length;
          const throughputPct = totalTopics > 0 ? Math.round((scheduledTopics / totalTopics) * 100) : 0;
          const collabCount = supabase.authUsers.length;
          return (
            <>
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Total Topics</span>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-xl font-bold font-mono text-white">{totalTopics}</span>
                  <span className="text-[10px] text-neutral-500 font-mono">across channels</span>
                </div>
                <div className="w-full bg-neutral-900 rounded-full h-1 mt-2.5 overflow-hidden">
                  <div className="bg-emerald-500 h-1 rounded-full" style={{ width: totalTopics > 0 ? '100%' : '0%' }} />
                </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Team Members</span>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-xl font-bold font-mono text-white">{collabCount}</span>
                  <span className="text-[10px] text-neutral-500 font-mono">collaborators</span>
                </div>
                <div className="w-full bg-neutral-900 rounded-full h-1 mt-2.5 overflow-hidden">
                  <div className="bg-emerald-500 h-1 rounded-full" style={{ width: collabCount > 0 ? `${Math.min(collabCount * 20, 100)}%` : '0%' }} />
                </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Completion Rate</span>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-xl font-bold font-mono text-white">{throughputPct}%</span>
                  <span className="text-[10px] text-emerald-400 font-mono">{throughputPct >= 50 ? 'On Track' : throughputPct > 0 ? 'In Progress' : 'No Data'}</span>
                </div>
                <div className="w-full bg-neutral-900 rounded-full h-1 mt-2.5 overflow-hidden">
                  <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${throughputPct}%` }} />
                </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Pending Actions</span>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-xl font-bold font-mono text-white">{inProgressTopics + pendingTopics}</span>
                  <span className="text-[10px] text-neutral-500 font-mono">items in pipeline</span>
                </div>
                <div className="w-full bg-neutral-900 rounded-full h-1 mt-2.5 overflow-hidden">
                  <div className="bg-emerald-500 h-1 rounded-full" style={{ width: totalTopics > 0 ? `${Math.round(((inProgressTopics + pendingTopics) / totalTopics) * 100)}%` : '0%' }} />
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* Main Section */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
        {/* Sub Navigation Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/40">
          <button 
            onClick={() => setActiveSubTab('tables')}
            className={`px-4 py-3 text-xs font-mono font-semibold border-r border-neutral-800 flex items-center gap-1.5 transition ${
              activeSubTab === 'tables' ? 'bg-neutral-950 text-emerald-400 border-b-2 border-b-emerald-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Table Editor</span>
          </button>

          <button 
            onClick={() => setActiveSubTab('sql')}
            className={`px-4 py-3 text-xs font-mono font-semibold border-r border-neutral-800 flex items-center gap-1.5 transition ${
              activeSubTab === 'sql' ? 'bg-neutral-950 text-emerald-400 border-b-2 border-b-emerald-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>SQL Console</span>
          </button>

          <button 
            onClick={() => setActiveSubTab('auth')}
            className={`px-4 py-3 text-xs font-mono font-semibold border-r border-neutral-800 flex items-center gap-1.5 transition ${
              activeSubTab === 'auth' ? 'bg-neutral-950 text-emerald-400 border-b-2 border-b-emerald-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Auth Users</span>
          </button>

          <button 
            onClick={() => setActiveSubTab('logs')}
            className={`px-4 py-3 text-xs font-mono font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'logs' ? 'bg-neutral-950 text-emerald-400 border-b-2 border-b-emerald-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>API Telemetry Logs</span>
          </button>
        </div>

        {/* Sub Content area */}
        <div className="p-5 flex-1 flex flex-col">
          
          {/* Sub Tab: Table Editor */}
          {activeSubTab === 'tables' && (
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-neutral-400">Active Relation:</span>
                  <div className="flex gap-1">
                    {activeTables.map(t => (
                      <button
                        key={t.name}
                        onClick={() => {
                          setSelectedTableName(t.name);
                          setIsAddRowOpen(false);
                          setRowInputs({});
                        }}
                        className={`px-2.5 py-1 border rounded text-[10px] font-mono transition ${
                          selectedTableName === t.name 
                            ? 'bg-emerald-950 border-emerald-800 text-emerald-400'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {t.name} ({t.rowCount})
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => setIsAddRowOpen(!isAddRowOpen)}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-black rounded text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Insert Row</span>
                </button>
              </div>

              {/* Add row form */}
              {isAddRowOpen && selectedTable && (
                <motion.form 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleAddRow}
                  className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedTable.columns.map(col => (
                      <div key={col.name}>
                        <label className="block text-[10px] font-mono text-neutral-400 uppercase">
                          {col.name} <span className="text-[9px] text-neutral-500 font-normal">({col.type})</span>
                        </label>
                        <input 
                          type="text"
                          placeholder={col.name === 'id' ? 'Auto-generated ID' : `Value for ${col.name}`}
                          required={col.name !== 'id' && col.name !== 'dueDate'}
                          value={rowInputs[col.name] || ''}
                          onChange={(e) => setRowInputs(prev => ({ ...prev, [col.name]: e.target.value }))}
                          className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-800 outline-none text-xs rounded px-2.5 py-1.5 mt-1 text-white font-mono"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 text-[10px]">
                    <button 
                      type="button" 
                      onClick={() => setIsAddRowOpen(false)}
                      className="px-3 py-1.5 text-neutral-400 hover:text-neutral-200 font-mono cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold font-mono rounded cursor-pointer"
                    >
                      Save Row
                    </button>
                  </div>
                </motion.form>
              )}

              {/* Grid Table rendering */}
              <div className="flex-1 overflow-x-auto border border-neutral-800 rounded-lg max-h-[360px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-900 border-b border-neutral-800 text-[10px] text-neutral-400 font-mono sticky top-0 z-10">
                      {selectedTable.columns.map(col => (
                        <th key={col.name} className="px-4 py-2.5 font-semibold bg-neutral-900">
                          {col.name}
                          <span className="text-[8px] text-neutral-500 font-normal block italic">{col.type}</span>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 font-semibold text-right bg-neutral-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-850 font-mono text-[11px]">
                    {selectedTable.rows.map((row: any, idx) => (
                      <tr key={row.id || idx} className="hover:bg-neutral-900/40 text-neutral-300">
                        {selectedTable.columns.map(col => (
                          <td key={col.name} className="px-4 py-3 max-w-[200px] truncate">
                            <span>{row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : <span className="text-neutral-600">NULL</span>}</span>
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => handleDeleteRow(row.id || '', idx)}
                            className="p-1 hover:bg-neutral-850 rounded text-neutral-500 hover:text-rose-500 transition cursor-pointer"
                            title="Delete Row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub Tab: SQL Console */}
          {activeSubTab === 'sql' && (
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-neutral-300">Interactive Query Console</h3>
                  <p className="text-[11px] text-neutral-500 font-mono">Run SELECT queries on topics, activities, or biometrics_logs data tables.</p>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {sqlTemplates.map(tmp => (
                    <button
                      key={tmp.label}
                      onClick={() => setSqlQuery(tmp.sql)}
                      className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 text-[10px] font-mono rounded cursor-pointer"
                    >
                      {tmp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Code Area */}
              <div className="flex flex-col lg:flex-row gap-4 flex-1">
                <div className="flex-1 flex flex-col space-y-2">
                  <div className="relative flex-1 min-h-[180px] bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 flex flex-col">
                    <textarea
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      className="w-full flex-1 bg-neutral-950 p-4 font-mono text-xs text-neutral-300 outline-none resize-none focus:border-emerald-800"
                    />
                    
                    <button 
                      onClick={() => handleRunSql(sqlQuery)}
                      className="absolute bottom-3 right-3 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold font-mono rounded text-xs flex items-center gap-1 transition shadow-lg cursor-pointer"
                    >
                      <Play className="h-3 w-3 fill-black" />
                      <span>Run SQL</span>
                    </button>
                  </div>
                </div>

                {/* SQL Result Console Output */}
                <div className="lg:w-1/2 flex flex-col">
                  <div className="flex-1 bg-neutral-950 rounded-lg border border-neutral-800 p-4 font-mono text-xs overflow-y-auto min-h-[180px] space-y-2">
                    <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Console Result Output</span>
                    
                    {sqlResult ? (
                      <div className="space-y-3 pt-2">
                        <div className={`p-2 rounded text-[11px] ${sqlResult.success ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50' : 'bg-rose-950/40 text-rose-400 border border-rose-900/50'}`}>
                          <div className="flex items-center gap-1.5">
                            {sqlResult.success ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                            <span>{sqlResult.message}</span>
                          </div>
                        </div>

                        {sqlResult.success && sqlResult.rows && sqlResult.rows.length > 0 && (
                          <div className="border border-neutral-850 rounded overflow-x-auto max-h-[140px]">
                            <table className="w-full text-left text-[10px]">
                              <thead>
                                <tr className="bg-neutral-900 text-neutral-400 border-b border-neutral-800 sticky top-0">
                                  {sqlResult.columns?.map(c => (
                                    <th key={c} className="px-2.5 py-1.5 font-semibold font-mono bg-neutral-900">{c}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sqlResult.rows.map((row, idx) => (
                                  <tr key={idx} className="border-b border-neutral-850/50 hover:bg-neutral-900/20 text-neutral-300">
                                    {sqlResult.columns?.map(c => (
                                      <td key={c} className="px-2.5 py-1.5 truncate max-w-[120px]">{row[c] !== undefined ? String(row[c]) : 'null'}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-neutral-500 italic py-4">Terminal ready. Click "Run SQL" to execute queries on active relations.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub Tab: Auth Users */}
          {activeSubTab === 'auth' && (
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-semibold text-neutral-300">Authentication Manager</h3>
                  <p className="text-[11px] text-neutral-500">Invite, configure and coordinate active content team developers or script collaborators.</p>
                </div>

                <button 
                  onClick={() => setIsAddUserOpen(!isAddUserOpen)}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-black rounded text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Auth User</span>
                </button>
              </div>

              {/* Add User form */}
              {isAddUserOpen && (
                <motion.form 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleAddUser}
                  className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 uppercase">User Email Address</label>
                      <input 
                        type="email"
                        required
                        placeholder="collaborator@gmail.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-800 outline-none text-xs rounded px-2.5 py-1.5 mt-1 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 uppercase">Access Provider</label>
                      <select
                        value={newUserProvider}
                        onChange={(e) => setNewUserProvider(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 outline-none text-xs rounded px-2.5 py-1.5 mt-1 text-white font-mono"
                      >
                        <option value="github">GitHub</option>
                        <option value="google">Google</option>
                        <option value="email">Email Invite</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 text-[10px]">
                    <button 
                      type="button" 
                      onClick={() => setIsAddUserOpen(false)}
                      className="px-3 py-1.5 text-neutral-400 hover:text-neutral-200 font-mono cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold font-mono rounded cursor-pointer"
                    >
                      Invite User
                    </button>
                  </div>
                </motion.form>
              )}

              {/* Users list */}
              <div className="flex-1 border border-neutral-800 rounded-lg overflow-x-auto max-h-[300px]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-900 border-b border-neutral-800 text-[10px] text-neutral-400 font-mono sticky top-0">
                      <th className="px-4 py-2.5 bg-neutral-900">User UUID</th>
                      <th className="px-4 py-2.5 bg-neutral-900">Email</th>
                      <th className="px-4 py-2.5 bg-neutral-900">Provider</th>
                      <th className="px-4 py-2.5 bg-neutral-900">Created Date</th>
                      <th className="px-4 py-2.5 bg-neutral-900">Last Signed In</th>
                      <th className="px-4 py-2.5 text-right bg-neutral-900">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-850 font-mono text-xs text-neutral-300">
                    {supabase.authUsers.map(usr => (
                      <tr key={usr.id} className="hover:bg-neutral-900/40">
                        <td className="px-4 py-3 text-neutral-500 text-[11px] truncate max-w-[120px]">{usr.id}</td>
                        <td className="px-4 py-3 font-semibold text-white">{usr.email}</td>
                        <td className="px-4 py-3">
                          <span className="px-1.5 py-0.2 bg-neutral-800 border border-neutral-700 text-neutral-300 rounded font-semibold text-[9px] uppercase font-mono">
                            {usr.provider}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-400 text-[11px]">{new Date(usr.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-neutral-400 text-[11px]">{usr.lastSignIn === 'Never signed in' ? 'Never' : new Date(usr.lastSignIn).toLocaleTimeString()}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-400 border border-emerald-900 rounded font-semibold text-[9px] uppercase font-mono">
                            {usr.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub Tab: API Telemetry logs */}
          {activeSubTab === 'logs' && (
            <div className="space-y-4 flex-1 flex flex-col">
              <div>
                <h3 className="text-xs font-semibold text-neutral-300">Action Log Stream</h3>
                <p className="text-[11px] text-neutral-500 font-mono">Tracking all insert, update, and delete operations across content tables.</p>
              </div>

              <div className="flex-1 border border-neutral-800 rounded-lg overflow-hidden">
                <div className="bg-neutral-900 px-4 py-2 flex items-center justify-between font-mono text-[10px] text-neutral-500 border-b border-neutral-800">
                  <span>API CALL ENDPOINT</span>
                  <div className="flex gap-4">
                    <span>LATENCY</span>
                    <span>STATUS</span>
                  </div>
                </div>

                <div className="divide-y divide-neutral-850 max-h-[300px] overflow-y-auto bg-neutral-950 font-mono text-xs">
                  {supabase.apiLogs.map(log => (
                    <div key={log.id} className="px-4 py-3 hover:bg-neutral-900/40 flex items-center justify-between text-neutral-300 gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.method === 'GET' ? 'bg-blue-950 text-blue-400 border border-blue-900' :
                          log.method === 'POST' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' :
                          log.method === 'DELETE' ? 'bg-rose-950 text-rose-400 border border-rose-900' :
                          'bg-neutral-800 text-neutral-300'
                        }`}>
                          {log.method}
                        </span>
                        <span className="truncate text-neutral-200">{log.path}</span>
                        <span className="text-[10px] text-neutral-500 hidden sm:inline">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center gap-6 shrink-0 text-right">
                        <span className="text-[11px] text-neutral-400">{log.latencyMs}ms</span>
                        <span className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                          log.status >= 200 && log.status < 300 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                        }`}>
                          {log.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

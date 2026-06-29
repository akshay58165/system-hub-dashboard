import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Terminal, 
  Users, 
  Server, 
  Settings, 
  Plus, 
  Trash2, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  FileSpreadsheet, 
  Sparkles, 
  Search, 
  ShieldAlert, 
  KeyRound,
  RefreshCw,
  Clock,
  Code
} from 'lucide-react';
import { SupabaseProject, SupabaseTable, SupabaseUser, SupabaseApiLog, SystemEvent } from '../types';
import { runSqlSimulation } from '../data';

interface SupabaseViewProps {
  supabase: SupabaseProject;
  onAddEvent: (evt: SystemEvent) => void;
  onUpdateSupabase: (updated: Partial<SupabaseProject>) => void;
}

export default function SupabaseView({ supabase, onAddEvent, onUpdateSupabase }: SupabaseViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'tables' | 'sql' | 'auth' | 'logs'>('tables');
  
  // Table Editor states
  const [selectedTableName, setSelectedTableName] = useState<string>(supabase.tables[0]?.name || '');
  const [isAddRowOpen, setIsAddRowOpen] = useState(false);
  const [rowInputs, setRowInputs] = useState<Record<string, string>>({});

  // SQL Editor states
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM profiles;');
  const [sqlResult, setSqlResult] = useState<{ success: boolean; message: string; rows?: Record<string, any>[]; columns?: string[] } | null>(null);

  // Auth states
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserProvider, setNewUserProvider] = useState('github');

  const selectedTable = supabase.tables.find(t => t.name === selectedTableName) || supabase.tables[0];

  // SQL Quick Templates
  const sqlTemplates = [
    { label: 'Select Profiles', sql: 'SELECT * FROM profiles;' },
    { label: 'Select Posts', sql: 'SELECT * FROM posts WHERE published = true;' },
    { label: 'Select Transactions', sql: 'SELECT * FROM transactions WHERE amount > 100;' },
  ];

  // Execute SQL simulation
  const handleRunSql = (query: string) => {
    const result = runSqlSimulation(query, supabase.tables);
    setSqlResult(result);

    onAddEvent({
      id: `evt-sb-sql-${Date.now()}`,
      source: 'supabase',
      type: result.success ? 'success' : 'error',
      message: `Supabase SQL: Executed query "${query.substring(0, 45)}${query.length > 45 ? '...' : ''}"`,
      timestamp: new Date().toISOString()
    });
  };

  // Create Row
  const handleAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable) return;

    // Build the row object
    const newRow: Record<string, any> = {};
    selectedTable.columns.forEach(col => {
      const inputVal = rowInputs[col.name];
      if (col.type === 'bigint') {
        newRow[col.name] = parseInt(inputVal) || Date.now();
      } else if (col.type === 'numeric') {
        newRow[col.name] = parseFloat(inputVal) || 0.0;
      } else if (col.type === 'boolean') {
        newRow[col.name] = inputVal === 'true';
      } else {
        newRow[col.name] = inputVal || (col.name === 'id' ? `uuid_${Math.random().toString(36).substring(2, 9)}` : '');
      }
    });

    const updatedTables = supabase.tables.map(t => {
      if (t.name === selectedTable.name) {
        return {
          ...t,
          rowCount: t.rowCount + 1,
          rows: [...t.rows, newRow]
        };
      }
      return t;
    });

    onUpdateSupabase({ tables: updatedTables });
    
    // Add API log
    const newApiLog: SupabaseApiLog = {
      id: `log-${Date.now()}`,
      method: 'POST',
      path: `/rest/v1/${selectedTable.name}`,
      status: 201,
      latencyMs: 24,
      timestamp: new Date().toISOString()
    };

    onUpdateSupabase({
      apiLogs: [newApiLog, ...supabase.apiLogs]
    });

    onAddEvent({
      id: `evt-sb-cr-${Date.now()}`,
      source: 'supabase',
      type: 'success',
      message: `Supabase: Created a new record in table "${selectedTable.name}"`,
      timestamp: new Date().toISOString()
    });

    setRowInputs({});
    setIsAddRowOpen(false);
  };

  // Delete Row
  const handleDeleteRow = (index: number) => {
    if (!selectedTable) return;

    const rowToDelete = selectedTable.rows[index];
    const updatedRows = selectedTable.rows.filter((_, i) => i !== index);

    const updatedTables = supabase.tables.map(t => {
      if (t.name === selectedTable.name) {
        return {
          ...t,
          rowCount: Math.max(0, t.rowCount - 1),
          rows: updatedRows
        };
      }
      return t;
    });

    onUpdateSupabase({ tables: updatedTables });

    // Add API log
    const newApiLog: SupabaseApiLog = {
      id: `log-${Date.now()}`,
      method: 'DELETE',
      path: `/rest/v1/${selectedTable.name}?id=eq.${rowToDelete.id || index}`,
      status: 200,
      latencyMs: 18,
      timestamp: new Date().toISOString()
    };

    onUpdateSupabase({
      apiLogs: [newApiLog, ...supabase.apiLogs]
    });

    onAddEvent({
      id: `evt-sb-dl-${Date.now()}`,
      source: 'supabase',
      type: 'warning',
      message: `Supabase: Deleted a record from table "${selectedTable.name}"`,
      timestamp: new Date().toISOString()
    });
  };

  // Create Auth User
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail) return;

    const newUser: SupabaseUser = {
      id: `usr-${Date.now()}`,
      email: newUserEmail,
      provider: newUserProvider,
      lastSignIn: 'Never signed in',
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    onUpdateSupabase({
      authUsers: [newUser, ...supabase.authUsers]
    });

    // Add API log
    const newApiLog: SupabaseApiLog = {
      id: `log-${Date.now()}`,
      method: 'POST',
      path: '/auth/v1/signup',
      status: 200,
      latencyMs: 45,
      timestamp: new Date().toISOString()
    };

    onUpdateSupabase({
      apiLogs: [newApiLog, ...supabase.apiLogs]
    });

    onAddEvent({
      id: `evt-sb-usr-${Date.now()}`,
      source: 'supabase',
      type: 'success',
      message: `Supabase Auth: Created new auth user account "${newUserEmail}" with provider "${newUserProvider}"`,
      timestamp: new Date().toISOString()
    });

    setNewUserEmail('');
    setIsAddUserOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Selector banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-950 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300">
            <Database className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-100 font-mono">supabase.com/prod-cluster-east</h2>
            <p className="text-xs text-neutral-400">PostgreSQL database tables, secure API log telemetry, and User authentication credentials.</p>
          </div>
        </div>

        <div className="flex gap-1.5 font-mono text-xs bg-neutral-900 p-1 border border-neutral-800 rounded-lg">
          <span className="px-2 py-0.5 text-neutral-400">Region: us-east-1</span>
          <span className="text-neutral-600">|</span>
          <span className="px-2 py-0.5 text-emerald-400 font-bold">● CLUSTER OK</span>
        </div>
      </div>

      {/* Hardware Performance Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Allocated Disk</span>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-xl font-bold font-mono text-white">{supabase.metrics.dbSize}</span>
            <span className="text-[10px] text-neutral-500 font-mono">/ 2.0 GB</span>
          </div>
          <div className="w-full bg-neutral-900 rounded-full h-1 mt-2.5 overflow-hidden">
            <div className="bg-emerald-500 h-1 rounded-full" style={{ width: '8.2%' }} />
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Direct Connections</span>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-xl font-bold font-mono text-white">{supabase.metrics.activeConnections}</span>
            <span className="text-[10px] text-neutral-500 font-mono">active pool</span>
          </div>
          <div className="w-full bg-neutral-900 rounded-full h-1 mt-2.5 overflow-hidden">
            <div className="bg-emerald-500 h-1 rounded-full" style={{ width: '36%' }} />
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Database CPU</span>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-xl font-bold font-mono text-white">{supabase.metrics.cpuUsage}%</span>
            <span className="text-[10px] text-emerald-400 font-mono">Healthy</span>
          </div>
          <div className="w-full bg-neutral-900 rounded-full h-1 mt-2.5 overflow-hidden">
            <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${supabase.metrics.cpuUsage}%` }} />
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
          <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Allocated Memory</span>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-xl font-bold font-mono text-white">{supabase.metrics.memoryUsage}%</span>
            <span className="text-[10px] text-neutral-500 font-mono">/ 4 GB RAM</span>
          </div>
          <div className="w-full bg-neutral-900 rounded-full h-1 mt-2.5 overflow-hidden">
            <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${supabase.metrics.memoryUsage}%` }} />
          </div>
        </div>
      </div>

      {/* Main Section */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
        {/* Sub Navigation */}
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
                    {supabase.tables.map(t => (
                      <button
                        key={t.name}
                        onClick={() => {
                          setSelectedTableName(t.name);
                          setIsAddRowOpen(false);
                          setRowInputs({});
                        }}
                        className={`px-2 py-1 border rounded text-[10px] font-mono transition ${
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
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-black rounded text-[10px] font-mono font-bold flex items-center gap-1 transition"
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
                        {col.type === 'boolean' ? (
                          <select
                            value={rowInputs[col.name] || 'true'}
                            onChange={(e) => setRowInputs(prev => ({ ...prev, [col.name]: e.target.value }))}
                            className="w-full bg-neutral-950 border border-neutral-800 outline-none text-xs rounded px-2.5 py-1.5 mt-1 text-white font-mono"
                          >
                            <option value="true">True</option>
                            <option value="false">False</option>
                          </select>
                        ) : (
                          <input 
                            type="text"
                            placeholder={col.name === 'id' ? 'Auto-generated UUID' : `Enter value for ${col.name}`}
                            required={!col.isNullable && col.name !== 'id'}
                            value={rowInputs[col.name] || ''}
                            onChange={(e) => setRowInputs(prev => ({ ...prev, [col.name]: e.target.value }))}
                            className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-800 outline-none text-xs rounded px-2.5 py-1.5 mt-1 text-white font-mono"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 text-[10px]">
                    <button 
                      type="button" 
                      onClick={() => setIsAddRowOpen(false)}
                      className="px-3 py-1.5 text-neutral-400 hover:text-neutral-200 font-mono"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold font-mono rounded"
                    >
                      Save Row
                    </button>
                  </div>
                </motion.form>
              )}

              {/* Grid Table rendering */}
              <div className="flex-1 overflow-x-auto border border-neutral-800 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-900 border-b border-neutral-800 text-[10px] text-neutral-400 font-mono">
                      {selectedTable.columns.map(col => (
                        <th key={col.name} className="px-4 py-2.5 font-semibold">
                          {col.name}
                          <span className="text-[8px] text-neutral-500 font-normal block italic">{col.type}</span>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-850 font-mono text-xs">
                    {selectedTable.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-neutral-900/40 text-neutral-300">
                        {selectedTable.columns.map(col => (
                          <td key={col.name} className="px-4 py-3 max-w-[200px] truncate">
                            {col.name === 'avatar_url' && row[col.name] ? (
                              <img src={row[col.name]} alt="Avatar" className="h-6 w-6 rounded-full inline mr-1 object-cover" referrerPolicy="no-referrer" />
                            ) : null}
                            <span>{row[col.name] !== null ? String(row[col.name]) : <span className="text-neutral-600">NULL</span>}</span>
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => handleDeleteRow(idx)}
                            className="p-1 hover:bg-neutral-850 rounded text-neutral-500 hover:text-rose-500 transition"
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-neutral-300">Interactive PostgreSQL Terminal</h3>
                  <p className="text-[11px] text-neutral-500">Run safe SELECT queries directly on profiles, posts, or transactions.</p>
                </div>

                <div className="flex gap-1.5">
                  {sqlTemplates.map(tmp => (
                    <button
                      key={tmp.label}
                      onClick={() => setSqlQuery(tmp.sql)}
                      className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-200 text-[10px] font-mono rounded"
                    >
                      {tmp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Code Area */}
              <div className="flex flex-col lg:flex-row gap-4 flex-1">
                <div className="flex-1 flex flex-col space-y-2">
                  <div className="relative flex-1 min-h-[150px] bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800 flex flex-col">
                    <textarea
                      value={sqlQuery}
                      onChange={(e) => setSqlQuery(e.target.value)}
                      className="w-full flex-1 bg-neutral-950 p-4 font-mono text-xs text-neutral-300 outline-none resize-none focus:border-emerald-800"
                    />
                    
                    <button 
                      onClick={() => handleRunSql(sqlQuery)}
                      className="absolute bottom-3 right-3 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold font-mono rounded text-xs flex items-center gap-1 transition shadow-lg"
                    >
                      <Play className="h-3 w-3 fill-black" />
                      <span>Run SQL</span>
                    </button>
                  </div>
                </div>

                {/* SQL Result Console Output */}
                <div className="lg:w-1/2 flex flex-col">
                  <div className="flex-1 bg-neutral-950 rounded-lg border border-neutral-800 p-4 font-mono text-xs overflow-y-auto min-h-[150px] space-y-2">
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
                          <div className="border border-neutral-850 rounded overflow-x-auto">
                            <table className="w-full text-left text-[10px]">
                              <thead>
                                <tr className="bg-neutral-900 text-neutral-400 border-b border-neutral-800">
                                  {sqlResult.columns?.map(c => (
                                    <th key={c} className="px-2.5 py-1.5 font-semibold font-mono">{c}</th>
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
                      <p className="text-neutral-500 italic py-4">Terminal ready. Click "Run SQL" to execute queries.</p>
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
                  <p className="text-[11px] text-neutral-500">Add, track, and manage developers or auth users credentials securely.</p>
                </div>

                <button 
                  onClick={() => setIsAddUserOpen(!isAddUserOpen)}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-black rounded text-[10px] font-mono font-bold flex items-center gap-1 transition"
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
                        placeholder="developer@gmail.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-800 outline-none text-xs rounded px-2.5 py-1.5 mt-1 text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-neutral-400 uppercase">OAuth Provider</label>
                      <select
                        value={newUserProvider}
                        onChange={(e) => setNewUserProvider(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 outline-none text-xs rounded px-2.5 py-1.5 mt-1 text-white font-mono"
                      >
                        <option value="github">GitHub</option>
                        <option value="google">Google</option>
                        <option value="email">Email Sign in</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 text-[10px]">
                    <button 
                      type="button" 
                      onClick={() => setIsAddUserOpen(false)}
                      className="px-3 py-1.5 text-neutral-400 hover:text-neutral-200 font-mono"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold font-mono rounded"
                    >
                      Invite User
                    </button>
                  </div>
                </motion.form>
              )}

              {/* Users list */}
              <div className="flex-1 border border-neutral-800 rounded-lg overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-900 border-b border-neutral-800 text-[10px] text-neutral-400 font-mono">
                      <th className="px-4 py-2.5">User UUID</th>
                      <th className="px-4 py-2.5">Email</th>
                      <th className="px-4 py-2.5">Provider</th>
                      <th className="px-4 py-2.5">Created Date</th>
                      <th className="px-4 py-2.5">Last Signed In</th>
                      <th className="px-4 py-2.5 text-right">Status</th>
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
                <h3 className="text-xs font-semibold text-neutral-300">Live API logs Stream</h3>
                <p className="text-[11px] text-neutral-500 font-mono">Sub-millisecond tracking of REST, RPC and Auth edge invokes.</p>
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

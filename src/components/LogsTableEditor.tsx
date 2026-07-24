import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Search, 
  Trash2, 
  AlertCircle, 
  ArrowUpDown, 
  CheckCircle,
  Clock,
  Play
} from 'lucide-react';
import { Topic, TopicActivity, SystemEvent } from '../types';

interface LogsTableEditorProps {
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  activities: TopicActivity[];
  setActivities: React.Dispatch<React.SetStateAction<TopicActivity[]>>;
  onAddEvent: (evt: SystemEvent) => void;
  onDeleteContentItem?: (itemId: string, label: string, topicName?: string) => void;
  onDeleteActivity?: (activityId: string) => void;
}

export default function LogsTableEditor({
  topics,
  setTopics,
  activities,
  setActivities,
  onAddEvent,
  onDeleteContentItem,
  onDeleteActivity
}: LogsTableEditorProps) {
  const [selectedTable, setSelectedTable] = useState<'topics' | 'activities'>('topics');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('id');
  const [sortAsc, setSortAsc] = useState(true);

  // Sorting Handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Delete Topic Action
  const handleDeleteTopic = (topicId: string, topicName: string) => {
    onDeleteContentItem?.(topicId, topicName, topicName);
    onAddEvent({
      id: `evt-table-del-t-${Date.now()}`,
      source: 'system',
      type: 'warning',
      message: `Database: Topic "${topicName}" was queued for deletion from the topics relation table.`,
      timestamp: new Date().toISOString()
    });
  };

  // Delete Activity Action
  const handleDeleteActivity = (actId: string, actionDesc: string) => {
    onDeleteActivity?.(actId);
    onAddEvent({
      id: `evt-table-del-a-${Date.now()}`,
      source: 'system',
      type: 'warning',
      message: `Database: Activity log entry "${actionDesc.substring(0, 30)}..." queued for deletion.`,
      timestamp: new Date().toISOString()
    });
  };

  // Update Topic Status Inline
  const handleUpdateTopicStatus = (topicId: string, newStatus: Topic['status']) => {
    setTopics(prev => prev.map(t => {
      if (t.id === topicId) {
        if (t.status === newStatus) return t;
        onAddEvent({
          id: `evt-table-status-up-${Date.now()}`,
          source: 'system',
          type: 'info',
          message: `Database: Updated status of "${t.name}" inline to "${newStatus}".`,
          timestamp: new Date().toISOString()
        });
        return { ...t, status: newStatus, lastUpdated: new Date().toISOString() };
      }
      return t;
    }));
  };

  // Filter & Sort Topics
  const sortedTopics = useMemo(() => {
    const filtered = topics.filter(t => 
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.channel.toLowerCase().includes(search.toLowerCase()) ||
      t.status.toLowerCase().includes(search.toLowerCase())
    );

    return [...filtered].sort((a: any, b: any) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';
      
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [topics, search, sortField, sortAsc]);

  // Filter & Sort Activities
  const sortedActivities = useMemo(() => {
    const filtered = activities.filter(a => 
      a.topicName.toLowerCase().includes(search.toLowerCase()) ||
      a.action.toLowerCase().includes(search.toLowerCase()) ||
      a.author.toLowerCase().includes(search.toLowerCase())
    );

    return [...filtered].sort((a: any, b: any) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [activities, search, sortField, sortAsc]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100 tracking-tight flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-400" />
              Smart Table Editor
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Direct database relation editor. View raw rows, modify stages, or prune records directly.
            </p>
          </div>

          <div className="flex bg-neutral-950 border border-neutral-850 rounded-lg p-0.5 font-mono">
            <button
              onClick={() => { setSelectedTable('topics'); setSearch(''); setSortField('id'); }}
              className={`px-3 py-1.5 rounded text-[14px] font-bold transition ${selectedTable === 'topics' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/30' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              Topics ({topics.length})
            </button>
            <button
              onClick={() => { setSelectedTable('activities'); setSearch(''); setSortField('timestamp'); }}
              className={`px-3 py-1.5 rounded text-[14px] font-bold transition ${selectedTable === 'activities' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/30' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              Activities ({activities.length})
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
          <input 
            type="text" 
            placeholder={`Filter ${selectedTable} rows...`} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-neutral-700 transition"
          />
        </div>
      </div>

      {/* Grid Table */}
      <div className="bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto max-h-[500px] scrollbar-none">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-900 border-b border-neutral-800 text-[14px] text-neutral-400 font-mono sticky top-0 z-10 select-none">
                {selectedTable === 'topics' ? (
                  <>
                    <th onClick={() => handleSort('id')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-neutral-800">
                      ID <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </th>
                    <th onClick={() => handleSort('name')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-neutral-800">
                      NAME <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </th>
                    <th onClick={() => handleSort('channel')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-neutral-800">
                      CHANNEL <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </th>
                    <th onClick={() => handleSort('status')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-neutral-800">
                      STATUS <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </th>
                    <th onClick={() => handleSort('priority')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-neutral-800">
                      PRIORITY <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </th>
                    <th onClick={() => handleSort('dueDate')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-neutral-800">
                      DUE DATE <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">ACTIONS</th>
                  </>
                ) : (
                  <>
                    <th onClick={() => handleSort('id')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-neutral-800">
                      ID <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </th>
                    <th onClick={() => handleSort('topicName')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-neutral-800">
                      TOPIC <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </th>
                    <th onClick={() => handleSort('channel')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-neutral-800">
                      CHANNEL <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </th>
                    <th onClick={() => handleSort('action')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-neutral-800">
                      ACTION <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </th>
                    <th onClick={() => handleSort('author')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-neutral-800">
                      AUTHOR <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </th>
                    <th onClick={() => handleSort('timestamp')} className="px-4 py-3 font-semibold cursor-pointer hover:bg-neutral-800">
                      TIMESTAMP <ArrowUpDown className="inline h-3 w-3 ml-1" />
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">ACTIONS</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900 font-mono text-[14px] text-neutral-300">
              {selectedTable === 'topics' ? (
                sortedTopics.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-neutral-600">No topics match filters</td>
                  </tr>
                ) : (
                  sortedTopics.map(topic => (
                    <tr key={topic.id} className="hover:bg-neutral-900/30">
                      <td className="px-4 py-2.5 text-neutral-500 font-bold max-w-[100px] truncate" title={topic.id}>
                        {topic.id.substring(0, 10)}...
                      </td>
                      <td className="px-4 py-2.5 font-sans font-semibold text-neutral-200 max-w-[180px] truncate" title={topic.name}>
                        {topic.name}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded border text-[13px] font-bold ${topic.channel === 'LearnDriven' ? 'text-purple-400 bg-purple-950/10 border-purple-900/20' : 'text-emerald-400 bg-emerald-950/10 border-emerald-900/20'}`}>
                          {topic.channel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={topic.status}
                          onChange={(e) => handleUpdateTopicStatus(topic.id, e.target.value as Topic['status'])}
                          className="bg-neutral-900 border border-neutral-800 rounded text-[14px] text-zinc-300 px-2 py-1 outline-none cursor-pointer focus:border-zinc-700 font-mono"
                        >
                          <option value="topic">Topic Idea</option>
                          <option value="scripted">Scripted</option>
                          <option value="shot">Shot</option>
                          <option value="edited">Edited</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="posted">Published</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 font-bold">{topic.priority}</td>
                      <td className="px-4 py-2.5 text-neutral-500">
                        {topic.dueDate ? new Date(topic.dueDate).toLocaleDateString() : 'None'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button 
                          onClick={() => handleDeleteTopic(topic.id, topic.name)}
                          className="p-1 hover:bg-red-950/50 hover:text-red-400 border border-transparent hover:border-red-900/40 rounded transition"
                          title="Delete topic"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                sortedActivities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-neutral-600">No activities match filters</td>
                  </tr>
                ) : (
                  sortedActivities.map(act => (
                    <tr key={act.id} className="hover:bg-neutral-900/30">
                      <td className="px-4 py-2.5 text-neutral-500 font-bold max-w-[100px] truncate" title={act.id}>
                        {act.id.substring(0, 10)}...
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-neutral-200 max-w-[150px] truncate" title={act.topicName}>
                        {act.topicName}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded border text-[13px] font-bold ${act.channel === 'LearnDriven' ? 'text-purple-400 bg-purple-950/10 border-purple-900/20' : 'text-emerald-400 bg-emerald-950/10 border-emerald-900/20'}`}>
                          {act.channel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-300 max-w-[200px] truncate" title={act.action}>
                        {act.action}
                      </td>
                      <td className="px-4 py-2.5 text-neutral-400 font-semibold">{act.author}</td>
                      <td className="px-4 py-2.5 text-neutral-500">
                        {new Date(act.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button 
                          onClick={() => handleDeleteActivity(act.id, act.action)}
                          className="p-1 hover:bg-red-950/50 hover:text-red-400 border border-transparent hover:border-red-900/40 rounded transition"
                          title="Delete activity record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

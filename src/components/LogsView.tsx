import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Wifi, 
  Cpu, 
  Clock, 
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { SystemEvent } from '../types';

interface LogsViewProps {
  events: SystemEvent[];
  onClearEvents?: () => void;
}

export default function LogsView({ events, onClearEvents }: LogsViewProps) {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      // Search term filter
      const matchesSearch = evt.message.toLowerCase().includes(search.toLowerCase()) || 
                            evt.source.toLowerCase().includes(search.toLowerCase());
      
      // Source filter
      const matchesSource = sourceFilter === 'all' || evt.source === sourceFilter;

      // Type/level filter
      const matchesType = typeFilter === 'all' || evt.type === typeFilter;

      return matchesSearch && matchesSource && matchesType;
    });
  }, [events, search, sourceFilter, typeFilter]);

  // Count distribution
  const counts = useMemo(() => {
    return {
      all: events.length,
      success: events.filter(e => e.type === 'success').length,
      info: events.filter(e => e.type === 'info').length,
      warning: events.filter(e => e.type === 'warning').length,
      error: events.filter(e => e.type === 'error').length,
    };
  }, [events]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100 tracking-tight flex items-center gap-2">
              <Terminal className="h-5 w-5 text-purple-400" />
              Console Telemetry Logs
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Live consolidated telemetry of all pipelines: Topic Repos, Progress, and Action Hub.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefresh}
              className="p-2 bg-neutral-950 border border-neutral-850 hover:border-neutral-700 rounded-lg text-neutral-400 hover:text-white transition"
              title="Refresh Logs"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            {onClearEvents && (
              <button 
                onClick={onClearEvents}
                className="px-3 py-2 bg-neutral-950 border border-neutral-850 hover:border-red-900 hover:text-red-400 rounded-lg text-neutral-400 text-xs font-semibold font-mono flex items-center gap-1.5 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear Terminal</span>
              </button>
            )}
          </div>
        </div>

        {/* Counter Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
          {[
            { id: 'all', label: 'All Logs', count: counts.all, color: 'text-neutral-400 border-neutral-800 bg-neutral-950' },
            { id: 'info', label: 'Info', count: counts.info, color: 'text-blue-400 border-blue-950/40 bg-blue-950/10' },
            { id: 'success', label: 'Success', count: counts.success, color: 'text-emerald-400 border-emerald-950/40 bg-emerald-950/10' },
            { id: 'warning', label: 'Warnings', count: counts.warning, color: 'text-amber-400 border-amber-950/40 bg-amber-950/10' },
            { id: 'error', label: 'Errors', count: counts.error, color: 'text-rose-400 border-rose-950/40 bg-rose-950/10' }
          ].map(badge => (
            <div 
              key={badge.id} 
              className={`border rounded-lg p-3 flex flex-col justify-between font-mono ${badge.color}`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">{badge.label}</span>
              <span className="text-xl font-bold mt-1">{badge.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
          <input 
            type="text" 
            placeholder="Search terminal logs..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-neutral-700 transition"
          />
        </div>

        {/* Source Dropdown */}
        <div className="flex w-full md:w-auto items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
          <select 
            value={sourceFilter} 
            onChange={(e) => setSourceFilter(e.target.value)}
            className="w-full md:w-40 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-300 font-mono focus:outline-none focus:border-neutral-700"
          >
            <option value="all">All Sources</option>
            <option value="github">Topic Repos</option>
            <option value="vercel">Progress</option>
            <option value="supabase">Action Hub</option>
            <option value="system">System</option>
          </select>
        </div>

        {/* Type Dropdown */}
        <div className="w-full md:w-auto">
          <select 
            value={typeFilter} 
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full md:w-40 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-300 font-mono focus:outline-none focus:border-neutral-700"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      {/* Logs Console Board */}
      <div className="bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden shadow-2xl">
        {/* Terminal Header */}
        <div className="bg-neutral-900/80 px-4 py-3 border-b border-neutral-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-[11px] text-neutral-400 font-mono font-semibold ml-2">bash - telemetry@console</span>
          </div>
          <div className="flex items-center gap-2 text-neutral-500 text-[10px] font-mono">
            <Clock className="h-3 w-3" />
            <span>UTC Sync Active</span>
          </div>
        </div>

        {/* Terminal Output Logs */}
        <div className="p-4 min-h-[400px] max-h-[500px] overflow-y-auto font-mono text-[11px] leading-relaxed space-y-2.5">
          <AnimatePresence initial={false}>
            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-2">
                <Terminal className="h-8 w-8 text-neutral-600 animate-pulse" />
                <span>No telemetry logs matching the current filters.</span>
              </div>
            ) : (
              filteredEvents.map((evt, idx) => {
                const logTime = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                
                // Color mapping for types
                const typeColors = {
                  info: 'text-blue-400 bg-blue-950/20 border-blue-900/30',
                  success: 'text-emerald-400 bg-emerald-950/20 border-emerald-900/30',
                  warning: 'text-amber-400 bg-amber-950/20 border-amber-900/30',
                  error: 'text-rose-400 bg-rose-950/20 border-rose-900/30'
                };

                // Badge mapping for sources
                const sourceBadge = {
                  github: 'bg-blue-950/30 text-blue-400 border border-blue-900/30',
                  vercel: 'bg-amber-950/30 text-amber-400 border border-amber-900/30',
                  supabase: 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30',
                  system: 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                }[evt.source] || 'bg-neutral-900 text-neutral-400 border border-neutral-800';

                // Display source names mapped to the new labels
                const sourceLabel = {
                  github: 'Topic Repos',
                  vercel: 'Progress',
                  supabase: 'Action Hub',
                  system: 'System'
                }[evt.source] || evt.source;

                return (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-start gap-3 p-2 hover:bg-neutral-900/40 rounded transition border border-transparent hover:border-neutral-900 group"
                  >
                    {/* Timestamp */}
                    <span className="text-neutral-500 shrink-0 mt-0.5 select-none">
                      [{logTime}]
                    </span>

                    {/* Source Badge */}
                    <span className={`px-2 py-0.2 rounded text-[9px] uppercase font-bold tracking-wider shrink-0 ${sourceBadge}`}>
                      {sourceLabel}
                    </span>

                    {/* Level Badge */}
                    <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold shrink-0 ${typeColors[evt.type]}`}>
                      {evt.type}
                    </span>

                    {/* Log Message */}
                    <span className="text-neutral-300 break-all select-text flex-1">
                      {evt.message}
                    </span>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

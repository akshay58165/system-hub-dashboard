import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Search,
  SlidersHorizontal,
  Youtube,
  Terminal,
  ListChecks
} from 'lucide-react';
import { Topic, TopicActivity } from '../types';

interface ContentActivityViewProps {
  activities: TopicActivity[];
  topics: Topic[];
  onShowBacklog: () => void;
  onNavigateActivity: (activity: TopicActivity) => void;
}

const activityTime = (activity: TopicActivity) => {
  const parsed = Date.parse(activity.timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
};

const displayAuthor = (author: string) => author.toLowerCase() === 'typeakshay' ? 'Akshay' : author;

const displayAction = (activity: TopicActivity) => {
  const escapedTopic = activity.topicName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return activity.action
    .replace(new RegExp(`\\s*["“]?${escapedTopic}["”]?\\s*$`, 'i'), '')
    .replace(/\s*:\s*$/, '')
    .trim();
};

export default function ContentActivityView({ activities, topics, onShowBacklog, onNavigateActivity }: ContentActivityViewProps) {
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const result = activities.filter(act => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        act.topicName.toLowerCase().includes(q) ||
        act.action.toLowerCase().includes(q) ||
        act.author.toLowerCase().includes(q);
      const matchesChannel = channelFilter === 'all' || act.channel === channelFilter;
      return matchesSearch && matchesChannel;
    });

    // Always show the newest action first. ID provides deterministic ordering
    // when multiple actions share the same timestamp or an old timestamp is invalid.
    return [...result].sort((a, b) => {
      const timestampDifference = activityTime(b) - activityTime(a);
      return timestampDifference !== 0 ? timestampDifference : b.id.localeCompare(a.id);
    });
  }, [activities, search, channelFilter]);

  // Context-specific metrics — derived from real content actions, not generic log levels.
  const stats = useMemo(() => {
    const todayStr = new Date().toDateString();
    const today = activities.filter(a => new Date(a.timestamp).toDateString() === todayStr).length;
    const learnDriven = activities.filter(a => a.channel === 'LearnDriven').length;
    const decodeWorthy = activities.filter(a => a.channel === 'DecodeWorthy').length;
    const uniqueTopics = new Set(activities.map(a => a.topicName)).size;
    return { total: activities.length, today, learnDriven, decodeWorthy, uniqueTopics };
  }, [activities]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100 tracking-tight flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Content Activity Log
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Every real action you've taken — topics added, stage moves, scheduling, and edits.
            </p>
          </div>
          <button
            onClick={onShowBacklog}
            className="px-3 py-2 bg-neutral-950 border border-neutral-850 hover:border-neutral-700 rounded-lg text-neutral-400 hover:text-white text-xs font-semibold font-mono flex items-center gap-1.5 transition cursor-pointer"
            title="View backend/system telemetry"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Backlog Activities</span>
          </button>
        </div>

        {/* Context-specific stat tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
          {[
            { id: 'total', label: 'Total Actions', count: stats.total, color: 'text-neutral-400 border-neutral-800 bg-neutral-950' },
            { id: 'today', label: 'Today', count: stats.today, color: 'text-emerald-400 border-emerald-950/40 bg-emerald-950/10' },
            { id: 'ld', label: 'LearnDriven', count: stats.learnDriven, color: 'text-blue-400 border-blue-950/40 bg-blue-950/10' },
            { id: 'dw', label: 'DecodeWorthy', count: stats.decodeWorthy, color: 'text-emerald-400 border-emerald-950/40 bg-emerald-950/10' },
            { id: 'topics', label: 'Topics Touched', count: stats.uniqueTopics, color: 'text-purple-400 border-purple-950/40 bg-purple-950/10' }
          ].map(badge => (
            <div key={badge.id} className={`border rounded-lg p-3 flex flex-col justify-between font-mono ${badge.color}`}>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">{badge.label}</span>
              <span className="text-xl font-bold mt-1">{badge.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search topic, action, or author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-neutral-700 transition"
          />
        </div>
        <div className="flex w-full md:w-auto items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="w-full md:w-44 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-300 font-mono focus:outline-none focus:border-neutral-700"
          >
            <option value="all">All Channels</option>
            <option value="LearnDriven">LearnDriven</option>
            <option value="DecodeWorthy">DecodeWorthy</option>
          </select>
        </div>
      </div>

      {/* Activity list */}
      <div className="bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-neutral-900/80 px-4 py-3 border-b border-neutral-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-neutral-400" />
            <span className="text-[11px] text-neutral-400 font-mono font-semibold">Content actions</span>
          </div>
          <span className="px-2 py-0.5 bg-neutral-900 text-neutral-400 font-mono text-[10px] border border-neutral-900 rounded-full">
            {filtered.length} of {activities.length}
          </span>
        </div>

        <div className="p-4 min-h-[300px] max-h-[500px] overflow-y-auto space-y-2.5">
          <AnimatePresence initial={false}>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-2">
                <Activity className="h-8 w-8 text-neutral-600" />
                <span className="text-xs font-mono">
                  {activities.length === 0 ? 'No content activity yet — add a topic to get started.' : 'No actions matching the current filters.'}
                </span>
              </div>
            ) : (
              filtered.map(act => {
                const dateObj = new Date(act.timestamp);
                const dateStr = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                const isLD = act.channel === 'LearnDriven';
                const actionLabel = displayAction(act);

                return (
                  <motion.div
                    key={act.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className="p-3 bg-neutral-900/20 border border-neutral-900 rounded-lg flex items-start gap-3 hover:bg-neutral-900/40 transition text-xs font-mono"
                  >
                    <div className="mt-0.5">
                      <Youtube className={`h-4 w-4 ${isLD ? 'text-blue-400' : 'text-emerald-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-neutral-300 tracking-wide">
                        <span className="text-white font-bold">{displayAuthor(act.author)}</span> {actionLabel}{' '}
                        <button
                          type="button"
                          onClick={() => onNavigateActivity(act)}
                          className={`font-bold hover:underline cursor-pointer ${isLD ? 'text-blue-400' : 'text-emerald-400'}`}
                          title="Open this topic at the recorded activity"
                        >
                          "{act.topicName}"
                        </button>
                      </p>
                      <div className="flex items-center gap-2.5 mt-1">
                        <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] uppercase font-semibold tracking-wider ${
                          isLD ? 'bg-blue-950/40 text-blue-400 border border-blue-900/20' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/20'
                        }`}>
                          {act.channel}
                        </span>
                        <span className="text-neutral-500 text-[10px] italic">
                          {dateStr} - {timeStr}
                        </span>
                      </div>
                    </div>
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

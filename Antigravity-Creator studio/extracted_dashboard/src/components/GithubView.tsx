import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GitBranch, 
  GitCommit, 
  GitPullRequest, 
  Play, 
  Plus, 
  Terminal, 
  AlertCircle, 
  Star, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  ExternalLink,
  GitMerge,
  Clock,
  Calendar,
  ArrowUpDown,
  Filter,
  User,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { GitHubRepo, SystemEvent } from '../types';

interface GithubViewProps {
  repos: GitHubRepo[];
  onAddEvent: (evt: SystemEvent) => void;
  onUpdateRepo: (repoId: string, updatedRepo: Partial<GitHubRepo>) => void;
  onTriggerDeploy: (projectName: string) => void;
}

interface Topic {
  id: string;
  name: string;
  description: string;
  channel: 'LearnDriven' | 'DecodeWorthy';
  status: 'scripted' | 'shot' | 'edited' | 'pending';
  priority: 1 | 2 | 3 | 4 | 5; // 1: Neutral, 2: Attention, 3: Hot Topic, 4: Important, 5: Automatic
  dueDate: string | null;
  createdDate: string;
  lastUpdated: string;
}

interface TopicActivity {
  id: string;
  topicName: string;
  channel: 'LearnDriven' | 'DecodeWorthy';
  action: string;
  author: string;
  timestamp: string;
}

// Time formatting helper
function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 0) return 'just now'; 
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Blinking logic helper (Due date within 2 days gap)
function shouldBlink(dueDateStr: string | null) {
  if (!dueDateStr) return false;
  const due = new Date(dueDateStr);
  const now = new Date();
  const diffTime = due.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  // Blink if due date is within 2 days (48 hours) and not already past
  return diffDays >= -0.5 && diffDays <= 2;
}

export default function GithubView({ repos, onAddEvent, onUpdateRepo, onTriggerDeploy }: GithubViewProps) {
  // 1. Selected channel filter: 'All' | 'LearnDriven' | 'DecodeWorthy'
  const [selectedChannel, setSelectedChannel] = useState<'All' | 'LearnDriven' | 'DecodeWorthy'>('All');

  // 2. Sorting by priority
  const [sortOrder, setSortOrder] = useState<'high-to-low' | 'low-to-high'>('high-to-low');

  // 3. Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // 4. Local state for Topics
  const [topics, setTopics] = useState<Topic[]>([
    {
      id: 't-1',
      name: 'React 19 Server Actions Deep Dive',
      description: 'Step-by-step instructions on handling form actions, pending states, and optimistic updates.',
      channel: 'LearnDriven',
      status: 'scripted',
      priority: 4,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString(), // ~20 hours from now
      createdDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(), // 4 days ago
      lastUpdated: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: 't-2',
      name: 'Framer Motion 3D Layout Animations',
      description: 'Creating premium fluid layout transitions using AnimatePresence and layoutId.',
      channel: 'LearnDriven',
      status: 'shot',
      priority: 2,
      dueDate: null,
      createdDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: 't-3',
      name: 'Tailwind CSS v4 Custom Compiler Hooks',
      description: 'Integrating Tailwind CSS v4 with Vite compiler and configuring custom screens.',
      channel: 'LearnDriven',
      status: 'edited',
      priority: 3,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days from now
      createdDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
      lastUpdated: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
    {
      id: 't-4',
      name: 'Next.js Middleware JWT Token Validation',
      description: 'Securing Edge API routes using custom middleware and jose token decryption.',
      channel: 'LearnDriven',
      status: 'pending',
      priority: 5,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(), // ~12 hours from now
      createdDate: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(), // 20 hours ago
      lastUpdated: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: 't-5',
      name: 'Supabase Realtime Postgres Listeners',
      description: 'Subscribing to Postgres changes in React using supabase-js client channels.',
      channel: 'LearnDriven',
      status: 'scripted',
      priority: 1,
      dueDate: null,
      createdDate: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
      id: 't-6',
      name: 'Vite + TS Config Optimizations',
      description: 'Configuring compiler options, path aliases, and bundler chunks inside tsconfig.json.',
      channel: 'LearnDriven',
      status: 'shot',
      priority: 3,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
      createdDate: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(),
    },
    {
      id: 't-7',
      name: 'Decoding OAuth2 Authorization Flows',
      description: 'In-depth visual walkthrough of OAuth2 code grants, PKCE, and token exchange.',
      channel: 'DecodeWorthy',
      status: 'edited',
      priority: 4,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 22).toISOString(), // ~22 hours from now
      createdDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    },
    {
      id: 't-8',
      name: 'WebSockets vs SSE: Scalability Audit',
      description: 'Benchmarking active socket connections vs HTTP/2 Server-Sent Events under load.',
      channel: 'DecodeWorthy',
      status: 'pending',
      priority: 3,
      dueDate: null,
      createdDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    {
      id: 't-9',
      name: 'Cold Start Latency on Vercel Functions',
      description: 'Auditing Node.js vs Edge runtime bundle sizes, import overhead, and cold execution.',
      channel: 'DecodeWorthy',
      status: 'scripted',
      priority: 2,
      dueDate: null,
      createdDate: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(), // 10 hours ago
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
    },
    {
      id: 't-10',
      name: 'Postgres Locking & Row Lock Types',
      description: 'Visualizing FOR UPDATE, FOR SHARE, and deadlock conditions in heavy transactions.',
      channel: 'DecodeWorthy',
      status: 'shot',
      priority: 1,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      createdDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    }
  ]);

  // 5. Local state for activities
  const [activities, setActivities] = useState<TopicActivity[]>([
    {
      id: 'act-1',
      topicName: 'React 19 Server Actions Deep Dive',
      channel: 'LearnDriven',
      action: 'Completed script draft structure',
      author: 'alex-dev',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString()
    },
    {
      id: 'act-2',
      topicName: 'Next.js Middleware JWT Token Validation',
      channel: 'LearnDriven',
      action: 'Configured jose decrypt middleware tests',
      author: 'sarah-ops',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    },
    {
      id: 'act-3',
      topicName: 'Decoding OAuth2 Authorization Flows',
      channel: 'DecodeWorthy',
      action: 'Rendered visual layout diagrams',
      author: 'tony-design',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString()
    },
    {
      id: 'act-4',
      topicName: 'Cold Start Latency on Vercel Functions',
      channel: 'DecodeWorthy',
      action: 'Conducted edge runtime bundle audit',
      author: 'typeakshay',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString()
    },
    {
      id: 'act-5',
      topicName: 'Framer Motion 3D Layout Animations',
      channel: 'LearnDriven',
      action: 'Filmed raw transitions and dynamic tests',
      author: 'tony-design',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    },
    {
      id: 'act-6',
      topicName: 'WebSockets vs SSE: Scalability Audit',
      channel: 'DecodeWorthy',
      action: 'Reviewed socket allocation thresholds',
      author: 'alex-dev',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString()
    }
  ]);

  // Form states for creating a new Topic
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');
  const [newTopicChannel, setNewTopicChannel] = useState<'LearnDriven' | 'DecodeWorthy'>('LearnDriven');
  const [newTopicStatus, setNewTopicStatus] = useState<'scripted' | 'shot' | 'edited' | 'pending'>('scripted');
  const [newTopicPriority, setNewTopicPriority] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [newTopicDueDate, setNewTopicDueDate] = useState('');

  // Handle adding a new Topic
  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;

    const newTopic: Topic = {
      id: `t-manual-${Date.now()}`,
      name: newTopicName,
      description: newTopicDesc,
      channel: newTopicChannel,
      status: newTopicStatus,
      priority: newTopicPriority,
      dueDate: newTopicDueDate ? new Date(newTopicDueDate).toISOString() : null,
      createdDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    setTopics(prev => [newTopic, ...prev]);

    // Add activity log
    const newActivity: TopicActivity = {
      id: `act-manual-${Date.now()}`,
      topicName: newTopicName,
      channel: newTopicChannel,
      action: `Created new topic in ${newTopicStatus} stage`,
      author: 'typeakshay',
      timestamp: new Date().toISOString()
    };
    setActivities(prev => [newActivity, ...prev]);

    // Trigger system notification
    onAddEvent({
      id: `evt-topic-created-${Date.now()}`,
      source: 'github',
      type: 'success',
      message: `Topic Engine: Added topic "${newTopicName}" under ${newTopicChannel}`,
      timestamp: new Date().toISOString()
    });

    // Reset fields
    setNewTopicName('');
    setNewTopicDesc('');
    setNewTopicDueDate('');
    setIsAddFormOpen(false);
  };

  // Filter topics based on channel filter & search query
  const filteredTopics = useMemo(() => {
    return topics
      .filter(t => {
        const matchesChannel = selectedChannel === 'All' || t.channel === selectedChannel;
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              t.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesChannel && matchesSearch;
      })
      .sort((a, b) => {
        if (sortOrder === 'high-to-low') {
          return b.priority - a.priority;
        } else {
          return a.priority - b.priority;
        }
      });
  }, [topics, selectedChannel, searchQuery, sortOrder]);

  // Compute aggregate stats based on channel
  const stats = useMemo(() => {
    const subset = topics.filter(t => selectedChannel === 'All' || t.channel === selectedChannel);
    const scripted = subset.filter(t => t.status === 'scripted').length;
    const shot = subset.filter(t => t.status === 'shot').length;
    const edited = subset.filter(t => t.status === 'edited').length;
    const pending = subset.filter(t => t.status === 'pending').length;

    // Last created date
    let lastCreatedText = 'No topics';
    if (subset.length > 0) {
      const dates = subset.map(t => new Date(t.createdDate).getTime());
      const maxDate = new Date(Math.max(...dates));
      lastCreatedText = formatTimeAgo(maxDate.toISOString());
    }

    // Last updated date
    let lastUpdatedText = 'Not updated';
    if (subset.length > 0) {
      const dates = subset.map(t => new Date(t.lastUpdated).getTime());
      const maxDate = new Date(Math.max(...dates));
      lastUpdatedText = formatTimeAgo(maxDate.toISOString());
    }

    return {
      total: subset.length,
      scripted,
      shot,
      edited,
      pending,
      lastCreatedText,
      lastUpdatedText
    };
  }, [topics, selectedChannel]);

  // Filter activities based on selected channel
  const filteredActivities = useMemo(() => {
    return activities.filter(act => selectedChannel === 'All' || act.channel === selectedChannel);
  }, [activities, selectedChannel]);

  // Get Priority Labels and Styles
  const getPriorityDetails = (priority: number) => {
    switch (priority) {
      case 1: return { text: 'Neutral', style: 'bg-neutral-900 border border-neutral-800 text-neutral-400' };
      case 2: return { text: 'Attention', style: 'bg-yellow-950/40 border border-yellow-900/60 text-yellow-400' };
      case 3: return { text: 'Hot Topic', style: 'bg-orange-950/40 border border-orange-900/60 text-orange-400' };
      case 4: return { text: 'Important', style: 'bg-blue-950/40 border border-blue-900/60 text-blue-400' };
      case 5: return { text: 'Automatic', style: 'bg-purple-950/40 border border-purple-900/60 text-purple-400' };
      default: return { text: 'Neutral', style: 'bg-neutral-900 border border-neutral-800 text-neutral-400' };
    }
  };

  // Get Dynamic Description
  const getChannelDescription = () => {
    if (selectedChannel === 'All') {
      return "Consolidated views and production stages of all video topics across active content channels.";
    }
    if (selectedChannel === 'LearnDriven') {
      return "Educational programming content focused on high-quality framework code, React, Next.js, and web dev tutorials.";
    }
    return "Deep-dive system investigations, developer tooling audits, database lock analysis, and performance benchmarks.";
  };

  return (
    <div className="space-y-6">
      {/* Top repository picker (repurposed for topic and channel dashboard) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-950/80 border border-neutral-900 rounded-xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:border-neutral-800/40 transition duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-900/50 border border-neutral-900 rounded-lg text-neutral-300">
            <SlidersHorizontal className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-neutral-100 font-mono flex items-center gap-2">
              Topic Dashboard
              <span className="px-1.5 py-0.2 bg-neutral-900/50 text-neutral-400 border border-neutral-900 font-mono text-[10px] rounded">
                Total: {stats.total}
              </span>
            </h2>
            <p className="text-[10px] text-neutral-400 mt-0.5 font-mono">
              Last created: {stats.lastCreatedText}
            </p>
          </div>
        </div>

        {/* Channel Filter Buttons */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {(['All', 'LearnDriven', 'DecodeWorthy'] as const).map(channel => (
            <button
              key={channel}
              onClick={() => setSelectedChannel(channel)}
              className={`px-4.5 py-1.5 rounded-lg text-xs font-mono border transition-all duration-300 ${
                selectedChannel === channel
                  ? 'bg-neutral-900 border-neutral-800 text-white font-semibold shadow-[0_0_12px_rgba(59,130,246,0.06)]'
                  : 'bg-neutral-950/40 border-neutral-900/60 text-neutral-400 hover:text-neutral-200 hover:border-neutral-800'
              }`}
            >
              {channel}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Main content block) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Card (Topic Status Details) */}
          <div className="bg-neutral-950/80 border border-neutral-900 rounded-xl p-5 relative overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:border-neutral-800/40 transition duration-300">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold font-mono text-white tracking-tight">Topic Status</h3>
                  <span className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-900 text-neutral-400 rounded text-[9px] font-mono font-semibold">
                    updated {stats.lastUpdatedText}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1 max-w-xl font-mono">{getChannelDescription()}</p>
              </div>
            </div>

            {/* Metrics Row: scripted, shot, edited, pending */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-neutral-900/60 font-mono">
              <div className="p-3 bg-blue-950/5 rounded-lg border border-blue-950/30 hover:border-blue-900/30 hover:bg-blue-950/10 transition duration-300 group/metric">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Scripted</span>
                <span className="text-xs font-bold text-blue-400 mt-1 flex items-center gap-1.5 group-hover/metric:translate-x-0.5 transition-transform duration-300">
                  <Terminal className="h-3.5 w-3.5" />
                  {stats.scripted} topics
                </span>
              </div>

              <div className="p-3 bg-amber-950/5 rounded-lg border border-amber-950/30 hover:border-amber-900/30 hover:bg-amber-950/10 transition duration-300 group/metric">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Shot</span>
                <span className="text-xs font-bold text-amber-400 mt-1 flex items-center gap-1.5 group-hover/metric:translate-x-0.5 transition-transform duration-300">
                  <Play className="h-3.5 w-3.5 fill-amber-400/20" />
                  {stats.shot} topics
                </span>
              </div>

              <div className="p-3 bg-emerald-950/5 rounded-lg border border-emerald-950/30 hover:border-emerald-900/30 hover:bg-emerald-950/10 transition duration-300 group/metric">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Edited</span>
                <span className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1.5 group-hover/metric:translate-x-0.5 transition-transform duration-300">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {stats.edited} topics
                </span>
              </div>

              <div className="p-3 bg-neutral-900/20 rounded-lg border border-neutral-900 hover:border-neutral-800 hover:bg-neutral-900/40 transition duration-300 group/metric">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Pending</span>
                <span className="text-xs font-bold text-neutral-300 mt-1 flex items-center gap-1.5 group-hover/metric:translate-x-0.5 transition-transform duration-300">
                  <Clock className="h-3.5 w-3.5" />
                  {stats.pending} topics
                </span>
              </div>
            </div>
          </div>

          {/* Topics List Card (repurposed from GitHub Actions) */}
          <div className="bg-neutral-950/80 border border-neutral-900 rounded-xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:border-neutral-800/40 transition duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">Topics List</h3>
                <p className="text-xs text-neutral-500 font-mono">Consolidated directory of all topics, tags, and execution deadlines.</p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Search query input */}
                <input 
                  type="text"
                  placeholder="Filter by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-neutral-900/50 text-xs border border-neutral-900 rounded px-2.5 py-1 outline-none text-neutral-300 font-mono w-full sm:w-36 focus:border-neutral-800 transition-colors"
                />

                {/* Priority Sorter Button */}
                <button 
                  onClick={() => setSortOrder(prev => prev === 'high-to-low' ? 'low-to-high' : 'high-to-low')}
                  className="px-2.5 py-1 bg-neutral-900/50 border border-neutral-900 hover:border-neutral-850 text-neutral-300 hover:text-white rounded text-xs font-mono flex items-center gap-1.5 shrink-0 transition"
                  title="Sort by Priority Level"
                >
                  <ArrowUpDown className="h-3 w-3 text-rose-400" />
                  <span>{sortOrder === 'high-to-low' ? 'Priority: H→L' : 'Priority: L→H'}</span>
                </button>
              </div>
            </div>

            {/* List of Topics */}
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {filteredTopics.length === 0 ? (
                <div className="text-center py-10 text-neutral-500 font-mono text-xs border border-dashed border-neutral-900 rounded-lg">
                  No active topics matching filters.
                </div>
              ) : (
                filteredTopics.map(topic => {
                  const prio = getPriorityDetails(topic.priority);
                  const isDueSoon = shouldBlink(topic.dueDate);

                  // Colors for statuses
                  const statusColors = {
                    scripted: 'text-blue-400 bg-blue-950/20 border-blue-900/20',
                    shot: 'text-amber-400 bg-amber-950/20 border-amber-900/20',
                    edited: 'text-emerald-400 bg-emerald-950/20 border-emerald-900/20',
                    pending: 'text-neutral-400 bg-neutral-900 border-neutral-900'
                  }[topic.status];

                  return (
                    <div 
                      key={topic.id} 
                      className={`p-3.5 bg-neutral-950/30 hover:bg-neutral-900/20 border rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono text-[11px] transition-all duration-300 hover:translate-x-0.5 ${
                        isDueSoon 
                          ? 'border-red-950/40 hover:border-red-900/40 bg-red-950/5 shadow-[0_0_12px_rgba(239,68,68,0.03)]' 
                          : 'border-neutral-900 hover:border-neutral-800/80'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Red LED blinking dot if due date is within 1 day gap */}
                        {isDueSoon ? (
                          <div className="mt-1 shrink-0" title="Due in 1 day!">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                            </span>
                          </div>
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-neutral-800 mt-1.5 shrink-0 animate-pulse" />
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-xs font-bold text-neutral-200 truncate">{topic.name}</span>
                            <span className="px-1.5 py-0.2 bg-neutral-900/40 text-neutral-500 border border-neutral-900 rounded text-[9px]">
                              {topic.channel}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-400 font-sans leading-relaxed">{topic.description}</p>
                          
                          {/* Due Date Indicator */}
                          {topic.dueDate && (
                            <div className="flex items-center gap-1 text-[9px] text-neutral-500 italic mt-0.5 font-sans">
                              <Calendar className="h-3 w-3" />
                              <span>Due date: {new Date(topic.dueDate).toLocaleDateString()}</span>
                              {isDueSoon && <span className="text-red-400 font-bold ml-1 uppercase animate-pulse">Warning: Due in 1 day!</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status and Priority Badges */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase ${statusColors}`}>
                          {topic.status === 'edited' ? 'Ready (Edit)' : topic.status === 'pending' ? 'Pending (Sched)' : topic.status}
                        </span>

                        <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${prio.style}`}>
                          P-{topic.priority}: {prio.text}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-6">
          {/* Add / Edit Topic Card (repurposed from Pull Requests) */}
          <div className="bg-neutral-950/80 border border-neutral-900 rounded-xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:border-neutral-800/40 transition duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-200">Topic Management</h3>
              <button 
                onClick={() => setIsAddFormOpen(!isAddFormOpen)}
                className="p-1 bg-neutral-900/50 hover:bg-neutral-800 text-neutral-300 rounded border border-neutral-900 transition"
                title="Create a New Topic"
              >
                <Plus className="h-3.5 w-3.5 text-rose-400" />
              </button>
            </div>

            {/* Form to Add Topic */}
            {isAddFormOpen ? (
              <motion.form 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleAddTopic}
                className="p-3.5 bg-neutral-900/50 border border-neutral-900 rounded-lg space-y-3 font-mono text-[10px]"
              >
                <div>
                  <label className="block uppercase text-neutral-500">Topic Title</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Next.js Routing hooks"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-900 focus:border-neutral-800 outline-none text-xs rounded px-2.5 py-1.5 mt-1 text-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block uppercase text-neutral-500">Description</label>
                  <textarea 
                    rows={2}
                    placeholder="Provide details of topic work..."
                    value={newTopicDesc}
                    onChange={(e) => setNewTopicDesc(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-900 focus:border-neutral-800 outline-none text-xs rounded px-2.5 py-1.5 mt-1 text-white font-sans transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block uppercase text-neutral-500">Channel</label>
                    <select 
                      value={newTopicChannel}
                      onChange={(e) => setNewTopicChannel(e.target.value as 'LearnDriven' | 'DecodeWorthy')}
                      className="w-full bg-neutral-950 border border-neutral-900 focus:border-neutral-800 outline-none text-xs rounded px-2 py-1 mt-1 text-white"
                    >
                      <option value="LearnDriven">LearnDriven</option>
                      <option value="DecodeWorthy">DecodeWorthy</option>
                    </select>
                  </div>
                  <div>
                    <label className="block uppercase text-neutral-500">Work Stage</label>
                    <select 
                      value={newTopicStatus}
                      onChange={(e) => setNewTopicStatus(e.target.value as any)}
                      className="w-full bg-neutral-950 border border-neutral-900 focus:border-neutral-800 outline-none text-xs rounded px-2 py-1 mt-1 text-white"
                    >
                      <option value="scripted">Scripted</option>
                      <option value="shot">Shot</option>
                      <option value="edited">Edited</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block uppercase text-neutral-500">Priority</label>
                    <select 
                      value={newTopicPriority}
                      onChange={(e) => setNewTopicPriority(parseInt(e.target.value) as any)}
                      className="w-full bg-neutral-950 border border-neutral-900 focus:border-neutral-800 outline-none text-xs rounded px-2 py-1 mt-1 text-white"
                    >
                      <option value={1}>1: Neutral</option>
                      <option value={2}>2: Attention</option>
                      <option value={3}>3: Hot Topic</option>
                      <option value={4}>4: Important</option>
                      <option value={5}>5: Automatic</option>
                    </select>
                  </div>
                  <div>
                    <label className="block uppercase text-neutral-500">Due Date</label>
                    <input 
                      type="date"
                      value={newTopicDueDate}
                      onChange={(e) => setNewTopicDueDate(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-900 focus:border-neutral-800 outline-none text-xs rounded px-2 py-1 mt-1 text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 text-[10px] pt-1">
                  <button 
                    type="button" 
                    onClick={() => setIsAddFormOpen(false)}
                    className="px-2.5 py-1 text-neutral-500 hover:text-neutral-300"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded transition-colors"
                  >
                    Save Topic
                  </button>
                </div>
              </motion.form>
            ) : (
              <div className="space-y-4 font-mono text-[10px] leading-relaxed">
                {/* Section Header */}
                <div className="p-3 bg-neutral-950/60 border border-neutral-900 rounded-lg space-y-1">
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                    <Terminal className="h-3.5 w-3.5" />
                    <span>Pipeline Insights ({selectedChannel})</span>
                  </div>
                  <p className="text-neutral-400 font-sans">
                    Real-time recommendations for managing your content channels.
                  </p>
                </div>

                {/* Blinking Critical Alert Block */}
                {topics.filter(t => (selectedChannel === 'All' || t.channel === selectedChannel) && shouldBlink(t.dueDate)).length > 0 ? (
                  <div className="p-3 bg-red-950/10 border border-red-900/40 text-red-400 rounded-lg flex items-start gap-2 shadow-[0_0_12px_rgba(239,68,68,0.02)]">
                    <span className="relative flex h-2 w-2 mt-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <div className="space-y-0.5">
                      <span className="font-bold">CRITICAL FOCUS REQUIRED</span>
                      <p className="text-[9px] text-neutral-400 font-sans leading-normal">
                        You have {topics.filter(t => (selectedChannel === 'All' || t.channel === selectedChannel) && shouldBlink(t.dueDate)).length} topics due within 24 hours. Consider moving them to edited/scheduled.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-950/10 border border-emerald-900/40 text-emerald-400 rounded-lg flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold">ALL SYSTEMS NOMINAL</span>
                      <p className="text-[9px] text-neutral-400 font-sans leading-normal">
                        Deadlines for active content topics are distributed properly.
                      </p>
                    </div>
                  </div>
                )}

                {/* Pipeline Health score indicator */}
                <div className="p-3 bg-neutral-950/40 border border-neutral-900 rounded-lg flex items-center justify-between gap-3">
                  <div>
                    <span className="text-neutral-400 font-bold block">Production Efficiency</span>
                    <span className="text-[9px] text-neutral-500 font-sans mt-0.5 block">
                      Ratio of completed (edited/scheduled) topics.
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-white">
                      {Math.round(((stats.edited + stats.pending) / (stats.total || 1)) * 100)}%
                    </span>
                    <div className="w-16 bg-neutral-950 rounded-full h-1 overflow-hidden mt-1">
                      <div 
                        className="bg-blue-400 h-1 rounded-full" 
                        style={{ width: `${Math.round(((stats.edited + stats.pending) / (stats.total || 1)) * 100)}%` }} 
                      />
                    </div>
                  </div>
                </div>

                {/* Stage recommendations */}
                <div className="p-3 bg-neutral-955/20 border border-neutral-900/80 rounded-lg space-y-2">
                  <div className="flex justify-between items-center text-neutral-400 font-bold text-[9px] uppercase tracking-wider">
                    <span>Work Stage Density</span>
                    <span>Load</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-blue-400">Scripting Load</span>
                      <span className="text-neutral-300 font-bold">{stats.scripted} tasks</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-amber-400">Shot & Filmed</span>
                      <span className="text-neutral-300 font-bold">{stats.shot} videos</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-emerald-400">Ready to Publish</span>
                      <span className="text-neutral-300 font-bold">{stats.edited + stats.pending} scheduled</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Activity Log (repurposed from Commit History) */}
          <div className="bg-neutral-950/80 border border-neutral-900 rounded-xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:border-neutral-800/40 transition duration-300">
            <h3 className="text-sm font-semibold text-neutral-200 mb-3">Activity Log</h3>
            <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1">
              {filteredActivities.length === 0 ? (
                <p className="text-xs text-neutral-500 italic font-mono text-center py-4">No recent activity found</p>
              ) : (
                filteredActivities.map(activity => (
                  <div key={activity.id} className="flex gap-3 text-xs">
                    <div className="flex flex-col items-center">
                      <div className="p-1 bg-neutral-950 rounded-full border border-neutral-900 mt-0.5">
                        <GitCommit className="h-3 w-3 text-blue-400" />
                      </div>
                      <div className="flex-1 w-[1px] bg-neutral-900 min-h-[24px]" />
                    </div>

                    <div className="flex-1 min-w-0 pb-3 font-mono text-[10px]">
                      <span className="text-neutral-200 block leading-normal">
                        {activity.action} on <strong className="text-neutral-300">{activity.topicName}</strong>
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-neutral-500 flex items-center gap-1 uppercase">
                          <User className="h-3 w-3" />
                          {activity.author}
                        </span>
                        <span className="text-neutral-600">•</span>
                        <span className="text-neutral-500 font-mono italic">
                          {formatTimeAgo(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

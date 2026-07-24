import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Terminal, Database, GitBranch, Layers, ArrowRight, CornerDownLeft, Sparkles, Trophy } from 'lucide-react';
import { GitHubRepo, VercelProject, SupabaseProject } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  repos: GitHubRepo[];
  vercelProjects: VercelProject[];
  supabase: SupabaseProject;
  onTabChange: (tab: 'overview' | 'topics' | 'progress' | 'actionhub' | 'logs' | 'score') => void;
  onTriggerDeploy: (projectName: string) => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  repos,
  vercelProjects,
  supabase,
  onTabChange,
  onTriggerDeploy,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset search when palette is opened/closed
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Combined Search items
  const items = React.useMemo(() => {
    const list: {
      id: string;
      title: string;
      subtitle: string;
      category: 'Command' | 'Topic Repos' | 'Progress' | 'Action Hub' | 'Logs' | 'Score';
      icon: React.ReactNode;
      action: () => void;
    }[] = [
      // Navigation
      {
        id: 'cmd-nav-overview',
        title: 'Go to Overview Dashboard',
        subtitle: 'View global server clusters and aggregate analytics',
        category: 'Command',
        icon: <Sparkles className="h-4 w-4 text-emerald-400" />,
        action: () => onTabChange('overview'),
      },
      {
        id: 'cmd-nav-topics',
        title: 'Open Topic Repos',
        subtitle: 'Manage repositories, commits, and Actions runs',
        category: 'Command',
        icon: <GitBranch className="h-4 w-4 text-blue-400" />,
        action: () => onTabChange('topics'),
      },
      {
        id: 'cmd-nav-progress',
        title: 'Open Progress Dashboard',
        subtitle: 'Check project analytics, domains and serverless performance',
        category: 'Command',
        icon: <Layers className="h-4 w-4 text-amber-400" />,
        action: () => onTabChange('progress'),
      },
      {
        id: 'cmd-nav-actionhub',
        title: 'Open Score dashboard',
        subtitle: 'Review topic rankings and score distribution',
        category: 'Command',
        icon: <Database className="h-4 w-4 text-emerald-500" />,
        action: () => onTabChange('actionhub'),
      },
      {
        id: 'cmd-nav-logs',
        title: 'Open Console Telemetry Logs',
        subtitle: 'View live aggregated logs across cloud systems',
        category: 'Command',
        icon: <Terminal className="h-4 w-4 text-purple-400" />,
        action: () => onTabChange('logs'),
      },
      {
        id: 'cmd-nav-score',
        title: 'Open Scorecard Dashboard',
        subtitle: 'Check overall platform health index, uptime SLA, and performance',
        category: 'Command',
        icon: <Trophy className="h-4 w-4 text-rose-400" />,
        action: () => onTabChange('score'),
      },
    ];

    // GitHub repos -> Topic Repos
    repos.forEach(repo => {
      list.push({
        id: `git-${repo.id}`,
        title: `Repo: ${repo.name}`,
        subtitle: repo.description,
        category: 'Topic Repos',
        icon: <GitBranch className="h-4 w-4 text-neutral-400" />,
        action: () => {
          onTabChange('topics');
        },
      });
      // Add a deployment trigger for this repo
      list.push({
        id: `git-dep-${repo.id}`,
        title: `Action: Run Production Deploy for ${repo.name}`,
        subtitle: 'Initiate manual code checkout & Progress update',
        category: 'Topic Repos',
        icon: <Terminal className="h-4 w-4 text-neutral-400" />,
        action: () => {
          onTabChange('topics');
          onTriggerDeploy(repo.name);
        },
      });
    });

    // Vercel projects -> Progress
    vercelProjects.forEach(proj => {
      list.push({
        id: `ver-${proj.id}`,
        title: `Progress Project: ${proj.name}`,
        subtitle: `Currently hosted on ${proj.domain}`,
        category: 'Progress',
        icon: <Layers className="h-4 w-4 text-neutral-400" />,
        action: () => {
          onTabChange('progress');
        },
      });
    });

    // Supabase Tables -> Action Hub
    supabase.tables.forEach(table => {
      list.push({
        id: `sub-${table.name}`,
        title: `Action Hub Table: ${table.name}`,
        subtitle: `Relation containing ${table.rowCount} records`,
        category: 'Action Hub',
        icon: <Database className="h-4 w-4 text-neutral-400" />,
        action: () => {
          onTabChange('actionhub');
        },
      });
    });

    // Filter list
    return list.filter(item => {
      const matchText = `${item.title} ${item.subtitle} ${item.category}`.toLowerCase();
      return matchText.includes(search.toLowerCase());
    });
  }, [repos, vercelProjects, supabase, search]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          items[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, items, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-50 backdrop-blur-xs"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl z-50 font-mono text-xs flex flex-col max-h-[420px]"
          >
            {/* Input row */}
            <div className="flex items-center gap-3 px-4 py-3 bg-neutral-950 border-b border-neutral-800">
              <Search className="h-5 w-5 text-neutral-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search resources, repos, schemas or trigger actions... (e.g. Deploy)"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
                className="w-full bg-transparent border-none outline-none text-white text-xs py-1"
              />
              <span className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-500 rounded text-[14px]">ESC</span>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {items.length === 0 ? (
                <p className="text-center text-neutral-500 italic py-6">No matches found for "{search}"</p>
              ) : (
                items.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition ${
                      idx === selectedIndex ? 'bg-neutral-850 text-white' : 'text-neutral-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-1.5 rounded-md ${idx === selectedIndex ? 'bg-neutral-800 text-white' : 'bg-neutral-900'}`}>
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <span className={`block font-semibold ${idx === selectedIndex ? 'text-white' : 'text-neutral-200'}`}>
                          {item.title}
                        </span>
                        <span className="block text-[14px] text-neutral-500 truncate mt-0.5">{item.subtitle}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.2 bg-neutral-900 border border-neutral-800 text-[13px] text-neutral-500 uppercase rounded font-semibold">
                        {item.category}
                      </span>
                      {idx === selectedIndex && (
                        <CornerDownLeft className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Hint Footer */}
            <div className="px-4 py-2 bg-neutral-950 border-t border-neutral-800 flex justify-between items-center text-[14px] text-neutral-500">
              <div className="flex gap-4">
                <span>↑↓ Navigate</span>
                <span>ENTER Select</span>
              </div>
              <span>Command Palette v1.0</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

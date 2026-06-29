import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Sparkles, GitBranch, Layers, Database, Plus, Clapperboard, CornerDownLeft } from 'lucide-react';
import { VideoItem } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoItem[];
  onSetTab: (tab: 'mission' | 'health') => void;
  onAddTopic: () => void;
  onOpenPipeline: () => void;
  onOpenVideo: (videoId: string) => void;
}

export default function CommandPalette({ isOpen, onClose, videos, onSetTab, onAddTopic, onOpenPipeline, onOpenVideo }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items = useMemo(() => {
    const list: { id: string; title: string; subtitle: string; category: string; icon: React.ReactNode; action: () => void }[] = [
      { id: 'cmd-mission', title: 'Go to Mission Control', subtitle: 'View cycle pace, pressure, and daily targets', category: 'Command', icon: <Sparkles className="h-4 w-4 text-emerald-400" />, action: () => onSetTab('mission') },
      { id: 'cmd-health', title: 'Go to Wellbeing', subtitle: 'Track energy, sleep, hydration, and recovery', category: 'Command', icon: <Database className="h-4 w-4 text-cyan-400" />, action: () => onSetTab('health') },
      { id: 'cmd-pipeline', title: 'Open Production Pipeline', subtitle: 'Jump straight to the pipeline tabs', category: 'Command', icon: <Clapperboard className="h-4 w-4 text-blue-400" />, action: onOpenPipeline },
      { id: 'cmd-add', title: 'Add a New Topic', subtitle: 'Create a new video and drop it into the Topic stage', category: 'Command', icon: <Plus className="h-4 w-4 text-emerald-400" />, action: onAddTopic },
    ];

    videos.forEach(video => {
      list.push({
        id: `video-${video.id}`,
        title: video.title,
        subtitle: `${video.channel} · ${video.currentStage} · ${video.contentLane}`,
        category: 'Video',
        icon: <GitBranch className="h-4 w-4 text-neutral-400" />,
        action: () => onOpenVideo(video.id),
      });
    });

    return list.filter(item => `${item.title} ${item.subtitle} ${item.category}`.toLowerCase().includes(search.toLowerCase()));
  }, [videos, search, onSetTab, onOpenPipeline, onAddTopic, onOpenVideo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev + 1) % Math.max(1, items.length)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev - 1 + items.length) % Math.max(1, items.length)); }
      else if (e.key === 'Enter') { e.preventDefault(); if (items[selectedIndex]) { items[selectedIndex].action(); onClose(); } }
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, items, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black z-50 backdrop-blur-xs" />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl z-50 font-mono text-xs flex flex-col max-h-[420px]"
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-neutral-950 border-b border-neutral-800">
              <Search className="h-5 w-5 text-neutral-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search videos, sections, or actions..."
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedIndex(0); }}
                className="w-full bg-transparent border-none outline-none text-white text-xs py-1"
              />
              <span className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-neutral-500 rounded text-[10px]">ESC</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {items.length === 0 ? (
                <p className="text-center text-neutral-500 italic py-6">No matches found for "{search}"</p>
              ) : (
                items.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => { item.action(); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition ${idx === selectedIndex ? 'bg-neutral-850 text-white' : 'text-neutral-400'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-1.5 rounded-md ${idx === selectedIndex ? 'bg-neutral-800 text-white' : 'bg-neutral-900'}`}>{item.icon}</div>
                      <div className="min-w-0">
                        <span className={`block font-semibold truncate ${idx === selectedIndex ? 'text-white' : 'text-neutral-200'}`}>{item.title}</span>
                        <span className="block text-[10px] text-neutral-500 truncate mt-0.5">{item.subtitle}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-1.5 py-0.2 bg-neutral-900 border border-neutral-800 text-[9px] text-neutral-500 uppercase rounded font-semibold">{item.category}</span>
                      {idx === selectedIndex && <CornerDownLeft className="h-3.5 w-3.5 text-neutral-400" />}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2 bg-neutral-950 border-t border-neutral-800 flex justify-between items-center text-[10px] text-neutral-500">
              <div className="flex gap-4"><span>↑↓ Navigate</span><span>ENTER Select</span></div>
              <span>Command Palette v1.0</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

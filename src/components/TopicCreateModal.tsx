import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Plus } from 'lucide-react';
import { useDismissOnOutsideClick } from '../hooks/useDismissOnOutsideClick';
import type { SystemEvent, Topic, TopicActivity } from '../types';

interface TopicCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  setActivities: React.Dispatch<React.SetStateAction<TopicActivity[]>>;
  onAddEvent: (evt: SystemEvent) => void;
  setActiveTab: (tab: string) => void;
  setPipelineSubView: (subView: 'videos' | 'topics') => void;
}

function getLocalDateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function TopicCreateModal({
  isOpen,
  onClose,
  setTopics,
  setActivities,
  onAddEvent,
  setActiveTab,
  setPipelineSubView
}: TopicCreateModalProps) {
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');
  const [newTopicChannel, setNewTopicChannel] = useState<'LearnDriven' | 'DecodeWorthy' | null>(null);
  const [newTopicStatus, setNewTopicStatus] = useState<'topic' | 'scripted' | 'shot' | 'edited' | 'scheduled'>('topic');
  const [newTopicPriority, setNewTopicPriority] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [newTopicDueDate, setNewTopicDueDate] = useState('');
  const [newTopicSchedTime, setNewTopicSchedTime] = useState('');
  const [newTopicLane, setNewTopicLane] = useState<'Shorts' | 'Long' | 'Members-Only' | null>(null);
  const todayDateKey = getLocalDateKey();
  const tomorrowDateKey = getLocalDateKey(1);
  const hasUnsavedInput = Boolean(
    newTopicName.trim() ||
    newTopicDesc.trim() ||
    newTopicChannel ||
    newTopicStatus !== 'topic' ||
    newTopicPriority !== 1 ||
    newTopicDueDate ||
    newTopicSchedTime ||
    newTopicLane
  );

  const modalRef = useDismissOnOutsideClick<HTMLFormElement>(
    isOpen,
    !hasUnsavedInput,
    onClose
  );
  const firstOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    if (firstOpenRef.current) return;
    setNewTopicName('');
    setNewTopicDesc('');
    setNewTopicChannel(null);
    setNewTopicStatus('topic');
    setNewTopicPriority(1);
    setNewTopicDueDate('');
    setNewTopicSchedTime('');
    setNewTopicLane(null);
    firstOpenRef.current = true;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) firstOpenRef.current = false;
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicName.trim() || !newTopicChannel) return;

    const finalFormat: Topic['format'] = newTopicLane === 'Shorts' ? 'Short' : newTopicLane === 'Members-Only' ? 'Members' : 'Long';
    const defaultTime = newTopicChannel === 'LearnDriven' ? '21:09' : '19:07';
    const finalTime = newTopicSchedTime || defaultTime;
    const statusToStageIdx: Record<typeof newTopicStatus, number> = {
      topic: -1,
      scripted: 0,
      shot: 1,
      edited: 2,
      scheduled: 3
    };
    const workflowStatuses: Partial<Record<'script' | 'shoot' | 'edit' | 'schedule' | 'post', 'pending' | 'in-progress' | 'completed'>> = {};
    const targetIdx = statusToStageIdx[newTopicStatus];
    for (const [idx, stage] of [['script', 0], ['shoot', 1], ['edit', 2], ['schedule', 3], ['post', 4]] as const) {
      if (targetIdx >= stage) workflowStatuses[idx] = 'completed';
    }
    let finalDueDate: string | null = newTopicDueDate ? new Date(`${newTopicDueDate}T${finalTime}:00`).toISOString() : null;
    let finalSchedTime: string | undefined = newTopicSchedTime || undefined;
    if (newTopicStatus === 'scheduled' && newTopicDueDate) {
      finalDueDate = new Date(`${newTopicDueDate}T${finalTime}:00`).toISOString();
      finalSchedTime = finalTime;
    } else if (newTopicStatus === 'scheduled') {
      const baseDate = new Date().toISOString().split('T')[0];
      finalDueDate = new Date(`${baseDate}T${finalTime}:00`).toISOString();
      finalSchedTime = finalTime;
    }
    const inProgress = newTopicStatus !== 'topic';

    const newTopic: Topic = {
      id: `t-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: newTopicName.trim(),
      description: newTopicDesc.trim(),
      channel: newTopicChannel,
      status: newTopicStatus,
      priority: newTopicPriority,
      dueDate: finalDueDate,
      scheduledTime: finalSchedTime,
      format: finalFormat,
      createdDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      inProgress,
      workflowStatuses: newTopicStatus !== 'topic' ? workflowStatuses : undefined
    };

    setTopics(previous => [newTopic, ...previous]);
    setActivities(previous => [{
      id: `act-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      topicName: newTopic.name,
      channel: newTopic.channel,
      action: `Created new topic in ${newTopicStatus} stage`,
      author: 'typeakshay',
      timestamp: new Date().toISOString()
    }, ...previous]);
    onAddEvent({
      id: `evt-topic-created-${Date.now()}`,
      source: 'github',
      type: 'success',
      message: `Topic Engine: Added topic "${newTopic.name}" under ${newTopic.channel}`,
      timestamp: new Date().toISOString()
    });

    if (inProgress) {
      setPipelineSubView('topics');
      setActiveTab('pipeline');
    }

    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.form
            ref={modalRef}
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-blue-400">Topic Engine</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Create a new topic</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-neutral-800 p-2 text-neutral-400 transition hover:border-neutral-700 hover:text-white"
                aria-label="Close topic form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-xs font-mono text-neutral-400">
                <span>Topic Title</span>
                <input
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
                  placeholder="e.g. Why your audience ignores hooks"
                  required
                />
              </label>
              <label className="space-y-1 text-xs font-mono text-neutral-400">
                <span>Channel</span>
                <select
                  value={newTopicChannel || ''}
                  onChange={(e) => setNewTopicChannel((e.target.value as 'LearnDriven' | 'DecodeWorthy') || null)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
                  required
                >
                  <option value="">Select a channel</option>
                  <option value="LearnDriven">LearnDriven</option>
                  <option value="DecodeWorthy">DecodeWorthy</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-mono text-neutral-400 md:col-span-2">
                <span>Description</span>
                <textarea
                  value={newTopicDesc}
                  onChange={(e) => setNewTopicDesc(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
                  placeholder="Short context, angle, or notes"
                />
              </label>
              <label className="space-y-1 text-xs font-mono text-neutral-400">
                <span>Status</span>
                <select
                  value={newTopicStatus}
                  onChange={(e) => setNewTopicStatus(e.target.value as typeof newTopicStatus)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
                >
                  <option value="topic">Idea</option>
                  <option value="scripted">Scripted</option>
                  <option value="shot">Shot</option>
                  <option value="edited">Edited</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-mono text-neutral-400">
                <span>Priority</span>
                <select
                  value={newTopicPriority}
                  onChange={(e) => setNewTopicPriority(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
                >
                  <option value={1}>1 - Low</option>
                  <option value={2}>2 - Normal</option>
                  <option value={3}>3 - High</option>
                  <option value={4}>4 - Urgent</option>
                  <option value={5}>5 - Critical</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-mono text-neutral-400">
                <span>Format</span>
                <select
                  value={newTopicLane || ''}
                  onChange={(e) => setNewTopicLane((e.target.value as 'Shorts' | 'Long' | 'Members-Only') || null)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
                >
                  <option value="">Select a format</option>
                  <option value="Shorts">Shorts</option>
                  <option value="Long">Long</option>
                  <option value="Members-Only">Members-Only</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-mono text-neutral-400">
                <span>Due Date</span>
                <input
                  type="date"
                  value={newTopicDueDate}
                  onChange={(e) => setNewTopicDueDate(e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
                />
              </label>
              <label className="space-y-1 text-xs font-mono text-neutral-400">
                <span>Schedule Time</span>
                <input
                  type="time"
                  value={newTopicSchedTime}
                  onChange={(e) => setNewTopicSchedTime(e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setNewTopicDueDate(todayDateKey)}
                className="rounded-full border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-700 hover:text-white"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setNewTopicDueDate(tomorrowDateKey)}
                className="rounded-full border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-700 hover:text-white"
              >
                Tomorrow
              </button>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-800 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-neutral-400 transition hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-blue-400"
              >
                <Plus className="h-4 w-4" />
                Create topic
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

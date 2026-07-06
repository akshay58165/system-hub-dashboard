import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, Plus, X } from 'lucide-react';
import { useDismissOnOutsideClick } from '../hooks/useDismissOnOutsideClick';
import type { SystemEvent, Topic, TopicActivity } from '../types';

interface TopicCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicToEdit?: Topic | null;
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  setActivities: React.Dispatch<React.SetStateAction<TopicActivity[]>>;
  onAddEvent: (evt: SystemEvent) => void;
  setActiveTab: (tab: string) => void;
  setPipelineSubView: (subView: 'videos' | 'topics') => void;
}

type Lane = 'Shorts' | 'Long' | 'Members-Only';
type TopicScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
type Eligibility = {
  neutral: boolean;
  productTag: boolean;
  viral: boolean;
  pinnedPromo: boolean;
  below8Min: boolean;
  exceed8Min: boolean;
  strongReach: boolean;
  brandCollab: boolean;
  productLinks: boolean;
  membersOnly: boolean;
};

const emptyEligibility: Eligibility = {
  neutral: false,
  productTag: false,
  viral: false,
  pinnedPromo: false,
  below8Min: false,
  exceed8Min: false,
  strongReach: false,
  brandCollab: false,
  productLinks: false,
  membersOnly: false
};

function localDateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function laneFromFormat(format?: Topic['format']): Lane | null {
  if (format === 'Short') return 'Shorts';
  if (format === 'Long') return 'Long';
  if (format === 'Members') return 'Members-Only';
  return null;
}

function dateOnlyFromIso(value?: string | null) {
  return value ? value.split('T')[0] : '';
}

function timeOnlyFromIso(value?: string | null) {
  return value ? value.split('T')[1]?.slice(0, 5) || '' : '';
}

function createWorkflowStatuses(status: Topic['status']) {
  const stageIndex = { topic: -1, scripted: 0, shot: 1, edited: 2, scheduled: 3, posted: 4 }[status];
  const workflowStatuses: Partial<Record<'script' | 'shoot' | 'edit' | 'schedule' | 'post', 'completed'>> = {};
  (['script', 'shoot', 'edit', 'schedule', 'post'] as const).forEach((stage, index) => {
    if (index <= stageIndex) workflowStatuses[stage] = 'completed';
  });
  return workflowStatuses;
}

export default function TopicCreateModal({
  isOpen,
  onClose,
  topicToEdit,
  setTopics,
  setActivities,
  onAddEvent,
  setActiveTab,
  setPipelineSubView
}: TopicCreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [channel, setChannel] = useState<'LearnDriven' | 'DecodeWorthy' | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [status, setStatus] = useState<'topic' | 'scripted' | 'shot' | 'edited' | 'scheduled' | 'posted'>('topic');
  const [priority, setPriority] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [topicScore, setTopicScore] = useState<TopicScore>(5);
  const [dueDate, setDueDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [eligibility, setEligibility] = useState<Eligibility>(emptyEligibility);
  const initialSnapshotRef = useRef('');
  const isEditing = Boolean(topicToEdit);

  const currentSnapshot = JSON.stringify({
    name: name.trim(),
    description: description.trim(),
    channel,
    lane,
    status,
    priority,
    topicScore,
    dueDate,
    scheduleTime,
    eligibility
  });

  const hasUnsavedInput = isEditing
    ? currentSnapshot !== initialSnapshotRef.current
    : Boolean(
        name.trim() || description.trim() || channel || lane || status !== 'topic' || priority !== 1 ||
        topicScore !== 5 || dueDate || scheduleTime || Object.values(eligibility).some(Boolean)
      );
  const modalRef = useDismissOnOutsideClick<HTMLFormElement>(isOpen, !hasUnsavedInput, onClose);

  useEffect(() => {
    if (!isOpen) {
      initialSnapshotRef.current = '';
      return;
    }

    const initialChannel = topicToEdit?.channel ?? null;
    const initialLane = laneFromFormat(topicToEdit?.format);
    const initialStatus = topicToEdit?.status ?? 'topic';
    const initialPriority = topicToEdit?.priority ?? 1;
    const initialTopicScore = (topicToEdit?.topicScore ?? 5) as TopicScore;
    const initialDueDate = dateOnlyFromIso(topicToEdit?.dueDate);
    const initialTime = topicToEdit?.scheduledTime || timeOnlyFromIso(topicToEdit?.dueDate) || '';

    setName(topicToEdit?.name ?? '');
    setDescription(topicToEdit?.description ?? '');
    setChannel(initialChannel);
    setLane(initialLane);
    setStatus(initialStatus);
    setPriority(initialPriority);
    setTopicScore(initialTopicScore);
    setDueDate(initialDueDate);
    setScheduleTime(initialTime);
    setEligibility(emptyEligibility);
    initialSnapshotRef.current = JSON.stringify({
      name: (topicToEdit?.name ?? '').trim(),
      description: topicToEdit?.description ?? '',
      channel: initialChannel,
      lane: initialLane,
      status: initialStatus,
      priority: initialPriority,
      topicScore: initialTopicScore,
      dueDate: initialDueDate,
      scheduleTime: initialTime,
      eligibility: emptyEligibility
    });
  }, [isOpen, topicToEdit]);

  const setEligibilityValue = (key: keyof Eligibility, checked: boolean) => {
    setEligibility(current => ({
      ...current,
      [key]: checked,
      ...(key === 'below8Min' && checked ? { exceed8Min: false } : {}),
      ...(key === 'exceed8Min' && checked ? { below8Min: false } : {})
    }));
  };

  const revenueLevel = (() => {
    if (!Object.values(eligibility).some(Boolean)) return '';
    if (eligibility.neutral) return 'Lvl 0.5';
    if (lane === 'Shorts') {
      if (!eligibility.viral) return 'Lvl 1';
      if (eligibility.productTag && eligibility.pinnedPromo) return 'Lvl 4';
      if (eligibility.productTag) return 'Lvl 3';
      return 'Lvl 2';
    }
    if (lane === 'Long') {
      if (eligibility.brandCollab) return 'Lvl 20';
      const hasProduct = eligibility.productTag || eligibility.productLinks;
      if (eligibility.strongReach) {
        if (eligibility.exceed8Min) return hasProduct ? 'Lvl 9.5' : 'Lvl 9';
        return hasProduct ? 'Lvl 8.5' : 'Lvl 8';
      }
      if (eligibility.exceed8Min) return hasProduct ? 'Lvl 7.5' : 'Lvl 7';
      return hasProduct ? 'Lvl 6.5' : 'Lvl 6';
    }
    if (lane === 'Members-Only' && eligibility.membersOnly) return 'Lvl 5';
    return '';
  })();

  const chooseChannel = (nextChannel: 'LearnDriven' | 'DecodeWorthy') => {
    if (isEditing && channel === nextChannel) {
      return;
    }
    if (!isEditing && channel === nextChannel) {
      setChannel(null);
      setLane(null);
      return;
    }
    setChannel(nextChannel);
    setLane(nextChannel === 'DecodeWorthy' ? 'Shorts' : null);
    setEligibility(emptyEligibility);
    if (!scheduleTime || scheduleTime === (nextChannel === 'LearnDriven' ? '19:07' : '21:09')) {
      setScheduleTime(nextChannel === 'LearnDriven' ? '21:09' : '19:07');
    }
  };

  const chooseLane = (nextLane: Lane) => {
    setLane(nextLane);
    setEligibility(emptyEligibility);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !channel) return;

    const finalFormat: Topic['format'] = lane === 'Shorts' ? 'Short' : lane === 'Members-Only' ? 'Members' : 'Long';
    const finalTime = scheduleTime || (channel === 'LearnDriven' ? '21:09' : '19:07');
    const inProgress = status !== 'topic';
    const workflowStatuses = createWorkflowStatuses(status);
    const finalDueDate = dueDate
      ? new Date(`${dueDate}T${finalTime}:00`).toISOString()
      : status === 'scheduled' ? new Date(`${localDateKey()}T${finalTime}:00`).toISOString() : null;

    const topicId = topicToEdit?.id || `t-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdDate = topicToEdit?.createdDate || new Date().toISOString();
    const updatedAt = new Date().toISOString();
    const finalRevenueLevel = revenueLevel || topicToEdit?.revenueLevel || undefined;
    const topic: Topic = {
      ...(topicToEdit || { id: topicId, createdDate }),
      id: topicId,
      name: name.trim(),
      description: description.trim(),
      channel,
      status,
      priority,
      topicScore,
      dueDate: finalDueDate,
      scheduledTime: scheduleTime || (status === 'scheduled' ? finalTime : undefined),
      format: finalFormat,
      createdDate,
      lastUpdated: updatedAt,
      revenueLevel: finalRevenueLevel,
      inProgress,
      workflowStatuses: inProgress ? workflowStatuses : undefined,
      autoPostPaused: topicToEdit?.autoPostPaused,
    };

    const changed = currentSnapshot !== initialSnapshotRef.current;

    setTopics(previous => topicToEdit
      ? previous.map(existing => existing.id === topicToEdit.id ? topic : existing)
      : [topic, ...previous]
    );

    if (!topicToEdit || changed) {
      const activityLabel = topicToEdit ? 'Updated' : 'Created new';
      setActivities(previous => [{
        id: `act-${topicToEdit ? 'edit' : 'manual'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        topicName: topic.name,
        channel: topic.channel,
        action: `${activityLabel} topic in ${status} stage${finalRevenueLevel ? ` with ${finalRevenueLevel}` : ''}`,
        author: 'typeakshay',
        timestamp: new Date().toISOString()
      }, ...previous]);
      onAddEvent({
        id: `evt-topic-${topicToEdit ? 'updated' : 'created'}-${Date.now()}`,
        source: 'github',
        type: 'success',
        message: `Topic Engine: ${topicToEdit ? 'Updated' : 'Added'} topic "${topic.name}" under ${topic.channel}${finalRevenueLevel ? ` (${finalRevenueLevel})` : ''}`,
        timestamp: new Date().toISOString()
      });
    }

    if (inProgress) {
      setPipelineSubView('topics');
      setActiveTab('pipeline');
    }
    onClose();
  };

  const checkbox = (key: keyof Eligibility, label: string, wide = false) => (
    <label className={`flex cursor-pointer items-center gap-1.5 text-[9px] text-neutral-400 hover:text-neutral-200 ${wide ? 'col-span-2' : ''}`}>
      <input
        type="checkbox"
        checked={eligibility[key]}
        onChange={event => setEligibilityValue(key, event.target.checked)}
        className="rounded border-neutral-800 bg-neutral-950 text-rose-500 outline-none focus:ring-0"
      />
      <span>{label}</span>
    </label>
  );

  const scoreButton = (value: TopicScore) => {
    const isActive = topicScore === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setTopicScore(value)}
        className={`flex h-8 items-center justify-center rounded border text-[10px] font-bold transition ${
          isActive
            ? 'border-rose-400 bg-rose-500 text-white shadow-[0_0_8px_rgba(244,63,94,.25)]'
            : 'border-neutral-900 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-white'
        }`}
      >
        {value}
      </button>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.form
            ref={modalRef}
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-rose-400">Topic Engine</p>
                <h3 className="mt-1 text-sm font-semibold text-neutral-200">{topicToEdit ? 'Edit Topic' : 'Topic Management'}</h3>
              </div>
              <button type="button" onClick={onClose} className="rounded border border-neutral-800 p-1.5 text-neutral-400 hover:text-white" aria-label="Close topic form">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 rounded-lg border border-neutral-900 bg-neutral-900/40 p-3.5 font-mono text-[10px]">
              <label className="block uppercase text-neutral-500">Topic Title
                <input required value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Next-Generation TypeScript Strategies" className="mt-1 w-full rounded border border-neutral-900 bg-neutral-950 px-2.5 py-1.5 text-xs normal-case text-white outline-none focus:border-neutral-700" />
              </label>
              <label className="block uppercase text-neutral-500">Description
                <textarea rows={2} value={description} onChange={event => setDescription(event.target.value)} placeholder="Provide details of topic work..." className="mt-1 w-full rounded border border-neutral-900 bg-neutral-950 px-2.5 py-1.5 font-sans text-xs normal-case text-white outline-none focus:border-neutral-700" />
              </label>

              <div>
                <label className="block uppercase text-neutral-500">Creator Channel</label>
                <div className="mt-1 flex gap-2.5">
                  {(['LearnDriven', 'DecodeWorthy'] as const).map(value => (
                    <button key={value} type="button" onClick={() => chooseChannel(value)} className={`flex-1 rounded border py-1.5 text-xs font-bold transition ${channel === value ? 'border-rose-400 bg-rose-500 text-white shadow-[0_0_8px_rgba(244,63,94,.25)]' : 'border-neutral-900 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-white'}`}>{value}</button>
                  ))}
                </div>
              </div>

              {channel && (
                <div>
                  <label className="block uppercase text-neutral-500">Content Lane</label>
                  <div className="mt-1 flex gap-2">
                    {(channel === 'LearnDriven' ? ['Shorts', 'Long', 'Members-Only'] : ['Shorts']).map(value => (
                      <button key={value} type="button" onClick={() => chooseLane(value as Lane)} className={`flex-1 rounded border py-1.5 text-[10px] font-bold transition ${lane === value ? 'border-blue-500 bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,.25)]' : 'border-neutral-900 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-white'}`}>{value}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block uppercase text-neutral-500">Auto Revenue Level</label>
                  <div className="mt-1 flex h-7 items-center rounded border border-neutral-900 bg-neutral-950/60 px-2.5 text-xs font-bold text-emerald-400">{revenueLevel || topicToEdit?.revenueLevel || '-'}</div>
                </div>
                <label className="block uppercase text-neutral-500">Current Production Stage
                  <select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="mt-1 h-7 w-full rounded border border-neutral-900 bg-neutral-950 px-2 text-xs normal-case text-white outline-none">
                    <option value="topic">Topic</option><option value="scripted">Scripted</option><option value="shot">Shot</option><option value="edited">Edited</option><option value="scheduled">Scheduled</option><option value="posted">Posted</option>
                  </select>
                </label>
              </div>

              {lane && (
                <div className="space-y-1.5 border-t border-neutral-900/60 pt-2">
                  <label className="block uppercase text-neutral-500">Revenue Streams</label>
                  <p className="font-sans text-[8px] text-neutral-600">Options change depending on content lane selected.</p>
                  <div className="mt-1 grid grid-cols-2 gap-2 font-sans">
                    {checkbox('neutral', 'Neutral - Level 0.5')}
                    {lane === 'Shorts' && <>{checkbox('productTag', 'Product tag')}{checkbox('viral', 'Viral potential')}{checkbox('pinnedPromo', 'Pinned promotion')}</>}
                    {lane === 'Long' && <>{checkbox('below8Min', 'Below 8 mins')}{checkbox('exceed8Min', 'Exceeds 8 mins')}{checkbox('strongReach', 'Strong reach potential')}{checkbox('brandCollab', 'Brand collab')}{checkbox('productTag', 'Product tags')}{checkbox('productLinks', 'Product links')}</>}
                    {lane === 'Members-Only' && checkbox('membersOnly', 'Members-only subscription value', true)}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 border-t border-neutral-900/60 pt-2 sm:grid-cols-3">
                <div>
                  <label className="block uppercase text-neutral-500">Priority</label>
                  <div className="mt-1.5 flex gap-1.5">
                    {([1, 2, 3, 4, 5] as const).map(value => <button key={value} type="button" onClick={() => setPriority(value)} className={`flex h-6 w-6 items-center justify-center rounded border text-[9px] font-bold ${priority === value ? 'border-rose-400 bg-rose-500 text-white shadow-[0_0_8px_rgba(244,63,94,.3)]' : 'border-neutral-900 bg-neutral-950 text-neutral-400 hover:border-neutral-700'}`}>{value}</button>)}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="block uppercase text-neutral-500">Topic Score</span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map(scoreButton)}
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-neutral-500">
                    <span>1 = low</span>
                    <span>10 = excellent</span>
                  </div>
                </div>
                <label className="block uppercase text-neutral-500">Due Date
                  <span className="relative mt-1 block">
                    <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} className="h-7 w-full rounded border border-neutral-900 bg-neutral-950 px-2 text-[10px] normal-case text-white outline-none" />
                    <Calendar className="pointer-events-none absolute right-2 top-1.5 h-3.5 w-3.5 text-neutral-500" />
                  </span>
                </label>
                <label className="block uppercase text-neutral-500">Sched Time
                  <input type="time" value={scheduleTime} onChange={event => setScheduleTime(event.target.value)} className="mt-1 h-7 w-full rounded border border-neutral-900 bg-neutral-950 px-2 text-[10px] normal-case text-white outline-none" />
                </label>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setDueDate(localDateKey())} className={`rounded border px-2 py-1 text-[9px] ${dueDate === localDateKey() ? 'border-purple-500 bg-purple-950/40 text-purple-300' : 'border-neutral-900 bg-neutral-950 text-neutral-500 hover:text-white'}`}>Today</button>
                <button type="button" onClick={() => setDueDate(localDateKey(1))} className={`rounded border px-2 py-1 text-[9px] ${dueDate === localDateKey(1) ? 'border-yellow-500 bg-yellow-950/40 text-yellow-300' : 'border-neutral-900 bg-neutral-950 text-neutral-500 hover:text-white'}`}>Tomorrow</button>
              </div>

              <button type="submit" disabled={!name.trim() || !channel} className="flex w-full items-center justify-center gap-1.5 rounded bg-rose-500 py-2 text-[10px] font-bold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40">
                <Plus className="h-3.5 w-3.5" /> {topicToEdit ? 'Save Changes' : 'Add Topic'}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

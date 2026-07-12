import React, { useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, Plus, X } from 'lucide-react';
import { useDismissOnOutsideClick } from '../hooks/useDismissOnOutsideClick';
import type { SystemEvent, Topic, TopicActivity, TaskTimerRecord, TaskTimerStage } from '../types';

const STAGE_TIMING_KEYS: TaskTimerStage[] = ['hook', 'script', 'shoot', 'edit'];
const STAGE_TIMING_LABEL: Record<TaskTimerStage, string> = {
  hook: 'Hook', script: 'Script', shoot: 'Shoot', edit: 'Edit', schedule: 'Schedule', post: 'Post'
};

function msToHMS(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function hmsToMs(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const parts = trimmed.split(':').map(p => p.trim());
  if (parts.some(p => p === '' || !/^\d+$/.test(p))) return null;
  const nums = parts.map(p => parseInt(p, 10));
  let h = 0, m = 0, s = 0;
  if (nums.length === 1) m = nums[0];
  else if (nums.length === 2) { m = nums[0]; s = nums[1]; }
  else if (nums.length === 3) { h = nums[0]; m = nums[1]; s = nums[2]; }
  else return null;
  return ((h * 60 + m) * 60 + s) * 1000;
}

interface TopicCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicToEdit?: Topic | null;
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  setActivities: React.Dispatch<React.SetStateAction<TopicActivity[]>>;
  onAddEvent: (evt: SystemEvent) => void;
  setActiveTab: (tab: string) => void;
  setPipelineSubView: (subView: 'videos' | 'topics') => void;
  taskTimers?: TaskTimerRecord[];
  onReplaceStageTime?: (topicId: string, stage: TaskTimerStage, activeMs: number) => void;
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

function parseLocalDateValue(value?: string | null) {
  if (!value) return null;
  const dateKey = value.split('T')[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12);
}

function createWorkflowStatuses(status: Topic['status']) {
  const stageIndex = { topic: -1, hooked: 0, scripted: 1, shot: 2, edited: 3, scheduled: 4, posted: 5 }[status];
  const workflowStatuses: Partial<Record<'hook' | 'script' | 'shoot' | 'edit' | 'schedule' | 'post', 'completed'>> = {};
  (['hook', 'script', 'shoot', 'edit', 'schedule', 'post'] as const).forEach((stage, index) => {
    if (index <= stageIndex) workflowStatuses[stage] = 'completed';
  });
  return workflowStatuses;
}

export default function TopicCreateModal({
  isOpen,
  onClose,
  topicToEdit,
  topics,
  setTopics,
  setActivities,
  onAddEvent,
  setActiveTab,
  setPipelineSubView,
  taskTimers = [],
  onReplaceStageTime
}: TopicCreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [channel, setChannel] = useState<'LearnDriven' | 'DecodeWorthy' | null>(null);
  const [lane, setLane] = useState<Lane | null>(null);
  const [status, setStatus] = useState<'topic' | 'hooked' | 'scripted' | 'shot' | 'edited' | 'scheduled' | 'posted'>('topic');
  const [priority, setPriority] = useState<1 | 2 | 3 | 4 | 5>(1);
  // Unscored is the honest default — no user tap, no score. A tap sets the
  // value; tapping the currently-active number clears it back to unscored.
  const [topicScore, setTopicScore] = useState<TopicScore | undefined>(undefined);
  const [explanationDifficulty, setExplanationDifficulty] = useState<TopicScore | undefined>(undefined);
  const [dueDate, setDueDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  const getScheduledTopicChannelsForDate = (dateStr: string) => {
    const matchingTopics = topics.filter(t => {
      if (!t.dueDate) return false;
      return t.dueDate.split('T')[0] === dateStr;
    });
    return {
      hasLearnDrivenShort: matchingTopics.some(t => t.channel === 'LearnDriven' && t.format === 'Short'),
      hasDecodeWorthyShort: matchingTopics.some(t => t.channel === 'DecodeWorthy' && t.format === 'Short'),
      hasLearnDrivenMembers: matchingTopics.some(t => t.channel === 'LearnDriven' && t.format === 'Members'),
      hasLearnDrivenLong: matchingTopics.some(t => t.channel === 'LearnDriven' && t.format === 'Long'),
    };
  };
  const [eligibility, setEligibility] = useState<Eligibility>(emptyEligibility);
  const [stageTimes, setStageTimes] = useState<Record<TaskTimerStage, string>>({
    hook: '00:00:00', script: '00:00:00', shoot: '00:00:00', edit: '00:00:00', schedule: '00:00:00', post: '00:00:00'
  });
  const initialStageTimesRef = useRef<Record<TaskTimerStage, string>>({
    hook: '00:00:00', script: '00:00:00', shoot: '00:00:00', edit: '00:00:00', schedule: '00:00:00', post: '00:00:00'
  });
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
    explanationDifficulty,
    dueDate,
    scheduleTime,
    eligibility
  });

  const stageTimesChanged = STAGE_TIMING_KEYS.some(stage => stageTimes[stage] !== initialStageTimesRef.current[stage]);
  const hasUnsavedInput = isEditing
    ? (currentSnapshot !== initialSnapshotRef.current || stageTimesChanged)
    : Boolean(
        name.trim() || description.trim() || channel || lane || status !== 'topic' || priority !== 1 ||
        topicScore !== undefined || explanationDifficulty !== undefined || dueDate || scheduleTime || Object.values(eligibility).some(Boolean)
      );
  const modalRef = useDismissOnOutsideClick<HTMLFormElement>(isOpen, !hasUnsavedInput, onClose);

  useLayoutEffect(() => {
    if (!isOpen) {
      initialSnapshotRef.current = '';
      return;
    }

    const initialChannel = topicToEdit?.channel ?? null;
    const initialLane = laneFromFormat(topicToEdit?.format);
    const initialStatus = topicToEdit?.status ?? 'topic';
    const initialPriority = topicToEdit?.priority ?? 1;
    const initialTopicScore = topicToEdit?.topicScore as TopicScore | undefined;
    const initialExplanationDifficulty = topicToEdit?.explanationDifficulty as TopicScore | undefined;
    const initialDueDate = dateOnlyFromIso(topicToEdit?.dueDate);
    const initialTime = topicToEdit?.scheduledTime || timeOnlyFromIso(topicToEdit?.dueDate) || '';

    setName(topicToEdit?.name ?? '');
    setDescription(topicToEdit?.description ?? '');
    setChannel(initialChannel);
    setLane(initialLane);
    setStatus(initialStatus);
    setPriority(initialPriority);
    setTopicScore(initialTopicScore);
    setExplanationDifficulty(initialExplanationDifficulty);
    setDueDate(initialDueDate);
    setScheduleTime(initialTime);
    setEligibility(emptyEligibility);
    // Populate stage timings from taskTimers (sum of accumulatedActiveMs per stage
    // for this topic). Editing these fields overwrites the stored total for that
    // stage — the modal is the authoritative editor for scheduled/posted topics.
    const initTimings: Record<TaskTimerStage, string> = {
      hook: '00:00:00', script: '00:00:00', shoot: '00:00:00', edit: '00:00:00', schedule: '00:00:00', post: '00:00:00'
    };
    if (topicToEdit) {
      STAGE_TIMING_KEYS.forEach(stage => {
        const ms = taskTimers
          .filter(t => t.topicId === topicToEdit.id && t.stage === stage)
          .reduce((s, t) => s + t.accumulatedActiveMs, 0);
        initTimings[stage] = msToHMS(ms);
      });
    }
    setStageTimes(initTimings);
    initialStageTimesRef.current = { ...initTimings };
    initialSnapshotRef.current = JSON.stringify({
      name: (topicToEdit?.name ?? '').trim(),
      description: topicToEdit?.description ?? '',
      channel: initialChannel,
      lane: initialLane,
      status: initialStatus,
      priority: initialPriority,
      topicScore: initialTopicScore,
      explanationDifficulty: initialExplanationDifficulty,
      dueDate: initialDueDate,
      scheduleTime: initialTime,
      eligibility: emptyEligibility
    });
    const pickerSeed = parseLocalDateValue(initialDueDate) ?? new Date();
    setPickerDate({ month: pickerSeed.getMonth(), year: pickerSeed.getFullYear() });
    setShowDatePicker(false);
  }, [isOpen, topicToEdit]);

  const pickerOpenedAtRef = useRef(0);
  useLayoutEffect(() => {
    if (!showDatePicker) return;
    const seed = parseLocalDateValue(dueDate) ?? new Date();
    setPickerDate({ month: seed.getMonth(), year: seed.getFullYear() });
    pickerOpenedAtRef.current = Date.now();
  }, [showDatePicker]);

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
      explanationDifficulty,
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

    // Apply any per-stage timing overrides. Only stages that changed relative
    // to what was loaded are pushed — untouched fields stay untouched.
    if (topicToEdit && onReplaceStageTime) {
      STAGE_TIMING_KEYS.forEach(stage => {
        if (stageTimes[stage] === initialStageTimesRef.current[stage]) return;
        const ms = hmsToMs(stageTimes[stage]);
        if (ms === null) return; // silently ignore invalid input
        onReplaceStageTime(topicToEdit.id, stage, ms);
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

  const scoreOption = (value: TopicScore) => {
    const isActive = topicScore === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setTopicScore(isActive ? undefined : value)}
        aria-pressed={isActive}
        aria-label={isActive ? `Clear score (currently ${value})` : `Set score to ${value}`}
        title={isActive ? 'Tap to clear' : `Set to ${value}`}
        className={`relative flex h-5 w-5 cursor-pointer items-center justify-center rounded border text-[8px] font-bold transition ${
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
            className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
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
                    <option value="topic">Topic</option><option value="hooked">Hooked</option><option value="scripted">Scripted</option><option value="shot">Shot</option><option value="edited">Edited</option><option value="scheduled">Scheduled</option><option value="posted">Posted</option>
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

              <div className="grid grid-cols-2 gap-3 border-t border-neutral-900/60 pt-2">
                <div>
                  <label className="block uppercase text-neutral-500">Priority</label>
                  <div className="mt-1.5 flex gap-1.5">
                    {([1, 2, 3, 4, 5] as const).map(value => <button key={value} type="button" onClick={() => setPriority(value)} className={`flex h-6 w-6 items-center justify-center rounded border text-[9px] font-bold ${priority === value ? 'border-rose-400 bg-rose-500 text-white shadow-[0_0_8px_rgba(244,63,94,.3)]' : 'border-neutral-900 bg-neutral-950 text-neutral-400 hover:border-neutral-700'}`}>{value}</button>)}
                  </div>
                </div>
                <fieldset className="space-y-1">
                  <legend className="block uppercase text-neutral-500">
                    Topic Score
                    <span className={`ml-1.5 normal-case ${topicScore === undefined ? 'text-neutral-500' : 'text-rose-300'}`}>
                      {topicScore === undefined ? '· unscored' : `· ${topicScore}/10`}
                    </span>
                  </legend>
                  <div className="grid w-fit grid-cols-10 gap-0.5" aria-label="Topic Score">
                    {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map(scoreOption)}
                  </div>
                </fieldset>
              </div>

              <fieldset className="space-y-1 border-t border-neutral-900/60 pt-2">
                <legend className="block uppercase text-neutral-500">
                  Explanation Difficulty
                  <span className={`ml-1.5 normal-case ${explanationDifficulty === undefined ? 'text-neutral-500' : 'text-amber-300'}`}>
                    {explanationDifficulty === undefined ? '· not set' : `· ${explanationDifficulty}/10`}
                  </span>
                  <span className="ml-1.5 normal-case text-neutral-600">— how hard to explain to a mass audience</span>
                </legend>
                <div className="grid w-fit grid-cols-10 gap-0.5" aria-label="Explanation Difficulty">
                  {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map(value => {
                    const isActive = explanationDifficulty === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setExplanationDifficulty(isActive ? undefined : value)}
                        aria-pressed={isActive}
                        title={isActive ? 'Tap to clear' : `Set to ${value}`}
                        className={`relative flex h-5 w-5 cursor-pointer items-center justify-center rounded border text-[8px] font-bold transition ${
                          isActive
                            ? 'border-amber-400 bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,.35)]'
                            : 'border-neutral-900 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-white'
                        }`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid grid-cols-2 gap-3">
                <label className="block uppercase text-neutral-500">Due Date
                  <div className="relative mt-1">
                    <div
                      onClick={() => {
                        setShowDatePicker(prev => !prev);
                      }}
                      className="h-7 w-full rounded border border-neutral-900 bg-neutral-950 px-2 text-[10px] normal-case text-white flex items-center justify-between cursor-pointer select-none"
                    >
                      <span className={dueDate ? 'text-white' : 'text-neutral-500'}>
                        {dueDate || 'dd - mm - yyyy'}
                      </span>
                      <Calendar className="h-3.5 w-3.5 text-neutral-500" />
                    </div>

                    {showDatePicker && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowDatePicker(false)}
                        />
                        <div className="absolute right-0 mt-1.5 w-64 backdrop-blur-md bg-neutral-950/90 border border-neutral-800 rounded-xl p-3 shadow-2xl z-50 font-mono text-[9px] select-none">
                          <div className="flex items-center justify-between mb-3 text-neutral-200">
                            <span className="font-bold text-[10px] text-neutral-200">
                              {(() => {
                                const monthNames = [
                                  "January", "February", "March", "April", "May", "June",
                                  "July", "August", "September", "October", "November", "December"
                                ];
                                return `${monthNames[pickerDate.month]} ${pickerDate.year}`;
                              })()}
                            </span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (Date.now() - pickerOpenedAtRef.current < 300) return;
                                  let newMonth = pickerDate.month - 1;
                                  let newYear = pickerDate.year;
                                  if (newMonth < 0) { newMonth = 11; newYear -= 1; }
                                  setPickerDate({ month: newMonth, year: newYear });
                                }}
                                className="p-1 rounded bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                              >&lt;</button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (Date.now() - pickerOpenedAtRef.current < 300) return;
                                  let newMonth = pickerDate.month + 1;
                                  let newYear = pickerDate.year;
                                  if (newMonth > 11) { newMonth = 0; newYear += 1; }
                                  setPickerDate({ month: newMonth, year: newYear });
                                }}
                                className="p-1 rounded bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                              >&gt;</button>
                            </div>
                          </div>

                          <div className="grid grid-cols-7 gap-1 text-center font-bold text-neutral-500 mb-1">
                            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                              <span key={d}>{d}</span>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-1">
                            {(() => {
                              const daysInMonth = new Date(pickerDate.year, pickerDate.month + 1, 0).getDate();
                              const firstDayIndex = new Date(pickerDate.year, pickerDate.month, 1).getDay();
                              const cells = [];
                              const todayStr = localDateKey();

                              for (let i = 0; i < firstDayIndex; i++) {
                                cells.push(<div key={`empty-${i}`} />);
                              }

                              for (let day = 1; day <= daysInMonth; day++) {
                                const dateStr = `${pickerDate.year}-${String(pickerDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const { hasLearnDrivenShort, hasDecodeWorthyShort, hasLearnDrivenMembers, hasLearnDrivenLong } = getScheduledTopicChannelsForDate(dateStr);
                                const isSelected = dueDate === dateStr;
                                const isToday = dateStr === todayStr;

                                cells.push(
                                  <button
                                    key={day}
                                    type="button"
                                    onClick={() => {
                                      setDueDate(dateStr);
                                      setShowDatePicker(false);
                                    }}
                                    className={`p-1.5 rounded transition relative cursor-pointer ${
                                      isSelected
                                        ? 'bg-rose-500 text-white font-bold'
                                        : isToday
                                          ? 'ring-1 ring-neutral-400 text-white font-semibold hover:bg-neutral-900'
                                          : 'hover:bg-neutral-900 text-neutral-300'
                                    }`}
                                  >
                                    {day}
                                    <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-[2px]">
                                      {hasLearnDrivenShort && (
                                        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#a855f7' }} title="LearnDriven Short" />
                                      )}
                                      {hasDecodeWorthyShort && (
                                        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#eab308' }} title="DecodeWorthy Short" />
                                      )}
                                      {hasLearnDrivenMembers && (
                                        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#22c55e' }} title="LearnDriven Members" />
                                      )}
                                      {hasLearnDrivenLong && (
                                        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#3b82f6' }} title="LearnDriven Long" />
                                      )}
                                    </div>
                                  </button>
                                );
                              }

                              return cells;
                            })()}
                          </div>

                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 pt-1.5 border-t border-neutral-900/50 text-[7px] text-neutral-500">
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#a855f7' }} />LD Short</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#eab308' }} />DW Short</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#22c55e' }} />LD Members</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#3b82f6' }} />LD Long</span>
                          </div>

                          <div className="flex justify-between border-t border-neutral-900 mt-2.5 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDueDate('');
                                setShowDatePicker(false);
                              }}
                              className="text-neutral-500 hover:text-neutral-300 transition"
                            >Clear</button>
                            <button
                              type="button"
                              onClick={() => {
                                setDueDate(localDateKey());
                                setShowDatePicker(false);
                              }}
                              className="text-blue-400 hover:text-blue-300 transition font-bold"
                            >Today</button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </label>
                <label className="block uppercase text-neutral-500">Sched Time
                  <input type="time" value={scheduleTime} onChange={event => setScheduleTime(event.target.value)} className="mt-1 h-7 w-full rounded border border-neutral-900 bg-neutral-950 px-2 text-[10px] normal-case text-white outline-none" />
                </label>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setDueDate(localDateKey())} className={`rounded border px-2 py-1 text-[9px] ${dueDate === localDateKey() ? 'border-purple-500 bg-purple-950/40 text-purple-300' : 'border-neutral-900 bg-neutral-950 text-neutral-500 hover:text-white'}`}>Today</button>
                <button type="button" onClick={() => setDueDate(localDateKey(1))} className={`rounded border px-2 py-1 text-[9px] ${dueDate === localDateKey(1) ? 'border-yellow-500 bg-yellow-950/40 text-yellow-300' : 'border-neutral-900 bg-neutral-950 text-neutral-500 hover:text-white'}`}>Tomorrow</button>
              </div>

              {topicToEdit && (
                <div className="space-y-2 border-t border-neutral-900/60 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block uppercase text-neutral-500">Stage timings</label>
                    <span className="font-mono text-[8px] normal-case text-neutral-600">HH:MM:SS · overwrites the total</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {STAGE_TIMING_KEYS.map(stage => (
                      <label key={stage} className="block">
                        <span className="block text-[8px] font-bold uppercase tracking-wider text-neutral-400">{STAGE_TIMING_LABEL[stage]}</span>
                        <input
                          type="text"
                          value={stageTimes[stage]}
                          onChange={event => setStageTimes(prev => ({ ...prev, [stage]: event.target.value }))}
                          placeholder="00:00:00"
                          className="mt-1 h-7 w-full rounded border border-neutral-900 bg-neutral-950 px-2 font-mono text-[10px] tabular-nums text-white outline-none focus:border-neutral-700"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="font-sans text-[8px] normal-case text-neutral-600">
                    Editing a stage's total replaces every recorded sitting for that stage with a single manual entry. Leave a field unchanged to keep its existing history.
                  </p>
                </div>
              )}

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

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
  Bookmark,
  X
} from 'lucide-react';
import { GitHubRepo, SystemEvent, Topic, TopicActivity, TopicSortMode } from '../types';
import { getTopicCurrentWorkflow, getTopicWorkflowState } from '../services/topicWorkflow';
import { useDismissOnOutsideClick } from '../hooks/useDismissOnOutsideClick';

interface GithubViewProps {
  repos: GitHubRepo[];
  onAddEvent: (evt: SystemEvent) => void;
  onUpdateRepo: (repoId: string, updatedRepo: Partial<GitHubRepo>) => void;
  onTriggerDeploy: (projectName: string) => void;
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  activities: TopicActivity[];
  setActivities: React.Dispatch<React.SetStateAction<TopicActivity[]>>;
  sortOrder: TopicSortMode;
  setSortOrder: React.Dispatch<React.SetStateAction<TopicSortMode>>;
  onDeleteContentItem?: (itemId: string, label: string, topicName?: string) => void;
  onDeleteContentItems?: (items: Array<{ id: string; label: string; topicName?: string }>, label: string) => void;
  isAddFormOpen?: boolean;
  setIsAddFormOpen?: (open: boolean) => void;
  setActiveTab?: (tab: string) => void;
  setPipelineSubView?: (subView: 'videos' | 'topics') => void;
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

function localDateKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Blinking logic helper (Due date within 2 days gap)
function shouldBlink(dueDateStr: string | null, now: Date = new Date()) {
  try {
    if (!dueDateStr) return false;
    const due = new Date(dueDateStr);
    if (isNaN(due.getTime())) return false;
    const diffTime = due.getTime() - now.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    // Blink if due date is within 2 days (48 hours) and not already past
    return diffDays >= -0.5 && diffDays <= 2;
  } catch (err) {
    console.error('Error in shouldBlink:', err);
    return false;
  }
}

// Generate human-friendly countdown label for due soon status
function getDueDateWarningText(dueDateStr: string | null, now: Date = new Date()) {
  try {
    if (!dueDateStr) return '';
    const due = new Date(dueDateStr);
    if (isNaN(due.getTime())) return '';
    const diff = due.getTime() - now.getTime();

    if (diff <= 0) {
      return 'Warning: Overdue!';
    }

    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    // Parse direct local dates to see if it is today
    // We use local date strings to compare dates directly
    const localDueStr = due.toLocaleDateString();
    const localNowStr = now.toLocaleDateString();
    const isToday = localDueStr === localNowStr;

    if (isToday || days === 0) {
      if (hours > 0) {
        return `Warning: Due in ${hours}h ${mins % 60}m!`;
      } else if (mins > 0) {
        return `Warning: Due in ${mins}m ${secs % 60}s!`;
      } else {
        return `Warning: Due in ${secs}s!`;
      }
    }

    if (days === 1) {
      return `Warning: Due in 1 day!`;
    }

    return `Warning: Due in ${days} days!`;
  } catch (err) {
    console.error('Error in getDueDateWarningText:', err);
    return '';
  }
}

export default function GithubView({
  repos,
  onAddEvent,
  onUpdateRepo,
  onTriggerDeploy,
  topics,
  setTopics,
  activities,
  setActivities,
  sortOrder,
  setSortOrder,
  onDeleteContentItem,
  onDeleteContentItems,
  isAddFormOpen: isAddFormOpenProp,
  setIsAddFormOpen: setIsAddFormOpenProp,
  setActiveTab,
  setPipelineSubView
}: GithubViewProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Selected channel filter: 'All' | 'LearnDriven' | 'DecodeWorthy'
  const [selectedChannel, setSelectedChannel] = useState<'All' | 'LearnDriven' | 'DecodeWorthy' | 'Later'>('All');

  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useDismissOnOutsideClick<HTMLDivElement>(
    isSortMenuOpen,
    true,
    () => setIsSortMenuOpen(false)
  );

  // 3. Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Topics and activities are now passed as props from App.tsx to support selective DB reset integrity.

  // Form states for creating a new Topic
  const [localIsAddFormOpen, setLocalIsAddFormOpen] = useState(false);
  const isAddFormOpen = isAddFormOpenProp !== undefined ? isAddFormOpenProp : localIsAddFormOpen;
  const setIsAddFormOpen = setIsAddFormOpenProp !== undefined ? setIsAddFormOpenProp : setLocalIsAddFormOpen;

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  // Distinguishes "opened for a fresh Add Topic" from "opened via
  // startEditTopic" â€” both just flip the same isAddFormOpen boolean (which
  // can also be toggled externally, from App.tsx's header button), so
  // without this flag the form would keep showing whatever topic was last
  // edited instead of a blank slate.
  const openedForEditRef = useRef(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');
  const [newTopicChannel, setNewTopicChannel] = useState<'LearnDriven' | 'DecodeWorthy' | null>(null);
  const [newTopicStatus, setNewTopicStatus] = useState<'topic' | 'scripted' | 'shot' | 'edited' | 'scheduled'>('topic');
  const [newTopicPriority, setNewTopicPriority] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [newTopicDueDate, setNewTopicDueDate] = useState('');
  const todayDateKey = localDateKey();
  const tomorrowDateKey = localDateKey(1);
  const [newTopicSchedTime, setNewTopicSchedTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  const getScheduledTopicChannelsForDate = (dateStr: string) => {
    const matchingTopics = topics.filter(t => {
      if (!t.dueDate) return false;
      const formattedDue = t.dueDate.split('T')[0];
      return formattedDue === dateStr;
    });
    return {
      hasLearnDriven: matchingTopics.some(t => t.channel === 'LearnDriven'),
      hasDecodeWorthy: matchingTopics.some(t => t.channel === 'DecodeWorthy')
    };
  };

  const [newTopicLane, setNewTopicLane] = useState<'Shorts' | 'Long' | 'Members-Only' | null>(null);
  const [eligibility, setEligibility] = useState({
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
  });

  // Outside-click dismisses the Add Topic panel only when nothing has been
  // entered yet. Editing an existing topic always requires the explicit
  // close/cancel control, since the form starts pre-filled with real data.
  const hasUnsavedTopicInput = Boolean(
    editingTopicId ||
    newTopicName.trim() ||
    newTopicDesc.trim() ||
    newTopicChannel ||
    newTopicDueDate ||
    newTopicSchedTime ||
    newTopicLane ||
    newTopicStatus !== 'topic' ||
    newTopicPriority !== 1 ||
    Object.values(eligibility).some(Boolean)
  );
  const addTopicFormRef = useDismissOnOutsideClick<HTMLFormElement>(
    isAddFormOpen,
    !hasUnsavedTopicInput,
    () => { setIsAddFormOpen(false); setEditingTopicId(null); }
  );

  const getAutomaticRevenueLevel = () => {
    // Check if any eligibility is selected
    const isAnySelected = 
      eligibility.neutral ||
      eligibility.productTag ||
      eligibility.viral ||
      eligibility.pinnedPromo ||
      eligibility.below8Min ||
      eligibility.exceed8Min ||
      eligibility.strongReach ||
      eligibility.brandCollab ||
      eligibility.productLinks ||
      eligibility.membersOnly;

    if (!isAnySelected) return '';

    if (eligibility.neutral) return 'Lvl 0.5';

    if (newTopicLane === 'Shorts') {
      if (eligibility.viral) {
        if (eligibility.productTag && eligibility.pinnedPromo) return 'Lvl 4';
        if (eligibility.productTag) return 'Lvl 3';
        return 'Lvl 2';
      }
      return 'Lvl 1';
    } else if (newTopicLane === 'Long') {
      if (eligibility.brandCollab) return 'Lvl 20';
      
      const isOver8 = eligibility.exceed8Min;
      const isStrongReach = eligibility.strongReach;
      const hasProduct = eligibility.productTag || eligibility.productLinks;
      
      if (isStrongReach) {
        if (isOver8) {
          return hasProduct ? 'Lvl 9.5' : 'Lvl 9';
        } else {
          return hasProduct ? 'Lvl 8.5' : 'Lvl 8';
        }
      } else {
        if (isOver8) {
          return hasProduct ? 'Lvl 7.5' : 'Lvl 7';
        } else {
          return hasProduct ? 'Lvl 6.5' : 'Lvl 6';
        }
      }
    } else if (newTopicLane === 'Members-Only') {
      if (eligibility.membersOnly) return 'Lvl 5';
      return '';
    }

    return '';
  };

  const resetTopicForm = () => {
    setNewTopicName('');
    setNewTopicDesc('');
    setNewTopicDueDate('');
    setNewTopicSchedTime('');
    setNewTopicChannel(null);
    setNewTopicLane(null);
    setEligibility({
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
    });
    setNewTopicStatus('topic');
    setNewTopicPriority(1);
    setEditingTopicId(null);
  };

  // Whenever the form opens and it WASN'T startEditTopic that opened it,
  // start from a clean slate â€” covers every way the form can be opened
  // (this view's own header toggle, or App.tsx's top-level "Add Topic"
  // button controlling the same prop from outside).
  useEffect(() => {
    if (isAddFormOpen && !openedForEditRef.current) {
      resetTopicForm();
    }
    openedForEditRef.current = false;
  }, [isAddFormOpen]);

  // Handle adding a new Topic
  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicChannel || !newTopicName.trim()) return;

    const revLvl = getAutomaticRevenueLevel();
    // Content Lane must always be reflected as the topic's real stored
    // format everywhere else in the app reads it â€” never just used to
    // compute the revenue level and then discarded.
    const finalFormat: Topic['format'] = newTopicLane === 'Shorts' ? 'Short' : newTopicLane === 'Members-Only' ? 'Members' : 'Long';

    let inProgress = false;
    const defaultTime = newTopicChannel === 'LearnDriven' ? '21:09' : '19:07';
    const finalTime = newTopicSchedTime || defaultTime;
    let finalDueDate: string | null = newTopicDueDate ? new Date(`${newTopicDueDate}T${finalTime}:00`).toISOString() : null;
    let finalSchedTime: string | undefined = newTopicSchedTime ? newTopicSchedTime : undefined;
    const workflowStatuses: Record<string, 'completed' | 'in-progress' | 'pending'> = {};

    if (newTopicStatus !== 'topic') {
      inProgress = newTopicStatus === 'scripted' || newTopicStatus === 'shot' || newTopicStatus === 'edited';
      const stagesOrder: ('script' | 'shoot' | 'edit' | 'schedule' | 'post')[] = ['script', 'shoot', 'edit', 'schedule', 'post'];
      const statusToStageIdx: Record<string, number> = {
        scripted: 0,
        shot: 1,
        edited: 2,
        scheduled: 3,
        posted: 4
      };
      const targetIdx = statusToStageIdx[newTopicStatus] ?? -1;
      if (targetIdx !== -1) {
        stagesOrder.forEach((stg, idx) => {
          if (idx <= targetIdx) {
            workflowStatuses[stg] = 'completed';
          }
        });
      }

      if (newTopicStatus === 'scheduled') {
        const baseDate = newTopicDueDate || new Date().toISOString().split('T')[0];
        finalDueDate = new Date(`${baseDate}T${finalTime}:00`).toISOString();
        finalSchedTime = finalTime;
      }
    }

    if (editingTopicId) {
      const original = topics.find(t => t.id === editingTopicId);
      const updatedTopic: Topic = {
        ...(original as Topic),
        name: newTopicName,
        description: newTopicDesc,
        channel: newTopicChannel,
        status: newTopicStatus,
        priority: newTopicPriority,
        topicScore: 5,
        dueDate: finalDueDate,
        scheduledTime: finalSchedTime,
        format: finalFormat,
        lastUpdated: new Date().toISOString(),
        // A blank result here just means no eligibility box was touched this
        // time, not "clear the revenue level" â€” keep whatever was already set.
        revenueLevel: revLvl || original?.revenueLevel,
        inProgress: newTopicStatus === 'topic'
          ? (original?.inProgress ?? false)
          : (newTopicStatus === 'scripted' || newTopicStatus === 'shot' || newTopicStatus === 'edited'),
        workflowStatuses: newTopicStatus !== 'topic' ? workflowStatuses : original?.workflowStatuses
      };

      setTopics(prev => prev.map(t => t.id === editingTopicId ? updatedTopic : t));

      const changedFields: string[] = [];
      if (original) {
        if (original.name !== newTopicName) changedFields.push('name');
        if (original.description !== newTopicDesc) changedFields.push('description');
        if (original.channel !== newTopicChannel) changedFields.push('channel');
        if (original.status !== newTopicStatus) changedFields.push('status');
        if (original.priority !== newTopicPriority) changedFields.push('priority');
        if (original.dueDate !== finalDueDate) changedFields.push('due date');
        if (original.format !== finalFormat) changedFields.push('content lane');
      }
      setActivities(prev => [{
        id: `act-edit-${Date.now()}`,
        topicName: newTopicName,
        channel: newTopicChannel,
        action: changedFields.length > 0 ? `Edited topic (${changedFields.join(', ')})` : 'Edited topic',
        author: 'typeakshay',
        timestamp: new Date().toISOString()
      }, ...prev]);

      onAddEvent({
        id: `evt-topic-edited-${Date.now()}`,
        source: 'github',
        type: 'info',
        message: `Topic Engine: Updated topic "${newTopicName}".`,
        timestamp: new Date().toISOString()
      });

      setEditingTopicId(null);
    } else {
      const newTopic: Topic = {
        id: `t-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: newTopicName,
        description: newTopicDesc,
        channel: newTopicChannel,
        status: newTopicStatus,
        priority: newTopicPriority,
        topicScore: 5,
        dueDate: finalDueDate,
        scheduledTime: finalSchedTime,
        format: finalFormat,
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        revenueLevel: revLvl || undefined,
        inProgress,
        workflowStatuses: newTopicStatus !== 'topic' ? workflowStatuses : undefined
      };

      setTopics(prev => [newTopic, ...prev]);

      // Add activity log
      const newActivity: TopicActivity = {
        id: `act-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        topicName: newTopicName,
        channel: newTopicChannel,
        action: `Created new topic in ${newTopicStatus} stage` + (revLvl ? ` with ${revLvl}` : ''),
        author: 'typeakshay',
        timestamp: new Date().toISOString()
      };
      setActivities(prev => [newActivity, ...prev]);

      // Trigger system notification
      onAddEvent({
        id: `evt-topic-created-${Date.now()}`,
        source: 'github',
        type: 'success',
        message: `Topic Engine: Added topic "${newTopicName}" under ${newTopicChannel}` + (revLvl ? ` (${revLvl})` : ''),
        timestamp: new Date().toISOString()
      });

      // Auto redirection to pipeline if the created topic is already in production
      if (inProgress) {
        if (setPipelineSubView) setPipelineSubView('topics');
        if (setActiveTab) setActiveTab('pipeline');
      }
    }

    resetTopicForm();
    setIsAddFormOpen(false);
  };

  // Opens the same Add Topic form pre-filled with an existing topic's
  // values, so editing has access to every field creation does â€” instead of
  // the previous edit-nothing-but-delete-and-recreate workflow.
  const startEditTopic = (topic: Topic) => {
    openedForEditRef.current = true;
    setEditingTopicId(topic.id);
    setNewTopicName(topic.name);
    setNewTopicDesc(topic.description);
    setNewTopicChannel(topic.channel);
    setNewTopicStatus(topic.status === 'posted' ? 'scheduled' : topic.status);
    setNewTopicPriority(topic.priority);
    setNewTopicDueDate(topic.dueDate ? topic.dueDate.split('T')[0] : '');
    setNewTopicSchedTime(topic.scheduledTime || '');
    setNewTopicLane(topic.format === 'Short' ? 'Shorts' : topic.format === 'Members' ? 'Members-Only' : 'Long');
    // Eligibility checkboxes are the inputs that produced revenueLevel, not
    // something stored on the topic itself, so they can't be reconstructed
    // exactly â€” left blank here. The topic's existing revenueLevel is
    // preserved on save unless the user actively re-picks eligibility.
    setEligibility({
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
    });
    setIsAddFormOpen(true);
  };

  const topicDueTime = (topic: Topic) => {
    if (!topic.dueDate) return Number.MAX_SAFE_INTEGER;
    const hasTime = topic.dueDate.includes('T');
    const datePart = topic.dueDate.split('T')[0];
    const embeddedTime = hasTime ? topic.dueDate.split('T')[1]?.slice(0, 5) : '';
    const timePart = topic.scheduledTime || embeddedTime || '23:59';
    const parsed = new Date(`${datePart}T${timePart}:00`).getTime();
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };
  const topicLevel = (topic: Topic) => {
    const parsed = Number.parseFloat((topic.revenueLevel || '').replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed : -1;
  };
  const workRemaining = (topic: Topic) => ({ topic: 5, scripted: 4, shot: 3, edited: 2, scheduled: 1, posted: 0 } as const)[topic.status];
  const workloadScore = (topic: Topic) => {
    const due = topicDueTime(topic);
    const remaining = workRemaining(topic);
    if (due === Number.MAX_SAFE_INTEGER) return remaining;
    const hours = (due - Date.now()) / 36e5;
    if (hours <= 0) return 1_000_000 + remaining * 10_000 + Math.min(9_999, Math.abs(hours));
    return (remaining * 100_000) / Math.max(1, hours);
  };
  const topicLedState = (topic: Topic) => {
    const due = topicDueTime(topic);
    const remaining = workRemaining(topic);
    if (topic.blockedReason) return { tone: 'blocked', speed: '0.42s', active: true, label: `Blocked - ${topic.blockedReason}` };
    if (due === Number.MAX_SAFE_INTEGER) return { tone: 'idle', speed: '0s', active: false, label: `No deadline - ${remaining} stages remaining` };
    const hours = (due - now.getTime()) / 36e5;
    const loadBoost = remaining >= 4 ? 0.82 : remaining >= 2 ? 0.92 : 1;
    if (hours <= 0) return { tone: 'critical', speed: `${Math.max(.38, .58 * loadBoost)}s`, active: true, label: `Overdue - ${remaining} stages remaining` };
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    const currentDay = new Date(now);
    currentDay.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((dueDay.getTime() - currentDay.getTime()) / 86400000);
    if (daysLeft <= 1) return { tone: 'critical', speed: `${Math.max(.38, .58 * loadBoost)}s`, active: true, label: `Critical - due in ${Math.ceil(hours)} hours` };
    if (daysLeft === 2) return { tone: 'danger', speed: `${.82 * loadBoost}s`, active: true, label: `Urgent - due in 2 days` };
    if (daysLeft === 3) return { tone: 'watch', speed: `${1.18 * loadBoost}s`, active: true, label: 'Attention - due in 3 days' };
    if (daysLeft < 7) return { tone: 'green', speed: `${1.65 * loadBoost}s`, active: true, label: `Advance warning - due in ${daysLeft} days` };
    return { tone: 'blue', speed: '0s', active: false, label: `On track - due in ${daysLeft} days` };
  };

  const sortLabels: Record<TopicSortMode, string> = {
    'due-date': 'Due date / time',
    'last-created': 'Last created',
    level: 'Level: H to L',
    'progress-most': 'Most work left',
    'progress-least': 'Least work left',
    workload: 'Workload priority'
  };

  // Filter topics based on channel filter & search query
  const filteredTopics = useMemo(() => {
    return topics
      .filter(t => {
        const matchesChannel = selectedChannel === 'Later'
          ? Boolean(t.savedForLater)
          : !t.savedForLater && (selectedChannel === 'All' || t.channel === selectedChannel);
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              t.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesChannel && matchesSearch;
      })
      .sort((a, b) => {
        if (sortOrder === 'due-date') return topicDueTime(a) - topicDueTime(b) || new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
        if (sortOrder === 'last-created') return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
        if (sortOrder === 'level') return topicLevel(b) - topicLevel(a) || topicDueTime(a) - topicDueTime(b);
        if (sortOrder === 'progress-most') return workRemaining(b) - workRemaining(a) || topicDueTime(a) - topicDueTime(b);
        if (sortOrder === 'progress-least') return workRemaining(a) - workRemaining(b) || topicDueTime(a) - topicDueTime(b);
        return workloadScore(b) - workloadScore(a) || topicDueTime(a) - topicDueTime(b);
      });
  }, [topics, selectedChannel, searchQuery, sortOrder]);

  const criticalTopics = topics.filter(topic => {
    if (selectedChannel !== 'All' && topic.channel !== selectedChannel) return false;
    if (!topic.dueDate || getTopicWorkflowState(topic, 'schedule') === 'completed') return false;
    const hours = (topicDueTime(topic) - now.getTime()) / 36e5;
    return hours <= 24;
  });
  const highlightCriticalTopics = () => {
    setSearchQuery('');
    window.setTimeout(() => {
      document.querySelectorAll('.command-action-target').forEach(element => element.classList.remove('command-action-target'));
      const targets = criticalTopics
        .map(topic => document.getElementById(`topic-inventory-${topic.id}`))
        .filter((element): element is HTMLElement => Boolean(element));
      targets.forEach(target => {
        target.classList.add('command-action-target');
        window.setTimeout(() => {
          const acknowledge = () => {
            target.classList.remove('command-action-target');
            target.removeEventListener('pointerenter', acknowledge);
            target.removeEventListener('pointermove', acknowledge);
            target.removeEventListener('pointerdown', acknowledge);
            target.removeEventListener('touchstart', acknowledge);
            target.removeEventListener('click', acknowledge);
            target.removeEventListener('keydown', acknowledge);
          };
          target.addEventListener('pointerenter', acknowledge);
          target.addEventListener('pointermove', acknowledge);
          target.addEventListener('pointerdown', acknowledge);
          target.addEventListener('touchstart', acknowledge, { passive: true });
          target.addEventListener('click', acknowledge);
          target.addEventListener('keydown', acknowledge);
        }, 500);
      });
      targets[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  // Compute aggregate stats based on channel
  const stats = useMemo(() => {
    const subset = topics.filter(t => selectedChannel === 'Later'
      ? Boolean(t.savedForLater)
      : !t.savedForLater && (selectedChannel === 'All' || t.channel === selectedChannel));
    const topicCount = subset.filter(t => getTopicWorkflowState(t, 'script') === 'pending').length;
    const scripted = subset.filter(t => getTopicWorkflowState(t, 'script') === 'completed').length;
    const shot = subset.filter(t => getTopicWorkflowState(t, 'shoot') === 'completed').length;
    const edited = subset.filter(t => getTopicWorkflowState(t, 'edit') === 'completed').length;
    const scheduled = subset.filter(t => getTopicWorkflowState(t, 'schedule') === 'completed').length;

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
      topicCount,
      scripted,
      shot,
      edited,
      scheduled,
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

  const renderTopicCard = (topic: Topic) => {
    const prio = getPriorityDetails(topic.priority);
    const workflow = getTopicCurrentWorkflow(topic);
    const led = topicLedState(topic);
    const isDueSoon = getTopicWorkflowState(topic, 'schedule') !== 'completed' && led.active;

    const statusColors = {
      script: 'text-blue-400 bg-blue-950/20 border-blue-900/20',
      shoot: 'text-amber-400 bg-amber-950/20 border-amber-900/20',
      edit: 'text-emerald-400 bg-emerald-950/20 border-emerald-900/20',
      schedule: 'text-pink-400 bg-pink-950/20 border-pink-900/20',
      post: 'text-rose-400 bg-rose-950/20 border-rose-900/20'
    }[workflow.stage];

    return (
      <div
        key={topic.id}
        id={`topic-inventory-${topic.id}`}
        className={`p-3.5 bg-neutral-950/30 hover:bg-neutral-900/20 border rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono text-[11px] transition-all duration-300 hover:translate-x-0.5 ${
          isDueSoon
            ? 'border-red-950/40 hover:border-red-900/40 bg-red-950/5 shadow-[0_0_12px_rgba(239,68,68,0.03)]'
            : 'border-neutral-900 hover:border-neutral-800/80'
        }`}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`topic-led topic-led--${led.tone} mt-0.5 shrink-0`} title={led.label} style={{ '--topic-led-speed': led.speed } as React.CSSProperties}>
            <span className="topic-led__bezel"><span className="topic-led__lens"><span className="topic-led__glint" /></span></span>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-xs font-bold text-neutral-200 truncate">{topic.name}</span>
              <span className="px-1.5 py-0.2 bg-neutral-900/40 text-neutral-500 border border-neutral-900 rounded text-[9px]">
                {topic.channel}
              </span>
              {topic.format && (
                <span className="px-1.5 py-0.2 bg-cyan-950/20 text-cyan-400 border border-cyan-900/30 rounded text-[9px] font-bold">
                  {topic.format}
                </span>
              )}
              {topic.category && (
                <span className="px-1.5 py-0.2 bg-violet-950/20 text-violet-400 border border-violet-900/30 rounded text-[9px]">
                  {topic.category}
                </span>
              )}
              {topic.isDemo && (
                <span className="px-1.5 py-0.2 bg-amber-950/20 text-amber-400 border border-amber-900/30 rounded text-[9px] font-bold">
                  Demo â€¢ Deletable
                </span>
              )}
              {topic.revenueLevel && (
                <span className="px-1.5 py-0.2 bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 rounded text-[9px] font-bold">
                  {topic.revenueLevel}
                </span>
              )}
              {!topic.inProgress && topic.status !== 'scheduled' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTopics(prev => prev.map(t => t.id === topic.id ? {
                      ...t,
                      inProgress: true,
                      lastUpdated: new Date().toISOString()
                    } : t));

                    const newActivity: TopicActivity = {
                      id: `act-progress-${Date.now()}`,
                      topicName: topic.name,
                      channel: topic.channel,
                      action: `Moved topic to progress section`,
                      author: 'typeakshay',
                      timestamp: new Date().toISOString()
                    };
                    setActivities(prev => [newActivity, ...prev]);

                    onAddEvent({
                      id: `evt-to-progress-${Date.now()}`,
                      source: 'github',
                      type: 'info',
                      message: `Workflow Engine: "${topic.name}" moved to active production pipeline.`,
                      timestamp: new Date().toISOString()
                    });

                    if (setPipelineSubView) setPipelineSubView('topics');
                    if (setActiveTab) setActiveTab('pipeline');
                  }}
                  className="px-1.5 py-0.2 bg-blue-950/45 hover:bg-blue-900/20 text-blue-400 border border-blue-900/40 hover:border-blue-500 hover:text-white rounded text-[8px] font-mono transition cursor-pointer select-none"
                  title="Send to Progress section"
                >
                  Start Pipeline â†’
                </button>
              )}
              {(topic.inProgress || topic.status === 'scheduled' || topic.status === 'posted') && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (setPipelineSubView) setPipelineSubView('topics');
                    if (setActiveTab) setActiveTab('pipeline');
                  }}
                  className="px-1.5 py-0.2 bg-amber-950/35 hover:bg-amber-900/25 text-amber-400 border border-amber-900/40 hover:border-amber-500 rounded text-[8px] font-mono transition cursor-pointer"
                  title="Open edit, delete, reset, and status controls"
                >
                  Manage â†’
                </button>
              )}
            </div>
            <p className="text-[10px] text-neutral-400 font-sans leading-relaxed">{topic.description}</p>

            {topic.dueDate && (
              <div className="flex items-center gap-1 text-[9px] text-neutral-500 italic mt-0.5 font-sans">
                <Calendar className="h-3 w-3" />
                <span>Due date: {new Date(topic.dueDate).toLocaleDateString()}</span>
                {isDueSoon && (
                  <span className="text-red-400 font-bold ml-1 uppercase animate-pulse">
                    {getDueDateWarningText(topic.dueDate, now)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase ${statusColors}`}>
            {workflow.label}
          </span>

          <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${prio.style}`}>
            {prio.text}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const savedForLater = !topic.savedForLater;
              setTopics(prev => prev.map(item => item.id === topic.id ? {
                ...item,
                savedForLater,
                lastUpdated: new Date().toISOString()
              } : item));
              setActivities(prev => [{
                id: `act-later-${topic.id}-${Date.now()}`,
                topicName: topic.name,
                channel: topic.channel,
                action: savedForLater ? 'Saved topic for later' : 'Restored topic from Later',
                author: 'typeakshay',
                timestamp: new Date().toISOString()
              }, ...prev]);
            }}
            className={`p-1 rounded transition cursor-pointer ${topic.savedForLater ? 'text-blue-400 bg-blue-950/20' : 'text-neutral-600 hover:text-blue-400 hover:bg-blue-950/20'}`}
            title={topic.savedForLater ? 'Restore from Later' : 'Save for later'}
            aria-label={topic.savedForLater ? 'Restore from Later' : 'Save for later'}
          >
            <Bookmark className={`h-3.5 w-3.5 ${topic.savedForLater ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              startEditTopic(topic);
            }}
            className="p-1 rounded text-neutral-600 hover:text-blue-400 hover:bg-blue-950/20 transition cursor-pointer"
            title="Edit topic"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteContentItem?.(topic.id, topic.name, topic.name);
              onAddEvent({
                id: `evt-topic-delete-${Date.now()}`,
                source: 'github',
                type: 'warning',
                message: `Topic Repos: Queued delete for topic "${topic.name}".`,
                timestamp: new Date().toISOString()
              });
            }}
            className="p-1 rounded text-neutral-600 hover:text-rose-400 hover:bg-rose-950/20 transition cursor-pointer"
            title="Delete topic"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const activeTopics = useMemo(() => filteredTopics.filter(topic => {
    const isPosted = topic.status === 'posted';
    const isScheduled = topic.status === 'scheduled' || (getTopicWorkflowState(topic, 'schedule') === 'completed' && topic.status !== 'posted');
    return !isPosted && !isScheduled;
  }), [filteredTopics]);

  const scheduledTopics = useMemo(() => filteredTopics.filter(topic => {
    const isPosted = topic.status === 'posted';
    const isScheduled = topic.status === 'scheduled' || (getTopicWorkflowState(topic, 'schedule') === 'completed' && topic.status !== 'posted');
    return isScheduled && !isPosted;
  }), [filteredTopics]);

  const postedTopics = useMemo(() => filteredTopics.filter(topic => topic.status === 'posted'), [filteredTopics]);

  return (
    <div className="space-y-6">
      {/* Top header - same visual language as AI Insights: icon badge, glow blob, motion entrance */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-xl border border-neutral-800/80 bg-neutral-900/70 shadow-[0_10px_30px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.025)]"
      >
        <motion.div
          className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-blue-500/8 blur-3xl pointer-events-none"
          animate={{ x: [0, -20, 10, 0], y: [0, 15, -10, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-8 w-8 rounded-lg bg-blue-950/30 border border-blue-900/40 text-blue-400">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-100 font-mono tracking-tight flex items-center gap-2">
                Topic Dashboard
                <span className="px-1.5 py-0.2 bg-blue-950/30 text-blue-400 border border-blue-900/40 font-mono text-[10px] rounded">
                  Total: {stats.total}
                </span>
              </h2>
              <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">
                Last created: {stats.lastCreatedText}
              </p>
            </div>
          </div>

          {/* Channel Filter Buttons */}
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {(['All', 'LearnDriven', 'DecodeWorthy', 'Later'] as const).map(channel => (
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
      </motion.div>

      {/* Main Grid: Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Main content block) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Card (Topic Status Details) */}
          <div className="bg-neutral-900/70 border border-neutral-800/80 rounded-xl p-5 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.025)] hover:border-neutral-700/80 transition duration-300">
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

            {/* Metrics Row: Topic, Scripted, Shot, Edited, Scheduled */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 mt-6 pt-5 border-t border-neutral-900/60 font-mono">
              <div className="p-3 bg-purple-950/5 rounded-lg border border-purple-950/30 hover:border-purple-900/30 hover:bg-purple-950/10 transition duration-300 group/metric">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Topic</span>
                <span className="text-xs font-bold text-purple-400 mt-1 flex items-center gap-1.5 group-hover/metric:translate-x-0.5 transition-transform duration-300">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {stats.topicCount} ideas
                </span>
              </div>

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

              <div className="p-3 bg-pink-950/5 rounded-lg border border-pink-950/30 hover:border-pink-900/30 hover:bg-pink-950/10 transition duration-300 group/metric">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Scheduled</span>
                <span className="text-xs font-bold text-pink-400 mt-1 flex items-center gap-1.5 group-hover/metric:translate-x-0.5 transition-transform duration-300">
                  <Clock className="h-3.5 w-3.5" />
                  {stats.scheduled} scheduled
                </span>
              </div>
            </div>
          </div>

          {/* Topics List Card (repurposed from GitHub Actions) */}
          <div className="bg-neutral-900/70 border border-neutral-800/80 rounded-xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.025)] hover:border-neutral-700/80 transition duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">Topics List</h3>
                <p className="text-xs text-neutral-500 font-mono">Consolidated directory of all topics, tags, and execution deadlines.</p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {topics.some(topic => topic.isDemo) && (
                  <button
                    type="button"
                    onClick={() => {
                      const demoTopics = topics.filter(topic => topic.isDemo);
                      onDeleteContentItems?.(
                        demoTopics.map(topic => ({ id: topic.id, label: topic.name, topicName: topic.name })),
                        'Remove all injected demo topics'
                      );
                    }}
                    className="px-2.5 py-1 bg-amber-950/20 border border-amber-900/40 hover:border-amber-700 text-amber-400 rounded text-[10px] font-mono flex items-center gap-1.5 shrink-0 transition"
                    title="Permanently remove all injected demo topics"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove demos
                  </button>
                )}

                {/* Search query input */}
                <input 
                  type="text"
                  placeholder="Filter by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-neutral-900/50 text-xs border border-neutral-900 rounded px-2.5 py-1 outline-none text-neutral-300 font-mono w-full sm:w-36 focus:border-neutral-800 transition-colors"
                />

                {/* Operational Sorter */}
                <div ref={sortMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsSortMenuOpen(open => !open)}
                    className="flex items-center gap-2 rounded border border-neutral-900 bg-neutral-900/50 py-1 pl-2.5 pr-2 text-xs font-mono text-neutral-300 outline-none transition hover:border-neutral-800 hover:text-white focus:border-neutral-700"
                    title="Sort topics"
                    aria-haspopup="listbox"
                    aria-expanded={isSortMenuOpen}
                  >
                    <ArrowUpDown className="h-3 w-3 text-rose-400" />
                    <span>{sortLabels[sortOrder]}</span>
                    <ChevronDown className={`h-3 w-3 text-neutral-600 transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {isSortMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-full overflow-hidden rounded border border-neutral-800 bg-neutral-950 p-1 shadow-2xl shadow-black/70"
                        role="listbox"
                        aria-label="Sort topics"
                      >
                        {(Object.entries(sortLabels) as Array<[TopicSortMode, string]>).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setSortOrder(value);
                              setIsSortMenuOpen(false);
                            }}
                            className={`block w-full whitespace-nowrap rounded px-3 py-2 text-left text-xs font-mono transition-colors ${
                              value === sortOrder
                                ? 'bg-rose-500/15 text-rose-300'
                                : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'
                            }`}
                            role="option"
                            aria-selected={value === sortOrder}
                          >
                            {label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* List of Topics */}
            <div className="space-y-5 max-h-[460px] overflow-y-auto pr-1">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                  <div>
                    <h4 className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">Active topics</h4>
                    <p className="mt-1 text-[10px] font-mono text-neutral-600">Topics still moving through the workflow.</p>
                  </div>
                  <span className="rounded border border-neutral-900 bg-neutral-950 px-2 py-0.5 text-[9px] font-mono text-neutral-500">
                    {activeTopics.length}
                  </span>
                </div>
                {activeTopics.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-900 py-8 text-center text-xs font-mono text-neutral-500">
                    No active topics matching filters.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeTopics.map(renderTopicCard)}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                  <div>
                    <h4 className="text-[10px] uppercase tracking-[0.3em] text-pink-400/80">Scheduled topics</h4>
                    <p className="mt-1 text-[10px] font-mono text-neutral-600">Ready to publish, but not posted yet.</p>
                  </div>
                  <span className="rounded border border-pink-900/40 bg-pink-950/20 px-2 py-0.5 text-[9px] font-mono text-pink-300">
                    {scheduledTopics.length}
                  </span>
                </div>
                {scheduledTopics.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-900 py-8 text-center text-xs font-mono text-neutral-500">
                    No scheduled topics yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {scheduledTopics.map(renderTopicCard)}
                  </div>
                )}
              </div>

              <div className="space-y-3 pb-1">
                <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                  <div>
                    <h4 className="text-[10px] uppercase tracking-[0.3em] text-rose-400/80">Posted topics</h4>
                    <p className="mt-1 text-[10px] font-mono text-neutral-600">Published work archived at the bottom of the page.</p>
                  </div>
                  <span className="rounded border border-rose-900/40 bg-rose-950/20 px-2 py-0.5 text-[9px] font-mono text-rose-300">
                    {postedTopics.length}
                  </span>
                </div>
                {postedTopics.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-900 py-8 text-center text-xs font-mono text-neutral-500">
                    No posted topics yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {postedTopics.map(renderTopicCard)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar Column */}
        <div className="space-y-6">
          {/* Add / Edit Topic Card (repurposed from Pull Requests) */}
          <div className="bg-neutral-900/70 border border-neutral-800/80 rounded-xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.025)] hover:border-neutral-700/80 transition duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-200">{editingTopicId ? 'Edit Topic' : 'Topic Management'}</h3>
              <button
                onClick={() => {
                  if (isAddFormOpen) {
                    setEditingTopicId(null);
                  }
                  setIsAddFormOpen(!isAddFormOpen);
                }}
                className={`p-1.5 rounded border transition cursor-pointer ${
                  isAddFormOpen
                    ? 'bg-neutral-800/60 hover:bg-neutral-700/60 text-neutral-300 hover:text-white border-neutral-600'
                    : 'bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border-rose-500/40 hover:border-rose-400 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.15)]'
                }`}
                title={isAddFormOpen ? (editingTopicId ? 'Cancel edit' : 'Close') : 'Create a New Topic'}
              >
                {isAddFormOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </button>
            </div>

            {/* Form to Add Topic */}
            {isAddFormOpen ? (
              <motion.form
                ref={addTopicFormRef}
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
                    placeholder="e.g. Next-Generation TypeScript Strategies"
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

                <div>
                  <label className="block uppercase text-neutral-500">Creator Channel</label>
                  <div className="flex gap-2.5 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (newTopicChannel === 'LearnDriven') {
                          setNewTopicChannel(null);
                          setNewTopicLane(null);
                        } else {
                          setNewTopicChannel('LearnDriven');
                          setNewTopicLane(null);
                          if (!newTopicSchedTime || newTopicSchedTime === '19:07') {
                            setNewTopicSchedTime('21:09');
                          }
                        }
                      }}
                      className={`flex-1 py-1.5 rounded border font-mono font-bold text-center transition text-xs select-none cursor-pointer ${
                        newTopicChannel === 'LearnDriven'
                          ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_8px_rgba(244,63,94,0.25)]'
                          : 'bg-neutral-950 border-neutral-900 text-neutral-400 hover:text-neutral-200 hover:border-neutral-800'
                      }`}
                    >
                      LearnDriven
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (newTopicChannel === 'DecodeWorthy') {
                          setNewTopicChannel(null);
                          setNewTopicLane(null);
                        } else {
                          setNewTopicChannel('DecodeWorthy');
                          setNewTopicLane('Shorts');
                          if (!newTopicSchedTime || newTopicSchedTime === '21:09') {
                            setNewTopicSchedTime('19:07');
                          }
                        }
                      }}
                      className={`flex-1 py-1.5 rounded border font-mono font-bold text-center transition text-xs select-none cursor-pointer ${
                        newTopicChannel === 'DecodeWorthy'
                          ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_8px_rgba(244,63,94,0.25)]'
                          : 'bg-neutral-950 border-neutral-900 text-neutral-400 hover:text-neutral-200 hover:border-neutral-800'
                      }`}
                    >
                      DecodeWorthy
                    </button>
                  </div>
                </div>

                {newTopicChannel && (
                  <div>
                    <label className="block uppercase text-neutral-500">Content Lane</label>
                    <div className="flex gap-2 mt-1">
                      {newTopicChannel === 'LearnDriven' ? (
                        (['Shorts', 'Long', 'Members-Only'] as const).map(lane => (
                          <button
                            key={lane}
                            type="button"
                            onClick={() => setNewTopicLane(lane)}
                            className={`flex-1 py-1.5 rounded border font-mono font-bold text-center transition text-[10px] select-none cursor-pointer ${
                              newTopicLane === lane
                                ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_8px_rgba(37,99,235,0.25)]'
                                : 'bg-neutral-950 border-neutral-900 text-neutral-400 hover:text-neutral-200 hover:border-neutral-800'
                            }`}
                          >
                            {lane}
                          </button>
                        ))
                      ) : (
                        <button
                          key="DW-Shorts"
                          type="button"
                          onClick={() => setNewTopicLane('Shorts')}
                          className="flex-1 py-1.5 rounded border border-blue-500 bg-blue-600 text-white font-mono font-bold text-center text-[10px] select-none cursor-pointer shadow-[0_0_8px_rgba(37,99,235,0.25)]"
                        >
                          Shorts
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block uppercase text-neutral-500">Auto Revenue Level</label>
                    <div className="w-full bg-neutral-950/60 border border-neutral-900 text-emerald-400 font-bold text-xs rounded px-2.5 py-1.5 mt-1 select-none h-[28px] flex items-center">
                      {getAutomaticRevenueLevel() || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block uppercase text-neutral-500">Current Production Stage</label>
                    <select 
                      value={newTopicStatus}
                      onChange={(e) => setNewTopicStatus(e.target.value as any)}
                      className="w-full bg-neutral-950 border border-neutral-900 focus:border-neutral-800 outline-none text-xs rounded px-2 py-1 mt-1 text-white h-[28px]"
                    >
                      <option value="topic">Topic</option>
                      <option value="scripted">Scripted</option>
                      <option value="shot">Shot</option>
                      <option value="edited">Edited</option>
                      <option value="scheduled">Scheduled</option>
                    </select>
                  </div>
                </div>

                {/* Revenue Eligibility Checklist */}
                {newTopicLane && (
                  <div className="space-y-1.5 pt-1.5 border-t border-neutral-900/60">
                    <label className="block uppercase text-neutral-500">Revenue streams</label>
                    <p className="text-[8px] text-neutral-600 font-sans">Options change depending on content lane selected.</p>
                    
                    <div className="grid grid-cols-2 gap-2 mt-1 font-sans text-[9px] text-neutral-400">
                      <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-200">
                        <input 
                          type="checkbox"
                          checked={eligibility.neutral}
                          onChange={(e) => setEligibility(prev => ({ ...prev, neutral: e.target.checked }))}
                          className="rounded border-neutral-900 bg-neutral-950 text-rose-500 outline-none focus:ring-0"
                        />
                        <span>Neutral - Level 0.5</span>
                      </label>

                      {newTopicLane === 'Shorts' && (
                        <>
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-200">
                            <input 
                              type="checkbox"
                              checked={eligibility.productTag}
                              onChange={(e) => setEligibility(prev => ({ ...prev, productTag: e.target.checked }))}
                              className="rounded border-neutral-900 bg-neutral-950 text-rose-500 outline-none focus:ring-0"
                            />
                            <span>Product tag</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-200">
                            <input 
                              type="checkbox"
                              checked={eligibility.viral}
                              onChange={(e) => setEligibility(prev => ({ ...prev, viral: e.target.checked }))}
                              className="rounded border-neutral-900 bg-neutral-950 text-rose-500 outline-none focus:ring-0"
                            />
                            <span>Viral potential</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-200">
                            <input 
                              type="checkbox"
                              checked={eligibility.pinnedPromo}
                              onChange={(e) => setEligibility(prev => ({ ...prev, pinnedPromo: e.target.checked }))}
                              className="rounded border-neutral-900 bg-neutral-950 text-rose-500 outline-none focus:ring-0"
                            />
                            <span>Pinned promotion</span>
                          </label>
                        </>
                      )}

                      {newTopicLane === 'Long' && (
                        <>
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-200">
                            <input 
                              type="checkbox"
                              checked={eligibility.below8Min}
                              onChange={(e) => setEligibility(prev => ({ 
                                ...prev, 
                                below8Min: e.target.checked,
                                exceed8Min: e.target.checked ? false : prev.exceed8Min
                              }))}
                              className="rounded border-neutral-900 bg-neutral-950 text-rose-500 outline-none focus:ring-0"
                            />
                            <span>Below 8 mins</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-200">
                            <input 
                              type="checkbox"
                              checked={eligibility.exceed8Min}
                              onChange={(e) => setEligibility(prev => ({ 
                                ...prev, 
                                exceed8Min: e.target.checked,
                                below8Min: e.target.checked ? false : prev.below8Min
                              }))}
                              className="rounded border-neutral-900 bg-neutral-950 text-rose-500 outline-none focus:ring-0"
                            />
                            <span>Exceeds 8 mins</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-200">
                            <input 
                              type="checkbox"
                              checked={eligibility.strongReach}
                              onChange={(e) => setEligibility(prev => ({ ...prev, strongReach: e.target.checked }))}
                              className="rounded border-neutral-900 bg-neutral-950 text-rose-500 outline-none focus:ring-0"
                            />
                            <span>Strong reach potential</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-200">
                            <input 
                              type="checkbox"
                              checked={eligibility.brandCollab}
                              onChange={(e) => setEligibility(prev => ({ ...prev, brandCollab: e.target.checked }))}
                              className="rounded border-neutral-900 bg-neutral-950 text-rose-500 outline-none focus:ring-0"
                            />
                            <span>Brand collab</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-200">
                            <input 
                              type="checkbox"
                              checked={eligibility.productTag}
                              onChange={(e) => setEligibility(prev => ({ ...prev, productTag: e.target.checked }))}
                              className="rounded border-neutral-900 bg-neutral-950 text-rose-500 outline-none focus:ring-0"
                            />
                            <span>Product tags</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-200">
                            <input 
                              type="checkbox"
                              checked={eligibility.productLinks}
                              onChange={(e) => setEligibility(prev => ({ ...prev, productLinks: e.target.checked }))}
                              className="rounded border-neutral-900 bg-neutral-950 text-rose-500 outline-none focus:ring-0"
                            />
                            <span>Product links in description</span>
                          </label>
                        </>
                      )}

                      {newTopicLane === 'Members-Only' && (
                        <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-200 col-span-2">
                          <input 
                            type="checkbox"
                            checked={eligibility.membersOnly}
                            onChange={(e) => setEligibility(prev => ({ ...prev, membersOnly: e.target.checked }))}
                            className="rounded border-neutral-900 bg-neutral-950 text-rose-500 outline-none focus:ring-0"
                          />
                          <span>Members-only subscription value</span>
                        </label>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 pt-1 border-t border-neutral-900/60">
                  <div>
                    <label className="block uppercase text-neutral-500">Priority</label>
                    <div className="flex gap-1.5 mt-1.5">
                      {([1, 2, 3, 4, 5] as const).map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setNewTopicPriority(num)}
                          className={`w-5.5 h-5.5 rounded border font-mono font-bold flex items-center justify-center transition text-[9px] select-none cursor-pointer ${
                            newTopicPriority === num
                              ? 'bg-rose-500 border-rose-400 text-white shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                              : 'bg-neutral-950 border-neutral-900 text-neutral-400 hover:text-neutral-200 hover:border-neutral-800'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block uppercase text-neutral-500">Due Date</label>
                    <div className="relative">
                      <div
                        onClick={() => setShowDatePicker(!showDatePicker)}
                        className="w-full bg-neutral-950 border border-neutral-900 focus-within:border-neutral-800 outline-none text-[10px] rounded px-2 py-1.5 mt-1 text-white flex items-center justify-between cursor-pointer select-none"
                      >
                        <span className={newTopicDueDate ? 'text-white' : 'text-neutral-500'}>
                          {newTopicDueDate || 'dd - mm - yyyy'}
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
                                    setPickerDate(prev => {
                                      let newMonth = prev.month - 1;
                                      let newYear = prev.year;
                                      if (newMonth < 0) {
                                        newMonth = 11;
                                        newYear -= 1;
                                      }
                                      return { month: newMonth, year: newYear };
                                    });
                                  }}
                                  className="p-1 rounded bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                                >
                                  &lt;
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPickerDate(prev => {
                                      let newMonth = prev.month + 1;
                                      let newYear = prev.year;
                                      if (newMonth > 11) {
                                        newMonth = 0;
                                        newYear += 1;
                                      }
                                      return { month: newMonth, year: newYear };
                                    });
                                  }}
                                  className="p-1 rounded bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                                >
                                  &gt;
                                </button>
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

                                for (let i = 0; i < firstDayIndex; i++) {
                                  cells.push(<div key={`empty-${i}`} />);
                                }

                                for (let day = 1; day <= daysInMonth; day++) {
                                  const dateStr = `${pickerDate.year}-${String(pickerDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                  const { hasLearnDriven, hasDecodeWorthy } = getScheduledTopicChannelsForDate(dateStr);
                                  const isSelected = newTopicDueDate === dateStr;

                                  cells.push(
                                    <button
                                      key={day}
                                      type="button"
                                      onClick={() => {
                                        setNewTopicDueDate(dateStr);
                                        setShowDatePicker(false);
                                      }}
                                      className={`p-1.5 rounded transition relative cursor-pointer ${
                                        isSelected 
                                          ? 'bg-rose-500 text-white font-bold' 
                                          : 'hover:bg-neutral-900 text-neutral-300'
                                      }`}
                                    >
                                      {day}
                                      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                                        {hasLearnDriven && (
                                          <span className="w-1 h-1 rounded-full bg-pink-500" />
                                        )}
                                        {hasDecodeWorthy && (
                                          <span className="w-1 h-1 rounded-full bg-blue-500" />
                                        )}
                                      </div>
                                    </button>
                                  );
                                }

                                return cells;
                              })()}
                            </div>

                            <div className="flex justify-between border-t border-neutral-900 mt-2.5 pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewTopicDueDate('');
                                  setShowDatePicker(false);
                                }}
                                className="text-neutral-500 hover:text-neutral-300 transition"
                              >
                                Clear
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const d = new Date();
                                  setNewTopicDueDate(d.toISOString().split('T')[0]);
                                  setShowDatePicker(false);
                                }}
                                className="text-blue-400 hover:text-blue-300 transition font-bold"
                              >
                                Today
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setNewTopicDueDate(todayDateKey)}
                        aria-pressed={newTopicDueDate === todayDateKey}
                        className={`px-2 py-0.5 border text-[8px] rounded transition cursor-pointer select-none ${newTopicDueDate === todayDateKey ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,.25)]' : 'border-neutral-900 bg-neutral-950 text-neutral-400 hover:border-neutral-800 hover:text-neutral-200'}`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTopicDueDate(tomorrowDateKey)}
                        aria-pressed={newTopicDueDate === tomorrowDateKey}
                        className={`px-2 py-0.5 border text-[8px] rounded transition cursor-pointer select-none ${newTopicDueDate === tomorrowDateKey ? 'border-violet-500 bg-violet-500/20 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,.25)]' : 'border-neutral-900 bg-neutral-950 text-neutral-400 hover:border-neutral-800 hover:text-neutral-200'}`}
                      >
                        Tomorrow
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block uppercase text-neutral-500">Sched Time</label>
                    <input
                      type="time"
                      value={newTopicSchedTime}
                      onChange={e => setNewTopicSchedTime(e.target.value)}
                      placeholder={newTopicChannel === 'LearnDriven' ? '21:09' : '19:07'}
                      className="w-full bg-neutral-950 border border-neutral-900 focus-within:border-neutral-800 outline-none text-[10px] rounded px-2 py-1.5 mt-1 text-white font-mono cursor-pointer select-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 text-[10px] pt-1.5 border-t border-neutral-900/60">
                  <button
                    type="button"
                    onClick={() => { setIsAddFormOpen(false); setEditingTopicId(null); }}
                    className="px-2.5 py-1 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded transition-colors cursor-pointer"
                  >
                    {editingTopicId ? 'Save Changes' : 'Save Topic'}
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
                {criticalTopics.length > 0 ? (
                  <button type="button" onClick={highlightCriticalTopics} className="group w-full p-3 bg-red-950/10 hover:bg-red-950/20 border border-red-900/40 hover:border-red-600/60 text-red-400 rounded-lg flex items-start gap-2 text-left shadow-[0_0_12px_rgba(239,68,68,0.02)] transition cursor-pointer" title="Show and highlight the affected topics">
                    <span className="relative flex h-2 w-2 mt-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <div className="space-y-0.5">
                      <span className="font-bold">CRITICAL FOCUS REQUIRED</span>
                      <p className="text-[9px] text-neutral-400 font-sans leading-normal">
                        You have {criticalTopics.length} topics due within 24 hours or overdue. Click to highlight them.
                      </p>
                    </div>
                    <span className="ml-auto text-red-700 transition group-hover:text-red-300">â†—</span>
                  </button>
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
                      {Math.round(((stats.edited + stats.scheduled) / (stats.total || 1)) * 100)}%
                    </span>
                    <div className="w-16 bg-neutral-950 rounded-full h-1 overflow-hidden mt-1">
                      <div 
                        className="bg-blue-400 h-1 rounded-full" 
                        style={{ width: `${Math.round(((stats.edited + stats.scheduled) / (stats.total || 1)) * 100)}%` }} 
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
                      <span className="text-purple-400">Topic Idea Pool</span>
                      <span className="text-neutral-300 font-bold">{stats.topicCount} ideas</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-blue-400">Scripting Load</span>
                      <span className="text-neutral-300 font-bold">{stats.scripted} tasks</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-amber-400">Shot & Filmed</span>
                      <span className="text-neutral-300 font-bold">{stats.shot} videos</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-fuchsia-400">To Be Edited</span>
                      <span className="text-neutral-300 font-bold">{stats.edited} videos</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px]">
                      <span className="text-emerald-400">Ready to Publish</span>
                      <span className="text-neutral-300 font-bold">{stats.scheduled} scheduled</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Activity Log (repurposed from Commit History) */}
          <div className="bg-neutral-900/70 border border-neutral-800/80 rounded-xl p-5 shadow-[0_10px_30px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.025)] hover:border-neutral-700/80 transition duration-300">
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
                        <span className="text-neutral-600"> - </span>
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

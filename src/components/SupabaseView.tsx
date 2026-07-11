import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clapperboard,
  Plus,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  BookmarkPlus,
  Trash2,
  Save,
  X,
  ChevronDown,
  Check,
  Gauge,
  RotateCcw,
  Pencil,
  Calendar
} from 'lucide-react';
import { SupabaseProject, SystemEvent, Topic, TopicActivity, CycleGoal, AiRulePreset, AiUsageStats, AiUsageCall } from '../types';
import { callOpenAI, getChannelSystemPrompt, findScriptSources, fetchRealAccountUsage, RealAccountUsage } from '../services/openai';
import { getTopicCurrentWorkflow, getTopicWorkflowState } from '../services/topicWorkflow';
import { useDismissOnOutsideClick } from '../hooks/useDismissOnOutsideClick';

// Splits AI source-search output on raw URLs and renders them as real
// clickable links that open in a new tab, while preserving line breaks.
function renderTextWithLinks(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)\]]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline break-all"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

interface SupabaseViewProps {
  supabase: SupabaseProject;
  onAddEvent: (evt: SystemEvent) => void;
  onUpdateSupabase: (updated: Partial<SupabaseProject>) => void;
  topics: Topic[];
  setTopics: React.Dispatch<React.SetStateAction<Topic[]>>;
  activities: TopicActivity[];
  setActivities: React.Dispatch<React.SetStateAction<TopicActivity[]>>;
  cycleGoals: CycleGoal | null;
  setCycleGoals: React.Dispatch<React.SetStateAction<CycleGoal | null>>;
  aiPresets: AiRulePreset[];
  setAiPresets: React.Dispatch<React.SetStateAction<AiRulePreset[]>>;
  aiUsage: AiUsageStats;
  setAiUsage: React.Dispatch<React.SetStateAction<AiUsageStats>>;
  onDeleteContentItem?: (itemId: string, label: string, topicName?: string) => void;
  onDeleteContentItems?: (items: Array<{ id: string; label: string; topicName?: string }>, label: string) => void;
  onDeleteActivity?: (activityId: string) => void;
  onDeletePreset?: (presetId: string) => void;
}

const TOPIC_REVENUE_OPTIONS = [
  { key: 'neutral', label: 'Neutral - Level 0.5', lanes: ['Shorts', 'Long', 'Members-Only'] },
  { key: 'productTag', label: 'Product tag', lanes: ['Shorts', 'Long'] },
  { key: 'viral', label: 'Viral potential', lanes: ['Shorts'] },
  { key: 'pinnedPromo', label: 'Pinned promotion', lanes: ['Shorts'] },
  { key: 'below8Min', label: 'Below 8 mins', lanes: ['Long'] },
  { key: 'exceed8Min', label: 'Exceeds 8 mins', lanes: ['Long'] },
  { key: 'strongReach', label: 'Strong reach potential', lanes: ['Long'] },
  { key: 'brandCollab', label: 'Brand collaboration', lanes: ['Long'] },
  { key: 'productLinks', label: 'Product links in description', lanes: ['Long'] },
  { key: 'membersOnly', label: 'Members-only subscription value', lanes: ['Members-Only'] }
] as const;

export default function SupabaseView({
  supabase,
  onAddEvent,
  onUpdateSupabase,
  topics,
  setTopics,
  activities,
  setActivities,
  cycleGoals,
  setCycleGoals,
  aiPresets,
  setAiPresets,
  aiUsage,
  setAiUsage,
  onDeletePreset
}: SupabaseViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'script' | 'goals'>('script');

  // Script Editor states
  const [selectedScriptTopicId, setSelectedScriptTopicId] = useState<string>(topics[0]?.id || '');
  const [isTopicFormOpen, setIsTopicFormOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');
  const [newTopicChannel, setNewTopicChannel] = useState<'LearnDriven' | 'DecodeWorthy' | null>(null);
  const [newTopicLane, setNewTopicLane] = useState<'Shorts' | 'Long' | 'Members-Only' | null>(null);
  const [newTopicStatus, setNewTopicStatus] = useState<Topic['status']>('topic');
  const [newTopicPriority, setNewTopicPriority] = useState<Topic['priority']>(1);
  const [newTopicScore, setNewTopicScore] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | undefined>(undefined);
  const [newTopicDueDate, setNewTopicDueDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear() };
  });

  useEffect(() => {
    if (!isTopicFormOpen) return;
    const now = new Date();
    setPickerDate({ month: now.getMonth(), year: now.getFullYear() });
    setShowDatePicker(false);
  }, [isTopicFormOpen]);

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
  const [topicEligibility, setTopicEligibility] = useState({
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
  const createScriptTopicHasInput = Boolean(
    newTopicName.trim() || newTopicDesc.trim() || newTopicChannel || newTopicLane ||
    newTopicDueDate || newTopicStatus !== 'topic' || newTopicPriority !== 1 || newTopicScore !== undefined ||
    Object.values(topicEligibility).some(Boolean)
  );
  const createScriptTopicFormRef = useDismissOnOutsideClick<HTMLFormElement>(
    isTopicFormOpen,
    !createScriptTopicHasInput,
    () => setIsTopicFormOpen(false)
  );
  const [scriptText, setScriptText] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('unicorn_video_scripts');
      if (stored && topics[0]?.id) {
        const parsed = JSON.parse(stored);
        return parsed[topics[0].id] || '';
      }
    } catch (e) {
      console.error(e);
    }
    return '';
  });

  // OpenAI requests are authenticated and handled by the server-side API route.
  const [customInstruction, setCustomInstruction] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetNameDraft, setPresetNameDraft] = useState('');
  const savePresetFormRef = useDismissOnOutsideClick<HTMLDivElement>(
    isSavingPreset,
    !presetNameDraft.trim(),
    () => setIsSavingPreset(false)
  );
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const [findSourcesMode, setFindSourcesMode] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<string>(aiUsage.budgetUSD !== null ? String(aiUsage.budgetUSD) : '');
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [realUsage, setRealUsage] = useState<RealAccountUsage | null>(null);
  const [isFetchingRealUsage, setIsFetchingRealUsage] = useState(false);
  const [realUsageError, setRealUsageError] = useState<string | null>(null);

  const loadRealUsage = React.useCallback(async () => {
    setIsFetchingRealUsage(true);
    setRealUsageError(null);
    try {
      const result = await fetchRealAccountUsage();
      setRealUsage(result);
    } catch (err: any) {
      setRealUsageError(err.message || 'Failed to fetch real account usage.');
    } finally {
      setIsFetchingRealUsage(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'script') loadRealUsage();
  }, [activeSubTab, loadRealUsage]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isSourcesLoading, setIsSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [sourcesResult, setSourcesResult] = useState<string | null>(null);

  // Content Cycle Goals form states
  const [goalCycleType, setGoalCycleType] = useState<'this-month' | 'next-month' | 'custom'>(
    cycleGoals?.cycleType || 'this-month'
  );
  const [goalCustomStart, setGoalCustomStart] = useState(cycleGoals?.startDate || '');
  const [goalCustomEnd, setGoalCustomEnd] = useState(cycleGoals?.endDate || '');
  
  const [ldShortsGoal, setLdShortsGoal] = useState<string>(
    cycleGoals?.learnDrivenShorts !== undefined && cycleGoals?.learnDrivenShorts !== null ? String(cycleGoals?.learnDrivenShorts) : ''
  );
  const [ldLongGoal, setLdLongGoal] = useState<string>(
    cycleGoals?.learnDrivenLong !== undefined && cycleGoals?.learnDrivenLong !== null ? String(cycleGoals?.learnDrivenLong) : ''
  );
  const [ldMembersGoal, setLdMembersGoal] = useState<string>(
    cycleGoals?.learnDrivenMembers !== undefined && cycleGoals?.learnDrivenMembers !== null ? String(cycleGoals?.learnDrivenMembers) : ''
  );
  const [dwShortsGoal, setDwShortsGoal] = useState<string>(
    cycleGoals?.decodeWorthyShorts !== undefined && cycleGoals?.decodeWorthyShorts !== null ? String(cycleGoals?.decodeWorthyShorts) : ''
  );

  const [saveNotification, setSaveNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isEditingGoals, setIsEditingGoals] = useState<boolean>(!cycleGoals);

  useEffect(() => {
    if (!cycleGoals) {
      setIsEditingGoals(true);
    }
  }, [cycleGoals]);

  const getTopicRevenueLevel = () => {
    const eligibility = topicEligibility;
    if (!Object.values(eligibility).some(Boolean)) return '';
    if (eligibility.neutral) return 'Lvl 0.5';

    if (newTopicLane === 'Shorts') {
      if (eligibility.viral) {
        if (eligibility.productTag && eligibility.pinnedPromo) return 'Lvl 4';
        if (eligibility.productTag) return 'Lvl 3';
        return 'Lvl 2';
      }
      return 'Lvl 1';
    }

    if (newTopicLane === 'Long') {
      if (eligibility.brandCollab) return 'Lvl 20';
      const hasProduct = eligibility.productTag || eligibility.productLinks;
      if (eligibility.strongReach) {
        if (eligibility.exceed8Min) return hasProduct ? 'Lvl 9.5' : 'Lvl 9';
        return hasProduct ? 'Lvl 8.5' : 'Lvl 8';
      }
      if (eligibility.exceed8Min) return hasProduct ? 'Lvl 7.5' : 'Lvl 7';
      return hasProduct ? 'Lvl 6.5' : 'Lvl 6';
    }

    return newTopicLane === 'Members-Only' && eligibility.membersOnly ? 'Lvl 5' : '';
  };

  const resetTopicForm = () => {
    setNewTopicName('');
    setNewTopicDesc('');
    setNewTopicChannel(null);
    setNewTopicLane(null);
    setNewTopicStatus('topic');
    setNewTopicPriority(1);
    setNewTopicScore(undefined);
    setNewTopicDueDate('');
    setTopicEligibility({
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
  };

  const scoreOption = (value: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10) => {
    const isActive = newTopicScore === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setNewTopicScore(isActive ? undefined : value)}
        aria-pressed={isActive}
        aria-label={isActive ? `Clear score (currently ${value})` : `Set score to ${value}`}
        title={isActive ? 'Tap to clear' : `Set to ${value}`}
        className={`relative flex h-5 w-5 cursor-pointer items-center justify-center rounded border text-[8px] font-bold transition ${
          isActive
            ? 'border-rose-400 bg-rose-500 text-white shadow-[0_0_8px_rgba(244,63,94,.25)]'
            : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-white'
        }`}
      >
        {value}
      </button>
    );
  };

  const handleCreateScriptTopic = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTopicName.trim() || !newTopicChannel || !newTopicLane) return;

    const now = new Date().toISOString();
    const revenueLevel = getTopicRevenueLevel();
    const topic: Topic = {
      id: `t-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: newTopicName.trim(),
      description: newTopicDesc.trim(),
      channel: newTopicChannel,
      status: newTopicStatus,
      priority: newTopicPriority,
      topicScore: newTopicScore,
      dueDate: newTopicDueDate ? new Date(newTopicDueDate).toISOString() : null,
      createdDate: now,
      lastUpdated: now,
      revenueLevel: revenueLevel || undefined,
      format: newTopicLane === 'Members-Only' ? 'Members' : newTopicLane === 'Shorts' ? 'Short' : 'Long',
      category: 'User Created'
    };

    setTopics(prev => [topic, ...prev]);
    setActivities(prev => [{
      id: `act-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      topicName: topic.name,
      channel: topic.channel,
      action: `Created new topic in ${topic.status} stage${revenueLevel ? ` with ${revenueLevel}` : ''}`,
      author: 'typeakshay',
      timestamp: now
    }, ...prev]);
    setSelectedScriptTopicId(topic.id);
    setScriptText('');
    setAiError(null);
    setIsTopicFormOpen(false);
    resetTopicForm();
    onAddEvent({
      id: `evt-topic-created-${Date.now()}`,
      source: 'github',
      type: 'success',
      message: `Script Editor: Added and selected topic "${topic.name}" under ${topic.channel}.`,
      timestamp: now
    });
  };

  const dateCalculation = useMemo(() => {
    const now = new Date();
    
    // This month
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const thisMonthStart = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-01`;
    const thisMonthEnd = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${new Date(curYear, curMonth + 1, 0).getDate()}`;
    const thisMonthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    // Next month
    let nextYear = curYear;
    let nextMonth = curMonth + 1;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    const nextMonthStart = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`;
    const nextMonthEnd = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${new Date(nextYear, nextMonth + 1, 0).getDate()}`;
    const nextDate = new Date(nextYear, nextMonth, 1);
    const nextMonthName = nextDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    return {
      thisMonthStart,
      thisMonthEnd,
      thisMonthName,
      nextMonthStart,
      nextMonthEnd,
      nextMonthName
    };
  }, []);

  const handleTriggerAI = async () => {
    if (!selectedScriptTopicId) return;
    const topic = topics.find(t => t.id === selectedScriptTopicId);
    if (!topic) return;

    setIsAiLoading(true);
    setAiError(null);

    const targetChannel = topic.channel;
    const topicName = topic.name;
    const topicDesc = topic.description;
    const instruction = customInstruction.trim();
    const hasDraft = scriptText.trim().length > 0;

    onAddEvent({
      id: `evt-ai-request-${Date.now()}`,
      source: 'system',
      type: 'info',
      message: `AI Core: Requesting AI completion from OpenAI for topic "${topicName}" on channel [${targetChannel}]`,
      timestamp: new Date().toISOString()
    });

    try {
      // The channel system prompt sets persona/style only. The actual task is
      // whatever the selected preset or typed instruction says, verbatim -
      // never a hardcoded "write an outline" / "enhance this draft" string
      // that would silently override what the user actually asked for.
      const systemPrompt = getChannelSystemPrompt(targetChannel);
      const task = instruction || (hasDraft
        ? 'Rewrite and improve this draft, optimizing the speech flow and pacing for spoken delivery.'
        : 'Write a structured script outline with standard video pacing segments.');

      const userPrompt = hasDraft
        ? `Topic Title: ${topicName}
Topic Description: ${topicDesc}
Current Draft:
"""
${scriptText}
"""
${task}`
        : `Topic Title: ${topicName}
Topic Description: ${topicDesc}
${task}`;

      const result = await callOpenAI(systemPrompt, userPrompt, recordAiUsage);
      handleUpdateScript(result);

      onAddEvent({
        id: `evt-ai-success-${Date.now()}`,
        source: 'system',
        type: 'success',
        message: `AI Core: Successfully received GPT completion. Updated draft for "${topicName}".`,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "An unexpected error occurred.";
      setAiError(errMsg);
      onAddEvent({
        id: `evt-ai-error-${Date.now()}`,
        source: 'system',
        type: 'error',
        message: `AI Core Error: ${errMsg}`,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  // Source-finding needs a live web search (a different API call than a plain
  // completion) to verify real URLs, so one button still has to pick between
  // the two actions. Keyword-sniffing the instruction text turned out
  // unreliable in practice (a preset's own wording can innocently contain a
  // trigger word like "link" or "source" and misfire) - routed by the
  // explicit findSourcesMode toggle instead.
  const handleGetResponse = async () => {
    if (!selectedScriptTopicId) return;
    if (findSourcesMode && scriptText.trim()) {
      await handleFindSources();
    } else {
      await handleTriggerAI();
    }
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    setIsPresetDropdownOpen(false);
    if (!presetId) return;
    const preset = aiPresets.find(p => p.id === presetId);
    if (preset) setCustomInstruction(preset.instruction);
  };

  const handleSaveNewPreset = () => {
    const name = presetNameDraft.trim();
    if (!name || !customInstruction.trim()) return;
    const newPreset: AiRulePreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      instruction: customInstruction.trim(),
      createdAt: new Date().toISOString()
    };
    setAiPresets(prev => [...prev, newPreset]);
    setSelectedPresetId(newPreset.id);
    setPresetNameDraft('');
    setIsSavingPreset(false);
  };

  const handleUpdateSelectedPreset = () => {
    if (!selectedPresetId || !customInstruction.trim()) return;
    setAiPresets(prev => prev.map(p => p.id === selectedPresetId ? { ...p, instruction: customInstruction.trim() } : p));
  };

  const handleDeleteSelectedPreset = () => {
    if (!selectedPresetId) return;
    const preset = aiPresets.find(p => p.id === selectedPresetId);
    if (!preset) return;
    onDeletePreset?.(selectedPresetId);
    setSelectedPresetId('');
  };

  // Every real OpenAI response includes actual token counts; this rolls that
  // real usage into a running total so spend tracking never depends on a
  // simulated or estimated number.
  const recordAiUsage = (call: AiUsageCall) => {
    setAiUsage(prev => ({
      ...prev,
      totalPromptTokens: prev.totalPromptTokens + call.promptTokens,
      totalCompletionTokens: prev.totalCompletionTokens + call.completionTokens,
      totalTokens: prev.totalTokens + call.totalTokens,
      totalCostUSD: prev.totalCostUSD + call.costUSD,
      callCount: prev.callCount + 1,
      lastCall: call
    }));
  };

  const handleSaveBudget = () => {
    const parsed = parseFloat(budgetDraft);
    setAiUsage(prev => ({ ...prev, budgetUSD: Number.isFinite(parsed) && parsed > 0 ? parsed : null }));
    setIsEditingBudget(false);
  };

  const handleResetUsageCycle = () => {
    if (!window.confirm('Reset accumulated usage stats for a new budget cycle? This does not affect your OpenAI account, only this dashboard\'s tracking.')) return;
    setAiUsage(prev => ({
      budgetUSD: prev.budgetUSD,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalCostUSD: 0,
      callCount: 0,
      lastCall: null,
      cycleStartedAt: new Date().toISOString()
    }));
  };

  // Finds real, verified sources for every claim in the current script draft.
  const handleFindSources = async () => {
    if (!scriptText.trim()) return;

    setIsSourcesLoading(true);
    setSourcesError(null);
    setSourcesResult(null);

    onAddEvent({
      id: `evt-sources-request-${Date.now()}`,
      source: 'system',
      type: 'info',
      message: 'AI Core: Searching the web for verified sources matching the current script draft.',
      timestamp: new Date().toISOString()
    });

    try {
      const result = await findScriptSources(scriptText, recordAiUsage);
      setSourcesResult(result);

      onAddEvent({
        id: `evt-sources-success-${Date.now()}`,
        source: 'system',
        type: 'success',
        message: 'AI Core: Source search complete.',
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "An unexpected error occurred.";
      setSourcesError(errMsg);
      onAddEvent({
        id: `evt-sources-error-${Date.now()}`,
        source: 'system',
        type: 'error',
        message: `AI Core Error: ${errMsg}`,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSourcesLoading(false);
    }
  };

  // Handler to load script for selected topic
  const handleSelectScriptTopic = (topicId: string) => {
    setSelectedScriptTopicId(topicId);
    try {
      const stored = localStorage.getItem('unicorn_video_scripts');
      if (stored) {
        const parsed = JSON.parse(stored);
        setScriptText(parsed[topicId] || '');
        return;
      }
    } catch (e) {
      console.error(e);
    }
    setScriptText('');
  };

  // Handler to update script
  const handleUpdateScript = (text: string) => {
    setScriptText(text);
    if (!selectedScriptTopicId) return;
    try {
      const stored = localStorage.getItem('unicorn_video_scripts');
      const parsed = stored ? JSON.parse(stored) : {};
      parsed[selectedScriptTopicId] = text;
      localStorage.setItem('unicorn_video_scripts', JSON.stringify(parsed));
    } catch (e) {
      console.error(e);
    }
  };

  // Biometrics logs - read-only snapshot of what the Score tab's sliders have written to localStorage
  const [biometricsLogs] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('unicorn_scorecard_db_logs');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  });


  return (
    <div className="space-y-6">
      {/* Top header - matches the AI Insights design language */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-xl border border-neutral-900 bg-neutral-950 shadow-[0_4px_30px_rgba(0,0,0,0.3)]"
      >
        <motion.div
          className="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-emerald-500/8 blur-3xl pointer-events-none"
          animate={{ x: [0, -20, 10, 0], y: [0, 15, -10, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-8 w-8 rounded-lg bg-emerald-950/30 border border-emerald-900/40 text-emerald-400">
              <Clapperboard className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-100 font-mono tracking-tight">Action Hub</h2>
              <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">Manage content tables, run queries on topics &amp; activities, and edit scripts.</p>
            </div>
          </div>

          <div className="flex gap-1.5 font-mono text-xs bg-neutral-950/50 p-1 border border-neutral-900 rounded-lg">
            <span className="px-2 py-0.5 text-neutral-400">Topics: {topics.length}</span>
            <span className="text-neutral-700">|</span>
            <span className="px-2 py-0.5 text-emerald-400 font-bold">Activities: {activities.length}</span>
          </div>
        </div>
      </motion.div>

      {/* Hardware Performance Grid - only metrics with a real backing source */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(() => {
          const totalTopics = topics.length;
          const scheduledTopics = topics.filter(t => getTopicWorkflowState(t, 'schedule') === 'completed').length;
          const inProgressTopics = topics.filter(t => getTopicCurrentWorkflow(t).state === 'in-progress').length;
          const pendingTopics = topics.filter(t => getTopicWorkflowState(t, 'script') === 'pending').length;
          const throughputPct = totalTopics > 0 ? Math.round((scheduledTopics / totalTopics) * 100) : 0;
          return (
            <>
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Total Topics</span>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-xl font-bold font-mono text-white">{totalTopics}</span>
                  <span className="text-[10px] text-neutral-500 font-mono">across channels</span>
                </div>
                <div className="w-full bg-neutral-900 rounded-full h-1 mt-2.5 overflow-hidden">
                  <div className="bg-emerald-500 h-1 rounded-full" style={{ width: totalTopics > 0 ? '100%' : '0%' }} />
                </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Completion Rate</span>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-xl font-bold font-mono text-white">{throughputPct}%</span>
                  <span className="text-[10px] text-emerald-400 font-mono">{throughputPct >= 50 ? 'On Track' : throughputPct > 0 ? 'In Progress' : 'No Data'}</span>
                </div>
                <div className="w-full bg-neutral-900 rounded-full h-1 mt-2.5 overflow-hidden">
                  <div className="bg-emerald-500 h-1 rounded-full" style={{ width: `${throughputPct}%` }} />
                </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4">
                <span className="text-[10px] uppercase font-semibold text-neutral-500 tracking-wider font-mono">Pending Actions</span>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <span className="text-xl font-bold font-mono text-white">{inProgressTopics + pendingTopics}</span>
                  <span className="text-[10px] text-neutral-500 font-mono">items in pipeline</span>
                </div>
                <div className="w-full bg-neutral-900 rounded-full h-1 mt-2.5 overflow-hidden">
                  <div className="bg-emerald-500 h-1 rounded-full" style={{ width: totalTopics > 0 ? `${Math.round(((inProgressTopics + pendingTopics) / totalTopics) * 100)}%` : '0%' }} />
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* Main Section */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
        {/* Sub Navigation Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/40">
          <button
            onClick={() => setActiveSubTab('script')}
            className={`px-4 py-3 text-xs font-mono font-semibold border-r border-neutral-800 flex items-center gap-1.5 transition ${
              activeSubTab === 'script' ? 'bg-neutral-950 text-emerald-400 border-b-2 border-b-emerald-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Script Editor</span>
          </button>

          <button 
            onClick={() => setActiveSubTab('goals')}
            className={`px-4 py-3 text-xs font-mono font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'goals' ? 'bg-neutral-950 text-emerald-400 border-b-2 border-b-emerald-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>🎯 Content Goals</span>
          </button>
        </div>

        {/* Sub Content area */}
        <div className="p-5 flex-1 flex flex-col">

          {/* Sub Tab: Script Editor */}
          {activeSubTab === 'script' && (
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-neutral-300">Video Script Workspace</h3>
                  <p className="text-[11px] text-neutral-500">Draft your script, measure pacing, and track estimated duration for publishing.</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-400">Target Topic:</span>
                  <select
                    value={selectedScriptTopicId}
                    disabled={isAiLoading}
                    onChange={(e) => handleSelectScriptTopic(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 font-mono rounded px-2.5 py-1.5 focus:border-emerald-800 outline-none"
                  >
                    <option value="">-- Select a Topic --</option>
                    {topics.map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.channel === 'LearnDriven' ? 'LD' : 'DW'}] {t.name.length > 35 ? t.name.substring(0, 35) + '...' : t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsTopicFormOpen(open => !open)}
                    disabled={isAiLoading}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-black font-mono font-bold text-[10px] rounded transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Topic
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isTopicFormOpen && (
                  <motion.form
                    ref={createScriptTopicFormRef}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleCreateScriptTopic}
                    className="overflow-hidden"
                  >
                    <div className="p-4 bg-neutral-900/50 border border-emerald-900/30 rounded-xl space-y-4 font-mono text-[10px]">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-emerald-400">Create Topic</h4>
                          <p className="text-[9px] text-neutral-500 mt-0.5">Uses the Topic Inventory fields and selects the new topic for scripting.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsTopicFormOpen(false)}
                          className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                          title="Close"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <label className="space-y-1">
                          <span className="uppercase text-neutral-500">Topic Title</span>
                          <input required value={newTopicName} onChange={event => setNewTopicName(event.target.value)} placeholder="e.g. How recommendation engines predict your next click" className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-800 outline-none text-xs rounded px-2.5 py-2 text-white" />
                        </label>
                        <label className="space-y-1">
                          <span className="uppercase text-neutral-500">Description</span>
                          <input value={newTopicDesc} onChange={event => setNewTopicDesc(event.target.value)} placeholder="Provide details of topic work..." className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-800 outline-none text-xs rounded px-2.5 py-2 text-white font-sans" />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div>
                          <span className="uppercase text-neutral-500">Creator Channel</span>
                          <div className="flex gap-2 mt-1">
                            {(['LearnDriven', 'DecodeWorthy'] as const).map(channel => (
                              <button
                                key={channel}
                                type="button"
                                onClick={() => {
                                  setNewTopicChannel(channel);
                                  setNewTopicLane(channel === 'DecodeWorthy' ? 'Shorts' : null);
                                }}
                                className={`flex-1 py-2 rounded border font-bold transition ${newTopicChannel === channel ? 'bg-rose-500 border-rose-400 text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                              >
                                {channel}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="uppercase text-neutral-500">Content Lane</span>
                          <div className="flex gap-2 mt-1">
                            {(newTopicChannel === 'DecodeWorthy' ? ['Shorts'] : ['Shorts', 'Long', 'Members-Only']).map(lane => (
                              <button
                                key={lane}
                                type="button"
                                disabled={!newTopicChannel}
                                onClick={() => setNewTopicLane(lane as typeof newTopicLane)}
                                className={`flex-1 py-2 rounded border font-bold text-[9px] transition disabled:opacity-30 ${newTopicLane === lane ? 'bg-blue-600 border-blue-500 text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'}`}
                              >
                                {lane}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <label className="space-y-1">
                          <span className="uppercase text-neutral-500">Production Stage</span>
                          <select value={newTopicStatus} onChange={event => setNewTopicStatus(event.target.value as Topic['status'])} className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-2 text-xs text-white">
                            <option value="topic">Topic</option><option value="scripted">Scripted</option><option value="shot">Shot</option><option value="edited">Edited</option><option value="scheduled">Scheduled</option>
                          </select>
                        </label>
                        <label className="space-y-1">
                          <span className="uppercase text-neutral-500">Priority</span>
                          <select value={newTopicPriority} onChange={event => setNewTopicPriority(Number(event.target.value) as Topic['priority'])} className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-2 text-xs text-white">
                            {[1, 2, 3, 4, 5].map(priority => <option key={priority} value={priority}>{priority}</option>)}
                          </select>
                        </label>
                        <fieldset className="space-y-1">
                          <legend className="uppercase text-neutral-500">Topic Score</legend>
                          <div className="grid w-fit grid-cols-10 gap-0.5" role="radiogroup" aria-label="Topic Score">
                            {([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map(scoreOption)}
                          </div>
                        </fieldset>
                        <div className="space-y-1">
                          <span className="uppercase text-neutral-500">Due Date</span>
                          <div className="relative">
                            <div
                              onClick={() => {
                                const now = new Date();
                                setPickerDate({ month: now.getMonth(), year: now.getFullYear() });
                                setShowDatePicker(prev => !prev);
                              }}
                              className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-2 text-xs text-white flex items-center justify-between cursor-pointer select-none"
                            >
                              <span className={newTopicDueDate ? 'text-white' : 'text-neutral-500'}>
                                {newTopicDueDate || 'dd - mm - yyyy'}
                              </span>
                              <Calendar className="h-3.5 w-3.5 text-neutral-500" />
                            </div>

                            {showDatePicker && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                                <div className="absolute right-0 mt-1.5 w-64 backdrop-blur-md bg-neutral-950/90 border border-neutral-800 rounded-xl p-3 shadow-2xl z-50 font-mono text-[9px] select-none">
                                  <div className="flex items-center justify-between mb-3 text-neutral-200">
                                    <span className="font-bold text-[10px] text-neutral-200">
                                      {(() => {
                                        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                                        return `${monthNames[pickerDate.month]} ${pickerDate.year}`;
                                      })()}
                                    </span>
                                    <div className="flex gap-1.5">
                                      <button type="button" onClick={() => setPickerDate(prev => { let m = prev.month - 1, y = prev.year; if (m < 0) { m = 11; y -= 1; } return { month: m, year: y }; })} className="p-1 rounded bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer">&lt;</button>
                                      <button type="button" onClick={() => setPickerDate(prev => { let m = prev.month + 1, y = prev.year; if (m > 11) { m = 0; y += 1; } return { month: m, year: y }; })} className="p-1 rounded bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer">&gt;</button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-neutral-500 mb-1">
                                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <span key={d}>{d}</span>)}
                                  </div>
                                  <div className="grid grid-cols-7 gap-1">
                                    {(() => {
                                      const daysInMonth = new Date(pickerDate.year, pickerDate.month + 1, 0).getDate();
                                      const firstDayIndex = new Date(pickerDate.year, pickerDate.month, 1).getDay();
                                      const cells = [];
                                      const todayStr = new Date().toISOString().split('T')[0];
                                      for (let i = 0; i < firstDayIndex; i++) cells.push(<div key={`empty-${i}`} />);
                                      for (let day = 1; day <= daysInMonth; day++) {
                                        const dateStr = `${pickerDate.year}-${String(pickerDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                        const { hasLearnDrivenShort, hasDecodeWorthyShort, hasLearnDrivenMembers, hasLearnDrivenLong } = getScheduledTopicChannelsForDate(dateStr);
                                        const isSelected = newTopicDueDate === dateStr;
                                        const isToday = dateStr === todayStr;
                                        cells.push(
                                          <button key={day} type="button" onClick={() => { setNewTopicDueDate(dateStr); setShowDatePicker(false); }}
                                            className={`p-1.5 rounded transition relative cursor-pointer ${isSelected ? 'bg-rose-500 text-white font-bold' : isToday ? 'ring-1 ring-neutral-400 text-white font-semibold hover:bg-neutral-900' : 'hover:bg-neutral-900 text-neutral-300'}`}
                                          >
                                            {day}
                                            <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-[2px]">
                                              {hasLearnDrivenShort && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#a855f7' }} title="LearnDriven Short" />}
                                              {hasDecodeWorthyShort && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#eab308' }} title="DecodeWorthy Short" />}
                                              {hasLearnDrivenMembers && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#22c55e' }} title="LearnDriven Members" />}
                                              {hasLearnDrivenLong && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: '#3b82f6' }} title="LearnDriven Long" />}
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
                                    <button type="button" onClick={() => { setNewTopicDueDate(''); setShowDatePicker(false); }} className="text-neutral-500 hover:text-neutral-300 transition">Clear</button>
                                    <button type="button" onClick={() => { const d = new Date(); setNewTopicDueDate(d.toISOString().split('T')[0]); setShowDatePicker(false); }} className="text-blue-400 hover:text-blue-300 transition font-bold">Today</button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="uppercase text-neutral-500">Auto Revenue Level</span>
                          <div className="h-[34px] bg-neutral-950/60 border border-neutral-800 rounded px-2.5 flex items-center text-xs font-bold text-emerald-400">{getTopicRevenueLevel() || '-'}</div>
                        </div>
                      </div>

                      {newTopicLane && (
                        <div className="pt-3 border-t border-neutral-800/70">
                          <span className="uppercase text-neutral-500">Revenue Streams</span>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2 font-sans text-[9px] text-neutral-400">
                            {TOPIC_REVENUE_OPTIONS.filter(option => (option.lanes as readonly string[]).includes(newTopicLane)).map(option => (
                              <label key={option.key} className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                                <input
                                  type="checkbox"
                                  checked={topicEligibility[option.key]}
                                  onChange={event => setTopicEligibility(previous => ({
                                    ...previous,
                                    [option.key]: event.target.checked,
                                    ...(option.key === 'below8Min' && event.target.checked ? { exceed8Min: false } : {}),
                                    ...(option.key === 'exceed8Min' && event.target.checked ? { below8Min: false } : {})
                                  }))}
                                />
                                {option.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800/70">
                        <button type="button" onClick={() => { setIsTopicFormOpen(false); resetTopicForm(); }} className="px-3 py-1.5 text-neutral-500 hover:text-white">Cancel</button>
                        <button type="submit" disabled={!newTopicName.trim() || !newTopicChannel || !newTopicLane} className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold rounded transition">Save & Select Topic</button>
                      </div>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* API Usage & Cost Tracker. "Real Account Spend" comes straight from
                  OpenAI's Costs API (requires an Admin API key) and reflects actual
                  billed spend for your whole account, month-to-date - not just calls
                  made through this app. The grid below it is this app's own tracker
                  (real token counts from each response x published per-token pricing),
                  useful when the Admin key isn't configured. */}
              <div className="bg-neutral-900/40 border border-neutral-850 rounded-xl p-3.5 space-y-3 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-semibold text-neutral-200">API Usage &amp; Cost</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetUsageCycle}
                    title="Start a new in-app tracking cycle (clears tracked spend, keeps your budget)"
                    className="px-2 py-1 bg-neutral-950 border border-neutral-800 hover:border-amber-800 text-neutral-500 hover:text-amber-400 rounded text-[9px] font-mono flex items-center gap-1 transition cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset In-App Tracker</span>
                  </button>
                </div>

                {/* Real Account Spend - fetched live from OpenAI */}
                <div className="border border-amber-900/30 bg-amber-950/10 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-amber-500">Real Account Spend (Month-to-date)</span>
                    <button
                      type="button"
                      onClick={loadRealUsage}
                      disabled={isFetchingRealUsage}
                      title="Refresh from OpenAI"
                      className="text-neutral-500 hover:text-amber-400 disabled:opacity-40 transition cursor-pointer"
                    >
                      {isFetchingRealUsage ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    </button>
                  </div>
                  {realUsageError ? (
                    <div className="text-[10px] text-rose-400 font-mono mt-1 leading-relaxed">{realUsageError}</div>
                  ) : realUsage ? (
                    <>
                      <div className="text-xl font-bold text-white font-mono mt-0.5">
                        ${Number(realUsage.totalCostUSD || 0).toFixed(4)} <span className="text-[10px] text-neutral-500 uppercase">{realUsage.currency}</span>
                      </div>
                      <div className="text-[9px] text-neutral-500 font-mono mt-0.5">
                        {new Date(realUsage.periodStart).toLocaleDateString([], { month: 'short', day: 'numeric' })} – {new Date(realUsage.periodEnd).toLocaleDateString([], { month: 'short', day: 'numeric' })} · fetched {new Date(realUsage.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-neutral-500 font-mono mt-1">{isFetchingRealUsage ? 'Fetching real spend from OpenAI…' : 'Not fetched yet.'}</div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="border border-neutral-900 rounded-lg p-2.5 bg-neutral-950/60">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500">In-App Est. Spend</span>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">${Number(aiUsage.totalCostUSD || 0).toFixed(4)}</div>
                  </div>

                  <div className="border border-neutral-900 rounded-lg p-2.5 bg-neutral-950/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500">Budget</span>
                      {!isEditingBudget && (
                        <button
                          type="button"
                          onClick={() => { setBudgetDraft(aiUsage.budgetUSD !== null ? String(aiUsage.budgetUSD) : ''); setIsEditingBudget(true); }}
                          className="text-neutral-600 hover:text-blue-400 transition cursor-pointer"
                          title="Set your own monthly budget"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                    {isEditingBudget ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          autoFocus
                          value={budgetDraft}
                          onChange={(e) => setBudgetDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveBudget(); if (e.key === 'Escape') setIsEditingBudget(false); }}
                          placeholder="USD"
                          className="w-14 bg-neutral-900 border border-neutral-800 rounded px-1 py-0.5 text-xs text-white font-mono outline-none"
                        />
                        <button type="button" onClick={handleSaveBudget} className="text-emerald-400 hover:text-emerald-300 transition cursor-pointer">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm font-bold text-white font-mono mt-0.5">
                        {aiUsage.budgetUSD !== null ? `$${Number(aiUsage.budgetUSD).toFixed(2)}` : '- Not set -'}
                      </div>
                    )}
                  </div>

                  <div className="border border-neutral-900 rounded-lg p-2.5 bg-neutral-950/60">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500">Remaining</span>
                    <div className={`text-sm font-bold font-mono mt-0.5 ${
                      aiUsage.budgetUSD === null ? 'text-neutral-500' : (Number(aiUsage.budgetUSD) - Number(aiUsage.totalCostUSD || 0)) < 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {aiUsage.budgetUSD !== null ? `$${(Number(aiUsage.budgetUSD) - Number(aiUsage.totalCostUSD || 0)).toFixed(4)}` : '- Set a budget -'}
                    </div>
                  </div>

                  <div className="border border-neutral-900 rounded-lg p-2.5 bg-neutral-950/60">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500">Tokens Used</span>
                    <div className="text-sm font-bold text-white font-mono mt-0.5">{Number(aiUsage.totalTokens || 0).toLocaleString()}</div>
                  </div>
                </div>

                {aiUsage.lastCall ? (
                  <div className="text-[10px] text-neutral-500 font-mono border-t border-neutral-900 pt-2">
                    Last call ({new Date(aiUsage.lastCall.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}):{' '}
                    <span className="text-neutral-300">{aiUsage.lastCall.model}</span>{' - '}
                    {Number(aiUsage.lastCall.promptTokens || 0).toLocaleString()} in / {Number(aiUsage.lastCall.completionTokens || 0).toLocaleString()} out{' '}
                    ({Number(aiUsage.lastCall.totalTokens || 0).toLocaleString()} tokens) · ${Number(aiUsage.lastCall.costUSD || 0).toFixed(5)} · {aiUsage.callCount} call{aiUsage.callCount === 1 ? '' : 's'} this cycle
                  </div>
                ) : (
                  <div className="text-[10px] text-neutral-600 font-mono border-t border-neutral-900 pt-2 italic">
                    No AI calls made yet this cycle - cost estimates use published per-token pricing since OpenAI doesn't return a dollar amount directly.
                  </div>
                )}
              </div>

              {/* Secure AI Toolbar Controls */}
              <div className="bg-neutral-900/40 border border-neutral-850 rounded-xl p-3 flex flex-col gap-2.5 relative z-10">
                  {/* Preset Selector Row */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="flex-1 relative">
                      <button
                        type="button"
                        disabled={isAiLoading}
                        onClick={() => setIsPresetDropdownOpen(open => !open)}
                        className="w-full flex items-center gap-2 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded px-2.5 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      >
                        <span className="text-[10px] text-neutral-500 font-mono uppercase shrink-0">Preset:</span>
                        <span className="flex-1 text-left text-xs text-neutral-200 font-mono truncate">
                          {selectedPresetId ? aiPresets.find(p => p.id === selectedPresetId)?.name : '- No preset (typed instruction) -'}
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 text-neutral-500 shrink-0 transition-transform ${isPresetDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isPresetDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsPresetDropdownOpen(false)} />
                          <div className="absolute left-0 right-0 mt-1.5 bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl z-50 py-1 max-h-64 overflow-y-auto">
                            <button
                              type="button"
                              onClick={() => handleSelectPreset('')}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-mono text-neutral-300 hover:bg-neutral-900 transition cursor-pointer"
                            >
                              <Check className={`h-3 w-3 shrink-0 ${!selectedPresetId ? 'opacity-100 text-emerald-400' : 'opacity-0'}`} />
                              <span>- No preset (typed instruction) -</span>
                            </button>
                            {aiPresets.length === 0 ? (
                              <div className="px-3 py-2 text-[10px] font-mono text-neutral-600 italic">No saved presets yet.</div>
                            ) : (
                              aiPresets.map(preset => (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={() => handleSelectPreset(preset.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-mono text-neutral-300 hover:bg-neutral-900 transition cursor-pointer"
                                >
                                  <Check className={`h-3 w-3 shrink-0 ${selectedPresetId === preset.id ? 'opacity-100 text-emerald-400' : 'opacity-0'}`} />
                                  <span className="truncate">{preset.name}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => { setIsSavingPreset(true); setPresetNameDraft(''); }}
                        disabled={isAiLoading || !customInstruction.trim()}
                        title="Save the current instruction as a new named preset"
                        className="px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 hover:border-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-300 hover:text-emerald-400 font-mono text-[10px] rounded transition cursor-pointer flex items-center gap-1"
                      >
                        <BookmarkPlus className="h-3 w-3" />
                        <span>Save New</span>
                      </button>
                      {selectedPresetId && (
                        <>
                          <button
                            type="button"
                            onClick={handleUpdateSelectedPreset}
                            disabled={isAiLoading || !customInstruction.trim()}
                            title="Overwrite this preset with the current instruction text"
                            className="px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 hover:border-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-300 hover:text-blue-400 font-mono text-[10px] rounded transition cursor-pointer flex items-center gap-1"
                          >
                            <Save className="h-3 w-3" />
                            <span>Update</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDeleteSelectedPreset}
                            title="Delete this preset"
                            className="p-1.5 bg-neutral-950 border border-neutral-800 hover:border-rose-800 text-neutral-500 hover:text-rose-400 rounded transition cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Inline "Save New Preset" name form */}
                  {isSavingPreset && (
                    <div ref={savePresetFormRef} className="flex items-center gap-2 bg-neutral-950 border border-emerald-900/40 rounded px-2.5 py-1.5">
                      <span className="text-[10px] text-emerald-500 font-mono uppercase shrink-0">Preset Name:</span>
                      <input
                        type="text"
                        autoFocus
                        value={presetNameDraft}
                        onChange={(e) => setPresetNameDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNewPreset(); if (e.key === 'Escape') setIsSavingPreset(false); }}
                        placeholder="e.g., 'Punchy Shorts Hook', 'Explainer with Analogies'"
                        className="flex-1 bg-transparent text-xs text-neutral-200 outline-none border-none placeholder-neutral-600 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleSaveNewPreset}
                        disabled={!presetNameDraft.trim()}
                        className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-mono font-bold text-[10px] rounded transition cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSavingPreset(false)}
                        className="p-1 text-neutral-500 hover:text-white transition cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row items-center gap-3">
                    {/* Custom AI Instructions Input Box */}
                    <div className="flex-1 w-full flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 focus-within:border-emerald-800 transition">
                      <span className="text-[10px] text-neutral-500 font-mono uppercase shrink-0">Custom AI Rule:</span>
                      <input
                        type="text"
                        value={customInstruction}
                        disabled={isAiLoading || !selectedScriptTopicId}
                        onChange={(e) => { setCustomInstruction(e.target.value); setSelectedPresetId(''); }}
                        placeholder={selectedScriptTopicId ? "e.g., 'Make it punchier', 'Explain details using train analogies', 'Keep it short'" : "Select a topic first to write AI rules"}
                        className="w-full bg-transparent text-xs text-neutral-200 outline-none border-none placeholder-neutral-600 font-mono"
                      />
                    </div>

                    {/* AI Quick Trigger - single action, mode picked explicitly by the toggle */}
                    <div className="flex items-center gap-3 shrink-0">
                      <label
                        title={!scriptText.trim() ? 'Write or paste a script first to find sources for it' : 'Verify real sources for the current script instead of generating/rewriting it'}
                        className={`flex items-center gap-1.5 text-[9px] font-mono uppercase select-none ${!scriptText.trim() ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer text-neutral-400 hover:text-neutral-200'}`}
                      >
                        <input
                          type="checkbox"
                          checked={findSourcesMode}
                          disabled={!scriptText.trim()}
                          onChange={(e) => setFindSourcesMode(e.target.checked)}
                          className="accent-blue-500 cursor-pointer"
                        />
                        Find Sources
                      </label>
                      <button
                        onClick={handleGetResponse}
                        disabled={isAiLoading || isSourcesLoading || !selectedScriptTopicId}
                        title={findSourcesMode ? 'Find real, verified sources for the current script' : 'Runs the preset or typed instruction above to generate/rewrite the script'}
                        className={`px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed font-mono font-bold text-[10px] rounded transition cursor-pointer flex items-center gap-1 ${
                          findSourcesMode ? 'bg-blue-500 hover:bg-blue-600 text-black' : 'bg-emerald-500 hover:bg-emerald-600 text-black'
                        }`}
                      >
                        {(isAiLoading || isSourcesLoading) ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        <span>Get Response</span>
                      </button>
                    </div>
                  </div>
                </div>

              {/* AI Processing and Error Display Banner */}
              {isAiLoading && (
                <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3 flex items-center gap-3 font-mono text-[10px] text-emerald-400 animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span>AI Core is compiling data model and calling OpenAI (gpt-4o-mini)... Please wait.</span>
                </div>
              )}

              {aiError && (
                <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-3 flex items-center gap-3 font-mono text-[10px] text-rose-400">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                  <span className="truncate">AI Request Error: {aiError}</span>
                </div>
              )}

              {isSourcesLoading && (
                <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl p-3 flex items-center gap-3 font-mono text-[10px] text-blue-400 animate-pulse">
                  <div className="h-2 w-2 rounded-full bg-blue-400 animate-ping shrink-0" />
                  <span>Searching the live web for verified sources and checking every claim. This can take up to a minute...</span>
                </div>
              )}

              {sourcesError && (
                <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-3 flex items-center gap-3 font-mono text-[10px] text-rose-400">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                  <span className="truncate">Source Search Error: {sourcesError}</span>
                </div>
              )}

              {/* Editor Workspace Layout */}
              <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-[350px]">
                {/* Textarea Editor Area */}
                <div className="flex-1 flex flex-col space-y-2">
                  <textarea
                    value={scriptText}
                    disabled={!selectedScriptTopicId || isAiLoading}
                    onChange={(e) => handleUpdateScript(e.target.value)}
                    placeholder={selectedScriptTopicId ? "Start writing your video script here... Speaking pace is calculated at 150 words per minute." : "Please select a target topic from the dropdown to start scripting."}
                    className="w-full flex-1 min-h-[250px] bg-neutral-950 border border-neutral-800 focus:border-emerald-800 outline-none rounded-lg p-4 font-sans text-xs text-neutral-300 leading-relaxed resize-none disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  
                  {selectedScriptTopicId && (
                    <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500">
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>Auto-saved to topic local storage</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={isAiLoading}
                          onClick={() => {
                            navigator.clipboard.writeText(scriptText);
                            onAddEvent({
                              id: `evt-script-copy-${Date.now()}`,
                              source: 'system',
                              type: 'success',
                              message: 'Script Editor: Copied script contents to system clipboard.',
                              timestamp: new Date().toISOString()
                            });
                          }}
                          className="px-2 py-1 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded transition cursor-pointer disabled:opacity-40"
                        >
                          Copy Script
                        </button>
                        <button
                          type="button"
                          disabled={isAiLoading}
                          onClick={() => {
                            if (window.confirm("Are you sure you want to clear the script for this topic?")) {
                              handleUpdateScript('');
                            }
                          }}
                          className="px-2 py-1 bg-neutral-900 border border-neutral-800 hover:border-rose-900/60 hover:text-rose-400 text-neutral-400 rounded transition cursor-pointer disabled:opacity-40"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Analytics Sidebar Card */}
                <div className="lg:w-[280px] bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex flex-col justify-between font-mono text-[10px] text-neutral-400 space-y-4">
                  <div className="space-y-4">
                    <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Script Analytics</span>
                    
                    {/* Est. Duration Stat Card */}
                    <div className="p-3 bg-neutral-900/40 border border-neutral-850 rounded-lg space-y-1">
                      <span className="text-neutral-500 uppercase text-[9px]">Estimated Duration</span>
                      {(() => {
                        const words = scriptText.trim() === "" ? 0 : scriptText.trim().split(/\s+/).length;
                        const totalSecs = Math.round((words / 150) * 60);
                        const mins = Math.floor(totalSecs / 60);
                        const secs = totalSecs % 60;
                        return (
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold text-emerald-400">
                              {mins}m {secs}s
                            </span>
                            <span className="text-neutral-600">@ 150 WPM</span>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Word / Char Counter Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-neutral-900/20 border border-neutral-850 rounded-lg">
                        <span className="text-neutral-500 block mb-0.5 text-[8px] uppercase">Word Count</span>
                        <span className="text-lg font-bold text-white">
                          {scriptText.trim() === "" ? 0 : scriptText.trim().split(/\s+/).length}
                        </span>
                      </div>
                      <div className="p-3 bg-neutral-900/20 border border-neutral-850 rounded-lg">
                        <span className="text-neutral-500 block mb-0.5 text-[8px] uppercase">Characters</span>
                        <span className="text-lg font-bold text-white">
                          {scriptText.length}
                        </span>
                      </div>
                    </div>

                    {/* Classification details */}
                    <div className="p-3 bg-neutral-900/10 border border-neutral-900 rounded-lg space-y-2 text-[9px]">
                      <div className="flex justify-between border-b border-neutral-850 pb-1.5">
                        <span className="text-neutral-500">Video Format</span>
                        {(() => {
                          const words = scriptText.trim() === "" ? 0 : scriptText.trim().split(/\s+/).length;
                          const totalSecs = Math.round((words / 150) * 60);
                          if (totalSecs === 0) return <span className="text-neutral-600">No Content</span>;
                          if (totalSecs < 60) return <span className="text-blue-400 font-bold">Shorts (&lt; 60s)</span>;
                          if (totalSecs >= 480) return <span className="text-purple-400 font-bold">Longform (8m+)</span>;
                          return <span className="text-amber-400 font-bold">Standard Video</span>;
                        })()}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Ad Placement</span>
                        {(() => {
                          const words = scriptText.trim() === "" ? 0 : scriptText.trim().split(/\s+/).length;
                          const totalSecs = Math.round((words / 150) * 60);
                          if (totalSecs >= 480) return <span className="text-emerald-400">Mid-roll Eligible</span>;
                          return <span className="text-neutral-500">Preroll / Postroll Only</span>;
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-900 text-[8px] text-neutral-600 leading-normal">
                    Tip: speaking speed defaults to standard conversational rate. Classifications adapt dynamically based on your content guidelines.
                  </div>
                </div>
              </div>

              {/* Source Search Results */}
              {sourcesResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-neutral-950 border border-blue-900/40 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-blue-400" />
                      <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider font-mono">Verified Sources</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(sourcesResult);
                          onAddEvent({
                            id: `evt-sources-copy-${Date.now()}`,
                            source: 'system',
                            type: 'success',
                            message: 'Sources Panel: Copied source search results to clipboard.',
                            timestamp: new Date().toISOString()
                          });
                        }}
                        className="px-2 py-1 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded transition cursor-pointer text-[10px] font-mono"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourcesResult(null)}
                        className="px-2 py-1 bg-neutral-900 border border-neutral-800 hover:border-rose-900/60 hover:text-rose-400 text-neutral-400 rounded transition cursor-pointer text-[10px] font-mono"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-xs text-neutral-300 leading-relaxed font-sans max-h-[500px] overflow-y-auto pr-1">
                    {renderTextWithLinks(sourcesResult)}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Sub Tab: Content Cycle Goals */}
          {activeSubTab === 'goals' && (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                
                let start = '';
                let end = '';
                let name = '';

                if (goalCycleType === 'this-month') {
                  start = dateCalculation.thisMonthStart;
                  end = dateCalculation.thisMonthEnd;
                  name = dateCalculation.thisMonthName;
                } else if (goalCycleType === 'next-month') {
                  start = dateCalculation.nextMonthStart;
                  end = dateCalculation.nextMonthEnd;
                  name = dateCalculation.nextMonthName;
                } else {
                  if (!goalCustomStart || !goalCustomEnd) {
                    setSaveNotification({ message: "Please select start & end dates.", type: 'warning' });
                    setTimeout(() => setSaveNotification(null), 3000);
                    return;
                  }
                  start = goalCustomStart;
                  end = goalCustomEnd;
                  name = `Custom (${new Date(goalCustomStart).toLocaleDateString()} - ${new Date(goalCustomEnd).toLocaleDateString()})`;
                }

                const newGoals: CycleGoal = {
                  cycleType: goalCycleType,
                  monthName: name,
                  startDate: start,
                  endDate: end,
                  learnDrivenShorts: ldShortsGoal ? Number(ldShortsGoal) : null,
                  learnDrivenLong: ldLongGoal ? Number(ldLongGoal) : null,
                  learnDrivenMembers: ldMembersGoal ? Number(ldMembersGoal) : null,
                  decodeWorthyShorts: dwShortsGoal ? Number(dwShortsGoal) : null
                };

                setCycleGoals(newGoals);
                setIsEditingGoals(false);
                
                onAddEvent({
                  id: `evt-goals-updated-${Date.now()}`,
                  source: 'system',
                  type: 'success',
                  message: `Goals Engine: Configured content targets for cycle "${name}" [${start} to ${end}].`,
                  timestamp: new Date().toISOString()
                });

                setSaveNotification({ message: "🎯 Content Cycle Goals configured successfully!", type: 'success' });
                setTimeout(() => setSaveNotification(null), 3000);
              }}
              className="space-y-5 flex-1 flex flex-col font-mono text-[10px]"
            >
              <div>
                <h3 className="text-xs font-semibold text-neutral-300">🎯 Content Cycle Target Goals</h3>
                <p className="text-[11px] text-neutral-500 font-sans mt-0.5">Specify video frequency targets for each channel. Unconfigured streams default to "Free Flow" mode.</p>
              </div>

              {saveNotification && (
                <div className={`p-2.5 rounded-lg border text-[10px] flex items-center gap-2 animate-bounce transition-all ${
                  saveNotification.type === 'success' ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-400' :
                  saveNotification.type === 'warning' ? 'bg-rose-950/40 border-rose-900/50 text-rose-400' :
                  'bg-neutral-900 border-neutral-800 text-neutral-300'
                }`}>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  <span>{saveNotification.message}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Duration Column */}
                <div className="bg-neutral-950 border border-neutral-900 rounded-lg p-4 space-y-4">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block border-b border-neutral-900 pb-1.5">1. Content Cycle</span>
                  
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                      <input 
                        type="radio" 
                        name="cycleType" 
                        value="this-month"
                        checked={goalCycleType === 'this-month'}
                        onChange={() => setGoalCycleType('this-month')}
                        disabled={!isEditingGoals}
                        className="accent-emerald-500"
                      />
                      <span>This Month ({dateCalculation.thisMonthName})</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                      <input 
                        type="radio" 
                        name="cycleType" 
                        value="next-month"
                        checked={goalCycleType === 'next-month'}
                        onChange={() => setGoalCycleType('next-month')}
                        disabled={!isEditingGoals}
                        className="accent-emerald-500"
                      />
                      <span>Next Month ({dateCalculation.nextMonthName})</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-neutral-300">
                      <input 
                        type="radio" 
                        name="cycleType" 
                        value="custom"
                        checked={goalCycleType === 'custom'}
                        onChange={() => setGoalCycleType('custom')}
                        disabled={!isEditingGoals}
                        className="accent-emerald-500"
                      />
                      <span>Custom Range</span>
                    </label>
                  </div>

                  {goalCycleType === 'custom' && (
                    <div className="space-y-2 mt-2 pt-2 border-t border-neutral-900 animate-fadeIn">
                      <div>
                        <label className="block text-neutral-500 mb-0.5">Start Date</label>
                        <input 
                          type="date"
                          value={goalCustomStart}
                          onChange={(e) => setGoalCustomStart(e.target.value)}
                          disabled={!isEditingGoals}
                          className="w-full bg-neutral-900 border border-neutral-850 rounded px-2 py-1 text-white outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-neutral-500 mb-0.5">End Date</label>
                        <input 
                          type="date"
                          value={goalCustomEnd}
                          onChange={(e) => setGoalCustomEnd(e.target.value)}
                          disabled={!isEditingGoals}
                          className="w-full bg-neutral-900 border border-neutral-850 rounded px-2 py-1 text-white outline-none font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* LearnDriven Column */}
                <div className="bg-neutral-950 border border-neutral-900 rounded-lg p-4 space-y-4">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block border-b border-neutral-900 pb-1.5">2. LearnDriven Targets</span>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-neutral-500 mb-1">Shorts Goal (Leave empty for Free Flow)</label>
                      {isEditingGoals ? (
                        <input 
                          type="number" 
                          min="0"
                          placeholder="e.g. 5"
                          value={ldShortsGoal}
                          onChange={(e) => setLdShortsGoal(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-850 rounded px-2 py-1.5 text-white outline-none"
                        />
                      ) : (
                        <input 
                          type="text" 
                          readOnly
                          value={ldShortsGoal || 'Free Flow'}
                          className="w-full bg-neutral-900/40 border border-neutral-850/50 text-neutral-400 rounded px-2 py-1.5 outline-none font-semibold cursor-default"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-neutral-500 mb-1">Long-form Goal (Leave empty for Free Flow)</label>
                      {isEditingGoals ? (
                        <input 
                          type="number" 
                          min="0"
                          placeholder="e.g. 3"
                          value={ldLongGoal}
                          onChange={(e) => setLdLongGoal(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-850 rounded px-2 py-1.5 text-white outline-none"
                        />
                      ) : (
                        <input 
                          type="text" 
                          readOnly
                          value={ldLongGoal || 'Free Flow'}
                          className="w-full bg-neutral-900/40 border border-neutral-850/50 text-neutral-400 rounded px-2 py-1.5 outline-none font-semibold cursor-default"
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-neutral-500 mb-1">Members-Only Goal (Leave empty for Free Flow)</label>
                      {isEditingGoals ? (
                        <input 
                          type="number" 
                          min="0"
                          placeholder="e.g. 2"
                          value={ldMembersGoal}
                          onChange={(e) => setLdMembersGoal(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-850 rounded px-2 py-1.5 text-white outline-none"
                        />
                      ) : (
                        <input 
                          type="text" 
                          readOnly
                          value={ldMembersGoal || 'Free Flow'}
                          className="w-full bg-neutral-900/40 border border-neutral-850/50 text-neutral-400 rounded px-2 py-1.5 outline-none font-semibold cursor-default"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* DecodeWorthy Column */}
                <div className="bg-neutral-950 border border-neutral-900 rounded-lg p-4 space-y-4">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block border-b border-neutral-900 pb-1.5">3. DecodeWorthy Targets</span>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-neutral-500 mb-1">Shorts Goal (Leave empty for Free Flow)</label>
                      {isEditingGoals ? (
                        <input 
                          type="number" 
                          min="0"
                          placeholder="e.g. 10"
                          value={dwShortsGoal}
                          onChange={(e) => setDwShortsGoal(e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-850 rounded px-2 py-1.5 text-white outline-none"
                        />
                      ) : (
                        <input 
                          type="text" 
                          readOnly
                          value={dwShortsGoal || 'Free Flow'}
                          className="w-full bg-neutral-900/40 border border-neutral-850/50 text-neutral-400 rounded px-2 py-1.5 outline-none font-semibold cursor-default"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end border-t border-neutral-900 pt-4">
                {isEditingGoals ? (
                  <>
                    {cycleGoals && (
                      <button
                        type="button"
                        onClick={() => {
                          setCycleGoals(null);
                          setLdShortsGoal('');
                          setLdLongGoal('');
                          setLdMembersGoal('');
                          setDwShortsGoal('');
                          onAddEvent({
                            id: `evt-goals-purged-${Date.now()}`,
                            source: 'system',
                            type: 'warning',
                            message: 'Goals Engine: Active goals purged. All content lanes reverted to Free Flow.',
                            timestamp: new Date().toISOString()
                          });
                          setSaveNotification({ message: "⚠️ Cycle goals purged successfully.", type: 'warning' });
                          setTimeout(() => setSaveNotification(null), 3000);
                        }}
                        className="px-3.5 py-2 bg-neutral-900 hover:bg-rose-950/20 text-neutral-400 hover:text-rose-400 border border-neutral-800 hover:border-rose-900/40 rounded transition cursor-pointer"
                      >
                        Clear Goals
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded transition cursor-pointer"
                    >
                      Save Goals Target
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingGoals(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition cursor-pointer"
                  >
                    Edit Goals
                  </button>
                )}
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

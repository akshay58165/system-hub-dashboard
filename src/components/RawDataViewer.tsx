import React, { useState } from 'react';
import { VideoItem, MonthlyGoals, RevenueLevelConfig, ProductOpportunity, VideoStage, VideoPipeline, VideoRevenueEligibility, VideoStatus } from '../types';
import { 
  Database, ChevronDown, ChevronUp, Table, Edit, Check, Settings, Sparkles, 
  Trash, Tag, Plus, MessageSquare, DollarSign, Award, CheckCircle2,
  AlertOctagon, AlertTriangle, AlertCircle, X, ShieldAlert, RefreshCw, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TactileLED from './TactileLED';
import { calculateRevenueLevel, EMPTY_REVENUE_ELIGIBILITY, getLocalDateString, getVideoStatus, inferRevenueEligibility, statusNeedsAttention } from '../videoLogic';

function generatePipeline(stage: VideoStage, lane: string, isBlocked: boolean): VideoPipeline {
  const isShortOrMembers = lane === 'LearnDriven Shorts' || lane === 'DecodeWorthy Shorts';
  
  const stagesList: VideoStage[] = isShortOrMembers
    ? ['Topic', 'Script', 'Shoot', 'Edit', 'Schedule', 'Done']
    : ['Topic', 'Script', 'Shoot', 'Edit', 'Thumbnail', 'Schedule', 'Done'];

  const stageMap: Record<string, keyof VideoPipeline> = {
    'Topic': 'topic',
    'Script': 'script',
    'Shoot': 'shoot',
    'Edit': 'edit',
    'Thumbnail': 'thumbnail',
    'Schedule': 'schedule',
  };

  const pipeline: any = {};
  const currentIndex = stagesList.indexOf(stage);

  stagesList.forEach((st, idx) => {
    if (st === 'Done') return;
    const key = stageMap[st];
    if (!key) return;

    if (idx < currentIndex) {
      pipeline[key] = 'Done';
    } else if (idx === currentIndex) {
      if (isBlocked) {
        pipeline[key] = 'Blocked';
      } else {
        pipeline[key] = 'In progress';
      }
    } else {
      pipeline[key] = 'Not started';
    }
  });

  return pipeline as VideoPipeline;
}

function getStatusMeta(status: VideoStatus) {
  const metadata = {
    neutral: { label: 'Neutral', color: 'white', text: 'text-zinc-300' },
    good: { label: 'Good', color: 'emerald', text: 'text-emerald-400' },
    attention: { label: 'Attention', color: 'yellow', text: 'text-yellow-400' },
    warning: { label: 'Warning', color: 'orange', text: 'text-orange-400' },
    critical: { label: 'Critical', color: 'red', text: 'text-rose-400' },
  } as const;
  return metadata[status];
}

interface RawDataViewerProps {
  goals: MonthlyGoals;
  videos: VideoItem[];
  revenueLevels: RevenueLevelConfig[];
  productOpportunities: ProductOpportunity[];
  onUpdateVideo: (video: VideoItem) => void;
  onUpdateProductOpportunity: (opp: ProductOpportunity) => void;
  onAddVideo?: (newVid: Omit<VideoItem, 'id' | 'completionPercentage'>) => void;
  onDeleteVideo?: (id: string) => void;
  onAddProductOpportunity?: (opp: Omit<ProductOpportunity, 'id'>) => void;
  onDeleteProductOpportunity?: (id: string) => void;
}

export default function RawDataViewer({
  goals,
  videos,
  revenueLevels,
  productOpportunities,
  onUpdateVideo,
  onUpdateProductOpportunity,
  onAddVideo,
  onDeleteVideo,
  onAddProductOpportunity,
  onDeleteProductOpportunity
}: RawDataViewerProps) {
  const [activeSection, setActiveSection] = useState<string | null>('inventory');
  
  // Modal configuration states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);

  // Product Opportunity states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<ProductOpportunity | null>(null);

  // Product Form states
  const [formOppTopic, setFormOppTopic] = useState('');
  const [formOppChannel, setFormOppChannel] = useState<'LearnDriven' | 'DecodeWorthy'>('LearnDriven');
  const [formOppCategory, setFormOppCategory] = useState('');
  const [formOppRelevance, setFormOppRelevance] = useState(8);
  const [formOppUpgrade, setFormOppUpgrade] = useState('Level 8 to Level 8.5');
  const [formOppRisk, setFormOppRisk] = useState<'Low' | 'Medium' | 'High'>('Low');
  const [formOppTag, setFormOppTag] = useState('');
  const [formOppStatus, setFormOppStatus] = useState<'Pending' | 'Added' | 'Ignored'>('Pending');

  const handleOpenEditOpp = (opp: ProductOpportunity) => {
    setEditingOpp(opp);
    setFormOppTopic(opp.topic);
    setFormOppChannel(opp.channel);
    setFormOppCategory(opp.productCategory);
    setFormOppRelevance(opp.relevanceScore);
    setFormOppUpgrade(opp.revenueUpgrade);
    setFormOppRisk(opp.forcedRisk);
    setFormOppTag(opp.suggestedTag);
    setFormOppStatus(opp.status);
    setIsProductModalOpen(true);
  };

  const handleOpenAddOpp = () => {
    setEditingOpp(null);
    setFormOppTopic('');
    setFormOppChannel('LearnDriven');
    setFormOppCategory('');
    setFormOppRelevance(8);
    setFormOppUpgrade('Level 2 to Level 3');
    setFormOppRisk('Low');
    setFormOppTag('');
    setFormOppStatus('Pending');
    setIsProductModalOpen(true);
  };

  const handleSaveOppForm = () => {
    const data: Omit<ProductOpportunity, 'id'> = {
      topic: formOppTopic || 'Untitled Topic',
      channel: formOppChannel,
      productCategory: formOppCategory || 'General Accessories',
      relevanceScore: Number(formOppRelevance) || 5,
      revenueUpgrade: formOppUpgrade || 'Level 2 to Level 3',
      forcedRisk: formOppRisk,
      suggestedTag: formOppTag || 'General Suggested Tag',
      status: formOppStatus,
    };

    if (editingOpp) {
      onUpdateProductOpportunity({
        ...editingOpp,
        ...data,
      });
    } else {
      if (onAddProductOpportunity) {
        onAddProductOpportunity(data);
      }
    }
    setIsProductModalOpen(false);
  };

  const handleDeleteOpp = (id: string) => {
    if (confirm('Are you absolutely sure you want to delete this product opportunity?')) {
      if (onDeleteProductOpportunity) {
        onDeleteProductOpportunity(id);
      }
    }
  };

  // Video Form states
  const [formChannel, setFormChannel] = useState<'LearnDriven' | 'DecodeWorthy'>('LearnDriven');
  const [formContentLane, setFormContentLane] = useState<VideoItem['contentLane']>('LearnDriven Long Videos');
  const [formTitle, setFormTitle] = useState('');
  const [formTitleError, setFormTitleError] = useState('');
  const [formEligibility, setFormEligibility] = useState<VideoRevenueEligibility>({ ...EMPTY_REVENUE_ELIGIBILITY });
  const [formCurrentStage, setFormCurrentStage] = useState<VideoStage>('Topic');
  const [formStatus, setFormStatus] = useState<VideoStatus>('neutral');
  const [formExpectedPublishDate, setFormExpectedPublishDate] = useState('2026-06-30');

  const toggleSection = (sec: string) => {
    setActiveSection(prev => prev === sec ? null : sec);
  };

  const toggleOpportunityStatus = (opp: ProductOpportunity, status: ProductOpportunity['status']) => {
    onUpdateProductOpportunity({
      ...opp,
      status
    });
  };

  // Trigger modal for Edit Record
  const handleOpenEdit = (v: VideoItem) => {
    setEditingVideo(v);
    setFormChannel(v.channel);
    setFormContentLane(v.contentLane);
    setFormTitle(v.title);
    setFormTitleError('');
    setFormEligibility(inferRevenueEligibility(v));
    setFormCurrentStage(v.currentStage);
    setFormStatus(getVideoStatus(v));
    setFormExpectedPublishDate(v.expectedPublishDate || '');
    setIsModalOpen(true);
  };

  // Trigger modal for Add Record
  const handleOpenAdd = () => {
    setEditingVideo(null);
    setFormChannel('LearnDriven');
    setFormContentLane('LearnDriven Long Videos');
    setFormTitle('');
    setFormTitleError('');
    setFormEligibility({ ...EMPTY_REVENUE_ELIGIBILITY });
    setFormCurrentStage('Topic');
    setFormStatus('neutral');
    setFormExpectedPublishDate('2026-06-30');
    setIsModalOpen(true);
  };

  // Safe helper to sync channel and lanes in modal dropdowns
  const handleChannelChange = (channel: 'LearnDriven' | 'DecodeWorthy') => {
    setFormChannel(channel);
    if (channel === 'LearnDriven') {
      setFormContentLane('LearnDriven Long Videos');
    } else {
      setFormContentLane('DecodeWorthy Shorts');
      setFormEligibility(prev => ({ ...prev, overEightMinutes: false }));
    }
  };

  // Commit Form Changes (Create or Edit)
  const handleSaveForm = () => {
    const cleanTitle = formTitle.trim();
    if (!cleanTitle) {
      setFormTitleError('A real topic title is required.');
      return;
    }
    const needsAttention = statusNeedsAttention(formStatus);
    const pipeline = generatePipeline(formCurrentStage, formContentLane, needsAttention);
    const revenueLevelTarget = calculateRevenueLevel(formContentLane, formEligibility);
    const derivedStatusNote = formStatus === 'neutral' || formStatus === 'good' ? '' : `${formCurrentStage} stage marked ${formStatus}`;

    const data: Omit<VideoItem, 'id'> = {
      channel: formChannel,
      contentLane: formContentLane,
      title: cleanTitle,
      createdAt: editingVideo?.createdAt || getLocalDateString(),
      revenueLevelTarget,
      revenueEligibility: formEligibility,
      expectedPublishDate: editingVideo ? formExpectedPublishDate : undefined,
      pipeline,
      currentStage: formCurrentStage,
      status: formStatus,
      statusNote: derivedStatusNote,
      isBlocked: needsAttention,
      blockerReason: needsAttention ? derivedStatusNote : undefined,
      blockerSeverity: needsAttention ? formStatus : undefined,
      productTagStatus: formEligibility.productTag ? 'Tagged' : 'Unsuitable',
      pinnedCommentStatus: formEligibility.pinnedComment ? 'Added' : 'None',
      membersPromotionStatus: formEligibility.pinnedComment ? 'Promoted' : 'None',
      brandCollabStatus: formEligibility.brandCollaboration ? 'Attached' : 'None',
    };

    if (editingVideo) {
      // Update existing video instance
      onUpdateVideo({
        ...editingVideo,
        ...data,
      });
    } else {
      // Create new video instance
      if (onAddVideo) {
        onAddVideo(data);
      }
    }
    setIsModalOpen(false);
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm('Delete this video record? It will also disappear from the production board and dashboard.')) {
      if (onDeleteVideo) {
        onDeleteVideo(id);
      }
    }
  };

  return (
    <div id="inventory-records" className="space-y-3 bg-zinc-950 border border-zinc-900 rounded-lg p-4 font-mono text-xs scroll-mt-24">
      
      {/* Title with metadata description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-900 pb-3 mb-2">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-emerald-400 animate-pulse" />
          <div>
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              DETAILED RECORDS
            </h2>
            <span className="text-[9px] text-zinc-500">EDIT THE DATA USED ACROSS YOUR DASHBOARD</span>
          </div>
        </div>

        {/* Action Button: Create New Record directly */}
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 self-start bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-900 text-[10px] text-emerald-400 font-bold uppercase px-3 py-1.5 rounded transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Video Record</span>
        </button>
      </div>

      {/* SECTION 1: VIDEO INVENTORY TABLE */}
      <div className="border border-zinc-900 rounded-md overflow-hidden">
        <button
          onClick={() => toggleSection('inventory')}
          className="w-full bg-zinc-900/35 hover:bg-zinc-900/60 p-3 flex justify-between items-center text-[10px] font-bold text-zinc-300 tracking-wider uppercase transition-colors"
        >
          <span className="flex items-center gap-2">
            <Table className="h-3.5 w-3.5 text-emerald-400" />
            1. VIDEO INVENTORY RECORD ({videos.length} RECORDS)
          </span>
          {activeSection === 'inventory' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {activeSection === 'inventory' && (
          <div className="p-3 border-t border-zinc-900 bg-zinc-950/60">
            {/* Mobile/Tablet Card Layout */}
            <div className="block lg:hidden space-y-2">
              {videos.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                  No video records yet. Add a video to begin.
                </div>
              ) : (
                videos.map(v => (
                  <div key={v.id} className="bg-zinc-900/20 border border-zinc-900 rounded p-3 space-y-2 font-mono text-[10px]">
                    <div className="flex justify-between items-center border-b border-zinc-900/60 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-emerald-400">{v.channel}</span>
                        <TactileLED color={getStatusMeta(getVideoStatus(v)).color} importance={getVideoStatus(v) === 'critical' ? 'critical' : 'low'} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-600 text-[8px]">{v.id.slice(0, 8)}</span>
                        <button 
                          onClick={() => handleOpenEdit(v)}
                          className="text-zinc-500 hover:text-white p-0.5"
                          title="Edit Record"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button 
                          onClick={() => handleDeleteRecord(v.id)}
                          className="text-zinc-600 hover:text-rose-500 p-0.5"
                          title="Delete Record"
                        >
                          <Trash className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between"><span className="text-zinc-500">LANE:</span> <span className="text-zinc-300">{v.contentLane}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">TITLE:</span> <span className="text-zinc-100 font-bold truncate max-w-[180px]">{v.title}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">STAGE:</span> <span className="text-zinc-400 uppercase font-bold">{v.currentStage}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">REVENUE LEVEL:</span> <span className="text-emerald-400">Lvl {v.revenueLevelTarget}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">ADDED:</span> <span className="text-zinc-300">{v.createdAt || 'Unknown'}</span></div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">STATUS:</span>
                        <span className={`font-bold uppercase ${getStatusMeta(getVideoStatus(v)).text}`}>{getStatusMeta(getVideoStatus(v)).label}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              {videos.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                  No video records yet. Add a video to begin.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-[10px] text-zinc-400">
                  <thead>
                    <tr className="border-b border-zinc-900 text-[9px] text-zinc-500 uppercase tracking-wider">
                      <th className="py-2.5 pr-2">ID</th>
                      <th className="py-2.5 pr-2">Channel</th>
                      <th className="py-2.5 pr-2">Content Lane</th>
                      <th className="py-2.5 pr-2">Topic Title</th>
                      <th className="py-2.5 pr-2">Current Stage</th>
                      <th className="py-2.5 pr-2">Target Lvl</th>
                      <th className="py-2.5 pr-2">Date Added</th>
                      <th className="py-2.5 pr-2">Video Status</th>
                      <th className="py-2.5 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/45">
                    {videos.map(v => (
                      <tr key={v.id} className="hover:bg-zinc-900/10 transition-colors">
                        <td className="py-2 pr-2 font-bold text-zinc-600 text-[8px]">{v.id.slice(0, 8)}</td>
                        <td className="py-2 pr-2 text-zinc-300 font-bold">{v.channel}</td>
                        <td className="py-2 pr-2 text-[9px] text-zinc-500">{v.contentLane}</td>
                        <td className="py-2 pr-2 text-zinc-200 truncate max-w-[200px]" title={v.title}>{v.title}</td>
                        <td className="py-2 pr-2">
                          <span className="bg-zinc-900 border border-zinc-850 px-1.5 py-0.5 rounded text-[9px] text-zinc-300 font-mono font-bold">
                            {v.currentStage.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 pr-2 font-semibold text-emerald-400">Lvl {v.revenueLevelTarget}</td>
                        <td className="py-2 pr-2 text-zinc-500">{v.createdAt || 'Unknown'}</td>
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-1.5" title={v.statusNote || v.blockerReason || ''}>
                            <TactileLED color={getStatusMeta(getVideoStatus(v)).color} importance={getVideoStatus(v) === 'critical' ? 'critical' : 'low'} />
                            <span className={`font-bold text-[9px] uppercase ${getStatusMeta(getVideoStatus(v)).text}`}>{getStatusMeta(getVideoStatus(v)).label}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEdit(v)}
                            className="text-zinc-500 hover:text-white transition-colors"
                            title="Edit Entire Record"
                          >
                            <Edit className="h-3.5 w-3.5 inline" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(v.id)}
                            className="text-zinc-600 hover:text-rose-500 transition-colors"
                            title="Delete Record"
                          >
                            <Trash className="h-3.5 w-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: REVENUE CONFIG TABLE */}
      <div className="border border-zinc-900 rounded-md overflow-hidden">
        <button
          onClick={() => toggleSection('rev_config')}
          className="w-full bg-zinc-900/35 hover:bg-zinc-900/60 p-3 flex justify-between items-center text-[10px] font-bold text-zinc-300 tracking-wider uppercase transition-colors"
        >
          <span className="flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            2. REVENUE CONFIGURATION PANEL ({revenueLevels.length} LEVEL CODES)
          </span>
          {activeSection === 'rev_config' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {activeSection === 'rev_config' && (
          <div className="p-3 border-t border-zinc-900 bg-zinc-950/60 space-y-2">
            <p className="text-[10px] text-zinc-500 leading-relaxed mb-2">
              These level definitions explain what each video is eligible for. The earning outlook combines the active level mix with monthly publishing frequency; it never predicts an exact amount.
            </p>

            {/* Mobile/Tablet Card Layout */}
            <div className="block lg:hidden space-y-2">
              {revenueLevels.map(lvl => {
                const isEnabled = goals.enabledRevenueLevels.includes(lvl.level);

                return (
                  <div key={lvl.level} className={`bg-zinc-900/20 border border-zinc-900 rounded p-3 space-y-2 font-mono text-[10px] ${isEnabled ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    <div className="flex justify-between items-center border-b border-zinc-900/60 pb-1.5">
                      <span className="font-bold text-emerald-400">Level {lvl.level}</span>
                      <span className={`text-[8px] border px-1.5 rounded font-bold uppercase ${
                        lvl.difficulty === 'Very hard' || lvl.difficulty === 'Hard' ? 'text-rose-400 border-rose-900/50' :
                        lvl.difficulty === 'Medium' ? 'text-amber-400 border-amber-900/50' : 'text-emerald-500 border-emerald-900/50'
                      }`}>
                        {lvl.difficulty}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-zinc-300 font-sans">{lvl.description}</div>
                      {!isEnabled && <div className="text-[9px] text-rose-500 font-bold uppercase">Disabled in goals</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-[10px] text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-900 text-[9px] text-zinc-500 uppercase tracking-wider">
                    <th className="py-2.5 pr-2">Level Code</th>
                    <th className="py-2.5 pr-2">When This Applies</th>
                    <th className="py-2.5 pr-2">Difficulty Rating</th>
                    <th className="py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/45 font-mono">
                  {revenueLevels.map(lvl => {
                    const isEnabled = goals.enabledRevenueLevels.includes(lvl.level);

                    return (
                      <tr key={lvl.level} className={`hover:bg-zinc-900/10 ${isEnabled ? 'text-zinc-300' : 'text-zinc-600'}`}>
                        <td className="py-2 pr-2 font-bold text-emerald-400">Lvl {lvl.level}</td>
                        <td className="py-2 pr-2 font-sans truncate max-w-[200px]" title={lvl.description}>
                          {lvl.description} {!isEnabled && <span className="text-[9px] text-zinc-600 font-bold uppercase ml-1">(Disabled)</span>}
                        </td>
                        <td className="py-2 pr-2">
                          <span className={`text-[8px] border px-1.5 rounded font-bold uppercase ${
                            lvl.difficulty === 'Very hard' || lvl.difficulty === 'Hard' ? 'text-rose-400 border-rose-900/50' :
                            lvl.difficulty === 'Medium' ? 'text-amber-400 border-amber-900/50' : 'text-emerald-500 border-emerald-900/50'
                          }`}>
                            {lvl.difficulty}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <span className={isEnabled ? 'text-emerald-400 font-bold' : 'text-zinc-600'}>
                            {isEnabled ? 'Available' : 'Disabled'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: PRODUCT OPPORTUNITY TABLE */}
      <div className="border border-zinc-900 rounded-md overflow-hidden">
        <button
          onClick={() => toggleSection('products')}
          className="w-full bg-zinc-900/35 hover:bg-zinc-900/60 p-3 flex justify-between items-center text-[10px] font-bold text-zinc-300 tracking-wider uppercase transition-colors"
        >
          <span className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-emerald-400" />
            3. PRODUCT TAG OPPORTUNITY MAP ({productOpportunities.length} OPPORTUNITIES)
          </span>
          {activeSection === 'products' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {activeSection === 'products' && (
          <div className="p-3 border-t border-zinc-900 bg-zinc-950/60 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-zinc-900/40 pb-2">
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                The system identifies product categories that naturally align with technical topic fields. Mute suggestions or label them tagged.
              </p>
              <button
                onClick={handleOpenAddOpp}
                className="flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 font-bold uppercase px-2.5 py-1 rounded transition-all shrink-0 self-start sm:self-center"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-400" />
                <span>Add Opportunity</span>
              </button>
            </div>

            {/* Mobile/Tablet Card Layout */}
            <div className="block lg:hidden space-y-2">
              {productOpportunities.map(opp => (
                <div key={opp.id} className="bg-zinc-900/20 border border-zinc-900 rounded p-3 space-y-2 font-mono text-[10px]">
                  <div className="flex justify-between items-center border-b border-zinc-900/60 pb-1.5">
                    <span className="font-bold text-zinc-300 truncate max-w-[150px]" title={opp.topic}>{opp.topic}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[8px] border px-1.5 rounded font-bold uppercase ${
                        opp.forcedRisk === 'High' ? 'text-rose-400 border-rose-900/50 animate-pulse' :
                        opp.forcedRisk === 'Medium' ? 'text-amber-400 border-amber-900/40' : 'text-emerald-500 border-emerald-900/50'
                      }`}>
                        {opp.forcedRisk} RISK
                      </span>
                      <button 
                        onClick={() => handleOpenEditOpp(opp)}
                        className="text-zinc-500 hover:text-white p-0.5"
                        title="Edit Opportunity"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                      <button 
                        onClick={() => handleDeleteOpp(opp.id)}
                        className="text-zinc-650 hover:text-rose-500 p-0.5"
                        title="Delete Opportunity"
                      >
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-zinc-500">CATEGORY:</span> <span className="text-zinc-400">{opp.productCategory}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">RELEVANCE Score:</span> <span className="font-bold text-sky-400">{opp.relevanceScore}/10</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">SUGGESTION:</span> <span className="text-zinc-400 font-bold">{opp.suggestedTag}</span></div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">RESOLUTION:</span>
                      <span className={`font-bold ${
                        opp.status === 'Added' ? 'text-emerald-400' :
                        opp.status === 'Ignored' ? 'text-zinc-600' : 'text-amber-500'
                      }`}>
                        {opp.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-1.5 pt-1.5 border-t border-zinc-900/60">
                    <button
                      onClick={() => toggleOpportunityStatus(opp, 'Added')}
                      className="bg-emerald-950/20 border border-emerald-900 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 px-2.5 py-0.5 rounded text-[9px] font-bold"
                    >
                      Tag
                    </button>
                    <button
                      onClick={() => toggleOpportunityStatus(opp, 'Ignored')}
                      className="bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 px-2 py-0.5 rounded text-[9px]"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-[10px] text-zinc-400">
                <thead>
                  <tr className="border-b border-zinc-900 text-[9px] text-zinc-500 uppercase tracking-wider">
                    <th className="py-2 pr-2">Source Topic</th>
                    <th className="py-2 pr-2">Category</th>
                    <th className="py-2 pr-2">Relevance Score</th>
                    <th className="py-2 pr-2">Forced Risk</th>
                    <th className="py-2 pr-2">Actionable Suggested Item</th>
                    <th className="py-2 pr-2">Resolution status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/45">
                  {productOpportunities.map(opp => (
                    <tr key={opp.id} className="hover:bg-zinc-900/10">
                      <td className="py-2 pr-2 font-bold text-zinc-300 truncate max-w-[150px]" title={opp.topic}>{opp.topic}</td>
                      <td className="py-2 pr-2 text-zinc-400">{opp.productCategory}</td>
                      <td className="py-2 pr-2 font-bold text-sky-400">{opp.relevanceScore}/10</td>
                      <td className="py-2 pr-2">
                        <span className={`text-[8px] border px-1.5 rounded font-bold uppercase ${
                          opp.forcedRisk === 'High' ? 'text-rose-400 border-rose-900/50' :
                          opp.forcedRisk === 'Medium' ? 'text-amber-400 border-amber-900/40' : 'text-emerald-500 border-emerald-900/50'
                        }`}>
                          {opp.forcedRisk} RISK
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-zinc-400 font-bold">{opp.suggestedTag}</td>
                      <td className="py-2 pr-2 font-mono">
                        <span className={`text-[9px] font-bold ${
                          opp.status === 'Added' ? 'text-emerald-400' :
                          opp.status === 'Ignored' ? 'text-zinc-600' : 'text-amber-500'
                        }`}>
                          {opp.status.toUpperCase()}
                        </span>
                      </td>
                       <td className="py-2 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => toggleOpportunityStatus(opp, 'Added')}
                          className="bg-emerald-950/20 border border-emerald-900 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 px-2 py-0.5 rounded text-[9px] font-bold"
                        >
                          Tag
                        </button>
                        <button
                          onClick={() => toggleOpportunityStatus(opp, 'Ignored')}
                          className="bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 px-1.5 py-0.5 rounded text-[9px]"
                        >
                          Ignore
                        </button>
                        <button 
                          onClick={() => handleOpenEditOpp(opp)}
                          className="text-zinc-500 hover:text-white p-0.5 inline-flex items-center"
                          title="Edit"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button 
                          onClick={() => handleDeleteOpp(opp.id)}
                          className="text-zinc-650 hover:text-rose-500 p-0.5 inline-flex items-center"
                          title="Delete"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* TACTICAL RECORD EDITOR AND ADD MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono text-xs"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-zinc-950 border border-zinc-800 max-h-[90vh] overflow-y-auto p-5 rounded-lg w-full max-w-lg shadow-[0_0_40px_rgba(16,185,129,0.15)] space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between font-bold border-b border-zinc-900 pb-2.5 uppercase">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Database className="h-4 w-4" />
                  {editingVideo ? 'Modify Inventory Record' : 'Inject New Inventory Record'}
                </span>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-sm font-sans"
                >
                  ✕
                </button>
              </div>

              {/* Form Body */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Topic Title */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold">Topic Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => {
                      setFormTitle(e.target.value);
                      if (e.target.value.trim()) setFormTitleError('');
                    }}
                    className={`w-full bg-zinc-900 border rounded px-3 py-2 text-zinc-100 focus:outline-none ${formTitleError ? 'border-rose-500 focus:border-rose-400' : 'border-zinc-850 focus:border-emerald-500'}`}
                    placeholder="e.g. Next-Generation TypeScript Strategies"
                  />
                  {formTitleError && <p className="text-[9px] font-bold text-rose-400">{formTitleError}</p>}
                </div>

                {/* Channel Select */}
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold">Creator Channel</label>
                  <select
                    value={formChannel}
                    onChange={(e) => handleChannelChange(e.target.value as 'LearnDriven' | 'DecodeWorthy')}
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500 rounded px-3 py-2 text-zinc-100 focus:outline-none"
                  >
                    <option value="LearnDriven">LearnDriven</option>
                    <option value="DecodeWorthy">DecodeWorthy</option>
                  </select>
                </div>

                {/* Content Lane Select */}
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold">Content Lane</label>
                  <select
                    value={formContentLane}
                    onChange={(e) => {
                      const lane = e.target.value as VideoItem['contentLane'];
                      setFormContentLane(lane);
                      if (lane === 'LearnDriven Members-only Videos') {
                        setFormEligibility({ ...EMPTY_REVENUE_ELIGIBILITY });
                        return;
                      }
                      if (lane !== 'LearnDriven Long Videos') setFormEligibility(prev => ({ ...prev, overEightMinutes: false }));
                    }}
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500 rounded px-3 py-2 text-zinc-100 focus:outline-none"
                  >
                    {formChannel === 'LearnDriven' ? (
                      <>
                        <option value="LearnDriven Long Videos">LearnDriven Long Videos</option>
                        <option value="LearnDriven Shorts">LearnDriven Shorts</option>
                        <option value="LearnDriven Members-only Videos">LearnDriven Members-only Videos</option>
                      </>
                    ) : (
                      <option value="DecodeWorthy Shorts">DecodeWorthy Shorts</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold">{formContentLane === 'LearnDriven Members-only Videos' ? 'Fixed High-Risk / High-Reward Level' : 'Automatic Revenue Level'}</label>
                  <div className="bg-cyan-950/10 border border-cyan-900/40 rounded px-3 py-2 text-cyan-300 font-bold">Level {calculateRevenueLevel(formContentLane, formEligibility)}</div>
                </div>

                {/* Current Stage */}
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold">Current Production Stage</label>
                  <select
                    value={formCurrentStage}
                    onChange={(e) => setFormCurrentStage(e.target.value as VideoStage)}
                    className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500 rounded px-3 py-2 text-zinc-100 focus:outline-none uppercase font-bold"
                  >
                    <option value="Topic">Topic</option>
                    <option value="Script">Script</option>
                    <option value="Shoot">Shoot</option>
                    <option value="Edit">Edit</option>
                    {formContentLane === 'LearnDriven Long Videos' && (
                      <option value="Thumbnail">Thumbnail</option>
                    )}
                    <option value="Schedule">Schedule</option>
                    <option value="Done">Done</option>
                  </select>
                </div>

                {formContentLane !== 'LearnDriven Members-only Videos' && <div className="md:col-span-2 border-t border-zinc-900 pt-3 space-y-2">
                  <div><span className="text-[10px] text-zinc-500 uppercase font-bold">Revenue Eligibility</span><p className="text-[9px] text-zinc-600 mt-0.5">The level updates automatically from these choices.</p></div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {([
                      ['neutral', 'Neutral — Level 0.5'],
                      ['viralPotential', 'Viral topic potential'],
                      ['productTag', 'Relevant product tag'],
                      ['pinnedComment', 'Pinned promotion or link'],
                      ['overEightMinutes', 'Can naturally exceed 8 minutes'],
                      ['breakoutAttempt', 'Experimental breakout attempt'],
                      ['brandCollaboration', 'Brand collaboration attached'],
                    ] as Array<[keyof VideoRevenueEligibility, string]>).filter(([key]) => key !== 'overEightMinutes' || formContentLane === 'LearnDriven Long Videos').map(([key, label]) => (
                      <label key={key} className={`flex items-center gap-2 border rounded p-2 cursor-pointer ${formEligibility[key] ? 'border-emerald-500/40 bg-emerald-950/15 text-zinc-200' : 'border-zinc-850 text-zinc-500'}`}>
                        <input type="checkbox" checked={formEligibility[key]} onChange={event => setFormEligibility(prev => key === 'neutral'
                          ? (event.target.checked ? { ...EMPTY_REVENUE_ELIGIBILITY, neutral: true } : { ...prev, neutral: false })
                          : { ...prev, neutral: false, [key]: event.target.checked })} className="accent-emerald-500" />
                        <span className="text-[9px] font-bold">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>}

                {editingVideo && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500 uppercase font-bold">Planned Publish Date <span className="normal-case font-normal">(optional)</span></label>
                    <input type="date" value={formExpectedPublishDate} onChange={(e) => setFormExpectedPublishDate(e.target.value)} className="w-full bg-zinc-900 border border-zinc-850 focus:border-emerald-500 rounded px-3 py-2 text-zinc-100 focus:outline-none font-sans" />
                  </div>
                )}

                <div className="md:col-span-2 border-t border-zinc-900 pt-3 space-y-3">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold block">Video Status</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {(['neutral', 'good', 'attention', 'warning', 'critical'] as VideoStatus[]).map(status => {
                      const meta = getStatusMeta(status);
                      return (
                        <button key={status} type="button" onClick={() => setFormStatus(status)} className={`flex flex-col items-center gap-1.5 p-2 rounded border transition-all ${formStatus === status ? `${meta.text} border-current bg-zinc-900/80` : 'border-zinc-850 text-zinc-600'}`}>
                          <TactileLED color={meta.color} importance={status === 'critical' ? 'critical' : 'low'} active={formStatus === status} />
                          <span className="text-[9px] font-bold tracking-wider uppercase">{meta.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-between items-center pt-3 border-t border-zinc-900">
                <div>
                  {editingVideo && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        handleDeleteRecord(editingVideo.id);
                      }}
                      className="flex items-center gap-1.5 text-rose-500 hover:text-rose-400 font-bold uppercase text-[9px]"
                    >
                      <Trash className="h-3.5 w-3.5" />
                      <span>Erase Record</span>
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 px-3.5 py-1.5 text-zinc-400 rounded uppercase font-bold text-[10px]"
                  >
                    Abort
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveForm}
                    disabled={!formTitle.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-bold px-4 py-1.5 rounded uppercase tracking-wider text-[10px]"
                  >
                    {editingVideo ? 'Commit Changes' : 'Inject Record'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PRODUCT OPPORTUNITY EDITOR AND ADD MODAL */}
      <AnimatePresence>
        {isProductModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono text-xs"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-zinc-950 border border-zinc-800 max-h-[90vh] overflow-y-auto p-5 rounded-lg w-full max-w-lg shadow-[0_0_40px_rgba(16,185,129,0.15)] space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between font-bold border-b border-zinc-900 pb-2.5 uppercase">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Tag className="h-4 w-4" />
                  {editingOpp ? 'Modify Product Opportunity' : 'Inject Product Opportunity'}
                </span>
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-sm font-sans"
                >
                  ✕
                </button>
              </div>

              {/* Form Body */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Topic Title / Select */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold">Topic Title / Source</label>
                  <input
                    type="text"
                    value={formOppTopic}
                    onChange={(e) => setFormOppTopic(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Intro to React 19 Server Components"
                    list="topic-options"
                  />
                  <datalist id="topic-options">
                    {videos.map(v => (
                      <option key={v.id} value={v.title} />
                    ))}
                  </datalist>
                  <span className="text-[8px] text-zinc-600 uppercase">Tip: Select from existing video inventory titles to synchronize automatically.</span>
                </div>

                {/* Channel */}
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold">Channel</label>
                  <select
                    value={formOppChannel}
                    onChange={(e) => setFormOppChannel(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-zinc-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="LearnDriven">LearnDriven</option>
                    <option value="DecodeWorthy">DecodeWorthy</option>
                  </select>
                </div>

                {/* Product Category */}
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold">Product Category</label>
                  <input
                    type="text"
                    value={formOppCategory}
                    onChange={(e) => setFormOppCategory(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Creator desk gear"
                  />
                </div>

                {/* Relevance Score */}
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold">Relevance Score (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formOppRelevance}
                    onChange={(e) => setFormOppRelevance(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Revenue Upgrade Level path */}
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold">Revenue Upgrade Path</label>
                  <input
                    type="text"
                    value={formOppUpgrade}
                    onChange={(e) => setFormOppUpgrade(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Level 2 to Level 3"
                  />
                </div>

                {/* Forced Risk */}
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold">Risk Classification</label>
                  <select
                    value={formOppRisk}
                    onChange={(e) => setFormOppRisk(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-zinc-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                {/* Suggested Tag */}
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold">Suggested Product Tag Item</label>
                  <input
                    type="text"
                    value={formOppTag}
                    onChange={(e) => setFormOppTag(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-850 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Mechanical Coding Keyboard"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">Status</label>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    {(['Pending', 'Added', 'Ignored'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setFormOppStatus(st)}
                        className={`py-1.5 px-2 rounded border font-bold uppercase transition-all text-center ${
                          formOppStatus === st
                            ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-400'
                            : 'bg-zinc-900/40 border-zinc-850 text-zinc-500 hover:text-zinc-400'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-between items-center pt-3 border-t border-zinc-900">
                <div>
                  {editingOpp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsProductModalOpen(false);
                        handleDeleteOpp(editingOpp.id);
                      }}
                      className="flex items-center gap-1.5 text-rose-500 hover:text-rose-400 font-bold uppercase text-[9px]"
                    >
                      <Trash className="h-3.5 w-3.5" />
                      <span>Erase Opportunity</span>
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-850 px-3.5 py-1.5 text-zinc-400 rounded uppercase font-bold text-[10px]"
                  >
                    Abort
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveOppForm}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-1.5 rounded uppercase tracking-wider text-[10px]"
                  >
                    {editingOpp ? 'Commit Changes' : 'Inject Opportunity'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

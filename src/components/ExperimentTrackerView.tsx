import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  Plus, 
  CheckCircle2, 
  HelpCircle, 
  Sparkles,
  ArrowRight,
  TrendingUp,
  Calendar,
  XCircle,
  FileText,
  Bookmark,
  X
} from 'lucide-react';
import { Experiment, VideoRecord } from '../types';
import { useDismissOnOutsideClick } from '../hooks/useDismissOnOutsideClick';

interface ExperimentTrackerProps {
  experiments: Experiment[];
  setExperiments: React.Dispatch<React.SetStateAction<Experiment[]>>;
  videos: VideoRecord[];
  onAddEvent: (evt: any) => void;
}

export default function ExperimentTrackerView({ 
  experiments, 
  setExperiments, 
  videos, 
  onAddEvent 
}: ExperimentTrackerProps) {
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHypothesis, setNewHypothesis] = useState('');
  const [newMetric, setNewMetric] = useState('');
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);

  // Editing / resolving states
  const [resolvingExpId, setResolvingExpId] = useState<string | null>(null);
  const [resResult, setResResult] = useState('');
  const [resDecision, setResDecision] = useState('');
  const [resLearning, setResLearning] = useState('');

  const createExperimentHasInput = Boolean(newName.trim() || newHypothesis.trim() || newMetric.trim() || selectedVideos.length > 0);
  const createExperimentModalRef = useDismissOnOutsideClick<HTMLDivElement>(
    isCreateOpen,
    !createExperimentHasInput,
    () => setIsCreateOpen(false)
  );
  const resolveExperimentHasInput = Boolean(resResult.trim() || resDecision.trim() || resLearning.trim());
  const resolveExperimentModalRef = useDismissOnOutsideClick<HTMLDivElement>(
    Boolean(resolvingExpId),
    !resolveExperimentHasInput,
    () => setResolvingExpId(null)
  );

  const handleCreateExperiment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newHypothesis.trim() || !newMetric.trim()) return;

    const newExp: Experiment = {
      id: `exp-manual-${Date.now()}`,
      name: newName,
      hypothesis: newHypothesis,
      startDate: new Date().toISOString(),
      endDate: '',
      videosIncluded: selectedVideos,
      metricBeingTested: newMetric,
      status: 'active'
    };

    setExperiments(prev => [newExp, ...prev]);
    setIsCreateOpen(false);
    setNewName('');
    setNewHypothesis('');
    setNewMetric('');
    setSelectedVideos([]);

    onAddEvent({
      id: `evt-exp-created-${Date.now()}`,
      source: 'system',
      type: 'success',
      message: `Experiment: Created new tracker "${newName}".`,
      timestamp: new Date().toISOString()
    });
  };

  const handleResolveExperiment = () => {
    if (!resolvingExpId) return;

    setExperiments(prev => prev.map(e => {
      if (e.id === resolvingExpId) {
        return {
          ...e,
          endDate: new Date().toISOString(),
          result: resResult,
          decision: resDecision,
          learning: resLearning,
          status: 'completed'
        };
      }
      return e;
    }));

    setResolvingExpId(null);
    setResResult('');
    setResDecision('');
    setResLearning('');

    onAddEvent({
      id: `evt-exp-resolved-${Date.now()}`,
      source: 'system',
      type: 'success',
      message: `Experiment: Resolved successfully with completed findings.`,
      timestamp: new Date().toISOString()
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-900 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-purple-400" />
            Experiment Tracker
          </h2>
          <p className="text-xs text-neutral-500 font-mono mt-1">A/B test title styles, hook types, pacing structures, and thumbnail aesthetics.</p>
        </div>

        <motion.button 
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-black font-bold font-mono text-xs rounded-lg flex items-center gap-1.5 shrink-0 transition shadow-md"
        >
          <Plus className="h-4 w-4" /> Start Experiment
        </motion.button>
      </div>

      {/* Grid: Active vs Completed Experiments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Active Experiments */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Active Test Runs</span>
          </div>

          <div className="flex flex-col gap-4">
            {experiments.filter(e => e.status === 'active').length === 0 ? (
              <div className="p-8 text-center border border-neutral-900 rounded-xl bg-neutral-950/20 text-neutral-600 font-mono text-xs">
                No active experiments running currently. Start a test to measure CTR differences!
              </div>
            ) : (
              experiments.filter(e => e.status === 'active').map(e => (
                <div key={e.id} className="p-5 rounded-xl border border-neutral-850 bg-neutral-900 relative overflow-hidden group hover:border-neutral-800 transition-all">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-0.5 rounded bg-purple-950/60 text-purple-400 border border-purple-900/30 text-[13px] font-mono font-bold uppercase tracking-wider">
                      Active
                    </span>
                    <span className="text-[14px] font-mono text-neutral-500">
                      Started: {new Date(e.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white font-sans">{e.name}</h3>
                  
                  <div className="mt-3 space-y-2 text-xs font-sans text-neutral-400">
                    <p><span className="font-bold text-neutral-200">Hypothesis:</span> {e.hypothesis}</p>
                    <p className="font-mono text-[14px] text-purple-300">Metric tested: {e.metricBeingTested}</p>
                  </div>

                  {/* Resolve controller */}
                  <div className="mt-4 pt-4 border-t border-neutral-850 flex justify-between items-center">
                    <span className="text-[13px] font-mono text-neutral-500">
                      {e.videosIncluded.length} video(s) monitored
                    </span>
                    <button 
                      onClick={() => setResolvingExpId(e.id)}
                      className="text-[14px] font-mono text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5"
                    >
                      <span>Complete & Resolve</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Completed Experiments */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">Completed Findings</span>
          </div>

          <div className="flex flex-col gap-4">
            {experiments.filter(e => e.status === 'completed').length === 0 ? (
              <div className="p-8 text-center border border-neutral-900 rounded-xl bg-neutral-950/20 text-neutral-600 font-mono text-xs">
                No completed findings recorded yet. Add results once tests conclude.
              </div>
            ) : (
              experiments.filter(e => e.status === 'completed').map(e => (
                <div key={e.id} className="p-5 rounded-xl border border-neutral-850 bg-neutral-900 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900/30 text-[13px] font-mono font-bold uppercase tracking-wider">
                      Concluded
                    </span>
                    <span className="text-[14px] font-mono text-neutral-500">
                      Concluded: {e.endDate ? new Date(e.endDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'N/A'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white font-sans">{e.name}</h3>

                  <div className="text-xs font-sans text-neutral-400 space-y-2.5">
                    <div className="p-2.5 rounded bg-neutral-950 border border-neutral-850">
                      <span className="text-[14px] text-neutral-500 font-mono block mb-1">DECISION & LEARNING</span>
                      <p className="text-white leading-relaxed">{e.decision}</p>
                      <p className="text-neutral-400 text-[14px] leading-relaxed mt-1">{e.learning}</p>
                    </div>

                    <p><span className="font-bold text-neutral-200">Test Metrics:</span> {e.result}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Resolve Experiment Modal Dialog */}
      <AnimatePresence>
        {resolvingExpId && (
          <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              ref={resolveExperimentModalRef}
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-850 rounded-xl max-w-md w-full p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4 border-b border-neutral-850 pb-3">
                <h3 className="text-sm font-bold text-white font-sans tracking-tight">
                  Conclude Test Runs
                </h3>
                <button
                  type="button"
                  onClick={() => setResolvingExpId(null)}
                  className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Result */}
                <div>
                  <label className="block text-[13px] text-neutral-500 uppercase mb-1 font-mono">Test Results / Metrics</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Red theme CTR: 8.5% (vs blue theme CTR: 5.2%)"
                    value={resResult}
                    onChange={(e) => setResResult(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-sans"
                  />
                </div>

                {/* Decision */}
                <div>
                  <label className="block text-[13px] text-neutral-500 uppercase mb-1 font-mono">Action / Decision</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Standardize red thumbnails for space topics"
                    value={resDecision}
                    onChange={(e) => setResDecision(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-sans"
                  />
                </div>

                {/* Learning */}
                <div>
                  <label className="block text-[13px] text-neutral-500 uppercase mb-1 font-mono">Key Learning Point</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Contrast background boosts CTR by 60% on Sci-Fi topics..."
                    value={resLearning}
                    onChange={(e) => setResLearning(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-sans resize-none"
                  />
                </div>

                {/* Controls */}
                <div className="flex justify-end gap-2 text-[14px] pt-3 border-t border-neutral-900">
                  <button
                    onClick={() => setResolvingExpId(null)}
                    className="px-3 py-1.5 text-neutral-500 hover:text-neutral-300 font-mono"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResolveExperiment}
                    className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold font-mono rounded"
                  >
                    Resolve Test
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Start Experiment Modal Dialog */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              ref={createExperimentModalRef}
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-850 rounded-xl max-w-md w-full p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4 border-b border-neutral-850 pb-3">
                <h3 className="text-sm font-bold text-white font-sans tracking-tight">
                  Setup New Experiment
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1 rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateExperiment} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-[13px] text-neutral-500 uppercase mb-1 font-mono">Experiment Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Contradiction Hook Test"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-sans"
                  />
                </div>

                {/* Hypothesis */}
                <div>
                  <label className="block text-[13px] text-neutral-500 uppercase mb-1 font-mono">Hypothesis</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Contradiction hook increases swipe resistance by 10%"
                    value={newHypothesis}
                    onChange={(e) => setNewHypothesis(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-sans"
                  />
                </div>

                {/* Metric tested */}
                <div>
                  <label className="block text-[13px] text-neutral-500 uppercase mb-1 font-mono">Metric to Test</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Click-Through Rate (CTR) / Swipe Resistance (%)"
                    value={newMetric}
                    onChange={(e) => setNewMetric(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-900 outline-none text-xs rounded px-3 py-2 text-white font-sans"
                  />
                </div>

                {/* Video Select checkboxes */}
                <div>
                  <label className="block text-[13px] text-neutral-500 uppercase mb-1 font-mono">Select Videos Included</label>
                  <div className="max-h-28 overflow-y-auto border border-neutral-900 rounded p-2.5 space-y-1 bg-neutral-900/20 text-[14px] font-sans">
                    {videos.map(v => (
                      <label key={v.id} className="flex items-center gap-2 text-neutral-300 hover:text-white cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedVideos.includes(v.id)}
                          onChange={() => {
                            if (selectedVideos.includes(v.id)) {
                              setSelectedVideos(prev => prev.filter(id => id !== v.id));
                            } else {
                              setSelectedVideos(prev => [...prev, v.id]);
                            }
                          }}
                          className="rounded border-neutral-800 text-purple-600 bg-neutral-950 focus:ring-0 focus:ring-offset-0"
                        />
                        <span>{v.channelName === 'LearnDriven' ? '[LD]' : '[DW]'} {v.title}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex justify-end gap-2 text-[14px] pt-3 border-t border-neutral-900">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-3 py-1.5 text-neutral-500 hover:text-neutral-300 font-mono"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-black font-bold font-mono rounded"
                  >
                    Create experiment
                  </button>
                </div>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

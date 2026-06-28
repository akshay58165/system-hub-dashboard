import React, { useState } from 'react';
import { MonthlyGoals } from '../types';
import { 
  X, Check, Sliders, Calendar, DollarSign, Gauge, HelpCircle, 
  Tv, Eye, Play, ArrowRight, ArrowLeft, Target, Settings, Lock
} from 'lucide-react';

interface MonthlySetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  currentGoals: MonthlyGoals;
  onSave: (goals: MonthlyGoals) => void;
}

export default function MonthlySetupWizard({ 
  isOpen, 
  onClose, 
  currentGoals, 
  onSave 
}: MonthlySetupWizardProps) {
  const [step, setStep] = useState(1);
  const [goals, setGoals] = useState<MonthlyGoals>({ ...currentGoals });

  const getDurationDays = () => {
    if (!goals.cycleStartDate || !goals.cycleEndDate) return 0;
    const s = new Date(goals.cycleStartDate);
    const e = new Date(goals.cycleEndDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((e.getTime() - s.getTime()) / msPerDay) + 1;
  };

  const durationDays = getDurationDays();
  const isDateRangeInvalid = durationDays < 7 || durationDays > 100;

  if (!isOpen) return null;

  // List of all revenue levels to enable/disable
  const REVENUE_LEVELS = [
    { num: 1, desc: 'Short video, cold topic' },
    { num: 2, desc: 'Short video, viral topic' },
    { num: 3, desc: 'Viral short video + tagged product' },
    { num: 4, desc: 'Video + pinned comment for members promotion' },
    { num: 5, desc: 'Members-only video subscription value' },
    { num: 6, desc: 'Long video < 8 mins, cold performance' },
    { num: 6.5, desc: 'Long video < 8 mins, cold, product tagged' },
    { num: 7, desc: 'Long video > 8 mins, cold performance' },
    { num: 7.5, desc: 'Long video > 8 mins, cold, product tagged' },
    { num: 8, desc: 'Long video < 8 mins, viral topic' },
    { num: 8.5, desc: 'Long video < 8 mins, viral, product tagged' },
    { num: 9, desc: 'Long video > 8 mins, viral topic' },
    { num: 9.5, desc: 'Long video > 8 mins, viral, product tagged' },
    { num: 10, desc: 'Crazy viral video attempt' },
    { num: 20, desc: 'Brand collaboration attached' }
  ];

  const handleNext = () => {
    if (step === 1 && isDateRangeInvalid) return;
    setStep(prev => Math.min(4, prev + 1));
  };
  const handlePrev = () => setStep(prev => Math.max(1, prev - 1));

  const handleToggleLevel = (num: number) => {
    setGoals(prev => {
      const enabled = prev.enabledRevenueLevels.includes(num)
        ? prev.enabledRevenueLevels.filter(x => x !== num)
        : [...prev.enabledRevenueLevels, num];
      return { ...prev, enabledRevenueLevels: enabled };
    });
  };

  const handleSave = () => {
    onSave(goals);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono text-xs">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-lg shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col max-h-[90vh]">
        
        {/* Header bar */}
        <div className="p-4 border-b border-zinc-900 bg-zinc-900/40 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-emerald-400 animate-pulse" />
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block">GOALS, CAPACITY & PRIORITIES</span>
              <h2 className="text-sm font-bold text-white tracking-wider uppercase">MONTHLY MISSION PLANNER</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="bg-zinc-950 px-6 py-3 border-b border-zinc-900/60 flex justify-between items-center text-[10px] text-zinc-500 font-semibold tracking-wider">
          <span className={step === 1 ? 'text-emerald-400 font-bold' : ''}>1. DATES & CAPACITY</span>
          <span className="text-zinc-800">→</span>
          <span className={step === 2 ? 'text-emerald-400 font-bold' : ''}>2. LEARN DRIVEN LANES</span>
          <span className="text-zinc-800">→</span>
          <span className={step === 3 ? 'text-emerald-400 font-bold' : ''}>3. DECODE WORTHY LANES</span>
          <span className="text-zinc-800">→</span>
          <span className={step === 4 ? 'text-emerald-400 font-bold' : ''}>4. MONETIZATION STRATEGY</span>
        </div>

        {/* Wizard content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-zinc-300">
          
          {/* STEP 1: CORE VARIABLES */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white tracking-wide border-b border-zinc-900 pb-1.5 uppercase">
                Step 1: Dates & Work Pace
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">Cycle Start Date</label>
                  <input 
                    type="date" 
                    value={goals.cycleStartDate}
                    onChange={e => {
                      const newStart = e.target.value;
                      const monthVal = newStart ? newStart.slice(0, 7) : goals.month;
                      setGoals({ ...goals, cycleStartDate: newStart, month: monthVal });
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">Cycle End Date</label>
                  <input 
                    type="date" 
                    value={goals.cycleEndDate}
                    onChange={e => setGoals({ ...goals, cycleEndDate: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>
              </div>

              {/* Dynamic Duration Panel with LED style validation */}
              <div className={`p-3 rounded border font-mono text-xs flex items-center justify-between gap-3 ${
                isDateRangeInvalid 
                  ? 'bg-rose-950/20 border-rose-900/60 text-rose-400' 
                  : 'bg-emerald-950/10 border-emerald-900/40 text-emerald-400'
              }`}>
                <div>
                  <span className="text-[9px] uppercase tracking-wider block text-zinc-500">Plan Duration</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-bold text-white">{durationDays} Days</span>
                    <span className="text-[10px] text-zinc-400">(Allowed: 7 to 100 days)</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 font-bold uppercase text-[10px]">
                  {isDateRangeInvalid ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                      <span className="text-rose-500">Invalid Duration Range</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-emerald-500 font-mono">Valid Date Range</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">Work Pace</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['Relaxed', 'Balanced', 'Aggressive', 'War mode'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setGoals({ ...goals, intensityMode: mode })}
                      className={`py-2 px-3 rounded border text-center font-bold tracking-wide transition-all uppercase ${
                        goals.intensityMode === mode 
                          ? 'border-emerald-500 bg-emerald-950/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                          : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {mode === 'War mode' ? 'Deadline sprint' : mode === 'Aggressive' ? 'Focused sprint' : mode}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  {goals.intensityMode === 'Relaxed' && 'A lighter workload with extra recovery time.'}
                  {goals.intensityMode === 'Balanced' && 'A steady, sustainable workload for normal production.'}
                  {goals.intensityMode === 'Aggressive' && 'A temporary high-output sprint that still protects breaks.'}
                  {goals.intensityMode === 'War mode' && 'Maximum short-term focus for a real deadline; use only when necessary.'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">Realistics Workdays</label>
                  <input 
                    type="number" 
                    max="31"
                    min="1"
                    value={goals.workdaysAvailable}
                    onChange={e => setGoals({ ...goals, workdaysAvailable: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">Planned Break Days</label>
                  <input 
                    type="number" 
                    max="31"
                    min="0"
                    value={goals.plannedBreakDays}
                    onChange={e => setGoals({ ...goals, plannedBreakDays: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">Avg Work Hours/Day</label>
                  <input 
                    type="number" 
                    max="24"
                    min="1"
                    value={goals.hoursPerDay}
                    onChange={e => setGoals({ ...goals, hoursPerDay: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">Daily Creator Window Start</label>
                  <input 
                    type="time" 
                    value={goals.workWindowStart}
                    onChange={e => setGoals({ ...goals, workWindowStart: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">Daily Creator Window End</label>
                  <input 
                    type="time" 
                    value={goals.workWindowEnd}
                    onChange={e => setGoals({ ...goals, workWindowEnd: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: LEARN DRIVEN LANES */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white tracking-wide border-b border-zinc-900 pb-1.5 uppercase">
                Step 2: LearnDriven Content Goals
              </h3>

              <div className="bg-zinc-900/30 border border-zinc-900 p-3 rounded">
                <span className="text-emerald-400 font-bold uppercase block text-[10px] tracking-wide mb-1">LearnDriven Scope</span>
                <p className="text-zinc-500 text-[11px] leading-relaxed">
                  Set how many LearnDriven Shorts, long tutorials, and members-only videos you want to complete.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">LearnDriven Shorts (Goal)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={goals.ldShortsTarget}
                    onChange={e => setGoals({ ...goals, ldShortsTarget: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">LearnDriven Long Vids (Goal)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={goals.ldLongTarget}
                    onChange={e => setGoals({ ...goals, ldLongTarget: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">Members-Only Videos (Goal)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={goals.ldMembersTarget}
                    onChange={e => setGoals({ ...goals, ldMembersTarget: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">Long Videos Target / Week</label>
                  <input 
                    type="number" 
                    min="0"
                    value={goals.ldLongWeeklyTarget}
                    onChange={e => setGoals({ ...goals, ldLongWeeklyTarget: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">Members-Only Target / Week</label>
                  <input 
                    type="number" 
                    min="0"
                    value={goals.ldMembersWeeklyTarget}
                    onChange={e => setGoals({ ...goals, ldMembersWeeklyTarget: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: DECODE WORTHY LANES */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white tracking-wide border-b border-zinc-900 pb-1.5 uppercase">
                Step 3: DecodeWorthy Content Goals
              </h3>

              <div className="bg-zinc-900/30 border border-zinc-900 p-3 rounded">
                <span className="text-cyan-400 font-bold uppercase block text-[10px] tracking-wide mb-1">DecodeWorthy Scope</span>
                <p className="text-zinc-500 text-[11px] leading-relaxed">
                  DecodeWorthy currently publishes Shorts only, so this section controls its Shorts goal and posting frequency.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">DecodeWorthy Shorts Planned (Goal)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={goals.dwShortsTarget}
                    onChange={e => setGoals({ ...goals, dwShortsTarget: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block">Posting Schedule Interval</label>
                  <select
                    value={goals.dwShortsScheduleType}
                    onChange={e => setGoals({ ...goals, dwShortsScheduleType: e.target.value as 'Daily' | 'Weekly' | 'Monthly' })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Daily">Daily Frequency</option>
                    <option value="Weekly">Weekly Posting</option>
                    <option value="Monthly">Monthly Posting</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: MONETIZATION STRATEGY */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white tracking-wide border-b border-zinc-900 pb-1.5 uppercase">
                Step 4: Revenue Options & Growth Priorities
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Checkbox toggles */}
                <div className="space-y-3">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">OPTIONAL REVENUE FEATURES</span>
                  
                  <label className="flex items-start gap-3 p-2 bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 rounded cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={goals.productTagsAllowed}
                      onChange={e => setGoals({ ...goals, productTagsAllowed: e.target.checked })}
                      className="mt-0.5 accent-emerald-500 cursor-pointer h-3.5 w-3.5"
                    />
                    <div>
                      <span className="font-semibold text-white">Enable Product Tagging</span>
                      <p className="text-[10px] text-zinc-500">Allows suggesting relevant affiliate/direct products for high-relevance videos.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2 bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 rounded cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={goals.pinnedCommentsAllowed}
                      onChange={e => setGoals({ ...goals, pinnedCommentsAllowed: e.target.checked })}
                      className="mt-0.5 accent-emerald-500 cursor-pointer h-3.5 w-3.5"
                    />
                    <div>
                      <span className="font-semibold text-white">Allow Pinned Members Promotions</span>
                      <p className="text-[10px] text-zinc-500">Auto-suggest promoting members-only content inside related high-impact public comments.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2 bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 rounded cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={goals.brandCollabsTargeted}
                      onChange={e => setGoals({ ...goals, brandCollabsTargeted: e.target.checked })}
                      className="mt-0.5 accent-emerald-500 cursor-pointer h-3.5 w-3.5"
                    />
                    <div>
                      <span className="font-semibold text-white">Target Brand Collaborations</span>
                      <p className="text-[10px] text-zinc-500">Enables high-difficulty Level 20 brand opportunities inside suggestion cards.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2 bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 rounded cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={goals.longVideoAbove8MinTargeted}
                      onChange={e => setGoals({ ...goals, longVideoAbove8MinTargeted: e.target.checked })}
                      className="mt-0.5 accent-emerald-500 cursor-pointer h-3.5 w-3.5"
                    />
                    <div>
                      <span className="font-semibold text-white">Target Mid-Roll Long Videos (&gt;8 min)</span>
                      <p className="text-[10px] text-zinc-500">Suggest expanding core tutorials into high-revenue 8+ minute content slots.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2 bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 rounded cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={goals.viralTopicsTargeted}
                      onChange={e => setGoals({ ...goals, viralTopicsTargeted: e.target.checked })}
                      className="mt-0.5 accent-emerald-500 cursor-pointer h-3.5 w-3.5"
                    />
                    <div>
                      <span className="font-semibold text-white">Include Experimental Viral Topics</span>
                      <p className="text-[10px] text-zinc-500">When disabled, suggestions favor dependable evergreen topics.</p>
                    </div>
                  </label>
                </div>

                {/* Revenue levels multi-select */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">ENABLED REVENUE LEVELS</span>
                    <button 
                      type="button"
                      onClick={() => setGoals({ ...goals, enabledRevenueLevels: REVENUE_LEVELS.map(l => l.num) })}
                      className="text-[9px] text-emerald-400 hover:underline uppercase"
                    >
                      Enable All
                    </button>
                  </div>

                  <div className="border border-zinc-900 rounded bg-zinc-900/25 p-2 h-64 overflow-y-auto space-y-1.5">
                    {REVENUE_LEVELS.map((level) => {
                      const isEnabled = goals.enabledRevenueLevels.includes(level.num);
                      return (
                        <div 
                          key={level.num}
                          onClick={() => handleToggleLevel(level.num)}
                          className={`flex items-center gap-2 p-1.5 rounded border text-[11px] cursor-pointer transition-colors ${
                            isEnabled 
                              ? 'border-emerald-500/40 bg-emerald-950/10 text-zinc-200' 
                              : 'border-zinc-900 bg-transparent text-zinc-600 hover:text-zinc-400'
                          }`}
                        >
                          <div className={`h-4 w-4 shrink-0 rounded flex items-center justify-center border text-[9px] font-bold ${
                            isEnabled ? 'bg-emerald-500 border-emerald-400 text-zinc-950' : 'border-zinc-800 text-transparent'
                          }`}>
                            ✓
                          </div>
                          <span className="font-mono font-bold w-12 text-center text-[10px]">LVL {level.num}</span>
                          <span className="truncate">{level.desc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Footer controls */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-900/20 flex justify-between items-center">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-4 py-2 rounded flex items-center gap-1.5 uppercase font-mono tracking-wider text-[11px]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                PREVIOUS
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-600 font-mono">STEP {step} OF 4</span>
            
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={step === 1 && isDateRangeInvalid}
                className={`px-4 py-2 rounded flex items-center gap-1.5 uppercase font-mono tracking-wider text-[11px] font-bold transition-all ${
                  (step === 1 && isDateRangeInvalid)
                    ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                }`}
              >
                NEXT
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={isDateRangeInvalid}
                className={`px-5 py-2 rounded flex items-center gap-1.5 uppercase font-mono tracking-wider text-[11px] font-bold glow-green transition-all ${
                  isDateRangeInvalid
                    ? 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                }`}
              >
                <Check className="h-4 w-4" />
                LOCK IN STRATEGY
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

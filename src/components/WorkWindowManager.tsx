import React, { useState, useEffect, useMemo } from 'react';
import { WorkWindowSession, VideoStage } from '../types';
import { Plus, Clock, Pause, Play, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WorkWindowManagerProps {
  sessions: WorkWindowSession[];
  onSessionAdd: (session: Omit<WorkWindowSession, 'id' | 'isActive' | 'isPaused' | 'pausePeriods' | 'pauseStartedAt'>) => void;
  onSessionUpdate: (session: WorkWindowSession) => void;
  onSessionRemove: (sessionId: string) => void;
}

const STAGES: VideoStage[] = ['Topic', 'Script', 'Shoot', 'Edit', 'Thumbnail', 'Schedule', 'Done'];

export default function WorkWindowManager({
  sessions,
  onSessionAdd,
  onSessionUpdate,
  onSessionRemove
}: WorkWindowManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [selectedStage, setSelectedStage] = useState<VideoStage | null>(null);

  // Find currently active session
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const activeSessions = useMemo(() => {
    return sessions.filter(s => s.isActive);
  }, [sessions]);

  const handleAddWindow = () => {
    if (startTime && endTime && startTime < endTime) {
      onSessionAdd({
        date: new Date().toISOString().split('T')[0],
        startTime,
        endTime,
        stage: null,
      });
      setStartTime('');
      setEndTime('');
      setSelectedStage(null);
      setIsAdding(false);
    }
  };

  const handleSetStage = (sessionId: string, stage: VideoStage | null) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      onSessionUpdate({ ...session, stage });
    }
  };

  const handleTogglePause = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      const now = new Date().toISOString();
      if (session.isPaused && session.pauseStartedAt) {
        const pausePeriods = [
          ...session.pausePeriods,
          { startTime: session.pauseStartedAt, endTime: now }
        ];
        onSessionUpdate({ ...session, isPaused: false, pausePeriods, pauseStartedAt: undefined });
      } else {
        onSessionUpdate({ ...session, isPaused: true, pauseStartedAt: now });
      }
    }
  };

  const calculateTimeWorked = (session: WorkWindowSession): string => {
    const [startH, startM] = session.startTime.split(':').map(Number);
    const [endH, endM] = session.endTime.split(':').map(Number);
    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    const pausedMinutes = session.pausePeriods.reduce((sum, pause) => {
      const [pH, pM] = pause.startTime.split('T')[1].split(':').map(Number);
      const [peH, peM] = pause.endTime.split('T')[1].split(':').map(Number);
      return sum + ((peH * 60 + peM) - (pH * 60 + pM));
    }, 0);
    const worked = Math.max(0, totalMinutes - pausedMinutes);
    return `${Math.floor(worked / 60)}h ${worked % 60}m`;
  };

  return (
    <div className="border-b border-zinc-900 bg-zinc-950/50 p-4 font-mono">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-bold text-zinc-200 uppercase">Work Sessions</span>
            {activeSessions.length > 0 && (
              <span className="text-xs text-emerald-400 font-bold">
                {activeSessions.length} active
              </span>
            )}
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-2.5 py-1.5 rounded font-bold text-[10px] uppercase transition-colors"
          >
            <Plus className="h-3 w-3" />
            New Window
          </button>
        </div>

        {/* Add Window Form */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border border-emerald-900/30 bg-emerald-950/10 rounded p-3 space-y-2"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase block mb-1">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-zinc-500 uppercase block mb-1">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddWindow}
                  disabled={!startTime || !endTime || startTime >= endTime}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-3 py-1.5 rounded font-bold text-[10px] uppercase transition-colors"
                >
                  Create Window
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 border border-zinc-700 rounded text-zinc-400 hover:text-zinc-200 text-[10px] uppercase"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Sessions */}
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <div className="text-center py-4 text-zinc-600 text-[10px]">
              No sessions scheduled for today. Add one to get started.
            </div>
          ) : (
            sessions.map((session) => (
              <motion.div
                key={session.id}
                layout
                className={`border rounded-lg p-3 space-y-2 transition-all ${
                  session.isActive
                    ? 'border-emerald-500/50 bg-emerald-950/15 shadow-[0_0_12px_rgba(16,185,129,0.1)]'
                    : 'border-zinc-800 bg-zinc-900/30'
                }`}
              >
                {/* Session Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {session.isActive ? (
                      <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-zinc-600" />
                    )}
                    <span className="text-sm font-bold text-zinc-200">
                      {session.startTime} – {session.endTime}
                    </span>
                    <span className="text-[9px] text-zinc-500">
                      {calculateTimeWorked(session)}
                    </span>
                  </div>
                  {session.isActive && session.isPaused && (
                    <span className="text-[9px] text-yellow-400 font-bold">PAUSED</span>
                  )}
                  <button
                    onClick={() => onSessionRemove(session.id)}
                    className="p-1 hover:bg-red-950/30 rounded text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>

                {/* Stage Selector */}
                <div className="space-y-1">
                  <div className="text-[9px] text-zinc-500 uppercase">Currently working on:</div>
                  <div className="grid grid-cols-7 gap-1">
                    {STAGES.map((stage) => (
                      <button
                        key={stage}
                        onClick={() => handleSetStage(session.id, session.stage === stage ? null : stage)}
                        className={`px-2 py-1.5 rounded text-[8px] font-bold uppercase transition-all ${
                          session.stage === stage
                            ? 'bg-emerald-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {stage[0]}
                      </button>
                    ))}
                  </div>
                  {session.stage && (
                    <div className="text-[9px] text-emerald-400 font-mono">
                      Active: {session.stage}
                    </div>
                  )}
                </div>

                {/* Controls */}
                {session.isActive && (
                  <div className="flex gap-2 pt-2 border-t border-zinc-800/50">
                    <button
                      onClick={() => handleTogglePause(session.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded font-bold text-[9px] uppercase transition-colors ${
                        session.isPaused
                          ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                      }`}
                    >
                      {session.isPaused ? (
                        <>
                          <Play className="h-3 w-3" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="h-3 w-3" />
                          Pause
                        </>
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

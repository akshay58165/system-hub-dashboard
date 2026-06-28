import React, { useMemo, useState } from 'react';
import { VideoItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface TactileScopeProps {
  id: string;
  videos: VideoItem[];
  totalDays: number;
  todayDay: number;
  totalPlanned: number;
  totalCompleted: number;
  status: 'calm' | 'warning' | 'danger';
}

export default function TactileScope({
  id,
  videos,
  totalDays,
  todayDay,
  totalPlanned,
  totalCompleted,
  status
}: TactileScopeProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ day: number; value: number; type: 'actual' | 'target' } | null>(null);

  // Generate dataset points: Pacing target vs actual completes day by day
  const dataPoints = useMemo(() => {
    const points: Array<{ day: number; target: number; actual: number }> = [];
    
    // Sort completed videos by scheduled/actual publish date
    const completedDays = videos
      .filter(v => v.currentStage === 'Done')
      .map(v => {
        const dateStr = v.actualScheduledDate || v.expectedPublishDate;
        if (!dateStr) return 1;
        const parts = dateStr.split('-');
        const day = parts.length === 3 ? parseInt(parts[2], 10) : 1;
        return isNaN(day) ? 1 : day;
      })
      .sort((a, b) => a - b);

    // Build cumulative array for each day of the month
    let actualCumulative = 0;
    const targetDailyRate = totalPlanned / totalDays;

    for (let day = 1; day <= totalDays; day++) {
      // Count videos completed on or before this day
      const completedOnThisDay = completedDays.filter(d => d === day).length;
      actualCumulative += completedOnThisDay;

      // Limit actual plotting to current day
      const actualVal = day <= todayDay ? actualCumulative : 0;
      const targetVal = day * targetDailyRate;

      points.push({
        day,
        target: Number(targetVal.toFixed(2)),
        actual: day <= todayDay ? Number(actualVal.toFixed(2)) : 0
      });
    }

    return points;
  }, [videos, totalDays, todayDay, totalPlanned]);

  // Width & height of the inner SVG coordinate system
  const width = 450;
  const height = 180;
  const padding = { top: 25, right: 25, bottom: 25, left: 35 };

  // Scale functions
  const getX = (day: number) => {
    return padding.left + ((day - 1) / (totalDays - 1)) * (width - padding.left - padding.right);
  };

  const getMaxVal = () => {
    const maxData = Math.max(totalPlanned, totalCompleted, 1);
    return Math.ceil(maxData * 1.1); // Add some ceiling room
  };

  const maxVal = getMaxVal();

  const getY = (value: number) => {
    const chartHeight = height - padding.top - padding.bottom;
    return height - padding.bottom - (value / maxVal) * chartHeight;
  };

  // Generate SVG Path Strings
  const targetPath = useMemo(() => {
    if (dataPoints.length === 0) return '';
    return dataPoints.map((p, idx) => {
      const x = getX(p.day);
      const y = getY(p.target);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [dataPoints, maxVal]);

  const actualPath = useMemo(() => {
    if (dataPoints.length === 0) return '';
    const activePoints = dataPoints.filter(p => p.day <= todayDay);
    if (activePoints.length === 0) return '';
    return activePoints.map((p, idx) => {
      const x = getX(p.day);
      const y = getY(p.actual);
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [dataPoints, todayDay, maxVal]);

  // Horizontal and vertical grid lines
  const gridLines = useMemo(() => {
    const lines = [];
    const hLinesCount = 5;
    const vLinesCount = 8;

    // Horizontals
    for (let i = 0; i <= hLinesCount; i++) {
      const val = (i / hLinesCount) * maxVal;
      const y = getY(val);
      lines.push({
        type: 'H',
        coord: y,
        label: val.toFixed(0)
      });
    }

    // Verticals
    for (let i = 0; i < vLinesCount; i++) {
      const dayIdx = Math.round((i / (vLinesCount - 1)) * (totalDays - 1)) + 1;
      const x = getX(dayIdx);
      lines.push({
        type: 'V',
        coord: x,
        label: `D${dayIdx}`
      });
    }

    return lines;
  }, [maxVal, totalDays]);

  return (
    <div id={`scope-container-${id}`} className="bg-zinc-950 border border-zinc-900 rounded-lg p-4 font-mono text-xs relative overflow-hidden flex flex-col justify-between select-none shadow-[inset_0_1.5px_0_rgba(255,255,255,0.02)] min-h-[220px] crt-bezel h-full">
      {/* Phosphor Glow Layer */}
      <div className={`absolute inset-0 bg-gradient-to-br ${
        status === 'danger' ? 'from-rose-950/10' : status === 'warning' ? 'from-amber-950/10' : 'from-emerald-950/10'
      } to-transparent opacity-30 pointer-events-none`} />

      {/* Scope Header */}
      <div className="flex justify-between items-center text-[7px] text-zinc-600 tracking-wider mb-2 z-10 border-b border-zinc-900/60 pb-1.5">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
          <span>OSCILLOSCOPE SIG.REG-v2</span>
        </span>
          <span className="text-zinc-500">MONTHLY OUTPUT PACE</span>
      </div>

      {/* CRT Scope Face Screen */}
      <div className="relative bg-black border border-zinc-900 rounded overflow-hidden flex-1 shadow-[inset_0_3px_15px_rgba(0,0,0,0.95)]">
        
        {/* Real-time scanning vertical line to mimic sweeps */}
        <div className="absolute top-0 bottom-0 w-[1px] bg-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-[scanline-sweep_4s_infinite_linear] pointer-events-none z-10" 
          style={{
            animation: 'scanline-sweep 4s infinite linear'
          }}
        />

        <svg 
          className="w-full h-full" 
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          {/* Grid Layout Line Elements */}
          {gridLines.map((line, idx) => {
            if (line.type === 'H') {
              return (
                <g key={`H-${idx}`} className="opacity-20">
                  <line 
                    x1={padding.left} 
                    y1={line.coord} 
                    x2={width - padding.right} 
                    y2={line.coord} 
                    stroke="#10b981" 
                    strokeWidth="0.5" 
                    strokeDasharray="2,3"
                  />
                  <text 
                    x={padding.left - 6} 
                    y={line.coord + 2.5} 
                    fill="#10b981" 
                    fontSize="7" 
                    textAnchor="end"
                  >
                    {line.label}
                  </text>
                </g>
              );
            } else {
              return (
                <g key={`V-${idx}`} className="opacity-20">
                  <line 
                    x1={line.coord} 
                    y1={padding.top} 
                    x2={line.coord} 
                    y2={height - padding.bottom} 
                    stroke="#10b981" 
                    strokeWidth="0.5" 
                    strokeDasharray="2,3"
                  />
                  <text 
                    x={line.coord} 
                    y={height - padding.bottom + 10} 
                    fill="#10b981" 
                    fontSize="7" 
                    textAnchor="middle"
                  >
                    {line.label}
                  </text>
                </g>
              );
            }
          })}

          {/* Reference linear pacing climb (Dotted glow cyan target line) */}
          {targetPath && (
            <path 
              d={targetPath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="1.5"
              strokeDasharray="4,4"
              className="opacity-50 drop-shadow-[0_0_2px_#06b6d4]"
            />
          )}

          {/* Actual pacing wave path (Glowing bright green/rose solid line) */}
          {actualPath && (
            <path 
              d={actualPath}
              fill="none"
              stroke={status === 'danger' ? '#f43f5e' : status === 'warning' ? '#f59e0b' : '#10b981'}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-colors duration-500 ${
                status === 'danger' 
                  ? 'drop-shadow-[0_0_6px_#f43f5e]' 
                  : status === 'warning' 
                    ? 'drop-shadow-[0_0_5px_#f59e0b]' 
                    : 'drop-shadow-[0_0_5px_#10b981]'
              }`}
            />
          )}

          {/* Interactive invisible hover anchors to inspect days */}
          {dataPoints.map((p) => {
            const cx = getX(p.day);
            const cyActual = getY(p.actual);
            const cyTarget = getY(p.target);

            return (
              <g key={p.day}>
                {p.day <= todayDay && (
                  <circle 
                    cx={cx} 
                    cy={cyActual} 
                    r="8" 
                    fill="transparent" 
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoveredPoint({ day: p.day, value: p.actual, type: 'actual' })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                )}
                <circle 
                  cx={cx} 
                  cy={cyTarget} 
                  r="8" 
                  fill="transparent" 
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoveredPoint({ day: p.day, value: p.target, type: 'target' })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            );
          })}
        </svg>

        {/* Vintage glass CRT screen glare simulation */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-emerald-500/5 to-white/5 opacity-40 pointer-events-none" />

        {/* Dynamic scope coordinates hover readout */}
        <AnimatePresence>
          {hoveredPoint && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute bottom-2 left-2 bg-black/90 border border-zinc-800 rounded p-1.5 text-[8.5px] text-zinc-400 space-y-0.5 z-20 shadow-lg pointer-events-none"
            >
              <div className="font-bold text-white uppercase text-[9px] tracking-wider">
                {hoveredPoint.type === 'actual' ? 'Actual Output' : 'Pacing Target'}
              </div>
              <div>Day Cycle: <span className="text-zinc-200">Day {hoveredPoint.day}</span></div>
              <div>Completed Vids: <span className={hoveredPoint.type === 'actual' ? 'text-emerald-400 font-bold' : 'text-cyan-400 font-bold'}>{hoveredPoint.value}</span></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scope Footer Metadata Readings */}
      <div className="grid grid-cols-4 gap-2 text-[7px] text-zinc-500 border-t border-zinc-900/60 pt-2 mt-2 font-mono">
        <div>
          <span className="text-zinc-600 block">COUPLING / TRIG:</span>
          <span className="text-zinc-400 font-bold">DC // EXT.AUTO</span>
        </div>
        <div>
          <span className="text-zinc-600 block">CHART RANGE:</span>
          <span className="text-zinc-400 font-bold">1.0 VID / DIV</span>
        </div>
        <div>
          <span className="text-zinc-600 block">SWEEP RATE:</span>
          <span className="text-zinc-400 font-bold">3.0 DAYS / DIV</span>
        </div>
        <div>
          <span className="text-zinc-600 block">DIAGNOSTIC LOCK:</span>
          <span className={status === 'danger' ? 'text-rose-500 font-bold animate-pulse' : 'text-emerald-400 font-bold'}>
          {status === 'danger' ? 'BEHIND PLANNED PACE' : 'ON TRACK'}
          </span>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Flame, Tag, Sparkles, TrendingUp } from 'lucide-react';
import { VideoItem, ProductOpportunity, MonthlyGoals } from '../types';

interface NewsTickerProps {
  videos: VideoItem[];
  productOpportunities: ProductOpportunity[];
  goals: MonthlyGoals;
}

export default function NewsTicker({ videos, productOpportunities, goals }: NewsTickerProps) {
  // Generate list of dynamic ticker news items
  const getTickerItems = () => {
    const items: { text: string; icon: React.ReactNode; type: 'alert' | 'info' | 'success' }[] = [];

    // 1. Consistency warnings
    const ldShorts = videos.filter(v => v.channel === 'LearnDriven' && v.contentLane === 'LearnDriven Shorts');
    const dwShorts = videos.filter(v => v.channel === 'DecodeWorthy' && v.contentLane === 'DecodeWorthy Shorts');
    
    const todayStr = '2026-06-27';
    const getBuffer = (laneVids: VideoItem[]) => laneVids.filter(v => v.currentStage === 'Done' && v.actualScheduledDate && v.actualScheduledDate > todayStr).length;

    const ldShortsBuffer = getBuffer(ldShorts);
    const dwShortsBuffer = getBuffer(dwShorts);

    if (dwShortsBuffer === 0 && goals.dwShortsTarget > 0) {
      items.push({
        text: 'DECODEWORTHY HAS NO SHORT READY AHEAD - FINISH AND SCHEDULE THE NEXT SHORT',
        icon: <Flame className="h-3 w-3 text-red-400" />,
        type: 'alert'
      });
    }
    if (ldShortsBuffer === 0 && goals.ldShortsTarget > 0) {
      items.push({
        text: 'LEARNDRIVEN HAS NO SHORT READY AHEAD - RECORD AND SCHEDULE THE NEXT SHORT',
        icon: <Flame className="h-3 w-3 text-red-400" />,
        type: 'alert'
      });
    }

    // 2. Blocked videos
    const blocked = videos.filter(v => v.isBlocked);
    blocked.forEach(b => {
      items.push({
        text: `BLOCKER: "${b.title.toUpperCase()}" CANNOT MOVE PAST "${b.currentStage.toUpperCase()}" BECAUSE: ${b.blockerReason?.toUpperCase() || 'REASON NOT RECORDED'}`,
        icon: <AlertCircle className="h-3 w-3 text-amber-400" />,
        type: 'alert'
      });
    });

    // 3. Product Opportunities
    const pendingProducts = productOpportunities.filter(o => o.status === 'Pending');
    pendingProducts.forEach(opp => {
      items.push({
        text: `REVENUE OPPORTUNITY: ADD "${opp.suggestedTag.toUpperCase()}" TO "${opp.topic.toUpperCase()}" FOR AN ESTIMATED ${opp.revenueUpgrade.toUpperCase()}`,
        icon: <Tag className="h-3 w-3 text-cyan-400" />,
        type: 'info'
      });
    });

    // 4. Monthly targets stats
    const totalPlanned = goals.ldShortsTarget + goals.ldLongTarget + goals.ldMembersTarget + goals.dwShortsTarget;
    const completed = videos.filter(v => v.currentStage === 'Done').length;
    if (totalPlanned > 0) {
      const pct = Math.round((completed / totalPlanned) * 100);
      items.push({
        text: `MONTHLY PROGRESS: ${completed}/${totalPlanned} VIDEOS COMPLETED (${pct}% OF GOAL) • CURRENT PACE: ${goals.intensityMode === 'War mode' ? 'DEADLINE SPRINT' : goals.intensityMode.toUpperCase()}`,
        icon: <TrendingUp className="h-3 w-3 text-emerald-400" />,
        type: 'success'
      });
    }

    // Default messages if items is empty
    if (items.length === 0) {
      items.push({
        text: 'CREATOR.OS IS ON TRACK • NO URGENT BLOCKERS • PRODUCTION WORKFLOW IS CLEAR',
        icon: <Sparkles className="h-3 w-3 text-emerald-400" />,
        type: 'success'
      });
    }

    return items;
  };

  const tickerItems = getTickerItems();
  
  // Join the items together with clean bullet points
  const combinedText = tickerItems.map(item => ` ••• [UPDATE] ` + item.text).join(' ');

  return (
    <div className="bg-zinc-950 border-y border-zinc-900/80 px-4 py-1.5 flex items-center gap-3 font-mono text-[10px] tracking-wider uppercase relative overflow-hidden select-none">
      {/* Static indicator badge */}
      <div className="flex items-center gap-1.5 bg-rose-950/40 border border-rose-900/50 text-rose-400 px-2 py-0.5 rounded text-[8px] font-bold z-10 shrink-0 select-none animate-pulse shadow-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        LIVE PRIORITY UPDATES
      </div>

      <div className="w-full overflow-hidden whitespace-nowrap relative flex items-center h-4">
        {/* Infinite marquee block */}
        <motion.div
          animate={{ x: [0, "-33.333%"] }}
          className="inline-flex gap-12 pr-12 text-zinc-400 font-medium whitespace-nowrap"
          transition={{
            ease: "linear",
            duration: 25,
            repeat: Infinity,
          }}
        >
          <span>{combinedText}</span>
          <span>{combinedText}</span>
          <span>{combinedText}</span>
        </motion.div>
      </div>
    </div>
  );
}

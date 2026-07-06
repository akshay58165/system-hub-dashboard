import React, { useMemo } from 'react';
import { ArrowDownAZ, BadgeInfo, CircleAlert, ListChecks, Star } from 'lucide-react';
import type { Topic } from '../types';

interface TopicScoreViewProps {
  topics: Topic[];
}

function scoreTone(score: number) {
  if (score >= 9) return 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300';
  if (score >= 7) return 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300';
  if (score >= 5) return 'border-amber-500/40 bg-amber-950/20 text-amber-300';
  return 'border-rose-500/40 bg-rose-950/20 text-rose-300';
}

function scoreLabel(score: number) {
  if (score >= 9) return 'Excellent';
  if (score >= 8) return 'Strong';
  if (score >= 6) return 'Solid';
  if (score >= 4) return 'Middling';
  return 'Low';
}

export default function TopicScoreView({ topics }: TopicScoreViewProps) {
  const rankedTopics = useMemo(() => {
    return [...topics].sort((a, b) => {
      const scoreA = a.topicScore ?? -1;
      const scoreB = b.topicScore ?? -1;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    });
  }, [topics]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <ListChecks className="h-4 w-4 text-amber-400" />
              Topic Score
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Topics are ranked from highest score to lowest score. `10` means excellent and `1` means low.
            </p>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-[10px] font-mono text-neutral-400">
            {rankedTopics.length} topic{rankedTopics.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {rankedTopics.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-8 text-center text-sm text-neutral-500">
          No topics found yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rankedTopics.map((topic, index) => {
            const score = topic.topicScore ?? 0;
            const fillWidth = `${Math.max(0, Math.min(100, score * 10))}%`;

            return (
              <div key={topic.id} className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-xs font-bold text-neutral-300">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{topic.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] font-mono text-neutral-500">
                          <span>{topic.channel}</span>
                          <span>·</span>
                          <span>{topic.status}</span>
                          <span>·</span>
                          <span>Priority {topic.priority}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`shrink-0 rounded-lg border px-3 py-2 text-right font-mono text-xs ${scoreTone(score)}`}>
                    <div className="flex items-center justify-end gap-1.5 font-bold">
                      <Star className="h-3.5 w-3.5" />
                      {score > 0 ? `${score}/10` : 'No score'}
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wider opacity-80">
                      {score > 0 ? scoreLabel(score) : 'Unrated'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-900">
                  <div
                    className={`h-full rounded-full ${score >= 9 ? 'bg-emerald-400' : score >= 7 ? 'bg-cyan-400' : score >= 5 ? 'bg-amber-400' : 'bg-rose-400'}`}
                    style={{ width: fillWidth }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-neutral-500">
                  <span className="flex items-center gap-1.5">
                    <BadgeInfo className="h-3.5 w-3.5 text-neutral-600" />
                    Updated {new Date(topic.lastUpdated).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {score >= 8 ? <ArrowDownAZ className="h-3.5 w-3.5 text-emerald-400" /> : <CircleAlert className="h-3.5 w-3.5 text-rose-400" />}
                    {score > 0 ? 'Ranked by topic score' : 'Needs a score'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

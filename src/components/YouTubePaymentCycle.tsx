import React from 'react';
import { CalendarClock, CheckCircle2, CircleDollarSign, Clock3 } from 'lucide-react';
import { getLocalDateString } from '../videoLogic';

const MS_PER_DAY = 86_400_000;

function daysUntil(from: Date, to: Date) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
}

function shortDate(date: Date) {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function YouTubePaymentCycle() {
  const today = new Date(`${getLocalDateString()}T12:00:00`);
  const day = today.getDate();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const nextMonth = today.getMonth() + 1;
  const nextYear = nextMonth > 11 ? today.getFullYear() + 1 : today.getFullYear();
  const normalizedNextMonth = nextMonth % 12;
  const finalizeStart = new Date(nextYear, normalizedNextMonth, 7);
  const finalizeEnd = new Date(nextYear, normalizedNextMonth, 12);
  const paymentStart = new Date(nextYear, normalizedNextMonth, 21);
  const paymentEnd = new Date(nextYear, normalizedNextMonth, 26);
  const monthProgress = Math.min(100, Math.round((day / monthEnd.getDate()) * 100));

  const currentPhase = day <= 6
    ? { label: 'Previous month: preparing final amount', tone: 'text-zinc-300 border-zinc-800 bg-zinc-900/40' }
    : day <= 12
      ? { label: 'Previous month: finalization window active', tone: 'text-cyan-400 border-cyan-900/50 bg-cyan-950/15' }
      : day <= 20
        ? { label: 'Previous month: waiting for payment window', tone: 'text-amber-400 border-amber-900/50 bg-amber-950/15' }
        : day <= 26
          ? { label: 'Previous month: payment window active', tone: 'text-emerald-400 border-emerald-900/50 bg-emerald-950/15' }
          : { label: 'Previous month: payment window completed', tone: 'text-emerald-400 border-emerald-900/50 bg-emerald-950/15' };

  const steps = [
    { title: 'Revenue closes', dates: shortDate(monthEnd), countdown: daysUntil(today, monthEnd), icon: <Clock3 className="h-3.5 w-3.5" /> },
    { title: 'Amount finalizes', dates: `${shortDate(finalizeStart)}–${shortDate(finalizeEnd)}`, countdown: daysUntil(today, finalizeStart), icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    { title: 'Payment issued', dates: `${shortDate(paymentStart)}–${shortDate(paymentEnd)}`, countdown: daysUntil(today, paymentStart), icon: <CircleDollarSign className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="border border-zinc-900 bg-zinc-950/60 rounded-lg p-3 space-y-3 font-mono">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-zinc-200 font-bold uppercase flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-cyan-400" />YouTube Payment Cycle</span>
        <span className="text-[8px] text-zinc-600">TODAY {shortDate(today).toUpperCase()}</span>
      </div>

      <div className={`border rounded px-2.5 py-2 text-[9px] font-bold ${currentPhase.tone}`}>{currentPhase.label}</div>

      <div>
        <div className="flex justify-between text-[8px] text-zinc-600 mb-1"><span>CURRENT REVENUE MONTH</span><span>{monthProgress}% COMPLETE</span></div>
        <div className="h-1.5 bg-zinc-900 rounded overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-700" style={{ width: `${monthProgress}%` }} /></div>
      </div>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={step.title} className="grid grid-cols-[24px_1fr_auto] items-center gap-2 border border-zinc-900/80 bg-zinc-900/20 rounded p-2 relative overflow-hidden">
            <div className="h-6 w-6 rounded-full border border-cyan-900/50 text-cyan-400 flex items-center justify-center bg-cyan-950/10">{step.icon}</div>
            <div><span className="text-[9px] text-zinc-300 font-bold block">{step.title}</span><span className="text-[8px] text-zinc-600">{step.dates}</span></div>
            <span className="text-[8px] text-zinc-400 text-right">{step.countdown === 0 ? 'TODAY' : `${step.countdown}D LEFT`}</span>
            {index === 0 && <span className="absolute inset-y-0 left-0 w-0.5 bg-cyan-500 animate-pulse" />}
          </div>
        ))}
      </div>

      <p className="text-[8px] text-zinc-600 leading-relaxed">Payment requires the applicable threshold to be met and no payment holds. Bank arrival can be later than the issue date.</p>
    </div>
  );
}

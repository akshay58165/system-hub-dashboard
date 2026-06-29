import React, { createContext, useContext, useEffect, useState } from 'react';
import { Cloud, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { createClient, Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const ACCESS_EMAIL_KEY = 'creator_os_access_email';
const PIN_READY_KEY = 'creator_os_pin_ready';
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
}) : null;

export type SyncStatus = 'local' | 'loading' | 'saved' | 'saving' | 'error';
type CloudContextValue = {
  userId: string | null;
  email: string | null;
  syncStatus: SyncStatus;
  setSyncStatus: (status: SyncStatus) => void;
  signOut: () => Promise<void>;
};

const CloudContext = createContext<CloudContextValue>({ userId: null, email: null, syncStatus: 'local', setSyncStatus: () => undefined, signOut: async () => undefined });
export const useCloud = () => useContext(CloudContext);

function SignInScreen({ onRequirePinSetup }: { onRequirePinSetup: () => void }) {
  const savedEmail = localStorage.getItem(ACCESS_EMAIL_KEY) || '';
  const hasPinAccess = localStorage.getItem(PIN_READY_KEY) === 'true' && Boolean(savedEmail);
  const [mode, setMode] = useState<'pin' | 'email'>(hasPinAccess ? 'pin' : 'email');
  const [email, setEmail] = useState(savedEmail);
  const [pin, setPin] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setSending(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setSending(false);
    if (signInError) setError(signInError.message);
    else setSent(true);
  };

  const handlePinSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !savedEmail) return;
    if (!/^\d{6}$/.test(pin)) {
      setError('Enter your complete 6-digit access code.');
      return;
    }
    setSending(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: savedEmail, password: pin });
    setSending(false);
    if (signInError) {
      setPin('');
      setError('That access code was not accepted. Try again or use email recovery.');
    }
  };

  const useEmailRecovery = () => {
    localStorage.removeItem(PIN_READY_KEY);
    onRequirePinSetup();
    setMode('email');
    setPin('');
    setError('');
  };

  return <main className="min-h-screen bg-[#07080a] text-zinc-200 grid place-items-center p-6">
    <div className="w-full max-w-md border border-zinc-800 bg-zinc-950 rounded-xl p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-purple-500" />
      <div className="h-11 w-11 rounded-lg border border-emerald-900/60 bg-emerald-950/20 grid place-items-center mb-5">{mode === 'pin' ? <KeyRound className="h-5 w-5 text-emerald-400" /> : <LockKeyhole className="h-5 w-5 text-emerald-400" />}</div>
      <h1 className="text-xl font-bold">Private System Hub</h1>
      <p className="text-sm text-zinc-500 mt-2">{mode === 'pin' ? 'Enter your private access code to open the complete workspace.' : 'Use email once to connect this device and create your access code.'}</p>
      {mode === 'pin' ? <form onSubmit={handlePinSubmit} className="mt-6 space-y-3">
        <label className="text-[10px] text-zinc-500 font-mono uppercase">6-digit access code</label>
        <input type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{6}" maxLength={6} required autoFocus value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} placeholder="••••••" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-center text-xl font-mono tracking-[0.55em] outline-none focus:border-emerald-500" />
        {error && <p className="text-xs text-rose-400 text-center">{error}</p>}
        <button disabled={sending || pin.length !== 6} className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-bold py-2.5 text-sm flex items-center justify-center gap-2">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}Unlock workspace</button>
        <button type="button" onClick={useEmailRecovery} className="w-full py-2 text-[10px] font-mono text-zinc-600 hover:text-zinc-300">FORGOT CODE? USE EMAIL RECOVERY</button>
      </form> : sent ? <div className="mt-6 border border-emerald-900/60 bg-emerald-950/15 rounded-lg p-4"><ShieldCheck className="h-5 w-5 text-emerald-400 mb-2" /><strong className="text-sm block">Check your email once</strong><p className="text-xs text-zinc-500 mt-1">Open the secure link on this device. You will then create your six-digit access code.</p></div> : <form onSubmit={handleEmailSubmit} className="mt-6 space-y-3"><label className="text-[10px] text-zinc-500 font-mono uppercase">Email address</label><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-600" /><input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></div>{error && <p className="text-xs text-rose-400">{error}</p>}<button disabled={sending} className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-zinc-950 font-bold py-2.5 text-sm flex items-center justify-center gap-2">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}Send one-time setup link</button></form>}
      <p className="text-[10px] text-zinc-700 mt-5">Your code authenticates the same private cloud account. It is never stored in this browser.</p>
    </div>
  </main>;
}

function PinSetupScreen({ email, onComplete }: { email: string; onComplete: () => void }) {
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const savePin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (!/^\d{6}$/.test(pin)) { setError('Choose exactly six numbers.'); return; }
    if (pin !== confirmation) { setError('The two access codes do not match.'); return; }
    setSaving(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password: pin });
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    localStorage.setItem(ACCESS_EMAIL_KEY, email);
    localStorage.setItem(PIN_READY_KEY, 'true');
    onComplete();
  };

  const numericChange = (value: string, setter: (value: string) => void) => setter(value.replace(/\D/g, '').slice(0, 6));

  return <main className="min-h-screen bg-[#07080a] text-zinc-200 grid place-items-center p-6">
    <div className="w-full max-w-md border border-zinc-800 bg-zinc-950 rounded-xl p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-purple-500" />
      <div className="h-11 w-11 rounded-lg border border-emerald-900/60 bg-emerald-950/20 grid place-items-center mb-5"><KeyRound className="h-5 w-5 text-emerald-400" /></div>
      <span className="text-[9px] font-mono text-emerald-400 tracking-widest">ONE-TIME SETUP</span>
      <h1 className="text-xl font-bold mt-1">Create your access code</h1>
      <p className="text-sm text-zinc-500 mt-2">Use any six digits you will remember. This replaces repeated email-link sign-ins on this device.</p>
      <form onSubmit={savePin} className="mt-6 space-y-3">
        <label className="text-[10px] text-zinc-500 font-mono uppercase">New 6-digit code</label>
        <input aria-label="New 6-digit access code" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} autoFocus value={pin} onChange={event => { numericChange(event.target.value, setPin); setError(''); }} placeholder="••••••" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-center text-xl font-mono tracking-[0.55em] outline-none focus:border-emerald-500" />
        <label className="text-[10px] text-zinc-500 font-mono uppercase block pt-1">Confirm code</label>
        <input aria-label="Confirm 6-digit access code" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={confirmation} onChange={event => { numericChange(event.target.value, setConfirmation); setError(''); }} placeholder="••••••" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-center text-xl font-mono tracking-[0.55em] outline-none focus:border-emerald-500" />
        {error && <p className="text-xs text-rose-400 text-center">{error}</p>}
        <button disabled={saving || pin.length !== 6 || confirmation.length !== 6} className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-bold py-2.5 text-sm flex items-center justify-center gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Save access code</button>
      </form>
      <p className="text-[10px] text-zinc-700 mt-5">If you forget it, email recovery lets you securely create a new code.</p>
    </div>
  </main>;
}

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [pinReady, setPinReady] = useState(() => localStorage.getItem(PIN_READY_KEY) === 'true');
  const [loading, setLoading] = useState(Boolean(supabase));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(supabase ? 'loading' : 'local');
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user.email) localStorage.setItem(ACCESS_EMAIL_KEY, nextSession.user.email);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) return <CloudContext.Provider value={{ userId: null, email: null, syncStatus: 'local', setSyncStatus, signOut: async () => undefined }}>{children}</CloudContext.Provider>;
  if (isDev) return <CloudContext.Provider value={{ userId: 'dev-user-id', email: 'dev@local', syncStatus: 'local', setSyncStatus, signOut: async () => undefined }}>{children}</CloudContext.Provider>;
  if (loading) return <div className="min-h-screen bg-[#07080a] grid place-items-center"><Loader2 className="h-7 w-7 text-emerald-400 animate-spin" /></div>;
  if (!session) return <SignInScreen onRequirePinSetup={() => setPinReady(false)} />;
  if (!pinReady && session.user.email) return <PinSetupScreen email={session.user.email} onComplete={() => setPinReady(true)} />;

  return <CloudContext.Provider value={{ userId: session.user.id, email: session.user.email || null, syncStatus, setSyncStatus, signOut: async () => { await supabase.auth.signOut(); } }}>{children}</CloudContext.Provider>;
}

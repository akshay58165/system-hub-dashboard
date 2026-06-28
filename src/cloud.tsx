import React, { createContext, useContext, useEffect, useState } from 'react';
import { Cloud, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { createClient, Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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

function SignInScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setSending(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setSending(false);
    if (signInError) setError(signInError.message);
    else setSent(true);
  };

  return <main className="min-h-screen bg-[#07080a] text-zinc-200 grid place-items-center p-6">
    <div className="w-full max-w-md border border-zinc-800 bg-zinc-950 rounded-xl p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-purple-500" />
      <div className="h-11 w-11 rounded-lg border border-emerald-900/60 bg-emerald-950/20 grid place-items-center mb-5"><LockKeyhole className="h-5 w-5 text-emerald-400" /></div>
      <h1 className="text-xl font-bold">Private System Hub</h1>
      <p className="text-sm text-zinc-500 mt-2">Sign in to load and securely save your dashboard records.</p>
      {sent ? <div className="mt-6 border border-emerald-900/60 bg-emerald-950/15 rounded-lg p-4"><ShieldCheck className="h-5 w-5 text-emerald-400 mb-2" /><strong className="text-sm block">Check your email</strong><p className="text-xs text-zinc-500 mt-1">Open the secure sign-in link on this device. You may close this message afterward.</p></div> : <form onSubmit={handleSubmit} className="mt-6 space-y-3"><label className="text-[10px] text-zinc-500 font-mono uppercase">Email address</label><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-600" /><input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-3 py-2.5 text-sm outline-none focus:border-emerald-500" /></div>{error && <p className="text-xs text-rose-400">{error}</p>}<button disabled={sending} className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-zinc-950 font-bold py-2.5 text-sm flex items-center justify-center gap-2">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}Send secure sign-in link</button></form>}
      <p className="text-[10px] text-zinc-700 mt-5">Your data is isolated by your authenticated user ID and protected by database row-level security.</p>
    </div>
  </main>;
}

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(supabase ? 'loading' : 'local');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setLoading(false); });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!supabase) return <CloudContext.Provider value={{ userId: null, email: null, syncStatus: 'local', setSyncStatus, signOut: async () => undefined }}>{children}</CloudContext.Provider>;
  if (loading) return <div className="min-h-screen bg-[#07080a] grid place-items-center"><Loader2 className="h-7 w-7 text-emerald-400 animate-spin" /></div>;
  if (!session) return <SignInScreen />;

  return <CloudContext.Provider value={{ userId: session.user.id, email: session.user.email || null, syncStatus, setSyncStatus, signOut: async () => { await supabase.auth.signOut(); } }}>{children}</CloudContext.Provider>;
}

import { YoutubeRevenueData } from '../types';
import { supabase } from './supabase';

// Must exactly match an "Authorized redirect URI" registered on the Google
// Cloud OAuth client, and must exactly match what the server uses to
// reconstruct the same value during token exchange (api/youtube-auth-callback.js).
const APP_URL = 'https://system-hub-dashboard.vercel.app';
const REDIRECT_URI = `${APP_URL}/api/youtube-auth-callback`;
const SCOPES = [
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  // Required for the real current total subscriber count (YouTube Data API
  // v3 channels.list), a different permission than the Analytics scopes
  // above - Google requires separate consent for it.
  'https://www.googleapis.com/auth/youtube.readonly',
].join(' ');

// Builds the Google consent URL and immediately navigates to it. `state`
// carries the current Supabase session's access token so the callback (a
// plain browser redirect with no Authorization header) can identify which
// user the resulting refresh token belongs to.
export async function startYoutubeAuth(): Promise<void> {
  const clientId = (import.meta as any).env.VITE_YOUTUBE_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_YOUTUBE_CLIENT_ID is not configured.');
  }
  if (!supabase) {
    throw new Error('Supabase authentication is not configured.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sign in before connecting YouTube.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: session.access_token,
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function fetchYoutubeRevenue(): Promise<YoutubeRevenueData & { error?: string }> {
  if (!supabase) {
    throw new Error('Supabase authentication is not configured.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sign in before checking YouTube revenue.');
  }

  const response = await fetch('/api/youtube-revenue', {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${response.status} Error`);
  }

  return response.json();
}

export async function disconnectYoutube(): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase authentication is not configured.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sign in before disconnecting YouTube.');
  }

  const response = await fetch('/api/youtube-disconnect', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${response.status} Error`);
  }
}

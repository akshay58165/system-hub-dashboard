import { createClient } from '@supabase/supabase-js';

const APP_URL = process.env.APP_URL || 'https://system-hub-dashboard.vercel.app';
const REDIRECT_URI = `${APP_URL}/api/youtube-auth-callback`;

function redirectWithStatus(response, status) {
  response.writeHead(302, { Location: `${APP_URL}/?youtube=${status}` });
  response.end();
}

// Completes the Google OAuth authorization-code flow for YouTube Analytics
// access. `state` carries the user's Supabase access token (set by the
// client when it built the initial consent URL) so this callback - a plain
// browser redirect with no Authorization header available - can still
// verify which user the resulting refresh token belongs to.
export default async function handler(request, response) {
  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.VITE_YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!clientId || !clientSecret || !supabaseUrl || !supabaseKey) {
    console.error('YouTube OAuth callback is missing required server environment variables.');
    return redirectWithStatus(response, 'config_error');
  }

  const { code, state, error: googleError } = request.query || {};
  if (googleError) {
    console.error('YouTube OAuth consent error:', googleError);
    return redirectWithStatus(response, 'denied');
  }
  if (typeof code !== 'string' || typeof state !== 'string' || !code || !state) {
    return redirectWithStatus(response, 'invalid_request');
  }

  const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
  const authedSupabase = createClient(cleanUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await authedSupabase.auth.getUser(state);
  if (authError || !user) {
    console.error('YouTube OAuth callback: invalid or expired user session in state.');
    return redirectWithStatus(response, 'session_expired');
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text().catch(() => '');
      console.error(`YouTube token exchange failed (${tokenResponse.status}): ${errBody}`);
      return redirectWithStatus(response, 'token_exchange_failed');
    }

    const tokenData = await tokenResponse.json();
    const { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn } = tokenData;

    if (!refreshToken) {
      // Google only returns a refresh_token on first consent (or when
      // access_type=offline&prompt=consent forces re-issue, which the
      // client always requests) - if it's missing here, the exchange
      // itself is broken rather than something we can silently recover from.
      console.error('YouTube token exchange succeeded but returned no refresh_token.');
      return redirectWithStatus(response, 'no_refresh_token');
    }

    // Fetch the channel identity so the UI can show which channel is linked.
    let channelId = null;
    let channelTitle = null;
    try {
      const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (channelResponse.ok) {
        const channelData = await channelResponse.json();
        const channel = channelData.items?.[0];
        channelId = channel?.id || null;
        channelTitle = channel?.snippet?.title || null;
      }
    } catch (e) {
      console.error('Failed to fetch YouTube channel identity (non-fatal):', e);
    }

    // Write as the authenticated user via a client carrying their own JWT,
    // so RLS (auth.uid() = user_id) authorizes the upsert - no service-role
    // key needed, same pattern the rest of the app's endpoints use.
    const userScopedSupabase = createClient(cleanUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${state}` } },
    });

    const expiresAt = new Date(Date.now() + (expiresIn || 3600) * 1000).toISOString();
    const { error: upsertError } = await userScopedSupabase.from('youtube_oauth_tokens').upsert({
      user_id: user.id,
      refresh_token: refreshToken,
      access_token: accessToken,
      access_token_expires_at: expiresAt,
      channel_id: channelId,
      channel_title: channelTitle,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Failed to store YouTube tokens:', upsertError.message);
      if (upsertError.message.includes('relation "public.youtube_oauth_tokens" does not exist')) {
        return redirectWithStatus(response, 'table_missing');
      }
      return redirectWithStatus(response, 'storage_failed');
    }

    return redirectWithStatus(response, 'connected');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('YouTube OAuth callback failed:', message);
    return redirectWithStatus(response, 'unexpected_error');
  }
}

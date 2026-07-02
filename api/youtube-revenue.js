import { createClient } from '@supabase/supabase-js';

function sendJson(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

// Real, live channel revenue from YouTube's own Analytics API —
// "estimatedRevenue" is YouTube's own metric name (the same figure YouTube
// Studio itself shows, subject to AdSense adjustments/holds), not a number
// this app invents. Requires the channel owner to have connected via OAuth.
export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.VITE_YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!clientId || !clientSecret || !supabaseUrl || !supabaseKey) {
    console.error('YouTube revenue endpoint is missing required server environment variables.');
    return sendJson(response, 503, { error: 'YouTube revenue service is not configured.' });
  }

  const authorization = request.headers.authorization || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) {
    return sendJson(response, 401, { error: 'Authentication required.' });
  }

  const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');
  const authedSupabase = createClient(cleanUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await authedSupabase.auth.getUser(accessToken);
  if (authError || !user) {
    return sendJson(response, 401, { error: 'Invalid or expired session.' });
  }

  // User-scoped client so RLS (auth.uid() = user_id) governs read/write —
  // no service-role key needed.
  const userScopedSupabase = createClient(cleanUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  try {
    const { data: tokenRow, error: tokenError } = await userScopedSupabase
      .from('youtube_oauth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tokenError) {
      console.error('Failed to read stored YouTube token:', tokenError.message);
      if (tokenError.message.includes('relation "public.youtube_oauth_tokens" does not exist')) {
        return sendJson(response, 503, { error: 'YouTube token table does not exist. Run the required Supabase migration first.' });
      }
      return sendJson(response, 502, { error: `Failed to read YouTube connection: ${tokenError.message}`.slice(0, 500) });
    }

    if (!tokenRow) {
      return sendJson(response, 200, { connected: false });
    }

    let liveAccessToken = tokenRow.access_token;
    const expiresAt = tokenRow.access_token_expires_at ? new Date(tokenRow.access_token_expires_at).getTime() : 0;
    const needsRefresh = !liveAccessToken || expiresAt < Date.now() + 60_000;

    if (needsRefresh) {
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: tokenRow.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        const errBody = await refreshResponse.text().catch(() => '');
        console.error(`YouTube token refresh failed (${refreshResponse.status}): ${errBody}`);
        // A refresh failure usually means the user revoked access externally.
        return sendJson(response, 200, { connected: false, error: 'YouTube access expired or was revoked. Please reconnect.' });
      }

      const refreshData = await refreshResponse.json();
      liveAccessToken = refreshData.access_token;
      const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();

      await userScopedSupabase.from('youtube_oauth_tokens').update({
        access_token: liveAccessToken,
        access_token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
    }

    // Month-to-date window, matching the OpenAI usage panel's framing.
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startDate = monthStart.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    const analyticsParams = new URLSearchParams({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'estimatedRevenue',
      currency: 'INR',
    });

    // subscribersGained/subscribersLost fall under the already-granted
    // yt-analytics.readonly scope — no extra consent needed for this one.
    const subsParams = new URLSearchParams({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'subscribersGained,subscribersLost',
    });

    const [analyticsResponse, subsResponse] = await Promise.all([
      fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${analyticsParams.toString()}`, {
        headers: { Authorization: `Bearer ${liveAccessToken}` },
      }),
      fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${subsParams.toString()}`, {
        headers: { Authorization: `Bearer ${liveAccessToken}` },
      }),
    ]);

    if (!analyticsResponse.ok) {
      const errBody = await analyticsResponse.text().catch(() => '');
      console.error(`YouTube Analytics API failed (${analyticsResponse.status}): ${errBody}`);
      let detail = errBody;
      try {
        const parsed = JSON.parse(errBody);
        detail = parsed.error?.message || errBody;
      } catch { /* not JSON, use raw body */ }
      // Monetization-scope errors are common for non-monetized or
      // non-owner-authenticated channels — surface honestly instead of
      // showing a fabricated number.
      return sendJson(response, 200, {
        connected: true,
        channelTitle: tokenRow.channel_title || undefined,
        error: `YouTube Analytics request failed (${analyticsResponse.status}): ${detail}`.slice(0, 500),
      });
    }

    const analyticsData = await analyticsResponse.json();
    const revenue = analyticsData.rows?.[0]?.[0] ?? 0;

    let subscribersNetGained;
    if (subsResponse.ok) {
      const subsData = await subsResponse.json();
      const gained = subsData.rows?.[0]?.[0] ?? 0;
      const lost = subsData.rows?.[0]?.[1] ?? 0;
      subscribersNetGained = gained - lost;
    } else {
      const errBody = await subsResponse.text().catch(() => '');
      console.error(`YouTube subscribers query failed (non-fatal, ${subsResponse.status}): ${errBody}`);
    }

    return sendJson(response, 200, {
      connected: true,
      channelTitle: tokenRow.channel_title || undefined,
      revenue,
      currency: 'INR',
      subscribersNetGained,
      periodStart: monthStart.toISOString(),
      periodEnd: now.toISOString(),
      fetchedAt: now.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('YouTube revenue endpoint failed:', message);
    return sendJson(response, 502, { error: `YouTube revenue service is temporarily unavailable: ${message}`.slice(0, 500) });
  }
}

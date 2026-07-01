import { createClient } from '@supabase/supabase-js';

function sendJson(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

// Real, account-wide OpenAI spend — not derived from tokens this app happened
// to see. Requires an Admin API key (organization owner only, generated at
// platform.openai.com/settings/organization/admin-keys with the
// api.usage.read scope), which is a different key type from the regular
// secret key used to make completions.
export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  const adminKey = process.env.OPENAI_ADMIN_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Usage endpoint is missing required Supabase environment variables.');
    return sendJson(response, 503, { error: 'Usage service is not configured.' });
  }

  const authorization = request.headers.authorization || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) {
    return sendJson(response, 401, { error: 'Authentication required.' });
  }

  const supabase = createClient(supabaseUrl.replace(/\/rest\/v1\/?$/, ''), supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) {
    return sendJson(response, 401, { error: 'Invalid or expired session.' });
  }

  if (!adminKey) {
    return sendJson(response, 503, {
      error: 'No OPENAI_ADMIN_API_KEY configured on the server. Real account spend requires an Admin API key from platform.openai.com/settings/organization/admin-keys (api.usage.read scope), set as an environment variable.'
    });
  }

  try {
    // Month-to-date window, matching how OpenAI's own usage dashboard frames spend.
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startTime = Math.floor(monthStart.getTime() / 1000);

    let totalCostUSD = 0;
    let currency = 'usd';
    let page = null;
    let hasMore = true;
    let safetyCounter = 0;

    while (hasMore && safetyCounter < 20) {
      safetyCounter++;
      const params = new URLSearchParams({
        start_time: String(startTime),
        bucket_width: '1d',
        limit: '31'
      });
      if (page) params.set('page', page);

      const costsResponse = await fetch(`https://api.openai.com/v1/organization/costs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${adminKey}` }
      });

      if (!costsResponse.ok) {
        const errBody = await costsResponse.text().catch(() => '');
        console.error(`OpenAI Costs API failed with status ${costsResponse.status}: ${errBody}`);
        let detail = errBody;
        try {
          const parsed = JSON.parse(errBody);
          detail = parsed.error?.message || errBody;
        } catch { /* not JSON, use raw body */ }
        return sendJson(response, 502, { error: `OpenAI Costs API request failed (${costsResponse.status}): ${detail}`.slice(0, 500) });
      }

      const data = await costsResponse.json();
      (data.data || []).forEach((bucket) => {
        (bucket.results || []).forEach((result) => {
          if (result.amount) {
            // OpenAI returns amount.value as a string in some responses; Number()
            // it explicitly so += always adds numerically instead of silently
            // string-concatenating and corrupting totalCostUSD into a string.
            totalCostUSD += Number(result.amount.value) || 0;
            currency = result.amount.currency || currency;
          }
        });
      });

      hasMore = !!data.has_more;
      page = data.next_page || null;
      if (!page) hasMore = false;
    }

    return sendJson(response, 200, {
      totalCostUSD,
      currency,
      periodStart: monthStart.toISOString(),
      periodEnd: now.toISOString(),
      fetchedAt: now.toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Usage endpoint failed:', message);
    return sendJson(response, 502, { error: `Usage service is temporarily unavailable: ${message}`.slice(0, 500) });
  }
}

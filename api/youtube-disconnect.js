import { createClient } from '@supabase/supabase-js';

function sendJson(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return sendJson(response, 503, { error: 'YouTube service is not configured.' });
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

  const userScopedSupabase = createClient(cleanUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { error } = await userScopedSupabase.from('youtube_oauth_tokens').delete().eq('user_id', user.id);
  if (error) {
    return sendJson(response, 502, { error: `Failed to disconnect: ${error.message}`.slice(0, 500) });
  }

  return sendJson(response, 200, { disconnected: true });
}

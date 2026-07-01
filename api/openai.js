import { createClient } from '@supabase/supabase-js';

const MAX_SYSTEM_PROMPT_LENGTH = 12_000;
const MAX_USER_PROMPT_LENGTH = 40_000;

function sendJson(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  const openAIKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!openAIKey || !supabaseUrl || !supabaseKey) {
    console.error('Secure AI endpoint is missing required server environment variables.');
    return sendJson(response, 503, { error: 'AI service is not configured.' });
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

  const { systemPrompt, userPrompt } = request.body || {};
  if (
    typeof systemPrompt !== 'string' ||
    typeof userPrompt !== 'string' ||
    systemPrompt.length === 0 ||
    userPrompt.length === 0 ||
    systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH ||
    userPrompt.length > MAX_USER_PROMPT_LENGTH
  ) {
    return sendJson(response, 400, { error: 'Invalid prompt payload.' });
  }

  try {
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAIKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!openAIResponse.ok) {
      console.error(`OpenAI request failed with status ${openAIResponse.status}.`);
      return sendJson(response, 502, { error: 'AI provider request failed.' });
    }

    const data = await openAIResponse.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return sendJson(response, 502, { error: 'AI provider returned an empty response.' });
    }

    const usage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
      : null;

    return sendJson(response, 200, { content, usage, model: data.model || null });
  } catch (error) {
    console.error('Secure AI endpoint failed:', error instanceof Error ? error.message : error);
    return sendJson(response, 502, { error: 'AI service is temporarily unavailable.' });
  }
}

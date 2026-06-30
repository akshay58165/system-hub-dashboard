import { createClient } from '@supabase/supabase-js';

const MAX_SCRIPT_LENGTH = 20_000;

function sendJson(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

const SOURCES_SYSTEM_PROMPT = `You are a meticulous fact-sourcing research assistant for a YouTube scriptwriter.
You will be given the full text of a video script. Your job is to find real, authentic, highly reliable web sources for every distinct claim and piece of information made in the script, from start to finish.

Rules you must follow exactly:
- Search the live web. Only use sources you have actually found and verified to exist right now. Never invent, guess, or hallucinate a URL.
- Exclude Wikipedia and any low authority, unreliable, or poorly ranked website. Only use highly authentic, reputable sources that rank well on Google for their subject matter.
- Do not link to dead pages. Every link must be a real, currently working page.
- For every source found, report it in exactly this format, as a list, never as a table:
  H1: the literal H1 heading of the landing page that holds the source
  Source: name of the publication or website
  Link: the exact URL of the page
  Covers: which specific part of the script's claim or content this source supports
- Go through the entire script from start to end and keep finding sources until every verifiable claim has been addressed.
- Do not use an em dash anywhere in your response.
- After the full source list, add a final section titled "Claim verification summary" that lists every distinct claim made in the script and states whether it was verified against an authentic source. State an honest overall percentage of claims that were verified, do not round up or inflate it. Clearly mark any claim that could not be verified. If a clearly higher authority, more reputable source contradicts or tells a different version of a claim in the script, report that conflict explicitly, but only when that contradicting source is itself reputable and authoritative.
- Output only the source list and the verification summary in this format. No extra commentary, no markdown tables, no code blocks.`;

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  const openAIKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!openAIKey || !supabaseUrl || !supabaseKey) {
    console.error('Secure sources endpoint is missing required server environment variables.');
    return sendJson(response, 503, { error: 'Source-finding service is not configured.' });
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

  const { script } = request.body || {};
  if (typeof script !== 'string' || script.trim().length === 0 || script.length > MAX_SCRIPT_LENGTH) {
    return sendJson(response, 400, { error: 'Invalid script payload.' });
  }

  try {
    // Uses the Responses API (not chat completions) with the web_search_preview
    // tool so the model performs a real, live web search server-side and can
    // only cite pages it actually found, instead of inventing URLs the way a
    // plain chat-completion call would.
    const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAIKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SOURCES_MODEL || 'gpt-4o-mini',
        tools: [{ type: 'web_search_preview' }],
        input: [
          { role: 'system', content: SOURCES_SYSTEM_PROMPT },
          { role: 'user', content: script },
        ],
      }),
    });

    if (!openAIResponse.ok) {
      const errBody = await openAIResponse.text().catch(() => '');
      console.error(`OpenAI sources request failed with status ${openAIResponse.status}: ${errBody}`);
      return sendJson(response, 502, { error: 'Source search request failed.' });
    }

    const data = await openAIResponse.json();
    const messageItem = Array.isArray(data.output)
      ? data.output.find((item) => item.type === 'message')
      : null;
    const textPart = messageItem?.content?.find((c) => c.type === 'output_text');
    const content = textPart?.text;

    if (!content) {
      return sendJson(response, 502, { error: 'Source search returned an empty response.' });
    }

    return sendJson(response, 200, { content });
  } catch (error) {
    console.error('Secure sources endpoint failed:', error instanceof Error ? error.message : error);
    return sendJson(response, 502, { error: 'Source search service is temporarily unavailable.' });
  }
}

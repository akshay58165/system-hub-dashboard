// Client-side OpenAI API integration service
import { VideoRecord } from '../types';

export async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  if (!apiKey) {
    throw new Error("Missing OpenAI API Key. Please configure it in the dashboard.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // Cost-effective, fast, and highly capable for text scripting
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMessage = errData.error?.message || `HTTP ${response.status} Error`;
    throw new Error(`OpenAI API Request Failed: ${errMessage}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Received empty or invalid response from OpenAI.");
  }

  return content;
}

// Generate system prompts based on content channel strategy
export function getChannelSystemPrompt(channel: "LearnDriven" | "DecodeWorthy", customInstruction?: string): string {
  const baseInstruction = customInstruction ? `Additional Custom Instruction: ${customInstruction}` : "";

  if (channel === "LearnDriven") {
    return `You are a professional technical educator and scriptwriter for the LearnDriven YouTube channel. 
Your goal is to explain coding, databases, web development, and software architecture.
Style & Tone Guidelines:
- Clear, progressive, step-by-step logic.
- Avoid vague introductory fluff; start immediately with the developer problem.
- Highly actionable, conversational, and direct.
- Keep sentences short and punchy for clarity during speaking.

${baseInstruction}`;
  } else {
    return `You are a premium technical storyteller and scriptwriter for the DecodeWorthy YouTube channel.
Your goal is to build curiosity and visually explain how massive systems (Netflix, WhatsApp, Google Search, physical computer memory) work under the hood.
Style & Tone Guidelines:
- Hook the user in the first 10-15 seconds (e.g., build mystery/suspense or ask a high-impact question).
- Rely heavily on clear physical analogies and spatial/visual descriptions.
- Break explanations down logically without getting bogged down in low-level code syntax.
- Build a compelling narrative arc that ends on a memorable conclusion.

${baseInstruction}`;
  }
}

// Generate structured actionable creator plans using OpenAI GPT models
export async function generateAIActionPlan(
  apiKey: string,
  channel: 'LearnDriven' | 'DecodeWorthy' | 'All',
  videos: VideoRecord[],
  goals: any
): Promise<{
  priority: { title: string; description: string; actionLabel: string; badge: string };
  insights: { id: string; title: string; description: string; type: 'success' | 'warning' | 'info' | 'recommendation'; reason: string; actionLabel: string }[];
}> {
  const systemPrompt = `You are the Lead Producer and AI Strategist for a high-end tech YouTube channel. 
Your job is to analyze creator performance and productivity data, and output a highly structured daily Action Plan in valid JSON format.
Your output MUST contain EXACTLY this JSON structure:
{
  "priority": {
    "title": "Short punchy title for today's single most important task",
    "description": "Clear 2-sentence description of what needs to be done and why",
    "actionLabel": "Button text (e.g. 'Draft script now')",
    "badge": "Critical" or "Blocked" or "Next Action"
  },
  "insights": [
    {
      "id": "unique-slug-id",
      "title": "Insight header (e.g. 'CTR Underperformance')",
      "description": "Granular explanation of the data pattern",
      "type": "success" or "warning" or "info" or "recommendation",
      "reason": "Specific metrics-backed reason (e.g. 'Average percentage viewed is 55% but CTR is only 3.2%')",
      "actionLabel": "Clickable trigger text"
    }
  ]
}
Do not write any markdown blocks, conversational intro, or wrap the JSON in backticks. Output raw JSON only.`;

  const videoContext = videos.slice(0, 10).map(v => ({
    title: v.title,
    format: v.format,
    stage: v.pipelineStage,
    views: v.metrics?.lifetimeViews || 0,
    ctr: v.metrics?.ctr || 0,
    retention: v.metrics?.averagePercentageViewed || 0,
    subs: v.metrics?.subscribersGainedPer1kViews || 0,
    blocked: v.blockedReason || null
  }));

  const userPrompt = `Channel: ${channel}
Goals: ${JSON.stringify(goals)}
Recent Video Telemetry Data: ${JSON.stringify(videoContext)}
Generate the prioritized action plan and insights for today.`;

  try {
    const rawContent = await callOpenAI(apiKey, systemPrompt, userPrompt);
    // Strip codeblock characters if returned by model
    const cleanJSON = rawContent.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleanJSON);
  } catch (e) {
    console.error("AI Action Plan generation crash, falling back:", e);
    // Graceful fallback plan
    return {
      priority: {
        title: 'Review production buffer',
        description: 'Complete the editing cycle for your next queued video topic to secure a 7-day safety buffer.',
        actionLabel: 'Check Pipeline',
        badge: 'Next Action'
      },
      insights: [
        {
          id: 'fb-1',
          title: 'Upload Pace Risk',
          description: 'A thin schedule lane indicates a consistency drop risk if the upcoming recording gets delayed.',
          type: 'warning',
          reason: 'Fewer than 2 scheduled uploads remain in queue.',
          actionLabel: 'Schedule Now'
        }
      ]
    };
  }
}

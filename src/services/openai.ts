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
  goals: any,
  scorecard: any,
  activities: any[]
): Promise<{
  priority: { title: string; description: string; actionLabel: string; badge: string };
  directives: {
    whatToDo: { id: string; title: string; description: string; actionLabel: string }[];
    whatIsDone: { id: string; title: string; description: string; actionLabel: string }[];
    whatToChase: { id: string; title: string; description: string; actionLabel: string }[];
    whatToMaintain: { id: string; title: string; description: string; actionLabel: string }[];
    howToKeepUp: { id: string; title: string; description: string; actionLabel: string }[];
  };
}> {
  const systemPrompt = `You are the Lead Producer and AI Strategist for a high-end tech YouTube channel. 
Your job is to analyze creator performance, well-being metrics, and production logs, and output a highly structured daily Action Plan in valid JSON format.
Your output MUST contain EXACTLY this JSON structure:
{
  "priority": {
    "title": "Short punchy title for today's single most important task",
    "description": "Clear 2-sentence description of what needs to be done and why",
    "actionLabel": "Button text (e.g. 'Draft script now')",
    "badge": "Critical" or "Blocked" or "Next Action"
  },
  "directives": {
    "whatToDo": [
      { "id": "do-1", "title": "Priority script task", "description": "Write hook segment focusing on smartphone mic triggers", "actionLabel": "Start Scripting" }
    ],
    "whatIsDone": [
      { "id": "done-1", "title": "Milestone completed", "description": "Roman collapse short published successfully (105k views)", "actionLabel": "View Stats" }
    ],
    "whatToChase": [
      { "id": "chase-1", "title": "Milestone target", "description": "Target 930k subscribers: need 15k views on tech explainers this week", "actionLabel": "View Forecast" }
    ],
    "whatToMaintain": [
      { "id": "maint-1", "title": "Upkeep metric", "description": "Maintain 7-day upload buffer; currently at 2 days queue size", "actionLabel": "Review Pipeline" }
    ],
    "howToKeepUp": [
      { "id": "keep-1", "title": "Bio-Performance Sync", "description": "Sleep is low (5/10), matching a slowdown in script velocity. Rest today.", "actionLabel": "Review Scorecard" }
    ]
  }
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
Biometrics Scorecard: ${JSON.stringify(scorecard)}
Recent Production Activities: ${JSON.stringify(activities?.slice(0, 5) || [])}
Recent Video Telemetry Data: ${JSON.stringify(videoContext)}
Generate the prioritized action plan and detailed directives categorized by What to Do, What is Done, What to Chase, What to Maintain, and How to Keep Up. Include correlations between well-being/activities and channel performance in 'howToKeepUp'.`;

  try {
    const rawContent = await callOpenAI(apiKey, systemPrompt, userPrompt);
    const cleanJSON = rawContent.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleanJSON);
  } catch (e) {
    console.error("AI Action Plan generation crash, falling back:", e);
    return {
      priority: {
        title: 'Review production buffer',
        description: 'Complete the editing cycle for your next queued video topic to secure a 7-day safety buffer.',
        actionLabel: 'Check Pipeline',
        badge: 'Next Action'
      },
      directives: {
        whatToDo: [
          {
            id: 'fb-do-1',
            title: 'Upload Pace Alert',
            description: 'A thin schedule lane indicates a consistency drop risk if the upcoming recording gets delayed.',
            actionLabel: 'Schedule Now'
          }
        ],
        whatIsDone: [
          {
            id: 'fb-done-1',
            title: 'System Initialized',
            description: 'Creator operating system loaded with clean live database connections.',
            actionLabel: 'View Logs'
          }
        ],
        whatToChase: [
          {
            id: 'fb-chase-1',
            title: 'Chase Subscriber Target',
            description: 'Maintain watch time parameters to chase next milestone target.',
            actionLabel: 'View Forecasting'
          }
        ],
        whatToMaintain: [
          {
            id: 'fb-maint-1',
            title: 'Maintain Upload Flow',
            description: 'Ensure 1 upload target per week is met to support baseline discovery.',
            actionLabel: 'Review Pipeline'
          }
        ],
        howToKeepUp: [
          {
            id: 'fb-keep-1',
            title: 'Hydration Target Low',
            description: 'Hydration metrics drop indicates focus bandwidth latency. Drink 500ml water.',
            actionLabel: 'Check Bio Scorecard'
          }
        ]
      }
    };
  }
}

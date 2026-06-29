// Client-side OpenAI API integration service

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

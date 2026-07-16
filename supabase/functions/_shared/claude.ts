// Shared Claude call helper. Reads ANTHROPIC_API_KEY from Supabase Edge
// Function Secrets, sends a Messages API request, returns the text content.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Sonnet 4.5 is the current recommended model for balanced reasoning + speed.
// If the model name is retired, update here in one place.
const MODEL = "claude-sonnet-4-5-20250929";

export interface ClaudeCallInput {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export async function callClaude(input: ClaudeCallInput): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set in edge function secrets");
  }

  const body = {
    model: MODEL,
    max_tokens: input.maxTokens ?? 2048,
    temperature: input.temperature ?? 0.2,
    system: input.system,
    messages: [
      {
        role: "user",
        content: input.user,
      },
    ],
  };

  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${errText}`);
  }

  const json = await resp.json();
  const text = json?.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error(
      `Unexpected Anthropic response shape: ${JSON.stringify(json).slice(0, 500)}`,
    );
  }
  return text;
}

// Claude tends to wrap JSON in ```json ... ``` fences. This strips them if
// present. If the model returns plain JSON, this is a no-op.
export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenceRe = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
  const m = trimmed.match(fenceRe);
  return m ? m[1].trim() : trimmed;
}

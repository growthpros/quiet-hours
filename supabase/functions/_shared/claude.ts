const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5-20250929";

export interface ClaudeCallInput { system: string; user: string; maxTokens?: number; temperature?: number; }
function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

export class ClaudeError extends Error {
  stopReason: string | null;
  constructor(message: string, stopReason: string | null = null) {
    super(message);
    this.stopReason = stopReason;
  }
}

export async function callClaude(input: ClaudeCallInput): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in edge function secrets");
  const body = { model: MODEL, max_tokens: input.maxTokens ?? 2048, temperature: input.temperature ?? 0.2, system: input.system, messages: [{ role: "user", content: input.user }] };
  const maxAttempts = 3;
  let lastErr = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey, "content-type": "application/json", "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (resp.ok) {
      const json = await resp.json();
      const text = json?.content?.[0]?.text;
      if (typeof text === "string") return text;
      const stopReason = json?.stop_reason ?? "unknown";
      const contentPreview = JSON.stringify(json?.content ?? json).slice(0, 300);
      throw new ClaudeError(`Claude returned no text (stop_reason=${stopReason}). Content: ${contentPreview}`, stopReason);
    }
    const errText = await resp.text();
    lastErr = `Anthropic ${resp.status}: ${errText.slice(0, 400)}`;
    const transient = resp.status === 429 || resp.status === 529 || (resp.status >= 500 && resp.status < 600);
    if (!transient || attempt === maxAttempts) throw new Error(lastErr);
    await sleep(500 * Math.pow(3, attempt - 1));
  }
  throw new Error(lastErr || "Claude call failed after retries");
}

export function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenceRe = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
  const m = trimmed.match(fenceRe);
  return m ? m[1].trim() : trimmed;
}

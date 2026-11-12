// Checks what the app sends the coach, before anything goes to the AI.
// Pure code with no Deno or network parts, so the app's tests can run it.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CoachRequest {
  messages: ChatMessage[];
  summary: string;
  day: string; // the person's local date, YYYY-MM-DD
}

/** One message can be long, but not a whole document. */
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_SUMMARY_CHARS = 12000;
/** Only the most recent part of a very long conversation goes to the AI. */
export const MAX_HISTORY = 40;

/** The checked request, or the reason it can't be used. */
export function readRequest(body: unknown): CoachRequest | { problem: string } {
  if (!body || typeof body !== "object") return { problem: "Nothing was sent." };
  const b = body as Record<string, unknown>;

  if (typeof b.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.day)) {
    return { problem: "The day is missing." };
  }
  if (typeof b.summary !== "string") return { problem: "The day summary is missing." };
  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    return { problem: "There's no message to answer." };
  }

  const messages: ChatMessage[] = [];
  for (const [i, m] of b.messages.entries()) {
    if (!m || typeof m !== "object") return { problem: "A message couldn't be read." };
    const { role, content } = m as Record<string, unknown>;
    const expected = i % 2 === 0 ? "user" : "assistant";
    if (role !== expected) return { problem: "The conversation is out of order." };
    if (typeof content !== "string" || content.trim() === "") return { problem: "A message is empty." };
    if (content.length > MAX_MESSAGE_CHARS) return { problem: "A message is too long to send." };
    messages.push({ role: expected, content: content.trim() });
  }
  if (messages[messages.length - 1].role !== "user") return { problem: "There's no message to answer." };

  return { messages, summary: b.summary.slice(0, MAX_SUMMARY_CHARS), day: b.day };
}

/**
 * The recent part of a long conversation, starting with one of the
 * person's messages (the AI needs the person to speak first).
 */
export function recentHistory(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_HISTORY) return messages;
  let start = messages.length - MAX_HISTORY;
  if (messages[start].role !== "user") start += 1;
  return messages.slice(start);
}

/** A day within one day of today in UTC: every time zone's today, nothing else. */
export function isTodaySomewhere(day: string, nowMs: number): boolean {
  const d = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(d)) return false;
  const utcToday = Date.parse(`${new Date(nowMs).toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.abs(d - utcToday) <= 86400000;
}

/**
 * The app's voice rules, as a safety net under the prompt: no em or en
 * dashes, and no spaced hyphen standing in for one ("right now - frozen").
 * A hyphen that starts a list line is left alone.
 */
export function tidyReply(text: string): string {
  return text
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/(\S) - (?=\S)/g, "$1, ")
    .replace(/!+/g, ".")
    .replace(/, ([.,])/g, "$1")
    .trim();
}

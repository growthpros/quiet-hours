// Talking to the coach ("Talk it through", part 1), and the one
// conversation in progress.
//
// The conversation in progress lives in this tab's memory: it stays while
// the person moves around the app (so checking Tasks mid-conversation
// doesn't lose it) and is gone when the tab closes, the page reloads, they
// press "Start over", or someone else signs in. A kept conversation is also
// saved as it goes (lib/coach-history.ts), so it can be opened again later.

import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { toReadableError } from "@/lib/tasks-data";

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export type CoachAnswer =
  | { kind: "reply"; reply: string; sentToday: number }
  | { kind: "limit"; sentToday: number };

/** Send the conversation so far (ending with the person's message) and get the coach's reply. */
export async function askCoach(input: {
  messages: CoachMessage[];
  summary: string;
  day: string;
}): Promise<CoachAnswer> {
  const { data, error } = await supabase.functions.invoke("coach", { body: input });
  if (error) throw toReadableError(error, "The coach couldn't reply just now");
  if (data && typeof data === "object") {
    if ("reply" in data && typeof data.reply === "string") {
      return { kind: "reply", reply: data.reply, sentToday: Number(data.sentToday ?? 0) };
    }
    if ("limit" in data && data.limit) return { kind: "limit", sentToday: Number(data.sentToday ?? 0) };
    if ("error" in data) throw new Error(String(data.error));
  }
  throw new Error("The coach couldn't reply just now. Please try again in a moment.");
}

/** How many coach messages the person has sent on their local day (0 if none). */
export async function coachSentToday(day: string): Promise<number> {
  const { data, error } = await supabase.from("coach_usage").select("messages").eq("day", day).maybeSingle();
  if (error) throw toReadableError(error, "Couldn't check today's coach messages");
  return Number(data?.messages ?? 0);
}

// ---------- The conversation in progress (this tab only) ----------
//
// If the person keeps it (part 2, lib/coach-history.ts), it also has the id
// of its saved copy and how many of its messages are saved so far. "keep"
// is null until they flip the switch, meaning it follows their Settings
// choice.

export interface Conversation {
  messages: CoachMessage[];
  conversationId: number | null;
  savedCount: number;
  keep: boolean | null;
}

const EMPTY: Conversation = { messages: [], conversationId: null, savedCount: 0, keep: null };

let owner: string | null = null;
let current: Conversation = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const conversation = {
  /** This person's conversation; empty if the tab's conversation was someone else's. */
  get(userId: string | null): Conversation {
    return owner === userId ? current : EMPTY;
  },
  set(userId: string | null, next: Partial<Conversation>) {
    const base = owner === userId ? current : EMPTY;
    owner = userId;
    current = { ...base, ...next };
    emit();
  },
  clear() {
    owner = null;
    current = EMPTY;
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useConversation(userId: string | null): Conversation {
  return useSyncExternalStore(conversation.subscribe, () => conversation.get(userId));
}

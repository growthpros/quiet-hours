// Talking to the coach ("Talk it through", part 1), and the one
// conversation in progress.
//
// Nothing is saved in part 1. The conversation lives in this tab's memory:
// it stays while the person moves around the app (so checking Tasks
// mid-conversation doesn't lose it) and is gone when the tab closes, the
// page reloads, they press "Start over", or someone else signs in.

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

let owner: string | null = null;
let messages: CoachMessage[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const conversation = {
  /** The messages for this person; empty if the tab's conversation was someone else's. */
  get(userId: string | null): CoachMessage[] {
    return owner === userId ? messages : EMPTY;
  },
  set(userId: string | null, next: CoachMessage[]) {
    owner = userId;
    messages = next;
    emit();
  },
  clear() {
    owner = null;
    messages = EMPTY;
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

const EMPTY: CoachMessage[] = [];

export function useConversation(userId: string | null): CoachMessage[] {
  return useSyncExternalStore(conversation.subscribe, () => conversation.get(userId));
}

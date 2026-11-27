// Kept coach conversations ("Talk it through", part 2; migration 020).
//
// Caroline's decisions (Nov 9): each person chooses whether to keep their
// conversations, off by default; kept ones last 30 days, 90 days or until
// they delete them; any one can be deleted, or all; a pinned one stays past
// its 30 or 90 days. How long is measured from the last message.
//
// The rules about what goes when live here as plain functions, so the
// Settings card can say exactly what a change will delete before it's made.
// The nightly clean-up in the database (coach_cleanup, migration 020) uses
// the same rule.

import { supabase } from "@/lib/supabase";
import { toReadableError } from "@/lib/tasks-data";
import type { CoachMessage } from "@/lib/coach-data";

export type KeepSetting = "off" | "30" | "90" | "forever";

export const KEEP_CHOICES: { value: KeepSetting; label: string }[] = [
  { value: "off", label: "Don't keep" },
  { value: "30", label: "Keep for 30 days" },
  { value: "90", label: "Keep for 90 days" },
  { value: "forever", label: "Keep until I delete them" },
];

const DAY_MS = 86400000;

export interface ConversationRow {
  id: number;
  user_id: string;
  title: string;
  pinned: boolean;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: number;
  conversation_id: number;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
}

export function keeps(setting: KeepSetting | null | undefined): boolean {
  return setting === "30" || setting === "90" || setting === "forever";
}

/** How many days a setting keeps conversations, or null for "until I delete" (and for off). */
export function keepDays(setting: KeepSetting | null | undefined): number | null {
  return setting === "30" ? 30 : setting === "90" ? 90 : null;
}

/** The conversations a setting would delete now: all of them for off, the old unpinned ones for 30 or 90. */
export function wouldDelete<T extends Pick<ConversationRow, "pinned" | "updated_at">>(
  conversations: T[],
  setting: KeepSetting,
  now: number,
): T[] {
  if (setting === "off") return conversations;
  const days = keepDays(setting);
  if (days == null) return [];
  return conversations.filter((c) => !c.pinned && Number(c.updated_at) < now - days * DAY_MS);
}

/** The line under the message box about whether this conversation is kept. */
export function keepNote(setting: KeepSetting | null | undefined, keepThis: boolean): string {
  if (!keeps(setting)) return "This conversation isn't saved. It's gone when you close this tab or press Start over.";
  if (!keepThis) return "Not keeping this one. It's gone when you close this tab or press Start over.";
  const days = keepDays(setting);
  return days
    ? `Kept for ${days} days after your last message, unless you pin it. You can delete it any time.`
    : "Kept until you delete it.";
}

/** The list's name for a conversation: the first line of the person's first message. */
export function titleFrom(text: string): string {
  const first = text.split("\n").map((l) => l.trim()).find((l) => l !== "") ?? "Conversation";
  return first.length > 80 ? `${first.slice(0, 77).trimEnd()}...` : first;
}

/** "Mon, Nov 9" */
export function listDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** How many days are left before an unpinned conversation goes, or null when it isn't going. */
export function daysLeft(
  c: Pick<ConversationRow, "pinned" | "updated_at">,
  setting: KeepSetting | null | undefined,
  now: number,
): number | null {
  const days = keepDays(setting);
  if (days == null || c.pinned) return null;
  return Math.max(0, Math.ceil((Number(c.updated_at) + days * DAY_MS - now) / DAY_MS));
}

// ---------- Reading and writing ----------

export async function listConversations(): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from("coach_conversations")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw toReadableError(error, "Couldn't load your kept conversations");
  return (data ?? []) as ConversationRow[];
}

export async function loadMessages(conversationId: number): Promise<CoachMessage[]> {
  const { data, error } = await supabase
    .from("coach_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: true });
  if (error) throw toReadableError(error, "Couldn't open that conversation");
  return (data ?? []) as CoachMessage[];
}

/**
 * Saves the messages not saved yet. Starts the conversation on its first
 * save. Returns the conversation's id.
 */
export async function saveMessages(input: {
  conversationId: number | null;
  messages: CoachMessage[];
  savedCount: number;
}): Promise<number> {
  const now = Date.now();
  let id = input.conversationId;
  if (id == null) {
    const firstUser = input.messages.find((m) => m.role === "user");
    const { data, error } = await supabase
      .from("coach_conversations")
      .insert({ title: titleFrom(firstUser?.content ?? ""), created_at: now, updated_at: now })
      .select("id")
      .single();
    if (error) throw toReadableError(error, "Couldn't keep this conversation");
    id = Number(data.id);
  }
  const fresh = input.messages.slice(input.savedCount);
  if (fresh.length > 0) {
    const { error } = await supabase.from("coach_messages").insert(
      fresh.map((m, i) => ({ conversation_id: id, role: m.role, content: m.content, created_at: now + i })),
    );
    if (error) throw toReadableError(error, "Couldn't keep this conversation");
    const touch = await supabase.from("coach_conversations").update({ updated_at: now }).eq("id", id);
    if (touch.error) throw toReadableError(touch.error, "Couldn't keep this conversation");
  }
  return id;
}

export async function setPinned(id: number, pinned: boolean): Promise<void> {
  const { error } = await supabase.from("coach_conversations").update({ pinned }).eq("id", id);
  if (error) throw toReadableError(error, "Couldn't change that");
}

/** Deletes conversations (their messages go with them). */
export async function deleteConversations(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("coach_conversations").delete().in("id", ids);
  if (error) throw toReadableError(error, "Couldn't delete that");
}

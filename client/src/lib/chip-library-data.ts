// Data-layer helpers for the personal chip library.
// Every user has their own library of custom chips for 'pull', 'body',
// 'symptom' and future categories. Adds appear alongside curated chips
// on multi-select surfaces. Hidden curated ones can also be stored here.

import { supabase } from "@/lib/supabase";

export type ChipCategory = "pull" | "body" | "symptom" | "other";

export interface ChipRow {
  id: number;
  user_id: string;
  category: ChipCategory;
  label: string;
  hidden: boolean;
  created_at: number;
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

export async function listChips(category?: ChipCategory): Promise<ChipRow[]> {
  let q = supabase.from("user_chip_library").select("*").order("created_at", { ascending: true });
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ChipRow[];
}

// Idempotent: returns the row whether newly-created or already there.
export async function addChip(category: ChipCategory, rawLabel: string): Promise<ChipRow> {
  const user_id = await requireUserId();
  const label = rawLabel.trim().toLowerCase();
  if (!label) throw new Error("Label is empty");

  // Try insert; if unique conflict, fetch and return existing.
  const { data: inserted, error: insErr } = await supabase
    .from("user_chip_library")
    .insert({
      user_id,
      category,
      label,
      hidden: false,
      created_at: Date.now(),
    })
    .select()
    .maybeSingle();

  if (inserted) return inserted as ChipRow;

  // On conflict, read the existing row.
  if (insErr && String(insErr.code) === "23505") {
    const { data: existing, error: readErr } = await supabase
      .from("user_chip_library")
      .select("*")
      .eq("user_id", user_id)
      .eq("category", category)
      .eq("label", label)
      .single();
    if (readErr) throw readErr;
    if (existing) return existing as ChipRow;
  }
  if (insErr) throw insErr;
  throw new Error("Unexpected chip add outcome");
}

export async function deleteChip(id: number): Promise<void> {
  const { error } = await supabase
    .from("user_chip_library")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function renameChip(id: number, newLabel: string): Promise<ChipRow> {
  const label = newLabel.trim().toLowerCase();
  if (!label) throw new Error("Label is empty");
  const { data, error } = await supabase
    .from("user_chip_library")
    .update({ label })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ChipRow;
}

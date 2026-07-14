// Tasks and Brain Dump data helpers.
// Separate from data.ts to keep concerns isolated. RLS on Supabase scopes
// everything to the current user automatically.

import { supabase } from "@/lib/supabase";

// ---------- Row shapes ----------

export interface TaskRow {
  id: number;
  user_id: string;
  title: string;
  notes: string | null;
  spoon_estimate: number | null;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface BrainDumpRow {
  id: number;
  user_id: string;
  content: string;
  created_at: number;
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

// ---------- Tasks ----------

export async function listTasks(): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TaskRow[];
}

export async function createTask(input: {
  title: string;
  notes?: string | null;
  spoonEstimate?: number | null;
}): Promise<TaskRow> {
  const user_id = await requireUserId();
  const now = Date.now();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id,
      title: input.title,
      notes: input.notes ?? null,
      spoon_estimate: input.spoonEstimate ?? null,
      completed_at: null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TaskRow;
}

export async function updateTask(
  id: number,
  patch: {
    title?: string;
    notes?: string | null;
    spoonEstimate?: number | null;
    completed?: boolean;
  },
): Promise<TaskRow> {
  const dbPatch: Record<string, unknown> = { updated_at: Date.now() };
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.spoonEstimate !== undefined) {
    dbPatch.spoon_estimate = patch.spoonEstimate;
  }
  if (patch.completed !== undefined) {
    dbPatch.completed_at = patch.completed ? Date.now() : null;
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(dbPatch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as TaskRow;
}

export async function deleteTask(id: number): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Committed-spoons helper ----------
// Sum of spoon_estimate across incomplete tasks. Used to decide whether
// adding a new task would push today past budget.
export async function committedSpoonsFromTasks(): Promise<number> {
  const { data, error } = await supabase
    .from("tasks")
    .select("spoon_estimate, completed_at")
    .is("completed_at", null);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    spoon_estimate: number | null;
    completed_at: number | null;
  }>;
  return rows.reduce(
    (acc, r) => acc + (r.spoon_estimate ? Number(r.spoon_estimate) : 0),
    0,
  );
}

// ---------- Brain Dump ----------

export async function listBrainDumps(): Promise<BrainDumpRow[]> {
  const { data, error } = await supabase
    .from("brain_dumps")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BrainDumpRow[];
}

export async function createBrainDump(content: string): Promise<BrainDumpRow> {
  const user_id = await requireUserId();
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Brain dump can't be empty.");
  const { data, error } = await supabase
    .from("brain_dumps")
    .insert({
      user_id,
      content: trimmed,
      created_at: Date.now(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as BrainDumpRow;
}

export async function deleteBrainDump(id: number): Promise<void> {
  const { error } = await supabase.from("brain_dumps").delete().eq("id", id);
  if (error) throw error;
}

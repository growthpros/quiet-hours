// Tasks and Brain Dump data helpers.
// Separate from data.ts to keep concerns isolated. RLS on Supabase scopes
// everything to the current user automatically.

import { supabase } from "@/lib/supabase";

// ---------- Row shapes ----------

export type Complexity = "low" | "medium" | "high";
export type DueBucket =
  | "today"
  | "this_week"
  | "next_week"
  | "this_month"
  | "this_quarter"
  | "later";

export const DUE_BUCKET_LABEL: Record<DueBucket, string> = {
  today: "Today",
  this_week: "This week",
  next_week: "Next week",
  this_month: "This month",
  this_quarter: "This quarter",
  later: "Later",
};

export interface TaskRow {
  id: number;
  user_id: string;
  title: string;
  notes: string | null;
  spoon_estimate: number | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  complexity: Complexity | null;
  due_date: string | null; // ISO date, YYYY-MM-DD
  due_bucket: DueBucket | null;
  billable: boolean;
  client_id: number | null;
  project_id: number | null;
  completion_reason: string | null;
  rolled_from_date: string | null;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}

// Shape of an AI-parsed item as returned by the parse-brain-dump edge function.
// Stored inside brain_dumps.parsed_items as a JSONB array.
export interface ParsedTaskItem {
  title: string;
  notes?: string;
  spoon_estimate?: number;
  estimated_hours?: number;
  complexity?: Complexity;
  billable?: boolean;
  break_down_hint?: boolean; // AI suggests this is big enough to split
}

export interface BrainDumpRow {
  id: number;
  user_id: string;
  content: string;
  parsed_items: ParsedTaskItem[] | null;
  processed_indices: number[];
  skipped_indices: number[];
  parsed_at: number | null;
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

export interface CreateTaskInput {
  title: string;
  notes?: string | null;
  spoonEstimate?: number | null;
  estimatedHours?: number | null;
  complexity?: Complexity | null;
  dueDate?: string | null; // YYYY-MM-DD
  dueBucket?: DueBucket | null;
  billable?: boolean;
  clientId?: number | null;
  projectId?: number | null;
}

export async function createTask(input: CreateTaskInput): Promise<TaskRow> {
  const user_id = await requireUserId();
  const now = Date.now();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id,
      title: input.title,
      notes: input.notes ?? null,
      spoon_estimate: input.spoonEstimate ?? null,
      estimated_hours: input.estimatedHours ?? null,
      complexity: input.complexity ?? null,
      due_date: input.dueDate ?? null,
      due_bucket: input.dueBucket ?? "today", // Default to today
      billable: input.billable ?? false,
      client_id: input.clientId ?? null,
      project_id: input.projectId ?? null,
      completed_at: null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TaskRow;
}

export interface UpdateTaskPatch {
  title?: string;
  notes?: string | null;
  spoonEstimate?: number | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
  complexity?: Complexity | null;
  dueDate?: string | null;
  dueBucket?: DueBucket | null;
  billable?: boolean;
  clientId?: number | null;
  projectId?: number | null;
  completionReason?: string | null;
  completed?: boolean;
}

export async function updateTask(
  id: number,
  patch: UpdateTaskPatch,
): Promise<TaskRow> {
  const dbPatch: Record<string, unknown> = { updated_at: Date.now() };
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.spoonEstimate !== undefined)
    dbPatch.spoon_estimate = patch.spoonEstimate;
  if (patch.estimatedHours !== undefined)
    dbPatch.estimated_hours = patch.estimatedHours;
  if (patch.actualHours !== undefined) dbPatch.actual_hours = patch.actualHours;
  if (patch.complexity !== undefined) dbPatch.complexity = patch.complexity;
  if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate;
  if (patch.dueBucket !== undefined) dbPatch.due_bucket = patch.dueBucket;
  if (patch.billable !== undefined) dbPatch.billable = patch.billable;
  if (patch.clientId !== undefined) dbPatch.client_id = patch.clientId;
  if (patch.projectId !== undefined) dbPatch.project_id = patch.projectId;
  if (patch.completionReason !== undefined)
    dbPatch.completion_reason = patch.completionReason;
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

// ---------- Brain Dump AI-parse workflow ----------

// Invoke the parse-brain-dump edge function. It calls Claude, which returns
// a JSON array of ParsedTaskItem. We store the result on the brain_dump row.
export async function parseBrainDump(id: number): Promise<BrainDumpRow> {
  // Fetch the content first
  const { data: dump, error: fetchErr } = await supabase
    .from("brain_dumps")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr) throw fetchErr;

  // Call the edge function
  const { data: result, error: fnErr } = await supabase.functions.invoke(
    "parse-brain-dump",
    {
      body: {
        content: (dump as BrainDumpRow).content,
      },
    },
  );
  if (fnErr) throw fnErr;
  const items: ParsedTaskItem[] = Array.isArray(result?.items) ? result.items : [];

  // Persist the parse
  const { data: updated, error: updErr } = await supabase
    .from("brain_dumps")
    .update({
      parsed_items: items,
      parsed_at: Date.now(),
      // Reset processing state so the user can review from the start.
      processed_indices: [],
      skipped_indices: [],
    })
    .eq("id", id)
    .select()
    .single();
  if (updErr) throw updErr;
  return updated as BrainDumpRow;
}

// Break down a single task into smaller sub-tasks via Claude.
// Returns an array of ParsedTaskItem that the caller can splice into the
// review flow or commit directly.
export async function breakDownTask(input: {
  title: string;
  notes?: string | null;
}): Promise<ParsedTaskItem[]> {
  const { data, error } = await supabase.functions.invoke(
    "break-down-task",
    {
      body: { title: input.title, notes: input.notes ?? null },
    },
  );
  if (error) throw error;
  return Array.isArray(data?.items) ? (data.items as ParsedTaskItem[]) : [];
}

// Mark specific parsed_items as processed (i.e. promoted to a real task).
export async function markBrainDumpProcessed(
  brainDumpId: number,
  index: number,
): Promise<void> {
  // Read-modify-write. Cheap because the array is small.
  const { data: current, error: fetchErr } = await supabase
    .from("brain_dumps")
    .select("processed_indices")
    .eq("id", brainDumpId)
    .single();
  if (fetchErr) throw fetchErr;
  const current_indices: number[] =
    (current as { processed_indices: number[] })?.processed_indices ?? [];
  if (current_indices.includes(index)) return;
  const next = [...current_indices, index];
  const { error } = await supabase
    .from("brain_dumps")
    .update({ processed_indices: next })
    .eq("id", brainDumpId);
  if (error) throw error;
}

export async function markBrainDumpSkipped(
  brainDumpId: number,
  index: number,
): Promise<void> {
  const { data: current, error: fetchErr } = await supabase
    .from("brain_dumps")
    .select("skipped_indices")
    .eq("id", brainDumpId)
    .single();
  if (fetchErr) throw fetchErr;
  const current_indices: number[] =
    (current as { skipped_indices: number[] })?.skipped_indices ?? [];
  if (current_indices.includes(index)) return;
  const next = [...current_indices, index];
  const { error } = await supabase
    .from("brain_dumps")
    .update({ skipped_indices: next })
    .eq("id", brainDumpId);
  if (error) throw error;
}

// Convenience: how many parsed items are still unprocessed on this dump.
export function remainingItemCount(dump: BrainDumpRow): number {
  if (!dump.parsed_items) return 0;
  const done = new Set([
    ...(dump.processed_indices ?? []),
    ...(dump.skipped_indices ?? []),
  ]);
  return dump.parsed_items.filter((_, i) => !done.has(i)).length;
}

// ---------- Rollover ----------

// Roll incomplete tasks with due_bucket='today' whose updated_at is before
// the start of the current local day forward. Idempotent: sets
// rolled_from_date to yesterday's date the first time we see the task on
// a new day; won't double-roll within the same day.
export async function rollOverPreviousTodayTasks(): Promise<number> {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const yesterday = new Date(startOfToday);
  yesterday.setDate(yesterday.getDate() - 1);
  const yyyyMmDdYesterday = yesterday.toISOString().slice(0, 10);

  // Find incomplete tasks in 'today' bucket whose updated_at is before
  // startOfToday AND whose rolled_from_date isn't already yyyyMmDdYesterday
  // (defensive against double-rolls if the client fires twice).
  const { data, error } = await supabase
    .from("tasks")
    .update({
      rolled_from_date: yyyyMmDdYesterday,
      updated_at: Date.now(),
    })
    .is("completed_at", null)
    .eq("due_bucket", "today")
    .lt("updated_at", startOfToday.getTime())
    .neq("rolled_from_date", yyyyMmDdYesterday)
    .select();
  if (error) throw error;
  return (data ?? []).length;
}

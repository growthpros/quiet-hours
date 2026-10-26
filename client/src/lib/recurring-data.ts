// Recurring task templates: CRUD + shared types.
//
// Instances are generated on-demand by lib/recurring-resolver.ts,
// which is what actually creates rows in the tasks table with
// recurring_template_id set.

import { DEFAULT_EFFORT } from "@/lib/spoon-cost";
import { supabase } from "@/lib/supabase";
import type { Complexity } from "@/lib/tasks-data";

// ---------- Enums (mirror the Postgres enums in migration 010) ----------

export type RecurringPatternType = "daily" | "weekly" | "monthly" | "custom";

export type RecurringMonthlyKind = "day_of_month" | "nth_weekday";

export type RecurringOnMiss = "let_it_go" | "ask_me" | "always_roll";

// ---------- Row shape ----------

export interface RecurringTemplateRow {
  id: number;
  user_id: string;

  // Task-shape fields inherited by each generated instance
  title: string;
  notes: string | null;
  // The person's own number for each repeat; null means work it out.
  spoon_estimate: number | null;
  estimated_hours: number;
  complexity: Complexity;
  social_load: boolean;
  dread: boolean;
  billable: boolean;
  client_id: number | null;
  project_id: number | null;
  tag_ids: number[];

  // Pattern
  pattern_type: RecurringPatternType;
  interval_n: number;
  days_of_week: number[]; // 0=Sun..6=Sat, used for weekly
  monthly_kind: RecurringMonthlyKind | null;
  day_of_month: number | null;
  nth_weekday: number | null;
  nth_weekday_day: number | null;

  // Window
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  end_after_n: number | null;
  occurrences_generated: number;

  // Bookkeeping
  last_generated_for: string | null;

  // Miss policy
  on_miss: RecurringOnMiss;

  // Pause toggle
  active: boolean;

  created_at: string;
  updated_at: string;
}

// Human-readable labels for the UI
export const PATTERN_LABEL: Record<RecurringPatternType, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

export const ON_MISS_LABEL: Record<RecurringOnMiss, string> = {
  let_it_go: "Let it go",
  ask_me: "Ask me",
  always_roll: "Always roll into today",
};

export const ON_MISS_DESCRIPTION: Record<RecurringOnMiss, string> = {
  let_it_go:
    "Missed instances stay in history as Not completed. No prompt, no roll forward.",
  ask_me:
    "On app load, a gentle prompt asks whether to move each missed item to today.",
  always_roll: "Missed instances silently move to today.",
};

// Sensible default on_miss for each pattern type. Daily habits typically
// don't need to roll forward. Weekly/monthly commitments do.
export function defaultOnMiss(
  pattern: RecurringPatternType,
): RecurringOnMiss {
  return pattern === "daily" ? "let_it_go" : "ask_me";
}

// ---------- Read ----------

export async function listRecurringTemplates(): Promise<RecurringTemplateRow[]> {
  const { data, error } = await supabase
    .from("recurring_task_templates")
    .select("*")
    .order("active", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RecurringTemplateRow[];
}

export async function getRecurringTemplate(
  id: number,
): Promise<RecurringTemplateRow | null> {
  const { data, error } = await supabase
    .from("recurring_task_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as RecurringTemplateRow | null) ?? null;
}

// ---------- Write ----------

export interface CreateRecurringInput {
  title: string;
  notes?: string | null;
  spoon_estimate?: number | null;
  estimated_hours?: number;
  complexity?: Complexity;
  social_load?: boolean;
  dread?: boolean;
  billable?: boolean;
  client_id?: number | null;
  project_id?: number | null;
  tag_ids?: number[];

  pattern_type: RecurringPatternType;
  interval_n?: number;
  days_of_week?: number[];
  monthly_kind?: RecurringMonthlyKind | null;
  day_of_month?: number | null;
  nth_weekday?: number | null;
  nth_weekday_day?: number | null;

  start_date: string;
  end_date?: string | null;
  end_after_n?: number | null;

  on_miss?: RecurringOnMiss;
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

export async function createRecurringTemplate(
  input: CreateRecurringInput,
): Promise<RecurringTemplateRow> {
  const user_id = await requireUserId();
  const row = {
    user_id,
    title: input.title,
    notes: input.notes ?? null,
    spoon_estimate: input.spoon_estimate ?? null,
    estimated_hours: input.estimated_hours ?? 0.5,
    complexity: input.complexity ?? DEFAULT_EFFORT,
    social_load: input.social_load ?? false,
    dread: input.dread ?? false,
    billable: input.billable ?? false,
    client_id: input.client_id ?? null,
    project_id: input.project_id ?? null,
    tag_ids: input.tag_ids ?? [],

    pattern_type: input.pattern_type,
    interval_n: input.interval_n ?? 1,
    days_of_week: input.days_of_week ?? [],
    monthly_kind: input.monthly_kind ?? null,
    day_of_month: input.day_of_month ?? null,
    nth_weekday: input.nth_weekday ?? null,
    nth_weekday_day: input.nth_weekday_day ?? null,

    start_date: input.start_date,
    end_date: input.end_date ?? null,
    end_after_n: input.end_after_n ?? null,

    on_miss: input.on_miss ?? defaultOnMiss(input.pattern_type),
    active: true,
  };
  const { data, error } = await supabase
    .from("recurring_task_templates")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data as RecurringTemplateRow;
}

export type UpdateRecurringPatch = Partial<
  Omit<
    RecurringTemplateRow,
    "id" | "user_id" | "created_at" | "updated_at" | "occurrences_generated" | "last_generated_for"
  >
>;

export async function updateRecurringTemplate(
  id: number,
  patch: UpdateRecurringPatch,
): Promise<RecurringTemplateRow> {
  const { data, error } = await supabase
    .from("recurring_task_templates")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as RecurringTemplateRow;
}

// Session 3.3.1 change per Caroline's Jul 27 review:
// After editing a template, propagate the task-shape fields to every
// INCOMPLETE instance of that template. Completed history rows are
// left alone so past reports stay accurate.
//
// Only task-shape fields are copied: title, notes, spoons, hours,
// complexity, billable. Not touched: due_date (each instance keeps
// its scheduled date), completed_at, actual_hours, completion_reason,
// due_bucket, client_id/project_id (those can drift per-instance if
// the user edits them individually), and any pattern fields (those
// are template-only).
//
// Returns the count of tasks touched so the toast can tell the user.
export async function propagateTemplateEditsToIncompleteTasks(
  templateId: number,
  values: {
    title: string;
    notes: string | null;
    spoon_estimate: number | null;
    estimated_hours: number;
    complexity: Complexity;
    social_load: boolean;
    dread: boolean;
    billable: boolean;
  },
): Promise<number> {
  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: values.title,
      notes: values.notes,
      spoon_estimate: values.spoon_estimate,
      estimated_hours: values.estimated_hours,
      complexity: values.complexity,
      social_load: values.social_load,
      dread: values.dread,
      billable: values.billable,
      updated_at: Date.now(),
    })
    .eq("recurring_template_id", templateId)
    .is("completed_at", null)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

// Deleting a template does NOT delete already-generated instances. The
// FK on tasks.recurring_template_id is ON DELETE SET NULL, so past
// history remains intact but orphan-linked.
export async function deleteRecurringTemplate(id: number): Promise<void> {
  const { error } = await supabase
    .from("recurring_task_templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function setRecurringActive(
  id: number,
  active: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("recurring_task_templates")
    .update({ active })
    .eq("id", id);
  if (error) throw error;
}

// ---------- Pattern description helpers ----------

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const NTH_WORD = ["", "1st", "2nd", "3rd", "4th", "5th"];

// Plain-English pattern description for lists and detail views.
// Keeps the voice rules: no em dashes, no exclamation marks.
export function describePattern(t: RecurringTemplateRow): string {
  switch (t.pattern_type) {
    case "daily":
      return t.interval_n === 1 ? "Every day" : `Every ${t.interval_n} days`;
    case "weekly": {
      if (t.days_of_week.length === 0) {
        return t.interval_n === 1
          ? "Every week"
          : `Every ${t.interval_n} weeks`;
      }
      const sorted = [...t.days_of_week].sort((a, b) => a - b);
      const labels = sorted.map((d) => WEEKDAY_SHORT[d]).join(", ");
      return t.interval_n === 1
        ? `Every week on ${labels}`
        : `Every ${t.interval_n} weeks on ${labels}`;
    }
    case "monthly": {
      if (t.monthly_kind === "day_of_month" && t.day_of_month) {
        return `Every month on the ${ordinal(t.day_of_month)}`;
      }
      if (
        t.monthly_kind === "nth_weekday" &&
        t.nth_weekday &&
        t.nth_weekday_day !== null
      ) {
        return `Every month on the ${NTH_WORD[t.nth_weekday]} ${WEEKDAY_SHORT[t.nth_weekday_day]}`;
      }
      return "Every month";
    }
    case "custom":
      return t.interval_n === 1
        ? "Every day (custom)"
        : `Every ${t.interval_n} days (custom)`;
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

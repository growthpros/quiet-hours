// Recurring resolver.
//
// Runs on app mount and at midnight rollover. For each active template
// belonging to the current user, computes which dates between
// last_generated_for (or start_date, minus 1) and today should have
// generated an instance, then inserts any missing rows into tasks with
// the correct due_date and inherited fields.
//
// The on_miss policy determines what happens to past-dated instances:
//   - let_it_go:  keep due_date = past date; instance shows in
//                 "Not completed" history when incomplete
//   - ask_me:     same as let_it_go, but the past-due incomplete rows
//                 will be surfaced by the MissedRecurringPrompt on
//                 next app load; the user can choose per-item what
//                 to do
//   - always_roll: collapse all past-due dates for this template into
//                 a single row stamped with due_date = today so the
//                 user just sees today's instance
//
// The (recurring_template_id, due_date) unique index in migration 010
// makes double-insertion impossible; the resolver treats duplicate-key
// errors as no-op.

import { supabase } from "@/lib/supabase";
import type {
  RecurringTemplateRow,
  RecurringOnMiss,
} from "@/lib/recurring-data";

// ---------- Public API ----------

export interface ResolveResult {
  templatesConsidered: number;
  instancesCreated: number;
  // Rows that landed with due_date < today because the template's
  // on_miss policy is 'let_it_go' or 'ask_me'. Consumers can use
  // this to show the "Ask me" prompt.
  missedInstancesCreated: number;
  errors: string[];
}

// The main entry point. Idempotent: safe to call on every app mount.
export async function resolveRecurringInstances(
  today: Date = new Date(),
): Promise<ResolveResult> {
  const result: ResolveResult = {
    templatesConsidered: 0,
    instancesCreated: 0,
    missedInstancesCreated: 0,
    errors: [],
  };

  const { data: templates, error: fetchErr } = await supabase
    .from("recurring_task_templates")
    .select("*")
    .eq("active", true);
  if (fetchErr) {
    result.errors.push(`Fetch templates: ${fetchErr.message}`);
    return result;
  }

  const todayIso = toIsoDate(today);

  for (const t of (templates ?? []) as RecurringTemplateRow[]) {
    result.templatesConsidered++;
    try {
      const per = await resolveOneTemplate(t, todayIso);
      result.instancesCreated += per.created;
      result.missedInstancesCreated += per.missedCreated;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      result.errors.push(`Template ${t.id} (${t.title}): ${message}`);
    }
  }

  return result;
}

// ---------- One-template resolution ----------

interface PerTemplateResult {
  created: number;
  missedCreated: number;
}

async function resolveOneTemplate(
  t: RecurringTemplateRow,
  todayIso: string,
): Promise<PerTemplateResult> {
  const result: PerTemplateResult = { created: 0, missedCreated: 0 };

  // Always sweep lingering past-due incomplete rows for always_roll
  // templates, even before checking end conditions. If a user paused a
  // template that had stragglers, they still shouldn't stay on their
  // original date. This is a no-op when there's nothing lingering.
  if (t.on_miss === "always_roll") {
    await rollLingeringInstancesForward(t, todayIso);
  }

  // If already ended, nothing more to do.
  if (t.end_date && t.end_date < todayIso) return result;
  if (t.end_after_n !== null && t.occurrences_generated >= t.end_after_n) {
    return result;
  }

  // Determine window: from the day AFTER last_generated_for (or start_date
  // itself if never generated) through today (inclusive).
  const startCandidate =
    t.last_generated_for && t.last_generated_for >= t.start_date
      ? addDays(t.last_generated_for, 1)
      : t.start_date;

  if (startCandidate > todayIso) return result;

  const scheduledDates = expandPattern(t, startCandidate, todayIso);
  if (scheduledDates.length === 0) {
    // No hits in this window, but still bump last_generated_for so we
    // don't rescan the same range every load.
    await supabase
      .from("recurring_task_templates")
      .update({ last_generated_for: todayIso })
      .eq("id", t.id);
    return result;
  }

  // Enforce end_after_n if set: only take the first N-so-far dates.
  let toGenerate = scheduledDates;
  if (t.end_after_n !== null) {
    const remaining = Math.max(0, t.end_after_n - t.occurrences_generated);
    toGenerate = scheduledDates.slice(0, remaining);
  }

  // Separate past dates from today. This matters for on_miss handling.
  const pastDates = toGenerate.filter((d) => d < todayIso);
  const todayScheduled = toGenerate.includes(todayIso);

  // Handle past dates per on_miss policy
  if (pastDates.length > 0) {
    if (t.on_miss === "always_roll") {
      // Collapse: create one row stamped today's date, don't fill in
      // past dates. This is deliberate; the user chose "always roll"
      // because they don't want to see each miss individually.
      // Lingering rows were already handled by the sweep above.
      if (!todayScheduled) {
        const ok = await insertInstance(t, todayIso, /*bucket*/ "today");
        if (ok) result.created++;
      }
    } else {
      // let_it_go or ask_me: create real rows on the past dates so
      // "Not completed" history and the ask-me prompt both work.
      for (const d of pastDates) {
        const ok = await insertInstance(t, d, /*bucket*/ null);
        if (ok) {
          result.created++;
          result.missedCreated++;
        }
      }
    }
  }

  if (todayScheduled) {
    const ok = await insertInstance(t, todayIso, /*bucket*/ "today");
    if (ok) result.created++;
  }

  // Bookkeeping
  const updates: Record<string, unknown> = { last_generated_for: todayIso };
  if (result.created > 0) {
    updates.occurrences_generated = t.occurrences_generated + result.created;
  }
  const { error: bookErr } = await supabase
    .from("recurring_task_templates")
    .update(updates)
    .eq("id", t.id);
  if (bookErr) throw bookErr;

  return result;
}

// For an always_roll template, sweep any past-due incomplete instances
// forward to today so they don't linger on their original date. Only
// touches rows whose original due_date is strictly before today AND
// which are still incomplete. Uses a targeted update; the unique index
// on (recurring_template_id, due_date) would reject collisions if
// today's row already exists, so we delete stragglers instead of
// updating when today already has a row.
async function rollLingeringInstancesForward(
  t: RecurringTemplateRow,
  todayIso: string,
): Promise<void> {
  // Fetch past-due incomplete rows for this template.
  const { data: lingering, error: fetchErr } = await supabase
    .from("tasks")
    .select("id, due_date")
    .eq("recurring_template_id", t.id)
    .is("completed_at", null)
    .lt("due_date", todayIso);
  if (fetchErr) throw fetchErr;
  if (!lingering || lingering.length === 0) return;

  // If today's row exists, we need to delete the stragglers (can't
  // update due_date to today because the unique index would collide).
  // If not, update the first straggler to today and delete the rest.
  const { data: todayRow, error: todayErr } = await supabase
    .from("tasks")
    .select("id")
    .eq("recurring_template_id", t.id)
    .eq("due_date", todayIso)
    .maybeSingle();
  if (todayErr) throw todayErr;

  if (todayRow) {
    // Delete all lingering rows; today is already represented.
    const ids = lingering.map((r) => (r as { id: number }).id);
    const { error } = await supabase.from("tasks").delete().in("id", ids);
    if (error) throw error;
  } else {
    // Promote the most recent straggler to today, delete the rest.
    const sorted = [...(lingering as { id: number; due_date: string }[])].sort(
      (a, b) => b.due_date.localeCompare(a.due_date),
    );
    const promoteId = sorted[0].id;
    const restIds = sorted.slice(1).map((r) => r.id);
    const { error: upErr } = await supabase
      .from("tasks")
      .update({ due_date: todayIso, due_bucket: "today" })
      .eq("id", promoteId);
    if (upErr) throw upErr;
    if (restIds.length > 0) {
      const { error: delErr } = await supabase
        .from("tasks")
        .delete()
        .in("id", restIds);
      if (delErr) throw delErr;
    }
  }
}

// Insert a task instance from a template. Returns true if inserted,
// false if the unique index rejected it (already exists for that day)
// or another non-fatal condition.
async function insertInstance(
  t: RecurringTemplateRow,
  dueDate: string,
  bucket: "today" | null,
): Promise<boolean> {
  const row = {
    user_id: t.user_id,
    title: t.title,
    notes: t.notes,
    spoon_estimate: t.spoon_estimate,
    estimated_hours: t.estimated_hours,
    complexity: t.complexity,
    billable: t.billable,
    client_id: t.client_id,
    project_id: t.project_id,
    due_date: dueDate,
    due_bucket: bucket,
    recurring_template_id: t.id,
  };
  const { error } = await supabase.from("tasks").insert(row);
  if (error) {
    // 23505 = unique_violation from the (recurring_template_id, due_date)
    // partial unique index. That means the instance already exists,
    // which is fine and the whole point of the index.
    if ((error as { code?: string }).code === "23505") return false;
    throw error;
  }
  return true;
}

// ---------- Pattern expansion ----------

// Given a template and a date window [fromIso..toIso] inclusive,
// return the list of dates (YYYY-MM-DD) on which an instance should
// be scheduled. Ignores end_after_n; the caller enforces that.
export function expandPattern(
  t: RecurringTemplateRow,
  fromIso: string,
  toIso: string,
): string[] {
  if (fromIso > toIso) return [];
  const from = fromDateIso(fromIso);
  const to = fromDateIso(toIso);
  const start = fromDateIso(t.start_date);
  const endDate = t.end_date ? fromDateIso(t.end_date) : null;

  // Effective window is clamped by start_date and end_date
  const windowFrom = from > start ? from : start;
  const windowTo = endDate && to > endDate ? endDate : to;
  if (windowFrom > windowTo) return [];

  const results: string[] = [];

  switch (t.pattern_type) {
    case "daily":
    case "custom": {
      // Every interval_n days from start_date. Find the first hit
      // >= windowFrom.
      const step = Math.max(1, t.interval_n);
      const daysFromStart = daysBetween(start, windowFrom);
      const remainder = daysFromStart % step;
      const firstOffset = remainder === 0 ? 0 : step - remainder;
      let cursor = addDaysToDate(windowFrom, firstOffset);
      while (cursor <= windowTo) {
        results.push(toIsoDate(cursor));
        cursor = addDaysToDate(cursor, step);
      }
      break;
    }
    case "weekly": {
      // Every interval_n weeks, on the days listed in days_of_week.
      // If days_of_week is empty, fall back to the start_date's weekday.
      const step = Math.max(1, t.interval_n);
      const daysList =
        t.days_of_week.length > 0 ? t.days_of_week : [start.getUTCDay()];

      // Walk day-by-day inside the window. For each candidate, verify:
      //   (a) its weekday is in daysList
      //   (b) the week it falls in is aligned with start_date's week
      //       modulo step (weeks are Sunday-anchored here to match JS)
      const startSundayOfWeek = startOfWeekSunday(start);
      let cursor = new Date(windowFrom);
      while (cursor <= windowTo) {
        if (daysList.includes(cursor.getUTCDay())) {
          const cursorSunday = startOfWeekSunday(cursor);
          const weeksApart = Math.round(
            daysBetween(startSundayOfWeek, cursorSunday) / 7,
          );
          if (weeksApart >= 0 && weeksApart % step === 0) {
            results.push(toIsoDate(cursor));
          }
        }
        cursor = addDaysToDate(cursor, 1);
      }
      break;
    }
    case "monthly": {
      // Walk month-by-month. Every interval_n months from start_date's
      // month, generate the target day.
      const step = Math.max(1, t.interval_n);
      let year = windowFrom.getUTCFullYear();
      let month = windowFrom.getUTCMonth();

      // Back up one month in case the target date in the previous
      // month still falls within window (edge case with day_of_month
      // near month boundaries).
      if (month === 0) {
        year--;
        month = 11;
      } else {
        month--;
      }

      // Cap the loop at 24 months to avoid runaway if something is
      // misconfigured.
      for (let i = 0; i < 24; i++) {
        const targetDate = monthlyTargetDate(t, year, month);
        if (targetDate) {
          const targetIso = toIsoDate(targetDate);
          if (targetIso >= toIsoDate(windowFrom) && targetIso <= toIsoDate(windowTo)) {
            // Verify alignment with start_date's month, mod step
            const monthsApart =
              (year - start.getUTCFullYear()) * 12 +
              (month - start.getUTCMonth());
            if (monthsApart >= 0 && monthsApart % step === 0) {
              results.push(targetIso);
            }
          }
        }
        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
        // Bail once we're past the window
        const boundary = new Date(Date.UTC(year, month, 1));
        if (boundary > windowTo) break;
      }
      break;
    }
  }

  return results.sort();
}

function monthlyTargetDate(
  t: RecurringTemplateRow,
  year: number,
  month: number,
): Date | null {
  if (t.monthly_kind === "day_of_month" && t.day_of_month !== null) {
    // If day-of-month exceeds this month's day count (e.g. 31 in Feb),
    // skip. Deliberate: users who pick 31 don't want silent shifting
    // to Feb 28.
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    if (t.day_of_month > daysInMonth) return null;
    return new Date(Date.UTC(year, month, t.day_of_month));
  }
  if (
    t.monthly_kind === "nth_weekday" &&
    t.nth_weekday !== null &&
    t.nth_weekday_day !== null
  ) {
    // Find the nth occurrence of nth_weekday_day in month
    const first = new Date(Date.UTC(year, month, 1));
    const firstWeekday = first.getUTCDay();
    const offset = (t.nth_weekday_day - firstWeekday + 7) % 7;
    const dayOfMonth = 1 + offset + (t.nth_weekday - 1) * 7;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    if (dayOfMonth > daysInMonth) return null;
    return new Date(Date.UTC(year, month, dayOfMonth));
  }
  return null;
}

// ---------- Date helpers ----------

// All date math here uses UTC to sidestep DST drift within date-only
// calculations. Callers should pass a real Date for "today" but only
// year/month/day get used for scheduling.

export function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(iso: string, n: number): string {
  return toIsoDate(addDaysToDate(fromDateIso(iso), n));
}

function addDaysToDate(d: Date, n: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function startOfWeekSunday(d: Date): Date {
  const day = d.getUTCDay(); // 0..6, Sunday=0
  return addDaysToDate(d, -day);
}

// ---------- Read helpers for the UI ----------

// Missed recurring instances = tasks that came from a template, are
// not yet completed, and whose due_date is before today. Used by the
// "Not completed" history section and by the "Ask me" prompt (filtered
// further to on_miss=ask_me).
export interface MissedRecurringInstance {
  taskId: number;
  templateId: number;
  templateTitle: string;
  onMiss: RecurringOnMiss;
  dueDate: string;
  spoonEstimate: number | null;
  estimatedHours: number | null;
}

export async function listMissedRecurringInstances(
  todayIso: string,
): Promise<MissedRecurringInstance[]> {
  // Left join: templates may have been deleted (recurring_template_id
  // then goes NULL, so this list correctly excludes those orphans).
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, recurring_template_id, due_date, spoon_estimate, estimated_hours, recurring_task_templates!inner(id, title, on_miss)",
    )
    .not("recurring_template_id", "is", null)
    .is("completed_at", null)
    .lt("due_date", todayIso)
    .order("due_date", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: number;
      recurring_template_id: number;
      due_date: string;
      spoon_estimate: number | null;
      estimated_hours: number | null;
      recurring_task_templates: {
        id: number;
        title: string;
        on_miss: RecurringOnMiss;
      };
    };
    return {
      taskId: r.id,
      templateId: r.recurring_template_id,
      templateTitle: r.recurring_task_templates.title,
      onMiss: r.recurring_task_templates.on_miss,
      dueDate: r.due_date,
      spoonEstimate: r.spoon_estimate,
      estimatedHours: r.estimated_hours,
    };
  });
}

// Move a missed instance to today's bucket. Used by the "Ask me" prompt
// when the user picks "Move to today".
export async function rollMissedInstanceToToday(
  taskId: number,
  todayIso: string,
): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ due_date: todayIso, due_bucket: "today" })
    .eq("id", taskId);
  if (error) throw error;
}

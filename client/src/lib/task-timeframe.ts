// Which tasks belong to which part of the calendar.
//
// One place for these rules, so Today, the spoon meter and the Tasks page
// always agree. Dates are plain YYYY-MM-DD strings in the person's local
// day (see local-date.ts). Weeks start on Sunday, the app's convention.

import { addLocalDays, localIsoDate } from "@/lib/local-date";
import type { TaskRow } from "@/lib/tasks-data";

export type Timeframe =
  | "today"
  | "tomorrow"
  | "this_week"
  | "next_week"
  | "this_month"
  | "all"
  | "date";

type TaskLike = Pick<
  TaskRow,
  "completed_at" | "archived_at" | "due_date" | "due_bucket" | "recurring_template_id"
>;

function isOpen(t: TaskLike): boolean {
  return t.completed_at == null && t.archived_at == null;
}

// A task whose date has passed without being done.
// Recurring repeats keep their date, so a past repeat is missed. A one-off
// task in the Today bucket is carried over instead, so it isn't missed.
export function isMissed(t: TaskLike, todayIso: string): boolean {
  if (!isOpen(t)) return false;
  if (!t.due_date || t.due_date >= todayIso) return false;
  if (t.recurring_template_id != null) return true;
  return t.due_bucket !== "today";
}

// A task that belongs to today: open, and either due today, or in the
// Today bucket (including one carried over from an earlier day).
export function isOnToday(t: TaskLike, todayIso: string): boolean {
  if (!isOpen(t)) return false;
  if (t.due_date) {
    if (t.due_date === todayIso) return true;
    return t.due_date < todayIso && !isMissed(t, todayIso);
  }
  return t.due_bucket === "today";
}

// Sunday-to-Saturday ranges, as YYYY-MM-DD strings.
export function weekRange(todayIso: string, weeksAhead = 0): { start: string; end: string } {
  const today = new Date(`${todayIso}T12:00:00`);
  const sunday = addLocalDays(today, -today.getDay() + 7 * weeksAhead);
  return { start: localIsoDate(sunday), end: localIsoDate(addLocalDays(sunday, 6)) };
}

function inRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

// Does a task show under a timeframe on the Tasks page?
//   today:      on today
//   tomorrow:   due tomorrow
//   date:       due on the picked date (on that day, includes missed ones)
//   this_week:  on today, or the rest of this week (date or bucket)
//   next_week:  next week (date or bucket)
//   this_month: on today, or the rest of this month (date, this week, or month bucket)
//   all:        any open task
export function matchesTimeframe(
  t: TaskLike,
  tf: Timeframe,
  todayIso: string,
  pickedDate?: string,
): boolean {
  if (!isOpen(t)) return false;
  if (tf === "all") return true;
  if (tf === "date") {
    if (!pickedDate) return false;
    if (pickedDate === todayIso) return isOnToday(t, todayIso);
    return t.due_date === pickedDate;
  }
  if (isMissed(t, todayIso)) return false;
  if (tf === "tomorrow") return t.due_date === localIsoDate(addLocalDays(new Date(`${todayIso}T12:00:00`), 1));

  const today = isOnToday(t, todayIso);
  if (tf === "today") return today;

  const thisWeek = weekRange(todayIso, 0);
  const nextWeek = weekRange(todayIso, 1);

  if (tf === "this_week") {
    if (today || t.due_bucket === "this_week") return true;
    return !!t.due_date && inRange(t.due_date, todayIso, thisWeek.end);
  }
  if (tf === "next_week") {
    if (!t.due_date) return t.due_bucket === "next_week";
    return inRange(t.due_date, nextWeek.start, nextWeek.end);
  }
  if (tf === "this_month") {
    if (today || t.due_bucket === "this_week" || t.due_bucket === "this_month") return true;
    // "Next week" counts as this month when next week starts this month.
    if (t.due_bucket === "next_week" && nextWeek.start.slice(0, 7) === todayIso.slice(0, 7)) {
      return !t.due_date;
    }
    if (!t.due_date) return false;
    return t.due_date >= todayIso && t.due_date.slice(0, 7) === todayIso.slice(0, 7);
  }
  return true;
}

// Spoons committed today: the spoon estimates of today's unfinished tasks.
// Tasks for later days don't count against today's budget.
export function committedSpoonsToday(
  tasks: (TaskLike & Pick<TaskRow, "spoon_estimate">)[],
  todayIso: string,
): number {
  return tasks
    .filter((t) => isOnToday(t, todayIso))
    .reduce((sum, t) => sum + (t.spoon_estimate != null ? Number(t.spoon_estimate) : 0), 0);
}

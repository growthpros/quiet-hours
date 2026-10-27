// Which tasks belong to which part of the calendar.
//
// One place for these rules, so Today, the spoon meter and the Tasks page
// always agree. Dates are plain YYYY-MM-DD strings in the person's local
// day (see local-date.ts). Weeks start on the person's chosen day
// (Sunday by default; see user_profiles.week_starts_on).

import { spoonsOf, type SpoonTask } from "@/lib/spoon-cost";
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

// Day 0 is Sunday, 1 Monday, 6 Saturday.
export type WeekStartDay = 0 | 1 | 6;

// A seven-day week containing todayIso (or N weeks ahead), as YYYY-MM-DD
// strings, starting on the person's chosen day.
export function weekRange(
  todayIso: string,
  weeksAhead = 0,
  weekStartsOn: WeekStartDay = 0,
): { start: string; end: string } {
  const today = new Date(`${todayIso}T12:00:00`);
  const back = (today.getDay() - weekStartsOn + 7) % 7;
  const first = addLocalDays(today, -back + 7 * weeksAhead);
  return { start: localIsoDate(first), end: localIsoDate(addLocalDays(first, 6)) };
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
  weekStartsOn: WeekStartDay = 0,
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

  const thisWeek = weekRange(todayIso, 0, weekStartsOn);
  const nextWeek = weekRange(todayIso, 1, weekStartsOn);

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

// Spoons committed today: the spoons of today's unfinished tasks (typed,
// or worked out from time and effort). Later days don't count.
export function committedSpoonsToday(
  tasks: (TaskLike & SpoonTask)[],
  todayIso: string,
): number {
  return tasks
    .filter((t) => isOnToday(t, todayIso))
    .reduce((sum, t) => sum + spoonsOf(t), 0);
}

// Lays tasks out across a week for the Calendar page.
//
// Each day shows the tasks dated that day. Today also shows the Today
// bucket (including carried-over tasks), using the same rule as the
// Today page. Tasks with a timeframe but no day go in "Not scheduled yet".
//
// Repeats only become real tasks when their day arrives (see
// recurring-resolver.ts), so future days also show "coming up" previews
// worked out from each active repeat's pattern. Previews can't be moved
// or ticked off yet; they become ordinary tasks on the day.

import { isMissed, isOnToday, weekRange, type WeekStartDay } from "@/lib/task-timeframe";
import { isoAddDays } from "@/lib/task-move";
import { expandPattern } from "@/lib/recurring-resolver";
import type { DueBucket, TaskRow } from "@/lib/tasks-data";
import type { RecurringTemplateRow } from "@/lib/recurring-data";

export type DayItemStatus = "open" | "done" | "missed";

export interface DayItem {
  task: TaskRow;
  status: DayItemStatus;
}

export interface CalendarDay {
  iso: string;
  isToday: boolean;
  isPast: boolean;
  items: DayItem[];
  /** Repeats scheduled for this future day that don't exist as tasks yet. */
  upcoming: RecurringTemplateRow[];
  /** Open tasks plus upcoming repeats. */
  openCount: number;
  openSpoons: number;
  openHours: number;
}

export type UnscheduledGroup = Exclude<DueBucket, "today"> | "anytime";

export const UNSCHEDULED_ORDER: UnscheduledGroup[] = [
  "this_week",
  "next_week",
  "this_month",
  "this_quarter",
  "later",
  "anytime",
];

export const UNSCHEDULED_LABEL: Record<UnscheduledGroup, string> = {
  this_week: "This week",
  next_week: "Next week",
  this_month: "This month",
  this_quarter: "This quarter",
  later: "Later",
  anytime: "No timeframe",
};

export interface CalendarWeek {
  start: string;
  end: string;
  days: CalendarDay[];
  unscheduled: { group: UnscheduledGroup; tasks: TaskRow[] }[];
}

function statusOf(t: TaskRow, todayIso: string): DayItemStatus {
  if (t.completed_at != null) return "done";
  if (isMissed(t, todayIso)) return "missed";
  return "open";
}

export function groupWeek(
  tasks: TaskRow[],
  todayIso: string,
  weekStartsOn: WeekStartDay = 0,
  weeksAhead = 0,
  templates: RecurringTemplateRow[] = [],
): CalendarWeek {
  const { start, end } = weekRange(todayIso, weeksAhead, weekStartsOn);
  return {
    start,
    end,
    days: groupDays(tasks, todayIso, start, end, templates),
    unscheduled: groupUnscheduled(tasks),
  };
}

// Every day from start to end (inclusive), with its tasks and upcoming
// repeats. Shared by the week and month views.
export function groupDays(
  tasks: TaskRow[],
  todayIso: string,
  start: string,
  end: string,
  templates: RecurringTemplateRow[] = [],
): CalendarDay[] {
  const live = tasks.filter((t) => t.archived_at == null);
  const upcomingByDay = upcomingRepeats(templates, tasks, todayIso, start, end);
  const days: CalendarDay[] = [];
  for (let iso = start; iso <= end; iso = isoAddDays(iso, 1)) {
    const isToday = iso === todayIso;
    const onDay = live.filter((t) => {
      const carriedToToday =
        t.completed_at == null && isOnToday(t, todayIso) && t.due_date !== todayIso;
      // Today also holds the Today bucket and carried-over tasks.
      if (isToday) return t.due_date === iso || carriedToToday;
      // A carried-over task lives on today, not on its old day.
      return t.due_date === iso && !carriedToToday;
    });
    const items = onDay
      .map((task) => ({ task, status: statusOf(task, todayIso) }))
      .sort((a, b) => rank(a.status) - rank(b.status));
    const open = items.filter((i) => i.status === "open").map((i) => i.task);
    const upcoming = upcomingByDay.get(iso) ?? [];
    days.push({
      iso,
      isToday,
      isPast: iso < todayIso,
      items,
      upcoming,
      openCount: open.length + upcoming.length,
      openSpoons:
        sum(open, (t) => t.spoon_estimate) + sum(upcoming, (t) => t.spoon_estimate),
      openHours:
        sum(open, (t) => t.estimated_hours) + sum(upcoming, (t) => t.estimated_hours),
    });
  }
  return days;
}

// Tasks with a timeframe but no day, in timeframe order.
export function groupUnscheduled(tasks: TaskRow[]): CalendarWeek["unscheduled"] {
  const groups = new Map<UnscheduledGroup, TaskRow[]>();
  for (const t of tasks) {
    if (t.archived_at != null || t.completed_at != null || t.due_date) continue;
    if (t.due_bucket === "today") continue; // shown on today's day
    const group: UnscheduledGroup = t.due_bucket ?? "anytime";
    groups.set(group, [...(groups.get(group) ?? []), t]);
  }
  return UNSCHEDULED_ORDER.filter((g) => groups.has(g)).map((group) => ({
    group,
    tasks: groups.get(group)!,
  }));
}

export interface MonthCell {
  day: CalendarDay;
  inMonth: boolean;
}

export interface CalendarMonth {
  /** First and last day of the month itself. */
  start: string;
  end: string;
  /** Whole weeks covering the month, for the person's week start. */
  weeks: MonthCell[][];
}

// The month holding anchorIso, laid out in whole weeks.
export function groupMonth(
  tasks: TaskRow[],
  todayIso: string,
  anchorIso: string,
  weekStartsOn: WeekStartDay = 0,
  templates: RecurringTemplateRow[] = [],
): CalendarMonth {
  const start = `${anchorIso.slice(0, 7)}-01`;
  const [y, m] = anchorIso.split("-").map(Number);
  const end = `${anchorIso.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  const gridStart = weekRange(start, 0, weekStartsOn).start;
  const gridEnd = weekRange(end, 0, weekStartsOn).end;
  const days = groupDays(tasks, todayIso, gridStart, gridEnd, templates);
  const weeks: MonthCell[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(
      days.slice(i, i + 7).map((day) => ({ day, inMonth: day.iso >= start && day.iso <= end })),
    );
  }
  return { start, end, weeks };
}

/** Month offset of a date from today's month (for the month arrows). */
export function addMonths(iso: string, n: number): string {
  const [y, m] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

// How many weeks ahead (or back, if negative) the week holding dateIso is
// from the week holding today, for the person's week start.
export function weeksAheadFor(
  todayIso: string,
  dateIso: string,
  weekStartsOn: WeekStartDay = 0,
): number {
  const a = weekRange(todayIso, 0, weekStartsOn).start;
  const b = weekRange(dateIso, 0, weekStartsOn).start;
  const days = Math.round(
    (Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) -
      Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) /
      86_400_000,
  );
  return Math.round(days / 7);
}

// Future occurrences of each active repeat inside [start..end], after
// today. Skips a day that already has a real task for that repeat, and
// stops at the repeat's end date or occurrence limit.
export function upcomingRepeats(
  templates: RecurringTemplateRow[],
  tasks: TaskRow[],
  todayIso: string,
  start: string,
  end: string,
): Map<string, RecurringTemplateRow[]> {
  const out = new Map<string, RecurringTemplateRow[]>();
  const tomorrow = isoAddDays(todayIso, 1);
  if (end < tomorrow) return out;
  const existing = new Set(
    tasks
      .filter((t) => t.recurring_template_id != null && t.due_date)
      .map((t) => `${t.recurring_template_id}:${t.due_date}`),
  );
  for (const t of templates) {
    if (!t.active) continue;
    // Count from tomorrow so the occurrence limit lines up with what the
    // resolver will actually create.
    let dates = expandPattern(t, tomorrow, end);
    if (t.end_after_n != null) {
      dates = dates.slice(0, Math.max(0, t.end_after_n - t.occurrences_generated));
    }
    for (const d of dates) {
      if (d < start || existing.has(`${t.id}:${d}`)) continue;
      out.set(d, [...(out.get(d) ?? []), t]);
    }
  }
  return out;
}

// Open first, then missed, then done.
function rank(s: DayItemStatus): number {
  return s === "open" ? 0 : s === "missed" ? 1 : 2;
}

function sum<T>(ts: T[], pick: (t: T) => number | null): number {
  return ts.reduce((acc, t) => {
    const v = pick(t);
    return acc + (v != null ? Number(v) : 0);
  }, 0);
}

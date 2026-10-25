// "Repeats coming up" on the Tasks page.
//
// Repeats only become real tasks on their day (see recurring-resolver.ts),
// so a future day or range on the Tasks page would otherwise look lighter
// than it is. This works out which repeats fall in the chosen timeframe,
// using the same rule as the Calendar (upcomingRepeats in calendar-week.ts),
// so the two pages always agree.

import { upcomingRepeats } from "@/lib/calendar-week";
import { weekRange, type Timeframe, type WeekStartDay } from "@/lib/task-timeframe";
import { isoAddDays } from "@/lib/task-move";
import type { RecurringTemplateRow } from "@/lib/recurring-data";
import type { TaskRow } from "@/lib/tasks-data";

export interface Window {
  start: string;
  end: string;
}

/** The days a timeframe covers, or null when coming-up repeats don't apply. */
export function timeframeWindow(
  tf: Timeframe,
  todayIso: string,
  pickedDate: string | undefined,
  weekStartsOn: WeekStartDay = 0,
): Window | null {
  switch (tf) {
    case "tomorrow": {
      const d = isoAddDays(todayIso, 1);
      return { start: d, end: d };
    }
    case "this_week":
      return weekRange(todayIso, 0, weekStartsOn);
    case "next_week":
      return weekRange(todayIso, 1, weekStartsOn);
    case "this_month":
      return { start: todayIso, end: lastDayOfMonth(todayIso) };
    case "date":
      // Today's repeats already exist as tasks; past days have no previews.
      return pickedDate && pickedDate > todayIso ? { start: pickedDate, end: pickedDate } : null;
    default:
      // "today" (already real tasks) and "all" (open-ended).
      return null;
  }
}

export interface UpcomingRepeat {
  template: RecurringTemplateRow;
  count: number;
}

/** Each repeat that falls in the window, once, with how many times. */
export function upcomingInWindow(
  templates: RecurringTemplateRow[],
  tasks: TaskRow[],
  todayIso: string,
  window: Window,
): UpcomingRepeat[] {
  const byDay = upcomingRepeats(templates, tasks, todayIso, window.start, window.end);
  const counts = new Map<number, UpcomingRepeat>();
  for (const day of Array.from(byDay.keys()).sort()) {
    for (const t of byDay.get(day)!) {
      const hit = counts.get(t.id);
      if (hit) hit.count++;
      else counts.set(t.id, { template: t, count: 1 });
    }
  }
  return Array.from(counts.values());
}

function lastDayOfMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  // Day 0 of next month is the last day of this month.
  const days = new Date(y, m, 0).getDate();
  return `${iso.slice(0, 7)}-${String(days).padStart(2, "0")}`;
}

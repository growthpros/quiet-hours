// Moving a task to another day or timeframe.
//
// A task has one answer to "when": either a timeframe (due_bucket) or a
// specific day (due_date), never both. Moving sets one and clears the other.
//
// Repeats are different: a repeat's date ties it to its schedule. A repeat
// occurrence can move only to a day before its next scheduled occurrence,
// so the app never ends up with two copies in the same stretch of time.

import { expandPattern } from "@/lib/recurring-resolver";
import type { RecurringTemplateRow } from "@/lib/recurring-data";
import type { DueBucket } from "@/lib/tasks-data";

export type MoveChoice =
  | "today"
  | "tomorrow"
  | "this_week"
  | "next_week"
  | "this_month"
  | "this_quarter"
  | "later";

export const MOVE_CHOICES: MoveChoice[] = [
  "today",
  "tomorrow",
  "this_week",
  "next_week",
  "this_month",
  "this_quarter",
  "later",
];

export const MOVE_LABEL: Record<MoveChoice, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This week",
  next_week: "Next week",
  this_month: "This month",
  this_quarter: "This quarter",
  later: "Later",
};

export interface When {
  dueDate: string | null;
  dueBucket: DueBucket | null;
}

// Plain calendar-day math on YYYY-MM-DD strings.
export function isoAddDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Pure calendar math on a date with no time of day, so UTC is safe here.
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

export function whenForChoice(choice: MoveChoice, todayIso: string): When {
  if (choice === "today") return { dueDate: null, dueBucket: "today" };
  if (choice === "tomorrow") return { dueDate: isoAddDays(todayIso, 1), dueBucket: null };
  return { dueDate: null, dueBucket: choice };
}

export function whenForDate(iso: string): When {
  return { dueDate: iso, dueBucket: null };
}

// "Moved to next week." / "Moved to Tue, Oct 27."
export function describeWhen(w: When, todayIso: string): string {
  if (w.dueDate) {
    if (w.dueDate === todayIso) return "today";
    if (w.dueDate === isoAddDays(todayIso, 1)) return "tomorrow";
    const [y, m, d] = w.dueDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  if (w.dueBucket && w.dueBucket in MOVE_LABEL) {
    return MOVE_LABEL[w.dueBucket as MoveChoice].toLowerCase();
  }
  return "later";
}

// The days a repeat occurrence may move to, inclusive, or null when it
// can't move at all (for example a daily repeat).
//   earliest: the day after the occurrence, but never before today
//   latest:   the day before the next scheduled occurrence
// If the schedule has ended, there's no next occurrence; allow up to 60 days.
export function repeatMoveWindow(
  template: RecurringTemplateRow,
  occurrenceIso: string,
  todayIso: string,
): { earliest: string; latest: string } | null {
  const dayAfter = isoAddDays(occurrenceIso, 1);
  const next = expandPattern(template, dayAfter, isoAddDays(occurrenceIso, 400))[0];
  const latest = next ? isoAddDays(next, -1) : isoAddDays(occurrenceIso, 60);
  const earliest = dayAfter > todayIso ? dayAfter : todayIso;
  return earliest <= latest ? { earliest, latest } : null;
}

// Which quick choices make sense for a repeat occurrence: only specific
// days inside its window, so Today and Tomorrow at most.
export function repeatQuickChoices(
  window: { earliest: string; latest: string } | null,
  todayIso: string,
): MoveChoice[] {
  if (!window) return [];
  const out: MoveChoice[] = [];
  const inWindow = (iso: string) => iso >= window.earliest && iso <= window.latest;
  if (inWindow(todayIso)) out.push("today");
  if (inWindow(isoAddDays(todayIso, 1))) out.push("tomorrow");
  return out;
}

// For a repeat, "Today" means today's date (repeats always keep a date).
export function whenForRepeatChoice(choice: "today" | "tomorrow", todayIso: string): When {
  return {
    dueDate: choice === "today" ? todayIso : isoAddDays(todayIso, 1),
    dueBucket: null,
  };
}

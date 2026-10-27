// How many spoons a day has, and whether a day's plan goes over them.
//
// Today: the budget from this morning's check-in plus anything earned back.
// Before the check-in, and for future days, the app uses "your usual": the
// middle value of your last 14 check-in budgets (12, the app's starting
// point, until there are any). A future day's real budget is set by that
// day's check-in, when the app knows more.
//
// Task costs come from spoon-cost.ts (typed, or time × effort). This file
// only decides how they're compared with the day's budget.

import { spoonsOf, type SpoonTask as CostTask } from "@/lib/spoon-cost";
import { committedSpoonsToday } from "@/lib/task-timeframe";
import { localIsoDate } from "@/lib/local-date";
import type { TaskRow } from "@/lib/tasks-data";

/** The app's starting budget before there's any check-in history. */
export const STARTING_BUDGET = 12;
/** How many recent check-in budgets "your usual" looks at. */
export const USUAL_WINDOW = 14;

/** The middle value of the most recent budgets, to the nearest half spoon. */
export function usualBudget(recentAllotments: number[]): number {
  const values = recentAllotments
    .map(Number)
    .filter((v) => Number.isFinite(v) && v > 0)
    .slice(0, USUAL_WINDOW)
    .sort((a, b) => a - b);
  if (values.length === 0) return STARTING_BUDGET;
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  return Math.round(median * 2) / 2;
}

export interface LedgerNumbers {
  allotted: number;
  spent: number;
  earned_back: number;
}

/** Today's spoons: the check-in budget (or your usual before it) plus earned back. */
export function todayBudget(
  ledger: LedgerNumbers | null | undefined,
  usual: number,
): { budget: number; fromCheckin: boolean } {
  const allotted = ledger ? Number(ledger.allotted) : 0;
  const earned = ledger ? Number(ledger.earned_back) : 0;
  return allotted > 0
    ? { budget: allotted + earned, fromCheckin: true }
    : { budget: usual + earned, fromCheckin: false };
}

type SpoonTask = CostTask &
  Pick<TaskRow, "completed_at" | "due_date" | "due_bucket" | "archived_at" | "recurring_template_id">;

/** Spoons already used today: logged spending plus tasks finished today. */
export function spentToday(tasks: SpoonTask[], ledgerSpent: number, todayIso: string): number {
  const finished = tasks
    .filter(
      (t) =>
        t.completed_at != null &&
        localIsoDate(new Date(Number(t.completed_at))) === todayIso,
    )
    .reduce((sum, t) => sum + spoonsOf(t), 0);
  return Number(ledgerSpent || 0) + finished;
}

/** Everything today is carrying: spent so far plus today's unfinished tasks. */
export function todayLoad(tasks: SpoonTask[], ledgerSpent: number, todayIso: string): number {
  return spentToday(tasks, ledgerSpent, todayIso) + committedSpoonsToday(tasks, todayIso);
}

/**
 * How far over today's budget adding `spoons` more would go (0 if it fits).
 * Pass the task list as it is before the change.
 */
export function spoonsOverIfAdded(
  tasks: SpoonTask[],
  ledger: LedgerNumbers | null | undefined,
  usual: number,
  todayIso: string,
  spoons: number,
): number {
  if (!(spoons > 0)) return 0;
  const { budget } = todayBudget(ledger, usual);
  const over = todayLoad(tasks, ledger ? Number(ledger.spent) : 0, todayIso) + spoons - budget;
  return over > 0 ? Math.round(over * 100) / 100 : 0;
}

/** A day's plan compared with its budget, for the Calendar. */
export interface DayBudget {
  budget: number;
  load: number;
  over: boolean;
  /** "checkin" for today after the check-in; "usual" otherwise. */
  basis: "checkin" | "usual";
}

export function dayBudget(
  day: { iso: string; isToday: boolean; isPast: boolean; openSpoons: number },
  tasks: SpoonTask[],
  ledger: LedgerNumbers | null | undefined,
  usual: number,
): DayBudget | null {
  // Days that are already over get no amber: that would read as a grade.
  if (day.isPast) return null;
  if (day.isToday) {
    const { budget, fromCheckin } = todayBudget(ledger, usual);
    const load = spentToday(tasks, ledger ? Number(ledger.spent) : 0, day.iso) + day.openSpoons;
    return { budget, load, over: load > budget, basis: fromCheckin ? "checkin" : "usual" };
  }
  return { budget: usual, load: day.openSpoons, over: day.openSpoons > usual, basis: "usual" };
}

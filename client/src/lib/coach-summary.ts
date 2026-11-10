// What the coach knows about the person's day ("Talk it through").
//
// With each message the coach gets a short summary of today, so its advice
// fits the day the person is actually having. The person doesn't see it.
//
// What goes in, and what stays out (plan v1, "What the coach knows"):
//   - In: spoons, the latest check-in's state and scales, how many body
//     signals (not which), the phase, today's tasks and steps with spoons
//     and time, this week's tasks, and the overall estimate pattern.
//   - Out: check-in notes, compassion entries, task notes, profile details.
//     The most personal writing stays out of the AI request unless the
//     person types it into the chat themselves.
//
// The rules for "on today", "missed" and "this week" come from
// task-timeframe.ts, and only the smallest pieces count (task-steps.ts), so
// the coach sees the same day the Today page and the spoon meter show.

import type { BurnoutCheckinRow } from "@/lib/supabase";
import type { TaskRow } from "@/lib/tasks-data";
import { spoonsOf } from "@/lib/spoon-cost";
import { spentToday, todayBudget, type LedgerNumbers } from "@/lib/spoon-budget";
import { committedSpoonsToday, isMissed, isOnToday, matchesTimeframe, type WeekStartDay } from "@/lib/task-timeframe";
import { countable } from "@/lib/task-steps";
import { localIsoDate } from "@/lib/local-date";
import { phaseLabel } from "@/lib/phases";
import { ENERGY_SCALE, SENSORY_SCALE, parseSymptoms } from "@/lib/burnout-utils";
import { hoursPhrase, overallPattern } from "@/lib/estimate-history";

/** Lists are capped so a very full day doesn't make every message slow and costly. */
export const MAX_TODAY = 25;
export const MAX_WEEK = 15;

export interface SummaryInput {
  tasks: TaskRow[];
  ledger: LedgerNumbers | null;
  usual: number;
  checkins: Pick<BurnoutCheckinRow, "energy" | "sensory" | "symptoms" | "state" | "created_at">[];
  phase: string | null | undefined;
  todayIso: string;
  now: number;
  weekStartsOn: WeekStartDay;
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/** One line, no line breaks, not too long: titles are the person's own words. */
function clean(title: string): string {
  const one = title.replace(/\s+/g, " ").trim();
  return one.length > 120 ? `${one.slice(0, 117)}...` : one;
}

function scaleLabel(scale: { v: number; label: string }[], v: number): string {
  return scale.find((s) => s.v === Math.round(v))?.label ?? String(v);
}

function ago(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return "less than an hour ago";
  const hours = Math.round(mins / 60);
  return hours === 1 ? "about 1 hour ago" : `about ${hours} hours ago`;
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function spoonsPhrase(s: number): string {
  return `${num(s)} spoon${s === 1 ? "" : "s"}`;
}

export function daySummary(input: SummaryInput): string {
  const { tasks, ledger, usual, checkins, todayIso, now, weekStartsOn } = input;
  const lines: string[] = [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const partOf = (t: TaskRow) => {
    const parent = t.parent_task_id != null ? byId.get(t.parent_task_id) : undefined;
    return parent ? `, part of "${clean(parent.title)}"` : "";
  };

  const day = new Date(`${todayIso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  lines.push(`Today is ${day}.`);

  // Spoons
  const { budget, fromCheckin } = todayBudget(ledger, usual);
  const spent = spentToday(tasks, ledger ? Number(ledger.spent) : 0, todayIso);
  const committed = committedSpoonsToday(tasks, todayIso);
  const left = budget - spent - committed;
  const basis = fromCheckin ? "from today's check-in" : "their usual day, no check-in yet";
  lines.push(
    `Spoons: ${num(budget)} today (${basis}), ${num(committed)} committed to open tasks, ${num(spent)} spent, ` +
      (left >= 0 ? `${num(left)} free.` : `${num(-left)} over.`),
  );

  // Latest check-in today
  const todays = checkins
    .filter((c) => localIsoDate(new Date(Number(c.created_at))) === todayIso)
    .sort((a, b) => Number(b.created_at) - Number(a.created_at));
  const latest = todays[0];
  if (latest) {
    const state = latest.state ? latest.state[0].toUpperCase() + latest.state.slice(1) : "No state chosen";
    const signals = parseSymptoms(latest.symptoms).length;
    lines.push(
      `Latest check-in: ${state}, energy "${scaleLabel(ENERGY_SCALE, Number(latest.energy))}", ` +
        `sensory "${scaleLabel(SENSORY_SCALE, Number(latest.sensory))}", ` +
        `${signals} body signal${signals === 1 ? "" : "s"}, ${ago(now - Number(latest.created_at))}.`,
    );
  } else {
    lines.push("Latest check-in: none yet today.");
  }

  lines.push(`Phase: ${phaseLabel(input.phase) ?? "not set"}.`);

  // Today's pieces, then missed ones, then the rest of this week
  const pieces = countable(tasks);
  const onToday = pieces.filter((t) => isOnToday(t, todayIso));
  const missed = pieces.filter((t) => isMissed(t, todayIso));
  const week = pieces.filter(
    (t) => !isOnToday(t, todayIso) && matchesTimeframe(t, "this_week", todayIso, undefined, weekStartsOn),
  );

  const list = (title: string, rows: TaskRow[], max: number, line: (t: TaskRow) => string) => {
    if (rows.length === 0) {
      lines.push(`${title}: nothing.`);
      return;
    }
    lines.push(`${title}:`);
    for (const t of rows.slice(0, max)) lines.push(`- ${line(t)}`);
    if (rows.length > max) lines.push(`- and ${rows.length - max} more`);
  };

  list("On today", onToday, MAX_TODAY, (t) => {
    const hours = t.estimated_hours != null && Number(t.estimated_hours) > 0 ? `, ${hoursPhrase(Number(t.estimated_hours))}` : "";
    return `${clean(t.title)} (${spoonsPhrase(spoonsOf(t))}${hours}${partOf(t)})`;
  });
  if (missed.length > 0) {
    list("Missed (set for an earlier day, not done)", missed, MAX_TODAY, (t) =>
      `${clean(t.title)} (was set for ${shortDate(t.due_date!)}${partOf(t)})`,
    );
  }
  list("Coming up this week", week, MAX_WEEK, (t) => `${clean(t.title)} (${spoonsPhrase(spoonsOf(t))}${partOf(t)})`);

  const pattern = overallPattern(tasks);
  lines.push(
    pattern
      ? `How long things take them: actual time is usually about ${pattern.ratio} times their estimate (going by ${pattern.count} finished tasks).`
      : "How long things take them: not enough finished tasks to say yet.",
  );

  return lines.join("\n");
}

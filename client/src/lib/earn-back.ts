// Earn-back rules that don't touch the database (spoon model change 3).
//
// - The updated starting list: which built-in actions differ from it, and
//   what switching over would change. Switching only touches built-in
//   actions; the person's own items and their on/off and star choices stay.
// - Checking a new or edited action before it's saved.
// - The pattern notice: earn-back making room for more than an ordinary
//   okay day, on several days in one week.

import { DEFAULT_EARN_BACK, type DefaultEarnBack } from "@/lib/spoon-defaults";

export interface ActionLike {
  id: number;
  action_key: string;
  label: string;
  spoon_value: number | string;
  daily_cap: number | string;
  duration_min_minutes: number | string | null;
}

export interface DefaultsUpdate {
  /** Built-in actions whose label, spoons, times a day or minutes will change. */
  changes: { id: number; label: string; spoonValue: number; dailyCap: number; durationMinMinutes: number | null }[];
  /** Built-in actions the person doesn't have yet. */
  missing: DefaultEarnBack[];
}

function num(v: number | string | null): number | null {
  return v == null || v === "" ? null : Number(v);
}

export function updatedDefaults(actions: ActionLike[]): DefaultsUpdate {
  const byKey = new Map(actions.map((a) => [a.action_key, a]));
  const changes: DefaultsUpdate["changes"] = [];
  const missing: DefaultEarnBack[] = [];
  for (const d of DEFAULT_EARN_BACK) {
    const a = byKey.get(d.actionKey);
    if (!a) {
      missing.push(d);
      continue;
    }
    const differs =
      a.label !== d.label ||
      num(a.spoon_value) !== d.spoonValue ||
      num(a.daily_cap) !== d.dailyCap ||
      num(a.duration_min_minutes) !== d.durationMinMinutes;
    if (differs) {
      changes.push({
        id: a.id,
        label: d.label,
        spoonValue: d.spoonValue,
        dailyCap: d.dailyCap,
        durationMinMinutes: d.durationMinMinutes,
      });
    }
  }
  return { changes, missing };
}

export const MAX_EARN_BACK_VALUE = 5;
export const MAX_TIMES_A_DAY = 10;

/** An error message for a new or edited action, or null when it's fine. */
export function earnBackActionError(v: {
  label: string;
  spoonValue: string;
  dailyCap: string;
  minutes: string;
}): string | null {
  if (!v.label.trim()) return "Give it a name.";
  const value = Number(v.spoonValue);
  if (v.spoonValue.trim() === "" || !Number.isFinite(value) || value <= 0 || value > MAX_EARN_BACK_VALUE) {
    return `Spoons back can be anything from 0.5 to ${MAX_EARN_BACK_VALUE}.`;
  }
  if (Math.round(value * 2) !== value * 2) return "Spoons back go in half-spoon steps, like 0.5 or 1.5.";
  const cap = Number(v.dailyCap);
  if (v.dailyCap.trim() === "" || !Number.isInteger(cap) || cap < 1 || cap > MAX_TIMES_A_DAY) {
    return `Times a day can be a whole number from 1 to ${MAX_TIMES_A_DAY}.`;
  }
  if (v.minutes.trim() !== "") {
    const m = Number(v.minutes);
    if (!Number.isInteger(m) || m < 1 || m > 240) return "Minutes needed can be a whole number from 1 to 240, or blank.";
  }
  return null;
}

// ---------- Pattern notice ----------

/** Earned back at least this share of the day's spoons counts toward the pattern. */
export const PATTERN_EARNED_SHARE = 0.25;
/** How many days in the last 7 make a pattern. */
export const PATTERN_DAYS = 3;
export const PATTERN_WINDOW = 7;

export interface PatternDay {
  iso: string;
  /** The day's spoons from the check-in (0 when there wasn't one). */
  allotted: number;
  earnedBack: number;
  /** Spoons used or planned that day. */
  load: number;
}

/**
 * The days in the window where earn-back was at least a quarter of the
 * day's spoons and the day carried more than an ordinary okay day.
 */
export function patternDays(days: PatternDay[], usual: number): string[] {
  return days
    .filter((d) => {
      const budget = (d.allotted > 0 ? d.allotted : usual) + d.earnedBack;
      return budget > 0 && d.earnedBack >= budget * PATTERN_EARNED_SHARE - 1e-9 && d.load > usual + 1e-9;
    })
    .map((d) => d.iso);
}

export function showsPattern(days: PatternDay[], usual: number): boolean {
  return patternDays(days, usual).length >= PATTERN_DAYS;
}

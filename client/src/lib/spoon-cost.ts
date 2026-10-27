// How many spoons a task costs.
//
// From the spoon research (Caroline's doc "Quiet Hours Spoon Research v1",
// section 6): effort level × time, with fatigue building after 2 hours,
// a multiplier for people, camera or noise, and a one-off cost for dread.
// One spoon is about 30 minutes of an ordinary, medium-effort task.
//
// A number the person types always wins: `spoon_estimate` holds that
// override, and stays empty when the app should work it out.

import type { Complexity } from "@/lib/tasks-data";

/** Spoons per hour for each effort level. */
export const SPOONS_PER_HOUR: Record<Complexity, number> = { low: 1, medium: 2, high: 3 };
/** Hours past this in one task count extra (fatigue builds over long stretches). */
export const LONG_STRETCH_HOURS = 2;
export const LONG_STRETCH_FACTOR = 1.25;
/** With people, on camera, masking, or somewhere noisy or busy. */
export const SOCIAL_FACTOR = 1.5;
/** Dread costs once, before the task, whatever its length. */
export const DREAD_SPOONS = 1;
/** Starting anything costs something. */
export const MINIMUM_SPOONS = 0.5;
/** The most a single task can be set to (an 8-hour, high-effort day is 28.5). */
export const MAX_SPOONS = 60;
/** When no effort level is picked, assume the middle of the scale. */
export const DEFAULT_EFFORT: Complexity = "medium";

export const EFFORT_LABEL: Record<Complexity, string> = { low: "Low", medium: "Medium", high: "High" };
export const EFFORT_HINT: Record<Complexity, string> = {
  low: "Routine and familiar, like sorting email or folding laundry.",
  medium: "Focused thinking or light physical work, like writing, cooking or a grocery run.",
  high: "Hard thinking, new or high-stakes, or physically hard, like complex analysis, presenting or deep cleaning.",
};

export interface CostInputs {
  estimated_hours?: number | string | null;
  complexity?: Complexity | null;
  social_load?: boolean | null;
  dread?: boolean | null;
}

export interface SpoonCost {
  spoons: number;
  /** The math in words, for showing next to the number. */
  explanation: string;
  effortAssumed: boolean;
}

function roundUpHalf(n: number): number {
  return Math.ceil(n * 2 - 1e-9) / 2;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function hoursLabel(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${fmt(h)} hr`;
}

/** The calculated cost, or null when there's no time estimate to work from. */
export function calculateSpoons(t: CostInputs): SpoonCost | null {
  const hours = t.estimated_hours == null || t.estimated_hours === "" ? NaN : Number(t.estimated_hours);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  const effort = t.complexity ?? DEFAULT_EFFORT;
  const rate = SPOONS_PER_HOUR[effort];
  const first = Math.min(hours, LONG_STRETCH_HOURS);
  const extra = Math.max(0, hours - LONG_STRETCH_HOURS);
  let raw = rate * first + rate * extra * LONG_STRETCH_FACTOR;
  if (t.social_load) raw *= SOCIAL_FACTOR;
  if (t.dread) raw += DREAD_SPOONS;
  const spoons = Math.max(MINIMUM_SPOONS, roundUpHalf(raw));

  const parts = [`${hoursLabel(hours)} × ${effort} effort${t.complexity ? "" : " (assumed)"}`];
  if (extra > 0) parts.push(`hours past ${LONG_STRETCH_HOURS} count ${LONG_STRETCH_FACTOR}×`);
  if (t.social_load) parts.push(`× ${SOCIAL_FACTOR} with people or noise`);
  if (t.dread) parts.push(`+ ${DREAD_SPOONS} for dread`);
  return { spoons, explanation: parts.join(", "), effortAssumed: !t.complexity };
}

export type SpoonTask = CostInputs & { spoon_estimate: number | string | null };

/**
 * The spoons a task counts for: the person's own number if they typed one,
 * otherwise the calculated cost, otherwise none.
 */
export function taskSpoons(t: SpoonTask): number | null {
  if (t.spoon_estimate != null && t.spoon_estimate !== "") return Number(t.spoon_estimate);
  return calculateSpoons(t)?.spoons ?? null;
}

/** Same as taskSpoons, but 0 instead of none, for adding up. */
export function spoonsOf(t: SpoonTask): number {
  return taskSpoons(t) ?? 0;
}

/** The spoons for a task that's about to be saved (camelCase form fields). */
export function spoonsOfInput(v: {
  spoonEstimate: number | null;
  estimatedHours: number | null;
  complexity: Complexity | null;
  socialLoad?: boolean;
  dread?: boolean;
}): number {
  return spoonsOf({
    spoon_estimate: v.spoonEstimate,
    estimated_hours: v.estimatedHours,
    complexity: v.complexity,
    social_load: v.socialLoad,
    dread: v.dread,
  });
}

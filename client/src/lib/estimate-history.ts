// "Things like this usually take you…": estimates from your own history.
//
// Time blindness makes estimating hard. Every tick-off asks how long it
// actually took (Caroline's decision, Nov 3). This file uses those answers:
//
//   - Similar things: finished tasks and steps that share a meaningful word
//     with the title being estimated ("email", "proposal"). With at least 3
//     of them, their usual time (the middle one) is offered. If the estimate
//     is more than 30% under it, the hint says so; if there's no estimate
//     yet, it just shows what's usual. It never blocks anything.
//   - Overall pattern: with at least 5 finished things that had both an
//     estimate and an actual time, how actual time usually compares.
//
// Words in the title, not AI: instant, works everywhere, costs nothing, and
// nothing leaves the app (Caroline's decision, Nov 9). Spec v3 section 18.

import type { TaskRow } from "@/lib/tasks-data";

export const MIN_SIMILAR = 3;
export const MIN_FOR_PATTERN = 5;
/** An estimate this far under the usual time gets a gentle note (spec v3: 30%). */
export const LOW_RATIO = 0.7;

const STOP = new Set(
  (
    "a an the and or but to for of on in at by with from into onto up out off " +
    "my me our your it its this that these those some any all new next first " +
    "get got do did make made go set put take have has had be is are was were " +
    "about over after before then just more less via per"
  ).split(" "),
);

/** The meaningful words in a title, simplified so "emails" and "email" match. */
export function keywords(title: string): string[] {
  const words = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map(stem);
  return [...new Set(words)];
}

function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

type Past = Pick<TaskRow, "id" | "title" | "completed_at" | "archived_at" | "actual_hours" | "estimated_hours">;

function finishedWithTime(t: Past): boolean {
  return t.completed_at != null && t.archived_at == null && t.actual_hours != null && Number(t.actual_hours) > 0;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function toQuarter(h: number): number {
  return Math.max(0.25, Math.round(h * 4) / 4);
}

/** "45 minutes", "1 hour", "1.5 hours". */
export function hoursPhrase(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} minutes`;
  return h === 1 ? "1 hour" : `${Number(h.toFixed(2))} hours`;
}

export interface SimilarHint {
  /** "info": no estimate yet. "low": the estimate is well under what's usual. */
  kind: "info" | "low";
  usualHours: number;
  count: number;
  /** The words they had in common, for the message. */
  words: string[];
}

/** What similar finished things usually took, or null when there's too little to go on. */
export function similarHint(
  title: string,
  estimateHours: number | null,
  tasks: Past[],
  excludeId?: number,
): SimilarHint | null {
  const mine = keywords(title);
  if (mine.length === 0) return null;
  const scored = tasks
    .filter((t) => t.id !== excludeId && finishedWithTime(t))
    .map((t) => {
      const shared = keywords(t.title).filter((w) => mine.includes(w));
      return { t, shared };
    })
    .filter((x) => x.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length || (b.t.completed_at ?? 0) - (a.t.completed_at ?? 0))
    .slice(0, 10);
  if (scored.length < MIN_SIMILAR) return null;

  const usualHours = toQuarter(median(scored.map((x) => Number(x.t.actual_hours))));
  const counts = new Map<string, number>();
  for (const x of scored) for (const w of x.shared) counts.set(w, (counts.get(w) ?? 0) + 1);
  const words = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w);

  if (estimateHours == null || !(estimateHours > 0)) {
    return { kind: "info", usualHours, count: scored.length, words };
  }
  if (estimateHours < usualHours * LOW_RATIO) {
    return { kind: "low", usualHours, count: scored.length, words };
  }
  return null;
}

/** How actual time usually compares with the estimate, across everything finished. */
export function overallPattern(tasks: Past[], excludeId?: number): { ratio: number; count: number } | null {
  const ratios = tasks
    .filter((t) => t.id !== excludeId && finishedWithTime(t) && t.estimated_hours != null && Number(t.estimated_hours) > 0)
    .map((t) => Number(t.actual_hours) / Number(t.estimated_hours));
  if (ratios.length < MIN_FOR_PATTERN) return null;
  return { ratio: Math.round(median(ratios) * 10) / 10, count: ratios.length };
}

/** The words for the overall pattern. */
export function patternLine(p: { ratio: number }): string {
  if (p.ratio >= 1.2) return `Overall, things take you about ${p.ratio} times what you estimate.`;
  if (p.ratio <= 0.8) return `Overall, things take you about ${p.ratio} times what you estimate, so often less.`;
  return "Overall, your estimates are usually close.";
}

/** The words for a similar-things hint. */
export function similarLine(h: SimilarHint): string {
  const like = h.words.length ? ` with "${h.words.join('" or "')}" in the title` : "";
  const base = `Things like this have usually taken you about ${hoursPhrase(h.usualHours)} (going by ${h.count} you've finished${like}).`;
  return base;
}

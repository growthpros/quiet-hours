// Generates a short, warm message under the Burnout Wave.
// Reads today's check-ins and returns a message tuned to the pattern.
//
// Rules:
//   0 check-ins: warm invitation
//   1 check-in:  gentle notice of current state
//   2+ check-ins improving (avg dropping):  "what worked" message
//   2+ check-ins degrading (avg rising):    soft foundation suggestion
//   2+ check-ins persistently Overloaded:   compassionate interrupt

import type { BurnoutCheckin } from "@shared/schema";
import { bandFor } from "@/lib/burnout-utils";

export type WaveMessageKind =
  | "empty"
  | "single"
  | "improving"
  | "steady"
  | "degrading"
  | "persistent_overload";

export interface WaveMessage {
  kind: WaveMessageKind;
  eyebrow: string;
  body: string;
}

function formatClock(ms: number): string {
  const d = new Date(ms);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12;
  if (h === 0) h = 12;
  const mm = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${h}${mm}${ampm}`;
}

// Average intensity of the first n and the last n check-ins.
// Returns null if there aren't enough entries.
function trendDelta(checkins: BurnoutCheckin[]): number | null {
  if (checkins.length < 2) return null;
  const half = Math.max(1, Math.floor(checkins.length / 2));
  const early = checkins.slice(0, half);
  const late = checkins.slice(-half);
  const avg = (arr: BurnoutCheckin[]) =>
    arr.reduce((s, c) => s + c.intensity, 0) / arr.length;
  return avg(late) - avg(early);
}

export function generateWaveMessage(checkins: BurnoutCheckin[]): WaveMessage {
  if (checkins.length === 0) {
    return {
      kind: "empty",
      eyebrow: "The wave will start when you do",
      body:
        "You haven't paused yet today. When you check in, Quiet Hours will begin drawing the arc of your day.",
    };
  }

  const first = checkins[0];
  const last = checkins[checkins.length - 1];
  const latestBand = bandFor(last.intensity);

  if (checkins.length === 1) {
    return {
      kind: "single",
      eyebrow: "So far",
      body: `One check-in at ${formatClock(first.createdAt)}, currently ${latestBand.label.toLowerCase()}. The wave grows with each pause.`,
    };
  }

  const delta = trendDelta(checkins) ?? 0;

  // Persistent overload: 3+ check-ins, all in Stretched or Overloaded
  const allHigh =
    checkins.length >= 3 &&
    checkins.every((c) => c.intensity >= 3);
  if (allHigh) {
    return {
      kind: "persistent_overload",
      eyebrow: "A soft interrupt",
      body: `Every check-in today has landed Stretched or Overloaded. That's the pattern, not the plan. A 10-minute pause, a glass of water, or a short walk are not indulgences right now, they're the work.`,
    };
  }

  // Improving trend
  if (delta < -0.4) {
    const firstBand = bandFor(first.intensity);
    return {
      kind: "improving",
      eyebrow: "What worked",
      body: `Since ${formatClock(first.createdAt)} you've moved from ${firstBand.label.toLowerCase()} toward ${latestBand.label.toLowerCase()}. Whatever you did between then and now, it worked. Noticing.`,
    };
  }

  // Degrading trend
  if (delta > 0.4) {
    const firstBand = bandFor(first.intensity);
    return {
      kind: "degrading",
      eyebrow: "The wave is climbing",
      body: `You started closer to ${firstBand.label.toLowerCase()} and you're now at ${latestBand.label.toLowerCase()}. A pillar from your Foundation, or a five-minute pause, can soften what's next.`,
    };
  }

  // Steady
  return {
    kind: "steady",
    eyebrow: "Holding steady",
    body: `${checkins.length} check-ins today, mostly ${latestBand.label.toLowerCase()}. Not every day needs to shift. Some just need to be witnessed.`,
  };
}

import type { BurnoutCheckin } from "@shared/schema";

export function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface Band {
  key: "restored" | "steady" | "stretched" | "overloaded";
  label: string;
  interpretation: string;
}

export function bandFor(intensity: number): Band {
  if (intensity < 2)
    return {
      key: "restored",
      label: "Restored",
      interpretation:
        "Energy is holding and the world isn't asking too much. A good moment to protect. No need to add anything.",
    };
  if (intensity < 3)
    return {
      key: "steady",
      label: "Steady",
      interpretation:
        "You're in a workable middle. Small pacing choices, like a short pause, dimmer light or a slower pace, go a long way here.",
    };
  if (intensity < 4)
    return {
      key: "stretched",
      label: "Stretched",
      interpretation:
        "The day is asking a lot. Consider trimming the next hour: postpone the non-essential, and if you can, do the next thing 20% slower.",
    };
  return {
    key: "overloaded",
    label: "Overloaded",
    interpretation:
      "This is a Quiet Hours moment. Lower the sensory input where you can, protect the next 30 minutes, and be kind about what still needs doing.",
  };
}

export function markerPercent(intensity: number): number {
  return Math.min(100, Math.max(0, ((intensity - 1) / 4) * 100));
}

export function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function parseSymptoms(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const SYMPTOM_OPTIONS: { id: string; label: string }[] = [
  { id: "headache", label: "headache" },
  { id: "tension", label: "jaw/shoulder tension" },
  { id: "foggy", label: "foggy thinking" },
  { id: "wired", label: "wired but tired" },
  { id: "irritable", label: "irritable" },
  { id: "hide", label: "wanting to hide" },
  { id: "stomach", label: "stomach unsettled" },
  { id: "tears", label: "close to tears" },
  { id: "numb", label: "numb/flat" },
];

export function symptomLabel(id: string): string {
  return SYMPTOM_OPTIONS.find((s) => s.id === id)?.label ?? id;
}

export function summarize(checkins: BurnoutCheckin[]) {
  const intensities = checkins.map((c) => c.intensity);
  const energies = checkins.map((c) => c.energy);
  const sensories = checkins.map((c) => c.sensory);
  return {
    count: checkins.length,
    avgIntensity: avg(intensities),
    avgEnergy: avg(energies),
    avgSensory: avg(sensories),
  };
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

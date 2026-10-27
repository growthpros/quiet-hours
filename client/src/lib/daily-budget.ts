// How many spoons a day starts with (spoon model change 2).
//
// From the spoon research (Caroline's doc "Quiet Hours Spoon Research v1",
// section 6a): start from the person's own ordinary okay day, scale it by
// how much energy they have right now, then take off a share for other load.
//
//   today = ordinary day × energy share × (1 − other load)
//
// Other load never takes more than 30%, and today stays between 40% and
// 110% of the ordinary day. A later check-in can lower today, never raise it.
// Every number here is a judgment call inside the research's structure.

/** The ordinary okay day when the person hasn't set one. */
export const DEFAULT_USUAL = 12;
export const USUAL_MIN = 4;
export const USUAL_MAX = 30;

/** Plain choices for "On an ordinary okay day, how much can you get through?" */
export const USUAL_CHOICES: { spoons: number; label: string }[] = [
  { spoons: 8, label: "About 4 hours of ordinary activity" },
  { spoons: 12, label: "About 6 hours" },
  { spoons: 16, label: "About 8 hours" },
  { spoons: 20, label: "About 10 hours" },
  { spoons: 24, label: "About 12 hours" },
];

/** Energy answer (1 to 5) to the share of an ordinary day. */
export const ENERGY_SHARE: Record<number, number> = { 1: 0.6, 2: 0.8, 3: 1.0, 4: 1.05, 5: 1.1 };
export const ENERGY_LABEL: Record<number, string> = {
  1: "Depleted",
  2: "Low",
  3: "Steady",
  4: "Present",
  5: "Bright",
};

/** Sensory answer (1 to 5) to the share it takes off. */
export const SENSORY_LOAD: Record<number, number> = { 1: 0, 2: 0, 3: 0.05, 4: 0.1, 5: 0.2 };
export const SENSORY_LABEL: Record<number, string> = {
  1: "Quiet",
  2: "Soft",
  3: "Noticeable",
  4: "A lot",
  5: "Overloaded",
};

const SENSORY_LOAD_LABEL: Record<number, string> = {
  3: "Noticeable sensory input",
  4: "A lot of sensory input",
  5: "Sensory overload",
};

export const STATE_LOAD: Record<string, number> = {
  grounded: 0,
  drifting: 0.05,
  chasing: 0.05,
  numbing: 0.1,
  frozen: 0.15,
};
const STATE_LABEL: Record<string, string> = {
  grounded: "Grounded",
  drifting: "Drifting",
  chasing: "Chasing",
  numbing: "Numbing",
  frozen: "Frozen",
};

export const BODY_SIGNAL_LOAD = 0.05;
export const BODY_SIGNAL_MAX = 0.15;
/** Yesterday counts as a big day when it went past this share of its budget. */
export const BIG_DAY_SHARE = 1.1;
export const AFTER_BIG_DAY_LOAD = 0.1;
export const OTHER_LOAD_MAX = 0.3;
export const TODAY_MIN_SHARE = 0.4;
export const TODAY_MAX_SHARE = 1.1;

export interface BudgetInputs {
  usual: number;
  energy: number; // 1 to 5
  sensory: number; // 1 to 5
  state: string | null;
  bodySignals: number;
  yesterdayWasBig: boolean;
}

/** What went into today's number, saved with the day so the meter can show it. */
export interface BudgetBasis {
  usual: number;
  energy: number;
  energyShare: number;
  /** Each piece of other load, as a share (0.05 = 5%). */
  loads: { label: string; share: number }[];
  /** Total other load after the 30% cap. */
  otherLoad: number;
  /** "low" or "high" when the 40% or 110% limit changed the number. */
  limited: "low" | "high" | null;
  spoons: number;
}

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Clamp a typed ordinary-day number into the allowed range, to the half spoon. */
export function cleanUsual(n: number | string | null | undefined): number {
  const v = Number(n);
  if (n == null || n === "" || !Number.isFinite(v) || v <= 0) return DEFAULT_USUAL;
  return roundHalf(Math.min(USUAL_MAX, Math.max(USUAL_MIN, v)));
}

export function dailyBudget(input: BudgetInputs): BudgetBasis {
  const usual = cleanUsual(input.usual);
  const energy = Math.min(5, Math.max(1, Math.round(input.energy)));
  const energyShare = ENERGY_SHARE[energy];

  const loads: { label: string; share: number }[] = [];
  const sensory = Math.min(5, Math.max(1, Math.round(input.sensory)));
  if (SENSORY_LOAD[sensory] > 0) {
    loads.push({ label: SENSORY_LOAD_LABEL[sensory], share: SENSORY_LOAD[sensory] });
  }
  const stateShare = input.state ? (STATE_LOAD[input.state] ?? 0) : 0;
  if (stateShare > 0 && input.state) {
    loads.push({ label: STATE_LABEL[input.state] ?? input.state, share: stateShare });
  }
  if (input.bodySignals > 0) {
    const share = Math.min(BODY_SIGNAL_MAX, input.bodySignals * BODY_SIGNAL_LOAD);
    loads.push({
      label: `${input.bodySignals} body signal${input.bodySignals === 1 ? "" : "s"}`,
      share,
    });
  }
  if (input.yesterdayWasBig) {
    loads.push({ label: "Yesterday was a big day", share: AFTER_BIG_DAY_LOAD });
  }
  const otherLoad = Math.min(
    OTHER_LOAD_MAX,
    loads.reduce((sum, l) => sum + l.share, 0),
  );

  const raw = usual * energyShare * (1 - otherLoad);
  const low = usual * TODAY_MIN_SHARE;
  const high = usual * TODAY_MAX_SHARE;
  const limited = raw < low ? "low" : raw > high ? "high" : null;
  const spoons = roundHalf(Math.min(high, Math.max(low, raw)));

  return {
    usual,
    energy,
    energyShare,
    loads,
    otherLoad: Math.round(otherLoad * 100) / 100,
    limited,
    spoons,
  };
}

/** The math in one line, for the spoon meter. */
export function basisLine(b: BudgetBasis): string {
  const parts = [
    `Ordinary day ${b.usual}`,
    `${ENERGY_LABEL[b.energy]} energy ${pct(b.energyShare)}`,
  ];
  if (b.otherLoad > 0) parts.push(`Other load −${pct(b.otherLoad)}`);
  return `${parts.join(" · ")} = ${b.spoons} spoons`;
}

/** What the other load was made of, in words. */
export function loadDetail(b: BudgetBasis): string {
  if (b.loads.length === 0) return "No other load today.";
  const items = b.loads.map((l) => `${l.label} ${pct(l.share)}`).join(", ");
  const total = b.loads.reduce((s, l) => s + l.share, 0);
  return total > OTHER_LOAD_MAX + 1e-9
    ? `${items}. Other load stops at ${pct(OTHER_LOAD_MAX)}.`
    : `${items}.`;
}

/** Whether a day went past 110% of its budget. */
export function wasBigDay(spent: number, budget: number): boolean {
  return budget > 0 && spent > budget * BIG_DAY_SHARE + 1e-9;
}

/**
 * The day's budget after a check-in. The first check-in sets it; a later
 * one can only lower it.
 */
export function nextAllotment(current: number, fromCheckin: number): { allotted: number; changed: boolean } {
  if (!(current > 0)) return { allotted: fromCheckin, changed: true };
  if (fromCheckin < current) return { allotted: fromCheckin, changed: true };
  return { allotted: current, changed: false };
}

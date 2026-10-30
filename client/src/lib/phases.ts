// The five phases, heaviest first, and when the app suggests a different one.
//
// Spoon model change 4 renamed them. The database keys stay the same, so
// nobody's saved phase changes:
//   burnout        -> Burnout recovery
//   acute_recovery -> Reduced capacity
//   rebuilding     -> Building back
//   steady         -> Steady
//   stretch        -> Stretch
//
// Caroline's decision: the app may suggest lighter phases down to Reduced
// capacity, but only the person moves themselves into Burnout recovery.

export type PhaseKey = "burnout" | "acute_recovery" | "rebuilding" | "steady" | "stretch";

export const PHASES: { key: PhaseKey; label: string; desc: string }[] = [
  {
    key: "burnout",
    label: "Burnout recovery",
    desc: "For when you're in burnout. Foundation only, nothing extra. Rest is the work right now.",
  },
  {
    key: "acute_recovery",
    label: "Reduced capacity",
    desc: "Running low. The basics first: rest, water, food, and only what can't wait.",
  },
  {
    key: "rebuilding",
    label: "Building back",
    desc: "Adding things back slowly: gentle movement, a steadier sleep window, short focus blocks.",
  },
  {
    key: "steady",
    label: "Steady",
    desc: "Your ordinary rhythm: the full foundation, regular work, and your boundaries holding.",
  },
  {
    key: "stretch",
    label: "Stretch",
    desc: "Room for more for a while: higher activity, bigger goals, longer focus blocks.",
  },
];

export function phaseLabel(key: string | null | undefined): string | null {
  return PHASES.find((p) => p.key === key)?.label ?? null;
}

export function phaseDesc(key: string | null | undefined): string | null {
  return PHASES.find((p) => p.key === key)?.desc ?? null;
}

/** The lightest phase the app will suggest on its own. */
export const LIGHTEST_SUGGESTED: PhaseKey = "acute_recovery";

export interface PhaseSuggestion {
  fromPhase: string | null;
  toPhase: PhaseKey;
  reason: string;
}

interface CheckinLike {
  state: string | null;
  intensity: number;
}

const ORDER: PhaseKey[] = PHASES.map((p) => p.key); // heaviest first

function lighter(current: string | null): PhaseKey | null {
  // With no phase set, a heavy run suggests Building back.
  if (current == null) return "rebuilding";
  const i = ORDER.indexOf(current as PhaseKey);
  if (i <= 0) return null;
  const next = ORDER[i - 1];
  // Never suggest Burnout recovery: the person chooses it.
  return ORDER.indexOf(next) < ORDER.indexOf(LIGHTEST_SUGGESTED) ? null : next;
}

function moreRoom(current: string | null): PhaseKey | null {
  if (current == null) return "steady";
  const i = ORDER.indexOf(current as PhaseKey);
  if (i < 0 || i >= ORDER.length - 1) return null;
  return ORDER[i + 1];
}

/**
 * A suggestion from the most recent check-ins (oldest first), or null.
 * Five heavy check-ins in a row suggest one phase lighter; seven grounded
 * or drifting, low-intensity ones suggest one phase with more room.
 */
export function analyzePhaseFromCheckins(
  checkins: CheckinLike[],
  currentPhase: string | null,
): PhaseSuggestion | null {
  if (checkins.length < 5) return null;
  const recent5 = checkins.slice(-5);
  const recent7 = checkins.slice(-7);

  const isHeavy = (c: CheckinLike) =>
    c.state === "chasing" || c.state === "numbing" || c.state === "frozen" || c.intensity >= 3;
  const isSteady = (c: CheckinLike) =>
    (c.state === "grounded" || c.state === "drifting") && c.intensity <= 2;

  if (recent5.every(isHeavy)) {
    const next = lighter(currentPhase);
    if (!next) return null;
    return {
      fromPhase: currentPhase,
      toPhase: next,
      reason: "Your last 5 check-ins have all been heavy. A lighter phase softens the defaults.",
    };
  }

  if (recent7.length >= 7 && recent7.every(isSteady)) {
    const next = moreRoom(currentPhase);
    if (!next) return null;
    return {
      fromPhase: currentPhase,
      toPhase: next,
      reason: "Your last 7 check-ins have been grounded or drifting. Ready for a bit more room?",
    };
  }

  return null;
}

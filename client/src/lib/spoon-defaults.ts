// Default earn-back actions seeded on first sign-in.
// Every value here is editable per user; this is just the starting point.
//
// Rule: each action earns per-instance (up to the daily cap), NOT per-duration.
// A 15-minute meditation earns the same as a 5-minute meditation.
// To earn more, do the action more separate times.

export interface DefaultEarnBack {
  actionKey: string;
  label: string;
  icon: string;
  spoonValue: number;
  dailyCap: number;
  // If set, the action must have at least this many minutes to qualify.
  // Applies to duration-based logs (meditation, walking, etc.). For
  // instance-only logs (protein snack, said no) leave null.
  durationMinMinutes: number | null;
  // If set, this action auto-fires when a Foundation pillar with the same
  // key is logged. Null means the action is standalone.
  linkedPillarKey: string | null;
  featured: boolean;
  sortOrder: number;
}

export const DEFAULT_EARN_BACK: DefaultEarnBack[] = [
  {
    actionKey: "meditation",
    label: "Meditated",
    icon: "🌿",
    spoonValue: 1,
    dailyCap: 3,
    durationMinMinutes: 5,
    linkedPillarKey: "meditation",
    featured: true,
    sortOrder: 0,
  },
  {
    actionKey: "walk",
    label: "Walked",
    icon: "🚶",
    spoonValue: 1,
    dailyCap: 3,
    durationMinMinutes: 20,
    linkedPillarKey: "movement",
    featured: true,
    sortOrder: 1,
  },
  {
    actionKey: "nap",
    label: "Napped",
    icon: "😴",
    spoonValue: 2,
    dailyCap: 2,
    durationMinMinutes: 20,
    linkedPillarKey: null,
    featured: true,
    sortOrder: 2,
  },
  {
    actionKey: "deep_breathing",
    label: "Deep breathing",
    icon: "🌬️",
    spoonValue: 0.5,
    dailyCap: 4,
    durationMinMinutes: 2,
    linkedPillarKey: null,
    featured: true,
    sortOrder: 3,
  },
  {
    actionKey: "body_double",
    label: "Body-double session",
    icon: "👥",
    spoonValue: 1,
    dailyCap: 2,
    durationMinMinutes: 30,
    linkedPillarKey: null,
    featured: false,
    sortOrder: 4,
  },
  {
    actionKey: "protein_snack",
    label: "Protein snack",
    icon: "🥜",
    spoonValue: 0.5,
    dailyCap: 3,
    durationMinMinutes: null,
    linkedPillarKey: null,
    featured: false,
    sortOrder: 5,
  },
  {
    actionKey: "hydration_target",
    label: "Hit hydration target",
    icon: "💧",
    spoonValue: 0.5,
    dailyCap: 1,
    durationMinMinutes: null,
    linkedPillarKey: "hydration",
    featured: false,
    sortOrder: 6,
  },
  {
    actionKey: "said_no",
    label: "Said no to something",
    icon: "✋",
    spoonValue: 1,
    dailyCap: 3,
    durationMinMinutes: null,
    linkedPillarKey: null,
    featured: true,
    sortOrder: 7,
  },
  {
    actionKey: "delegated",
    label: "Delegated instead of doing",
    icon: "↗",
    spoonValue: 1,
    dailyCap: 3,
    durationMinMinutes: null,
    linkedPillarKey: null,
    featured: false,
    sortOrder: 8,
  },
  {
    actionKey: "removed_task",
    label: "Removed a task, didn't need doing",
    icon: "✕",
    spoonValue: 1,
    dailyCap: 3,
    durationMinMinutes: null,
    linkedPillarKey: null,
    featured: false,
    sortOrder: 9,
  },
  {
    actionKey: "under_scheduled",
    label: "Under-scheduled on purpose",
    icon: "🌾",
    spoonValue: 1,
    dailyCap: 1,
    durationMinMinutes: null,
    linkedPillarKey: null,
    featured: false,
    sortOrder: 10,
  },
];

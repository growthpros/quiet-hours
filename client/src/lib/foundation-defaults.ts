// Foundation defaults, seeded on first sign-in.
// Users can toggle any off, edit any target, or add their own pillars.

export interface DefaultPillar {
  pillarKey: string;
  label: string;
  icon: string;
  targetType: "checkbox" | "count" | "minutes" | "units" | "multiselect";
  targetValue: number | null;
  unit: string | null;
  enabled: boolean;
  sortOrder: number;
}

export const DEFAULT_PILLARS: DefaultPillar[] = [
  {
    pillarKey: "meds",
    label: "Meds",
    icon: "💊",
    targetType: "checkbox",
    targetValue: null,
    unit: null,
    enabled: false,
    sortOrder: 0,
  },
  {
    pillarKey: "hydration",
    label: "Hydration",
    icon: "💧",
    targetType: "count",
    targetValue: 64,
    unit: "oz",
    enabled: true,
    sortOrder: 1,
  },
  {
    pillarKey: "protein",
    label: "Protein",
    icon: "🥛",
    targetType: "count",
    targetValue: 60,
    unit: "g",
    enabled: true,
    sortOrder: 2,
  },
  {
    pillarKey: "movement",
    label: "Movement",
    icon: "🚶",
    targetType: "minutes",
    targetValue: 30,
    unit: "min",
    enabled: true,
    sortOrder: 3,
  },
  {
    pillarKey: "meditation",
    label: "Meditation",
    icon: "🌿",
    targetType: "minutes",
    targetValue: 10,
    unit: "min",
    enabled: true,
    sortOrder: 4,
  },
  {
    pillarKey: "sleep",
    label: "Sleep",
    icon: "🌙",
    targetType: "units",
    targetValue: 8,
    unit: "hr",
    enabled: true,
    sortOrder: 5,
  },
  {
    pillarKey: "symptoms",
    label: "Symptoms",
    icon: "🩹",
    targetType: "multiselect",
    targetValue: null,
    unit: null,
    enabled: false,
    sortOrder: 6,
  },
];

// Curated symptom chip options. The "other" chip lets users add their own,
// which are saved to their personal symptom library.
export const DEFAULT_SYMPTOM_CHIPS = [
  "nausea",
  "pain",
  "fatigue",
  "brain fog",
  "dizziness",
  "headache",
  "stomach",
  "insomnia",
  "emotional overwhelm",
];

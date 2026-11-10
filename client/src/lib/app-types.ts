// The shapes the older pages (Delegation, Good Enough, Compassion, Check-in)
// work with: database rows with camelCase names, as the default queryFn in
// lib/queryClient.ts returns them. They used to come from shared/schema.ts,
// a leftover from the original template's SQLite server; the database rows
// themselves are in lib/supabase.ts.

export interface DelegationTask {
  id: number;
  title: string;
  notes: string | null;
  urgency: number;
  importance: number;
  quadrant: string; // do | schedule | delegate | drop
  assignee: string | null;
  releasedControl: number;
  completed: number;
  createdAt: number;
}

export interface ChecklistRun {
  id: number;
  templateKey: string; // e.g. "internal_email" or "custom"
  templateLabel: string;
  items: string; // JSON: [{ id, label, required, done }]
  completed: number;
  shipped: number;
  createdAt: number;
}

export interface CompassionEntry {
  id: number;
  trigger: string;
  firstThought: string;
  intensityBefore: number; // 1 to 10
  reframe: string;
  intensityAfter: number; // 1 to 10
  outcome: string | null;
  createdAt: number;
}

export interface BurnoutCheckin {
  id: number;
  energy: number; // 1 to 5
  sensory: number; // 1 to 5
  intensity: number;
  symptoms: string; // JSON string array
  state: string | null; // grounded | drifting | chasing | numbing | frozen
  pulls: string; // JSON array
  note: string | null;
  createdAt: number;
}

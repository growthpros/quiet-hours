import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // Surface a clear error in dev; production build should always have env vars.
  // eslint-disable-next-line no-console
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Auth and data will not work.",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Persist session in localStorage; auto-refresh so users stay signed in.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ---------- Row shapes ----------
// These match the Postgres columns; we do the JSON parsing at the edges.

export interface DelegationTaskRow {
  id: number;
  user_id: string;
  title: string;
  notes: string | null;
  urgency: number;
  importance: number;
  quadrant: "do" | "schedule" | "delegate" | "drop";
  assignee: string | null;
  released_control: number;
  completed: number;
  created_at: number;
}

export interface ChecklistRunRow {
  id: number;
  user_id: string;
  template_key: string;
  template_label: string;
  items: string;
  completed: number;
  shipped: number;
  created_at: number;
}

export interface CompassionEntryRow {
  id: number;
  user_id: string;
  trigger: string;
  first_thought: string;
  intensity_before: number;
  reframe: string;
  intensity_after: number;
  outcome: string | null;
  created_at: number;
}

export interface BurnoutCheckinRow {
  id: number;
  user_id: string;
  energy: number;
  sensory: number;
  intensity: number;
  symptoms: string;
  state: string | null;
  pulls: string;
  note: string | null;
  created_at: number;
}

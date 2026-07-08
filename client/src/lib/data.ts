// Data-access layer. Each function talks to Supabase directly.
// Row-level security scopes everything to the current user automatically.

import { supabase } from "@/lib/supabase";
import type {
  DelegationTaskRow,
  ChecklistRunRow,
  CompassionEntryRow,
  BurnoutCheckinRow,
} from "@/lib/supabase";

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

function classifyQuadrant(urgency: number, importance: number) {
  const highU = urgency >= 3;
  const highI = importance >= 3;
  if (highU && highI) return "do" as const;
  if (highI) return "schedule" as const;
  if (highU) return "delegate" as const;
  return "drop" as const;
}

// ---------- Delegation ----------
export async function listDelegation(): Promise<DelegationTaskRow[]> {
  const { data, error } = await supabase
    .from("delegation_tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createDelegation(input: {
  title: string;
  notes: string | null;
  urgency: number;
  importance: number;
  assignee: string | null;
  releasedControl?: number;
  completed?: number;
}) {
  const user_id = await requireUserId();
  const quadrant = classifyQuadrant(input.urgency, input.importance);
  const { data, error } = await supabase
    .from("delegation_tasks")
    .insert({
      user_id,
      title: input.title,
      notes: input.notes,
      urgency: input.urgency,
      importance: input.importance,
      quadrant,
      assignee: input.assignee,
      released_control: input.releasedControl ?? 0,
      completed: input.completed ?? 0,
      created_at: Date.now(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDelegation(
  id: number,
  patch: Partial<{
    title: string;
    notes: string | null;
    urgency: number;
    importance: number;
    assignee: string | null;
    releasedControl: number;
    completed: number;
  }>,
) {
  const dbPatch: Record<string, unknown> = { ...patch };
  if ("releasedControl" in patch) {
    dbPatch.released_control = patch.releasedControl;
    delete dbPatch.releasedControl;
  }
  if (patch.urgency !== undefined && patch.importance !== undefined) {
    dbPatch.quadrant = classifyQuadrant(patch.urgency, patch.importance);
  }
  const { data, error } = await supabase
    .from("delegation_tasks")
    .update(dbPatch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDelegation(id: number) {
  const { error } = await supabase
    .from("delegation_tasks")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Checklists ----------
export async function listChecklists(): Promise<ChecklistRunRow[]> {
  const { data, error } = await supabase
    .from("checklist_runs")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createChecklist(input: {
  templateKey: string;
  templateLabel: string;
  items: string;
}) {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from("checklist_runs")
    .insert({
      user_id,
      template_key: input.templateKey,
      template_label: input.templateLabel,
      items: input.items,
      completed: 0,
      shipped: 0,
      created_at: Date.now(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateChecklist(
  id: number,
  patch: Partial<{ items: string; completed: number; shipped: number }>,
) {
  const { data, error } = await supabase
    .from("checklist_runs")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteChecklist(id: number) {
  const { error } = await supabase
    .from("checklist_runs")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Compassion ----------
export async function listCompassion(): Promise<CompassionEntryRow[]> {
  const { data, error } = await supabase
    .from("compassion_entries")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCompassion(input: {
  trigger: string;
  firstThought: string;
  intensityBefore: number;
  reframe: string;
  intensityAfter: number;
  outcome: string | null;
}) {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from("compassion_entries")
    .insert({
      user_id,
      trigger: input.trigger,
      first_thought: input.firstThought,
      intensity_before: input.intensityBefore,
      reframe: input.reframe,
      intensity_after: input.intensityAfter,
      outcome: input.outcome,
      created_at: Date.now(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCompassion(id: number) {
  const { error } = await supabase
    .from("compassion_entries")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Burnout ----------
export async function listBurnout(sinceMs?: number): Promise<BurnoutCheckinRow[]> {
  let q = supabase
    .from("burnout_checkins")
    .select("*")
    .order("created_at", { ascending: true });
  if (sinceMs !== undefined) q = q.gte("created_at", sinceMs);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function createBurnout(input: {
  energy: number;
  sensory: number;
  symptoms: string;
  state: string | null;
  pulls: string;
  note: string | null;
}) {
  const user_id = await requireUserId();
  const intensity = (input.sensory + (6 - input.energy)) / 2;
  const { data, error } = await supabase
    .from("burnout_checkins")
    .insert({
      user_id,
      energy: input.energy,
      sensory: input.sensory,
      intensity,
      symptoms: input.symptoms,
      state: input.state,
      pulls: input.pulls,
      note: input.note,
      created_at: Date.now(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBurnout(id: number) {
  const { error } = await supabase
    .from("burnout_checkins")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function clearBurnoutToday() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { error } = await supabase
    .from("burnout_checkins")
    .delete()
    .gte("created_at", startOfDay.getTime());
  if (error) throw error;
}

// ---------- Streaks (computed client-side) ----------
export type Streaks = Record<
  string,
  { streak: number; endedYesterday: boolean }
>;

export async function fetchStreaks(): Promise<Streaks> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 30);
  const rows = await listBurnout(start.getTime());

  const dayKey = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const byDay = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.state) continue;
    const k = dayKey(r.created_at);
    if (!byDay.has(k)) byDay.set(k, new Set());
    byDay.get(k)!.add(r.state);
  }

  const states = ["grounded", "drifting", "chasing", "numbing", "frozen"];
  const out: Streaks = {};
  const now = new Date();
  for (const st of states) {
    let streak = 0;
    let endedYesterday = false;
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    const todayKey = dayKey(cursor.getTime());
    const hasToday = byDay.get(todayKey)?.has(st) ?? false;
    if (!hasToday) {
      cursor.setDate(cursor.getDate() - 1);
      endedYesterday = true;
    }
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const k = dayKey(cursor.getTime());
      if (byDay.get(k)?.has(st)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    out[st] = { streak, endedYesterday: streak > 0 ? endedYesterday : false };
  }
  return out;
}

// ---------- Account: delete everything for this user ----------
// The auth.users → tables use ON DELETE CASCADE, so removing the auth user
// wipes all rows. But we can't drop auth users from the client — the client
// can only sign out. Deleting data explicitly is safer: purge every row we own,
// then sign out. The user's auth account is orphaned but empty.
export async function deleteAllMyData() {
  await Promise.all([
    supabase.from("delegation_tasks").delete().neq("id", -1),
    supabase.from("checklist_runs").delete().neq("id", -1),
    supabase.from("compassion_entries").delete().neq("id", -1),
    supabase.from("burnout_checkins").delete().neq("id", -1),
  ]);
  await supabase.auth.signOut();
}

// ---------- Export everything as JSON ----------
export async function exportAllMyData() {
  const [delegation, checklists, compassion, burnout] = await Promise.all([
    listDelegation(),
    listChecklists(),
    listCompassion(),
    listBurnout(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    delegation,
    checklists,
    compassion,
    burnout,
  };
}

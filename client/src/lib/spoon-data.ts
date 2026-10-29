// Data layer for spoons: ledger, allotment, earn-back rules & events,
// overrides, phase transitions.

import { supabase } from "@/lib/supabase";
import type { BurnoutCheckinRow } from "@/lib/supabase";
import { DEFAULT_EARN_BACK } from "@/lib/spoon-defaults";
import { getOrCreateProfile, updateProfile } from "@/lib/foundation-data";
import { addLocalDays, localIsoDate } from "@/lib/local-date";
import { cleanUsual, dailyBudget, nextAllotment, wasBigDay, type BudgetBasis } from "@/lib/daily-budget";
import { spentToday, todayBudget } from "@/lib/spoon-budget";
import { listTasks } from "@/lib/tasks-data";

// ---------- Types ----------
export interface SpoonLedgerRow {
  id: number;
  user_id: string;
  log_date: string;
  allotted: number;
  committed: number;
  spent: number;
  earned_back: number;
  /** What went into the budget (migration 016); null for older days. */
  budget_basis: BudgetBasis | null;
  created_at: number;
  updated_at: number;
}

export interface EarnBackActionRow {
  id: number;
  user_id: string;
  action_key: string;
  label: string;
  icon: string | null;
  spoon_value: number;
  daily_cap: number;
  duration_min_minutes: number | null;
  linked_pillar_key: string | null;
  featured: boolean;
  enabled: boolean;
  sort_order: number;
  created_at: number;
}

export interface EarnBackEventRow {
  id: number;
  user_id: string;
  action_id: number;
  log_date: string;
  spoons_awarded: number;
  at_cap: boolean;
  note: string | null;
  created_at: number;
}

export interface OverrideEventRow {
  id: number;
  user_id: string;
  log_date: string;
  spoons_over: number;
  category: string;
  free_text: string | null;
  created_at: number;
}

export interface PhaseTransitionRow {
  id: number;
  user_id: string;
  from_phase: string | null;
  to_phase: string;
  suggested: boolean;
  accepted: boolean;
  reason: string | null;
  created_at: number;
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

// Body signals ticked in a check-in (stored as a JSON array string).
function bodyCountFrom(symptomsJson: string | null): number {
  if (!symptomsJson) return 0;
  try {
    const arr = JSON.parse(symptomsJson);
    return Array.isArray(arr) ? arr.length : 0;
  } catch (e) {
    // An unreadable list counts as no signals rather than blocking the budget.
    console.warn("Couldn't read check-in body signals", e);
    return 0;
  }
}

// ---------- Ledger ----------
export async function getOrCreateTodayLedger(): Promise<SpoonLedgerRow> {
  return getOrCreateLedgerForDate(localIsoDate());
}

export async function getOrCreateLedgerForDate(ymd: string): Promise<SpoonLedgerRow> {
  const user_id = await requireUserId();

  const { data: existing, error: readErr } = await supabase
    .from("spoon_ledger")
    .select("*")
    .eq("user_id", user_id)
    .eq("log_date", ymd)
    .maybeSingle();
  if (readErr) throw readErr;
  if (existing) return existing as SpoonLedgerRow;

  // For past days, don't insert an empty row. Return a synthetic empty ledger
  // so read-only past-day view doesn't clutter the DB with zero rows.
  const today = localIsoDate();
  if (ymd !== today) {
    return {
      id: -1,
      user_id,
      log_date: ymd,
      allotted: 0,
      committed: 0,
      spent: 0,
      earned_back: 0,
      budget_basis: null,
      created_at: 0,
      updated_at: 0,
    };
  }

  const now = Date.now();
  const { data: created, error: writeErr } = await supabase
    .from("spoon_ledger")
    .insert({
      user_id,
      log_date: ymd,
      allotted: 0,
      committed: 0,
      spent: 0,
      earned_back: 0,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (writeErr) throw writeErr;
  return created as SpoonLedgerRow;
}

async function patchLedger(patch: Partial<Pick<SpoonLedgerRow, "allotted" | "committed" | "spent" | "earned_back" | "budget_basis">>): Promise<SpoonLedgerRow> {
  const user_id = await requireUserId();
  const today = localIsoDate();
  await getOrCreateTodayLedger();
  const { data, error } = await supabase
    .from("spoon_ledger")
    .update({ ...patch, updated_at: Date.now() })
    .eq("user_id", user_id)
    .eq("log_date", today)
    .select()
    .single();
  if (error) throw error;
  return data as SpoonLedgerRow;
}

export interface CheckinBudgetResult {
  ledger: SpoonLedgerRow;
  basis: BudgetBasis;
  /** "set" for the day's first budget, "lowered" when a later check-in lowered it, "kept" otherwise. */
  outcome: "set" | "lowered" | "kept";
}

// Called after every check-in (see daily-budget.ts). The first check-in of
// the day sets the budget; a later one can lower it, never raise it.
export async function issueSpoonsFromCheckin(checkin: BurnoutCheckinRow): Promise<CheckinBudgetResult> {
  const yesterday = localIsoDate(addLocalDays(new Date(), -1));
  const [ledger, profile, yLedger, tasks] = await Promise.all([
    getOrCreateTodayLedger(),
    getOrCreateProfile(),
    getOrCreateLedgerForDate(yesterday),
    listTasks(),
  ]);
  const usual = cleanUsual(profile.usual_budget);
  const yBudget = todayBudget(yLedger, usual).budget;
  const ySpent = spentToday(tasks, Number(yLedger.spent || 0), yesterday);

  const basis = dailyBudget({
    usual,
    energy: checkin.energy,
    sensory: checkin.sensory,
    state: checkin.state,
    bodySignals: bodyCountFrom(checkin.symptoms),
    yesterdayWasBig: wasBigDay(ySpent, yBudget),
  });
  const next = nextAllotment(Number(ledger.allotted), basis.spoons);
  if (!next.changed) return { ledger, basis, outcome: "kept" };
  const updated = await patchLedger({ allotted: next.allotted, budget_basis: basis });
  return { ledger: updated, basis, outcome: Number(ledger.allotted) > 0 ? "lowered" : "set" };
}

// ---------- Earn-back actions ----------
export async function listEarnBackActions(): Promise<EarnBackActionRow[]> {
  const { data, error } = await supabase
    .from("earn_back_actions")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EarnBackActionRow[];
}

// Seed defaults on first sign-in. Guarded by user_profiles.seeded_earn_back flag
// which we add lazily using the profile row's existing seeded_pillars pattern.
// (No new profile column needed; we detect "no actions yet" and seed.)
export async function seedDefaultEarnBackIfNeeded(): Promise<void> {
  const user_id = await requireUserId();
  const existing = await listEarnBackActions();
  if (existing.length > 0) return;

  const now = Date.now();
  const rows = DEFAULT_EARN_BACK.map((a) => ({
    user_id,
    action_key: a.actionKey,
    label: a.label,
    icon: a.icon,
    spoon_value: a.spoonValue,
    daily_cap: a.dailyCap,
    duration_min_minutes: a.durationMinMinutes,
    linked_pillar_key: a.linkedPillarKey,
    featured: a.featured,
    enabled: true,
    sort_order: a.sortOrder,
    created_at: now,
  }));
  const { error } = await supabase.from("earn_back_actions").insert(rows);
  if (error && !String(error.message).toLowerCase().includes("duplicate")) throw error;
}

export interface EarnBackActionPatch {
  label?: string;
  icon?: string | null;
  spoonValue?: number;
  dailyCap?: number;
  durationMinMinutes?: number | null;
  featured?: boolean;
  enabled?: boolean;
  sortOrder?: number;
}

export async function updateEarnBackAction(id: number, patch: EarnBackActionPatch): Promise<EarnBackActionRow> {
  const db: Record<string, unknown> = {};
  if (patch.label !== undefined) db.label = patch.label;
  if (patch.icon !== undefined) db.icon = patch.icon;
  if (patch.spoonValue !== undefined) db.spoon_value = patch.spoonValue;
  if (patch.dailyCap !== undefined) db.daily_cap = patch.dailyCap;
  if (patch.durationMinMinutes !== undefined) db.duration_min_minutes = patch.durationMinMinutes;
  if (patch.featured !== undefined) db.featured = patch.featured;
  if (patch.enabled !== undefined) db.enabled = patch.enabled;
  if (patch.sortOrder !== undefined) db.sort_order = patch.sortOrder;
  const { data, error } = await supabase
    .from("earn_back_actions")
    .update(db)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as EarnBackActionRow;
}

export async function createEarnBackAction(input: {
  label: string;
  icon: string;
  spoonValue: number;
  dailyCap: number;
  durationMinMinutes: number | null;
  featured: boolean;
  sortOrder: number;
}): Promise<EarnBackActionRow> {
  const user_id = await requireUserId();
  const now = Date.now();
  // Custom action_key derived from label; unique per user.
  const key = "custom_" + input.label.toLowerCase().replace(/[^a-z0-9]+/g, "_") + "_" + now.toString(36);
  const { data, error } = await supabase
    .from("earn_back_actions")
    .insert({
      user_id,
      action_key: key,
      label: input.label,
      icon: input.icon,
      spoon_value: input.spoonValue,
      daily_cap: input.dailyCap,
      duration_min_minutes: input.durationMinMinutes,
      linked_pillar_key: null,
      featured: input.featured,
      enabled: true,
      sort_order: input.sortOrder,
      created_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return data as EarnBackActionRow;
}

export async function deleteEarnBackAction(id: number): Promise<void> {
  const { error } = await supabase.from("earn_back_actions").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Earn-back events ----------
export async function listTodayEarnBackEvents(): Promise<EarnBackEventRow[]> {
  return listEarnBackEventsForDate(localIsoDate());
}

export async function listEarnBackEventsForDate(ymd: string): Promise<EarnBackEventRow[]> {
  const { data, error } = await supabase
    .from("earn_back_events")
    .select("*")
    .eq("log_date", ymd)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EarnBackEventRow[];
}

// Log one instance of an earn-back action. Respects the daily cap.
// If the cap is hit, still logs the event with at_cap=true and 0 spoons awarded,
// which surfaces in the earn feed as "logged, at cap for today."
export async function logEarnBack(input: {
  action: EarnBackActionRow;
  durationMinutes?: number | null;
  note?: string | null;
}): Promise<{ event: EarnBackEventRow; ledger: SpoonLedgerRow }> {
  const user_id = await requireUserId();
  const today = localIsoDate();

  // Check duration threshold, if any
  if (
    input.action.duration_min_minutes != null &&
    input.durationMinutes != null &&
    input.durationMinutes < input.action.duration_min_minutes
  ) {
    throw new Error(
      `That action needs at least ${input.action.duration_min_minutes} minutes to earn.`,
    );
  }

  // Count today's events for this action
  const { data: existing, error: readErr } = await supabase
    .from("earn_back_events")
    .select("*")
    .eq("action_id", input.action.id)
    .eq("log_date", today);
  if (readErr) throw readErr;

  const already = (existing ?? []).filter((e: EarnBackEventRow) => !e.at_cap).length;
  const atCap = already >= input.action.daily_cap;
  const awarded = atCap ? 0 : Number(input.action.spoon_value);

  const now = Date.now();
  const { data: event, error: writeErr } = await supabase
    .from("earn_back_events")
    .insert({
      user_id,
      action_id: input.action.id,
      log_date: today,
      spoons_awarded: awarded,
      at_cap: atCap,
      note: input.note ?? null,
      created_at: now,
    })
    .select()
    .single();
  if (writeErr) throw writeErr;

  const ledger = await getOrCreateTodayLedger();
  const nextLedger = awarded > 0
    ? await patchLedger({ earned_back: Number(ledger.earned_back) + awarded })
    : ledger;

  return { event: event as EarnBackEventRow, ledger: nextLedger };
}

// Undo the most recent earn event for an action today.
// Only exposed on the earn feed as a per-row undo.
export async function undoEarnBack(eventId: number): Promise<SpoonLedgerRow> {
  const { data: event, error: readErr } = await supabase
    .from("earn_back_events")
    .select("*")
    .eq("id", eventId)
    .single();
  if (readErr) throw readErr;

  const { error: delErr } = await supabase
    .from("earn_back_events")
    .delete()
    .eq("id", eventId);
  if (delErr) throw delErr;

  const ledger = await getOrCreateTodayLedger();
  if (event.spoons_awarded > 0) {
    return patchLedger({
      earned_back: Math.max(0, Number(ledger.earned_back) - Number(event.spoons_awarded)),
    });
  }
  return ledger;
}

// ---------- Override events ----------
export async function logOverride(input: {
  spoonsOver: number;
  category: string;
  freeText: string;
}): Promise<OverrideEventRow> {
  const user_id = await requireUserId();
  const today = localIsoDate();
  const now = Date.now();
  const { data, error } = await supabase
    .from("override_events")
    .insert({
      user_id,
      log_date: today,
      spoons_over: input.spoonsOver,
      category: input.category,
      free_text: input.freeText || null,
      created_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return data as OverrideEventRow;
}

// Number of overrides in the last 7 days (rolling).
export async function overridesLast7Days(): Promise<number> {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const { data, error } = await supabase
    .from("override_events")
    .select("id, created_at")
    .gte("created_at", cutoff);
  if (error) throw error;
  return (data ?? []).length;
}

// ---------- Phase transitions ----------
export interface PhaseSuggestion {
  fromPhase: string | null;
  toPhase: string;
  reason: string;
}

// Rolling-window check-in analysis, returns a suggestion if the pattern
// warrants one, otherwise null.
export function analyzePhaseFromCheckins(
  checkins: BurnoutCheckinRow[],
  currentPhase: string | null,
): PhaseSuggestion | null {
  if (checkins.length < 5) return null;

  // Take the most recent 5 (and, for the higher-phase check, 7).
  const recent5 = checkins.slice(-5);
  const recent7 = checkins.slice(-7);

  const isLower = (state: string | null) =>
    state === "chasing" || state === "numbing" || state === "frozen";
  const isSteady = (state: string | null) =>
    state === "grounded" || state === "drifting";

  const allLower5 = recent5.every(
    (c) => isLower(c.state) || c.intensity >= 3,
  );
  if (allLower5 && currentPhase !== "burnout") {
    // Suggest a lower-effort phase
    let next = "rebuilding";
    if (currentPhase === "stretch") next = "steady";
    if (currentPhase === "steady") next = "rebuilding";
    if (currentPhase === "rebuilding") next = "acute_recovery";
    if (currentPhase === "acute_recovery") next = "burnout";
    return {
      fromPhase: currentPhase,
      toPhase: next,
      reason: "Your last 5 check-ins have all landed high-intensity. Shifting the phase softens the defaults.",
    };
  }

  if (recent7.length >= 7) {
    const allSteady7 = recent7.every((c) => isSteady(c.state) && c.intensity <= 2);
    if (allSteady7 && currentPhase !== "stretch") {
      let next = "steady";
      if (currentPhase === "acute_recovery") next = "rebuilding";
      if (currentPhase === "rebuilding") next = "steady";
      if (currentPhase === "steady") next = "stretch";
      return {
        fromPhase: currentPhase,
        toPhase: next,
        reason: "Your last 7 check-ins have been grounded or drifting. Ready for a bit more?",
      };
    }
  }

  return null;
}

export async function acceptPhaseTransition(sug: PhaseSuggestion): Promise<void> {
  const user_id = await requireUserId();
  const now = Date.now();
  await supabase.from("phase_transitions").insert({
    user_id,
    from_phase: sug.fromPhase,
    to_phase: sug.toPhase,
    suggested: true,
    accepted: true,
    reason: sug.reason,
    created_at: now,
  });
  await updateProfile({ current_phase: sug.toPhase as any });
}

export async function dismissPhaseTransition(sug: PhaseSuggestion): Promise<void> {
  const user_id = await requireUserId();
  const now = Date.now();
  await supabase.from("phase_transitions").insert({
    user_id,
    from_phase: sug.fromPhase,
    to_phase: sug.toPhase,
    suggested: true,
    accepted: false,
    reason: sug.reason,
    created_at: now,
  });
}

// Has the user already been suggested this exact transition in the last 3 days?
// Prevents spamming the same nudge every check-in.
export async function recentlySuggested(toPhase: string): Promise<boolean> {
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const { data, error } = await supabase
    .from("phase_transitions")
    .select("id")
    .eq("to_phase", toPhase)
    .gte("created_at", cutoff);
  if (error) throw error;
  return (data ?? []).length > 0;
}

// Re-export the profile helper so consumers can update phase directly too.
export { getOrCreateProfile };

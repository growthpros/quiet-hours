// Data-access layer for Foundation (Bottom of the Pyramid) and user profile.
// Talks to Supabase directly. Row-level security scopes everything to the user.

import { supabase } from "@/lib/supabase";
import { DEFAULT_PILLARS } from "@/lib/foundation-defaults";
import { localIsoDate } from "@/lib/local-date";

// ---------- Types ----------
export type PillarTargetType =
  | "checkbox"
  | "count"
  | "minutes"
  | "units"
  | "multiselect";

export interface FoundationPillarRow {
  id: number;
  user_id: string;
  pillar_key: string;
  custom_label: string | null;
  icon: string | null;
  target_type: PillarTargetType;
  target_value: number | null;
  unit: string | null;
  enabled: boolean;
  sort_order: number;
  created_at: number;
}

export interface DailyFoundationLogRow {
  id: number;
  user_id: string;
  pillar_id: number;
  log_date: string; // YYYY-MM-DD
  value_numeric: number | null;
  value_bool: boolean | null;
  value_json: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export type CheckinCadence =
  | "off"
  | "morning"
  | "every_hour"
  | "every_2h"
  | "every_3h"
  | "custom";

export type WeekStart = 0 | 1 | 6;

export interface UserProfileRow {
  user_id: string;
  diagnosis:
    | "adhd"
    | "autism"
    | "audhd"
    | "overwhelmed"
    | "prefer_not_to_say"
    | null;
  ocpd_aware: boolean;
  current_phase:
    | "acute_recovery"
    | "rebuilding"
    | "steady"
    | "stretch"
    | "burnout"
    | null;
  age_range: string | null;
  gender: string; // JSON array as string
  insights_opt_in: boolean;
  learning_style: "jump_in" | "guided_first_time" | "show_me_everything";
  seeded_pillars: boolean;
  checkin_cadence: CheckinCadence;
  checkin_cadence_minutes: number | null;
  // Which day the week starts: 0 Sunday, 1 Monday, 6 Saturday (migration 014).
  week_starts_on: WeekStart;
  // Spoons on an ordinary okay day, 4 to 30; null means use 12 (migration 016).
  usual_budget: number | null;
  created_at: number;
  updated_at: number;
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

// ---------- Profile ----------
// Get profile, creating a default row if none exists.
export async function getOrCreateProfile(): Promise<UserProfileRow> {
  const user_id = await requireUserId();
  const { data: existing, error: readErr } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user_id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (existing) return existing as UserProfileRow;

  const now = Date.now();
  const { data: created, error: writeErr } = await supabase
    .from("user_profiles")
    .insert({
      user_id,
      seeded_pillars: false,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (writeErr) throw writeErr;
  return created as UserProfileRow;
}

export async function updateProfile(
  patch: Partial<
    Pick<
      UserProfileRow,
      | "diagnosis"
      | "ocpd_aware"
      | "current_phase"
      | "age_range"
      | "gender"
      | "insights_opt_in"
      | "learning_style"
      | "seeded_pillars"
      | "checkin_cadence"
      | "checkin_cadence_minutes"
      | "week_starts_on"
      | "usual_budget"
    >
  >,
): Promise<UserProfileRow> {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from("user_profiles")
    .update({ ...patch, updated_at: Date.now() })
    .eq("user_id", user_id)
    .select()
    .single();
  if (error) throw error;
  return data as UserProfileRow;
}

// ---------- Pillars ----------
export async function listPillars(): Promise<FoundationPillarRow[]> {
  const { data, error } = await supabase
    .from("foundation_pillars")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FoundationPillarRow[];
}

// Seed default pillars for a new user. Runs once, guarded by profile flag.
export async function seedDefaultPillarsIfNeeded(): Promise<void> {
  const profile = await getOrCreateProfile();
  if (profile.seeded_pillars) return;

  const user_id = profile.user_id;
  const now = Date.now();
  const rows = DEFAULT_PILLARS.map((p) => ({
    user_id,
    pillar_key: p.pillarKey,
    custom_label: null,
    icon: p.icon,
    target_type: p.targetType,
    target_value: p.targetValue,
    unit: p.unit,
    enabled: p.enabled,
    sort_order: p.sortOrder,
    created_at: now,
  }));

  const { error } = await supabase.from("foundation_pillars").insert(rows);
  if (error) {
    // If the seed already happened concurrently, don't throw.
    if (!String(error.message).includes("duplicate")) throw error;
  }
  await updateProfile({ seeded_pillars: true });
}

export interface PillarPatch {
  customLabel?: string | null;
  icon?: string | null;
  targetType?: PillarTargetType;
  targetValue?: number | null;
  unit?: string | null;
  enabled?: boolean;
  sortOrder?: number;
}

export async function updatePillar(
  id: number,
  patch: PillarPatch,
): Promise<FoundationPillarRow> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.customLabel !== undefined) dbPatch.custom_label = patch.customLabel;
  if (patch.icon !== undefined) dbPatch.icon = patch.icon;
  if (patch.targetType !== undefined) dbPatch.target_type = patch.targetType;
  if (patch.targetValue !== undefined) dbPatch.target_value = patch.targetValue;
  if (patch.unit !== undefined) dbPatch.unit = patch.unit;
  if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
  if (patch.sortOrder !== undefined) dbPatch.sort_order = patch.sortOrder;

  const { data, error } = await supabase
    .from("foundation_pillars")
    .update(dbPatch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as FoundationPillarRow;
}

export async function createCustomPillar(input: {
  customLabel: string;
  icon: string;
  targetType: PillarTargetType;
  targetValue: number | null;
  unit: string | null;
  sortOrder: number;
}): Promise<FoundationPillarRow> {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from("foundation_pillars")
    .insert({
      user_id,
      pillar_key: "custom",
      custom_label: input.customLabel,
      icon: input.icon,
      target_type: input.targetType,
      target_value: input.targetValue,
      unit: input.unit,
      enabled: true,
      sort_order: input.sortOrder,
      created_at: Date.now(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as FoundationPillarRow;
}

export async function deletePillar(id: number): Promise<void> {
  const { error } = await supabase
    .from("foundation_pillars")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ---------- Daily logs ----------
export async function listTodayLogs(): Promise<DailyFoundationLogRow[]> {
  return listLogsForDate(localIsoDate());
}

export async function listLogsForDate(ymd: string): Promise<DailyFoundationLogRow[]> {
  const { data, error } = await supabase
    .from("daily_foundation_logs")
    .select("*")
    .eq("log_date", ymd);
  if (error) throw error;
  return (data ?? []) as DailyFoundationLogRow[];
}

// Upsert today's log for one pillar.
export async function upsertTodayLog(
  pillarId: number,
  patch: {
    valueNumeric?: number | null;
    valueBool?: boolean | null;
    valueJson?: string | null;
    notes?: string | null;
  },
): Promise<DailyFoundationLogRow> {
  const user_id = await requireUserId();
  const today = localIsoDate();
  const now = Date.now();

  const record = {
    user_id,
    pillar_id: pillarId,
    log_date: today,
    value_numeric:
      patch.valueNumeric === undefined ? null : patch.valueNumeric,
    value_bool: patch.valueBool === undefined ? null : patch.valueBool,
    value_json: patch.valueJson === undefined ? null : patch.valueJson,
    notes: patch.notes === undefined ? null : patch.notes,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("daily_foundation_logs")
    .upsert(record, { onConflict: "user_id,pillar_id,log_date" })
    .select()
    .single();
  if (error) throw error;
  return data as DailyFoundationLogRow;
}

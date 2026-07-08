import {
  delegationTasks,
  checklistRuns,
  compassionEntries,
  burnoutCheckins,
} from "@shared/schema";
import type {
  DelegationTask,
  InsertDelegationTask,
  ChecklistRun,
  InsertChecklistRun,
  CompassionEntry,
  InsertCompassionEntry,
  BurnoutCheckin,
  InsertBurnoutCheckin,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, gte, sql } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
export const db = drizzle(sqlite);

// Ensure tables exist (dev + first-run of deployed sandbox).
sqlite.exec(`
CREATE TABLE IF NOT EXISTS delegation_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  notes TEXT,
  urgency INTEGER NOT NULL,
  importance INTEGER NOT NULL,
  quadrant TEXT NOT NULL,
  assignee TEXT,
  released_control INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS checklist_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT NOT NULL,
  template_label TEXT NOT NULL,
  items TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  shipped INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS compassion_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger TEXT NOT NULL,
  first_thought TEXT NOT NULL,
  intensity_before INTEGER NOT NULL,
  reframe TEXT NOT NULL,
  intensity_after INTEGER NOT NULL,
  outcome TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS burnout_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  energy INTEGER NOT NULL,
  sensory INTEGER NOT NULL,
  intensity REAL NOT NULL,
  symptoms TEXT NOT NULL DEFAULT '[]',
  state TEXT,
  pulls TEXT NOT NULL DEFAULT '[]',
  note TEXT,
  created_at INTEGER NOT NULL
);
`);

// Migrate older DBs that predate `state` and `pulls` columns.
function ensureBurnoutColumns() {
  const cols = sqlite.prepare(`PRAGMA table_info(burnout_checkins)`).all() as {
    name: string;
  }[];
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("state")) {
    sqlite.exec(`ALTER TABLE burnout_checkins ADD COLUMN state TEXT`);
  }
  if (!names.has("pulls")) {
    sqlite.exec(
      `ALTER TABLE burnout_checkins ADD COLUMN pulls TEXT NOT NULL DEFAULT '[]'`
    );
  }
}
ensureBurnoutColumns();

function classifyQuadrant(urgency: number, importance: number): string {
  const highU = urgency >= 3;
  const highI = importance >= 3;
  if (highU && highI) return "do";
  if (!highU && highI) return "schedule";
  if (highU && !highI) return "delegate";
  return "drop";
}

export interface IStorage {
  // Delegation
  listDelegationTasks(): Promise<DelegationTask[]>;
  createDelegationTask(data: InsertDelegationTask): Promise<DelegationTask>;
  updateDelegationTask(
    id: number,
    data: Partial<InsertDelegationTask> & {
      releasedControl?: number;
      completed?: number;
    }
  ): Promise<DelegationTask | undefined>;
  deleteDelegationTask(id: number): Promise<void>;

  // Checklists
  listChecklistRuns(): Promise<ChecklistRun[]>;
  createChecklistRun(data: InsertChecklistRun): Promise<ChecklistRun>;
  updateChecklistRun(
    id: number,
    data: Partial<{ items: string; completed: number; shipped: number }>
  ): Promise<ChecklistRun | undefined>;
  deleteChecklistRun(id: number): Promise<void>;

  // Compassion
  listCompassionEntries(): Promise<CompassionEntry[]>;
  createCompassionEntry(
    data: InsertCompassionEntry
  ): Promise<CompassionEntry>;
  deleteCompassionEntry(id: number): Promise<void>;

  // Burnout
  listBurnoutCheckins(sinceMs?: number): Promise<BurnoutCheckin[]>;
  createBurnoutCheckin(data: InsertBurnoutCheckin): Promise<BurnoutCheckin>;
  deleteBurnoutCheckin(id: number): Promise<void>;
  clearBurnoutCheckinsSince(sinceMs: number): Promise<{ changes: number }>;
}

export class DatabaseStorage implements IStorage {
  // -------- Delegation --------
  async listDelegationTasks(): Promise<DelegationTask[]> {
    return db
      .select()
      .from(delegationTasks)
      .orderBy(desc(delegationTasks.createdAt))
      .all();
  }

  async createDelegationTask(data: InsertDelegationTask) {
    const quadrant = classifyQuadrant(data.urgency, data.importance);
    return db
      .insert(delegationTasks)
      .values({ ...data, quadrant, createdAt: Date.now() })
      .returning()
      .get();
  }

  async updateDelegationTask(id: number, data: any) {
    const patch: any = { ...data };
    if (patch.urgency !== undefined && patch.importance !== undefined) {
      patch.quadrant = classifyQuadrant(patch.urgency, patch.importance);
    }
    return db
      .update(delegationTasks)
      .set(patch)
      .where(eq(delegationTasks.id, id))
      .returning()
      .get();
  }

  async deleteDelegationTask(id: number) {
    db.delete(delegationTasks).where(eq(delegationTasks.id, id)).run();
  }

  // -------- Checklists --------
  async listChecklistRuns(): Promise<ChecklistRun[]> {
    return db
      .select()
      .from(checklistRuns)
      .orderBy(desc(checklistRuns.createdAt))
      .all();
  }

  async createChecklistRun(data: InsertChecklistRun) {
    return db
      .insert(checklistRuns)
      .values({ ...data, createdAt: Date.now() })
      .returning()
      .get();
  }

  async updateChecklistRun(id: number, data: any) {
    return db
      .update(checklistRuns)
      .set(data)
      .where(eq(checklistRuns.id, id))
      .returning()
      .get();
  }

  async deleteChecklistRun(id: number) {
    db.delete(checklistRuns).where(eq(checklistRuns.id, id)).run();
  }

  // -------- Compassion --------
  async listCompassionEntries(): Promise<CompassionEntry[]> {
    return db
      .select()
      .from(compassionEntries)
      .orderBy(desc(compassionEntries.createdAt))
      .all();
  }

  async createCompassionEntry(data: InsertCompassionEntry) {
    return db
      .insert(compassionEntries)
      .values({ ...data, createdAt: Date.now() })
      .returning()
      .get();
  }

  async deleteCompassionEntry(id: number) {
    db.delete(compassionEntries).where(eq(compassionEntries.id, id)).run();
  }

  // -------- Burnout --------
  async listBurnoutCheckins(sinceMs?: number): Promise<BurnoutCheckin[]> {
    if (sinceMs !== undefined) {
      return db
        .select()
        .from(burnoutCheckins)
        .where(gte(burnoutCheckins.createdAt, sinceMs))
        .orderBy(burnoutCheckins.createdAt)
        .all();
    }
    return db
      .select()
      .from(burnoutCheckins)
      .orderBy(burnoutCheckins.createdAt)
      .all();
  }

  async createBurnoutCheckin(data: InsertBurnoutCheckin) {
    const intensity = (data.sensory + (6 - data.energy)) / 2;
    return db
      .insert(burnoutCheckins)
      .values({ ...data, intensity, createdAt: Date.now() })
      .returning()
      .get();
  }

  async deleteBurnoutCheckin(id: number) {
    db.delete(burnoutCheckins).where(eq(burnoutCheckins.id, id)).run();
  }

  async clearBurnoutCheckinsSince(sinceMs: number) {
    const res = db
      .delete(burnoutCheckins)
      .where(gte(burnoutCheckins.createdAt, sinceMs))
      .run();
    return { changes: res.changes };
  }
}

export const storage = new DatabaseStorage();

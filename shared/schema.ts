import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------- Delegation tasks ----------
// Urgency & importance 1–5; quadrant is derived server-side but stored for filtering.
// releasedControl only meaningful for Delegate quadrant.
export const delegationTasks = sqliteTable("delegation_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  notes: text("notes"),
  urgency: integer("urgency").notNull(),
  importance: integer("importance").notNull(),
  quadrant: text("quadrant").notNull(), // do | schedule | delegate | drop
  assignee: text("assignee"),
  releasedControl: integer("released_control").notNull().default(0),
  completed: integer("completed").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const insertDelegationTaskSchema = createInsertSchema(delegationTasks)
  .omit({ id: true, createdAt: true, quadrant: true });

export type InsertDelegationTask = z.infer<typeof insertDelegationTaskSchema>;
export type DelegationTask = typeof delegationTasks.$inferSelect;

// ---------- Good Enough checklists (running instances) ----------
// items stored as JSON: [{ id, label, required, done }]
export const checklistRuns = sqliteTable("checklist_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  templateKey: text("template_key").notNull(), // e.g. "internal_email" or "custom"
  templateLabel: text("template_label").notNull(),
  items: text("items").notNull(), // JSON
  completed: integer("completed").notNull().default(0),
  shipped: integer("shipped").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const insertChecklistRunSchema = createInsertSchema(checklistRuns)
  .omit({ id: true, createdAt: true, completed: true, shipped: true });

export type InsertChecklistRun = z.infer<typeof insertChecklistRunSchema>;
export type ChecklistRun = typeof checklistRuns.$inferSelect;

// ---------- Self-compassion log ----------
export const compassionEntries = sqliteTable("compassion_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trigger: text("trigger").notNull(),
  firstThought: text("first_thought").notNull(),
  intensityBefore: integer("intensity_before").notNull(), // 1–10
  reframe: text("reframe").notNull(),
  intensityAfter: integer("intensity_after").notNull(), // 1–10
  outcome: text("outcome"),
  createdAt: integer("created_at").notNull(),
});

export const insertCompassionEntrySchema = createInsertSchema(compassionEntries)
  .omit({ id: true, createdAt: true });

export type InsertCompassionEntry = z.infer<typeof insertCompassionEntrySchema>;
export type CompassionEntry = typeof compassionEntries.$inferSelect;

// ---------- Burnout check-ins ----------
// energy & sensory 1–5; intensity computed as (sensory + (6 - energy)) / 2.
// symptoms stored as JSON string array.
// state: one of grounded | drifting | chasing | numbing | frozen (nullable for older rows)
// pulls: JSON array of what pulled you (phone, news, side-project, etc.)
export const burnoutCheckins = sqliteTable("burnout_checkins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  energy: integer("energy").notNull(),
  sensory: integer("sensory").notNull(),
  intensity: real("intensity").notNull(),
  symptoms: text("symptoms").notNull().default("[]"), // JSON
  state: text("state"), // grounded|drifting|chasing|numbing|frozen | null
  pulls: text("pulls").notNull().default("[]"), // JSON
  note: text("note"),
  createdAt: integer("created_at").notNull(),
});

export const insertBurnoutCheckinSchema = createInsertSchema(burnoutCheckins)
  .omit({ id: true, createdAt: true, intensity: true });

export type InsertBurnoutCheckin = z.infer<typeof insertBurnoutCheckinSchema>;
export type BurnoutCheckin = typeof burnoutCheckins.$inferSelect;

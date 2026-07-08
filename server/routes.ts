import type { Express, Request, Response } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { storage } from "./storage";
import {
  insertDelegationTaskSchema,
  insertChecklistRunSchema,
  insertCompassionEntrySchema,
  insertBurnoutCheckinSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ---- Delegation ----
  app.get("/api/delegation", async (_req, res) => {
    res.json(await storage.listDelegationTasks());
  });

  app.post("/api/delegation", async (req, res) => {
    const parsed = insertDelegationTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.json(await storage.createDelegationTask(parsed.data));
  });

  app.patch("/api/delegation/:id", async (req, res) => {
    const id = Number(req.params.id);
    const patchSchema = insertDelegationTaskSchema.partial().extend({
      releasedControl: z.number().optional(),
      completed: z.number().optional(),
    });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const updated = await storage.updateDelegationTask(id, parsed.data);
    if (!updated) return res.status(404).json({ error: "not found" });
    res.json(updated);
  });

  app.delete("/api/delegation/:id", async (req, res) => {
    await storage.deleteDelegationTask(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---- Checklists ----
  app.get("/api/checklists", async (_req, res) => {
    res.json(await storage.listChecklistRuns());
  });

  app.post("/api/checklists", async (req, res) => {
    const parsed = insertChecklistRunSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.json(await storage.createChecklistRun(parsed.data));
  });

  app.patch("/api/checklists/:id", async (req, res) => {
    const id = Number(req.params.id);
    const schema = z.object({
      items: z.string().optional(),
      completed: z.number().optional(),
      shipped: z.number().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    const updated = await storage.updateChecklistRun(id, parsed.data);
    if (!updated) return res.status(404).json({ error: "not found" });
    res.json(updated);
  });

  app.delete("/api/checklists/:id", async (req, res) => {
    await storage.deleteChecklistRun(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---- Compassion ----
  app.get("/api/compassion", async (_req, res) => {
    res.json(await storage.listCompassionEntries());
  });

  app.post("/api/compassion", async (req, res) => {
    const parsed = insertCompassionEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.json(await storage.createCompassionEntry(parsed.data));
  });

  app.delete("/api/compassion/:id", async (req, res) => {
    await storage.deleteCompassionEntry(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---- Burnout ----
  app.get("/api/burnout", async (req, res) => {
    const since = req.query.since ? Number(req.query.since) : undefined;
    res.json(await storage.listBurnoutCheckins(since));
  });

  app.post("/api/burnout", async (req, res) => {
    const parsed = insertBurnoutCheckinSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error);
    res.json(await storage.createBurnoutCheckin(parsed.data));
  });

  app.delete("/api/burnout/:id", async (req, res) => {
    await storage.deleteBurnoutCheckin(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/burnout/clear-today", async (_req, res) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const result = await storage.clearBurnoutCheckinsSince(d.getTime());
    res.json(result);
  });

  // Compute consecutive-day streaks by state, ending on today or yesterday.
  // Returns { numbing: { streak, endedYesterday }, drifting: {...}, ... }.
  // We count a "day" as having at least one check-in tagged with that state.
  app.get("/api/burnout/streaks", async (_req, res) => {
    // Look back 30 days; if you skipped a day entirely we treat it as a break.
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 30);
    const rows = await storage.listBurnoutCheckins(start.getTime());

    // Bucket into local-day sets of states
    const dayKey = (ms: number) => {
      const d = new Date(ms);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };
    const byDay = new Map<string, Set<string>>();
    for (const r of rows) {
      const s = (r as unknown as { state?: string | null }).state;
      if (!s) continue;
      const k = dayKey(r.createdAt);
      if (!byDay.has(k)) byDay.set(k, new Set());
      byDay.get(k)!.add(s);
    }

    const states = ["grounded", "drifting", "chasing", "numbing", "frozen"];
    const out: Record<string, { streak: number; endedYesterday: boolean }> = {};
    for (const st of states) {
      let streak = 0;
      let endedYesterday = false;
      // Walk backwards from today
      const cursor = new Date(now);
      cursor.setHours(0, 0, 0, 0);
      // If today has the state, start counting from today; else from yesterday
      const todayKey = dayKey(cursor.getTime());
      const hasToday = byDay.get(todayKey)?.has(st) ?? false;
      if (!hasToday) {
        cursor.setDate(cursor.getDate() - 1);
        endedYesterday = true;
      }
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
    res.json(out);
  });

  return httpServer;
}

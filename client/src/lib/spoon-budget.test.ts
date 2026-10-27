import { describe, it, expect } from "vitest";
import {
  STARTING_BUDGET,
  dayBudget,
  spentToday,
  spoonsOverIfAdded,
  todayBudget,
  usualBudget,
} from "@/lib/spoon-budget";

// Tests run in US Eastern time (see vitest.config.ts).
const TODAY = "2026-10-21";
const at = (iso: string, hour: number) => new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00`).getTime();
const t = (o: Partial<{ spoon_estimate: number | null; estimated_hours: number | null; complexity: "low" | "medium" | "high" | null; completed_at: number | null; due_date: string | null; due_bucket: "today" | "this_week" | null; archived_at: string | null }>) => ({
  spoon_estimate: null, completed_at: null, due_date: null, due_bucket: null, archived_at: null, recurring_template_id: null, ...o,
});

describe("your usual budget", () => {
  it("is the starting budget with no check-ins yet", () => {
    expect(usualBudget([])).toBe(STARTING_BUDGET);
    expect(usualBudget([0, 0])).toBe(STARTING_BUDGET);
  });
  it("is the middle of the last 14 check-in budgets, to the half spoon", () => {
    expect(usualBudget([10, 14, 11])).toBe(11);
    expect(usualBudget([10, 11, 12, 15])).toBe(11.5);
    expect(usualBudget([9, 9.5])).toBe(9.5); // 9.25 rounds to the nearest half
  });
  it("only looks at the 14 most recent", () => {
    const recent = Array(14).fill(8);
    expect(usualBudget([...recent, 20, 20, 20, 20, 20])).toBe(8);
  });
});

describe("today's budget", () => {
  it("uses the check-in plus earned back once there's a check-in", () => {
    expect(todayBudget({ allotted: 10, spent: 0, earned_back: 1.5 }, 12)).toEqual({ budget: 11.5, fromCheckin: true });
  });
  it("uses your usual before the check-in, so there's always a budget", () => {
    expect(todayBudget({ allotted: 0, spent: 0, earned_back: 0 }, 11)).toEqual({ budget: 11, fromCheckin: false });
    expect(todayBudget(null, 11)).toEqual({ budget: 11, fromCheckin: false });
  });
});

describe("spent today", () => {
  it("counts tasks finished today in the person's own time zone, plus logged spending", () => {
    const tasks = [
      t({ spoon_estimate: 2, completed_at: at(TODAY, 9) }),
      t({ spoon_estimate: 3, completed_at: at(TODAY, 23) }), // 11pm Eastern is still today
      t({ spoon_estimate: 4, completed_at: at("2026-10-20", 22) }), // yesterday
    ];
    expect(spentToday(tasks, 1, TODAY)).toBe(6);
  });
});

describe("adding to today", () => {
  const ledger = { allotted: 10, spent: 0, earned_back: 0 };
  it("includes spoons from tasks already finished today (they used to be left out)", () => {
    const tasks = [
      t({ spoon_estimate: 4, due_date: TODAY, completed_at: at(TODAY, 9) }),
      t({ spoon_estimate: 5, due_bucket: "today" }),
    ];
    // 4 finished + 5 planned + 2 new = 11, one over 10
    expect(spoonsOverIfAdded(tasks, ledger, 12, TODAY, 2)).toBe(1);
  });
  it("checks against your usual before the check-in (it used to skip the check)", () => {
    const tasks = [t({ spoon_estimate: 9, due_bucket: "today" })];
    expect(spoonsOverIfAdded(tasks, { allotted: 0, spent: 0, earned_back: 0 }, 10, TODAY, 3)).toBe(2);
  });
  it("counts a task with a time but no typed spoons (it used to count as 0)", () => {
    // "Plan my week", 1 hour, no effort picked: 2 spoons.
    const tasks = [t({ estimated_hours: 1, due_bucket: "today" }), t({ spoon_estimate: 7, due_bucket: "today" })];
    expect(spoonsOverIfAdded(tasks, ledger, 12, TODAY, 2)).toBe(1);
  });
  it("uses a typed number over the math", () => {
    const tasks = [t({ spoon_estimate: 1, estimated_hours: 4, complexity: "high", due_bucket: "today" })];
    expect(spoonsOverIfAdded(tasks, ledger, 12, TODAY, 9)).toBe(0);
  });
  it("counts worked-out spoons for tasks finished today", () => {
    expect(spentToday([t({ estimated_hours: 0.5, complexity: "high", completed_at: at(TODAY, 10) })], 0, TODAY)).toBe(1.5);
  });
  it("is 0 when it fits, or when the task has no spoons", () => {
    expect(spoonsOverIfAdded([], ledger, 12, TODAY, 4)).toBe(0);
    expect(spoonsOverIfAdded([t({ spoon_estimate: 10, due_bucket: "today" })], ledger, 12, TODAY, 0)).toBe(0);
  });
});

describe("amber on the Calendar", () => {
  const ledger = { allotted: 8, spent: 0, earned_back: 0 };
  it("today compares spent plus planned with today's budget", () => {
    const tasks = [t({ spoon_estimate: 3, completed_at: at(TODAY, 8) })];
    const today = { iso: TODAY, isToday: true, isPast: false, openSpoons: 6 };
    expect(dayBudget(today, tasks, ledger, 12)).toEqual({ budget: 8, load: 9, over: true, basis: "checkin" });
  });
  it("future days compare their plan with your usual", () => {
    const fri = { iso: "2026-10-23", isToday: false, isPast: false, openSpoons: 12.5 };
    expect(dayBudget(fri, [], ledger, 12)).toEqual({ budget: 12, load: 12.5, over: true, basis: "usual" });
    expect(dayBudget({ ...fri, openSpoons: 12 }, [], ledger, 12)!.over).toBe(false);
  });
  it("past days get no amber", () => {
    expect(dayBudget({ iso: "2026-10-19", isToday: false, isPast: true, openSpoons: 40 }, [], ledger, 12)).toBeNull();
  });
});

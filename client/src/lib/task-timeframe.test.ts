import { describe, it, expect } from "vitest";
import { isOnToday, isMissed, matchesTimeframe, weekRange, committedSpoonsToday } from "@/lib/task-timeframe";
import type { TaskRow } from "@/lib/tasks-data";

// "Today" in these tests is Wednesday, Oct 21, 2026.
// This week runs Sun Oct 18 to Sat Oct 24; next week Sun Oct 25 to Sat Oct 31.
const TODAY = "2026-10-21";

type T = Pick<TaskRow, "completed_at" | "archived_at" | "due_date" | "due_bucket" | "recurring_template_id">;
const task = (o: Partial<T>): T => ({
  completed_at: null,
  archived_at: null,
  due_date: null,
  due_bucket: null,
  recurring_template_id: null,
  ...o,
});

const cases: { name: string; t: T; today: boolean; missed: boolean }[] = [
  { name: "due today", t: task({ due_date: "2026-10-21" }), today: true, missed: false },
  { name: "in the Today bucket, no date", t: task({ due_bucket: "today" }), today: true, missed: false },
  { name: "carried over (Today bucket, dated yesterday)", t: task({ due_bucket: "today", due_date: "2026-10-20" }), today: true, missed: false },
  { name: "in the This week bucket", t: task({ due_bucket: "this_week" }), today: false, missed: false },
  { name: "due tomorrow", t: task({ due_date: "2026-10-22" }), today: false, missed: false },
  { name: "in the Later bucket", t: task({ due_bucket: "later" }), today: false, missed: false },
  { name: "finished today", t: task({ due_date: "2026-10-21", completed_at: 1 }), today: false, missed: false },
  { name: "archived", t: task({ due_bucket: "today", archived_at: "2026-10-20T10:00:00Z" }), today: false, missed: false },
  { name: "one-off pinned to a past date", t: task({ due_date: "2026-10-19", due_bucket: "this_week" }), today: false, missed: true },
  { name: "recurring repeat from yesterday", t: task({ due_date: "2026-10-20", due_bucket: "today", recurring_template_id: 7 }), today: false, missed: true },
  { name: "recurring repeat for today", t: task({ due_date: "2026-10-21", recurring_template_id: 7 }), today: true, missed: false },
];

describe("isOnToday and isMissed", () => {
  for (const c of cases) {
    it(c.name, () => {
      expect(isOnToday(c.t, TODAY)).toBe(c.today);
      expect(isMissed(c.t, TODAY)).toBe(c.missed);
    });
  }
});

describe("weekRange", () => {
  it("this week is Sunday to Saturday", () => {
    expect(weekRange(TODAY, 0)).toEqual({ start: "2026-10-18", end: "2026-10-24" });
  });
  it("next week is the following Sunday to Saturday", () => {
    expect(weekRange(TODAY, 1)).toEqual({ start: "2026-10-25", end: "2026-10-31" });
  });
  it("works on a Sunday and a Saturday", () => {
    expect(weekRange("2026-10-18", 0).start).toBe("2026-10-18");
    expect(weekRange("2026-10-24", 0).end).toBe("2026-10-24");
  });
});

describe("matchesTimeframe", () => {
  const show = (t: T) => ({
    today: matchesTimeframe(t, "today", TODAY),
    this_week: matchesTimeframe(t, "this_week", TODAY),
    next_week: matchesTimeframe(t, "next_week", TODAY),
    this_month: matchesTimeframe(t, "this_month", TODAY),
    all: matchesTimeframe(t, "all", TODAY),
  });

  it("a task due today shows in today, this week, this month", () => {
    expect(show(task({ due_date: "2026-10-21" }))).toEqual({ today: true, this_week: true, next_week: false, this_month: true, all: true });
  });
  it("a task due Saturday shows in this week and this month, not today", () => {
    expect(show(task({ due_date: "2026-10-24" }))).toEqual({ today: false, this_week: true, next_week: false, this_month: true, all: true });
  });
  it("a task due next Tuesday shows in next week and this month", () => {
    expect(show(task({ due_date: "2026-10-27" }))).toEqual({ today: false, this_week: false, next_week: true, this_month: true, all: true });
  });
  it("a Next week bucket task shows in next week (and this month, since next week starts in October)", () => {
    expect(show(task({ due_bucket: "next_week" }))).toEqual({ today: false, this_week: false, next_week: true, this_month: true, all: true });
  });
  it("a task due in November shows only under all", () => {
    expect(show(task({ due_date: "2026-11-05" }))).toEqual({ today: false, this_week: false, next_week: false, this_month: false, all: true });
  });
  it("a Later bucket task shows only under all", () => {
    expect(show(task({ due_bucket: "later" }))).toEqual({ today: false, this_week: false, next_week: false, this_month: false, all: true });
  });
  it("a missed task stays out of every timeframe except all", () => {
    expect(show(task({ due_date: "2026-10-19", due_bucket: "this_week" }))).toEqual({ today: false, this_week: false, next_week: false, this_month: false, all: true });
  });
  it("a finished task shows nowhere", () => {
    expect(show(task({ due_date: "2026-10-21", completed_at: 1 }))).toEqual({ today: false, this_week: false, next_week: false, this_month: false, all: false });
  });
});

describe("committedSpoonsToday", () => {
  it("counts only today's unfinished tasks", () => {
    const tasks = [
      { ...task({ due_bucket: "today" }), spoon_estimate: 2 },
      { ...task({ due_date: "2026-10-21" }), spoon_estimate: 1.5 },
      { ...task({ due_bucket: "today", due_date: "2026-10-20" }), spoon_estimate: 1 }, // carried over
      { ...task({ due_bucket: "this_week" }), spoon_estimate: 5 },
      { ...task({ due_date: "2026-10-27" }), spoon_estimate: 8 },
      { ...task({ due_bucket: "later" }), spoon_estimate: 20 },
      { ...task({ due_bucket: "today", completed_at: 1 }), spoon_estimate: 3 },
      { ...task({ due_bucket: "today", archived_at: "2026-10-01T00:00:00Z" }), spoon_estimate: 4 },
      { ...task({ due_bucket: "today" }), spoon_estimate: null },
    ];
    expect(committedSpoonsToday(tasks, TODAY)).toBe(4.5);
  });
});

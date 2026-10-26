import { describe, it, expect } from "vitest";
import { canDropOn, dropRange } from "@/lib/task-move";
import type { RecurringTemplateRow } from "@/lib/recurring-data";

const TODAY = "2026-10-21"; // Wednesday
const weeklyWed = {
  id: 9, pattern_type: "weekly", interval_n: 1, days_of_week: [3],
  start_date: "2026-10-01", end_date: null, end_after_n: null,
  monthly_kind: null, day_of_month: null, nth_weekday: null, nth_weekday_day: null,
} as unknown as RecurringTemplateRow;
const daily = { ...weeklyWed, pattern_type: "daily", days_of_week: [] } as unknown as RecurringTemplateRow;

describe("dragging a task onto a day", () => {
  it("a one-time task can land on today or any later day, never the past", () => {
    const r = dropRange({ completed_at: null, recurring_template_id: null, due_date: "2026-10-19" }, null, TODAY);
    expect(canDropOn(r, TODAY)).toBe(true);
    expect(canDropOn(r, "2027-03-01")).toBe(true);
    expect(canDropOn(r, "2026-10-20")).toBe(false);
  });

  it("a weekly repeat can land only on days before its next occurrence", () => {
    const r = dropRange({ completed_at: null, recurring_template_id: 9, due_date: TODAY }, weeklyWed, TODAY);
    expect(canDropOn(r, "2026-10-22")).toBe(true);
    expect(canDropOn(r, "2026-10-27")).toBe(true);
    expect(canDropOn(r, "2026-10-28")).toBe(false); // the next one
    expect(canDropOn(r, TODAY)).toBe(false); // already there
  });

  it("a daily repeat, a done task, or a repeat whose schedule is missing can't be dragged", () => {
    expect(dropRange({ completed_at: null, recurring_template_id: 9, due_date: TODAY }, daily, TODAY)).toBeNull();
    expect(dropRange({ completed_at: 1, recurring_template_id: null, due_date: TODAY }, null, TODAY)).toBeNull();
    expect(dropRange({ completed_at: null, recurring_template_id: 9, due_date: TODAY }, null, TODAY)).toBeNull();
  });
});

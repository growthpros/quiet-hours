import { describe, it, expect } from "vitest";
import { expandPattern } from "@/lib/recurring-resolver";
import type { RecurringTemplateRow } from "@/lib/recurring-data";

// expandPattern answers: "between these two dates, which days should a
// repeating task appear on?" It works on plain YYYY-MM-DD dates, so these
// tests use fixed dates and never depend on today's date or time zone.
//
// Calendar reference for 2026: Jan 1 is a Thursday, Mar 1 is a Sunday.

function template(overrides: Partial<RecurringTemplateRow>): RecurringTemplateRow {
  return {
    id: 1,
    user_id: "00000000-0000-0000-0000-000000000000",
    title: "Test task",
    notes: null,
    spoon_estimate: 0.5,
    estimated_hours: 0.5,
    complexity: "low", social_load: false, dread: false,
    billable: false,
    client_id: null,
    project_id: null,
    tag_ids: [],
    pattern_type: "daily",
    interval_n: 1,
    days_of_week: [],
    monthly_kind: null,
    day_of_month: null,
    nth_weekday: null,
    nth_weekday_day: null,
    start_date: "2026-03-01",
    end_date: null,
    end_after_n: null,
    occurrences_generated: 0,
    last_generated_for: null,
    on_miss: "ask_me",
    active: true,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    ...overrides,
  };
}

describe("expandPattern", () => {
  it("daily, every day", () => {
    const t = template({ pattern_type: "daily", interval_n: 1 });
    expect(expandPattern(t, "2026-03-01", "2026-03-03")).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
  });

  it("daily, every 3 days", () => {
    const t = template({ pattern_type: "daily", interval_n: 3 });
    expect(expandPattern(t, "2026-03-01", "2026-03-10")).toEqual([
      "2026-03-01",
      "2026-03-04",
      "2026-03-07",
      "2026-03-10",
    ]);
  });

  it("weekly on Monday, Wednesday and Friday", () => {
    const t = template({
      pattern_type: "weekly",
      days_of_week: [1, 3, 5],
      start_date: "2026-03-02",
    });
    expect(expandPattern(t, "2026-03-02", "2026-03-08")).toEqual([
      "2026-03-02",
      "2026-03-04",
      "2026-03-06",
    ]);
  });

  it("every other Friday", () => {
    const t = template({
      pattern_type: "weekly",
      interval_n: 2,
      days_of_week: [5],
      start_date: "2026-03-06",
    });
    expect(expandPattern(t, "2026-03-01", "2026-03-31")).toEqual([
      "2026-03-06",
      "2026-03-20",
    ]);
  });

  it("monthly on the 15th", () => {
    const t = template({
      pattern_type: "monthly",
      monthly_kind: "day_of_month",
      day_of_month: 15,
      start_date: "2026-01-15",
    });
    expect(expandPattern(t, "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
  });

  it("monthly on the 31st skips months without one", () => {
    const t = template({
      pattern_type: "monthly",
      monthly_kind: "day_of_month",
      day_of_month: 31,
      start_date: "2026-01-31",
    });
    expect(expandPattern(t, "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-03-31",
    ]);
  });

  it("monthly on the second Tuesday", () => {
    const t = template({
      pattern_type: "monthly",
      monthly_kind: "nth_weekday",
      nth_weekday: 2,
      nth_weekday_day: 2,
      start_date: "2026-01-01",
    });
    expect(expandPattern(t, "2026-01-01", "2026-03-31")).toEqual([
      "2026-01-13",
      "2026-02-10",
      "2026-03-10",
    ]);
  });

  it("stops at the end date", () => {
    const t = template({ pattern_type: "daily", end_date: "2026-03-03" });
    expect(expandPattern(t, "2026-03-01", "2026-03-10")).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
  });

  it("returns nothing for a window before the start date", () => {
    const t = template({ pattern_type: "daily", start_date: "2026-03-10" });
    expect(expandPattern(t, "2026-03-01", "2026-03-05")).toEqual([]);
  });
});

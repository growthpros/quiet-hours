import { describe, it, expect } from "vitest";
import { timeframeWindow, upcomingInWindow } from "@/lib/upcoming-repeats";
import type { RecurringTemplateRow } from "@/lib/recurring-data";
import type { TaskRow } from "@/lib/tasks-data";

// Today is Sunday, Oct 25, 2026.
const TODAY = "2026-10-25";

function template(o: Partial<RecurringTemplateRow>): RecurringTemplateRow {
  return {
    id: 1, user_id: "u", title: "Repeat", notes: null, spoon_estimate: 1,
    estimated_hours: 0.5, complexity: "low" as RecurringTemplateRow["complexity"], social_load: false, dread: false,
    billable: false, client_id: null, project_id: null, tag_ids: [],
    pattern_type: "daily", interval_n: 1, days_of_week: [],
    monthly_kind: null, day_of_month: null, nth_weekday: null, nth_weekday_day: null,
    start_date: "2026-10-01", end_date: null, end_after_n: null, occurrences_generated: 0,
    last_generated_for: TODAY, on_miss: "let_it_go", active: true,
    created_at: "", updated_at: "", ...o,
  };
}
const daily = template({ id: 1, title: "Daily" });
const sundays = template({ id: 2, title: "Sundays", pattern_type: "weekly", days_of_week: [0] });
const counts = (tf: Parameters<typeof timeframeWindow>[0], picked?: string, ws: 0 | 1 = 0, tasks: TaskRow[] = []) => {
  const w = timeframeWindow(tf, TODAY, picked, ws);
  return w ? upcomingInWindow([daily, sundays], tasks, TODAY, w).map((u) => `${u.template.title}:${u.count}`) : null;
};

describe("timeframeWindow", () => {
  it("covers the right days for each choice", () => {
    expect(timeframeWindow("tomorrow", TODAY, undefined)).toEqual({ start: "2026-10-26", end: "2026-10-26" });
    expect(timeframeWindow("next_week", TODAY, undefined, 1)).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(timeframeWindow("this_month", TODAY, undefined)).toEqual({ start: TODAY, end: "2026-10-31" });
    expect(timeframeWindow("this_month", "2028-02-10", undefined)!.end).toBe("2028-02-29");
  });
  it("has nothing for today, all, or a picked day that isn't in the future", () => {
    expect(timeframeWindow("today", TODAY, undefined)).toBeNull();
    expect(timeframeWindow("all", TODAY, undefined)).toBeNull();
    expect(timeframeWindow("date", TODAY, TODAY)).toBeNull();
    expect(timeframeWindow("date", TODAY, "2026-10-20")).toBeNull();
  });
});

describe("upcomingInWindow", () => {
  it("a single future day lists that day's repeats once each", () => {
    expect(counts("tomorrow")).toEqual(["Daily:1"]);
    expect(counts("date", "2026-11-01")).toEqual(["Daily:1", "Sundays:1"]);
  });
  it("a range lists each repeat once with how many times", () => {
    expect(counts("next_week", undefined, 1)).toEqual(["Daily:7", "Sundays:1"]);
    expect(counts("this_month")).toEqual(["Daily:6"]); // Oct 26 to 31
  });
  it("this week counts only the days still ahead", () => {
    // Sunday weeks: Oct 25 to 31, and today's repeats are already tasks.
    expect(counts("this_week")).toEqual(["Daily:6"]);
  });
  it("leaves out a day that already has the real task", () => {
    const moved = { recurring_template_id: 1, due_date: "2026-10-26" } as TaskRow;
    expect(counts("tomorrow", undefined, 0, [moved])).toEqual([]);
  });
});

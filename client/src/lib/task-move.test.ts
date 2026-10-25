import { describe, it, expect } from "vitest";
import {
  isoAddDays,
  whenForChoice,
  whenForDate,
  describeWhen,
  repeatMoveWindow,
  repeatQuickChoices,
  whenForRepeatChoice,
  MOVE_CHOICES,
} from "@/lib/task-move";
import { matchesTimeframe } from "@/lib/task-timeframe";
import type { RecurringTemplateRow } from "@/lib/recurring-data";

// "Today" is Wednesday, Oct 21, 2026.
const TODAY = "2026-10-21";

function template(o: Partial<RecurringTemplateRow>): RecurringTemplateRow {
  return {
    id: 1, user_id: "u", title: "t", notes: null, spoon_estimate: 1, estimated_hours: 0.5,
    complexity: "low", billable: false, client_id: null, project_id: null, tag_ids: [],
    pattern_type: "daily", interval_n: 1, days_of_week: [], monthly_kind: null,
    day_of_month: null, nth_weekday: null, nth_weekday_day: null, start_date: "2026-10-01",
    end_date: null, end_after_n: null, occurrences_generated: 0, last_generated_for: null,
    on_miss: "ask_me", active: true, created_at: "", updated_at: "", ...o,
  };
}

describe("isoAddDays", () => {
  it("adds and subtracts days across month and year ends", () => {
    expect(isoAddDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(isoAddDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(isoAddDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("moving a one-off task", () => {
  it("each choice sets one answer to 'when' and clears the other", () => {
    expect(whenForChoice("today", TODAY)).toEqual({ dueDate: null, dueBucket: "today" });
    expect(whenForChoice("tomorrow", TODAY)).toEqual({ dueDate: "2026-10-22", dueBucket: null });
    expect(whenForChoice("next_week", TODAY)).toEqual({ dueDate: null, dueBucket: "next_week" });
    expect(whenForChoice("later", TODAY)).toEqual({ dueDate: null, dueBucket: "later" });
    expect(whenForDate("2026-11-03")).toEqual({ dueDate: "2026-11-03", dueBucket: null });
  });

  it("after a move, the task shows under the matching Tasks filter", () => {
    const base = { completed_at: null, archived_at: null, recurring_template_id: null };
    const as = (w: ReturnType<typeof whenForChoice>) => ({ ...base, due_date: w.dueDate, due_bucket: w.dueBucket });
    expect(matchesTimeframe(as(whenForChoice("today", TODAY)), "today", TODAY)).toBe(true);
    expect(matchesTimeframe(as(whenForChoice("tomorrow", TODAY)), "tomorrow", TODAY)).toBe(true);
    expect(matchesTimeframe(as(whenForChoice("tomorrow", TODAY)), "today", TODAY)).toBe(false);
    expect(matchesTimeframe(as(whenForChoice("next_week", TODAY)), "next_week", TODAY)).toBe(true);
    expect(matchesTimeframe(as(whenForChoice("later", TODAY)), "this_month", TODAY)).toBe(false);
  });

  it("describes where the task went", () => {
    expect(describeWhen(whenForChoice("tomorrow", TODAY), TODAY)).toBe("tomorrow");
    expect(describeWhen(whenForChoice("next_week", TODAY), TODAY)).toBe("next week");
    expect(describeWhen(whenForChoice("today", TODAY), TODAY)).toBe("today");
  });

  it("offers all seven choices", () => {
    expect(MOVE_CHOICES).toEqual(["today", "tomorrow", "this_week", "next_week", "this_month", "this_quarter", "later"]);
  });
});

describe("moving a repeat occurrence", () => {
  it("daily: can't move", () => {
    expect(repeatMoveWindow(template({ pattern_type: "daily" }), TODAY, TODAY)).toBeNull();
  });

  it("every 3 days: the next 2 days", () => {
    // Starts Oct 21, so the next occurrence is Oct 24.
    const t = template({ pattern_type: "daily", interval_n: 3, start_date: "2026-10-21" });
    expect(repeatMoveWindow(t, TODAY, TODAY)).toEqual({ earliest: "2026-10-22", latest: "2026-10-23" });
  });

  it("weekly on Wednesday: Thursday through Tuesday", () => {
    const t = template({ pattern_type: "weekly", days_of_week: [3], start_date: "2026-10-07" });
    expect(repeatMoveWindow(t, TODAY, TODAY)).toEqual({ earliest: "2026-10-22", latest: "2026-10-27" });
  });

  it("every other Wednesday: the next 13 days", () => {
    const t = template({ pattern_type: "weekly", interval_n: 2, days_of_week: [3], start_date: "2026-10-07" });
    expect(repeatMoveWindow(t, TODAY, TODAY)).toEqual({ earliest: "2026-10-22", latest: "2026-11-03" });
  });

  it("monthly on the 21st: until Nov 20", () => {
    const t = template({ pattern_type: "monthly", monthly_kind: "day_of_month", day_of_month: 21, start_date: "2026-01-21" });
    expect(repeatMoveWindow(t, TODAY, TODAY)).toEqual({ earliest: "2026-10-22", latest: "2026-11-20" });
  });

  it("Mon, Wed, Fri: Wednesday's can move to Thursday only", () => {
    const t = template({ pattern_type: "weekly", days_of_week: [1, 3, 5], start_date: "2026-10-05" });
    expect(repeatMoveWindow(t, TODAY, TODAY)).toEqual({ earliest: "2026-10-22", latest: "2026-10-22" });
  });

  it("a missed weekly occurrence from Monday can move to today, not the past", () => {
    const t = template({ pattern_type: "weekly", days_of_week: [1], start_date: "2026-10-05" });
    expect(repeatMoveWindow(t, "2026-10-19", TODAY)).toEqual({ earliest: "2026-10-21", latest: "2026-10-25" });
  });

  it("a missed daily occurrence from yesterday can't move to today (today has its own)", () => {
    expect(repeatMoveWindow(template({ pattern_type: "daily" }), "2026-10-20", TODAY)).toBeNull();
  });

  it("a schedule that has ended allows up to 60 days", () => {
    const t = template({ pattern_type: "weekly", days_of_week: [3], start_date: "2026-10-07", end_date: TODAY });
    expect(repeatMoveWindow(t, TODAY, TODAY)).toEqual({ earliest: "2026-10-22", latest: "2026-12-20" });
  });

  it("quick choices only include days inside the window", () => {
    expect(repeatQuickChoices({ earliest: "2026-10-22", latest: "2026-10-27" }, TODAY)).toEqual(["tomorrow"]);
    expect(repeatQuickChoices({ earliest: "2026-10-21", latest: "2026-10-25" }, TODAY)).toEqual(["today", "tomorrow"]);
    expect(repeatQuickChoices(null, TODAY)).toEqual([]);
  });

  it("a repeat always keeps a specific date when moved", () => {
    expect(whenForRepeatChoice("today", TODAY)).toEqual({ dueDate: "2026-10-21", dueBucket: null });
    expect(whenForRepeatChoice("tomorrow", TODAY)).toEqual({ dueDate: "2026-10-22", dueBucket: null });
  });
});

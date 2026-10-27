import { describe, it, expect } from "vitest";
import { addMonths, groupMonth, groupWeek, weeksAheadFor } from "@/lib/calendar-week";
import type { TaskRow } from "@/lib/tasks-data";
import type { RecurringTemplateRow } from "@/lib/recurring-data";

// Today is Wednesday, Oct 21, 2026. Sunday weeks: Oct 18 to 24.
const TODAY = "2026-10-21";
let nextId = 1;
function task(o: Partial<TaskRow>): TaskRow {
  return {
    id: nextId++, user_id: "u", title: "t", notes: null, spoon_estimate: null,
    estimated_hours: null, actual_hours: null, complexity: null, social_load: false, dread: false, due_date: null,
    due_bucket: null, billable: false, client_id: null, project_id: null,
    completion_reason: null, rolled_from_date: null, completed_at: null,
    recurring_template_id: null, archived_at: null, created_at: 0, updated_at: 0, ...o,
  };
}
const titlesOn = (w: ReturnType<typeof groupWeek>, iso: string) =>
  w.days.find((d) => d.iso === iso)!.items.map((i) => `${i.task.title}:${i.status}`);

describe("groupWeek", () => {
  const tasks = [
    task({ title: "Today bucket", due_bucket: "today", spoon_estimate: 2, estimated_hours: 1 }),
    task({ title: "Due today", due_date: "2026-10-21", spoon_estimate: 1.5 }),
    task({ title: "Carried over", due_bucket: "today", due_date: "2026-10-19", spoon_estimate: 1 }),
    task({ title: "Friday", due_date: "2026-10-23", spoon_estimate: 3 }),
    task({ title: "Done today", due_date: "2026-10-21", spoon_estimate: 4, completed_at: 1 }),
    task({ title: "Missed Monday", due_date: "2026-10-19", due_bucket: "this_week" }),
    task({ title: "Repeat Tuesday", due_date: "2026-10-20", recurring_template_id: 3 }),
    task({ title: "Next Tuesday", due_date: "2026-10-27" }),
    task({ title: "This week bucket", due_bucket: "this_week" }),
    task({ title: "Later bucket", due_bucket: "later" }),
    task({ title: "No timeframe" }),
    task({ title: "Archived", due_date: "2026-10-22", archived_at: "2026-10-20T00:00:00Z" }),
  ];
  const w = groupWeek(tasks, TODAY, 0, 0);

  it("covers Sunday to Saturday", () => {
    expect(w.start).toBe("2026-10-18");
    expect(w.end).toBe("2026-10-24");
    expect(w.days.map((d) => d.iso)).toEqual([
      "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24",
    ]);
  });

  it("today holds the Today bucket, carried-over tasks and today's dated tasks, open first", () => {
    expect(titlesOn(w, TODAY)).toEqual([
      "Today bucket:open", "Due today:open", "Carried over:open", "Done today:done",
    ]);
  });

  it("today's totals count only open tasks", () => {
    const d = w.days.find((x) => x.isToday)!;
    expect(d.openCount).toBe(3);
    expect(d.openSpoons).toBe(4.5);
    expect(d.openHours).toBe(1);
  });

  it("a day's spoons include tasks with only a time (worked out from time × effort)", () => {
    const sat = groupWeek(
      [
        task({ due_date: "2026-10-24", estimated_hours: 1 }), // medium assumed: 2
        task({ due_date: "2026-10-24", estimated_hours: 1, complexity: "low", social_load: true }), // 1.5
        task({ due_date: "2026-10-24", spoon_estimate: 0.5, estimated_hours: 3, complexity: "high" }), // typed wins
      ],
      TODAY, 0, 0,
    ).days.find((d) => d.iso === "2026-10-24")!;
    expect(sat.openSpoons).toBe(4);
  });

  it("past days show what was missed there; carried-over tasks don't repeat on their old day", () => {
    expect(titlesOn(w, "2026-10-19")).toEqual(["Missed Monday:missed"]);
    expect(titlesOn(w, "2026-10-20")).toEqual(["Repeat Tuesday:missed"]);
  });

  it("future days show tasks dated that day; archived tasks never show", () => {
    expect(titlesOn(w, "2026-10-23")).toEqual(["Friday:open"]);
    expect(titlesOn(w, "2026-10-22")).toEqual([]);
  });

  it("not scheduled yet groups timeframes in order, leaving out Today and dated tasks", () => {
    expect(w.unscheduled.map((g) => [g.group, g.tasks.map((t) => t.title)])).toEqual([
      ["this_week", ["This week bucket"]],
      ["later", ["Later bucket"]],
      ["anytime", ["No timeframe"]],
    ]);
  });

  it("next week shows next week's dated tasks, and no Today bucket", () => {
    const n = groupWeek(tasks, TODAY, 0, 1);
    expect(n.start).toBe("2026-10-25");
    expect(titlesOn(n, "2026-10-27")).toEqual(["Next Tuesday:open"]);
    expect(n.days.every((d) => !d.isToday)).toBe(true);
  });

  it("a Monday week starts on Monday", () => {
    const m = groupWeek(tasks, TODAY, 1, 0);
    expect(m.start).toBe("2026-10-19");
    expect(m.end).toBe("2026-10-25");
  });
});

function template(o: Partial<RecurringTemplateRow>): RecurringTemplateRow {
  return {
    id: 50, user_id: "u", title: "Repeat", notes: null, spoon_estimate: 1,
    estimated_hours: 0.5, complexity: "low" as RecurringTemplateRow["complexity"], social_load: false, dread: false,
    billable: false, client_id: null, project_id: null, tag_ids: [],
    pattern_type: "weekly", interval_n: 1, days_of_week: [2, 4],
    monthly_kind: null, day_of_month: null, nth_weekday: null, nth_weekday_day: null,
    start_date: "2026-10-01", end_date: null, end_after_n: null, occurrences_generated: 0,
    last_generated_for: TODAY, on_miss: "ask_me", active: true,
    created_at: "", updated_at: "", ...o,
  };
}
const upcomingOn = (w: ReturnType<typeof groupWeek>, iso: string) =>
  w.days.find((d) => d.iso === iso)!.upcoming.map((t) => t.title);

describe("upcoming repeats", () => {
  // Weekly on Tuesday and Thursday. Today is Wednesday the 21st.
  const tueThu = template({ id: 50, title: "Tue/Thu" });

  it("show on future days only, and count toward that day's totals", () => {
    const w = groupWeek([], TODAY, 0, 0, [tueThu]);
    expect(upcomingOn(w, "2026-10-20")).toEqual([]); // Tuesday, already past
    expect(upcomingOn(w, "2026-10-22")).toEqual(["Tue/Thu"]); // Thursday
    const thu = w.days.find((d) => d.iso === "2026-10-22")!;
    expect(thu.openCount).toBe(1);
    expect(thu.openSpoons).toBe(1);
  });

  it("show in later weeks too", () => {
    const n = groupWeek([], TODAY, 0, 1, [tueThu]);
    expect(upcomingOn(n, "2026-10-27")).toEqual(["Tue/Thu"]);
    expect(upcomingOn(n, "2026-10-29")).toEqual(["Tue/Thu"]);
  });

  it("don't double up when a real task already sits on that day", () => {
    const moved = task({ title: "Tue/Thu", due_date: "2026-10-22", recurring_template_id: 50 });
    const w = groupWeek([moved], TODAY, 0, 0, [tueThu]);
    expect(upcomingOn(w, "2026-10-22")).toEqual([]);
    expect(titlesOn(w, "2026-10-22")).toEqual(["Tue/Thu:open"]);
  });

  it("skip paused repeats and respect end dates and occurrence limits", () => {
    const paused = template({ id: 51, title: "Paused", active: false });
    const ended = template({ id: 52, title: "Ended", end_date: "2026-10-26" });
    const limited = template({ id: 53, title: "Limited", end_after_n: 5, occurrences_generated: 4 });
    const n = groupWeek([], TODAY, 0, 1, [paused, ended, limited]);
    expect(upcomingOn(n, "2026-10-27")).toEqual([]);
    const w = groupWeek([], TODAY, 0, 0, [paused, ended, limited]);
    expect(upcomingOn(w, "2026-10-22")).toEqual(["Ended", "Limited"]);
  });
});

describe("weeksAheadFor", () => {
  it("counts whole weeks for the person's week start", () => {
    // Today is Wednesday, Oct 21.
    expect(weeksAheadFor(TODAY, TODAY)).toBe(0);
    expect(weeksAheadFor(TODAY, "2026-10-24")).toBe(0); // same Sunday week
    expect(weeksAheadFor(TODAY, "2026-10-25")).toBe(1); // next Sunday week
    expect(weeksAheadFor(TODAY, "2026-10-25", 1)).toBe(0); // Monday weeks: still this week
    expect(weeksAheadFor(TODAY, "2026-11-02", 1)).toBe(2);
    expect(weeksAheadFor(TODAY, "2026-10-10")).toBe(-2);
  });
  it("works across the change from daylight time", () => {
    expect(weeksAheadFor("2026-10-28", "2026-11-04")).toBe(1);
  });
});

describe("groupMonth", () => {
  // Today is Wednesday, Oct 21, 2026. Oct 1 is a Thursday, Oct 31 a Saturday.
  it("covers the month in whole weeks for the week start", () => {
    const sun = groupMonth([], TODAY, TODAY, 0);
    expect(sun.start).toBe("2026-10-01");
    expect(sun.end).toBe("2026-10-31");
    expect(sun.weeks.length).toBe(5);
    expect(sun.weeks[0][0].day.iso).toBe("2026-09-27");
    expect(sun.weeks[0][0].inMonth).toBe(false);
    expect(sun.weeks[4][6].day.iso).toBe("2026-10-31");

    const mon = groupMonth([], TODAY, TODAY, 1);
    expect(mon.weeks[0][0].day.iso).toBe("2026-09-28");
    expect(mon.weeks.at(-1)!.at(-1)!.day.iso).toBe("2026-11-01");
    expect(mon.weeks.at(-1)!.at(-1)!.inMonth).toBe(false);
  });

  it("puts tasks and upcoming repeats on their days, same as the week view", () => {
    const tasks = [
      task({ title: "Today bucket", due_bucket: "today", spoon_estimate: 2 }),
      task({ title: "Friday", due_date: "2026-10-23", spoon_estimate: 3 }),
      task({ title: "November", due_date: "2026-11-01" }),
    ];
    const tueThu = template({ id: 70, title: "Tue/Thu" });
    const month = groupMonth(tasks, TODAY, "2026-10-05", 0, [tueThu]);
    const day = (iso: string) => month.weeks.flat().find((c) => c.day.iso === iso)!.day;
    expect(day(TODAY).items.map((i) => i.task.title)).toEqual(["Today bucket"]);
    expect(day("2026-10-23").openSpoons).toBe(3);
    expect(day("2026-10-22").upcoming.map((t) => t.title)).toEqual(["Tue/Thu"]);
    expect(day("2026-10-27").upcoming.map((t) => t.title)).toEqual(["Tue/Thu"]);
    // Nov 1 is outside a Sunday-start October grid
    expect(month.weeks.flat().some((c) => c.day.iso === "2026-11-01")).toBe(false);
  });

  it("handles February in a leap year", () => {
    const feb = groupMonth([], TODAY, "2028-02-14", 0);
    expect(feb.end).toBe("2028-02-29");
  });
});

describe("addMonths", () => {
  it("moves to the first of another month, across years", () => {
    expect(addMonths("2026-10-21", 1)).toBe("2026-11-01");
    expect(addMonths("2026-12-05", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
    expect(addMonths("2026-10-21", 0)).toBe("2026-10-01");
  });
});

import { describe, it, expect } from "vitest";
import {
  canHaveSteps,
  childrenMap,
  countLabel,
  displayOrder,
  countable,
  familySpoons,
  movesWith,
  newStepWhen,
  parentsFinishedBy,
  parentsReopenedBy,
  reorder,
  rootsFor,
  stepProgress,
  levelOf,
} from "@/lib/task-steps";
import { committedSpoonsToday } from "@/lib/task-timeframe";
import { spentToday } from "@/lib/spoon-budget";
import { groupWeek } from "@/lib/calendar-week";
import type { TaskRow } from "@/lib/tasks-data";

// Tests run in US Eastern time (see vitest.config.ts). Wed Oct 21, 2026.
const TODAY = "2026-10-21";
const noon = new Date(`${TODAY}T12:00:00`).getTime();
let nextId = 1;
function task(o: Partial<TaskRow>): TaskRow {
  return {
    id: nextId++, user_id: "u", title: "t", notes: null, spoon_estimate: null,
    estimated_hours: null, actual_hours: null, complexity: null, social_load: false, dread: false, due_date: null,
    due_bucket: null, billable: false, client_id: null, project_id: null,
    completion_reason: null, rolled_from_date: null, completed_at: null,
    recurring_template_id: null, archived_at: null, parent_task_id: null, position: null,
    created_at: 0, updated_at: 0, ...o,
  };
}

// "Launch" (own estimate 5, on Today) with three steps:
//   Draft (2, today), Review (1, Friday), Send (1.5, dated today, done).
// Draft has two subtasks: Outline (0.5) and Write (1.5).
function launch() {
  const parent = task({ title: "Launch", due_bucket: "today", spoon_estimate: 5 });
  const draft = task({ title: "Draft", parent_task_id: parent.id, due_bucket: "today", spoon_estimate: 2, position: 1 });
  const review = task({ title: "Review", parent_task_id: parent.id, due_date: "2026-10-23", spoon_estimate: 1, position: 2 });
  const send = task({ title: "Send", parent_task_id: parent.id, due_date: TODAY, spoon_estimate: 1.5, position: 3, completed_at: noon });
  const outline = task({ title: "Outline", parent_task_id: draft.id, due_bucket: "today", spoon_estimate: 0.5, position: 1 });
  const write = task({ title: "Write", parent_task_id: draft.id, due_bucket: "today", spoon_estimate: 1.5, position: 2 });
  return { parent, draft, review, send, outline, write, all: [parent, draft, review, send, outline, write] };
}

describe("what the levels are called", () => {
  it("steps, then subtasks", () => {
    expect(countLabel(1, 1)).toBe("1 step");
    expect(countLabel(1, 3)).toBe("3 steps");
    expect(countLabel(2, 2)).toBe("2 subtasks");
  });
  it("knows which level a piece sits at", () => {
    const f = launch();
    const byId = new Map(f.all.map((t) => [t.id, t]));
    expect(levelOf(f.parent, byId)).toBe(0);
    expect(levelOf(f.draft, byId)).toBe(1);
    expect(levelOf(f.outline, byId)).toBe(2);
  });
});

describe("who can have smaller pieces", () => {
  it("a task always can; a step only with subtasks on; a subtask never", () => {
    expect(canHaveSteps(0, false)).toBe(true);
    expect(canHaveSteps(1, false)).toBe(false);
    expect(canHaveSteps(1, true)).toBe(true);
    expect(canHaveSteps(2, true)).toBe(false);
  });
});

describe("only the smallest pieces count", () => {
  it("leaves out any task that has steps", () => {
    const f = launch();
    expect(countable(f.all).map((t) => t.title)).toEqual(["Review", "Send", "Outline", "Write"]);
  });
  it("a task whose steps were all let go counts again", () => {
    const parent = task({ title: "P" });
    const step = task({ parent_task_id: parent.id, archived_at: "2026-10-20T00:00:00Z" });
    expect(countable([parent, step]).map((t) => t.title)).toContain("P");
  });
  it("today's committed spoons come from the open pieces on today, not the task's own number", () => {
    const f = launch();
    // Outline 0.5 + Write 1.5. Not Launch (5), not Draft (2), not Review (Friday), not Send (done).
    expect(committedSpoonsToday(f.all, TODAY)).toBe(2);
  });
  it("spent spoons count the finished step once, even after its task is ticked off", () => {
    const f = launch();
    const finished = f.all.map((t) => ({ ...t, completed_at: noon }));
    // 1 + 1.5 + 0.5 + 1.5 (the four smallest pieces), not Launch's 5 or Draft's 2.
    expect(spentToday(finished, 0, TODAY)).toBe(4.5);
  });
  it("the Calendar shows steps on their days, each saying what it's part of", () => {
    const f = launch();
    const week = groupWeek(f.all, TODAY, 0);
    const day = (iso: string) => week.days.find((d) => d.iso === iso)!;
    expect(day(TODAY).items.map((i) => `${i.task.title} (${i.partOf})`)).toEqual([
      "Outline (Draft)",
      "Write (Draft)",
      "Send (Launch)",
    ]);
    expect(day(TODAY).openSpoons).toBe(2);
    expect(day("2026-10-23").items.map((i) => i.task.title)).toEqual(["Review"]);
  });
});

describe("a task's total", () => {
  it("is the sum of its pieces, done or not", () => {
    const f = launch();
    const kids = childrenMap(f.all);
    // Draft = Outline 0.5 + Write 1.5; Launch = Draft 2 + Review 1 + Send 1.5.
    expect(familySpoons(f.draft, kids)).toBe(2);
    expect(familySpoons(f.parent, kids)).toBe(4.5);
    expect(familySpoons(f.review, kids)).toBe(1);
  });
  it("progress counts direct steps", () => {
    const f = launch();
    expect(stepProgress(f.parent, childrenMap(f.all))).toEqual({ done: 1, total: 3 });
  });
});

describe("ticking things off", () => {
  it("the last step ticks off its task", () => {
    const parent = task({ title: "P" });
    const a = task({ parent_task_id: parent.id, completed_at: noon });
    const b = task({ parent_task_id: parent.id });
    expect(parentsFinishedBy(b.id, [parent, a, b]).map((t) => t.title)).toEqual(["P"]);
    expect(parentsFinishedBy(a.id, [parent, a, { ...b }].map((t) => (t.id === a.id ? { ...t, completed_at: null } : t)))).toEqual([]);
  });
  it("the last subtask can finish its step and then the task", () => {
    const f = launch();
    const rows = f.all.map((t) =>
      t.id === f.review.id || t.id === f.outline.id ? { ...t, completed_at: noon } : t,
    );
    expect(parentsFinishedBy(f.write.id, rows).map((t) => t.title)).toEqual(["Draft", "Launch"]);
  });
  it("stops at a task that still has open steps", () => {
    const f = launch();
    const rows = f.all.map((t) => (t.id === f.outline.id ? { ...t, completed_at: noon } : t));
    expect(parentsFinishedBy(f.write.id, rows).map((t) => t.title)).toEqual(["Draft"]);
  });
  it("reopening a step reopens the ticked-off tasks above it", () => {
    const f = launch();
    const rows = f.all.map((t) => ({ ...t, completed_at: noon }));
    expect(parentsReopenedBy(f.outline.id, rows).map((t) => t.title)).toEqual(["Draft", "Launch"]);
    expect(parentsReopenedBy(f.outline.id, f.all)).toEqual([]);
  });
});

describe("timing", () => {
  it("a new step starts with its task's timing, one answer only", () => {
    expect(newStepWhen({ due_date: "2026-10-23", due_bucket: null })).toEqual({ dueDate: "2026-10-23", dueBucket: null });
    expect(newStepWhen({ due_date: null, due_bucket: "this_week" })).toEqual({ dueDate: null, dueBucket: "this_week" });
    expect(newStepWhen({ due_date: null, due_bucket: null })).toEqual({ dueDate: null, dueBucket: "today" });
  });
  it("moving a task brings the open pieces that share its timing, not ones with their own day or done ones", () => {
    const f = launch();
    // Draft, Outline and Write share Today; Review has Friday; Send is done.
    expect(movesWith(f.parent, childrenMap(f.all)).map((t) => t.title)).toEqual(["Draft", "Outline", "Write"]);
  });
});

describe("order and grouping", () => {
  it("moves a step up or down and renumbers the rest", () => {
    const f = launch();
    const steps = childrenMap(f.all).get(f.parent.id)!;
    expect(reorder(steps, f.send.id, "up")).toEqual([
      { id: f.draft.id, position: 1 },
      { id: f.send.id, position: 2 },
      { id: f.review.id, position: 3 },
    ]);
    expect(reorder(steps, f.draft.id, "up")).toEqual([]);
  });
  it("finished steps show after the open ones, each group in its own order", () => {
    const f = launch();
    const steps = childrenMap(f.all).get(f.parent.id)!;
    // Send (position 3) is done, so it drops below Draft and Review.
    expect(displayOrder(steps).map((t) => t.title)).toEqual(["Draft", "Review", "Send"]);
    // Renumbering in the shown order keeps finished steps at the end.
    expect(reorder(displayOrder(steps), f.review.id, "up").map((o) => o.position)).toEqual([1, 2, 3]);
  });
  it("a matching step shows inside its task, and each task shows once", () => {
    const f = launch();
    const other = task({ title: "Other" });
    const all = [other, ...f.all];
    expect(rootsFor([f.review, f.outline, other], all).map((t) => t.title)).toEqual(["Other", "Launch"]);
  });
});

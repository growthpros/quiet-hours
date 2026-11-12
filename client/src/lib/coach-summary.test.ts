import { describe, it, expect } from "vitest";
import { daySummary, MAX_TODAY } from "@/lib/coach-summary";
import type { TaskRow } from "@/lib/tasks-data";

// Tests run in US Eastern time (see vitest.config.ts). Mon Nov 9, 2026.
const TODAY = "2026-11-09";
const at = (time: string) => new Date(`${TODAY}T${time}`).getTime();
const NOW = at("15:00:00");

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

function day() {
  const launch = task({ title: "Launch email", due_bucket: "today", spoon_estimate: 5, notes: "PRIVATE NOTE" });
  const tasks = [
    launch,
    task({ title: "Draft", parent_task_id: launch.id, due_bucket: "today", spoon_estimate: 2, estimated_hours: 1.5, position: 1 }),
    task({ title: "Send", parent_task_id: launch.id, due_bucket: "today", spoon_estimate: 1, position: 2 }),
    task({ title: "Call the dentist", due_date: TODAY, spoon_estimate: 1 }),
    task({ title: "Water plants", due_date: "2026-11-06", recurring_template_id: 3, spoon_estimate: 0.5 }),
    task({ title: "Quarterly review", due_bucket: "this_week", spoon_estimate: 3 }),
    task({ title: "Done already", due_bucket: "today", spoon_estimate: 2, completed_at: at("10:00:00") }),
    task({ title: "Next month thing", due_bucket: "this_month", spoon_estimate: 1 }),
  ];
  return {
    tasks,
    ledger: { allotted: 10, spent: 1, earned_back: 0 },
    usual: 12,
    checkins: [
      { energy: 4, sensory: 2, symptoms: "[]", state: "grounded", created_at: at("08:00:00") },
      { energy: 2, sensory: 4, symptoms: '["headache","tears"]', state: "frozen", created_at: at("13:30:00") },
      { energy: 5, sensory: 1, symptoms: "[]", state: "grounded", created_at: at("08:00:00") - 86400000 },
    ],
    phase: "acute_recovery",
    todayIso: TODAY,
    now: NOW,
    weekStartsOn: 0 as const,
  };
}

describe("what the coach knows about the day", () => {
  it("reads like a short briefing", () => {
    expect(daySummary(day())).toBe(
      [
        "Today is Monday, November 9.",
        // 10 from the check-in; spent 1 logged + 2 done today; committed Draft 2 + Send 1 + dentist 1.
        "Spoons: 10 for today (set by today's check-in). Today's open tasks need 4 and 3 are already spent, so 3 are left over after today's tasks.",
        'Latest check-in: Frozen, energy "Low", sensory "A lot", 2 body signals, about 2 hours ago.',
        "Phase: Reduced capacity.",
        "On today:",
        '- Draft (2 spoons, 1.5 hours, part of "Launch email")',
        '- Send (1 spoon, part of "Launch email")',
        "- Call the dentist (1 spoon)",
        "Missed (set for an earlier day, not done):",
        "- Water plants (was set for Nov 6)",
        "Coming up this week:",
        "- Quarterly review (3 spoons)",
        "How long things take them: not enough finished tasks to say yet.",
      ].join("\n"),
    );
  });

  it("leaves out notes, which body signals, and the task that has steps", () => {
    const s = daySummary(day());
    expect(s).not.toMatch(/PRIVATE NOTE/);
    expect(s).not.toMatch(/headache|tears/);
    expect(s).not.toMatch(/- Launch email/);
  });

  it("says when there's no check-in yet and uses the usual day", () => {
    const d = { ...day(), checkins: [], ledger: null, phase: null };
    const s = daySummary(d);
    expect(s).toMatch(/Spoons: 12 for today \(their usual day\)\./);
    expect(s).toMatch(/Latest check-in: none yet today\./);
    expect(s).toMatch(/Phase: not set\./);
  });

  it("says plainly when the day is over its spoons", () => {
    const d = { ...day(), ledger: { allotted: 3, spent: 1, earned_back: 0 } };
    expect(daySummary(d)).toMatch(/so today's plan is 4 over what they have\./);
  });

  it("keeps a very full day short, and titles on one line", () => {
    const many = Array.from({ length: MAX_TODAY + 5 }, (_, i) => task({ title: `Thing ${i}\nsecond line`, due_bucket: "today" }));
    const s = daySummary({ ...day(), tasks: many });
    expect(s).toMatch(/- and 5 more/);
    expect(s).toMatch(/- Thing 0 second line \(0 spoons\)/);
  });

  it("includes the estimate pattern once there are enough finished tasks", () => {
    const finished = Array.from({ length: 5 }, () =>
      task({ title: "x", estimated_hours: 1, actual_hours: 1.5, completed_at: at("09:00:00") - 86400000 }),
    );
    const s = daySummary({ ...day(), tasks: [...day().tasks, ...finished] });
    expect(s).toMatch(/actual time is usually about 1\.5 times their estimate \(going by 5 finished tasks\)/);
  });
});

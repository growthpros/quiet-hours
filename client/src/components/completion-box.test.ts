import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Guard test: ticking something off asks how long it took (Caroline's
// decision, Nov 3: it helps with time blindness), and Skip still ticks it
// off. Skip used to close the box and leave the task open.
const src = readFileSync(path.resolve(import.meta.dirname, "../pages/tasks.tsx"), "utf8");

describe("the 'how long did it take' box", () => {
  it("opens for every tick-off except a task with steps", () => {
    const handler = src.slice(src.indexOf("const handleToggle"), src.indexOf("const shell"));
    expect(handler).toContain("setCompleting(true)");
    expect(handler).not.toMatch(/pastDue \|\| hasEstimatedHours/);
    expect(handler).toMatch(/if \(withSteps\)/);
  });
  it("Skip ticks it off without a time", () => {
    const skip = src.slice(src.indexOf("<Button", src.indexOf("Skip ticks it off")), src.indexOf('data-testid="button-completion-skip"'));
    expect(skip).toMatch(/onConfirm\(null, null/);
  });
  it("always offers the time and a note", () => {
    expect(src).not.toContain("hasEstimated &&");
    expect(src).toContain('data-testid="input-completion-reason"');
    expect(src).toContain("ACTUAL_PICKS.map");
  });
});

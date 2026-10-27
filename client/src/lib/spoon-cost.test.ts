import { describe, it, expect } from "vitest";
import { calculateSpoons, spoonsOf, taskSpoons } from "@/lib/spoon-cost";

const cost = (hours: number, complexity: "low" | "medium" | "high" | null, extra: { social_load?: boolean; dread?: boolean } = {}) =>
  calculateSpoons({ estimated_hours: hours, complexity, ...extra })?.spoons;

describe("spoons from time × effort", () => {
  it("matches the research table", () => {
    // Time:       low   medium  high
    expect([cost(0.25, "low"), cost(0.25, "medium"), cost(0.25, "high")]).toEqual([0.5, 0.5, 1]);
    expect([cost(0.5, "low"), cost(0.5, "medium"), cost(0.5, "high")]).toEqual([0.5, 1, 1.5]);
    expect([cost(1, "low"), cost(1, "medium"), cost(1, "high")]).toEqual([1, 2, 3]);
    expect([cost(2, "low"), cost(2, "medium"), cost(2, "high")]).toEqual([2, 4, 6]);
    expect([cost(4, "low"), cost(4, "medium"), cost(4, "high")]).toEqual([4.5, 9, 13.5]);
    expect([cost(8, "low"), cost(8, "medium"), cost(8, "high")]).toEqual([9.5, 19, 28.5]);
  });

  it("matches the research examples", () => {
    expect(cost(1, "medium", { social_load: true, dread: true })).toBe(4); // 1-hour dreaded video call
    expect(cost(0.75, "medium", { social_load: true })).toBe(2.5); // 45-minute grocery run, busy store
    expect(cost(0.25, "low")).toBe(0.5); // 15-minute email check
  });

  it("assumes medium effort when none is picked, and says so", () => {
    const c = calculateSpoons({ estimated_hours: 1, complexity: null });
    expect(c?.spoons).toBe(2);
    expect(c?.effortAssumed).toBe(true);
    expect(c?.explanation).toBe("1 hr × medium effort (assumed)");
  });

  it("shows its math", () => {
    expect(calculateSpoons({ estimated_hours: 3, complexity: "high", social_load: true, dread: true })?.explanation).toBe(
      "3 hr × high effort, hours past 2 count 1.25×, × 1.5 with people or noise, + 1 for dread",
    );
  });

  it("has nothing to work from without a time", () => {
    expect(calculateSpoons({ estimated_hours: null, complexity: "high" })).toBeNull();
    expect(calculateSpoons({ estimated_hours: 0, complexity: "high" })).toBeNull();
  });
});

describe("the spoons a task counts for", () => {
  it("uses the person's own number when they typed one", () => {
    expect(taskSpoons({ spoon_estimate: 5, estimated_hours: 1, complexity: "low" })).toBe(5);
    expect(taskSpoons({ spoon_estimate: 0, estimated_hours: 1, complexity: "low" })).toBe(0);
  });
  it("otherwise works it out from time and effort", () => {
    expect(taskSpoons({ spoon_estimate: null, estimated_hours: 1, complexity: null })).toBe(2);
  });
  it("otherwise has none (0 when adding up)", () => {
    expect(taskSpoons({ spoon_estimate: null, estimated_hours: null, complexity: null })).toBeNull();
    expect(spoonsOf({ spoon_estimate: null, estimated_hours: null, complexity: null })).toBe(0);
  });
});

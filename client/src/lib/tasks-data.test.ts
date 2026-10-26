import { describe, it, expect } from "vitest";
import { newTaskBucket } from "@/lib/tasks-data";

describe("a new task's timeframe", () => {
  it("goes on Today when it has no date and no timeframe", () => {
    expect(newTaskBucket({})).toBe("today");
  });
  it("keeps the timeframe it was given", () => {
    expect(newTaskBucket({ dueBucket: "next_week" })).toBe("next_week");
  });
  it("has no timeframe when it has a specific date (it used to get Today as well)", () => {
    expect(newTaskBucket({ dueDate: "2026-10-26", dueBucket: null })).toBeNull();
    expect(newTaskBucket({ dueDate: "2026-10-26", dueBucket: "today" })).toBeNull();
  });
});

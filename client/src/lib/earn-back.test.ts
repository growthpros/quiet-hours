import { describe, it, expect } from "vitest";
import { DEFAULT_EARN_BACK } from "@/lib/spoon-defaults";
import { earnBackActionError, patternDays, showsPattern, updatedDefaults } from "@/lib/earn-back";

describe("the starting list", () => {
  const byKey = Object.fromEntries(DEFAULT_EARN_BACK.map((d) => [d.actionKey, d]));
  it("follows the research and Caroline's choices", () => {
    expect([byKey.walk.label, byKey.walk.spoonValue, byKey.walk.durationMinMinutes]).toEqual(["Short walk outside", 1, 10]);
    expect([byKey.nap.spoonValue, byKey.nap.dailyCap, byKey.nap.durationMinMinutes]).toEqual([1, 1, 10]);
    const others = DEFAULT_EARN_BACK.filter((d) => d.actionKey !== "walk" && d.actionKey !== "nap");
    expect(new Set(others.map((d) => d.spoonValue))).toEqual(new Set([0.5]));
    // Every action keeps its own times-a-day limit.
    expect(DEFAULT_EARN_BACK.every((d) => d.dailyCap >= 1)).toBe(true);
  });
});

describe("switching to the updated starting list", () => {
  const old = [
    { id: 1, action_key: "walk", label: "Walked", spoon_value: 1, daily_cap: 3, duration_min_minutes: 20 },
    { id: 2, action_key: "hydration_target", label: "Hit hydration target", spoon_value: "0.5", daily_cap: 1, duration_min_minutes: null },
    { id: 3, action_key: "custom_stretching_x", label: "Stretching", spoon_value: 2, daily_cap: 4, duration_min_minutes: null },
  ];
  const u = updatedDefaults(old);
  it("changes built-in actions that differ", () => {
    expect(u.changes).toEqual([{ id: 1, label: "Short walk outside", spoonValue: 1, dailyCap: 2, durationMinMinutes: 10 }]);
  });
  it("leaves the person's own items alone", () => {
    expect(u.changes.some((c) => c.id === 3)).toBe(false);
  });
  it("adds built-in actions they don't have", () => {
    expect(u.missing.map((m) => m.actionKey)).toContain("nap");
    expect(u.missing.map((m) => m.actionKey)).not.toContain("walk");
  });
  it("has nothing to do once switched", () => {
    const current = DEFAULT_EARN_BACK.map((d, i) => ({
      id: i, action_key: d.actionKey, label: d.label, spoon_value: d.spoonValue, daily_cap: d.dailyCap, duration_min_minutes: d.durationMinMinutes,
    }));
    expect(updatedDefaults(current)).toEqual({ changes: [], missing: [] });
  });
});

describe("adding your own", () => {
  const ok = { label: "Stretching", spoonValue: "0.5", dailyCap: "2", minutes: "" };
  it("accepts a sensible item", () => {
    expect(earnBackActionError(ok)).toBeNull();
    expect(earnBackActionError({ ...ok, label: "Step work", spoonValue: "1", minutes: "20" })).toBeNull();
  });
  it("asks for a name, spoons, and times a day", () => {
    expect(earnBackActionError({ ...ok, label: "  " })).toBe("Give it a name.");
    expect(earnBackActionError({ ...ok, spoonValue: "" })).toMatch(/^Spoons back/);
    expect(earnBackActionError({ ...ok, spoonValue: "0" })).toMatch(/^Spoons back/);
    expect(earnBackActionError({ ...ok, spoonValue: "0.3" })).toMatch(/half-spoon/);
    expect(earnBackActionError({ ...ok, dailyCap: "0" })).toMatch(/^Times a day/);
    expect(earnBackActionError({ ...ok, dailyCap: "1.5" })).toMatch(/^Times a day/);
    expect(earnBackActionError({ ...ok, minutes: "-5" })).toMatch(/^Minutes needed/);
  });
});

describe("the pattern notice", () => {
  const day = (iso: string, allotted: number, earnedBack: number, load: number) => ({ iso, allotted, earnedBack, load });
  it("counts days where earn-back was a quarter or more and the day ran past an ordinary day", () => {
    const days = [
      day("d1", 9, 3, 13), // 3 of 12 = 25%, 13 > 12
      day("d2", 9, 3, 12), // load not over 12
      day("d3", 12, 2, 14), // 2 of 14 is under 25%
      day("d4", 0, 4, 13), // no check-in: 12 + 4, 4 of 16 = 25%
    ];
    expect(patternDays(days, 12)).toEqual(["d1", "d4"]);
  });
  it("shows on the third such day in a week, not before", () => {
    const two = [day("a", 9, 3, 13), day("b", 9, 3, 13)];
    expect(showsPattern(two, 12)).toBe(false);
    expect(showsPattern([...two, day("c", 8, 4, 12.5)], 12)).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { parseDateParam } from "@/lib/date-param";

describe("parseDateParam", () => {
  it("reads the date from the query string", () => {
    expect(parseDateParam("?date=2026-10-22")).toBe("2026-10-22");
  });
  it("reads the date from the hash when it lands there", () => {
    expect(parseDateParam("", "#/tasks?date=2026-10-22")).toBe("2026-10-22");
  });
  it("reads another key when asked", () => {
    expect(parseDateParam("?week=2026-11-02", "", "week")).toBe("2026-11-02");
    expect(parseDateParam("?date=2026-11-02", "", "week")).toBeNull();
  });
  it("ignores anything that isn't a real date", () => {
    expect(parseDateParam("?date=2026-02-30")).toBeNull();
    expect(parseDateParam("?date=tomorrow")).toBeNull();
    expect(parseDateParam("")).toBeNull();
  });
});

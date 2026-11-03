import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Guard test: the Tasks and Calendar pages must say so when tasks fail to
// load. They used to show an empty list, which looks exactly like having
// nothing to do (found while sorting out which account a phone was on).
const page = (name: string) =>
  readFileSync(path.resolve(import.meta.dirname, "../pages", name), "utf8");

describe("loading failures are shown, not hidden", () => {
  for (const name of ["tasks.tsx", "calendar.tsx"]) {
    it(`${name} shows LoadError when tasks fail to load`, () => {
      const src = page(name);
      expect(src).toMatch(/tasksQ\.isError\s*\?\s*\(\s*<LoadError/);
      expect(src).toMatch(/onRetry=\{\(\) => tasksQ\.refetch\(\)\}/);
    });
  }

  it("tasks.tsx doesn't show tab counts of 0 when tasks didn't load", () => {
    expect(page("tasks.tsx")).toMatch(/tasksQ\.isSuccess \? `Active \(/);
  });
});

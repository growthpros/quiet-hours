import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Guard test: pages stay within a phone's width.
//
// The scroll area around every page (App.tsx) wraps it in a box that, by
// default, grows to fit its widest piece. On a phone that pushed the Tasks
// page about 50 pixels past the screen's edge, cutting off its right side.
// The real check is in a browser (see the build log, "Pages fit a phone's
// width"); this test stops the fix being dropped by accident.
const src = (rel: string) => readFileSync(path.resolve(import.meta.dirname, "..", rel), "utf8");

describe("pages fit a phone's width", () => {
  it("the page scroll area keeps its inner box an ordinary block", () => {
    expect(src("App.tsx")).toContain(
      '<ScrollArea className="h-full [&>[data-radix-scroll-area-viewport]>div]:!block">',
    );
  });
  it("the Tasks tabs sit in rows of three on a phone", () => {
    expect(src("pages/tasks.tsx")).toMatch(/grid w-full grid-cols-3[^"]*sm:flex/);
  });
});

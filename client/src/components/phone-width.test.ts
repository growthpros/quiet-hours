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
  // The New task box was taller than a phone screen and couldn't scroll, so
  // its first field sat above the top of the screen and the page seemed
  // frozen (found by Caroline on her phone, Nov 3).
  for (const file of ["components/ui/dialog.tsx", "components/ui/alert-dialog.tsx"]) {
    it(`${file}: a box on a phone starts near the top and scrolls inside itself`, () => {
      const box = src(file);
      expect(box).toContain("max-h-[calc(100dvh-2rem)]");
      expect(box).toMatch(/top-4[^"]*translate-y-0[^"]*overflow-y-auto[^"]*sm:top-\[50%\][^"]*sm:translate-y-\[-50%\]/);
    });
  }
  it("task buttons sit under the title on a phone", () => {
    expect(src("pages/tasks.tsx")).toContain('grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1 sm:flex');
  });
  it("the Tasks tabs sit in rows of three on a phone", () => {
    expect(src("pages/tasks.tsx")).toMatch(/grid w-full grid-cols-3[^"]*sm:flex/);
  });
});

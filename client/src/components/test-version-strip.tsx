// A thin strip across the top of every copy of the app that uses the test
// database (previews and local development), so it can't be mistaken for
// the live app. The live app never shows it.

import { useEffect } from "react";
import { IS_TEST_DATABASE, LIVE_APP_URL } from "@/lib/environment";

export function TestVersionStrip() {
  useEffect(() => {
    if (IS_TEST_DATABASE && !document.title.startsWith("Test version")) {
      document.title = `Test version · ${document.title}`;
    }
  }, []);
  if (!IS_TEST_DATABASE) return null;
  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-4 py-1.5 text-center text-xs"
      style={{ background: "#DCE4EC", color: "#2A3440" }}
      data-testid="test-version-strip"
    >
      <span className="font-semibold">Test version.</span>
      <span>Practice data only, not your real account.</span>
      <a href={LIVE_APP_URL} className="underline underline-offset-2">
        Open the live app
      </a>
    </div>
  );
}

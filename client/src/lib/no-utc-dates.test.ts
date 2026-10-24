import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Guard test: keeps UTC date shortcuts out of the app.
//
// People think in their own local day. Shortcuts like
// `new Date().toISOString().slice(0, 10)` return the UTC date, which is
// tomorrow in the US evening and yesterday in the Australian morning.
// That mistake caused real bugs here, so this test fails if it comes back.
// Use the helpers in client/src/lib/local-date.ts instead.

const SRC = path.resolve(import.meta.dirname, "..");

const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  {
    pattern: /toISOString\(\)\s*\.slice\(\s*0\s*,\s*10\s*\)/,
    why: "toISOString().slice(0, 10) is the UTC date; use localIsoDate()",
  },
  {
    pattern: /toISOString\(\)\s*\.split\(\s*["']T["']\s*\)/,
    why: 'toISOString().split("T") is the UTC date; use localIsoDate()',
  },
  {
    pattern: /toIsoDate\(\s*(new Date\(\)|today|now)\s*\)/,
    why: "toIsoDate() on a real clock time gives the UTC date; use localIsoDate()",
  },
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "ui") continue; // generated shadcn components
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe("no UTC date shortcuts", () => {
  it("app code uses local dates for day-level logic", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (line.trim().startsWith("//")) return; // comments may mention them
        for (const { pattern, why } of FORBIDDEN) {
          if (pattern.test(line)) {
            offenders.push(`${path.relative(SRC, file)}:${i + 1}  ${why}`);
          }
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

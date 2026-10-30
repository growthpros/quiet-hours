import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Guard test: keeps em dashes out of the app's own words.
//
// House voice rule: no em dashes, ever. Use commas, periods, colons or line
// breaks. This fails if one appears in app code outside a comment, whether
// typed directly or written as —. Comments are skipped because nobody
// using the app sees them.

const SRC = path.resolve(import.meta.dirname, "..");
const EM_DASH = /—|\\u2014/;

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

/** The line with any // comment, or a line that's part of a block or JSX comment, removed. */
function codePart(line: string): string {
  const t = line.trim();
  if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*")) return "";
  const i = line.indexOf("//");
  // Keep "https://" and similar; only strip a // that starts a comment.
  if (i >= 0 && line[i - 1] !== ":") return line.slice(0, i);
  return line;
}

describe("app copy has no em dashes", () => {
  it("finds none outside comments", () => {
    const hits: string[] = [];
    for (const file of sourceFiles(SRC)) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, n) => {
          if (EM_DASH.test(codePart(line))) {
            hits.push(`${path.relative(SRC, file)}:${n + 1}: ${line.trim().slice(0, 100)}`);
          }
        });
    }
    expect(hits, `Em dashes in app copy:\n${hits.join("\n")}`).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { USER_DATA_TABLES } from "@/lib/data";

// Guard test: Export must include every table that holds a person's data.
//
// It reads the database setup files in supabase/ and collects every table
// they create. If a new feature adds a table and forgets to add it to
// USER_DATA_TABLES in data.ts, this fails.

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const SUPABASE = path.join(ROOT, "supabase");

function sqlFiles(): string[] {
  const top = readdirSync(SUPABASE)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => path.join(SUPABASE, f));
  const migrations = readdirSync(path.join(SUPABASE, "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .map((f) => path.join(SUPABASE, "migrations", f));
  return [...top, ...migrations];
}

function tablesCreatedInSql(): string[] {
  const found = new Set<string>();
  const pattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi;
  for (const file of sqlFiles()) {
    for (const match of readFileSync(file, "utf8").matchAll(pattern)) {
      found.add(match[1].toLowerCase());
    }
  }
  return [...found].sort();
}

describe("Export covers every table", () => {
  it("finds the tables in the database setup files", () => {
    // Sanity check that the scan itself works.
    expect(tablesCreatedInSql().length).toBeGreaterThanOrEqual(20);
  });

  it("USER_DATA_TABLES matches every table the database creates", () => {
    expect([...USER_DATA_TABLES].sort()).toEqual(tablesCreatedInSql());
  });
});

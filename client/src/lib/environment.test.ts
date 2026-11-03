import { describe, it, expect } from "vitest";
import { isTestDatabase } from "@/lib/environment";

describe("which database the app is using", () => {
  it("knows the test project", () => {
    expect(isTestDatabase("https://kavamvoavpecwsmozaij.supabase.co")).toBe(true);
  });
  it("never treats the real database as the test one", () => {
    expect(isTestDatabase("https://cjkmehvdsqdpdrmqhvza.supabase.co")).toBe(false);
  });
  it("is false when the address is missing or broken", () => {
    expect(isTestDatabase(undefined)).toBe(false);
    expect(isTestDatabase("")).toBe(false);
    expect(isTestDatabase("not a url")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NAV_ITEMS, PHONE_BAR_URLS, moreItems } from "@/components/app-sidebar";

// Every page in the app has to be reachable from the phone's bottom bar,
// either directly or through More. Settings used to be missing on phones.
const appSource = readFileSync(path.resolve(import.meta.dirname, "../App.tsx"), "utf8");
const routes = [...appSource.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]);

describe("phone navigation", () => {
  it("shows Today, Tasks, Calendar, Brain dump and Check-in on the bar", () => {
    const titles = PHONE_BAR_URLS.map((u) => NAV_ITEMS.find((i) => i.url === u)?.title);
    expect(titles).toEqual(["Today", "Tasks", "Calendar", "Brain dump", "Check-in"]);
  });

  it("reaches every page, on the bar or under More", () => {
    const reachable = new Set<string>([...PHONE_BAR_URLS, ...moreItems().map((i) => i.url)]);
    expect(routes.length).toBeGreaterThan(10);
    expect(routes.filter((r) => !reachable.has(r))).toEqual([]);
    expect(reachable.has("/settings")).toBe(true);
  });

  it("doesn't list a page twice", () => {
    const urls = [...PHONE_BAR_URLS, ...moreItems().map((i) => i.url)];
    expect(new Set(urls).size).toBe(urls.length);
  });
});

import { describe, it, expect } from "vitest";
import {
  basisLine,
  cleanUsual,
  dailyBudget,
  loadDetail,
  nextAllotment,
  wasBigDay,
} from "@/lib/daily-budget";

const calm = { sensory: 1, state: "grounded", bodySignals: 0, yesterdayWasBig: false };

describe("today's budget from an ordinary day", () => {
  it("scales the ordinary day by energy", () => {
    const b = (energy: number) => dailyBudget({ usual: 12, energy, ...calm }).spoons;
    expect([b(1), b(2), b(3), b(4), b(5)]).toEqual([7, 9.5, 12, 12.5, 13]);
  });

  it("matches the research example", () => {
    // Usual 12, Low energy, a lot of sensory input, drifting, a headache.
    const b = dailyBudget({ usual: 12, energy: 2, sensory: 4, state: "drifting", bodySignals: 1, yesterdayWasBig: false });
    expect(b.otherLoad).toBe(0.2);
    expect(b.spoons).toBe(7.5);
    expect(basisLine(b)).toBe("Ordinary day 12 · Low energy 80% · Other load −20% = 7.5 spoons");
    expect(loadDetail(b)).toBe("A lot of sensory input 10%, Drifting 5%, 1 body signal 5%.");
  });

  it("caps body signals at 15% and other load at 30%", () => {
    const b = dailyBudget({ usual: 20, energy: 3, sensory: 5, state: "frozen", bodySignals: 6, yesterdayWasBig: true });
    expect(b.loads.find((l) => l.label.includes("body"))!.share).toBe(0.15);
    expect(b.otherLoad).toBe(0.3);
    expect(b.spoons).toBe(14);
    expect(loadDetail(b)).toMatch(/Other load stops at 30%\.$/);
  });

  it("takes 10% off after a big day", () => {
    expect(dailyBudget({ usual: 12, energy: 3, ...calm, yesterdayWasBig: true }).spoons).toBe(11);
  });

  // With the energy shares and the 30% cap, the 40% and 110% limits are a
  // safety net: the lowest possible day is 42% and the highest 110%.
  it("never goes below 40% or above 110% of the ordinary day", () => {
    const low = dailyBudget({ usual: 10, energy: 1, sensory: 5, state: "frozen", bodySignals: 3, yesterdayWasBig: true });
    // 10 × 0.6 × 0.7 = 4.2, above the floor of 4
    expect(low.spoons).toBe(4);
    expect(low.limited).toBeNull();
    const high = dailyBudget({ usual: 12, energy: 5, ...calm });
    expect(high.spoons).toBe(13);
    expect(high.spoons).toBeLessThanOrEqual(12 * 1.1);
  });

  it("counts an unset or odd ordinary day as 12, and keeps it from 4 to 30", () => {
    expect(cleanUsual(null)).toBe(12);
    expect(cleanUsual("")).toBe(12);
    expect(cleanUsual(2)).toBe(4);
    expect(cleanUsual(45)).toBe(30);
    expect(cleanUsual(13.3)).toBe(13.5);
  });

  it("says when there's no other load", () => {
    const b = dailyBudget({ usual: 16, energy: 3, ...calm });
    expect(basisLine(b)).toBe("Ordinary day 16 · Steady energy 100% = 16 spoons");
    expect(loadDetail(b)).toBe("No other load today.");
  });
});

describe("a big day", () => {
  it("is spending past 110% of the day's budget", () => {
    expect(wasBigDay(13.5, 12)).toBe(true);
    expect(wasBigDay(13.2, 12)).toBe(false);
    expect(wasBigDay(5, 0)).toBe(false);
  });
});

describe("later check-ins", () => {
  it("the first sets the budget", () => {
    expect(nextAllotment(0, 9)).toEqual({ allotted: 9, changed: true });
  });
  it("a later one can lower it", () => {
    expect(nextAllotment(12, 8)).toEqual({ allotted: 8, changed: true });
  });
  it("but never raises it", () => {
    expect(nextAllotment(8, 12)).toEqual({ allotted: 8, changed: false });
  });
});

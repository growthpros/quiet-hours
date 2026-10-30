import { describe, it, expect } from "vitest";
import { PHASES, analyzePhaseFromCheckins, phaseLabel } from "@/lib/phases";

const heavy = { state: "frozen", intensity: 4 };
const calm = { state: "grounded", intensity: 1 };
const five = (c: typeof heavy) => Array(5).fill(c);
const seven = (c: typeof calm) => Array(7).fill(c);

describe("phase names", () => {
  it("are renamed, heaviest first, with the same saved keys", () => {
    expect(PHASES.map((p) => [p.key, p.label])).toEqual([
      ["burnout", "Burnout recovery"],
      ["acute_recovery", "Reduced capacity"],
      ["rebuilding", "Building back"],
      ["steady", "Steady"],
      ["stretch", "Stretch"],
    ]);
    expect(phaseLabel("burnout")).toBe("Burnout recovery");
    expect(phaseLabel(null)).toBeNull();
    expect(PHASES.every((p) => p.desc.length > 0)).toBe(true);
  });
});

describe("suggesting a lighter phase", () => {
  it("steps down one phase at a time", () => {
    expect(analyzePhaseFromCheckins(five(heavy), "stretch")?.toPhase).toBe("steady");
    expect(analyzePhaseFromCheckins(five(heavy), "steady")?.toPhase).toBe("rebuilding");
    expect(analyzePhaseFromCheckins(five(heavy), "rebuilding")?.toPhase).toBe("acute_recovery");
    expect(analyzePhaseFromCheckins(five(heavy), null)?.toPhase).toBe("rebuilding");
  });
  it("never suggests Burnout recovery: the person chooses it (it used to)", () => {
    expect(analyzePhaseFromCheckins(five(heavy), "acute_recovery")).toBeNull();
    expect(analyzePhaseFromCheckins(five(heavy), "burnout")).toBeNull();
  });
});

describe("suggesting more room", () => {
  it("steps up one phase at a time", () => {
    expect(analyzePhaseFromCheckins(seven(calm), "acute_recovery")?.toPhase).toBe("rebuilding");
    expect(analyzePhaseFromCheckins(seven(calm), "steady")?.toPhase).toBe("stretch");
    expect(analyzePhaseFromCheckins(seven(calm), "stretch")).toBeNull();
  });
  it("from Burnout recovery goes to Reduced capacity, not straight to Steady (it used to jump)", () => {
    expect(analyzePhaseFromCheckins(seven(calm), "burnout")?.toPhase).toBe("acute_recovery");
  });
  it("needs 5 check-ins before suggesting anything", () => {
    expect(analyzePhaseFromCheckins(Array(4).fill(heavy), "steady")).toBeNull();
  });
});

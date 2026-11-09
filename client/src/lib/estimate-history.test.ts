import { describe, it, expect } from "vitest";
import {
  hoursPhrase,
  keywords,
  overallPattern,
  patternLine,
  similarHint,
  similarLine,
} from "@/lib/estimate-history";

let id = 1;
const done = (title: string, actual: number | null, estimated: number | null = null, o: object = {}) => ({
  id: id++,
  title,
  completed_at: 1000 + id,
  archived_at: null,
  actual_hours: actual,
  estimated_hours: estimated,
  ...o,
});

describe("keywords", () => {
  it("keeps the meaningful words and matches simple word forms", () => {
    expect(keywords("Write the client emails for the launch")).toEqual(["write", "client", "email", "launch"]);
    expect(keywords("Emailing Pam")).toEqual(["email", "pam"]);
    expect(keywords("Do it")).toEqual([]);
  });
});

describe("things like this", () => {
  const history = [
    done("Client email about the proposal", 1.5, 0.5),
    done("Email Pam the invoice", 1, 0.5),
    done("Follow-up emails", 1.25, 1),
    done("Grocery run", 1, 1),
    done("Draft newsletter", 2, 1),
  ];
  it("needs at least 3 similar finished things", () => {
    expect(similarHint("Proposal for Pam", null, history)).toBeNull(); // only 2 share a word
  });
  it("with no estimate yet, says what's usual (the middle one, to the quarter hour)", () => {
    expect(similarHint("Email the new client", null, history)).toMatchObject({
      kind: "info",
      usualHours: 1.25,
      count: 3,
    });
  });
  it("notes an estimate more than 30% under what's usual", () => {
    expect(similarHint("Email the new client", 0.5, history)).toMatchObject({ kind: "low", usualHours: 1.25 });
  });
  it("stays quiet when the estimate is close to usual or longer", () => {
    expect(similarHint("Email the new client", 1, history)).toBeNull();
    expect(similarHint("Email the new client", 3, history)).toBeNull();
  });
  it("ignores open, let-go and untimed things, and the task being edited", () => {
    const extra = [
      done("Email A", 9, null, { completed_at: null }),
      done("Email B", 9, null, { archived_at: "2026-11-01" }),
      done("Email C", null),
    ];
    expect(similarHint("Email the new client", null, [...history, ...extra])?.usualHours).toBe(1.25);
    expect(similarHint("Email the new client", null, history, history[0].id)).toBeNull(); // only 2 left
  });
  it("reads gently", () => {
    const h = similarHint("Email the new client", 0.5, history)!;
    expect(similarLine(h)).toBe(
      'Things like this have usually taken you about 1.25 hours (going by 3 you\'ve finished with "email" or "client" in the title).',
    );
    expect(hoursPhrase(0.75)).toBe("45 minutes");
    expect(hoursPhrase(1)).toBe("1 hour");
  });
});

describe("overall pattern", () => {
  it("needs 5 finished things with both an estimate and a time", () => {
    const four = [done("a", 2, 1), done("b", 2, 1), done("c", 2, 1), done("d", 2, 1)];
    expect(overallPattern(four)).toBeNull();
    expect(overallPattern([...four, done("e", 1, 1)])).toEqual({ ratio: 2, count: 5 });
  });
  it("puts it in plain words", () => {
    expect(patternLine({ ratio: 1.4 })).toBe("Overall, things take you about 1.4 times what you estimate.");
    expect(patternLine({ ratio: 1 })).toBe("Overall, your estimates are usually close.");
    expect(patternLine({ ratio: 0.7 })).toBe("Overall, things take you about 0.7 times what you estimate, so often less.");
  });
});

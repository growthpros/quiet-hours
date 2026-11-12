import { describe, it, expect } from "vitest";
import {
  MAX_HISTORY,
  isTodaySomewhere,
  readRequest,
  recentHistory,
  tidyReply,
} from "../../../supabase/functions/coach/request";
import { TALK_IT_THROUGH } from "../../../supabase/functions/coach/prompt";

const u = (content: string) => ({ role: "user" as const, content });
const a = (content: string) => ({ role: "assistant" as const, content });

describe("what the coach function accepts", () => {
  const ok = { messages: [u("Too much on today")], summary: "Spoons: 12", day: "2026-11-09" };

  it("takes a conversation that starts and ends with the person", () => {
    expect(readRequest(ok)).toEqual(ok);
    expect(readRequest({ ...ok, messages: [u("a"), a("b"), u("c")] })).not.toHaveProperty("problem");
  });

  it("turns away anything out of order, empty or missing", () => {
    expect(readRequest(null)).toHaveProperty("problem");
    expect(readRequest({ ...ok, day: "Monday" })).toHaveProperty("problem");
    expect(readRequest({ ...ok, messages: [] })).toHaveProperty("problem");
    expect(readRequest({ ...ok, messages: [a("hi")] })).toHaveProperty("problem");
    expect(readRequest({ ...ok, messages: [u("a"), a("b")] })).toHaveProperty("problem");
    expect(readRequest({ ...ok, messages: [u("a"), u("b")] })).toHaveProperty("problem");
    expect(readRequest({ ...ok, messages: [u("   ")] })).toHaveProperty("problem");
    expect(readRequest({ ...ok, messages: [u("x".repeat(4001))] })).toHaveProperty("problem");
  });

  it("sends only the recent part of a very long conversation, starting with the person", () => {
    const long = Array.from({ length: 51 }, (_, i) => (i % 2 === 0 ? u(`m${i}`) : a(`m${i}`)));
    const recent = recentHistory(long);
    expect(recent.length).toBeLessThanOrEqual(MAX_HISTORY);
    expect(recent[0].role).toBe("user");
    expect(recent[recent.length - 1].content).toBe("m50");
    expect(recentHistory(long.slice(0, 5))).toHaveLength(5);
  });

  it("accepts every time zone's today and nothing else", () => {
    const now = Date.parse("2026-11-10T02:00:00Z"); // 9pm Nov 9 in Charleston
    expect(isTodaySomewhere("2026-11-09", now)).toBe(true);
    expect(isTodaySomewhere("2026-11-10", now)).toBe(true);
    expect(isTodaySomewhere("2026-11-11", now)).toBe(true); // already tomorrow in the Pacific
    expect(isTodaySomewhere("2026-11-12", now)).toBe(false);
    expect(isTodaySomewhere("2026-11-01", now)).toBe(false);
  });
});

describe("the coach's instructions", () => {
  it("carry Caroline's Nov 9 edits and the safety lines", () => {
    expect(TALK_IT_THROUGH).toMatch(/Never invent a task/);
    expect(TALK_IT_THROUGH).toMatch(/under about 150 words/);
    expect(TALK_IT_THROUGH).toMatch(/at most once in a conversation/);
    expect(TALK_IT_THROUGH).toMatch(/believe them/);
    expect(TALK_IT_THROUGH).toMatch(/Don't claim to remember past conversations/);
    expect(TALK_IT_THROUGH).toMatch(/988/);
    expect(TALK_IT_THROUGH).toMatch(/findahelpline\.com/);
    expect(TALK_IT_THROUGH).toMatch(/not a therapist/);
  });
  it("follow the voice rules themselves", () => {
    expect(TALK_IT_THROUGH).not.toMatch(/\u2014/);
    expect(TALK_IT_THROUGH).not.toMatch(/!/);
  });
});

describe("the coach's replies", () => {
  it("never carry a dash between phrases or an exclamation mark", () => {
    expect(tidyReply("Looking at where you are right now - frozen, low energy - the smallest thing")).toBe(
      "Looking at where you are right now, frozen, low energy, the smallest thing",
    );
    expect(tidyReply("One thing\u2014then rest.")).toBe("One thing, then rest.");
    expect(tidyReply("That counts!")).toBe("That counts.");
  });
  it("leaves lists, hyphenated words and numbers alone", () => {
    const list = "Would any of these fit?\n- Get a glass of water\n- A short reset\nA follow-up, 15-minute task.";
    expect(tidyReply(list)).toBe(list);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DAILY_MESSAGES, FINISH_EXTRA, HEADS_UP_AT, allowanceNote, canSend } from "@/lib/coach-allowance";
import * as server from "../../../supabase/functions/coach/allowance";

describe("the coach's daily allowance", () => {
  it("is 40 a day, with a note from 30 (Caroline's decision, Nov 9)", () => {
    expect(DAILY_MESSAGES).toBe(40);
    expect(HEADS_UP_AT).toBe(30);
  });

  it("says nothing until 30, then how many are left", () => {
    expect(allowanceNote(0, false)).toBeNull();
    expect(allowanceNote(29, true)).toBeNull();
    expect(allowanceNote(30, true)).toBe("You've got 10 messages left today. They reset at midnight.");
    expect(allowanceNote(39, false)).toBe("You've got 1 message left today. They reset at midnight.");
  });

  it("at 40, lets a conversation under way finish but not start a new one", () => {
    expect(canSend(39, false)).toBe(true);
    expect(canSend(40, false)).toBe(false);
    expect(canSend(40, true)).toBe(true);
    expect(canSend(40 + FINISH_EXTRA - 1, true)).toBe(true);
    expect(canSend(40 + FINISH_EXTRA, true)).toBe(false);
    expect(allowanceNote(40, true)).toMatch(/keep going with this conversation/);
    expect(allowanceNote(40, false)).toMatch(/crisis resources above are always here/);
  });

  it("the server enforces the same numbers", () => {
    expect(server.DAILY_MESSAGES).toBe(DAILY_MESSAGES);
    expect(server.FINISH_EXTRA).toBe(FINISH_EXTRA);
    for (const n of [0, 30, 39, 40, 45, 49, 50, 60]) {
      for (const c of [true, false]) expect(server.canSend(n, c)).toBe(canSend(n, c));
    }
  });

  it("never sounds like a penalty", () => {
    const words = [allowanceNote(30, false), allowanceNote(40, true), allowanceNote(40, false)].join(" ");
    expect(words).not.toMatch(/limit|exceeded|blocked|only|!/i);
  });

  it("only the coach function can count messages (migration 019)", () => {
    const sql = readFileSync(path.resolve(import.meta.dirname, "../../../supabase/migrations/019_coach_usage.sql"), "utf8");
    expect(sql).toMatch(/on delete cascade/);
    expect(sql).toMatch(/enable row level security/);
    expect(sql).not.toMatch(/for (insert|update|delete)/i);
    expect(sql).toMatch(/grant execute on function public\.coach_count_message\(uuid, date\) to service_role/);
    expect(sql).toMatch(/revoke all on function public\.coach_count_message\(uuid, date\) from authenticated/);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { daysLeft, keepDays, keepNote, keeps, titleFrom, wouldDelete } from "@/lib/coach-history";
import { changeWarning } from "@/components/coach-keep-card";

const DAY = 86400000;
const NOW = Date.parse("2026-11-19T15:00:00Z");
const conv = (id: number, daysAgo: number, pinned = false) => ({ id, pinned, updated_at: NOW - daysAgo * DAY });

describe("keeping coach conversations", () => {
  it("is off by default and has four choices", () => {
    expect(keeps("off")).toBe(false);
    expect(keeps(undefined)).toBe(false);
    expect(keeps("30")).toBe(true);
    expect(keeps("forever")).toBe(true);
    expect(keepDays("30")).toBe(30);
    expect(keepDays("90")).toBe(90);
    expect(keepDays("forever")).toBeNull();
  });

  describe("what a setting deletes", () => {
    const rows = [conv(1, 5), conv(2, 45), conv(3, 120), conv(4, 200, true)];
    it("turning keeping off deletes everything, pinned ones too", () => {
      expect(wouldDelete(rows, "off", NOW).map((r) => r.id)).toEqual([1, 2, 3, 4]);
    });
    it("30 or 90 days deletes unpinned ones whose last message is older than that", () => {
      expect(wouldDelete(rows, "30", NOW).map((r) => r.id)).toEqual([2, 3]);
      expect(wouldDelete(rows, "90", NOW).map((r) => r.id)).toEqual([3]);
    });
    it("until I delete them deletes nothing", () => {
      expect(wouldDelete(rows, "forever", NOW)).toEqual([]);
    });
    it("counts from the last message, so a conversation still in use stays", () => {
      expect(wouldDelete([conv(9, 29.9)], "30", NOW)).toEqual([]);
      expect(wouldDelete([conv(9, 30.1)], "30", NOW).length).toBe(1);
    });
  });

  it("says how long each one has left, or nothing when it isn't going", () => {
    expect(daysLeft(conv(1, 5), "30", NOW)).toBe(25);
    expect(daysLeft(conv(1, 5, true), "30", NOW)).toBeNull();
    expect(daysLeft(conv(1, 5), "forever", NOW)).toBeNull();
  });

  it("asks before a change that deletes, in plain words", () => {
    expect(changeWarning("off", 12)).toBe("This deletes your 12 kept conversations, pinned ones too. It can't be undone.");
    expect(changeWarning("30", 1)).toBe("This deletes 1 kept conversation older than 30 days. Pinned ones stay. It can't be undone.");
  });

  it("tells the person whether this conversation is kept", () => {
    expect(keepNote("off", true)).toMatch(/isn't saved/);
    expect(keepNote("30", true)).toMatch(/Kept for 30 days after your last message/);
    expect(keepNote("forever", true)).toBe("Kept until you delete it.");
    expect(keepNote("90", false)).toMatch(/Not keeping this one/);
  });

  it("names a conversation by the first line of the person's first message", () => {
    expect(titleFrom("\n  Too much on Thursday  \nand more")).toBe("Too much on Thursday");
    expect(titleFrom("x".repeat(100))).toHaveLength(80);
    expect(titleFrom("   ")).toBe("Conversation");
  });

  it("the copy follows the voice rules", () => {
    const words = [changeWarning("off", 2), changeWarning("90", 3), keepNote("30", true), keepNote("off", true)].join(" ");
    expect(words).not.toMatch(/—|!/);
  });
});

describe("migration 020 keeps these private and really deletes them", () => {
  const sql = readFileSync(path.resolve(import.meta.dirname, "../../../supabase/migrations/020_coach_conversations.sql"), "utf8");

  it("locks both tables to their owner and deletes them with the account", () => {
    expect(sql).toMatch(/alter table public\.coach_conversations enable row level security/);
    expect(sql).toMatch(/alter table public\.coach_messages enable row level security/);
    expect(sql.match(/references auth\.users\(id\) on delete cascade/g)?.length).toBe(2);
    expect(sql).toMatch(/references public\.coach_conversations\(id\) on delete cascade/);
  });

  it("never lets a message be edited, and only adds to the person's own conversation", () => {
    expect(sql).not.toMatch(/on public\.coach_messages\s+for update/);
    expect(sql).toMatch(/c\.id = conversation_id and c\.user_id = \(select auth\.uid\(\)\)/);
  });

  it("keeping is off by default", () => {
    expect(sql).toMatch(/coach_keep text not null default 'off'/);
  });

  it("the nightly clean-up uses the same rule as the app, and only the database runs it", () => {
    expect(sql).toMatch(/p\.coach_keep = 'off'/);
    expect(sql).toMatch(/p\.coach_keep = '30' and not c\.pinned and c\.updated_at < now_ms - 30::bigint \* 86400000/);
    expect(sql).toMatch(/p\.coach_keep = '90' and not c\.pinned and c\.updated_at < now_ms - 90::bigint \* 86400000/);
    expect(sql).toMatch(/revoke all on function public\.coach_cleanup\(\) from authenticated/);
    expect(sql).toMatch(/cron\.schedule\('coach-cleanup', '17 3 \* \* \*'/);
  });
});

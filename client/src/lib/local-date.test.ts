import { describe, it, expect, afterEach } from "vitest";
import { rolloverCutoff } from "@/lib/tasks-data";
import { localIsoDate } from "@/lib/local-date";

// The app must always use the person's own local date, wherever they are.
// UTC-based date math goes wrong in different ways in different places:
// evenings in the US, mornings in the UK and Australia. So these tests
// run the same question in several time zones.

const DEFAULT_TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = DEFAULT_TZ;
});

const places = [
  { tz: "America/New_York", label: "Charleston", offset: "-04:00" },
  { tz: "Europe/London", label: "London", offset: "+01:00" },
  { tz: "Australia/Sydney", label: "Sydney", offset: "+11:00" },
];

describe("rolloverCutoff", () => {
  for (const { tz, label, offset } of places) {
    for (const time of ["09:30", "21:30"]) {
      it(`at ${time} in ${label}, yesterday is the local yesterday`, () => {
        process.env.TZ = tz;
        const now = new Date(`2026-10-24T${time}:00${offset}`);
        expect(rolloverCutoff(now).yesterdayIso).toBe("2026-10-23");
      });
    }

    it(`in ${label}, start of today is local midnight`, () => {
      process.env.TZ = tz;
      const now = new Date(`2026-10-24T21:30:00${offset}`);
      expect(rolloverCutoff(now).startOfTodayMs).toBe(
        new Date(`2026-10-24T00:00:00${offset}`).getTime(),
      );
    });
  }
});

describe("localIsoDate", () => {
  for (const { tz, label, offset } of places) {
    for (const time of ["00:30", "09:30", "21:30", "23:30"]) {
      it(`at ${time} in ${label}, today is the local date`, () => {
        process.env.TZ = tz;
        const now = new Date(`2026-10-24T${time}:00${offset}`);
        expect(localIsoDate(now)).toBe("2026-10-24");
      });
    }
  }
});

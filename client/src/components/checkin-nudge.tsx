// A gentle in-page nudge that offers a burnout check-in on the user's cadence.
//
// Design:
// - Never modal, never blocking, never red.
// - A soft banner appears at the interval, with two actions: "Take 5 min" and "Not now".
// - "Not now" snoozes the nudge for the remainder of the interval.
// - Never shown on past days (viewing history) — only when isToday.
// - Never shown when cadence is "off".
// - Never fires more than once per interval; anchored to the last check-in's
//   created_at, so a fresh sign-in mid-day won't cause a burst of nudges.

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import type { BurnoutCheckin } from "@shared/schema";
import {
  getOrCreateProfile,
  type UserProfileRow,
  type CheckinCadence,
} from "@/lib/foundation-data";
import { useViewingDate } from "@/lib/viewing-date";

// Convert cadence + custom minutes to a resolved interval-minutes number.
// Returns null for "off" or "morning" (both use different logic).
function cadenceIntervalMinutes(
  cadence: CheckinCadence,
  customMinutes: number | null,
): number | null {
  switch (cadence) {
    case "off":
    case "morning":
      return null;
    case "every_hour":
      return 60;
    case "every_2h":
      return 120;
    case "every_3h":
      return 180;
    case "custom":
      return customMinutes && customMinutes > 0 ? customMinutes : null;
  }
}

// Local key so a "Not now" snooze survives page navigation within the day
// but does not require a DB round-trip. Keyed by date so it clears at midnight.
function snoozeKeyForToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `qh.checkin-nudge.snoozed-until.${y}-${m}-${day}`;
}

function getSnoozedUntil(): number | null {
  try {
    const raw = localStorage.getItem(snoozeKeyForToday());
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function setSnoozedUntil(tsMillis: number): void {
  try {
    localStorage.setItem(snoozeKeyForToday(), String(tsMillis));
  } catch {
    // Ignore storage errors (private-mode, quota, etc.); worst case the
    // nudge reappears sooner than expected.
  }
}

// Morning mode: fire once per local day if no check-in has been logged yet
// today and the current time is >= 05:00 local. Snooze dismisses for the day.
function shouldFireMorning(
  todayCheckins: BurnoutCheckin[] | undefined,
): boolean {
  const now = new Date();
  if (now.getHours() < 5) return false;
  const snoozeUntil = getSnoozedUntil();
  if (snoozeUntil && Date.now() < snoozeUntil) return false;
  const doneToday = (todayCheckins?.length ?? 0) > 0;
  return !doneToday;
}

// Interval mode: fire when (now - lastCheckinAt) >= intervalMinutes.
// If there is no check-in today at all, treat "last" as midnight so the first
// nudge fires one interval into the day.
function shouldFireInterval(
  intervalMinutes: number,
  todayCheckins: BurnoutCheckin[] | undefined,
): boolean {
  const snoozeUntil = getSnoozedUntil();
  if (snoozeUntil && Date.now() < snoozeUntil) return false;
  const sorted = (todayCheckins ?? [])
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);
  const lastAt = sorted[0]?.createdAt ?? startOfDayMillis();
  const elapsedMs = Date.now() - lastAt;
  return elapsedMs >= intervalMinutes * 60 * 1000;
}

function startOfDayMillis(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// The visible banner.
function NudgeBanner({
  headline,
  body,
  onDismiss,
}: {
  headline: string;
  body: string;
  onDismiss: () => void;
}) {
  return (
    <Card
      className="border-l-2 border-l-primary"
      data-testid="card-checkin-nudge"
    >
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span
            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden
          >
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="space-y-1">
            <p className="font-serif text-base text-foreground">
              {headline}
            </p>
            <p className="font-serif text-sm italic text-muted-foreground">
              {body}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          <Link href="/burnout">
            <Button
              size="sm"
              variant="default"
              data-testid="button-nudge-checkin"
            >
              Take 5 min
            </Button>
          </Link>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            aria-label="Not now"
            data-testid="button-nudge-dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CheckInNudge() {
  const { isToday } = useViewingDate();

  const profileQ = useQuery<UserProfileRow>({
    queryKey: ["user_profile"],
    queryFn: getOrCreateProfile,
    staleTime: 60_000,
  });
  const todayQ = useQuery<BurnoutCheckin[]>({
    queryKey: ["/api/burnout", "today"],
  });

  // A ticking timestamp so the banner re-evaluates every minute without
  // needing a full re-fetch. Cheap and honest to the user.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // A small state to force re-render after snooze so the banner disappears
  // immediately without waiting for the minute tick.
  const [snoozeTick, setSnoozeTick] = useState(0);

  const shouldShow = useMemo(() => {
    if (!isToday) return false;
    const profile = profileQ.data;
    if (!profile) return false;
    if (profile.checkin_cadence === "off") return false;
    if (profile.checkin_cadence === "morning") {
      return shouldFireMorning(todayQ.data);
    }
    const interval = cadenceIntervalMinutes(
      profile.checkin_cadence,
      profile.checkin_cadence_minutes,
    );
    if (interval == null) return false;
    return shouldFireInterval(interval, todayQ.data);
    // nowTick and snoozeTick force the memo to re-run every minute and on dismiss.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isToday,
    profileQ.data,
    todayQ.data,
    nowTick,
    snoozeTick,
  ]);

  const headline = useMemo(() => {
    const cadence = profileQ.data?.checkin_cadence;
    if (cadence === "morning") return "A gentle start.";
    return "A gentle pause.";
  }, [profileQ.data?.checkin_cadence]);

  const body = useMemo(() => {
    const cadence = profileQ.data?.checkin_cadence;
    if (cadence === "morning") {
      return "Notice how the morning has landed. Five minutes, then back to whatever's next.";
    }
    return "Notice where you are, without grading it. Five minutes, then back to your day.";
  }, [profileQ.data?.checkin_cadence]);

  if (!shouldShow) return null;

  const handleDismiss = () => {
    const cadence = profileQ.data?.checkin_cadence;
    if (cadence === "morning") {
      // Snooze until end of day.
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      setSnoozedUntil(end.getTime());
    } else {
      // Snooze for the length of the interval.
      const interval = cadenceIntervalMinutes(
        cadence ?? "off",
        profileQ.data?.checkin_cadence_minutes ?? null,
      );
      const minutes = interval ?? 60;
      setSnoozedUntil(Date.now() + minutes * 60 * 1000);
    }
    setSnoozeTick((n) => n + 1);
  };

  return (
    <NudgeBanner
      headline={headline}
      body={body}
      onDismiss={handleDismiss}
    />
  );
}

// ViewingDate context: lets Today act as a portal to any past day.
//
// - Default is today (local browser date).
// - Consumers read `date` (a YYYY-MM-DD local date string) and `isToday`.
// - When !isToday, the page is in read-only mode: no writes, no check-ins,
//   no earn-back logging. Reading past data is always safe.
//
// URL sync: reads `?date=YYYY-MM-DD` from `wouter`'s search string on mount
// and writes back to the URL when the date changes.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "wouter";

// ---------- Helpers ----------
export function todayLocalDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isValidYmd(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function ymdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(ymd: string, delta: number): string {
  const d = ymdToDate(ymd);
  d.setDate(d.getDate() + delta);
  return dateToYmd(d);
}

export function startOfDayMs(ymd: string): number {
  return ymdToDate(ymd).getTime();
}

export function endOfDayMs(ymd: string): number {
  const d = ymdToDate(ymd);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

// Human-friendly label
export function humanLabel(ymd: string): string {
  const d = ymdToDate(ymd);
  const today = todayLocalDateString();
  if (ymd === today) return "Today";
  const y = addDays(today, -1);
  if (ymd === y) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ---------- Context ----------
interface ViewingDateContextValue {
  date: string;
  setDate: (ymd: string) => void;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  goToToday: () => void;
  isToday: boolean;
  isFuture: boolean;
  canGoNext: boolean;
}

const ViewingDateContext = createContext<ViewingDateContextValue | null>(null);

function getDateFromLocation(loc: string): string | null {
  const q = loc.split("?")[1];
  if (!q) return null;
  const params = new URLSearchParams(q);
  const v = params.get("date");
  if (v && isValidYmd(v)) return v;
  return null;
}

export function ViewingDateProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  const [date, setDateState] = useState<string>(() => {
    const fromUrl = getDateFromLocation(window.location.search);
    return fromUrl ?? todayLocalDateString();
  });

  // If the URL changes (e.g. via router.push), pick up the date param.
  useEffect(() => {
    const fromUrl = getDateFromLocation(window.location.search);
    if (fromUrl && fromUrl !== date) {
      setDateState(fromUrl);
    } else if (!fromUrl && date !== todayLocalDateString()) {
      // URL has no date param but we're viewing a past day; sync back.
      // (Handles user manually deleting ?date= from URL.)
      setDateState(todayLocalDateString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const setDate = useCallback((ymd: string) => {
    if (!isValidYmd(ymd)) return;
    setDateState(ymd);
    const today = todayLocalDateString();
    if (ymd === today) {
      // Strip the date param when returning to today
      window.history.replaceState(null, "", window.location.pathname);
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set("date", ymd);
      window.history.replaceState(null, "", url.pathname + "?" + url.searchParams.toString());
    }
  }, []);

  const goToPreviousDay = useCallback(() => setDate(addDays(date, -1)), [date, setDate]);
  const goToNextDay = useCallback(() => setDate(addDays(date, 1)), [date, setDate]);
  const goToToday = useCallback(() => setDate(todayLocalDateString()), [setDate]);

  const value = useMemo<ViewingDateContextValue>(() => {
    const today = todayLocalDateString();
    const isToday = date === today;
    const isFuture = date > today;
    const canGoNext = date < today;
    return {
      date,
      setDate,
      goToPreviousDay,
      goToNextDay,
      goToToday,
      isToday,
      isFuture,
      canGoNext,
    };
  }, [date, setDate, goToPreviousDay, goToNextDay, goToToday]);

  return (
    <ViewingDateContext.Provider value={value}>
      {children}
    </ViewingDateContext.Provider>
  );
}

export function useViewingDate(): ViewingDateContextValue {
  const ctx = useContext(ViewingDateContext);
  if (!ctx) {
    // Fallback: works even outside the provider (e.g. History page).
    // Returns a static "today" context that behaves normally.
    const today = todayLocalDateString();
    return {
      date: today,
      setDate: () => undefined,
      goToPreviousDay: () => undefined,
      goToNextDay: () => undefined,
      goToToday: () => undefined,
      isToday: true,
      isFuture: false,
      canGoNext: false,
    };
  }
  return ctx;
}

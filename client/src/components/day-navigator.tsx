// Small navigator at the top of Today: previous day, current day label,
// next day, and a "Today" jump-back button when viewing a past day.
// Uses ViewingDate context.

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarClock } from "lucide-react";
import {
  useViewingDate,
  humanLabel,
  todayLocalDateString,
  ymdToDate,
} from "@/lib/viewing-date";

export function DayNavigator() {
  const { date, goToPreviousDay, goToNextDay, goToToday, isToday, canGoNext } =
    useViewingDate();

  const label = humanLabel(date);
  const d = ymdToDate(date);
  const dateLine = d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.slice(0, 4) === todayLocalDateString().slice(0, 4) ? undefined : "numeric",
  });

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={goToPreviousDay}
          aria-label="Previous day"
          data-testid="button-prev-day"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col leading-tight">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {isToday ? "Today" : label}
          </p>
          <p
            className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl"
            data-testid="text-day-label"
          >
            {dateLine}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={goToNextDay}
          disabled={!canGoNext}
          aria-label="Next day"
          data-testid="button-next-day"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {!isToday && (
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
          data-testid="button-jump-today"
          className="gap-2"
        >
          <CalendarClock className="h-4 w-4" />
          Back to today
        </Button>
      )}
    </div>
  );
}

// Small "You're viewing a past day" ribbon shown below the header.
export function ViewingHistoryRibbon() {
  const { date, isToday, goToToday } = useViewingDate();
  if (isToday) return null;
  const label = humanLabel(date);

  return (
    <div
      className="rounded-md border px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
      style={{
        background: "#F4EEE1",
        borderColor: "#DFD5BF",
      }}
      data-testid="ribbon-viewing-history"
    >
      <p className="text-sm" style={{ color: "#3D3A34" }}>
        <span className="font-semibold">Viewing {label}.</span>{" "}
        <span className="font-serif italic" style={{ color: "#6D655A" }}>
          Past days are read-only; you can look, not log.
        </span>
      </p>
      <button
        type="button"
        onClick={goToToday}
        className="text-sm font-semibold underline hover:no-underline"
        style={{ color: "#3D3A34" }}
        data-testid="link-jump-today-ribbon"
      >
        Back to today
      </button>
    </div>
  );
}

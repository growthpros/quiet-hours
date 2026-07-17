// RecurringPatternForm
//
// Reusable pattern picker used by:
//   - New Task form (in the collapsible "Recurring" section)
//   - "Make this recurring" flow (from Task Detail)
//   - /recurring page's edit dialog
//
// The form is uncontrolled at the field level (each row updates a piece
// of the state), and its state is lifted via `value` + `onChange` so the
// host can drive submit.
//
// Voice rules: no em dashes, no urgency language, no red, no shame. All
// copy uses commas, periods, and line breaks.

import { useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import type {
  RecurringPatternType,
  RecurringMonthlyKind,
  RecurringOnMiss,
} from "@/lib/recurring-data";
import {
  ON_MISS_LABEL,
  ON_MISS_DESCRIPTION,
  defaultOnMiss,
} from "@/lib/recurring-data";

// ---------- Value shape ----------

export interface RecurringPatternValue {
  pattern_type: RecurringPatternType;
  interval_n: number;
  days_of_week: number[];
  monthly_kind: RecurringMonthlyKind | null;
  day_of_month: number | null;
  nth_weekday: number | null;
  nth_weekday_day: number | null;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  end_after_n: number | null;
  on_miss: RecurringOnMiss;
}

export function defaultRecurringPatternValue(): RecurringPatternValue {
  return {
    pattern_type: "daily",
    interval_n: 1,
    days_of_week: [],
    monthly_kind: "day_of_month",
    day_of_month: new Date().getDate(),
    nth_weekday: null,
    nth_weekday_day: null,
    start_date: toIsoLocal(new Date()),
    end_date: null,
    end_after_n: null,
    on_miss: "let_it_go",
  };
}

function toIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEKDAY_ABBR = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const NTH_LABELS = ["1st", "2nd", "3rd", "4th", "5th"];

// ---------- Component ----------

interface Props {
  value: RecurringPatternValue;
  onChange: (v: RecurringPatternValue) => void;
}

export function RecurringPatternForm({ value, onChange }: Props) {
  // When the user changes pattern type, snap on_miss to that pattern's
  // sensible default IF they haven't yet customized on_miss. We detect
  // "haven't customized" as: on_miss still matches defaultOnMiss for the
  // OLD pattern.
  useEffect(() => {
    // no-op; effect runs on mount so on_miss stays as caller passed it.
    // Pattern-change auto-update is handled inline in the setter below.
  }, []);

  function setPatternType(pt: RecurringPatternType) {
    const wasDefaultOnMiss = value.on_miss === defaultOnMiss(value.pattern_type);
    const next: RecurringPatternValue = {
      ...value,
      pattern_type: pt,
      on_miss: wasDefaultOnMiss ? defaultOnMiss(pt) : value.on_miss,
    };
    // Reset pattern-specific fields when switching to keep the shape valid
    if (pt !== "weekly") {
      next.days_of_week = [];
    }
    if (pt !== "monthly") {
      next.monthly_kind = null;
      next.day_of_month = null;
      next.nth_weekday = null;
      next.nth_weekday_day = null;
    } else if (!value.monthly_kind) {
      next.monthly_kind = "day_of_month";
      next.day_of_month = new Date().getDate();
    }
    onChange(next);
  }

  function toggleWeekday(d: number) {
    const has = value.days_of_week.includes(d);
    const next = has
      ? value.days_of_week.filter((x) => x !== d)
      : [...value.days_of_week, d].sort();
    onChange({ ...value, days_of_week: next });
  }

  function setMonthlyKind(kind: RecurringMonthlyKind) {
    if (kind === "day_of_month") {
      onChange({
        ...value,
        monthly_kind: "day_of_month",
        day_of_month: value.day_of_month ?? new Date().getDate(),
        nth_weekday: null,
        nth_weekday_day: null,
      });
    } else {
      onChange({
        ...value,
        monthly_kind: "nth_weekday",
        day_of_month: null,
        nth_weekday: value.nth_weekday ?? 1,
        nth_weekday_day: value.nth_weekday_day ?? new Date().getDay(),
      });
    }
  }

  const intervalLabel = useMemo(() => {
    switch (value.pattern_type) {
      case "daily":
      case "custom":
        return value.interval_n === 1 ? "day" : "days";
      case "weekly":
        return value.interval_n === 1 ? "week" : "weeks";
      case "monthly":
        return value.interval_n === 1 ? "month" : "months";
    }
  }, [value.pattern_type, value.interval_n]);

  return (
    <div className="space-y-5 rounded-md border border-border bg-muted/20 p-4">
      {/* Pattern type */}
      <div className="space-y-2">
        <Label htmlFor="pattern-type">Repeats</Label>
        <Select
          value={value.pattern_type}
          onValueChange={(v) => setPatternType(v as RecurringPatternType)}
        >
          <SelectTrigger id="pattern-type" data-testid="select-pattern-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="custom">Custom (every N days)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Interval */}
      <div className="space-y-2">
        <Label htmlFor="interval-n">Every</Label>
        <div className="flex items-center gap-2">
          <Input
            id="interval-n"
            type="number"
            min={1}
            max={365}
            value={value.interval_n}
            onChange={(e) =>
              onChange({
                ...value,
                interval_n: Math.max(1, parseInt(e.target.value || "1", 10)),
              })
            }
            className="w-24"
            data-testid="input-interval-n"
          />
          <span className="text-sm text-muted-foreground">
            {intervalLabel}
          </span>
        </div>
      </div>

      {/* Weekly weekday chips */}
      {value.pattern_type === "weekly" && (
        <div className="space-y-2">
          <Label>On these days</Label>
          <div className="flex gap-1">
            {WEEKDAY_ABBR.map((abbr, idx) => {
              const selected = value.days_of_week.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleWeekday(idx)}
                  className={`h-9 w-9 rounded-md text-sm font-medium transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground border border-border hover:bg-muted"
                  }`}
                  aria-label={WEEKDAY_FULL[idx]}
                  aria-pressed={selected}
                  data-testid={`weekday-chip-${idx}`}
                >
                  {abbr}
                </button>
              );
            })}
          </div>
          {value.days_of_week.length === 0 && (
            <p className="text-xs italic text-muted-foreground">
              If none selected, uses the start date's weekday.
            </p>
          )}
        </div>
      )}

      {/* Monthly kind + fields */}
      {value.pattern_type === "monthly" && (
        <div className="space-y-3">
          <RadioGroup
            value={value.monthly_kind ?? "day_of_month"}
            onValueChange={(v) =>
              setMonthlyKind(v as RecurringMonthlyKind)
            }
            className="space-y-2"
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem
                value="day_of_month"
                id="monthly-dom"
                data-testid="radio-monthly-day-of-month"
              />
              <Label htmlFor="monthly-dom" className="flex items-center gap-2">
                On day
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={value.day_of_month ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      day_of_month: parseInt(e.target.value || "1", 10),
                    })
                  }
                  disabled={value.monthly_kind !== "day_of_month"}
                  className="w-20"
                  data-testid="input-day-of-month"
                />
                of the month
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem
                value="nth_weekday"
                id="monthly-nth"
                data-testid="radio-monthly-nth-weekday"
              />
              <Label htmlFor="monthly-nth" className="flex items-center gap-2 flex-wrap">
                On the
                <Select
                  value={String(value.nth_weekday ?? 1)}
                  onValueChange={(v) =>
                    onChange({ ...value, nth_weekday: parseInt(v, 10) })
                  }
                  disabled={value.monthly_kind !== "nth_weekday"}
                >
                  <SelectTrigger className="w-24" data-testid="select-nth">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NTH_LABELS.map((l, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(value.nth_weekday_day ?? 1)}
                  onValueChange={(v) =>
                    onChange({ ...value, nth_weekday_day: parseInt(v, 10) })
                  }
                  disabled={value.monthly_kind !== "nth_weekday"}
                >
                  <SelectTrigger className="w-28" data-testid="select-nth-day">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_FULL.map((l, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                of the month
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {/* Start date */}
      <div className="space-y-2">
        <Label htmlFor="start-date">Starts</Label>
        <Input
          id="start-date"
          type="date"
          value={value.start_date}
          onChange={(e) =>
            onChange({ ...value, start_date: e.target.value })
          }
          className="w-48"
          data-testid="input-start-date"
        />
      </div>

      {/* End conditions */}
      <div className="space-y-3">
        <Label>Ends (optional)</Label>

        {/* End date */}
        <div className="flex items-center gap-3">
          <Switch
            checked={value.end_date !== null}
            onCheckedChange={(on) =>
              onChange({
                ...value,
                end_date: on ? toIsoLocal(new Date()) : null,
              })
            }
            data-testid="switch-end-date"
          />
          <Label className="flex items-center gap-2">
            On
            <Input
              type="date"
              value={value.end_date ?? ""}
              onChange={(e) =>
                onChange({ ...value, end_date: e.target.value || null })
              }
              disabled={value.end_date === null}
              className="w-48"
              data-testid="input-end-date"
            />
          </Label>
        </div>

        {/* End after N occurrences */}
        <div className="flex items-center gap-3">
          <Switch
            checked={value.end_after_n !== null}
            onCheckedChange={(on) =>
              onChange({ ...value, end_after_n: on ? 10 : null })
            }
            data-testid="switch-end-after-n"
          />
          <Label className="flex items-center gap-2">
            After
            <Input
              type="number"
              min={1}
              max={999}
              value={value.end_after_n ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  end_after_n: parseInt(e.target.value || "1", 10),
                })
              }
              disabled={value.end_after_n === null}
              className="w-24"
              data-testid="input-end-after-n"
            />
            occurrences
          </Label>
        </div>

        <p className="text-xs italic text-muted-foreground">
          Set either, both, or neither. Whichever comes first stops the pattern.
        </p>
      </div>

      {/* on_miss policy */}
      <div className="space-y-2">
        <Label>If a day is missed</Label>
        <RadioGroup
          value={value.on_miss}
          onValueChange={(v) =>
            onChange({ ...value, on_miss: v as RecurringOnMiss })
          }
          className="space-y-2"
        >
          {(["let_it_go", "ask_me", "always_roll"] as const).map((opt) => (
            <div key={opt} className="flex items-start gap-3">
              <RadioGroupItem
                value={opt}
                id={`on-miss-${opt}`}
                className="mt-1"
                data-testid={`radio-on-miss-${opt}`}
              />
              <Label htmlFor={`on-miss-${opt}`} className="space-y-1">
                <span className="font-medium">{ON_MISS_LABEL[opt]}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {ON_MISS_DESCRIPTION[opt]}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}

// ---------- Validation for the host form to call before submit ----------

// Returns null if valid, or a human-readable error message otherwise.
export function validateRecurringPattern(
  v: RecurringPatternValue,
): string | null {
  if (!v.start_date) return "Start date is required.";
  if (v.interval_n < 1) return "Interval must be 1 or more.";
  if (v.pattern_type === "monthly") {
    if (v.monthly_kind === "day_of_month") {
      if (!v.day_of_month || v.day_of_month < 1 || v.day_of_month > 31) {
        return "Day of month must be between 1 and 31.";
      }
    } else if (v.monthly_kind === "nth_weekday") {
      if (!v.nth_weekday || !Number.isInteger(v.nth_weekday_day)) {
        return "Pick a week (1st through 5th) and a weekday.";
      }
    } else {
      return "Pick a monthly pattern (day of month, or nth weekday).";
    }
  }
  if (v.end_date && v.end_date < v.start_date) {
    return "End date must be on or after start date.";
  }
  if (v.end_after_n !== null && v.end_after_n < 1) {
    return "Occurrences must be 1 or more.";
  }
  return null;
}

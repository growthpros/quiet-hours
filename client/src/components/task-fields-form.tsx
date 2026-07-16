// Shared task-fields form used by both the New Task dialog and the
// per-row edit mode. Displays all editable task fields.
//
// Kept small on purpose: neurodivergent-friendly layout, generous
// whitespace, clear section labels, no required fields except title.

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Complexity, DueBucket } from "@/lib/tasks-data";

// Timeline options shown to the user. Ordered by nearness. "Specific date"
// is a special value that reveals a date input.
const TIMELINE_OPTIONS: Array<{
  value: DueBucket | "specific_date";
  label: string;
}> = [
  { value: "today", label: "Today (default)" },
  { value: "this_week", label: "This week" },
  { value: "next_week", label: "Next week" },
  { value: "this_month", label: "This month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "later", label: "Later" },
  { value: "specific_date", label: "Pick a specific date\u2026" },
];

export interface TaskFieldsValue {
  title: string;
  notes: string;
  spoonEstimate: string; // strings so inputs behave; caller converts
  estimatedHours: string;
  complexity: Complexity | "";
  timeline: DueBucket | "specific_date";
  specificDate: string; // YYYY-MM-DD, only used when timeline === 'specific_date'
  billable: boolean;
}

export function defaultTaskFieldsValue(): TaskFieldsValue {
  return {
    title: "",
    notes: "",
    spoonEstimate: "",
    estimatedHours: "",
    complexity: "",
    timeline: "today",
    specificDate: "",
    billable: false,
  };
}

interface TaskFieldsFormProps {
  value: TaskFieldsValue;
  onChange: (next: TaskFieldsValue) => void;
  idPrefix: string; // for input ids; unique per instance
}

export function TaskFieldsForm({
  value,
  onChange,
  idPrefix,
}: TaskFieldsFormProps) {
  const set = <K extends keyof TaskFieldsValue>(key: K, v: TaskFieldsValue[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`}>What is it?</Label>
        <Input
          id={`${idPrefix}-title`}
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="A small next thing"
          data-testid={`${idPrefix}-title`}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-notes`}>
          Notes{" "}
          <span className="text-xs italic text-muted-foreground">optional</span>
        </Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={value.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Any context that would help future-you"
          rows={2}
          data-testid={`${idPrefix}-notes`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-spoons`}>
            Spoons{" "}
            <span className="text-xs italic text-muted-foreground">
              0 to 10
            </span>
          </Label>
          <Input
            id={`${idPrefix}-spoons`}
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={value.spoonEstimate}
            onChange={(e) => set("spoonEstimate", e.target.value)}
            data-testid={`${idPrefix}-spoons`}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-hours`}>
            Hours{" "}
            <span className="text-xs italic text-muted-foreground">
              15-min steps
            </span>
          </Label>
          <Input
            id={`${idPrefix}-hours`}
            type="number"
            min={0}
            max={200}
            step={0.25}
            value={value.estimatedHours}
            onChange={(e) => set("estimatedHours", e.target.value)}
            data-testid={`${idPrefix}-hours`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Complexity</Label>
        <div className="flex gap-2">
          {(["low", "medium", "high"] as Complexity[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() =>
                set("complexity", value.complexity === c ? "" : c)
              }
              className={`flex-1 rounded-md border px-3 py-2 text-sm capitalize transition ${
                value.complexity === c
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
              data-testid={`${idPrefix}-complexity-${c}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-timeline`}>Timeline</Label>
        <Select
          value={value.timeline}
          onValueChange={(v) => set("timeline", v as TaskFieldsValue["timeline"])}
        >
          <SelectTrigger
            id={`${idPrefix}-timeline`}
            data-testid={`${idPrefix}-timeline`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMELINE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.timeline === "specific_date" && (
          <div className="pt-2">
            <Input
              type="date"
              value={value.specificDate}
              onChange={(e) => set("specificDate", e.target.value)}
              data-testid={`${idPrefix}-specific-date`}
            />
          </div>
        )}
        <p className="text-xs italic text-muted-foreground">
          Defaults to Today. Change if this belongs later.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Checkbox
          id={`${idPrefix}-billable`}
          checked={value.billable}
          onCheckedChange={(v) => set("billable", v === true)}
          data-testid={`${idPrefix}-billable`}
        />
        <Label
          htmlFor={`${idPrefix}-billable`}
          className="cursor-pointer text-sm font-normal"
        >
          Billable
        </Label>
      </div>
    </div>
  );
}

// Helper: convert TaskFieldsValue to the shape createTask/updateTask expect.
// Returns null for invalid state so caller can show an error toast.
export function fieldsToTaskInput(
  v: TaskFieldsValue,
): {
  title: string;
  notes: string | null;
  spoonEstimate: number | null;
  estimatedHours: number | null;
  complexity: Complexity | null;
  dueDate: string | null;
  dueBucket: DueBucket | null;
  billable: boolean;
} | { error: string } {
  const title = v.title.trim();
  if (!title) return { error: "Title can't be empty." };

  const spoons = v.spoonEstimate.trim() ? Number(v.spoonEstimate) : null;
  if (
    v.spoonEstimate.trim() &&
    (!Number.isFinite(spoons) || (spoons as number) < 0 || (spoons as number) > 10)
  ) {
    return { error: "Spoons must be a number between 0 and 10." };
  }

  const hours = v.estimatedHours.trim() ? Number(v.estimatedHours) : null;
  if (
    v.estimatedHours.trim() &&
    (!Number.isFinite(hours) || (hours as number) < 0)
  ) {
    return { error: "Hours must be a positive number." };
  }

  let dueBucket: DueBucket | null = null;
  let dueDate: string | null = null;
  if (v.timeline === "specific_date") {
    if (!v.specificDate) return { error: "Pick a date." };
    dueDate = v.specificDate;
    dueBucket = null;
  } else {
    dueBucket = v.timeline;
  }

  return {
    title,
    notes: v.notes.trim() || null,
    spoonEstimate: spoons,
    estimatedHours: hours,
    complexity: v.complexity || null,
    dueDate,
    dueBucket,
    billable: v.billable,
  };
}

// "How much will it take?": time, effort, two yes/no questions, and the
// spoons they work out to. Shared by the task form and the repeat editor.
//
// The spoon box stays empty unless the person types their own number,
// which always wins. Its placeholder shows what the math says, and a line
// underneath shows the math itself so the number never feels arbitrary.

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Complexity } from "@/lib/tasks-data";
import {
  DEFAULT_EFFORT,
  EFFORT_HINT,
  EFFORT_LABEL,
  MAX_SPOONS,
  calculateSpoons,
} from "@/lib/spoon-cost";

export interface SpoonCostValue {
  spoonEstimate: string; // empty = work it out
  estimatedHours: string;
  complexity: Complexity | "";
  socialLoad: boolean;
  dread: boolean;
}

function spoonWord(n: number): string {
  return `${n} spoon${n === 1 ? "" : "s"}`;
}

export function SpoonCostFields({
  value,
  onChange,
  idPrefix,
  allowNoEffort = true,
}: {
  value: SpoonCostValue;
  onChange: (next: SpoonCostValue) => void;
  idPrefix: string;
  /** Repeats always have an effort level; one-off tasks can leave it blank. */
  allowNoEffort?: boolean;
}) {
  const set = <K extends keyof SpoonCostValue>(key: K, v: SpoonCostValue[K]) =>
    onChange({ ...value, [key]: v });

  const calc = calculateSpoons({
    estimated_hours: value.estimatedHours.trim() || null,
    complexity: value.complexity || null,
    social_load: value.socialLoad,
    dread: value.dread,
  });
  const typed = value.spoonEstimate.trim() !== "";
  const shownEffort = (value.complexity || DEFAULT_EFFORT) as Complexity;

  return (
    <div className="space-y-4 rounded-md border border-border/70 p-3">
      <p className="text-sm font-medium">How much will it take?</p>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-hours`}>
          Time{" "}
          <span className="text-xs italic text-muted-foreground">hours, in 15-min steps</span>
        </Label>
        <Input
          id={`${idPrefix}-hours`}
          type="number"
          min={0}
          max={200}
          step={0.25}
          inputMode="decimal"
          value={value.estimatedHours}
          onChange={(e) => set("estimatedHours", e.target.value)}
          placeholder="1 = an hour, 0.25 = 15 minutes"
          data-testid={`${idPrefix}-hours`}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Effort</Label>
        <div className="flex gap-2" role="radiogroup" aria-label="Effort">
          {(["low", "medium", "high"] as Complexity[]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={value.complexity === c}
              onClick={() =>
                set("complexity", value.complexity === c && allowNoEffort ? "" : c)
              }
              className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                value.complexity === c
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
              data-testid={`${idPrefix}-complexity-${c}`}
            >
              {EFFORT_LABEL[c]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground" data-testid={`${idPrefix}-effort-example`}>
          {value.complexity ? "" : "Not picked, so it counts as Medium. "}
          {EFFORT_LABEL[shownEffort]}: {EFFORT_HINT[shownEffort]}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`${idPrefix}-social`}
            checked={value.socialLoad}
            onCheckedChange={(v) => set("socialLoad", v === true)}
            data-testid={`${idPrefix}-social`}
            className="mt-0.5"
          />
          <Label htmlFor={`${idPrefix}-social`} className="cursor-pointer text-sm font-normal leading-snug">
            With people, on camera, or somewhere noisy or busy
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id={`${idPrefix}-dread`}
            checked={value.dread}
            onCheckedChange={(v) => set("dread", v === true)}
            data-testid={`${idPrefix}-dread`}
            className="mt-0.5"
          />
          <Label htmlFor={`${idPrefix}-dread`} className="cursor-pointer text-sm font-normal leading-snug">
            Something I'm dreading
          </Label>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-spoons`}>
          Spoons{" "}
          <span className="text-xs italic text-muted-foreground">
            {typed ? "your number" : "worked out for you, or type your own"}
          </span>
        </Label>
        <Input
          id={`${idPrefix}-spoons`}
          type="number"
          min={0}
          max={MAX_SPOONS}
          step={0.5}
          inputMode="decimal"
          value={value.spoonEstimate}
          onChange={(e) => set("spoonEstimate", e.target.value)}
          placeholder={calc ? String(calc.spoons) : "Add a time to work it out"}
          data-testid={`${idPrefix}-spoons`}
        />
        <p className="text-xs text-muted-foreground" data-testid={`${idPrefix}-spoon-math`}>
          {calc ? (
            typed ? (
              <>
                The math says {spoonWord(calc.spoons)}. Your number counts instead.{" "}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => set("spoonEstimate", "")}
                  data-testid={`${idPrefix}-use-math`}
                >
                  Use the math
                </button>
              </>
            ) : (
              <>
                {spoonWord(calc.spoons)}: {calc.explanation}.
              </>
            )
          ) : typed ? (
            "Your number counts."
          ) : (
            "One spoon is about 30 minutes of ordinary, medium-effort work."
          )}
        </p>
      </div>
    </div>
  );
}

/** Check the typed spoon and hour values. Returns an error message, or null. */
export function spoonCostError(v: SpoonCostValue): string | null {
  if (v.spoonEstimate.trim()) {
    const n = Number(v.spoonEstimate);
    if (!Number.isFinite(n) || n < 0 || n > MAX_SPOONS) {
      return `Spoons can be anything from 0 to ${MAX_SPOONS}.`;
    }
  }
  if (v.estimatedHours.trim()) {
    const h = Number(v.estimatedHours);
    if (!Number.isFinite(h) || h < 0 || h > 200) return "Time can be anything from 0 to 200 hours.";
  }
  return null;
}

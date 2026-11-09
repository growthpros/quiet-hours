// The gentle "Things like this have usually taken you about…" line under a
// time field, from the person's own finished tasks and steps (see
// lib/estimate-history.ts). It never blocks: "Use 1.5 hours" fills it in,
// and "Keep mine" hides it for this title.

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTasks, type TaskRow } from "@/lib/tasks-data";
import {
  hoursPhrase,
  overallPattern,
  patternLine,
  similarHint,
  similarLine,
} from "@/lib/estimate-history";

export function EstimateHint({
  title,
  hours,
  onUse,
  excludeId,
  showPattern = false,
  testId,
}: {
  title: string;
  hours: number | null;
  onUse: (hours: number) => void;
  // The task being edited, so it isn't compared with itself.
  excludeId?: number;
  // Also show the overall pattern line (the full task form has room for it).
  showPattern?: boolean;
  testId: string;
}) {
  const tasksQ = useQuery<TaskRow[]>({ queryKey: ["tasks"], queryFn: listTasks });
  const tasks = tasksQ.data ?? [];
  const [keptFor, setKeptFor] = useState<string | null>(null);
  useEffect(() => setKeptFor(null), [title]);

  const hint = title.trim() ? similarHint(title, hours, tasks, excludeId) : null;
  const pattern = showPattern ? overallPattern(tasks, excludeId) : null;
  if ((!hint || keptFor === title) && !pattern) return null;

  return (
    <div className="space-y-1" data-testid={testId}>
      {hint && keptFor !== title && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <p className="italic">
            {similarLine(hint)}
            {hint.kind === "low" && ` That's a little longer than your estimate.`}
          </p>
          <div className="mt-1 flex flex-wrap gap-3">
            <button
              type="button"
              className="text-foreground underline underline-offset-2"
              onClick={() => onUse(hint.usualHours)}
              data-testid={`${testId}-use`}
            >
              Use {hoursPhrase(hint.usualHours)}
            </button>
            {hint.kind === "low" && (
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => setKeptFor(title)}
                data-testid={`${testId}-keep`}
              >
                Keep mine
              </button>
            )}
          </div>
        </div>
      )}
      {pattern && <p className="text-xs italic text-muted-foreground" data-testid={`${testId}-pattern`}>{patternLine(pattern)}</p>}
    </div>
  );
}

// "Break this down": the AI's suggested steps open here first, so the
// person can edit, remove and reorder them, and choose where they go,
// before anything is saved. Then they're added as steps of the task (see
// lib/task-steps.ts for the rules: only the smallest pieces count, and the
// task's total is the sum of its steps).

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { calculateSpoons } from "@/lib/spoon-cost";
import { localIsoDate } from "@/lib/local-date";
import { cn } from "@/lib/utils";
import {
  DUE_BUCKET_LABEL,
  createTask,
  type Complexity,
  type DueBucket,
  type ParsedTaskItem,
  type TaskRow,
} from "@/lib/tasks-data";
import {
  LEVEL_NAME,
  countLabel,
  draftsFrom,
  moveDraft,
  nextPosition,
  whenForSteps,
  type StepDraft,
  type StepsGoTo,
} from "@/lib/task-steps";

const TIME_CHOICES = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const EFFORTS: { value: Complexity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];
const BUCKETS: { value: DueBucket; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "next_week", label: "Next week" },
];

function timeLabel(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${Number(h.toFixed(2))} hr`;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

function draftSpoons(d: StepDraft): number | null {
  return (
    calculateSpoons({
      estimated_hours: d.hours,
      complexity: d.effort,
      social_load: d.withPeople,
      dread: false,
    })?.spoons ?? null
  );
}

export function BreakdownReview({
  parent,
  items,
  kids,
  level,
  onClose,
}: {
  parent: TaskRow;
  // The AI's suggestions; null when the box is closed.
  items: ParsedTaskItem[] | null;
  kids: Map<number, TaskRow[]>;
  // What the new pieces are: 1 = steps of a task, 2 = subtasks of a step.
  level: 1 | 2;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<StepDraft[]>([]);
  const [goTo, setGoTo] = useState<"parent" | DueBucket | "day">("parent");
  const [day, setDay] = useState(localIsoDate());
  const name = LEVEL_NAME[level];

  useEffect(() => {
    if (items) {
      setDrafts(draftsFrom(items, parent));
      setGoTo("parent");
      setDay(localIsoDate());
    }
  }, [items, parent]);

  const edit = (key: number, patch: Partial<StepDraft>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const kept = drafts.filter((d) => d.title.trim() !== "");
  const total = useMemo(() => kept.reduce((sum, d) => sum + (draftSpoons(d) ?? 0), 0), [kept]);

  const parentWhen = (() => {
    if (parent.due_date != null) {
      const [y, m, dd] = parent.due_date.split("-").map(Number);
      return new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    }
    return parent.due_bucket ? DUE_BUCKET_LABEL[parent.due_bucket] : "Today";
  })();

  const save = useMutation({
    mutationFn: async () => {
      const target: StepsGoTo =
        goTo === "parent" ? { kind: "parent" } : goTo === "day" ? { kind: "day", date: day } : { kind: "bucket", bucket: goTo };
      const when = whenForSteps(target, parent);
      let position = nextPosition(parent.id, kids);
      for (const d of kept) {
        await createTask({
          title: d.title.trim(),
          notes: d.notes,
          estimatedHours: d.hours,
          complexity: d.effort,
          socialLoad: d.withPeople,
          billable: d.billable,
          clientId: parent.client_id,
          projectId: parent.project_id,
          parentTaskId: parent.id,
          position: position++,
          ...when,
        });
      }
      return kept.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
      toast({ title: `Added ${countLabel(level, n)} to "${parent.title}".` });
      onClose();
    },
    onError: (e) => {
      // Some may have saved before the error; refresh so the list shows them.
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: `Couldn't add all the ${name.many}`,
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted",
    );

  return (
    <Dialog open={items != null} onOpenChange={(o) => (!o && !save.isPending ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-xl" data-testid="dialog-breakdown">
        <DialogHeader>
          <DialogTitle className="font-serif">Smaller {name.many} for "{parent.title}"</DialogTitle>
          <DialogDescription>
            Change anything that doesn't fit, remove what you don't need, then add them.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3">
          {drafts.map((d, i) => {
            const sp = draftSpoons(d);
            const times = d.hours != null && !TIME_CHOICES.includes(d.hours) ? [...TIME_CHOICES, d.hours].sort((a, b) => a - b) : TIME_CHOICES;
            return (
              <li key={d.key} className="space-y-2 rounded-md border border-border p-3" data-testid={`draft-${i}`}>
                <div className="flex items-start gap-1">
                  {/* Two lines, so a long title can be read without scrolling inside the box. */}
                  <Textarea
                    value={d.title}
                    onChange={(e) => edit(d.key, { title: e.target.value.replace(/\n/g, " ") })}
                    aria-label={`${name.one} ${i + 1}`}
                    rows={2}
                    className="min-h-0 resize-none py-1.5 text-base sm:text-sm"
                    maxLength={200}
                    data-testid={`draft-title-${i}`}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={i === 0}
                    onClick={() => setDrafts((l) => moveDraft(l, d.key, "up"))}
                    aria-label="Move up"
                    data-testid={`draft-up-${i}`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={i === drafts.length - 1}
                    onClick={() => setDrafts((l) => moveDraft(l, d.key, "down"))}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setDrafts((l) => l.filter((x) => x.key !== d.key))}
                    aria-label={`Remove this ${name.one}`}
                    data-testid={`draft-remove-${i}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Time">
                  <span className="w-12 text-xs text-muted-foreground">Time</span>
                  <select
                    value={d.hours ?? ""}
                    onChange={(e) => edit(d.key, { hours: e.target.value === "" ? null : Number(e.target.value) })}
                    className="h-8 rounded-md border border-border bg-background px-2 text-base sm:text-sm"
                    aria-label={`Time for ${name.one} ${i + 1}`}
                    data-testid={`draft-time-${i}`}
                  >
                    <option value="">Not set</option>
                    {times.map((h) => (
                      <option key={h} value={h}>
                        {timeLabel(h)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Effort">
                  <span className="w-12 text-xs text-muted-foreground">Effort</span>
                  {EFFORTS.map((e) => (
                    <button
                      key={e.value}
                      type="button"
                      aria-pressed={d.effort === e.value}
                      onClick={() => edit(d.key, { effort: d.effort === e.value ? null : e.value })}
                      className={chip(d.effort === e.value)}
                    >
                      {e.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs italic text-muted-foreground">
                  {sp != null ? `About ${fmt(sp)} spoon${sp === 1 ? "" : "s"}.` : "Pick a time and it counts toward its day."}
                </p>
              </li>
            );
          })}
        </ol>
        {drafts.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing left to add. Close this to keep the task as it is.</p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Where they go</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Where they go">
            <button type="button" aria-pressed={goTo === "parent"} onClick={() => setGoTo("parent")} className={chip(goTo === "parent")} data-testid="goto-parent">
              With the task
            </button>
            {BUCKETS.map((b) => (
              <button key={b.value} type="button" aria-pressed={goTo === b.value} onClick={() => setGoTo(b.value)} className={chip(goTo === b.value)} data-testid={`goto-${b.value}`}>
                {b.label}
              </button>
            ))}
            <button type="button" aria-pressed={goTo === "day"} onClick={() => setGoTo("day")} className={chip(goTo === "day")} data-testid="goto-day">
              A specific day
            </button>
          </div>
          {goTo === "parent" && <p className="text-xs italic text-muted-foreground">Same timing as the task: {parentWhen}.</p>}
          {goTo === "day" && (
            <Input
              type="date"
              value={day}
              min={localIsoDate()}
              onChange={(e) => setDay(e.target.value)}
              className="h-9 w-44"
              aria-label="Which day"
              data-testid="goto-date"
            />
          )}
          <p className="text-xs text-muted-foreground">You can move any {name.one} on its own later.</p>
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-sm text-muted-foreground" data-testid="breakdown-total">
            {countLabel(level, kept.length)}
            {total > 0 && ` · ${fmt(total)} spoons in all`}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={kept.length === 0 || save.isPending || (goTo === "day" && !day)}
              data-testid="button-breakdown-add"
            >
              Add {kept.length > 0 ? countLabel(level, kept.length) : name.many}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

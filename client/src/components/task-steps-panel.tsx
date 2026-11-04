// The steps part of a task card on the Tasks page: how far along the steps
// are, adding a step, and moving a step up or down the list. The rules
// (what counts, what ticks off what) live in lib/task-steps.ts.
//
// Adding a step offers quick picks for time and effort, one tap each, so the
// step gets spoons (worked out the same way as a task's, lib/spoon-cost.ts)
// and counts toward its day. Both can be skipped and set later with Edit.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { createTask, setStepPositions, type Complexity, type TaskRow } from "@/lib/tasks-data";
import { calculateSpoons } from "@/lib/spoon-cost";
import { cn } from "@/lib/utils";
import {
  LEVEL_NAME,
  countLabel,
  familySpoons,
  newStepWhen,
  nextPosition,
  reorder,
  stepProgress,
} from "@/lib/task-steps";

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/** "1 of 3 steps done · 4.5 spoons in all". */
export function StepsSummary({
  task,
  kids,
  level,
}: {
  task: TaskRow;
  kids: Map<number, TaskRow[]>;
  level: 1 | 2;
}) {
  const { done, total } = stepProgress(task, kids);
  if (total === 0) return null;
  const spoons = familySpoons(task, kids);
  return (
    <p className="text-xs text-muted-foreground" data-testid={`steps-summary-${task.id}`}>
      {done} of {countLabel(level, total)} done
      {spoons > 0 && ` · ${fmt(spoons)} spoon${spoons === 1 ? "" : "s"} in all`}
    </p>
  );
}

/** "+ Add a step", then a one-line form. The step starts with its task's timing. */
export function AddStepForm({
  parent,
  kids,
  level,
}: {
  parent: TaskRow;
  kids: Map<number, TaskRow[]>;
  level: 1 | 2;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [hours, setHours] = useState<number | null>(null);
  const [effort, setEffort] = useState<Complexity | null>(null);
  const name = LEVEL_NAME[level].one;
  const cost = calculateSpoons({ estimated_hours: hours, complexity: effort, social_load: false, dread: false });

  const add = useMutation({
    mutationFn: async (t: string) =>
      createTask({
        title: t,
        estimatedHours: hours,
        complexity: effort,
        parentTaskId: parent.id,
        position: nextPosition(parent.id, kids),
        ...newStepWhen(parent),
        billable: parent.billable,
        clientId: parent.client_id,
        projectId: parent.project_id,
      }),
    onSuccess: () => {
      setTitle("");
      setHours(null);
      setEffort(null);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
    },
    onError: (e) => {
      toast({
        title: `Couldn't add the ${name}`,
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        data-testid={`button-add-step-${parent.id}`}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add a {name}
      </button>
    );
  }

  const submit = () => {
    const t = title.trim();
    if (t) add.mutate(t);
  };

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        placeholder={level === 1 ? "A smaller piece of this" : "A smaller piece of this step"}
        aria-label={`New ${name}`}
        className="h-8 text-sm"
        maxLength={200}
        data-testid={`input-add-step-${parent.id}`}
      />
      <Button type="submit" size="sm" className="h-8" disabled={!title.trim() || add.isPending}>
        Add
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8"
        onClick={() => {
          setOpen(false);
          setTitle("");
        }}
      >
        Done
      </Button>
      </div>
      <QuickPicks label="Time" testId={`step-time-${parent.id}`}>
        {TIME_PICKS.map((t) => (
          <Pick key={t.hours} active={hours === t.hours} onClick={() => setHours(hours === t.hours ? null : t.hours)}>
            {t.label}
          </Pick>
        ))}
      </QuickPicks>
      <QuickPicks label="Effort" testId={`step-effort-${parent.id}`}>
        {EFFORT_PICKS.map((e) => (
          <Pick key={e.value} active={effort === e.value} onClick={() => setEffort(effort === e.value ? null : e.value)}>
            {e.label}
          </Pick>
        ))}
      </QuickPicks>
      <p className="text-xs italic text-muted-foreground" data-testid={`step-cost-${parent.id}`}>
        {cost
          ? `About ${fmt(cost.spoons)} spoon${cost.spoons === 1 ? "" : "s"}${effort ? "" : " (effort counts as medium until you pick)"}.`
          : "Pick a time and it counts toward its day."}
      </p>
    </form>
  );
}

const TIME_PICKS = [
  { hours: 0.25, label: "15 min" },
  { hours: 0.5, label: "30 min" },
  { hours: 1, label: "1 hr" },
  { hours: 2, label: "2 hr" },
];

const EFFORT_PICKS: { value: Complexity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function QuickPicks({ label, testId, children }: { label: string; testId: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label} data-testid={testId}>
      <span className="w-12 text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Pick({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

/**
 * A small menu on an open step: move it up or down the list. Finished steps
 * sit below the open ones, so a step moves only among the open ones.
 */
export function StepOrderMenu({
  step,
  siblings,
}: {
  step: TaskRow;
  siblings: TaskRow[]; // in the order shown (displayOrder)
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const i = siblings.findIndex((s) => s.id === step.id);
  const openCount = siblings.filter((s) => s.completed_at == null).length;

  const save = useMutation({
    mutationFn: async (direction: "up" | "down") => setStepPositions(reorder(siblings, step.id, direction)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e) => {
      toast({
        title: "Couldn't change the order",
        description: e instanceof Error ? e.message : String(e),
      });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  if (openCount < 2 || step.completed_at != null) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Change the order"
          title="Change the order"
          data-testid={`button-step-order-${step.id}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={i <= 0} onSelect={() => save.mutate("up")} data-testid={`step-up-${step.id}`}>
          <ArrowUp className="mr-2 h-4 w-4" aria-hidden="true" />
          Move up the list
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={i >= openCount - 1}
          onSelect={() => save.mutate("down")}
          data-testid={`step-down-${step.id}`}
        >
          <ArrowDown className="mr-2 h-4 w-4" aria-hidden="true" />
          Move down the list
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Tasks: the working to-do list.
// Voice: gentle, no red overdue, no bouncing badges. Adding a task with a
// spoon estimate that would push you past today's budget opens the
// OverrideModal (compassionate, not punitive). Completing a task with an
// estimated_hours prompts for actual_hours + reason so the AI can learn
// how the user actually estimates over time.

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil, Sparkles, Split } from "lucide-react";
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  committedSpoonsFromTasks,
  breakDownTask,
  DUE_BUCKET_LABEL,
  type TaskRow,
} from "@/lib/tasks-data";
import { getOrCreateTodayLedger } from "@/lib/spoon-data";
import { OverrideModal } from "@/components/override-modal";
import { useToast } from "@/hooks/use-toast";
import {
  TaskFieldsForm,
  defaultTaskFieldsValue,
  fieldsToTaskInput,
  type TaskFieldsValue,
} from "@/components/task-fields-form";

type Filter = "active" | "completed" | "all";

// ---------- Task summary chips (below title, when values are present) ----------

function TaskChips({ task }: { task: TaskRow }) {
  const chips: string[] = [];
  if (task.spoon_estimate != null) {
    const n = Number(task.spoon_estimate);
    chips.push(`${n} spoon${n === 1 ? "" : "s"}`);
  }
  if (task.estimated_hours != null) {
    const h = Number(task.estimated_hours);
    chips.push(`${h}h`);
  }
  if (task.complexity) chips.push(task.complexity);
  if (task.billable) chips.push("billable");
  if (task.due_bucket && task.due_bucket !== "today") {
    chips.push(DUE_BUCKET_LABEL[task.due_bucket]);
  }
  if (task.due_date) {
    chips.push(new Date(task.due_date + "T00:00:00").toLocaleDateString());
  }
  if (task.rolled_from_date) chips.push("rolled from yesterday");
  if (chips.length === 0) return null;
  return (
    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
      {chips.join(" \u00b7 ")}
    </p>
  );
}

// ---------- Completion popup: actual hours + reason ----------

interface CompletionPopupProps {
  open: boolean;
  task: TaskRow | null;
  onCancel: () => void;
  onConfirm: (actualHours: number | null, reason: string | null) => void;
}

function CompletionPopup({ open, task, onCancel, onConfirm }: CompletionPopupProps) {
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");

  // Reset when a new task is passed in.
  useMemo(() => {
    if (task) {
      setHours(task.estimated_hours != null ? String(task.estimated_hours) : "");
      setReason("");
    }
  }, [task?.id]);

  if (!task) return null;

  const estimated = task.estimated_hours;
  const parsedHours = hours.trim() ? Number(hours) : null;
  const variance =
    estimated != null && parsedHours != null
      ? parsedHours - Number(estimated)
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">
            How did it actually land?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm italic text-muted-foreground font-serif">
            No grading. This just helps Quiet Hours learn how you actually
            estimate so future guesses get closer.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="completion-hours">
              Actual hours
              {estimated != null && (
                <span className="ml-2 text-xs italic text-muted-foreground">
                  estimated {estimated}h
                </span>
              )}
            </Label>
            <Input
              id="completion-hours"
              type="number"
              min={0}
              max={200}
              step={0.25}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="0.25 steps"
              data-testid="input-completion-hours"
            />
            {variance !== null && (
              <p className="text-xs italic text-muted-foreground">
                {variance > 0
                  ? `${variance}h longer than estimated. Notice, don't grade.`
                  : variance < 0
                  ? `${Math.abs(variance)}h shorter than estimated. Nice.`
                  : `Right on the estimate.`}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="completion-reason">
              What made it that long or short?{" "}
              <span className="text-xs italic text-muted-foreground">
                optional
              </span>
            </Label>
            <Textarea
              id="completion-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="One sentence or a paragraph. Anything that surprised you."
              rows={3}
              data-testid="input-completion-reason"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Skip
          </Button>
          <Button
            onClick={() => onConfirm(parsedHours, reason.trim() || null)}
            data-testid="button-completion-save"
          >
            Save and complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Task row card ----------

function TaskCard({ task }: { task: TaskRow }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<TaskFieldsValue>(() =>
    taskToFields(task),
  );
  const [completing, setCompleting] = useState(false);
  const [breakingDown, setBreakingDown] = useState(false);

  const done = task.completed_at != null;
  const hasEstimatedHours = task.estimated_hours != null;

  const toggle = useMutation({
    mutationFn: async (opts: {
      actualHours?: number | null;
      reason?: string | null;
    }) => {
      await updateTask(task.id, {
        completed: !done,
        actualHours: opts.actualHours ?? undefined,
        completionReason: opts.reason ?? undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
    },
    onError: (e) => {
      toast({
        title: "Couldn't update",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const conv = fieldsToTaskInput(editValue);
      if ("error" in conv) throw new Error(conv.error);
      await updateTask(task.id, {
        title: conv.title,
        notes: conv.notes,
        spoonEstimate: conv.spoonEstimate,
        estimatedHours: conv.estimatedHours,
        complexity: conv.complexity,
        dueDate: conv.dueDate,
        dueBucket: conv.dueBucket,
        billable: conv.billable,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
      setEditing(false);
    },
    onError: (e) => {
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const del = useMutation({
    mutationFn: async () => deleteTask(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
    },
  });

  const breakDown = useMutation({
    mutationFn: async () => {
      setBreakingDown(true);
      const items = await breakDownTask({
        title: task.title,
        notes: task.notes,
      });
      // Create each sub-task with due_bucket=today by default
      for (const it of items) {
        await createTask({
          title: it.title,
          notes: it.notes ?? null,
          spoonEstimate: it.spoon_estimate ?? null,
          estimatedHours: it.estimated_hours ?? null,
          complexity: it.complexity ?? null,
          dueBucket: task.due_bucket ?? "today",
          dueDate: task.due_date,
          billable: it.billable ?? task.billable,
        });
      }
      return items.length;
    },
    onSuccess: (count) => {
      setBreakingDown(false);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
      if (count === 0) {
        toast({
          title: "Already small.",
          description: "Claude couldn't split this one further.",
        });
      } else {
        toast({
          title: `Added ${count} smaller task${count === 1 ? "" : "s"}.`,
          description: "The original is still here. Delete it if you want.",
        });
      }
    },
    onError: (e) => {
      setBreakingDown(false);
      toast({
        title: "Couldn't break it down",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const handleToggle = () => {
    if (done) {
      // Uncompleting is quiet, no popup
      toggle.mutate({});
      return;
    }
    if (hasEstimatedHours) {
      // Prompt for actual hours + reason
      setCompleting(true);
    } else {
      // No estimate to compare against, complete quietly
      toggle.mutate({});
    }
  };

  return (
    <>
      <Card data-testid={`card-task-${task.id}`}>
        <CardContent className="space-y-3 p-4">
          {editing ? (
            <div className="space-y-3">
              <TaskFieldsForm
                value={editValue}
                onChange={setEditValue}
                idPrefix={`edit-task-${task.id}`}
              />
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setEditValue(taskToFields(task));
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <Checkbox
                checked={done}
                onCheckedChange={() => handleToggle()}
                className="mt-1"
                data-testid={`checkbox-task-${task.id}`}
                aria-label={done ? "Mark as active" : "Mark as complete"}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p
                  className={`font-serif text-base ${
                    done
                      ? "italic text-muted-foreground line-through decoration-muted-foreground/40"
                      : "text-foreground"
                  }`}
                >
                  {task.title}
                </p>
                {task.notes && (
                  <p className="whitespace-pre-wrap font-serif text-sm italic text-muted-foreground">
                    {task.notes}
                  </p>
                )}
                <TaskChips task={task} />
                {task.completion_reason && done && (
                  <p className="whitespace-pre-wrap pt-1 font-serif text-xs italic text-muted-foreground">
                    Reason: {task.completion_reason}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!done && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => breakDown.mutate()}
                    aria-label="Break down"
                    title="Ask AI to split this into smaller tasks"
                    disabled={breakingDown}
                    data-testid={`button-task-breakdown-${task.id}`}
                  >
                    <Split className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setEditValue(taskToFields(task));
                    setEditing(true);
                  }}
                  aria-label="Edit"
                  data-testid={`button-task-edit-${task.id}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => del.mutate()}
                  aria-label="Delete"
                  data-testid={`button-task-delete-${task.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CompletionPopup
        open={completing}
        task={task}
        onCancel={() => setCompleting(false)}
        onConfirm={(actualHours, reason) => {
          setCompleting(false);
          toggle.mutate({ actualHours, reason });
        }}
      />
    </>
  );
}

function taskToFields(task: TaskRow): TaskFieldsValue {
  return {
    title: task.title,
    notes: task.notes ?? "",
    spoonEstimate:
      task.spoon_estimate != null ? String(task.spoon_estimate) : "",
    estimatedHours:
      task.estimated_hours != null ? String(task.estimated_hours) : "",
    complexity: task.complexity ?? "",
    timeline: task.due_date
      ? "specific_date"
      : (task.due_bucket ?? "today"),
    specificDate: task.due_date ?? "",
    billable: task.billable,
  };
}

// ---------- New task dialog with override guard ----------

function NewTaskDialog() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<TaskFieldsValue>(defaultTaskFieldsValue());
  const [pendingOverride, setPendingOverride] = useState<null | {
    spoonsOver: number;
    conv: ReturnType<typeof fieldsToTaskInput> & { title: string };
  }>(null);

  const resetForm = () => {
    setValue(defaultTaskFieldsValue());
    setPendingOverride(null);
  };

  const persist = async (conv: {
    title: string;
    notes: string | null;
    spoonEstimate: number | null;
    estimatedHours: number | null;
    complexity: import("@/lib/tasks-data").Complexity | null;
    dueDate: string | null;
    dueBucket: import("@/lib/tasks-data").DueBucket | null;
    billable: boolean;
  }) => {
    await createTask(conv);
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
    setOpen(false);
    resetForm();
    toast({ title: "Task added." });
  };

  const add = useMutation({
    mutationFn: async () => {
      const conv = fieldsToTaskInput(value);
      if ("error" in conv) throw new Error(conv.error);

      // Only check the budget when the task lands on Today AND has spoons.
      const landsOnToday =
        conv.dueBucket === "today" ||
        (conv.dueDate === new Date().toISOString().slice(0, 10));
      const spoonNum = conv.spoonEstimate ?? 0;

      if (!landsOnToday || spoonNum === 0) {
        await persist(conv);
        return;
      }

      // Check today's budget: allotted - (committed_tasks + spent).
      const ledger = await getOrCreateTodayLedger();
      const committedTasks = await committedSpoonsFromTasks();
      const projected =
        committedTasks + Number(ledger.spent) + spoonNum -
        Number(ledger.earned_back);
      const budget = Number(ledger.allotted);

      if (budget > 0 && projected > budget) {
        setPendingOverride({
          spoonsOver: projected - budget,
          conv: { ...conv, title: conv.title },
        });
        return;
      }

      await persist(conv);
    },
    onError: (e) => {
      toast({
        title: "Couldn't add",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogTrigger asChild>
          <Button data-testid="button-new-task">
            <Plus className="mr-1 h-4 w-4" /> New task
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Something to do</DialogTitle>
          </DialogHeader>
          <TaskFieldsForm
            value={value}
            onChange={setValue}
            idPrefix="new-task"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => add.mutate()}
              disabled={add.isPending || !value.title.trim()}
              data-testid="button-new-task-add"
            >
              {add.isPending ? "Adding\u2026" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OverrideModal
        open={pendingOverride !== null}
        spoonsOver={pendingOverride?.spoonsOver ?? 0}
        onCancel={() => setPendingOverride(null)}
        onConfirmed={() => {
          if (pendingOverride) {
            const conv = pendingOverride.conv;
            setPendingOverride(null);
            void persist(conv);
          }
        }}
      />
    </>
  );
}

// ---------- Page ----------

export default function Tasks() {
  const [filter, setFilter] = useState<Filter>("active");
  const tasksQ = useQuery<TaskRow[]>({
    queryKey: ["tasks"],
    queryFn: listTasks,
  });

  const filtered = useMemo(() => {
    const rows = tasksQ.data ?? [];
    if (filter === "active") return rows.filter((r) => r.completed_at == null);
    if (filter === "completed") return rows.filter((r) => r.completed_at != null);
    return rows;
  }, [tasksQ.data, filter]);

  const activeCount = (tasksQ.data ?? []).filter(
    (r) => r.completed_at == null,
  ).length;
  const completedCount = (tasksQ.data ?? []).filter(
    (r) => r.completed_at != null,
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tasks"
        subtitle="A working list, kept small. Add estimates when they help. Skip them when they don't."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-md border border-border p-1">
          <FilterButton
            label={`Active (${activeCount})`}
            active={filter === "active"}
            onClick={() => setFilter("active")}
            testid="filter-active"
          />
          <FilterButton
            label={`Done (${completedCount})`}
            active={filter === "completed"}
            onClick={() => setFilter("completed")}
            testid="filter-completed"
          />
          <FilterButton
            label="All"
            active={filter === "all"}
            onClick={() => setFilter("all")}
            testid="filter-all"
          />
        </div>
        <NewTaskDialog />
      </div>

      {tasksQ.isLoading ? (
        <p className="font-serif text-sm italic text-muted-foreground">
          Loading&hellip;
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
  testid,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testid: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted"
      }`}
      data-testid={testid}
    >
      {label}
    </button>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const msg =
    filter === "active"
      ? "Nothing on the list. Add one small next thing when you're ready."
      : filter === "completed"
      ? "No completed tasks yet. Something will land here soon."
      : "No tasks yet. Add one when you're ready.";
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="font-serif text-base italic text-muted-foreground">
          {msg}
        </p>
      </CardContent>
    </Card>
  );
}

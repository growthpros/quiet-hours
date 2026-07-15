// Tasks: the working to-do list.
// Voice: gentle, no red overdue, no bouncing badges. A checkbox is a
// completion, not a scorecard. Notes are optional; spoon estimate is
// optional; adding a task that would push you past today's budget
// opens the override flow (which is compassionate, not punitive).

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, X, Sparkles } from "lucide-react";
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  committedSpoonsFromTasks,
  type TaskRow,
} from "@/lib/tasks-data";
import { getOrCreateTodayLedger } from "@/lib/spoon-data";
import { OverrideModal } from "@/components/override-modal";
import { useToast } from "@/hooks/use-toast";

type Filter = "active" | "completed" | "all";

// ---------- Task row card ----------

function TaskCard({ task }: { task: TaskRow }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [spoon, setSpoon] = useState(
    task.spoon_estimate != null ? String(task.spoon_estimate) : "",
  );

  const toggle = useMutation({
    mutationFn: async () => {
      await updateTask(task.id, { completed: !task.completed_at });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
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
      const trimmedTitle = title.trim();
      if (!trimmedTitle) throw new Error("Title can't be empty.");
      const spoonNum = spoon.trim() ? Number(spoon) : null;
      if (spoon.trim() && (!Number.isFinite(spoonNum) || (spoonNum as number) < 0)) {
        throw new Error("Spoon estimate must be a number 0 or greater.");
      }
      await updateTask(task.id, {
        title: trimmedTitle,
        notes: notes.trim() || null,
        spoonEstimate: spoonNum,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
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
    mutationFn: async () => {
      await deleteTask(task.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const done = task.completed_at != null;

  return (
    <Card data-testid={`card-task-${task.id}`}>
      <CardContent className="space-y-3 p-4">
        {editing ? (
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What is it?"
              data-testid={`input-task-title-${task.id}`}
            />
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              rows={2}
              data-testid={`input-task-notes-${task.id}`}
            />
            <div className="flex items-center gap-2">
              <Label
                htmlFor={`input-task-spoons-${task.id}`}
                className="text-xs italic text-muted-foreground"
              >
                Spoons (optional)
              </Label>
              <Input
                id={`input-task-spoons-${task.id}`}
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={spoon}
                onChange={(e) => setSpoon(e.target.value)}
                className="w-20"
                data-testid={`input-task-spoon-est-${task.id}`}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => save.mutate()}
                disabled={save.isPending}
                data-testid={`button-task-save-${task.id}`}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setTitle(task.title);
                  setNotes(task.notes ?? "");
                  setSpoon(
                    task.spoon_estimate != null
                      ? String(task.spoon_estimate)
                      : "",
                  );
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
              onCheckedChange={() => toggle.mutate()}
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
              {task.spoon_estimate != null && (
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {Number(task.spoon_estimate)} spoon
                  {Number(task.spoon_estimate) === 1 ? "" : "s"}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setEditing(true)}
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
  );
}

// ---------- New task dialog with override guard ----------

function NewTaskDialog() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [spoon, setSpoon] = useState("");
  // Override state: when the add would push past budget, we pause,
  // ask the user to reflect via OverrideModal, and only commit after
  // they confirm.
  const [pendingOverride, setPendingOverride] = useState<null | {
    spoonsOver: number;
  }>(null);

  const resetForm = () => {
    setTitle("");
    setNotes("");
    setSpoon("");
    setPendingOverride(null);
  };

  const persist = async () => {
    const spoonNum = spoon.trim() ? Number(spoon) : null;
    await createTask({
      title: title.trim(),
      notes: notes.trim() || null,
      spoonEstimate: spoonNum,
    });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    // Invalidate every date-keyed spoon ledger + events query so the
    // Today SpoonMeter recomputes committed from the fresh tasks list.
    qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
    qc.invalidateQueries({ queryKey: ["/api/earn-back/events"] });
    setOpen(false);
    resetForm();
    toast({ title: "Task added." });
  };

  const add = useMutation({
    mutationFn: async () => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) throw new Error("Title can't be empty.");

      const spoonNum = spoon.trim() ? Number(spoon) : null;
      if (spoon.trim() && (!Number.isFinite(spoonNum) || (spoonNum as number) < 0)) {
        throw new Error("Spoon estimate must be a number 0 or greater.");
      }

      // If no estimate, just commit; there's nothing to budget against.
      if (spoonNum == null || spoonNum === 0) {
        await persist();
        return;
      }

      // Check today's budget: allotted - (committed_tasks + spent).
      // If adding this task would exceed allotted, prompt override.
      const ledger = await getOrCreateTodayLedger();
      const committedTasks = await committedSpoonsFromTasks();
      const projected =
        committedTasks + Number(ledger.spent) + spoonNum -
        Number(ledger.earned_back);
      const budget = Number(ledger.allotted);

      if (budget > 0 && projected > budget) {
        setPendingOverride({ spoonsOver: projected - budget });
        return; // Do NOT persist yet; wait for override confirmation.
      }

      await persist();
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Something to do</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-task-title">What is it?</Label>
              <Input
                id="new-task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A small next thing"
                data-testid="input-new-task-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-task-notes">
                Notes{" "}
                <span className="text-xs italic text-muted-foreground">
                  optional
                </span>
              </Label>
              <Textarea
                id="new-task-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any context that would help future-you"
                rows={3}
                data-testid="input-new-task-notes"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-task-spoons">
                Spoon estimate{" "}
                <span className="text-xs italic text-muted-foreground">
                  optional, 0 to 20
                </span>
              </Label>
              <Input
                id="new-task-spoons"
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={spoon}
                onChange={(e) => setSpoon(e.target.value)}
                className="max-w-[120px]"
                data-testid="input-new-task-spoons"
              />
              <p className="text-xs italic text-muted-foreground">
                When set, Quiet Hours checks this against today's budget.
                Skip it if you'd rather not.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => add.mutate()}
              disabled={add.isPending || !title.trim()}
              data-testid="button-new-task-add"
            >
              {add.isPending ? "Adding\u2026" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override flow when spoons over budget */}
      <OverrideModal
        open={pendingOverride !== null}
        spoonsOver={pendingOverride?.spoonsOver ?? 0}
        onCancel={() => {
          setPendingOverride(null);
        }}
        onConfirmed={() => {
          setPendingOverride(null);
          // The override is logged; now commit the task.
          void persist();
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
        subtitle="A working list, kept small. Add spoon estimates when it helps. Skip them when it doesn't."
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

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Check, Trash2 } from "lucide-react";
import type { DelegationTask } from "@shared/schema";

type Quadrant = "do" | "schedule" | "delegate" | "drop";

function classify(urgency: number, importance: number): Quadrant {
  const highU = urgency >= 3;
  const highI = importance >= 3;
  if (highU && highI) return "do";
  if (highI) return "schedule";
  if (highU) return "delegate";
  return "drop";
}

const QUADRANT_META: Record<
  Quadrant,
  { title: string; subtitle: string; empty: string }
> = {
  do: {
    title: "Do",
    subtitle: "Yours, and it matters. Take it on.",
    empty: "Nothing urgent and important right now.",
  },
  schedule: {
    title: "Schedule",
    subtitle: "Important, not on fire. Give it a time.",
    empty: "Nothing to plan for later yet.",
  },
  delegate: {
    title: "Delegate",
    subtitle: "Urgent, but not yours to carry alone.",
    empty: "Nothing to hand off right now.",
  },
  drop: {
    title: "Drop",
    subtitle: "Neither urgent nor important. Let it go.",
    empty: "Nothing here yet.",
  },
};

const QUADRANT_LABELS: Record<Quadrant, string> = {
  do: "Do",
  schedule: "Schedule",
  delegate: "Delegate",
  drop: "Drop",
};

function AddTaskDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [assignee, setAssignee] = useState("");
  const [urgency, setUrgency] = useState(3);
  const [importance, setImportance] = useState(3);

  const quadrant = classify(urgency, importance);

  const create = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/delegation", {
        title,
        notes: notes || null,
        assignee: quadrant === "delegate" && assignee ? assignee : null,
        urgency,
        importance,
        releasedControl: 0,
        completed: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/delegation"] });
      setOpen(false);
      setTitle("");
      setNotes("");
      setAssignee("");
      setUrgency(3);
      setImportance(3);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-task">
          <Plus className="mr-1 h-4 w-4" /> Add task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">A task to sort</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What is it?"
              data-testid="input-task-title"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-notes">Notes (optional)</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context worth keeping."
              data-testid="input-task-notes"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Urgency</Label>
              <span className="text-sm text-muted-foreground">{urgency}</span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[urgency]}
              onValueChange={(v) => setUrgency(v[0])}
              data-testid="slider-urgency"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Importance</Label>
              <span className="text-sm text-muted-foreground">
                {importance}
              </span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[importance]}
              onValueChange={(v) => setImportance(v[0])}
              data-testid="slider-importance"
            />
          </div>
          {quadrant === "delegate" && (
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">Assignee (optional)</Label>
              <Input
                id="task-assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Who could carry this?"
                data-testid="input-task-assignee"
              />
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-sm text-muted-foreground">This lands in</span>
            <Badge variant="secondary" data-testid="badge-preview-quadrant">
              {QUADRANT_LABELS[quadrant]}
            </Badge>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={!title.trim() || create.isPending}
            data-testid="button-save-task"
          >
            {create.isPending ? "Saving…" : "Add task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskCard({ task }: { task: DelegationTask }) {
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const quadrant = task.quadrant as Quadrant;

  const patch = useMutation({
    mutationFn: async (data: Partial<DelegationTask>) => {
      await apiRequest("PATCH", `/api/delegation/${task.id}`, data);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/delegation"] }),
  });

  const del = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/delegation/${task.id}`);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/delegation"] }),
  });

  const released = task.releasedControl === 1;

  return (
    <Card data-testid={`card-task-${task.id}`}>
      <CardContent className="space-y-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="font-medium text-foreground">{task.title}</p>
            {task.notes && (
              <p className="text-sm text-muted-foreground">{task.notes}</p>
            )}
          </div>
          <Badge variant="outline" className="shrink-0 font-mono text-[11px]">
            u{task.urgency} · i{task.importance}
          </Badge>
        </div>

        {quadrant === "delegate" && (
          <div className="space-y-2 rounded-md bg-muted/50 p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <Checkbox
                checked={released}
                onCheckedChange={(c) =>
                  patch.mutate({ releasedControl: c ? 1 : 0 })
                }
                data-testid={`checkbox-release-${task.id}`}
                className="mt-0.5"
              />
              <span className="text-sm text-foreground">
                I am releasing control of this
              </span>
            </label>
            <p className="pl-7 font-serif text-sm italic text-muted-foreground">
              {released
                ? "Good. Resist the urge to check in unprompted."
                : "It will not be done my way. That is the point."}
            </p>
            <Input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              onBlur={() => {
                if (assignee !== (task.assignee ?? ""))
                  patch.mutate({ assignee: assignee || null });
              }}
              placeholder="Who's carrying it?"
              className="h-8"
              data-testid={`input-assignee-${task.id}`}
            />
          </div>
        )}

        {quadrant === "drop" && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-accent/40 p-3">
            <p className="font-serif text-sm italic text-accent-foreground">
              This might not need doing at all — delete it now?
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => del.mutate()}
              data-testid={`button-drop-delete-${task.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-0.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => patch.mutate({ completed: 1 })}
            data-testid={`button-complete-${task.id}`}
          >
            <Check className="mr-1 h-4 w-4" /> Complete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => del.mutate()}
            data-testid={`button-delete-${task.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuadrantColumn({
  quadrant,
  tasks,
}: {
  quadrant: Quadrant;
  tasks: DelegationTask[];
}) {
  const meta = QUADRANT_META[quadrant];
  return (
    <div className="space-y-3" data-testid={`quadrant-${quadrant}`}>
      <div className="space-y-0.5">
        <h2 className="font-serif text-lg font-semibold text-foreground">
          {meta.title}
        </h2>
        <p className="font-serif text-sm italic text-muted-foreground">
          {meta.subtitle}
        </p>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center font-serif text-sm italic text-muted-foreground">
          {meta.empty}
        </p>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Delegation() {
  const { data, isLoading } = useQuery<DelegationTask[]>({
    queryKey: ["/api/delegation"],
  });

  const active = (data ?? []).filter((t) => !t.completed);
  const byQuadrant = (q: Quadrant) =>
    active.filter((t) => t.quadrant === q);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Delegation"
        subtitle="Not everything that lands on you is yours to carry. Sort it, then let the matrix decide."
      >
        <AddTaskDialog />
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
          <QuadrantColumn quadrant="do" tasks={byQuadrant("do")} />
          <QuadrantColumn quadrant="schedule" tasks={byQuadrant("schedule")} />
          <QuadrantColumn quadrant="delegate" tasks={byQuadrant("delegate")} />
          <QuadrantColumn quadrant="drop" tasks={byQuadrant("drop")} />
        </div>
      )}
    </div>
  );
}

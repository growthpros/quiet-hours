// Missed-recurring 'Ask me' prompt.
//
// When any recurring template with on_miss='ask_me' has past-due
// incomplete instances, this nudge appears on the Today page. Per Caroline's
// Jul 17 decision: not a blocking modal. Just a gentle card the user can
// interact with when they're ready.
//
// Per-item actions:
//   - Move to today: sets due_date=today, due_bucket='today'
//   - Keep in history: marks the row as skipped/archived; the DB row
//     remains for reporting via the tasks.archived_at column
//   - Mark done: opens the standard backdate-on-completion picker so the
//     user can say 'I actually finished it yesterday'
//
// Voice: notice, don't grade. Copy uses commas, periods, colons. No red,
// no urgency, no shame. Neurodivergent-friendly: shows the list once, no
// re-nagging within a session (dismissed state kept in local state).

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Repeat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listTasks,
  archiveTask,
  moveTaskToToday,
  updateTask,
  type TaskRow,
} from "@/lib/tasks-data";
import {
  listRecurringTemplates,
  type RecurringTemplateRow,
} from "@/lib/recurring-data";
import { localIsoDate } from "@/lib/local-date";
import { repeatMoveWindow, repeatQuickChoices } from "@/lib/task-move";

// End-of-yesterday timestamp in the user's local time. Used when a user
// says 'I actually did this yesterday' from the prompt. Matches the
// backdate picker helper on the Tasks page.
function endOfYesterdayMs(): number {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(23, 59, 0, 0);
  return d.getTime();
}

// Format a due_date like 'yesterday', weekday name, or 'Jul 15'.
function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (due.getTime() === yesterday.getTime()) return "yesterday";
  const diffDays = Math.round((today.getTime() - due.getTime()) / 86400000);
  if (diffDays > 0 && diffDays <= 6) {
    return due.toLocaleDateString(undefined, { weekday: "long" });
  }
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MissedRecurringPrompt() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);

  const tasksQ = useQuery<TaskRow[]>({
    queryKey: ["tasks"],
    queryFn: listTasks,
    staleTime: 60_000,
  });
  const templatesQ = useQuery<RecurringTemplateRow[]>({
    queryKey: ["recurring-templates"],
    queryFn: listRecurringTemplates,
    staleTime: 60_000,
  });

  const today = localIsoDate();

  // Only rows that are: incomplete, past-due, from a template, whose
  // template exists and has on_miss='ask_me'. Missing templates or
  // 'let_it_go' / 'always_roll' templates are excluded because they
  // shouldn't nag the user.
  const templatesById = useMemo(() => {
    const map = new Map<number, RecurringTemplateRow>();
    for (const t of templatesQ.data ?? []) map.set(t.id, t);
    return map;
  }, [templatesQ.data]);

  const rows = useMemo(() => {
    return (tasksQ.data ?? [])
      .filter((t) => {
        if (t.completed_at != null) return false;
        if (t.archived_at != null) return false;
        if (!t.due_date || t.due_date >= today) return false;
        if (!t.recurring_template_id) return false;
        const tmpl = templatesById.get(t.recurring_template_id);
        if (!tmpl) return false;
        return tmpl.on_miss === "ask_me";
      })
      .sort((a, b) =>
        (a.due_date ?? "").localeCompare(b.due_date ?? ""),
      );
  }, [tasksQ.data, templatesById, today]);

  const moveMut = useMutation({
    mutationFn: async (taskId: number) => moveTaskToToday(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
    },
  });
  const keepMut = useMutation({
    mutationFn: async (taskId: number) => archiveTask(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  const markDoneYesterdayMut = useMutation({
    mutationFn: async (taskId: number) =>
      updateTask(taskId, {
        completed: true,
        completedAtOverride: endOfYesterdayMs(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
    },
  });

  if (dismissed) return null;
  if (rows.length === 0) return null;

  return (
    <Card
      className="border-l-2 border-l-primary"
      data-testid="card-missed-recurring-prompt"
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            <p className="font-serif text-base">
              {rows.length === 1
                ? "One recurring item wasn't checked off. What would you like to do?"
                : `${rows.length} recurring items weren't checked off. What would you like to do?`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            data-testid="button-missed-prompt-dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs italic text-muted-foreground">
          No wrong answer. Pick per item, or ignore this and it will wait
          quietly until later.
        </p>

        <div className="space-y-2">
          {rows.map((task) => (
            <MissedRow
              key={task.id}
              task={task}
              // Only offer "Move to today" when today is before this repeat's
              // next occurrence, so it can't create a second copy for today.
              canMoveToToday={repeatQuickChoices(
                repeatMoveWindow(
                  templatesById.get(task.recurring_template_id!)!,
                  task.due_date!,
                  today,
                ),
                today,
              ).includes("today")}
              onMoveToToday={() =>
                moveMut.mutate(task.id, {
                  onSuccess: () =>
                    toast({ title: "Moved to today." }),
                })
              }
              onKeepInHistory={() =>
                keepMut.mutate(task.id, {
                  onSuccess: () =>
                    toast({
                      title: "Kept in history.",
                      description: "Still saved for reports.",
                    }),
                })
              }
              onMarkDone={() =>
                markDoneYesterdayMut.mutate(task.id, {
                  onSuccess: () =>
                    toast({
                      title: "Marked done.",
                      description: `Recorded as ${formatDate(task.due_date)}.`,
                    }),
                })
              }
              pending={
                moveMut.isPending ||
                keepMut.isPending ||
                markDoneYesterdayMut.isPending
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Single row inside the prompt ----------

function MissedRow({
  task,
  canMoveToToday,
  onMoveToToday,
  onKeepInHistory,
  onMarkDone,
  pending,
}: {
  task: TaskRow;
  canMoveToToday: boolean;
  onMoveToToday: () => void;
  onKeepInHistory: () => void;
  onMarkDone: () => void;
  pending: boolean;
}) {
  const dateLabel = formatDate(task.due_date);
  return (
    <div
      className="rounded-md border border-border bg-muted/20 p-3"
      data-testid={`missed-prompt-row-${task.id}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-serif text-sm">{task.title}</p>
        <p className="text-xs italic text-muted-foreground">
          Due {dateLabel}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {canMoveToToday && (
          <Button
            size="sm"
            variant="outline"
            onClick={onMoveToToday}
            disabled={pending}
            data-testid={`missed-prompt-move-${task.id}`}
          >
            Move to today
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onMarkDone}
          disabled={pending}
          data-testid={`missed-prompt-done-${task.id}`}
        >
          I did it {dateLabel}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onKeepInHistory}
          disabled={pending}
          data-testid={`missed-prompt-keep-${task.id}`}
          className="text-muted-foreground"
        >
          Let it go
        </Button>
      </div>
    </div>
  );
}

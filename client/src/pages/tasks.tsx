// Tasks: the working to-do list.
// Voice: gentle, no red overdue, no bouncing badges. Adding a task with a
// spoon estimate that would push you past today's budget opens the
// OverrideModal (compassionate, not punitive). Completing a task with an
// estimated_hours prompts for actual_hours + reason so the AI can learn
// how the user actually estimates over time.

import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil, Sparkles, Split } from "lucide-react";
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  breakDownTask,
  linkTaskToRecurringTemplate,
  archiveTask,
  parsedItemCostFields,
  DUE_BUCKET_LABEL,
  type TaskRow,
  type DueBucket,
} from "@/lib/tasks-data";
import { getOrCreateTodayLedger } from "@/lib/spoon-data";
import { getOrCreateProfile } from "@/lib/foundation-data";
import { cleanUsual } from "@/lib/daily-budget";
import { spoonsOverIfAdded } from "@/lib/spoon-budget";
import { DEFAULT_EFFORT, spoonsOf, spoonsOfInput, taskSpoons } from "@/lib/spoon-cost";
import { OverrideModal } from "@/components/override-modal";
import { useToast } from "@/hooks/use-toast";
import {
  TaskFieldsForm,
  defaultTaskFieldsValue,
  fieldsToTaskInput,
  type TaskFieldsValue,
  type TaskInput,
} from "@/components/task-fields-form";
import { ChevronLeft, Repeat, RefreshCw } from "lucide-react";
import {
  RecurringPatternForm,
  defaultRecurringPatternValue,
  validateRecurringPattern,
  type RecurringPatternValue,
} from "@/components/recurring-pattern-form";
import {
  createRecurringTemplate,
  listRecurringTemplates,
  describePattern,
  type RecurringTemplateRow,
} from "@/lib/recurring-data";
import { resolveRecurringInstances } from "@/lib/recurring-resolver";
import { Link } from "wouter";
import { addLocalDays, localIsoDate } from "@/lib/local-date";
import { isMissed, matchesTimeframe, type Timeframe } from "@/lib/task-timeframe";
import { MoveTaskMenu } from "@/components/move-task-menu";
import { useWeekStart } from "@/lib/use-week-start";
import { clearAddressQuery, parseDateParam } from "@/lib/date-param";
import {
  timeframeWindow,
  upcomingInWindow,
  type UpcomingRepeat,
} from "@/lib/upcoming-repeats";

type Filter = "active" | "missed" | "completed" | "archived" | "all";
type MissedSubFilter = "all" | "recurring" | "non_recurring";
type ArchiveTypeFilter = "all" | "recurring" | "non_recurring";
type TimeframeFilter = Timeframe;

// Missed = task is incomplete AND is on a date that has already passed.
// Per Session 3.3 decision (Option B):
//   - Recurring instances with due_date < today are ALWAYS missed. Their
//     on_miss policy determines what happens next (let_it_go: stays here;
//     ask_me: prompt user; always_roll: resolver rewrote it to today so
//     it never reaches this state).
//   - Non-recurring tasks are missed ONLY if they have a specific past
//     due_date AND due_bucket != 'today'. Tasks marked with due_bucket=
//     'today' get rolled forward by Session 3.2's rollover at midnight,
//     so they never accumulate here.
// isMissed and matchesTimeframe live in lib/task-timeframe.ts, shared
// with Today and the spoon meter.

const TIMEFRAME_LABEL: Record<TimeframeFilter, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This week",
  next_week: "Next week",
  this_month: "This month",
  all: "Any time",
  date: "Pick a date\u2026",
};

// ---------- Task summary chips (below title, when values are present) ----------

function TaskChips({ task }: { task: TaskRow }) {
  const chips: string[] = [];
  const n = taskSpoons(task);
  if (n != null) chips.push(`${n} spoon${n === 1 ? "" : "s"}`);
  if (task.estimated_hours != null) {
    const h = Number(task.estimated_hours);
    chips.push(`${h}h`);
  }
  if (task.complexity) chips.push(`${task.complexity} effort`);
  if (task.billable) chips.push("billable");
  if (task.due_bucket && task.due_bucket !== "today") {
    chips.push(DUE_BUCKET_LABEL[task.due_bucket]);
  }
  if (task.due_date) {
    chips.push(new Date(task.due_date + "T00:00:00").toLocaleDateString());
  }
  if (task.rolled_from_date) chips.push("carried over");
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
  onConfirm: (
    actualHours: number | null,
    reason: string | null,
    completedAtOverride: number | undefined,
  ) => void;
  // If true, adds a Today/Yesterday radio at the top so past-due tasks
  // can be backdated by one day. Neurodivergent-friendly: forgetting to
  // check off before bed is common and shouldn't require a support
  // request.
  pastDue?: boolean;
}

// End-of-yesterday timestamp in the user's local time. Used as the
// completed_at value when a user says 'I finished this yesterday.'
// Yesterday's date at 23:59:00 local converted to milliseconds.
function endOfYesterdayMs(): number {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(23, 59, 0, 0);
  return d.getTime();
}

// Human-readable label for a due_date string like 'Monday', 'Jul 15',
// or 'yesterday' if it's exactly one day ago. Used in the backdate
// picker prompt.
function formatDueDateLabel(iso: string | null): string {
  if (!iso) return "earlier";
  const [y, m, d] = iso.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (due.getTime() === yesterday.getTime()) return "yesterday";
  // Within the last week: use weekday name
  const diffDays = Math.round((today.getTime() - due.getTime()) / 86400000);
  if (diffDays > 0 && diffDays <= 6) {
    return due.toLocaleDateString(undefined, { weekday: "long" });
  }
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function CompletionPopup({
  open,
  task,
  onCancel,
  onConfirm,
  pastDue,
}: CompletionPopupProps) {
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [whenFinished, setWhenFinished] = useState<"today" | "yesterday">(
    "today",
  );

  // Reset when a new task is passed in.
  useMemo(() => {
    if (task) {
      setHours(task.estimated_hours != null ? String(task.estimated_hours) : "");
      setReason("");
      setWhenFinished("today");
    }
  }, [task?.id]);

  if (!task) return null;
  const hasEstimated = task.estimated_hours != null;

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
            {pastDue ? "When did you finish it?" : "How did it actually land?"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Backdate picker: shown only for past-due tasks. Two options,
              default Today. 'Yesterday' sets completed_at to end-of-
              yesterday local so reports honor the actual completion date.
              Deliberately no arbitrary past dates: keeps history honest
              and reduces support surface. */}
          {pastDue && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This was due {formatDueDateLabel(task.due_date)}. When did
                you actually finish it?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWhenFinished("today")}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                    whenFinished === "today"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                  data-testid="backdate-today"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setWhenFinished("yesterday")}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                    whenFinished === "yesterday"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                  data-testid="backdate-yesterday"
                >
                  Yesterday
                </button>
              </div>
            </div>
          )}
          {hasEstimated && (
            <p className="text-sm italic text-muted-foreground font-serif">
              No grading. This just helps Quiet Hours learn how you actually
              estimate so future guesses get closer.
            </p>
          )}

          {hasEstimated && (
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
                    ? `${Math.abs(variance)}h shorter than estimated.`
                    : `Right on the estimate.`}
                </p>
              )}
            </div>
          )}

          {hasEstimated && (
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
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {hasEstimated ? "Skip" : "Cancel"}
          </Button>
          <Button
            onClick={() =>
              onConfirm(
                parsedHours,
                reason.trim() || null,
                whenFinished === "yesterday" ? endOfYesterdayMs() : undefined,
              )
            }
            data-testid="button-completion-save"
          >
            {hasEstimated ? "Save and complete" : "Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Task row card ----------

function TaskCard({
  task,
  template,
  showMissedActions,
  showLetGoAction,
}: {
  task: TaskRow;
  // The parent template if this task was generated from (or adopted by)
  // a recurring template. Null for ad-hoc tasks or orphaned instances
  // whose template was deleted.
  template: RecurringTemplateRow | null;
  // Shown only when the current filter is Missed: inline 'Move to today'
  // and 'Let it go' actions.
  showMissedActions?: boolean;
  // Shown when the current filter is Done: inline 'Let it go' action.
  showLetGoAction?: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<TaskFieldsValue>(() =>
    taskToFields(task),
  );
  const [completing, setCompleting] = useState(false);
  const [breakingDown, setBreakingDown] = useState(false);
  const [makingRecurring, setMakingRecurring] = useState(false);

  // True if this task is already an instance of a recurring template.
  // In that case we hide the Make Recurring button (it makes no sense
  // to convert a generated instance into yet another template).
  const alreadyRecurring = task.recurring_template_id !== null;

  const done = task.completed_at != null;
  const hasEstimatedHours = task.estimated_hours != null;
  const today = localIsoDate();

  const toggle = useMutation({
    mutationFn: async (opts: {
      actualHours?: number | null;
      reason?: string | null;
      completedAtOverride?: number;
    }) => {
      await updateTask(task.id, {
        completed: !done,
        actualHours: opts.actualHours ?? undefined,
        completionReason: opts.reason ?? undefined,
        completedAtOverride: opts.completedAtOverride,
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
        socialLoad: conv.socialLoad,
        dread: conv.dread,
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

  const archive = useMutation({
    mutationFn: async () => archiveTask(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
      toast({
        title: "Let go.",
        description: "Still saved for reports.",
      });
    },
    onError: (e) => {
      toast({
        title: "Couldn't let it go",
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
          ...parsedItemCostFields(it),
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

  // Past-due = task has a due_date strictly before today and is not
  // completed yet. Includes missed recurring instances AND non-recurring
  // past-due tasks. Determines whether the backdate picker appears when
  // the user checks off the task.
  const pastDue = !done && task.due_date != null && task.due_date < today;

  const handleToggle = () => {
    if (done) {
      // Uncompleting is quiet, no popup
      toggle.mutate({});
      return;
    }
    if (pastDue || hasEstimatedHours) {
      // Past-due tasks always get the popup (for backdating).
      // Tasks with estimated hours get the popup even if not past due
      // (for actual-hours + reason capture).
      setCompleting(true);
    } else {
      // Not past-due, no estimate to compare against, complete quietly.
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
                <div className="flex items-center gap-2">
                  {alreadyRecurring && (
                    <Repeat
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-label="Recurring task"
                    />
                  )}
                  <p
                    className={`font-serif text-base ${
                      done
                        ? "italic text-muted-foreground line-through decoration-muted-foreground/40"
                        : "text-foreground"
                    }`}
                  >
                    {task.title}
                  </p>
                </div>
                {task.notes && (
                  <p className="whitespace-pre-wrap font-serif text-sm italic text-muted-foreground">
                    {task.notes}
                  </p>
                )}
                <TaskChips task={task} />
                {/* Recurring template pointer. Only shown for generated
                    instances. Clicking navigates to /recurring where the
                    user can edit or pause the template. If the template
                    has been deleted (recurring_template_id set but no
                    match in the map), fall back to a subtle 'Repeats' hint
                    with no link. */}
                {alreadyRecurring && template && (
                  <Link
                    href="/recurring"
                    className="pt-0.5 text-xs italic text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    data-testid={`link-task-template-${task.id}`}
                  >
                    Repeats: {describePattern(template).toLowerCase()}
                  </Link>
                )}
                {alreadyRecurring && !template && (
                  <p className="pt-0.5 text-xs italic text-muted-foreground">
                    From a repeat that was removed. This task remains as
                    history.
                  </p>
                )}
                {task.completion_reason && done && (
                  <p className="whitespace-pre-wrap pt-1 font-serif text-xs italic text-muted-foreground">
                    Reason: {task.completion_reason}
                  </p>
                )}
                {/* Missed-row inline actions. Muted text buttons keep the
                    row visually calm; no red, no urgency. */}
                {showMissedActions && (
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                    <MoveTaskMenu task={task} template={template} variant="text" />
                    <button
                      type="button"
                      onClick={() => archive.mutate()}
                      disabled={archive.isPending}
                      className="italic text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                      data-testid={`button-task-let-go-${task.id}`}
                    >
                      Let it go
                    </button>
                  </div>
                )}
                {/* Done-row 'Let it go' action. Same word for consistency. */}
                {showLetGoAction && !showMissedActions && (
                  <div className="pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => archive.mutate()}
                      disabled={archive.isPending}
                      className="italic text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                      data-testid={`button-task-archive-${task.id}`}
                    >
                      Let it go
                    </button>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!done && !showMissedActions && (
                  <MoveTaskMenu task={task} template={template} />
                )}
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
                {!done && !alreadyRecurring && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setMakingRecurring(true)}
                    aria-label="Make this repeat"
                    title="Make this repeat on a schedule"
                    data-testid={`button-task-make-recurring-${task.id}`}
                  >
                    <RefreshCw className="h-4 w-4" />
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
        onConfirm={(actualHours, reason, completedAtOverride) => {
          setCompleting(false);
          toggle.mutate({ actualHours, reason, completedAtOverride });
        }}
        pastDue={pastDue}
      />

      <MakeRecurringDialog
        open={makingRecurring}
        task={task}
        onClose={() => setMakingRecurring(false)}
      />
    </>
  );
}

// ---------- MakeRecurringDialog: convert an existing task to recurring ----------

// Reuses the same visual two-step pattern as the New Task dialog. The
// difference: task fields are already set (they belong to the existing
// task row), so Step 1 is the pattern configuration directly, framed by
// a title referencing the task.
//
// On Set up:
//   1. Create a recurring_task_templates row with the task's title,
//      notes, spoons, hours, complexity, billable copied in.
//   2. Adopt the existing task as the template's first instance by
//      setting tasks.recurring_template_id to the new template's id
//      (unique (template_id, due_date) index prevents duplicate).
//   3. Also update template's last_generated_for and
//      occurrences_generated so the resolver doesn't try to insert
//      today's instance again.
//   4. Run the resolver for any future dates.

function MakeRecurringDialog({
  open,
  task,
  onClose,
}: {
  open: boolean;
  task: TaskRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pattern, setPattern] = useState<RecurringPatternValue>(() =>
    // Default: daily starting today, with sensible on_miss.
    defaultRecurringPatternValue(),
  );

  const setUp = useMutation({
    mutationFn: async () => {
      const invalid = validateRecurringPattern(pattern);
      if (invalid) throw new Error(invalid);

      // Adoption strategy: if task has a due_date, use it as start_date
      // so the task IS the first instance. Otherwise use pattern's
      // start_date as given.
      const startDate = task.due_date ?? pattern.start_date;

      const template = await createRecurringTemplate({
        title: task.title,
        notes: task.notes,
        spoon_estimate: task.spoon_estimate,
        estimated_hours: task.estimated_hours ?? 0.5,
        complexity: task.complexity ?? DEFAULT_EFFORT,
        social_load: task.social_load,
        dread: task.dread,
        billable: task.billable,
        pattern_type: pattern.pattern_type,
        interval_n: pattern.interval_n,
        days_of_week: pattern.days_of_week,
        monthly_kind: pattern.monthly_kind,
        day_of_month: pattern.day_of_month,
        nth_weekday: pattern.nth_weekday,
        nth_weekday_day: pattern.nth_weekday_day,
        start_date: startDate,
        end_date: pattern.end_date,
        end_after_n: pattern.end_after_n,
        on_miss: pattern.on_miss,
      });

      // Adopt this task as the first instance so we don't duplicate today
      // when the resolver runs.
      await linkTaskToRecurringTemplate(task.id, template.id);

      // Resolve future instances (in the current window, likely just
      // increments last_generated_for; won't insert a duplicate row for
      // today thanks to the unique index).
      await resolveRecurringInstances();

      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["recurring-templates"] });
    },
    onSuccess: () => {
      onClose();
      toast({ title: "Recurring set up." });
    },
    onError: (e) => {
      toast({
        title: "Couldn't set up recurring",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">
            Make “{task.title}” repeat
          </DialogTitle>
        </DialogHeader>
        <RecurringPatternForm value={pattern} onChange={setPattern} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => setUp.mutate()}
            disabled={setUp.isPending}
            data-testid="button-make-recurring-set-up"
          >
            {setUp.isPending ? "Setting up\u2026" : "Set up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    socialLoad: task.social_load ?? false,
    dread: task.dread ?? false,
    timeline: task.due_date
      ? "specific_date"
      : (task.due_bucket ?? "today"),
    specificDate: task.due_date ?? "",
    billable: task.billable,
  };
}

// ---------- New task dialog with override guard ----------

// Human-readable summary of the recurring pattern for the chip that
// appears back on the task step after the user hits Set up.
function summarizeRecurringDraft(p: RecurringPatternValue): string {
  const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const NTH = ["", "1st", "2nd", "3rd", "4th", "5th"];
  switch (p.pattern_type) {
    case "daily":
    case "custom":
      return p.interval_n === 1 ? "Every day" : `Every ${p.interval_n} days`;
    case "weekly":
      if (p.days_of_week.length === 0) {
        return p.interval_n === 1 ? "Every week" : `Every ${p.interval_n} weeks`;
      }
      return `Weekly on ${[...p.days_of_week].sort().map((d) => WEEKDAY_SHORT[d]).join(", ")}`;
    case "monthly":
      if (p.monthly_kind === "day_of_month" && p.day_of_month) {
        return `Monthly on day ${p.day_of_month}`;
      }
      if (p.monthly_kind === "nth_weekday" && p.nth_weekday && p.nth_weekday_day !== null) {
        return `Monthly on the ${NTH[p.nth_weekday]} ${WEEKDAY_SHORT[p.nth_weekday_day]}`;
      }
      return "Monthly";
  }
}

type DialogStep = "task" | "recurring";

function NewTaskDialog() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<DialogStep>("task");
  const [value, setValue] = useState<TaskFieldsValue>(defaultTaskFieldsValue());
  // Recurring state:
  //   isRecurring = checkbox state (may be true while step='task' if the
  //     user has configured a draft and returned to the task step)
  //   pattern = the pattern-form's live value while on the recurring step
  //   patternDraft = a saved copy from Set up, used to render the chip and
  //     reopen the recurring step with the same values. null until first
  //     Set up.
  const [isRecurring, setIsRecurring] = useState(false);
  const [pattern, setPattern] = useState<RecurringPatternValue>(
    defaultRecurringPatternValue(),
  );
  const [patternDraft, setPatternDraft] = useState<RecurringPatternValue | null>(
    null,
  );
  // Narrower conv type: at set-time we've already thrown when the union
  // was in the {error} branch, so the stored value is always the success
  // branch. Compiler can't remember that across the state hop.
  type ConvSuccess = TaskInput;
  const [pendingOverride, setPendingOverride] = useState<null | {
    spoonsOver: number;
    conv: ConvSuccess;
  }>(null);

  const resetForm = () => {
    setValue(defaultTaskFieldsValue());
    setIsRecurring(false);
    setPattern(defaultRecurringPatternValue());
    setPatternDraft(null);
    setStep("task");
    setPendingOverride(null);
  };

  // Checkbox handler. Keeps checkbox semantics clean:
  //  - Unchecked -> checked: if there's no draft yet, opens Step 2 to
  //    configure. If a draft already exists (rare, only from an Edit
  //    round-trip), just marks isRecurring true and stays on task step.
  //  - Checked -> unchecked: drops the draft entirely. Re-checking
  //    later starts fresh. Simpler mental model.
  const toggleRecurring = (on: boolean) => {
    setIsRecurring(on);
    if (on) {
      if (!patternDraft) {
        setPattern(defaultRecurringPatternValue());
        setStep("recurring");
      }
    } else {
      setPatternDraft(null);
      setPattern(defaultRecurringPatternValue());
    }
  };

  // Edit link handler: reopens Step 2 preloaded with the saved draft.
  const editPatternDraft = () => {
    if (patternDraft) {
      setPattern(patternDraft);
      setStep("recurring");
    }
  };

  // Set up button on the recurring step: validate, commit to draft,
  // return to the task step. Nothing hits the DB yet.
  const commitPatternDraft = () => {
    const invalid = validateRecurringPattern(pattern);
    if (invalid) {
      toast({ title: "Fix this to continue", description: invalid });
      return;
    }
    setPatternDraft(pattern);
    setStep("task");
  };

  const persist = async (conv: TaskInput) => {
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

      // Recurring path: use the saved patternDraft (guaranteed to exist
      // when isRecurring is true; the recurring step blocks return
      // without a valid draft). Create the template then resolve so
      // today's first instance appears immediately. No override modal
      // here; budget check applies to each generated instance, not the
      // template itself.
      if (isRecurring && patternDraft) {
        await createRecurringTemplate({
          title: conv.title,
          notes: conv.notes,
          spoon_estimate: conv.spoonEstimate,
          estimated_hours: conv.estimatedHours ?? 0.5,
          complexity: conv.complexity ?? DEFAULT_EFFORT,
          social_load: conv.socialLoad,
          dread: conv.dread,
          billable: conv.billable,
          pattern_type: patternDraft.pattern_type,
          interval_n: patternDraft.interval_n,
          days_of_week: patternDraft.days_of_week,
          monthly_kind: patternDraft.monthly_kind,
          day_of_month: patternDraft.day_of_month,
          nth_weekday: patternDraft.nth_weekday,
          nth_weekday_day: patternDraft.nth_weekday_day,
          start_date: patternDraft.start_date,
          end_date: patternDraft.end_date,
          end_after_n: patternDraft.end_after_n,
          on_miss: patternDraft.on_miss,
        });
        await resolveRecurringInstances();
        qc.invalidateQueries({ queryKey: ["tasks"] });
        qc.invalidateQueries({ queryKey: ["recurring-templates"] });
        qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
        setOpen(false);
        resetForm();
        toast({ title: "Recurring set up." });
        return;
      }

      // Only check the budget when the task lands on Today AND has spoons.
      const landsOnToday =
        conv.dueBucket === "today" ||
        (conv.dueDate === localIsoDate());
      const spoonNum = spoonsOfInput(conv);

      if (!landsOnToday || spoonNum === 0) {
        await persist(conv);
        return;
      }

      // Check today's budget (see lib/spoon-budget.ts): spent so far,
      // including tasks finished today, plus today's plan plus this task,
      // against the check-in budget, or your usual before the check-in.
      const [ledger, tasksNow, profile] = await Promise.all([
        getOrCreateTodayLedger(),
        listTasks(),
        getOrCreateProfile(),
      ]);
      const over = spoonsOverIfAdded(
        tasksNow,
        ledger,
        cleanUsual(profile.usual_budget),
        localIsoDate(),
        spoonNum,
      );
      if (over > 0) {
        setPendingOverride({ spoonsOver: over, conv });
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
            <DialogTitle className="font-serif flex items-center gap-2">
              {step === "recurring" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 -ml-1"
                  onClick={() => setStep("task")}
                  aria-label="Back to task"
                  data-testid="button-recurring-back"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              {step === "task" ? "Something to do" : "Repeats"}
            </DialogTitle>
          </DialogHeader>

          {step === "task" ? (
            <>
              <TaskFieldsForm
                value={value}
                onChange={setValue}
                idPrefix="new-task"
              />

              {/* Recurring checkbox. If a draft is saved, clicking the summary
                  chip reopens the recurring step preloaded with the draft. */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={isRecurring}
                    onCheckedChange={(v) => toggleRecurring(v === true)}
                    data-testid="checkbox-recurring"
                  />
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                  <span>Repeats</span>
                </label>
                {isRecurring && patternDraft && (
                  <div className="pl-6 text-xs italic text-muted-foreground">
                    <span data-testid="text-recurring-summary">
                      {summarizeRecurringDraft(patternDraft)}
                    </span>
                    <button
                      type="button"
                      onClick={editPatternDraft}
                      className="ml-2 not-italic underline underline-offset-2 hover:text-foreground"
                      data-testid="button-recurring-edit"
                    >
                      Edit
                    </button>
                  </div>
                )}
                {isRecurring && !patternDraft && (
                  <button
                    type="button"
                    onClick={() => setStep("recurring")}
                    className="pl-6 text-xs italic text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    data-testid="button-recurring-configure"
                  >
                    Not yet configured. Set up.
                  </button>
                )}
              </div>
            </>
          ) : (
            <RecurringPatternForm value={pattern} onChange={setPattern} />
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {step === "task" ? (
              <Button
                onClick={() => add.mutate()}
                disabled={
                  add.isPending ||
                  !value.title.trim() ||
                  (isRecurring && !patternDraft)
                }
                data-testid="button-new-task-add"
              >
                {add.isPending ? "Adding\u2026" : "Add"}
              </Button>
            ) : (
              <Button
                onClick={commitPatternDraft}
                data-testid="button-recurring-set-up"
              >
                Set up
              </Button>
            )}
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
        onMoveTomorrow={() => {
          if (pendingOverride) {
            const conv = pendingOverride.conv;
            setPendingOverride(null);
            void persist({
              ...conv,
              dueDate: localIsoDate(addLocalDays(new Date(), 1)),
              dueBucket: null,
            });
          }
        }}
        onMakeSmaller={() => {
          setPendingOverride(null);
          toast({
            title: "What's the smallest piece that fits today?",
            description: "Change the title and spoons to just that piece, then add it.",
          });
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
  // Load all templates once so each TaskCard can render its parent
  // template's pattern without a per-row round trip. Small list, cached.
  const templatesQ = useQuery<RecurringTemplateRow[]>({
    queryKey: ["recurring-templates"],
    queryFn: listRecurringTemplates,
  });
  const templatesById = useMemo(() => {
    const map = new Map<number, RecurringTemplateRow>();
    for (const t of templatesQ.data ?? []) map.set(t.id, t);
    return map;
  }, [templatesQ.data]);

  const [missedSub, setMissedSub] = useState<MissedSubFilter>("all");
  // A day tapped on the Calendar arrives as ?date=YYYY-MM-DD.
  const [linkedDate] = useState(() =>
    parseDateParam(window.location.search, window.location.hash),
  );
  const [timeframe, setTimeframe] = useState<TimeframeFilter>(
    linkedDate ? "date" : "today",
  );
  const [pickedDate, setPickedDate] = useState<string>(
    () => linkedDate ?? localIsoDate(),
  );
  // Clear the ?date= once it's been read, so it doesn't stick around and
  // reapply the next time the Tasks page opens.
  useEffect(() => clearAddressQuery(), []);
  const weekStartsOn = useWeekStart();
  // Archive filter controls. Default: last 30 days, all types, no text.
  const [archiveType, setArchiveType] = useState<ArchiveTypeFilter>("all");
  const [archiveFrom, setArchiveFrom] = useState<string>(() => {
    return localIsoDate(addLocalDays(new Date(), -30));
  });
  const [archiveTo, setArchiveTo] = useState<string>(() => localIsoDate());
  const [archiveSearch, setArchiveSearch] = useState("");
  const today = localIsoDate();

  // Archived rows are treated separately. Non-archived rows populate
  // Active/Missed/Done/All. Archived rows only appear when the user
  // explicitly opens the Archived tab.
  const allRows = tasksQ.data ?? [];
  const nonArchivedRows = useMemo(
    () => allRows.filter((r) => r.archived_at == null),
    [allRows],
  );
  const archivedRows = useMemo(
    () => allRows.filter((r) => r.archived_at != null),
    [allRows],
  );

  const filtered = useMemo(() => {
    if (filter === "active") {
      // A picked date shows everything due that day, including anything
      // missed on a past day, so the missed check is left to the filter.
      if (timeframe === "date") {
        return nonArchivedRows.filter((r) =>
          matchesTimeframe(r, "date", today, pickedDate),
        );
      }
      const active = nonArchivedRows.filter(
        (r) => r.completed_at == null && !isMissed(r, today),
      );
      return active.filter((r) =>
        matchesTimeframe(r, timeframe, today, undefined, weekStartsOn),
      );
    }
    if (filter === "missed") {
      const missed = nonArchivedRows.filter((r) => isMissed(r, today));
      if (missedSub === "recurring") {
        return missed.filter((r) => r.recurring_template_id != null);
      }
      if (missedSub === "non_recurring") {
        return missed.filter((r) => r.recurring_template_id == null);
      }
      return missed;
    }
    if (filter === "completed") {
      return nonArchivedRows.filter((r) => r.completed_at != null);
    }
    if (filter === "archived") {
      const q = archiveSearch.trim().toLowerCase();
      // Inclusive date range on archived_at (YYYY-MM-DD compared against
      // the ISO date portion of the timestamp).
      return archivedRows.filter((r) => {
        if (!r.archived_at) return false;
        const archivedDate = r.archived_at.slice(0, 10);
        if (archiveFrom && archivedDate < archiveFrom) return false;
        if (archiveTo && archivedDate > archiveTo) return false;
        if (
          archiveType === "recurring" &&
          r.recurring_template_id == null
        ) {
          return false;
        }
        if (
          archiveType === "non_recurring" &&
          r.recurring_template_id != null
        ) {
          return false;
        }
        if (q) {
          const hay = `${r.title} ${r.notes ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    }
    return nonArchivedRows;
  }, [
    nonArchivedRows,
    archivedRows,
    filter,
    missedSub,
    timeframe,
    pickedDate,
    today,
    weekStartsOn,
    archiveType,
    archiveFrom,
    archiveTo,
    archiveSearch,
  ]);

  // Repeats that fall in the chosen timeframe but aren't tasks yet. Same
  // rule as the Calendar, so both pages show the same load.
  const upcomingWindow =
    filter === "active"
      ? timeframeWindow(timeframe, today, pickedDate, weekStartsOn)
      : null;
  const upcoming = useMemo(
    () =>
      upcomingWindow
        ? upcomingInWindow(templatesQ.data ?? [], allRows, today, upcomingWindow)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templatesQ.data, allRows, today, upcomingWindow?.start, upcomingWindow?.end],
  );
  const singleDay =
    upcomingWindow != null && upcomingWindow.start === upcomingWindow.end;

  const activeCount = nonArchivedRows.filter(
    (r) => r.completed_at == null && !isMissed(r, today),
  ).length;
  const missedCount = nonArchivedRows.filter((r) => isMissed(r, today)).length;
  const completedCount = nonArchivedRows.filter(
    (r) => r.completed_at != null,
  ).length;
  const archivedCount = archivedRows.length;

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
            label={`Missed (${missedCount})`}
            active={filter === "missed"}
            onClick={() => setFilter("missed")}
            testid="filter-missed"
          />
          <FilterButton
            label={`Done (${completedCount})`}
            active={filter === "completed"}
            onClick={() => setFilter("completed")}
            testid="filter-completed"
          />
          <FilterButton
            label={`Archived (${archivedCount})`}
            active={filter === "archived"}
            onClick={() => setFilter("archived")}
            testid="filter-archived"
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

      {/* Archived filter controls: type toggle, date range, text search.
          Only shown when Archived is the current filter. Keeps the panel
          out of Active/Missed/Done/All. */}
      {filter === "archived" && archivedCount > 0 && (
        <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Show</span>
            <div className="flex items-center gap-1 rounded-md border border-border p-1">
              <MissedSubButton
                label="All"
                active={archiveType === "all"}
                onClick={() => setArchiveType("all")}
                testid="archive-type-all"
              />
              <MissedSubButton
                label="Recurring only"
                active={archiveType === "recurring"}
                onClick={() => setArchiveType("recurring")}
                testid="archive-type-recurring"
              />
              <MissedSubButton
                label="Non-recurring only"
                active={archiveType === "non_recurring"}
                onClick={() => setArchiveType("non_recurring")}
                testid="archive-type-non-recurring"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label
                htmlFor="archive-from"
                className="text-xs text-muted-foreground"
              >
                From
              </label>
              <Input
                id="archive-from"
                type="date"
                value={archiveFrom}
                onChange={(e) => setArchiveFrom(e.target.value)}
                className="h-8 w-40"
                data-testid="input-archive-from"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="archive-to"
                className="text-xs text-muted-foreground"
              >
                To
              </label>
              <Input
                id="archive-to"
                type="date"
                value={archiveTo}
                onChange={(e) => setArchiveTo(e.target.value)}
                className="h-8 w-40"
                data-testid="input-archive-to"
              />
            </div>
            <div className="flex-1 min-w-[180px] space-y-1">
              <label
                htmlFor="archive-search"
                className="text-xs text-muted-foreground"
              >
                Search title or notes
              </label>
              <Input
                id="archive-search"
                type="search"
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                placeholder="Type a word or two"
                className="h-8"
                data-testid="input-archive-search"
              />
            </div>
          </div>
        </div>
      )}

      {/* Timeframe select, only shown when Active is the current filter.
          Session 4 will replace this with the calendar/planner view. */}
      {filter === "active" && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Show due</span>
          <Select
            value={timeframe}
            onValueChange={(v) => setTimeframe(v as TimeframeFilter)}
          >
            <SelectTrigger
              className="h-8 w-40"
              data-testid="select-timeframe"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TIMEFRAME_LABEL) as TimeframeFilter[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TIMEFRAME_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {timeframe === "date" && (
            <Input
              type="date"
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value || localIsoDate())}
              className="h-8 w-40"
              aria-label="Show tasks due on this day"
              data-testid="input-timeframe-date"
            />
          )}
        </div>
      )}

      {/* Missed sub-filter: recurring / non-recurring / all. Shown only
          when the Missed tab is active. Notice, don't grade. */}
      {filter === "missed" && missedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Show</span>
          <div className="flex items-center gap-1 rounded-md border border-border p-1">
            <MissedSubButton
              label="All"
              active={missedSub === "all"}
              onClick={() => setMissedSub("all")}
              testid="missed-sub-all"
            />
            <MissedSubButton
              label="Recurring only"
              active={missedSub === "recurring"}
              onClick={() => setMissedSub("recurring")}
              testid="missed-sub-recurring"
            />
            <MissedSubButton
              label="Non-recurring only"
              active={missedSub === "non_recurring"}
              onClick={() => setMissedSub("non_recurring")}
              testid="missed-sub-non-recurring"
            />
          </div>
          <p className="italic text-muted-foreground">
            Check any off if you did them but forgot to note it.
          </p>
        </div>
      )}

      {tasksQ.isLoading ? (
        <p className="font-serif text-sm italic text-muted-foreground">
          Loading&hellip;
        </p>
      ) : filtered.length === 0 && upcoming.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              template={
                t.recurring_template_id != null
                  ? templatesById.get(t.recurring_template_id) ?? null
                  : null
              }
              showMissedActions={filter === "missed"}
              showLetGoAction={false}
            />
          ))}
          {upcoming.length > 0 && (
            <UpcomingRepeats
              items={upcoming}
              singleDay={singleDay}
              weekOf={upcomingWindow!.start}
            />
          )}
        </div>
      )}
    </div>
  );
}

function spoonText(n: number): string {
  return `${Number.isInteger(n) ? n : Number(n.toFixed(2))} spoon${n === 1 ? "" : "s"}`;
}

// One line per repeat. A single day shows its spoons; a week or month
// shows the schedule and how many times, so a daily repeat appears once.
function upcomingLine(u: UpcomingRepeat, singleDay: boolean): string {
  const t = u.template;
  const spoons = spoonsOf(t);
  if (singleDay) return [t.title, spoons ? spoonText(spoons) : null].filter(Boolean).join(", ");
  const pattern = describePattern(t);
  return [
    t.title,
    pattern.charAt(0).toLowerCase() + pattern.slice(1),
    u.count === 1 ? "once" : `${u.count} times`,
    spoons ? `${spoonText(spoons)}${u.count > 1 ? " each" : ""}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

function UpcomingRepeats({
  items,
  singleDay,
  weekOf,
}: {
  items: UpcomingRepeat[];
  singleDay: boolean;
  /** A day in the timeframe, so the Calendar link opens on that week. */
  weekOf: string;
}) {
  return (
    <div
      className="rounded-md border border-dashed border-border px-4 py-3"
      data-testid="tasks-upcoming-repeats"
    >
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
        Repeats coming up
      </p>
      <ul className="space-y-1.5">
        {items.map((u) => (
          <li
            key={u.template.id}
            className="text-sm text-foreground/80"
            data-testid={`upcoming-repeat-${u.template.id}`}
          >
            <Repeat
              className="mr-1.5 inline h-3.5 w-3.5 align-[-2px] text-muted-foreground"
              aria-label="Repeats"
            />
            {upcomingLine(u, singleDay)}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs italic text-muted-foreground">
        These become tasks on their day. See them by day on the{" "}
        <Link href={`/calendar?week=${weekOf}`} className="underline underline-offset-2 hover:text-foreground">
          Calendar
        </Link>
        .
      </p>
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

function MissedSubButton({
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
      className={`rounded px-2 py-1 text-xs transition ${
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
      : filter === "missed"
      ? "Nothing missed. If something slipped past a due date, it will land here quietly."
      : filter === "completed"
      ? "No completed tasks yet. Something will land here soon."
      : filter === "archived"
      ? "Nothing archived in this range. Widen the dates or clear the search."
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

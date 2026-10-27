// Recurring management page.
//
// Lists all recurring_task_templates for the current user, grouped so
// paused templates are together at the bottom by default. Row actions:
//   - Toggle Active (Switch) pauses/resumes generation
//   - Edit opens a Dialog with the RecurringPatternForm plus the
//     task-shape fields (title, notes, spoons, hours, complexity,
//     billable) so all template edits happen in one place
//   - Delete removes the template. Already-generated instances stay
//     in tasks (recurring_template_id -> null via FK)
//
// Deletion and pausing are confirmed with a Dialog rather than a browser
// confirm() so the copy stays voice-consistent (no urgent language).

import { SpoonCostFields, spoonCostError, type SpoonCostValue } from "@/components/spoon-cost-fields";
import { DEFAULT_EFFORT } from "@/lib/spoon-cost";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Repeat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listRecurringTemplates,
  updateRecurringTemplate,
  propagateTemplateEditsToIncompleteTasks,
  deleteRecurringTemplate,
  setRecurringActive,
  describePattern,
  type RecurringTemplateRow,
} from "@/lib/recurring-data";
import { listTasks, type TaskRow } from "@/lib/tasks-data";
import {
  RecurringPatternForm,
  validateRecurringPattern,
  type RecurringPatternValue,
} from "@/components/recurring-pattern-form";
import { resolveRecurringInstances } from "@/lib/recurring-resolver";
import { addLocalDays, localIsoDate } from "@/lib/local-date";

// ---------- Sort options ----------

type SortMode = "grouped" | "alpha" | "newest";

const SORT_LABEL: Record<SortMode, string> = {
  grouped: "Active first, then paused",
  alpha: "Alphabetical",
  newest: "Newest first",
};

function sortTemplates(
  rows: RecurringTemplateRow[],
  mode: SortMode,
): RecurringTemplateRow[] {
  const copy = [...rows];
  switch (mode) {
    case "grouped":
      // Active first, then paused. Within each group, most recently
      // created first so newly-added templates surface immediately.
      return copy.sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return b.created_at.localeCompare(a.created_at);
      });
    case "alpha":
      return copy.sort((a, b) =>
        a.title.toLocaleLowerCase().localeCompare(b.title.toLocaleLowerCase()),
      );
    case "newest":
      return copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

// ---------- Page ----------

export default function Recurring() {
  const templatesQ = useQuery<RecurringTemplateRow[]>({
    queryKey: ["recurring-templates"],
    queryFn: listRecurringTemplates,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repeats"
        subtitle="Templates that quietly generate their own tasks on a schedule. Pause any of them if life needs slower."
      />

      {templatesQ.isLoading ? (
        <p className="text-sm italic text-muted-foreground">One moment…</p>
      ) : (templatesQ.data ?? []).length === 0 ? (
        <EmptyState />
      ) : (
        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="templates" data-testid="tab-templates">
              Templates
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="templates" className="space-y-3">
            <TemplatesTab templates={templatesQ.data ?? []} />
          </TabsContent>
          <TabsContent value="history" className="space-y-3">
            <HistoryTab templates={templatesQ.data ?? []} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ---------- Templates tab (previous default view) ----------

function TemplatesTab({
  templates,
}: {
  templates: RecurringTemplateRow[];
}) {
  const [sortMode, setSortMode] = useState<SortMode>("grouped");
  const rows = templates;
  const sorted = sortTemplates(rows, sortMode);
  const activeCount = rows.filter((t) => t.active).length;
  const pausedCount = rows.length - activeCount;
  const showDivider =
    sortMode === "grouped" && activeCount > 0 && pausedCount > 0;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {activeCount} active
          {pausedCount > 0 ? `, ${pausedCount} paused` : ""}
        </p>
        <div className="flex items-center gap-2">
          <Label
            htmlFor="sort-mode"
            className="text-xs text-muted-foreground"
          >
            Sort by
          </Label>
          <Select
            value={sortMode}
            onValueChange={(v) => setSortMode(v as SortMode)}
          >
            <SelectTrigger
              id="sort-mode"
              className="w-56"
              data-testid="select-recurring-sort"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {SORT_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((t, idx) => {
          const isFirstPaused =
            showDivider &&
            !t.active &&
            (idx === 0 || sorted[idx - 1].active);
          return (
            <div key={t.id}>
              {isFirstPaused && (
                <div className="mb-3 mt-2 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs italic text-muted-foreground">
                    Paused
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              <TemplateCard template={t} />
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------- History tab: report of generated instances ----------

type HistoryStatus = "all" | "done" | "missed";

const STATUS_LABEL: Record<HistoryStatus, string> = {
  all: "All",
  done: "Done",
  missed: "Missed",
};

function HistoryTab({
  templates,
}: {
  templates: RecurringTemplateRow[];
}) {
  const tasksQ = useQuery<TaskRow[]>({
    queryKey: ["tasks"],
    queryFn: listTasks,
  });

  const [status, setStatus] = useState<HistoryStatus>("all");
  const [templateId, setTemplateId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(() => {
    return localIsoDate(addLocalDays(new Date(), -30));
  });
  const [dateTo, setDateTo] = useState<string>(() => localIsoDate());

  const templatesById = useMemo(() => {
    const m = new Map<number, RecurringTemplateRow>();
    for (const t of templates) m.set(t.id, t);
    return m;
  }, [templates]);

  const today = localIsoDate();

  // Only tasks that came from a template. Filter by status, template,
  // and date range on due_date.
  const rows = useMemo(() => {
    const all = (tasksQ.data ?? []).filter(
      (t) => t.recurring_template_id != null,
    );
    return all
      .filter((t) => {
        // Status filter
        if (status === "done" && t.completed_at == null) return false;
        if (
          status === "missed" &&
          (t.completed_at != null ||
            !t.due_date ||
            t.due_date >= today)
        ) {
          return false;
        }
        // Template filter
        if (templateId !== "all") {
          if (String(t.recurring_template_id) !== templateId) return false;
        }
        // Date range on due_date (fallback to created if no due_date)
        const stamp = t.due_date ?? "";
        if (dateFrom && stamp && stamp < dateFrom) return false;
        if (dateTo && stamp && stamp > dateTo) return false;
        return true;
      })
      .sort((a, b) =>
        (b.due_date ?? "").localeCompare(a.due_date ?? ""),
      );
  }, [tasksQ.data, status, templateId, dateFrom, dateTo, today]);

  // Small stats bar counts across the current filtered set
  const stats = useMemo(() => {
    let done = 0;
    let missed = 0;
    for (const t of rows) {
      if (t.completed_at != null) done++;
      else if (t.due_date && t.due_date < today) missed++;
    }
    return { done, missed, total: rows.length };
  }, [rows, today]);

  return (
    <>
      <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Show</span>
          <div className="flex items-center gap-1 rounded-md border border-border p-1">
            {(Object.keys(STATUS_LABEL) as HistoryStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded px-2 py-1 text-xs transition ${
                  status === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                data-testid={`history-status-${s}`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label
              htmlFor="history-template"
              className="text-xs text-muted-foreground"
            >
              Template
            </label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger
                id="history-template"
                className="h-8 w-56"
                data-testid="select-history-template"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="history-from"
              className="text-xs text-muted-foreground"
            >
              From
            </label>
            <Input
              id="history-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-40"
              data-testid="input-history-from"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="history-to"
              className="text-xs text-muted-foreground"
            >
              To
            </label>
            <Input
              id="history-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-40"
              data-testid="input-history-to"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span data-testid="history-count-total">
          {stats.total} instance{stats.total === 1 ? "" : "s"}
        </span>
        <span data-testid="history-count-done">
          {stats.done} done
        </span>
        <span data-testid="history-count-missed">
          {stats.missed} missed
        </span>
      </div>

      {tasksQ.isLoading ? (
        <p className="text-sm italic text-muted-foreground">One moment…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 py-8 text-center">
            <p className="font-serif text-base">Nothing in this range.</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Widen the dates or switch the status. If a template only started
              recently, its history is still growing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <HistoryRow
              key={t.id}
              task={t}
              template={
                t.recurring_template_id != null
                  ? templatesById.get(t.recurring_template_id) ?? null
                  : null
              }
              today={today}
            />
          ))}
        </div>
      )}
    </>
  );
}

function HistoryRow({
  task,
  template,
  today,
}: {
  task: TaskRow;
  template: RecurringTemplateRow | null;
  today: string;
}) {
  const done = task.completed_at != null;
  const isMissed =
    !done && task.due_date != null && task.due_date < today;
  return (
    <Card data-testid={`history-row-${task.id}`}>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p
            className={`font-serif text-sm ${
              done ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {task.title}
          </p>
          {template && (
            <p className="text-xs italic text-muted-foreground">
              From {template.title}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Due {task.due_date ?? "unscheduled"}
          </span>
          {done ? (
            <Badge variant="outline" className="text-xs">
              Done
            </Badge>
          ) : isMissed ? (
            <Badge variant="outline" className="text-xs">
              Missed
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Upcoming
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Empty state ----------

function EmptyState() {
  return (
    <Card>
      <CardContent className="space-y-2 py-10 text-center">
        <Repeat className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="font-serif text-base">Nothing repeats yet.</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          When you set up a recurring task from the Tasks page, it shows up
          here. Pause or edit any of them without losing history.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------- Row card ----------

function TemplateCard({ template }: { template: RecurringTemplateRow }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleActive = useMutation({
    mutationFn: async () => setRecurringActive(template.id, !template.active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-templates"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e) => {
      toast({
        title: "Couldn't update",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const del = useMutation({
    mutationFn: async () => deleteRecurringTemplate(template.id),
    onSuccess: () => {
      setDeleting(false);
      qc.invalidateQueries({ queryKey: ["recurring-templates"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Template removed.",
        description:
          "Already-generated tasks stay in your history. Only future generations are stopped.",
      });
    },
    onError: (e) => {
      toast({
        title: "Couldn't delete",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  return (
    <>
      <Card data-testid={`card-template-${template.id}`}>
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p
                className={`font-serif text-base ${
                  template.active
                    ? "text-foreground"
                    : "italic text-muted-foreground"
                }`}
              >
                {template.title}
              </p>
              {!template.active && (
                <Badge variant="outline" className="text-xs">
                  Paused
                </Badge>
              )}
            </div>
            {template.notes && (
              <p className="whitespace-pre-wrap font-serif text-sm italic text-muted-foreground">
                {template.notes}
              </p>
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              {describePattern(template)}
              {template.end_date && ` · ends ${template.end_date}`}
              {template.end_after_n !== null &&
                ` · stops after ${template.end_after_n} occurrence${template.end_after_n === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Switch
              checked={template.active}
              onCheckedChange={() => toggleActive.mutate()}
              aria-label={
                template.active ? "Pause template" : "Resume template"
              }
              data-testid={`switch-template-active-${template.id}`}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEditing(true)}
              aria-label="Edit template"
              data-testid={`button-template-edit-${template.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setDeleting(true)}
              aria-label="Delete template"
              data-testid={`button-template-delete-${template.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditTemplateDialog
        open={editing}
        template={template}
        onClose={() => setEditing(false)}
      />

      <ConfirmDeleteDialog
        open={deleting}
        template={template}
        onCancel={() => setDeleting(false)}
        onConfirm={() => del.mutate()}
        pending={del.isPending}
      />
    </>
  );
}

// ---------- Edit dialog ----------

interface EditFormValue {
  title: string;
  notes: string;
  // Time, effort, the two yes/no questions, and an optional own number.
  cost: SpoonCostValue;
  billable: boolean;
  pattern: RecurringPatternValue;
}

function templateToEditForm(t: RecurringTemplateRow): EditFormValue {
  return {
    title: t.title,
    notes: t.notes ?? "",
    cost: {
      spoonEstimate: t.spoon_estimate != null ? String(t.spoon_estimate) : "",
      estimatedHours: String(t.estimated_hours),
      complexity: t.complexity,
      socialLoad: t.social_load ?? false,
      dread: t.dread ?? false,
    },
    billable: t.billable,
    pattern: {
      pattern_type: t.pattern_type,
      interval_n: t.interval_n,
      days_of_week: t.days_of_week,
      monthly_kind: t.monthly_kind,
      day_of_month: t.day_of_month,
      nth_weekday: t.nth_weekday,
      nth_weekday_day: t.nth_weekday_day,
      start_date: t.start_date,
      end_date: t.end_date,
      end_after_n: t.end_after_n,
      on_miss: t.on_miss,
    },
  };
}

function EditTemplateDialog({
  open,
  template,
  onClose,
}: {
  open: boolean;
  template: RecurringTemplateRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [value, setValue] = useState<EditFormValue>(() =>
    templateToEditForm(template),
  );

  // Refresh form values when a different template is opened, or when
  // the same template is reopened after being edited elsewhere.
  useEffect(() => {
    if (open) setValue(templateToEditForm(template));
  }, [open, template]);

  const save = useMutation({
    mutationFn: async () => {
      const invalid = validateRecurringPattern(value.pattern);
      if (invalid) throw new Error(invalid);
      const title = value.title.trim();
      if (!title) throw new Error("Title is required.");

      const costError = spoonCostError(value.cost);
      if (costError) throw new Error(costError);
      // Empty spoons means "work it out from time and effort".
      const spoonEstimate = value.cost.spoonEstimate.trim()
        ? Number(value.cost.spoonEstimate)
        : null;
      const estimatedHours = Number.parseFloat(value.cost.estimatedHours || "0.5");
      const complexity = value.cost.complexity || DEFAULT_EFFORT;
      const notes = value.notes.trim() || null;

      await updateRecurringTemplate(template.id, {
        title,
        notes,
        spoon_estimate: spoonEstimate,
        estimated_hours: estimatedHours,
        complexity,
        social_load: value.cost.socialLoad,
        dread: value.cost.dread,
        billable: value.billable,
        pattern_type: value.pattern.pattern_type,
        interval_n: value.pattern.interval_n,
        days_of_week: value.pattern.days_of_week,
        monthly_kind: value.pattern.monthly_kind,
        day_of_month: value.pattern.day_of_month,
        nth_weekday: value.pattern.nth_weekday,
        nth_weekday_day: value.pattern.nth_weekday_day,
        start_date: value.pattern.start_date,
        end_date: value.pattern.end_date,
        end_after_n: value.pattern.end_after_n,
        on_miss: value.pattern.on_miss,
      });

      // Session 3.3.1: propagate task-shape edits to incomplete
      // instances so today's row picks up the new title, spoons, etc.
      // Completed history rows are left untouched.
      const touchedCount = await propagateTemplateEditsToIncompleteTasks(
        template.id,
        {
          title,
          notes,
          spoon_estimate: spoonEstimate,
          estimated_hours: estimatedHours,
          complexity,
          social_load: value.cost.socialLoad,
          dread: value.cost.dread,
          billable: value.billable,
        },
      );

      // Also run the resolver so any newly-eligible dates get
      // generated (e.g. the user extended end_date or changed the
      // pattern to include today).
      await resolveRecurringInstances();

      return touchedCount;
    },
    onSuccess: (touchedCount) => {
      onClose();
      qc.invalidateQueries({ queryKey: ["recurring-templates"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
      toast({
        title: "Saved.",
        description:
          touchedCount > 0
            ? `Also updated ${touchedCount} open task${touchedCount === 1 ? "" : "s"} to match. Completed history stays unchanged.`
            : "Changes apply to future generations.",
      });
    },
    onError: (e) => {
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Edit template</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="edit-title">What is it?</Label>
            <Input
              id="edit-title"
              value={value.title}
              onChange={(e) => setValue({ ...value, title: e.target.value })}
              data-testid="input-edit-title"
            />
          </div>
          <div>
            <Label htmlFor="edit-notes">
              Notes <span className="italic">optional</span>
            </Label>
            <Textarea
              id="edit-notes"
              value={value.notes}
              onChange={(e) => setValue({ ...value, notes: e.target.value })}
              data-testid="input-edit-notes"
            />
          </div>
          <SpoonCostFields
            value={value.cost}
            onChange={(cost) => setValue({ ...value, cost })}
            idPrefix="edit"
            allowNoEffort={false}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.billable}
              onChange={(e) =>
                setValue({ ...value, billable: e.target.checked })
              }
              className="h-4 w-4"
              data-testid="checkbox-edit-billable"
            />
            Billable
          </label>

          <div className="pt-2">
            <Label className="mb-2 block">Repeats</Label>
            <RecurringPatternForm
              value={value.pattern}
              onChange={(p) => setValue({ ...value, pattern: p })}
            />
          </div>

          <p className="text-xs italic text-muted-foreground">
            Changes apply to future generations. Tasks already generated stay
            in your history as they are.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !value.title.trim()}
            data-testid="button-edit-template-save"
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Confirm delete ----------

function ConfirmDeleteDialog({
  open,
  template,
  onCancel,
  onConfirm,
  pending,
}: {
  open: boolean;
  template: RecurringTemplateRow;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">
            Remove “{template.title}”?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p>
            No more instances will be generated. Tasks already created from
            this template stay in your history.
          </p>
          <p className="italic text-muted-foreground">
            If you just want to stop it for now, pause it instead using the
            switch on the row.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending}
            data-testid="button-confirm-delete-template"
          >
            {pending ? "Removing…" : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

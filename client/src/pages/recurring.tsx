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

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  deleteRecurringTemplate,
  setRecurringActive,
  describePattern,
  type RecurringTemplateRow,
} from "@/lib/recurring-data";
import {
  RecurringPatternForm,
  validateRecurringPattern,
  type RecurringPatternValue,
} from "@/components/recurring-pattern-form";
import { resolveRecurringInstances } from "@/lib/recurring-resolver";

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
  const [sortMode, setSortMode] = useState<SortMode>("grouped");
  const templatesQ = useQuery<RecurringTemplateRow[]>({
    queryKey: ["recurring-templates"],
    queryFn: listRecurringTemplates,
  });

  const rows = templatesQ.data ?? [];
  const sorted = sortTemplates(rows, sortMode);
  const activeCount = rows.filter((t) => t.active).length;
  const pausedCount = rows.length - activeCount;
  // Divider between the two groups appears only for the grouped mode
  // and only when both groups are non-empty.
  const showDivider =
    sortMode === "grouped" && activeCount > 0 && pausedCount > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repeats"
        subtitle="Templates that quietly generate their own tasks on a schedule. Pause any of them if life needs slower."
      />

      {templatesQ.isLoading ? (
        <p className="text-sm italic text-muted-foreground">One moment…</p>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
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
      )}
    </div>
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
  spoon_estimate: string; // string so the input can be temporarily empty
  estimated_hours: string;
  complexity: "low" | "medium" | "high";
  billable: boolean;
  pattern: RecurringPatternValue;
}

function templateToEditForm(t: RecurringTemplateRow): EditFormValue {
  return {
    title: t.title,
    notes: t.notes ?? "",
    spoon_estimate: String(t.spoon_estimate),
    estimated_hours: String(t.estimated_hours),
    complexity: t.complexity,
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

      await updateRecurringTemplate(template.id, {
        title,
        notes: value.notes.trim() || null,
        spoon_estimate: Number.parseInt(value.spoon_estimate || "3", 10),
        estimated_hours: Number.parseFloat(value.estimated_hours || "0.5"),
        complexity: value.complexity,
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

      // Edits to the pattern only affect FUTURE generations. Existing
      // instances in tasks stay as they are. We still run the resolver
      // so any newly-eligible dates get generated.
      await resolveRecurringInstances();
    },
    onSuccess: () => {
      onClose();
      qc.invalidateQueries({ queryKey: ["recurring-templates"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast({
        title: "Saved.",
        description:
          "Changes apply to future generations. Existing tasks are unchanged.",
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-spoons">
                Spoons <span className="italic">0 to 10</span>
              </Label>
              <Input
                id="edit-spoons"
                type="number"
                min={0}
                max={10}
                value={value.spoon_estimate}
                onChange={(e) =>
                  setValue({ ...value, spoon_estimate: e.target.value })
                }
                data-testid="input-edit-spoons"
              />
            </div>
            <div>
              <Label htmlFor="edit-hours">
                Hours <span className="italic">15-min steps</span>
              </Label>
              <Input
                id="edit-hours"
                type="number"
                min={0}
                step={0.25}
                value={value.estimated_hours}
                onChange={(e) =>
                  setValue({ ...value, estimated_hours: e.target.value })
                }
                data-testid="input-edit-hours"
              />
            </div>
          </div>
          <div>
            <Label>Complexity</Label>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(["low", "medium", "high"] as const).map((c) => (
                <Button
                  key={c}
                  type="button"
                  variant={value.complexity === c ? "default" : "outline"}
                  onClick={() => setValue({ ...value, complexity: c })}
                  size="sm"
                  data-testid={`button-edit-complexity-${c}`}
                >
                  {c[0].toUpperCase() + c.slice(1)}
                </Button>
              ))}
            </div>
          </div>
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

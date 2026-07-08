import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  ChevronLeft,
  ChevronDown,
  Check,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  CHECKLIST_TEMPLATES,
  type TemplateItem,
} from "@/lib/quiet-hours-data";
import type { ChecklistRun } from "@shared/schema";

interface RunItem {
  id: string;
  label: string;
  required: boolean;
  done: boolean;
}

function parseItems(raw: string): RunItem[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function requiredProgress(items: RunItem[]) {
  const req = items.filter((i) => i.required);
  const done = req.filter((i) => i.done).length;
  return { done, total: req.length, allDone: req.length > 0 && done === req.length };
}

// ---------------- Custom checklist dialog ----------------
function CustomChecklistDialog({ onStart }: { onStart: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [items, setItems] = useState<{ label: string; required: boolean }[]>([
    { label: "", required: true },
  ]);
  const { toast } = useToast();

  const create = useMutation({
    mutationFn: async () => {
      const runItems: RunItem[] = items
        .filter((i) => i.label.trim())
        .map((i, idx) => ({
          id: `c${idx}`,
          label: i.label.trim(),
          required: i.required,
          done: false,
        }));
      await apiRequest("POST", "/api/checklists", {
        templateKey: "custom",
        templateLabel: label.trim() || "Custom checklist",
        items: JSON.stringify(runItems),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checklists"] });
      setOpen(false);
      setLabel("");
      setItems([{ label: "", required: true }]);
      onStart();
      toast({ title: "Checklist started." });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="h-full cursor-pointer border-dashed hover-elevate" data-testid="card-template-custom">
          <CardContent className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 p-5 text-center">
            <Plus className="h-5 w-5 text-muted-foreground" />
            <div className="font-serif text-base font-medium">Start blank</div>
            <p className="text-sm text-muted-foreground">
              Write your own "good enough" bar.
            </p>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">A checklist of your own</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="custom-label">What are you shipping?</Label>
            <Input
              id="custom-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Quarterly recap deck"
              data-testid="input-custom-label"
            />
          </div>
          <div className="space-y-2">
            <Label>Items</Label>
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={it.label}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...next[idx], label: e.target.value };
                    setItems(next);
                  }}
                  placeholder="What counts as done enough?"
                  data-testid={`input-custom-item-${idx}`}
                />
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={it.required}
                    onCheckedChange={(c) => {
                      const next = [...items];
                      next[idx] = { ...next[idx], required: !!c };
                      setItems(next);
                    }}
                  />
                  Must
                </label>
                {items.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setItems(items.filter((_, i) => i !== idx))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setItems([...items, { label: "", required: false }])
              }
              data-testid="button-add-custom-item"
            >
              <Plus className="mr-1 h-4 w-4" /> Add item
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => create.mutate()}
            disabled={!items.some((i) => i.label.trim()) || create.isPending}
            data-testid="button-start-custom"
          >
            Start checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Template picker ----------------
function TemplatePicker({ onStart }: { onStart: () => void }) {
  const { toast } = useToast();
  const start = useMutation({
    mutationFn: async (tpl: (typeof CHECKLIST_TEMPLATES)[number]) => {
      const items: RunItem[] = tpl.items.map((i: TemplateItem) => ({
        ...i,
        done: false,
      }));
      await apiRequest("POST", "/api/checklists", {
        templateKey: tpl.key,
        templateLabel: tpl.label,
        items: JSON.stringify(items),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checklists"] });
      onStart();
      toast({ title: "Checklist started." });
    },
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {CHECKLIST_TEMPLATES.map((tpl) => (
        <Card key={tpl.key} className="flex flex-col" data-testid={`card-template-${tpl.key}`}>
          <CardContent className="flex flex-1 flex-col gap-2 p-5">
            <div className="font-serif text-base font-medium text-foreground">
              {tpl.label}
            </div>
            <p className="flex-1 text-sm text-muted-foreground">
              {tpl.description}
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                {tpl.items.length} items
              </span>
              <Button
                size="sm"
                onClick={() => start.mutate(tpl)}
                disabled={start.isPending}
                data-testid={`button-start-${tpl.key}`}
              >
                Start
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <CustomChecklistDialog onStart={onStart} />
    </div>
  );
}

// ---------------- Run detail ----------------
function RunDetail({
  run,
  onBack,
}: {
  run: ChecklistRun;
  onBack: () => void;
}) {
  const items = parseItems(run.items);
  const { toast } = useToast();

  const patch = useMutation({
    mutationFn: async (nextItems: RunItem[]) => {
      await apiRequest("PATCH", `/api/checklists/${run.id}`, {
        items: JSON.stringify(nextItems),
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/checklists"] }),
  });

  const ship = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/checklists/${run.id}`, { shipped: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checklists"] });
      toast({ title: `${run.templateLabel} — shipped. The bar is set.` });
      onBack();
    },
  });

  const toggle = (id: string) => {
    const next = items.map((i) =>
      i.id === id ? { ...i, done: !i.done } : i,
    );
    patch.mutate(next);
  };

  const { allDone } = requiredProgress(items);
  const mustHaves = items.filter((i) => i.required);
  const niceToHaves = items.filter((i) => !i.required);

  const ItemRow = ({ item }: { item: RunItem }) => (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover-elevate"
      data-testid={`item-${item.id}`}
    >
      <Checkbox
        checked={item.done}
        onCheckedChange={() => toggle(item.id)}
        className="mt-0.5"
        data-testid={`checkbox-item-${item.id}`}
      />
      <span
        className={
          item.done
            ? "text-sm text-muted-foreground line-through"
            : "text-sm text-foreground"
        }
      >
        {item.label}
      </span>
    </label>
  );

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          data-testid="button-back-to-list"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> All checklists
        </Button>
      </div>
      <div className="space-y-1">
        <h2 className="font-serif text-xl font-semibold text-foreground">
          {run.templateLabel}
        </h2>
        <p className="font-serif text-sm italic text-muted-foreground">
          Check what's true. When the must-haves are done, it's done — even
          if the critic disagrees.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Must-have
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {mustHaves.map((i) => (
            <ItemRow key={i.id} item={i} />
          ))}
        </CardContent>
      </Card>

      {niceToHaves.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Nice-to-have
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {niceToHaves.map((i) => (
              <ItemRow key={i.id} item={i} />
            ))}
          </CardContent>
        </Card>
      )}

      {allDone && (
        <Card className="border-primary/40 bg-accent/40" data-testid="panel-ready">
          <CardContent className="space-y-4 p-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-5 w-5" />
              </div>
            </div>
            <p className="font-medium text-foreground">
              All must-haves are done. This is the version you said was enough.
            </p>
            <div className="mx-auto max-w-md space-y-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                If the inner critic is showing up now
              </p>
              <p className="font-serif text-sm italic text-muted-foreground">
                “It's not really done. One more pass and it'll be right.”
                &nbsp;— the urge to keep going is not the same as the work
                needing more. You set the bar. Cross it.
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => ship.mutate()}
              disabled={ship.isPending}
              data-testid="button-ship"
            >
              Ship it
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------- Run list ----------------
function RunList({ onOpen }: { onOpen: (run: ChecklistRun) => void }) {
  const { data, isLoading } = useQuery<ChecklistRun[]>({
    queryKey: ["/api/checklists"],
  });

  const del = useMutation({
    mutationFn: async (id: number) =>
      apiRequest("DELETE", `/api/checklists/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/checklists"] }),
  });

  if (isLoading)
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );

  const active = (data ?? []).filter((r) => !r.shipped);
  const shipped = (data ?? []).filter((r) => r.shipped);

  if (active.length === 0 && shipped.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-2 p-8 text-center">
          <p className="font-serif italic text-muted-foreground">
            No checklists in progress.
          </p>
          <p className="font-serif text-sm italic text-muted-foreground">
            Start one above when the inner critic shows up mid-task, or
            before you begin something you tend to over-polish.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {active.length === 0 ? (
        <p className="font-serif text-sm italic text-muted-foreground">
          Nothing in progress right now.
        </p>
      ) : (
        <div className="space-y-3">
          {active.map((run) => {
            const items = parseItems(run.items);
            const { done, total } = requiredProgress(items);
            const pct = total > 0 ? (done / total) * 100 : 0;
            return (
              <Card
                key={run.id}
                className="cursor-pointer hover-elevate"
                onClick={() => onOpen(run)}
                data-testid={`card-run-${run.id}`}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {run.templateLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {done}/{total} must-haves
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {shipped.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              data-testid="button-toggle-shipped"
            >
              <ChevronDown className="mr-1 h-4 w-4" />
              Recently shipped ({shipped.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {shipped.map((run) => (
              <Card key={run.id} className="opacity-70" data-testid={`card-shipped-${run.id}`}>
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    {run.templateLabel}
                    <Badge variant="secondary" className="text-[10px]">
                      shipped
                    </Badge>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      del.mutate(run.id);
                    }}
                    data-testid={`button-delete-run-${run.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export default function GoodEnough() {
  const [openRunId, setOpenRunId] = useState<number | null>(null);
  const { data } = useQuery<ChecklistRun[]>({ queryKey: ["/api/checklists"] });

  const openRun = data?.find((r) => r.id === openRunId) ?? null;

  if (openRun) {
    return (
      <div className="space-y-8">
        <RunDetail run={openRun} onBack={() => setOpenRunId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Good Enough"
        subtitle="For when the inner critic shows up mid-task. Decide what 'done' looks like before you start, then stop when you get there — even if the voice inside says one more pass."
      />
      <div className="space-y-4">
        <h2 className="font-serif text-lg font-semibold text-foreground">
          Start a checklist
        </h2>
        <TemplatePicker onStart={() => {}} />
      </div>
      <div className="space-y-4">
        <h2 className="font-serif text-lg font-semibold text-foreground">
          In progress
        </h2>
        <RunList onOpen={(r) => setOpenRunId(r.id)} />
      </div>
    </div>
  );
}

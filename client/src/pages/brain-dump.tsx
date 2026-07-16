// Brain Dump: freeform capture with optional voice input and AI parsing.
//
// Flow:
// 1. Type or speak into the textarea; Cmd/Ctrl+Enter or 'Hold it' saves.
// 2. Past dumps show below. Each dump either has 'Parse with AI' (never
//    parsed), 'Continue reviewing (N left)' (partial), or 'View tasks'
//    (all processed).
// 3. Parse triggers the Claude edge function; on success, opens the
//    Review flow modal.
// 4. Review flow shows one card at a time with a Timeline dropdown,
//    Add / Edit / Skip / Break down buttons. Skipped items stay in the
//    brain dump and can be reviewed later. Card view is designed to
//    NEVER show more than one task at a time.

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Trash2,
  Sparkles,
  Mic,
  MicOff,
  Wand2,
  X,
  Split,
} from "lucide-react";
import {
  listBrainDumps,
  createBrainDump,
  deleteBrainDump,
  parseBrainDump,
  breakDownTask,
  createTask,
  updateTask,
  deleteTask,
  markBrainDumpProcessed,
  markBrainDumpSkipped,
  remainingItemCount,
  type BrainDumpRow,
  type ParsedTaskItem,
  DUE_BUCKET_LABEL,
  type DueBucket,
} from "@/lib/tasks-data";
import { useToast } from "@/hooks/use-toast";
import {
  TaskFieldsForm,
  fieldsToTaskInput,
  type TaskFieldsValue,
} from "@/components/task-fields-form";

// ---------- Relative time formatter ----------

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.round(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// ---------- Web Speech API helper ----------

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (e: unknown) => void;
  onend: () => void;
  onerror: (e: unknown) => void;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionInstance)
  | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

// ---------- Review flow: one card at a time ----------

interface ReviewFlowProps {
  dump: BrainDumpRow;
  open: boolean;
  onClose: () => void;
}

// Rebuild the review flow as a linear queue of ParsedTaskItem's. Each item
// remembers whether it came from the original parse (`originalIdx: number`)
// or was spliced in from a break-down (`originalIdx: null`). This is simpler
// than the prior two-array design and avoids the index-math bugs.
interface FlowItem {
  item: ParsedTaskItem;
  originalIdx: number | null; // null = came from break-down, not persisted on brain_dump
  // For break-down sub-tasks: the DB task id created when the sub-task was
  // persisted immediately. Used so Skip on a sub-task can delete the row
  // rather than orphaning it in Tasks.
  taskId?: number;
}

function ReviewFlow({ dump, open, onClose }: ReviewFlowProps) {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Linear queue of items to review. Rebuilt when the dump changes.
  const [flow, setFlow] = useState<FlowItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  // Timeline picker state (applies to the current card only).
  const [timeline, setTimeline] = useState<TaskFieldsValue["timeline"]>("today");
  const [specificDate, setSpecificDate] = useState<string>("");

  // Edit mode toggle + form state. When editing, the user modifies the
  // current item's fields; when they Save, we update flow[currentIdx]
  // in place. Nothing is persisted to the DB until they click Add task.
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<TaskFieldsValue | null>(null);

  // Rebuild the flow whenever the dump changes and we open
  useEffect(() => {
    if (!open) return;
    const items = dump.parsed_items ?? [];
    const done = new Set([
      ...(dump.processed_indices ?? []),
      ...(dump.skipped_indices ?? []),
    ]);
    const remaining: FlowItem[] = items
      .map((it, i): FlowItem | null => (done.has(i) ? null : { item: it, originalIdx: i }))
      .filter((x): x is FlowItem => x !== null);
    setFlow(remaining);
    setCurrentIdx(0);
    setTimeline("today");
    setSpecificDate("");
    setEditing(false);
    setEditValue(null);
  }, [open, dump.id, dump.parsed_at]);

  const currentFlowItem: FlowItem | null = flow[currentIdx] ?? null;
  const currentItem: ParsedTaskItem | null = currentFlowItem?.item ?? null;
  const positionLabel =
    flow.length > 0
      ? `${Math.min(currentIdx + 1, flow.length)} of ${flow.length}`
      : "Done";

  const advance = () => {
    setEditing(false);
    setEditValue(null);
    if (currentIdx + 1 >= flow.length) {
      qc.invalidateQueries({ queryKey: ["brain_dumps"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
      onClose();
      toast({ title: "Review done.", description: "Any skipped items are still on the dump for later." });
    } else {
      setCurrentIdx((n) => n + 1);
      setTimeline("today");
      setSpecificDate("");
    }
  };

  const commitCurrent = useMutation({
    mutationFn: async () => {
      if (!currentFlowItem) return;
      const it = currentFlowItem.item;
      let dueBucket: DueBucket | null = null;
      let dueDate: string | null = null;
      if (timeline === "specific_date") {
        if (!specificDate) throw new Error("Pick a date.");
        dueDate = specificDate;
      } else {
        dueBucket = timeline;
      }

      if (currentFlowItem.taskId != null) {
        // Sub-task from a break-down; already persisted to DB. Just update
        // its due_bucket / due_date (and any other edits already applied to
        // currentFlowItem.item) to reflect the user's Timeline choice.
        await updateTask(currentFlowItem.taskId, {
          title: it.title,
          notes: it.notes ?? null,
          spoonEstimate: it.spoon_estimate ?? null,
          estimatedHours: it.estimated_hours ?? null,
          complexity: it.complexity ?? null,
          billable: it.billable ?? false,
          dueBucket,
          dueDate,
        });
      } else {
        // Original parsed item: create fresh.
        await createTask({
          title: it.title,
          notes: it.notes ?? null,
          spoonEstimate: it.spoon_estimate ?? null,
          estimatedHours: it.estimated_hours ?? null,
          complexity: it.complexity ?? null,
          billable: it.billable ?? false,
          dueBucket,
          dueDate,
        });
        if (currentFlowItem.originalIdx !== null) {
          await markBrainDumpProcessed(dump.id, currentFlowItem.originalIdx);
        }
      }
    },
    onSuccess: () => advance(),
    onError: (e) => {
      toast({
        title: "Couldn't add",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const skipCurrent = useMutation({
    mutationFn: async () => {
      if (!currentFlowItem) return;
      if (currentFlowItem.taskId != null) {
        // Sub-task was auto-persisted during break-down. Skip means delete.
        await deleteTask(currentFlowItem.taskId);
      } else if (currentFlowItem.originalIdx !== null) {
        await markBrainDumpSkipped(dump.id, currentFlowItem.originalIdx);
      }
    },
    onSuccess: () => advance(),
  });

  const breakDown = useMutation({
    mutationFn: async () => {
      if (!currentFlowItem) return { subs: [] as ParsedTaskItem[] };
      const subs = await breakDownTask({
        title: currentFlowItem.item.title,
        notes: currentFlowItem.item.notes ?? null,
      });
      if (subs.length === 0) return { subs };

      // Persist each sub-task immediately to Today bucket so they don't
      // vanish if the user closes the review modal mid-flow. The review
      // flow then lets the user adjust Timeline / Edit / Skip per item,
      // and Skip becomes 'delete this sub-task' since it's already persisted.
      const createdIds: number[] = [];
      for (const s of subs) {
        const created = await createTask({
          title: s.title,
          notes: s.notes ?? null,
          spoonEstimate: s.spoon_estimate ?? null,
          estimatedHours: s.estimated_hours ?? null,
          complexity: s.complexity ?? null,
          billable: s.billable ?? false,
          dueBucket: "today",
        });
        createdIds.push(created.id);
      }
      // Mark the parent parsed item as processed so it's not shown again
      if (currentFlowItem.originalIdx !== null) {
        await markBrainDumpProcessed(dump.id, currentFlowItem.originalIdx);
      }
      return { subs, createdIds };
    },
    onSuccess: ({ subs, createdIds }) => {
      if (subs.length === 0) {
        toast({
          title: "Already small.",
          description: "Claude couldn't split this one further.",
        });
        return;
      }
      if (!currentFlowItem) return;
      // Replace the current flow item with the new sub-items and their task ids.
      // Each sub gets a taskId so Skip can delete the row rather than orphan it.
      const newFlowItems: FlowItem[] = subs.map((s, i) => ({
        item: s,
        originalIdx: null,
        taskId: createdIds?.[i],
      }));
      setFlow((prev) => [
        ...prev.slice(0, currentIdx),
        ...newFlowItems,
        ...prev.slice(currentIdx + 1),
      ]);
      setEditing(false);
      setEditValue(null);
      setTimeline("today");
      setSpecificDate("");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
      toast({
        title: `Split into ${subs.length}.`,
        description:
          "Sub-tasks added to Today. Adjust Timeline or Skip on each.",
      });
    },
    onError: (e) => {
      toast({
        title: "Couldn't break down",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  // Enter edit mode: seed the form with the current item's AI values
  const openEdit = () => {
    if (!currentFlowItem) return;
    const it = currentFlowItem.item;
    setEditValue({
      title: it.title,
      notes: it.notes ?? "",
      spoonEstimate: it.spoon_estimate != null ? String(it.spoon_estimate) : "",
      estimatedHours:
        it.estimated_hours != null ? String(it.estimated_hours) : "",
      complexity: it.complexity ?? "",
      timeline,
      specificDate,
      billable: it.billable ?? false,
    });
    setEditing(true);
  };

  // Save edits: convert form to task input, update flow[currentIdx] in place,
  // and also propagate timeline choice back to the timeline dropdown.
  const saveEdit = () => {
    if (!editValue || !currentFlowItem) return;
    const conv = fieldsToTaskInput(editValue);
    if ("error" in conv) {
      toast({ title: "Fix that first", description: conv.error });
      return;
    }
    const updated: ParsedTaskItem = {
      title: conv.title,
      notes: conv.notes ?? undefined,
      spoon_estimate: conv.spoonEstimate ?? undefined,
      estimated_hours: conv.estimatedHours ?? undefined,
      complexity: conv.complexity ?? undefined,
      billable: conv.billable,
      // Preserve the AI's break_down_hint
      break_down_hint: currentFlowItem.item.break_down_hint,
    };
    setFlow((prev) =>
      prev.map((f, i) =>
        i === currentIdx ? { ...f, item: updated } : f,
      ),
    );
    // Reflect the timeline change into the parent timeline picker state
    setTimeline(editValue.timeline);
    setSpecificDate(editValue.specificDate);
    setEditing(false);
    setEditValue(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditValue(null);
  };

  if (!open || !currentItem) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-serif text-sm text-muted-foreground">
              {positionLabel}
              {breakDown.isPending && (
                <span className="ml-2 italic">Splitting&hellip;</span>
              )}
            </DialogTitle>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close review"
              data-testid="button-review-close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        {editing && editValue ? (
          <>
            <div className="space-y-4">
              <TaskFieldsForm
                value={editValue}
                onChange={setEditValue}
                idPrefix={`review-edit`}
              />
            </div>
            <DialogFooter className="flex-wrap gap-2 sm:justify-end">
              <Button variant="ghost" size="sm" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveEdit} data-testid="button-review-edit-save">
                Save edits
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <h3 className="font-serif text-xl text-foreground">
                {currentItem.title}
              </h3>
              {currentItem.notes && (
                <p className="whitespace-pre-wrap font-serif text-sm italic text-muted-foreground">
                  {currentItem.notes}
                </p>
              )}

              <div className="rounded-md border border-border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    AI suggests
                  </p>
                  <button
                    onClick={openEdit}
                    className="text-xs text-primary hover:underline"
                    data-testid="button-review-edit"
                  >
                    Edit
                  </button>
                </div>
                <p className="font-serif text-sm text-foreground">
                  {[
                    currentItem.spoon_estimate != null
                      ? `${currentItem.spoon_estimate} spoons`
                      : null,
                    currentItem.estimated_hours != null
                      ? `${currentItem.estimated_hours}h`
                      : null,
                    currentItem.complexity ?? null,
                    currentItem.billable ? "billable" : null,
                  ]
                    .filter(Boolean)
                    .join(" \u00b7 ")}
                </p>
              </div>

              {currentItem.break_down_hint && (
                <div className="rounded-md border border-amber-400/40 bg-amber-50/50 p-3">
                  <p className="text-xs italic text-amber-900 dark:text-amber-200">
                    This one might be big. Break it into smaller pieces?
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="review-timeline">Timeline</Label>
                <select
                  id="review-timeline"
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value as TaskFieldsValue["timeline"])}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  data-testid="review-timeline"
                >
                  <option value="today">Today (default)</option>
                  <option value="this_week">This week</option>
                  <option value="next_week">Next week</option>
                  <option value="this_month">This month</option>
                  <option value="this_quarter">This quarter</option>
                  <option value="later">Later</option>
                  <option value="specific_date">Pick a specific date&hellip;</option>
                </select>
                {timeline === "specific_date" && (
                  <Input
                    type="date"
                    value={specificDate}
                    onChange={(e) => setSpecificDate(e.target.value)}
                    className="mt-2"
                    data-testid="review-specific-date"
                  />
                )}
              </div>
            </div>

            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => breakDown.mutate()}
                  disabled={breakDown.isPending}
                  data-testid="button-review-breakdown"
                >
                  <Split className="mr-1 h-3.5 w-3.5" />
                  Break down
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => skipCurrent.mutate()}
                  data-testid="button-review-skip"
                >
                  Skip
                </Button>
              </div>
              <Button
                onClick={() => commitCurrent.mutate()}
                disabled={commitCurrent.isPending}
                data-testid="button-review-add"
              >
                {commitCurrent.isPending ? "Adding\u2026" : "Add task"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Dump card ----------

function DumpCard({ dump }: { dump: BrainDumpRow }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reviewOpen, setReviewOpen] = useState(false);

  const parsing = useMutation({
    mutationFn: async () => parseBrainDump(dump.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brain_dumps"] });
      setReviewOpen(true);
    },
    onError: (e) => {
      toast({
        title: "Couldn't parse",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const del = useMutation({
    mutationFn: async () => deleteBrainDump(dump.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brain_dumps"] });
    },
  });

  const remaining = remainingItemCount(dump);
  const hasBeenParsed = dump.parsed_at != null;
  const totalParsed = dump.parsed_items?.length ?? 0;
  const addedCount = (dump.processed_indices ?? []).length;
  const skippedCount = (dump.skipped_indices ?? []).length;

  return (
    <>
      <Card data-testid={`card-braindump-${dump.id}`}>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="whitespace-pre-wrap font-serif text-sm text-foreground">
              {dump.content}
            </p>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => del.mutate()}
              aria-label="Delete"
              data-testid={`button-braindump-delete-${dump.id}`}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {hasBeenParsed && totalParsed > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-primary">
                {addedCount} added
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {skippedCount} skipped
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-50/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-amber-900 dark:text-amber-200">
                {remaining} remaining
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs italic text-muted-foreground">
              {formatRelative(dump.created_at)}
            </p>
            {!hasBeenParsed ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => parsing.mutate()}
                disabled={parsing.isPending}
                data-testid={`button-braindump-parse-${dump.id}`}
              >
                <Wand2 className="mr-1 h-3.5 w-3.5" />
                {parsing.isPending ? "Parsing\u2026" : "Parse with AI"}
              </Button>
            ) : remaining > 0 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReviewOpen(true)}
                data-testid={`button-braindump-continue-${dump.id}`}
              >
                Continue reviewing ({remaining} left)
              </Button>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                All reviewed
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      {hasBeenParsed && (
        <ReviewFlow
          dump={dump}
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </>
  );
}

// ---------- Page ----------

export default function BrainDump() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const listQ = useQuery<BrainDumpRow[]>({
    queryKey: ["brain_dumps"],
    queryFn: listBrainDumps,
  });

  // Detect voice support on mount
  useEffect(() => {
    setVoiceSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const startListening = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      toast({
        title: "Voice not available",
        description:
          "Your browser doesn't support voice input. Try Chrome or Edge.",
      });
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: unknown) => {
      const evt = e as { results: Array<{ 0: { transcript: string }; isFinal: boolean }> };
      const results = evt.results;
      let transcript = "";
      for (let i = 0; i < results.length; i++) {
        if (results[i].isFinal) {
          transcript += results[i][0].transcript + " ";
        }
      }
      if (transcript) {
        setContent((prev) => (prev ? prev + " " + transcript.trim() : transcript.trim()));
      }
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    rec.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  };

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = content.trim();
      if (!trimmed) throw new Error("Nothing to save yet.");
      await createBrainDump(trimmed);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brain_dumps"] });
      setContent("");
      toast({ title: "Held it." });
    },
    onError: (e) => {
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (content.trim() && !save.isPending) save.mutate();
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Brain dump"
        subtitle="Put it down. Sort it later, or don't. Both are fine."
      />

      <Card>
        <CardContent className="space-y-3 p-5">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's rattling around? A thought, a worry, a to-do, a not-yet-a-thought. No tags, no priorities, no structure."
            rows={6}
            className="resize-none border-none bg-transparent p-0 font-serif text-base focus-visible:ring-0"
            data-testid="input-braindump"
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {voiceSupported && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={listening ? stopListening : startListening}
                  data-testid="button-voice"
                >
                  {listening ? (
                    <>
                      <MicOff className="mr-1 h-3.5 w-3.5" /> Stop
                    </>
                  ) : (
                    <>
                      <Mic className="mr-1 h-3.5 w-3.5" /> Speak
                    </>
                  )}
                </Button>
              )}
              <p className="font-serif text-xs italic text-muted-foreground">
                Cmd or Ctrl + Enter, or click Hold it. Same thing.
              </p>
            </div>
            <Button
              onClick={() => save.mutate()}
              disabled={!content.trim() || save.isPending}
              data-testid="button-braindump-save"
            >
              {save.isPending ? "Saving\u2026" : "Hold it"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {listQ.isLoading ? (
        <p className="font-serif text-sm italic text-muted-foreground">
          Loading&hellip;
        </p>
      ) : (listQ.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"
              aria-hidden
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <p className="font-serif text-base italic text-muted-foreground">
              Nothing yet. When you write or speak something above, it'll live here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Past dumps
          </p>
          <div className="space-y-3">
            {(listQ.data ?? []).map((d) => (
              <DumpCard key={d.id} dump={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

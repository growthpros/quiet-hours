// Brain Dump: freeform capture. Low-friction, unsorted, no tags.
// The timeline below the textarea shows past dumps read-only.
// Voice: "what's rattling around" not "task backlog". This is a
// place to put things down, not a place to grade them.

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Sparkles } from "lucide-react";
import {
  listBrainDumps,
  createBrainDump,
  deleteBrainDump,
  type BrainDumpRow,
} from "@/lib/tasks-data";
import { useToast } from "@/hooks/use-toast";

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

function DumpCard({ dump }: { dump: BrainDumpRow }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const del = useMutation({
    mutationFn: async () => {
      await deleteBrainDump(dump.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brain_dumps"] });
    },
    onError: (e) => {
      toast({
        title: "Couldn't delete",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });
  return (
    <Card data-testid={`card-braindump-${dump.id}`}>
      <CardContent className="space-y-2 p-4">
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
        <p className="text-xs italic text-muted-foreground">
          {formatRelative(dump.created_at)}
        </p>
      </CardContent>
    </Card>
  );
}

export default function BrainDump() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [content, setContent] = useState("");

  const listQ = useQuery<BrainDumpRow[]>({
    queryKey: ["brain_dumps"],
    queryFn: listBrainDumps,
  });

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
    // Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) submits.
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
            <p className="font-serif text-xs italic text-muted-foreground">
              Cmd or Ctrl + Enter to save.
            </p>
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
              Nothing yet. When you write something above, it'll live here.
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

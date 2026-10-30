import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  REFRAMES,
  CATEGORY_LABELS,
  type Reframe,
  type ReframeCategory,
} from "@/lib/quiet-hours-data";

type Filter = "all" | ReframeCategory;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "over-responsibility", label: "Over-responsibility" },
  { key: "differences", label: "Differences" },
  { key: "perfectionism", label: "Perfectionism" },
  { key: "rumination", label: "Rumination" },
];

function CopyButton({ text, id }: { text: string; id: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const onCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast({ title: "Copied." });
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0"
      onClick={onCopy}
      data-testid={`button-copy-${id}`}
      aria-label="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function ReframeCard({ item }: { item: Reframe }) {
  return (
    <Card data-testid={`card-reframe-${item.id}`}>
      <CardContent className="space-y-4 p-5">
        <Badge variant="secondary" className="text-[11px]">
          {CATEGORY_LABELS[item.category]}
        </Badge>
        <h3 className="font-serif text-lg font-medium text-foreground">
          {item.trigger}
        </h3>
        <p className="border-l-2 border-accent pl-4 font-serif italic text-muted-foreground">
          {item.innerCritic}
        </p>
        <ul className="space-y-1.5">
          {item.reframes.map((r, idx) => (
            <li
              key={idx}
              className="flex items-start justify-between gap-2 rounded-md hover-elevate py-1 pl-1"
            >
              <span className="text-sm text-foreground">{r}</span>
              <CopyButton text={r} id={`${item.id}-${idx}`} />
            </li>
          ))}
        </ul>
        {item.script && (
          <div className="rounded-md bg-muted/60 p-3">
            <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              You can say
            </div>
            <div className="flex items-start justify-between gap-2">
              <p className="font-serif text-sm text-foreground">
                “{item.script}”
              </p>
              <CopyButton text={item.script} id={`${item.id}-script`} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Reframes() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = REFRAMES.filter((r) => {
    const matchesFilter = filter === "all" || r.category === filter;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      r.trigger.toLowerCase().includes(q) ||
      r.innerCritic.toLowerCase().includes(q) ||
      r.reframes.some((x) => x.toLowerCase().includes(q)) ||
      (r.script?.toLowerCase().includes(q) ?? false);
    return matchesFilter && matchesQuery;
  });

  return (
    <div className="space-y-8">
      {/* Header — stacked column so search gets full width */}
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
            Reframes
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            A library for the loops that catch you: the critic's line, and a
            few quieter things to think or say instead.
          </p>
        </div>
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search triggers and reframes…"
            className="pl-9"
            data-testid="input-search-reframes"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm hover-elevate",
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
              data-testid={`chip-filter-${f.key}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center font-serif italic text-muted-foreground">
            Nothing matches that yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((item) => (
            <ReframeCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

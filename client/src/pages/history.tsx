import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  BurnoutCheckinRow,
  DelegationTaskRow,
  ChecklistRunRow,
  CompassionEntryRow,
} from "@/lib/supabase";
import {
  ListChecks,
  MessageSquare,
  Split,
  Waves,
  HeartHandshake,
} from "lucide-react";
import { HistoryCharts } from "@/components/history-charts";

// ---------- Date-range filter ----------
type Range = "7d" | "14d" | "30d" | "90d" | "365d" | "all";

const RANGE_LABELS: Record<Range, string> = {
  "7d": "Last 7 days",
  "14d": "Last 14 days",
  "30d": "Last 30 days",
  "90d": "Last quarter",
  "365d": "Last year",
  all: "All time",
};

const RANGE_DAYS: Record<Range, number> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
  "365d": 365,
  all: 3650, // effectively 10y for the charts' granularity logic
};

function rangeStartMs(r: Range): number {
  if (r === "all") return 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - RANGE_DAYS[r] + 1);
  return d.getTime();
}

// ---------- Small maps ----------
const STATE_LABEL: Record<string, string> = {
  grounded: "Grounded",
  drifting: "Drifting",
  chasing: "Chasing",
  numbing: "Numbing",
  frozen: "Frozen",
};

const PULL_LABEL: Record<string, string> = {
  phone: "Phone / apps",
  news: "News / feeds",
  "side-project": "A side project",
  "other-work": "Work that isn't today's work",
  scrolling: "Scrolling",
  replaying: "Replaying something",
  other: "Something else",
};

const SYMPTOM_LABEL: Record<string, string> = {
  headache: "Headache or head pressure",
  jaw: "Jaw or shoulder tension",
  foggy: "Foggy thinking",
  wired: "Wired but tired",
  irritable: "Irritable",
  withdraw: "Wanting to hide",
  stomach: "Stomach unsettled",
  tears: "Close to tears",
  numb: "Numb or flat",
};

function bandLabel(intensity: number): string {
  if (intensity < 2) return "Restored";
  if (intensity < 3) return "Steady";
  if (intensity < 4) return "Stretched";
  return "Overloaded";
}

function timeOfDayBucket(ms: number): "morning" | "midday" | "afternoon" | "evening" {
  const h = new Date(ms).getHours();
  if (h < 11) return "morning";
  if (h < 14) return "midday";
  if (h < 18) return "afternoon";
  return "evening";
}

function safeParseArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------- Row types with camelCase (from queryClient shim) ----------
type BurnoutRow = BurnoutCheckinRow & {
  createdAt: number;
};
type DelegationRow = DelegationTaskRow & { createdAt: number };
type ChecklistRow = ChecklistRunRow & {
  templateLabel: string;
  createdAt: number;
};
type CompassionRow = CompassionEntryRow & {
  firstThought: string;
  intensityBefore: number;
  intensityAfter: number;
  createdAt: number;
};

// ============================================================================
// History page
// ============================================================================
export default function History() {
  const [range, setRange] = useState<Range>("7d");
  const since = rangeStartMs(range);

  const burnout = useQuery<BurnoutRow[]>({ queryKey: ["/api/burnout"] });
  const delegation = useQuery<DelegationRow[]>({
    queryKey: ["/api/delegation"],
  });
  const checklists = useQuery<ChecklistRow[]>({
    queryKey: ["/api/checklists"],
  });
  const compassion = useQuery<CompassionRow[]>({
    queryKey: ["/api/compassion"],
  });

  const loading =
    burnout.isLoading ||
    delegation.isLoading ||
    checklists.isLoading ||
    compassion.isLoading;

  // Filter each stream to range
  const b = (burnout.data ?? []).filter((r) => r.createdAt >= since);
  const d = (delegation.data ?? []).filter((r) => r.createdAt >= since);
  const cl = (checklists.data ?? []).filter((r) => r.createdAt >= since);
  const co = (compassion.data ?? []).filter((r) => r.createdAt >= since);

  const totalEntries = b.length + d.length + cl.length + co.length;

  return (
    <div className="space-y-10">
      <PageHeader
        title="History"
        subtitle="A place to look back — not to grade yourself. Notice what shows up, and let the patterns be information, not verdicts."
      />

      {/* Range filter */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
          <Button
            key={r}
            variant={range === r ? "default" : "outline"}
            size="sm"
            onClick={() => setRange(r)}
            data-testid={`button-range-${r}`}
          >
            {RANGE_LABELS[r]}
          </Button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : totalEntries === 0 ? (
        <EmptyState range={range} />
      ) : (
        <>
          <HistoryCharts
            checkins={b.map((r) => ({ ...(r as unknown as BurnoutCheckinRow), created_at: r.createdAt }))}
            delegation={d.map((r) => ({ ...(r as unknown as DelegationTaskRow), created_at: r.createdAt }))}
            checklists={cl.map((r) => ({ ...(r as unknown as ChecklistRunRow), created_at: r.createdAt }))}
            compassion={co.map((r) => ({ ...(r as unknown as CompassionEntryRow), created_at: r.createdAt }))}
            rangeDays={RANGE_DAYS[range]}
            rangeLabel={RANGE_LABELS[range]}
          />
          <ReflectionMirror
            burnout={b}
            delegation={d}
            checklists={cl}
            compassion={co}
          />
          <BrowsableHistory
            burnout={b}
            delegation={d}
            checklists={cl}
            compassion={co}
          />
        </>
      )}
    </div>
  );
}

// ============================================================================
// Loading + empty
// ============================================================================
function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function EmptyState({ range }: { range: Range }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-10 text-center">
        <p className="font-serif italic text-muted-foreground">
          Nothing in this window.
        </p>
        <p className="font-serif text-sm italic text-muted-foreground">
          {range === "all"
            ? "When you log a check-in, task, checklist, or compassion entry, it'll show up here."
            : "Try a wider range, or come back after you've logged a few things."}
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Reflection Mirror
// ============================================================================
interface MirrorProps {
  burnout: BurnoutRow[];
  delegation: DelegationRow[];
  checklists: ChecklistRow[];
  compassion: CompassionRow[];
}

function ReflectionMirror({
  burnout,
  delegation,
  checklists,
  compassion,
}: MirrorProps) {
  const stateCounts = useMemo(() => {
    const map = new Map<string, number>();
    burnout.forEach((c) => {
      if (c.state) map.set(c.state, (map.get(c.state) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [burnout]);

  const totalStates = stateCounts.reduce((s, [, n]) => s + n, 0);
  const nonGrounded = stateCounts
    .filter(([id]) => id !== "grounded")
    .reduce((s, [, n]) => s + n, 0);

  const pullCounts = useMemo(() => {
    const map = new Map<string, number>();
    burnout.forEach((c) => {
      safeParseArray(c.pulls).forEach((p) =>
        map.set(p, (map.get(p) ?? 0) + 1),
      );
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [burnout]);

  const symptomCounts = useMemo(() => {
    const map = new Map<string, number>();
    burnout.forEach((c) => {
      safeParseArray(c.symptoms).forEach((s) =>
        map.set(s, (map.get(s) ?? 0) + 1),
      );
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [burnout]);

  // Time-of-day counts for burnout check-ins
  const timeBuckets = useMemo(() => {
    const buckets = {
      morning: 0,
      midday: 0,
      afternoon: 0,
      evening: 0,
    };
    burnout.forEach((c) => {
      buckets[timeOfDayBucket(c.createdAt)] += 1;
    });
    return buckets;
  }, [burnout]);
  const timeMax = Math.max(
    timeBuckets.morning,
    timeBuckets.midday,
    timeBuckets.afternoon,
    timeBuckets.evening,
    1,
  );

  // Delegation: how many did you release control of vs still holding
  const delegateQuadrant = delegation.filter((t) => t.quadrant === "delegate");
  const released = delegateQuadrant.filter((t) => t.released_control).length;

  // Checklists: shipped ratio
  const shipped = checklists.filter((c) => c.shipped).length;

  // Compassion: how often the reframe softened intensity
  const softened = compassion.filter(
    (c) => c.intensityAfter < c.intensityBefore,
  ).length;
  const avgDrop =
    compassion.length > 0
      ? compassion.reduce(
          (s, c) => s + (c.intensityBefore - c.intensityAfter),
          0,
        ) / compassion.length
      : 0;

  return (
    <section className="space-y-6" data-testid="section-mirror">
      <div className="space-y-1">
        <h2 className="font-serif text-lg font-semibold text-foreground">
          What showed up
        </h2>
        <p className="font-serif text-sm italic text-muted-foreground">
          Not a scorecard — just what your check-ins have been noticing.
        </p>
      </div>

      {/* Overview: one-line reads per stream */}
      <div className="grid gap-3 md:grid-cols-2">
        <OverviewCard
          icon={Waves}
          eyebrow="Burnout check-ins"
          headline={
            burnout.length === 0
              ? "None logged."
              : nonGrounded === 0
                ? `${burnout.length} check-in${burnout.length === 1 ? "" : "s"} — all grounded.`
                : `${nonGrounded} of ${totalStates} caught you in a pulled-in state.`
          }
          body={
            burnout.length === 0
              ? "When you pause for five minutes, it lands here."
              : "Not a verdict — the noticing itself is the practice."
          }
        />
        <OverviewCard
          icon={Split}
          eyebrow="Delegation"
          headline={
            delegation.length === 0
              ? "Nothing logged."
              : delegateQuadrant.length === 0
                ? `${delegation.length} task${delegation.length === 1 ? "" : "s"} — none needed handing off.`
                : `${released} of ${delegateQuadrant.length} handed off with control released.`
          }
          body={
            delegateQuadrant.length > 0 && released < delegateQuadrant.length
              ? "It will not be done my way. That is the point."
              : "Delegation is a muscle. It gets easier."
          }
        />
        <OverviewCard
          icon={ListChecks}
          eyebrow="Good Enough checklists"
          headline={
            checklists.length === 0
              ? "None started."
              : shipped === 0
                ? `${checklists.length} in progress, none shipped yet.`
                : `${shipped} of ${checklists.length} shipped.`
          }
          body={
            shipped > 0
              ? "Each ship is a rep in stopping at done."
              : "Define done before you start. So perfectionism has nothing to push against."
          }
        />
        <OverviewCard
          icon={HeartHandshake}
          eyebrow="Compassion entries"
          headline={
            compassion.length === 0
              ? "None logged."
              : softened === 0
                ? `${compassion.length} entr${compassion.length === 1 ? "y" : "ies"} logged.`
                : `${softened} of ${compassion.length} landed softer after the reframe.`
          }
          body={
            avgDrop > 0
              ? `On average, intensity moved down by ${avgDrop.toFixed(1)} points.`
              : "When something lands hard, come back."
          }
        />
      </div>

      {/* States distribution */}
      {totalStates > 0 && (
        <Card data-testid="card-state-distribution">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Which states have shown up
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stateCounts.map(([id, n]) => (
              <div key={id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{STATE_LABEL[id] ?? id}</span>
                  <span className="text-muted-foreground">
                    {n} · {Math.round((n / totalStates) * 100)}%
                  </span>
                </div>
                <Progress
                  value={(n / totalStates) * 100}
                  className={cn("h-1.5", id === "grounded" && "opacity-90")}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {/* Top pulls */}
        {pullCounts.length > 0 && (
          <Card data-testid="card-top-pulls">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                What kept pulling you
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pullCounts.map(([id, n]) => (
                <div
                  key={id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-foreground">
                    {PULL_LABEL[id] ?? id}
                  </span>
                  <span className="text-muted-foreground">{n}×</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Top symptoms */}
        {symptomCounts.length > 0 && (
          <Card data-testid="card-top-symptoms">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                What kept showing up in the body
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {symptomCounts.map(([id, n]) => (
                <div
                  key={id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-foreground">
                    {SYMPTOM_LABEL[id] ?? id}
                  </span>
                  <span className="text-muted-foreground">{n}×</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Time of day */}
      {burnout.length >= 3 && (
        <Card data-testid="card-time-of-day">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              When you pause
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-serif text-sm italic text-muted-foreground">
              Which times of day you tend to check in.
            </p>
            {(
              ["morning", "midday", "afternoon", "evening"] as const
            ).map((k) => {
              const label =
                k === "morning"
                  ? "Morning (before 11)"
                  : k === "midday"
                    ? "Midday (11–2)"
                    : k === "afternoon"
                      ? "Afternoon (2–6)"
                      : "Evening (6+)";
              const n = timeBuckets[k];
              return (
                <div key={k} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{label}</span>
                    <span className="text-muted-foreground">{n}</span>
                  </div>
                  <Progress value={(n / timeMax) * 100} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function OverviewCard({
  icon: Icon,
  eyebrow,
  headline,
  body,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  eyebrow: string;
  headline: string;
  body: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center gap-2">
          <Icon
            className="h-4 w-4 text-muted-foreground"
            strokeWidth={1.5}
          />
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </span>
        </div>
        <p className="font-serif text-base text-foreground">{headline}</p>
        <p className="font-serif text-sm italic text-muted-foreground">
          {body}
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Browsable History
// ============================================================================
type FeedFilter = "all" | "burnout" | "delegation" | "checklists" | "compassion";

interface FeedItem {
  id: string;
  type: FeedFilter;
  createdAt: number;
  render: () => React.ReactNode;
}

function BrowsableHistory({
  burnout,
  delegation,
  checklists,
  compassion,
}: MirrorProps) {
  const [filter, setFilter] = useState<FeedFilter>("all");

  const items: FeedItem[] = useMemo(() => {
    const rows: FeedItem[] = [];

    burnout.forEach((c) => {
      rows.push({
        id: `b-${c.id}`,
        type: "burnout",
        createdAt: c.createdAt,
        render: () => <BurnoutItem c={c} />,
      });
    });
    delegation.forEach((t) => {
      rows.push({
        id: `d-${t.id}`,
        type: "delegation",
        createdAt: t.createdAt,
        render: () => <DelegationItem t={t} />,
      });
    });
    checklists.forEach((cl) => {
      rows.push({
        id: `c-${cl.id}`,
        type: "checklists",
        createdAt: cl.createdAt,
        render: () => <ChecklistItem cl={cl} />,
      });
    });
    compassion.forEach((co) => {
      rows.push({
        id: `co-${co.id}`,
        type: "compassion",
        createdAt: co.createdAt,
        render: () => <CompassionItem co={co} />,
      });
    });

    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }, [burnout, delegation, checklists, compassion]);

  const visible = filter === "all" ? items : items.filter((i) => i.type === filter);

  // Group by date
  const byDate = useMemo(() => {
    const map = new Map<string, FeedItem[]>();
    visible.forEach((item) => {
      const key = formatDate(item.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    return [...map.entries()];
  }, [visible]);

  const filters: { key: FeedFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "burnout", label: "Burnout" },
    { key: "delegation", label: "Delegation" },
    { key: "checklists", label: "Checklists" },
    { key: "compassion", label: "Compassion" },
  ];

  return (
    <section className="space-y-6" data-testid="section-history">
      <div className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            The record itself
          </h2>
          <p className="font-serif text-sm italic text-muted-foreground">
            Every entry in this window, newest first. Read what you want, skip what you want.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.key)}
              data-testid={`button-filter-${f.key}`}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {byDate.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center font-serif italic text-muted-foreground">
            Nothing of that kind in this window.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {byDate.map(([date, entries]) => (
            <div key={date} className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {date}
              </p>
              <div className="space-y-2">
                {entries.map((item) => (
                  <div key={item.id}>{item.render()}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- Feed item renderers ----------
function BurnoutItem({ c }: { c: BurnoutRow }) {
  const stateName = c.state ? STATE_LABEL[c.state] ?? c.state : bandLabel(c.intensity);
  const pulls = safeParseArray(c.pulls);
  const symptoms = safeParseArray(c.symptoms);

  return (
    <Card data-testid={`history-burnout-${c.id}`}>
      <CardContent className="space-y-1.5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Waves className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {formatTime(c.createdAt)} · Burnout
            </span>
          </div>
          <span className="font-serif text-sm font-medium text-foreground">
            {stateName}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {bandLabel(c.intensity)} · energy {c.energy}/5 · sensory {c.sensory}/5
        </p>
        {pulls.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Pulled by: {pulls.map((p) => PULL_LABEL[p] ?? p).join(", ")}
          </p>
        )}
        {symptoms.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Body: {symptoms.map((s) => SYMPTOM_LABEL[s] ?? s).join(", ")}
          </p>
        )}
        {c.note && (
          <p className="font-serif text-sm italic text-muted-foreground">
            “{c.note}”
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DelegationItem({ t }: { t: DelegationRow }) {
  const quadrantName =
    t.quadrant === "do"
      ? "Do"
      : t.quadrant === "schedule"
        ? "Schedule"
        : t.quadrant === "delegate"
          ? "Delegate"
          : "Drop";
  return (
    <Card data-testid={`history-delegation-${t.id}`}>
      <CardContent className="space-y-1.5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Split className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {formatTime(t.createdAt)} · Delegation
            </span>
          </div>
          <span className="font-serif text-sm font-medium text-foreground">
            {quadrantName}
          </span>
        </div>
        <p className="text-sm text-foreground">{t.title}</p>
        <p className="text-xs text-muted-foreground">
          urgency {t.urgency}/5 · importance {t.importance}/5
          {t.assignee && ` · handed to ${t.assignee}`}
          {t.released_control ? " · released" : ""}
          {t.completed ? " · complete" : ""}
        </p>
        {t.notes && (
          <p className="text-sm text-muted-foreground">{t.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ChecklistItem({ cl }: { cl: ChecklistRow }) {
  return (
    <Card data-testid={`history-checklist-${cl.id}`}>
      <CardContent className="space-y-1.5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {formatTime(cl.createdAt)} · Good Enough
            </span>
          </div>
          <span className="font-serif text-sm font-medium text-foreground">
            {cl.shipped ? "Shipped" : "In progress"}
          </span>
        </div>
        <p className="text-sm text-foreground">{cl.templateLabel}</p>
      </CardContent>
    </Card>
  );
}

function CompassionItem({ co }: { co: CompassionRow }) {
  const softened = co.intensityAfter < co.intensityBefore;
  return (
    <Card data-testid={`history-compassion-${co.id}`}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HeartHandshake className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {formatTime(co.createdAt)} · Compassion
            </span>
          </div>
          <span className="font-serif text-sm font-medium text-foreground">
            {co.intensityBefore} → {co.intensityAfter}
            {softened && " · softer"}
          </span>
        </div>
        <p className="text-sm text-foreground">{co.trigger}</p>
        <p className="font-serif text-sm italic text-muted-foreground">
          “{co.reframe}”
        </p>
      </CardContent>
    </Card>
  );
}

// silence unused MessageSquare warning if any tree-shaker complains
void MessageSquare;

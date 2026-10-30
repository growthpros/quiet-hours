import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Check, Waves } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { BurnoutCheckin } from "@shared/schema";
import {
  startOfTodayMs,
  summarize,
  bandFor,
  markerPercent,
  parseSymptoms,
  symptomLabel,
  SYMPTOM_OPTIONS,
  formatTime,
} from "@/lib/burnout-utils";
import { ChipMultiSelect } from "@/components/chip-multiselect";
import { PULL_OPTIONS } from "@/lib/burnout-options-const";
import { issueSpoonsFromCheckin, type CheckinBudgetResult } from "@/lib/spoon-data";
import { basisLine, loadDetail } from "@/lib/daily-budget";
import { InfoTip } from "@/components/info-tip";
import { EXPLAIN } from "@/lib/explainers";
import type { BurnoutCheckinRow } from "@/lib/supabase";

const ENERGY_SCALE = [
  { v: 1, label: "Depleted" },
  { v: 2, label: "Low" },
  { v: 3, label: "Steady" },
  { v: 4, label: "Present" },
  { v: 5, label: "Bright" },
];

const SENSORY_SCALE = [
  { v: 1, label: "Quiet" },
  { v: 2, label: "Soft" },
  { v: 3, label: "Noticeable" },
  { v: 4, label: "A lot" },
  { v: 5, label: "Overloaded" },
];

// Map an average (may be fractional) to the nearest scale label,
// so summaries speak in words rather than numbers.
function energyLabel(avg: number): string {
  const v = Math.round(avg);
  return ENERGY_SCALE.find((s) => s.v === v)?.label ?? "Not set";
}
function sensoryLabel(avg: number): string {
  const v = Math.round(avg);
  return SENSORY_SCALE.find((s) => s.v === v)?.label ?? "Not set";
}

// ---------- Compulsive-state options ----------
// Named states rather than a scale — avoids turning activation into another number.
interface StateOption {
  id: string;
  label: string;
  blurb: string;
  ground?: string; // gentle grounding suggestion when this is where you are
}

const STATE_OPTIONS: StateOption[] = [
  {
    id: "grounded",
    label: "Grounded",
    blurb: "I'm here on purpose. What I'm doing is what I meant to do.",
  },
  {
    id: "drifting",
    label: "Drifting",
    blurb:
      "I got pulled into something without deciding to: the phone, the news, a side project, a rabbit hole.",
    ground:
      "Name the pull. Close one tab. Choose the next 20 minutes on purpose, however small.",
  },
  {
    id: "chasing",
    label: "Chasing",
    blurb:
      "I'm racing between tasks, none of them the one I actually meant to start.",
    ground:
      "Stop. Write the one real thing on a piece of paper. Do only that for the next 15 minutes.",
  },
  {
    id: "numbing",
    label: "Numbing",
    blurb:
      "I'm using input, like scrolling, reading, building or checking, to not feel something underneath.",
    ground:
      "You don't have to fix the feeling. Put both feet on the floor, breathe out longer than in, and let it be there for a minute.",
  },
  {
    id: "frozen",
    label: "Frozen",
    blurb:
      "I know what I should be doing and I can't start.",
    ground:
      "Shrink the task. What is the tiniest startable piece? Opening a doc, writing one sentence, standing up. Do that.",
  },
];


function stateLabel(id: string | null | undefined): string {
  if (!id) return "Not set";
  return STATE_OPTIONS.find((s) => s.id === id)?.label ?? id;
}

// What the check-in did to today's spoons, shown after saving.
function BudgetNote({ result }: { result: CheckinBudgetResult }) {
  const spoons = Number(result.ledger.allotted);
  const headline =
    result.outcome === "set"
      ? `Today starts with ${spoons} spoons.`
      : result.outcome === "lowered"
        ? `Today is now ${spoons} spoons.`
        : `Today stays at ${spoons} spoons.`;
  return (
    <div
      className="w-full max-w-md rounded-md border border-border/70 bg-muted/30 p-3 text-left"
      data-testid="checkin-budget-note"
    >
      <p className="flex items-center gap-1.5 font-serif text-sm font-medium text-foreground">
        {headline}
        <InfoTip label="today's spoons" testId="info-checkin-budget">
          <p>{EXPLAIN.budgetMath}</p>
          <p className="text-muted-foreground">{EXPLAIN.estimateNote}</p>
        </InfoTip>
      </p>
      {result.outcome !== "kept" ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{basisLine(result.basis)}</p>
          {result.basis.loads.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">Other load: {loadDetail(result.basis)}</p>
          )}
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          This check-in worked out to {result.basis.spoons}. A later check-in can lower today, never raise it.
        </p>
      )}
    </div>
  );
}

// ---------------- Check-in card ----------------
function CheckinCard() {
  useToast(); // reserved for future toasts on this card
  const [step, setStep] = useState(1);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sensory, setSensory] = useState<number | null>(null);
  const [state, setStateChoice] = useState<string | null>(null);
  const [pulls, setPulls] = useState<string[]>([]);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [budgetResult, setBudgetResult] = useState<CheckinBudgetResult | null>(null);

  const reset = () => {
    setStep(1);
    setEnergy(null);
    setSensory(null);
    setStateChoice(null);
    setPulls([]);
    setSymptoms([]);
    setNote("");
    setBudgetResult(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/burnout", {
        energy,
        sensory,
        symptoms: JSON.stringify(symptoms),
        state,
        pulls: JSON.stringify(pulls),
        note: note.trim() || null,
      });
      // Try to parse the created check-in so we can issue spoons if this
      // is the day's first. If parsing fails, that's non-fatal.
      try {
        const created = await res.json();
        if (created && typeof created === "object") {
          const row: BurnoutCheckinRow = {
            id: Number(created.id ?? 0),
            user_id: String(created.userId ?? created.user_id ?? ""),
            energy: Number(created.energy ?? energy),
            sensory: Number(created.sensory ?? sensory),
            intensity: Number(created.intensity ?? 0),
            symptoms: String(created.symptoms ?? JSON.stringify(symptoms)),
            state: (created.state ?? state) as string | null,
            pulls: String(created.pulls ?? JSON.stringify(pulls)),
            note: (created.note ?? (note.trim() || null)) as string | null,
            created_at: Number(created.createdAt ?? created.created_at ?? Date.now()),
          };
          try {
            setBudgetResult(await issueSpoonsFromCheckin(row));
          } catch (e) {
            // The check-in itself saved; a budget failure shouldn't undo it.
            // Logged so it isn't silent, and the meter still invites a check-in.
            console.error("Couldn't set today's spoons from the check-in", e);
          }
        }
      } catch (e) {
        // The check-in still saved; only the spoon budget is skipped.
        console.error("Couldn't read the saved check-in", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/burnout"] });
      queryClient.invalidateQueries({ queryKey: ["/api/burnout/streaks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/burnout", "recent-14d"] });
      queryClient.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
      setSaved(true);
    },
  });

  const localIntensity =
    energy != null && sensory != null
      ? (sensory + (6 - energy)) / 2
      : 0;

  const toggleSymptom = (id: string) =>
    setSymptoms((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  const togglePull = (id: string) =>
    setPulls((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );

  const selectedState = STATE_OPTIONS.find((s) => s.id === state);
  // Pulls apply to any non-grounded state — including Frozen, which often
  // has a cause (dread of a specific task, an unresolved conversation, etc.).
  const showsPulls = state != null && state !== "grounded";

  if (saved) {
    return (
      <Card data-testid="card-checkin-success">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="font-serif text-lg font-medium text-foreground">
              Saved. Thank you for pausing.
            </p>
            <p className="font-serif text-sm italic text-muted-foreground">
              Noticing is the whole practice. The rest can wait.
            </p>
          </div>
          {budgetResult && <BudgetNote result={budgetResult} />}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => {
                setSaved(false);
                reset();
              }}
              data-testid="button-log-another"
            >
              Log another moment
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const ScaleButtons = ({
    scale,
    value,
    onSelect,
    prefix,
  }: {
    scale: { v: number; label: string }[];
    value: number | null;
    onSelect: (v: number) => void;
    prefix: string;
  }) => (
    <div className="grid grid-cols-5 gap-2">
      {scale.map((s) => (
        <button
          key={s.v}
          onClick={() => onSelect(s.v)}
          className={cn(
            "flex flex-col items-center gap-1 rounded-lg border px-1 py-3 text-center hover-elevate",
            value === s.v
              ? "border-primary bg-accent ring-2 ring-primary"
              : "border-border",
          )}
          data-testid={`button-${prefix}-${s.v}`}
        >
          <span className="font-serif text-lg font-semibold text-foreground">
            {s.v}
          </span>
          <span className="text-[11px] leading-tight text-muted-foreground">
            {s.label}
          </span>
        </button>
      ))}
    </div>
  );

  const canAdvance =
    (step === 1 && energy != null) ||
    (step === 2 && sensory != null) ||
    (step === 3 && state != null) ||
    step === 4 ||
    step === 5;

  return (
    <Card data-testid="card-checkin">
      <CardContent className="space-y-6 p-6">
        <div className="grid grid-cols-6 gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className={cn(
                "h-1.5 rounded-full transition-colors",
                n <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="flex items-center gap-1.5 font-serif text-lg font-medium text-foreground">
                Where is your energy right now?
                <InfoTip label="energy">
                  <p>{EXPLAIN.energy}</p>
                </InfoTip>
              </h2>
              <p className="font-serif text-sm italic text-muted-foreground">
                Not what you wish it were. Just what it is.
              </p>
            </div>
            <ScaleButtons
              scale={ENERGY_SCALE}
              value={energy}
              onSelect={setEnergy}
              prefix="energy"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="flex items-center gap-1.5 font-serif text-lg font-medium text-foreground">
                How loud does the world feel?
                <InfoTip label="sensory input">
                  <p>{EXPLAIN.sensory}</p>
                </InfoTip>
              </h2>
              <p className="font-serif text-sm italic text-muted-foreground">
                Sound, light, texture, screens, other people. How much is
                landing on you right now?
              </p>
            </div>
            <ScaleButtons
              scale={SENSORY_SCALE}
              value={sensory}
              onSelect={setSensory}
              prefix="sensory"
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="flex items-center gap-1.5 font-serif text-lg font-medium text-foreground">
                What kind of state are you in?
                <InfoTip label="state">
                  <p>{EXPLAIN.state}</p>
                </InfoTip>
              </h2>
              <p className="font-serif text-sm italic text-muted-foreground">
                Not how bad or good, but what kind. This one matters most.
              </p>
            </div>
            <div className="space-y-2">
              {STATE_OPTIONS.map((s) => {
                const active = state === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setStateChoice(s.id)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left hover-elevate",
                      active
                        ? "border-primary bg-accent ring-2 ring-primary"
                        : "border-border",
                    )}
                    data-testid={`button-state-${s.id}`}
                  >
                    <div className="font-serif text-base font-medium text-foreground">
                      {s.label}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {s.blurb}
                    </div>
                  </button>
                );
              })}
            </div>

            {showsPulls && (
              <div className="space-y-2 rounded-md bg-muted/40 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  What pulled you (optional)
                </p>
                <ChipMultiSelect
                  curated={PULL_OPTIONS}
                  category="pull"
                  selected={pulls}
                  onChange={setPulls}
                  compact
                  testIdPrefix="chip-pull"
                />
              </div>
            )}

            {selectedState?.ground && (
              <div
                className="rounded-md border-l-2 border-l-primary bg-accent/30 p-3"
                data-testid="text-grounding"
              >
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  If it helps
                </p>
                <p className="mt-1 font-serif text-sm italic text-foreground">
                  {selectedState.ground}
                </p>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="flex items-center gap-1.5 font-serif text-lg font-medium text-foreground">
                Anything in the body?
                <InfoTip label="body signals">
                  <p>{EXPLAIN.bodySignals}</p>
                </InfoTip>
              </h2>
              <p className="font-serif text-sm italic text-muted-foreground">
                All optional. Tap whatever's true.
              </p>
            </div>
            <ChipMultiSelect
              curated={SYMPTOM_OPTIONS}
              category="body"
              selected={symptoms}
              onChange={setSymptoms}
              testIdPrefix="chip-symptom"
            />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-serif text-lg font-medium text-foreground">
                Anything you want to note?
              </h2>
              <p className="font-serif text-sm italic text-muted-foreground">
                Optional. A word or two is plenty.
              </p>
            </div>
            <Textarea
              value={note}
              maxLength={240}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's on you right now…"
              rows={4}
              data-testid="input-note"
            />
            <div className="text-right text-xs text-muted-foreground">
              {note.length}/240
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h2 className="font-serif text-lg font-medium text-foreground">
              A quick look before you save
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">State</dt>
                <dd className="font-serif font-semibold text-foreground">
                  {stateLabel(state)}
                </dd>
              </div>
              {pulls.length > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Pulled by</dt>
                  <dd className="text-right text-foreground">
                    {pulls
                      .map(
                        (p) =>
                          PULL_OPTIONS.find((o) => o.id === p)?.label ?? p,
                      )
                      .join(", ")}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Energy</dt>
                <dd className="text-foreground">
                  {ENERGY_SCALE.find((e) => e.v === energy)?.label}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Sensory load</dt>
                <dd className="text-foreground">
                  {SENSORY_SCALE.find((s) => s.v === sensory)?.label}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Where this sits</dt>
                <dd className="font-serif font-semibold text-foreground">
                  {bandFor(localIntensity).label}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Noticed</dt>
                <dd className="text-right text-foreground">
                  {symptoms.length
                    ? symptoms.map((s) => symptomLabel(s)).join(", ")
                    : "Nothing noted"}
                </dd>
              </div>
              {note.trim() && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Note</dt>
                  <dd className="text-right text-foreground">{note}</dd>
                </div>
              )}
            </dl>
            <Button
              className="w-full"
              size="lg"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              data-testid="button-save-checkin"
            >
              {save.isPending ? "Saving…" : "Save this check-in"}
            </Button>
          </div>
        )}

        {/* Nav */}
        {step < 6 && (
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              data-testid="button-step-back"
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance}
              data-testid="button-step-next"
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
        {step === 6 && (
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(5)}
              data-testid="button-step-back"
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------- Summary column ----------------
function KpiCard({
  label,
  value,
  sub,
  testid,
}: {
  label: string;
  value: string;
  sub?: string;
  testid: string;
}) {
  return (
    <Card data-testid={testid}>
      <CardContent className="p-4">
        <div className="font-serif text-xl font-semibold text-foreground">
          {value}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function SummaryColumn() {
  const { toast } = useToast();
  const todayStart = startOfTodayMs();
  const { data, isLoading } = useQuery<BurnoutCheckin[]>({
    queryKey: ["/api/burnout", "today"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/burnout?since=${todayStart}`);
      return res.json();
    },
  });

  const clear = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/burnout/clear-today"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/burnout"] });
      toast({ title: "Today's check-ins cleared." });
    },
  });

  const checkins = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.createdAt - b.createdAt),
    [data],
  );

  const summary = summarize(checkins);
  const band = bandFor(summary.avgIntensity);

  const chartData = checkins.map((c) => ({
    time: formatTime(c.createdAt),
    intensity: Number(c.intensity.toFixed(2)),
  }));

  // Count states across today's check-ins.
  const stateCounts = useMemo(() => {
    const map = new Map<string, number>();
    checkins.forEach((c) => {
      const s = (c as unknown as { state?: string | null }).state;
      if (s) map.set(s, (map.get(s) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [checkins]);

  const totalWithState = stateCounts.reduce((sum, [, n]) => sum + n, 0);
  const nonGroundedCount = stateCounts
    .filter(([id]) => id !== "grounded")
    .reduce((sum, [, n]) => sum + n, 0);

  // Pulls across today's check-ins
  const pullCounts = useMemo(() => {
    const map = new Map<string, number>();
    checkins.forEach((c) => {
      const raw = (c as unknown as { pulls?: string | null }).pulls;
      if (!raw) return;
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((p: string) => map.set(p, (map.get(p) ?? 0) + 1));
        }
      } catch {
        /* ignore */
      }
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [checkins]);

  const symptomCounts = useMemo(() => {
    const map = new Map<string, number>();
    checkins.forEach((c) =>
      parseSymptoms(c.symptoms).forEach((s) =>
        map.set(s, (map.get(s) ?? 0) + 1),
      ),
    );
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [checkins]);

  const maxSymptom = symptomCounts[0]?.[1] ?? 1;

  const timeRange =
    checkins.length > 0
      ? `${formatTime(checkins[0].createdAt)} – ${formatTime(
          checkins[checkins.length - 1].createdAt,
        )}`
      : "";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (checkins.length === 0) {
    return (
      <Card data-testid="card-summary-empty">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <Waves className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="font-serif text-lg italic text-muted-foreground">
            No check-ins yet today. The summary fills in as you pause.
          </p>
          <p className="text-sm text-muted-foreground">
            Start on the left whenever you're ready.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Today so far"
          value={band.label}
          testid="kpi-avg-intensity"
        />
        <KpiCard
          label="Energy"
          value={energyLabel(summary.avgEnergy)}
          testid="kpi-avg-energy"
        />
        <KpiCard
          label="Sensory load"
          value={sensoryLabel(summary.avgSensory)}
          testid="kpi-avg-sensory"
        />
        <KpiCard
          label="Check-ins today"
          value={String(summary.count)}
          sub={timeRange}
          testid="kpi-count"
        />
      </div>

      {/* Band */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Where today sits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative pt-1">
            <div className="h-2.5 w-full rounded-full bg-gradient-to-r from-primary via-chart-3 to-destructive opacity-80" />
            <div
              className="absolute top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-background bg-foreground shadow"
              style={{ left: `${markerPercent(summary.avgIntensity)}%` }}
              data-testid="marker-band"
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Restored</span>
            <span>Steady</span>
            <span>Stretched</span>
            <span>Overloaded</span>
          </div>
          <p className="font-serif text-sm italic text-muted-foreground" data-testid="text-band-interpretation">
            {band.interpretation}
          </p>
        </CardContent>
      </Card>

      {/* Timeline */}
      {chartData.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Through the day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="time"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <YAxis
                    domain={[1, 5]}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "0.8rem",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="intensity"
                    name="Intensity"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* State breakdown — how many check-ins were grounded vs. not */}
      {totalWithState > 0 && (
        <Card data-testid="card-state-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              How you landed here
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nonGroundedCount > 0 ? (
              <p className="font-serif text-sm italic text-muted-foreground">
                {nonGroundedCount} of {totalWithState}{" "}
                {totalWithState === 1 ? "check-in" : "check-ins"} today caught
                you in a pulled-in state rather than grounded. Noticing that is the
                practice.
              </p>
            ) : (
              <p className="font-serif text-sm italic text-muted-foreground">
                Every check-in today was grounded.
              </p>
            )}
            <div className="space-y-2">
              {stateCounts.map(([id, n]) => {
                const opt = STATE_OPTIONS.find((s) => s.id === id);
                return (
                  <div
                    key={id}
                    className="space-y-1"
                    data-testid={`state-count-${id}`}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {opt?.label ?? id}
                      </span>
                      <span className="text-muted-foreground">{n}</span>
                    </div>
                    <Progress
                      value={(n / totalWithState) * 100}
                      className="h-1.5"
                    />
                  </div>
                );
              })}
            </div>
            {pullCounts.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  What kept pulling you
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {pullCounts.map(([id, n]) => (
                    <span
                      key={id}
                      className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
                      data-testid={`pull-count-${id}`}
                    >
                      {PULL_OPTIONS.find((p) => p.id === id)?.label ?? id}{" "}
                      <span className="opacity-60">· {n}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Symptoms */}
      {symptomCounts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Most-noticed today
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {symptomCounts.map(([id, count]) => (
              <div key={id} className="space-y-1" data-testid={`symptom-bar-${id}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{symptomLabel(id)}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <Progress value={(count / maxSymptom) * 100} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Check-in list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Check-ins
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...checkins].reverse().map((c) => {
            const cState = (c as unknown as { state?: string | null }).state;
            return (
            <div
              key={c.id}
              className="space-y-1 border-b border-border pb-3 last:border-0 last:pb-0"
              data-testid={`checkin-row-${c.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground">
                  {formatTime(c.createdAt)}
                </span>
                <span className="font-serif text-sm font-medium text-foreground">
                  {cState ? stateLabel(cState) : bandFor(c.intensity).label}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {cState && (
                  <>
                    {bandFor(c.intensity).label} ·{" "}
                  </>
                )}
                {energyLabel(c.energy)} energy · {sensoryLabel(c.sensory)} sensory
              </div>
              {c.note && (
                <p className="font-serif text-sm italic text-muted-foreground">
                  “{c.note}”
                </p>
              )}
            </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              data-testid="button-clear-today"
            >
              Clear today
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-serif">
                Clear today's check-ins?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This removes every check-in logged today. It can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-clear-cancel">
                Keep them
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => clear.mutate()}
                data-testid="button-clear-confirm"
              >
                Clear today
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default function Burnout() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Check-in"
        subtitle="How are you right now? A five-minute burnout check-in. Notice where you are, then let it be that."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            A five-minute check-in
          </h2>
          <CheckinCard />
        </div>
        <div className="space-y-3">
          <h2 className="font-serif text-lg font-semibold text-foreground">
            Today's summary
          </h2>
          <SummaryColumn />
        </div>
      </div>
    </div>
  );
}

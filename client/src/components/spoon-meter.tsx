// Persistent Spoon + Earn-back Meter for Today.
// Always visible above the Wave. Shows the running spoon math:
//   allotted, committed, spent, earned-back, remaining.
// Also renders a horizontal cluster of "quick earn" chips (featured actions),
// and a "more" button that opens the full earn-back panel.

import { spoonsOf } from "@/lib/spoon-cost";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listTasks } from "@/lib/tasks-data";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Utensils, MoreHorizontal } from "lucide-react";
import {
  getOrCreateTodayLedger,
  getOrCreateLedgerForDate,
  listEarnBackActions,
  listTodayEarnBackEvents,
  listEarnBackEventsForDate,
  logEarnBack,
  seedDefaultEarnBackIfNeeded,
  undoEarnBack,
  type EarnBackActionRow,
  type EarnBackEventRow,
  type SpoonLedgerRow,
} from "@/lib/spoon-data";
import { useViewingDate, humanLabel } from "@/lib/viewing-date";

const C = {
  cream: "#FBF7F0",
  cream2: "#F4EEE1",
  ink: "#2A2620",
  inkSoft: "#3D3A34",
  inkMute: "#6D655A",
  line: "#DFD5BF",
  moss: "#8FA05A",
  mossSoft: "#DFE5C9",
  sage: "#7A9B7E",
  sageSoft: "#D4E0D3",
  amber: "#D9A55E",
  amberSoft: "#F2E1C5",
  terracotta: "#D89B7A",
  terracottaSoft: "#F0D9C7",
  gold: "#F5E7CB",
};

function fmt(n: number): string {
  return Math.round(n * 2) / 2 === Math.trunc(n)
    ? String(Math.trunc(n))
    : n.toFixed(1);
}

export function SpoonMeter() {
  const qc = useQueryClient();
  const [showEarnPanel, setShowEarnPanel] = useState(false);
  const { date, isToday } = useViewingDate();
  const { usual, usualSet, ready: profileReady } = useSpoonBudget();

  const ledgerQ = useQuery<SpoonLedgerRow>({
    queryKey: ["/api/spoon/ledger", date],
    queryFn: async () => {
      if (isToday) await seedDefaultEarnBackIfNeeded();
      return getOrCreateLedgerForDate(date);
    },
  });

  const actionsQ = useQuery<EarnBackActionRow[]>({
    queryKey: ["/api/earn-back/actions"],
    queryFn: listEarnBackActions,
  });

  const eventsQ = useQuery<EarnBackEventRow[]>({
    queryKey: ["/api/earn-back/events", date],
    queryFn: () => listEarnBackEventsForDate(date),
  });

  // Today's SpoonMeter recomputes Committed and Spent from the tasks
  // cache on every render. Committed = active-task spoons; Spent =
  // ledger.spent (from burnout/phase writes) + today's completed-task
  // spoons. Adding/completing tasks updates the meter without reload.
  const tasksQ = useQuery({
    queryKey: ["tasks"],
    queryFn: listTasks,
    enabled: isToday,
  });

  const log = useMutation({
    mutationFn: async (action: EarnBackActionRow) => {
      if (!isToday) throw new Error("Past days are read-only.");
      return logEarnBack({
        action,
        durationMinutes: action.duration_min_minutes ?? null,
      });
    },
    onSuccess: (result, action) => {
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger", date] });
      qc.invalidateQueries({ queryKey: ["/api/earn-back/events", date] });
      if (result.event.at_cap) {
        toast({
          title: `${action.label}, logged.`,
          description: `At cap for today (${action.daily_cap}/day). No spoons added, still counted.`,
        });
      } else {
        toast({
          title: `+${fmt(Number(action.spoon_value))} spoon${Number(action.spoon_value) === 1 ? "" : "s"} earned back.`,
          description: `${action.label}. Small things, compounding.`,
        });
      }
    },
    onError: (e: Error) => {
      toast({ title: "Couldn't log that.", description: e.message });
    },
  });

  const undo = useMutation({
    mutationFn: async (eventId: number) => {
      if (!isToday) throw new Error("Past days are read-only.");
      return undoEarnBack(eventId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger", date] });
      qc.invalidateQueries({ queryKey: ["/api/earn-back/events", date] });
      toast({ title: "Earn-back removed." });
    },
  });

  const ledger = ledgerQ.data;
  const actions = (actionsQ.data ?? []).filter((a) => a.enabled);
  const featured = actions.filter((a) => a.featured).slice(0, 6);
  const events = eventsQ.data ?? [];

  const total = ledger ? Number(ledger.allotted) + Number(ledger.earned_back) : 0;

  // Today's task-completion spoons: when a task with a spoon estimate is
  // checked off, those spoons move from Committed to Spent. Compute this
  // live from the tasks cache so completion is reflected immediately,
  // matching how Committed works.
  const startOfToday = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const spentFromTasksToday = isToday
    ? (tasksQ.data ?? [])
        .filter(
          (t) =>
            t.completed_at != null &&
            (t.completed_at as number) >= startOfToday,
        )
        .reduce((acc, t) => acc + spoonsOf(t), 0)
    : 0;

  const spent = (ledger ? Number(ledger.spent) : 0) + spentFromTasksToday;

  // Only today's unfinished tasks count against today's budget.
  const committed = isToday
    ? committedSpoonsToday(tasksQ.data ?? [], localIsoDate())
    : ledger
    ? Number(ledger.committed)
    : 0;
  const earned = ledger ? Number(ledger.earned_back) : 0;
  const remaining = Math.max(0, total - spent - committed);

  const noAllotment = !ledger || Number(ledger.allotted) === 0;
  // What went into the budget, for days set after migration 016.
  const basis = !noAllotment && ledger?.budget_basis ? ledger.budget_basis : null;

  // Count today's events per action, so cap status is visible on the chips
  const perActionCount = new Map<number, number>();
  for (const e of events) {
    if (!e.at_cap) {
      perActionCount.set(e.action_id, (perActionCount.get(e.action_id) ?? 0) + 1);
    }
  }

  return (
    <>
      <Card className="overflow-hidden" data-testid="card-spoon-meter">
        <div
          className="px-6 pt-5 pb-4"
          style={{
            background: "linear-gradient(180deg, #F4EEE1 0%, #EFE7D2 100%)",
          }}
        >
          {/* Header row */}
          <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.14em] font-semibold flex items-center gap-2"
                style={{ color: C.inkSoft }}
              >
                <Utensils className="h-3.5 w-3.5" strokeWidth={2} />
                {isToday ? "Today's Spoons" : `Spoons, ${humanLabel(date).toLowerCase()}`}
              </p>
              <p
                className="font-serif italic text-sm mt-1"
                style={{ color: C.inkMute }}
              >
                {noAllotment
                  ? isToday
                    ? `Until you check in, plans use your ordinary okay day of ${usual} spoons. A check-in sets today's real number from how you are right now.`
                    : "No allotment was issued this day. It happens when you skip the morning check-in."
                  : "How much energy you had, and how much was spoken for."}
              </p>
              {basis && (
                <p
                  className="mt-1 flex flex-wrap items-center gap-1 text-xs"
                  style={{ color: C.inkMute }}
                  data-testid="spoon-basis"
                >
                  {basisLine(basis)}
                  <InfoTip label="today's number" testId="info-spoon-basis">
                    <p>{EXPLAIN.budgetMath}</p>
                    {basis.loads.length > 0 && <p>Other load: {loadDetail(basis)}</p>}
                    <p className="text-muted-foreground">{EXPLAIN.estimateNote}</p>
                  </InfoTip>
                </p>
              )}
              {isToday && !usualSet && profileReady && (
                <p className="mt-1 text-xs" data-testid="ordinary-day-invite">
                  <Link href="/settings" className="underline underline-offset-2" style={{ color: C.inkSoft }}>
                    What does an ordinary okay day look like for you?
                  </Link>{" "}
                  <span style={{ color: C.inkMute }}>Until you say, the app uses 12 spoons.</span>
                </p>
              )}
            </div>
            {noAllotment && isToday && (
              <Link href="/burnout">
                <Button size="sm" data-testid="button-checkin-for-spoons">
                  Do morning check-in
                </Button>
              </Link>
            )}
          </div>

          {ledgerQ.isLoading ? (
            <Skeleton className="h-16 w-full rounded-md" />
          ) : noAllotment ? null : (
            <>
              {/* Values row */}
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-4" data-testid="spoon-values">
                <MeterValue label="Total" value={fmt(total)} accent={C.ink} info={EXPLAIN.total} />
                <MeterValue label="Spent" value={fmt(spent)} accent={C.terracotta} info={EXPLAIN.spent} />
                <MeterValue label="Committed" value={fmt(committed)} accent={C.amber} info={EXPLAIN.committed} />
                <MeterValue label="Earned back" value={"+" + fmt(earned)} accent={C.moss} info={EXPLAIN.earnedBack} />
                <MeterValue label="Free" value={fmt(remaining)} accent={C.sage} strong info={EXPLAIN.free} />
              </div>

              {/* Progress bar.
                  Three visible segments, left to right:
                    1. Spent (terracotta), out of total
                    2. Committed (amber, slightly transparent), out of total
                    3. Earned back (moss, slightly transparent), out of total
                  The remaining space is "free" (gold background).
                  When nothing is spent or committed but earn-back has fired,
                  the moss segment still shows so the day's care work is visible. */}
              <div
                className="h-3 rounded-full overflow-hidden flex mb-1"
                style={{ background: C.gold }}
                title={`Spent ${fmt(spent)}, committed ${fmt(committed)}, earned back ${fmt(earned)}, free ${fmt(remaining)}`}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${total > 0 ? (spent / total) * 100 : 0}%`,
                    background: C.terracotta,
                  }}
                />
                <div
                  className="h-full"
                  style={{
                    width: `${total > 0 ? (committed / total) * 100 : 0}%`,
                    background: C.amber,
                    opacity: 0.7,
                  }}
                />
                <div
                  className="h-full"
                  style={{
                    width: `${total > 0 ? (earned / total) * 100 : 0}%`,
                    background: C.moss,
                    opacity: 0.7,
                  }}
                  data-testid="bar-earned-back"
                />
              </div>
              <div
                className="text-[10px] flex flex-wrap items-center gap-x-3 gap-y-1 font-medium mt-1"
                style={{ color: C.inkMute }}
              >
                {spent > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ background: C.terracotta }}
                    />
                    Spent
                  </span>
                )}
                {committed > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ background: C.amber, opacity: 0.7 }}
                    />
                    Committed
                  </span>
                )}
                {earned > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ background: C.moss, opacity: 0.7 }}
                    />
                    Earned back
                  </span>
                )}
                <span className="ml-auto">{fmt(total)} total</span>
              </div>
            </>
          )}
        </div>

        {/* Earn-back chip cluster */}
        {actionsQ.isLoading ? (
          <div className="px-6 py-4 border-t" style={{ borderColor: C.line }}>
            <Skeleton className="h-10 w-full rounded-full" />
          </div>
        ) : featured.length > 0 && isToday ? (
          <div className="px-6 py-4 border-t" style={{ borderColor: C.line }}>
            <p
              className="text-[10px] uppercase tracking-[0.14em] font-bold mb-2"
              style={{ color: C.moss }}
            >
              Quick earn
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {featured.map((a) => {
                const count = perActionCount.get(a.id) ?? 0;
                const atCap = count >= a.daily_cap;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => log.mutate(a)}
                    disabled={log.isPending}
                    className={
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all hover:-translate-y-0.5 " +
                      (atCap ? "opacity-60" : "")
                    }
                    style={{
                      background: atCap ? C.cream2 : C.mossSoft,
                      color: atCap ? C.inkMute : "#4A5A2A",
                      borderColor: atCap ? C.line : "rgba(143, 160, 90, 0.35)",
                    }}
                    data-testid={`earn-chip-${a.action_key}`}
                  >
                    <span aria-hidden>{a.icon ?? "•"}</span>
                    <span>{a.label}</span>
                    <span className="text-[10px] font-bold opacity-70">
                      {atCap ? `at cap` : `+${fmt(Number(a.spoon_value))}`}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowEarnPanel(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-sm font-semibold hover:bg-white/60"
                style={{ borderColor: C.line, color: C.inkSoft }}
                data-testid="button-open-earn-panel"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span>More</span>
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      {showEarnPanel && (
        <EarnBackPanel
          actions={actions}
          events={events}
          onClose={() => setShowEarnPanel(false)}
          onLog={(a) => log.mutate(a)}
          onUndo={(id) => undo.mutate(id)}
        />
      )}
    </>
  );
}

function MeterValue({
  label,
  value,
  accent,
  strong,
  info,
}: {
  label: string;
  value: string;
  accent: string;
  strong?: boolean;
  info?: string;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-0.5 text-[10px] uppercase tracking-[0.14em] font-bold"
        style={{ color: C.inkMute }}
      >
        {label}
        {info && (
          <InfoTip label={label.toLowerCase()}>
            <p>{info}</p>
          </InfoTip>
        )}
      </div>
      <div
        className="font-serif tabular-nums leading-none mt-1"
        style={{
          color: accent,
          fontSize: strong ? 28 : 22,
          fontWeight: strong ? 600 : 500,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ---------- Full earn-back panel (modal) ----------
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { committedSpoonsToday } from "@/lib/task-timeframe";
import { localIsoDate } from "@/lib/local-date";
import { useSpoonBudget } from "@/lib/use-spoon-budget";
import { InfoTip } from "@/components/info-tip";
import { EXPLAIN } from "@/lib/explainers";
import { basisLine, loadDetail } from "@/lib/daily-budget";

interface EarnBackPanelProps {
  actions: EarnBackActionRow[];
  events: EarnBackEventRow[];
  onClose: () => void;
  onLog: (a: EarnBackActionRow) => void;
  onUndo: (eventId: number) => void;
}

function EarnBackPanel({ actions, events, onClose, onLog, onUndo }: EarnBackPanelProps) {
  // Build "count per action today"
  const countByAction = new Map<number, number>();
  for (const e of events) {
    if (!e.at_cap) {
      countByAction.set(e.action_id, (countByAction.get(e.action_id) ?? 0) + 1);
    }
  }
  const nameByAction = new Map<number, string>();
  const iconByAction = new Map<number, string | null>();
  for (const a of actions) {
    nameByAction.set(a.id, a.label);
    iconByAction.set(a.id, a.icon);
  }

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Earn back</DialogTitle>
          <p className="font-serif italic text-sm" style={{ color: C.inkMute }}>
            Small returns to your body. Per instance, not per duration.
          </p>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2 mt-4">
          {actions.map((a) => {
            const count = countByAction.get(a.id) ?? 0;
            const atCap = count >= a.daily_cap;
            const isCapVisible = a.daily_cap > 0;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onLog(a)}
                className={
                  "text-left border rounded-lg p-3 transition-all hover:-translate-y-0.5 " +
                  (atCap ? "opacity-60" : "")
                }
                style={{
                  background: atCap ? C.cream2 : C.mossSoft,
                  borderColor: atCap ? C.line : "rgba(143, 160, 90, 0.35)",
                }}
                data-testid={`earn-panel-${a.action_key}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg" aria-hidden>
                    {a.icon ?? "•"}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: C.ink }}>
                    {a.label}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-[11px]" style={{ color: C.inkMute }}>
                  <span className="font-semibold" style={{ color: atCap ? C.inkMute : "#4A5A2A" }}>
                    {atCap ? "at cap" : `+${fmt(Number(a.spoon_value))} spoon${Number(a.spoon_value) === 1 ? "" : "s"}`}
                  </span>
                  {isCapVisible && (
                    <span>
                      {count}/{a.daily_cap} today
                    </span>
                  )}
                </div>
                {a.duration_min_minutes && (
                  <p className="text-[10px] italic mt-1" style={{ color: C.inkMute }}>
                    at least {a.duration_min_minutes} min
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Recent earns */}
        <div className="mt-6">
          <p
            className="text-[10px] uppercase tracking-[0.14em] font-bold mb-2"
            style={{ color: C.inkSoft }}
          >
            Today's earn feed
          </p>
          {events.length === 0 ? (
            <p className="font-serif italic text-sm" style={{ color: C.inkMute }}>
              Nothing logged yet. Small things, one at a time.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {events.slice(0, 20).map((e) => {
                const d = new Date(e.created_at);
                const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                return (
                  <li
                    key={e.id}
                    className="flex items-center justify-between text-sm py-1 px-2 rounded"
                    style={{ background: "rgba(255,255,255,0.5)" }}
                  >
                    <span className="flex items-center gap-2" style={{ color: C.ink }}>
                      <span aria-hidden>{iconByAction.get(e.action_id) ?? "•"}</span>
                      <span>{nameByAction.get(e.action_id) ?? "—"}</span>
                      <span className="text-xs" style={{ color: C.inkMute }}>
                        · {t}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      {e.at_cap ? (
                        <span className="text-xs italic" style={{ color: C.inkMute }}>
                          logged, at cap
                        </span>
                      ) : (
                        <span
                          className="text-xs font-bold"
                          style={{ color: C.moss }}
                        >
                          +{fmt(Number(e.spoons_awarded))}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onUndo(e.id)}
                        className="text-xs underline"
                        style={{ color: C.inkMute }}
                        data-testid={`undo-earn-${e.id}`}
                      >
                        undo
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Link href="/earn-back">
            <Button variant="outline" onClick={onClose}>
              Edit earn-back list
            </Button>
          </Link>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

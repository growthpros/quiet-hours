// History charts.
// One consolidated component with four visualizations:
//   1. Historic Burnout Wave (dots + curve across the range)
//   2. State distribution stacked bars (per day / week / month)
//   3. Ranked "What pulled you" chips
//   4. Ranked "Body signals" chips
//   5. Toolkit usage sparklines (delegation / good-enough / compassion)

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import type {
  BurnoutCheckinRow,
  DelegationTaskRow,
  ChecklistRunRow,
  CompassionEntryRow,
} from "@/lib/supabase";
import { listChips, type ChipRow } from "@/lib/chip-library-data";
import { PULL_OPTIONS } from "@/lib/burnout-options-const";
import { SYMPTOM_OPTIONS } from "@/lib/burnout-utils";

const COLORS = {
  moss: "#8FA05A",
  mossSoft: "#DFE5C9",
  sage: "#7A9B7E",
  sageSoft: "#D4E0D3",
  amber: "#D9A55E",
  amberSoft: "#F2E1C5",
  terracotta: "#D89B7A",
  terracottaSoft: "#F0D9C7",
  ink: "#2A2620",
  inkDeep: "#1F1D1A",
  inkSoft: "#3D3A34",
  inkMute: "#6D655A",
  line: "#C8BFA9",
  lineSoft: "#DFD5BF",
};

const STATE_COLORS: Record<string, string> = {
  grounded: COLORS.moss,
  drifting: COLORS.sage,
  chasing: COLORS.amber,
  numbing: COLORS.terracotta,
  frozen: COLORS.inkDeep,
};

const STATE_LABEL: Record<string, string> = {
  grounded: "Grounded",
  drifting: "Drifting",
  chasing: "Chasing",
  numbing: "Numbing",
  frozen: "Frozen",
};

const BANDS = [
  { key: "restored", label: "Restored", tint: "rgba(143, 160, 90, 0.09)", accent: COLORS.moss },
  { key: "steady", label: "Steady", tint: "rgba(122, 155, 126, 0.09)", accent: COLORS.sage },
  { key: "stretched", label: "Stretched", tint: "rgba(217, 165, 94, 0.10)", accent: COLORS.amber },
  { key: "overloaded", label: "Overloaded", tint: "rgba(216, 155, 122, 0.12)", accent: COLORS.terracotta },
] as const;

// ---------- helpers ----------
function safeParseArray(s: string | null): string[] {
  if (!s) return [];
  try {
    const p = JSON.parse(s);
    return Array.isArray(p) ? p.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function dotColorFor(intensity: number): string {
  if (intensity < 2) return COLORS.moss;
  if (intensity < 3) return COLORS.sage;
  if (intensity < 4) return COLORS.amber;
  return COLORS.terracotta;
}

function yFor(intensity: number, height = 130): number {
  const v = Math.max(1, Math.min(5, intensity));
  return 12 + ((v - 1) / 4) * (height - 24);
}

function ymd(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function startOfWeek(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun..6 Sat, align weeks to Monday
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.getTime();
}
function startOfMonth(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d.getTime();
}

type Granularity = "check-in" | "day" | "week" | "month";

function granularityForRange(rangeDays: number): Granularity {
  if (rangeDays <= 14) return "check-in";
  if (rangeDays <= 60) return "day";
  if (rangeDays <= 180) return "week";
  return "month";
}

function bucketStartFor(gran: Granularity, ms: number): number {
  if (gran === "check-in") return ms;
  if (gran === "day") return startOfDay(ms);
  if (gran === "week") return startOfWeek(ms);
  return startOfMonth(ms);
}

function bucketLabelFor(gran: Granularity, ms: number): string {
  const d = new Date(ms);
  if (gran === "check-in") return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric" });
  if (gran === "day") return d.toLocaleDateString([], { month: "short", day: "numeric" });
  if (gran === "week") return `Wk of ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  return d.toLocaleDateString([], { month: "short", year: "2-digit" });
}

// ============================================================================
// Historic Burnout Wave
// ============================================================================
interface WaveProps {
  checkins: BurnoutCheckinRow[];
  rangeDays: number;
  rangeLabel: string;
}

function HistoricWave({ checkins, rangeDays, rangeLabel }: WaveProps) {
  const gran = granularityForRange(rangeDays);

  // Aggregate to average intensity per bucket
  const points = useMemo(() => {
    if (checkins.length === 0) return [] as Array<{ x: number; y: number; color: string; label: string; count: number }>;

    const buckets = new Map<number, { sum: number; count: number }>();
    for (const c of checkins) {
      const b = bucketStartFor(gran, c.created_at);
      const cur = buckets.get(b);
      if (cur) {
        cur.sum += c.intensity;
        cur.count += 1;
      } else {
        buckets.set(b, { sum: c.intensity, count: 1 });
      }
    }

    const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
    const minT = sorted[0][0];
    const maxT = sorted[sorted.length - 1][0];
    const span = Math.max(1, maxT - minT);

    return sorted.map(([t, agg]) => {
      const avg = agg.sum / agg.count;
      const pct = (t - minT) / span;
      return {
        x: 60 + pct * (1000 - 120),
        y: yFor(avg, 130),
        color: dotColorFor(avg),
        label: bucketLabelFor(gran, t),
        count: agg.count,
      };
    });
  }, [checkins, gran]);

  // Curve
  const path = useMemo(() => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
    const parts: string[] = [`M ${points[0].x},${points[0].y}`];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] ?? points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] ?? p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      parts.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
    }
    return parts.join(" ");
  }, [points]);

  const areaPath = points.length >= 2
    ? `${path} L ${points[points.length - 1].x},130 L ${points[0].x},130 Z`
    : "";

  const granLabel = gran === "check-in"
    ? "each check-in"
    : gran === "day"
    ? "daily average"
    : gran === "week"
    ? "weekly average"
    : "monthly average";

  return (
    <Card className="overflow-hidden">
      <div className="px-6 pt-5 pb-5" style={{ background: "linear-gradient(180deg, #FEFCF7 0%, #F4EEE1 100%)" }}>
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: COLORS.inkSoft }}>
              Your Wave, {rangeLabel.toLowerCase()}
            </p>
            <p className="font-serif italic text-sm mt-1" style={{ color: COLORS.inkMute }}>
              Every point is {granLabel}. The line traces how you've moved.
            </p>
          </div>
        </div>

        {points.length === 0 ? (
          <p className="font-serif italic py-6" style={{ color: COLORS.inkMute }}>
            No check-ins in this range yet. When you do one, it starts drawing.
          </p>
        ) : (
          <>
            <div className="relative h-[160px] mt-2 rounded-md overflow-hidden">
              <div className="absolute inset-0 flex flex-col pointer-events-none">
                {BANDS.map((band) => (
                  <div
                    key={band.key}
                    className="flex-1 flex items-center px-3 border-b last:border-b-0"
                    style={{ background: band.tint, borderColor: COLORS.lineSoft }}
                  >
                    <span className="font-serif italic text-[12px] font-semibold" style={{ color: band.accent }}>
                      {band.label}
                    </span>
                  </div>
                ))}
              </div>
              <svg viewBox="0 0 1000 130" preserveAspectRatio="none" className="w-full h-full block relative" style={{ minHeight: 160 }}>
                {points.length >= 2 && (
                  <>
                    <defs>
                      <linearGradient id="waveFillHist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.sage} />
                        <stop offset="100%" stopColor={COLORS.terracotta} />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#waveFillHist)" opacity="0.18" />
                    <path d={path} fill="none" stroke={COLORS.sage} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                )}
                {points.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="7" fill="#FFFFFF" />
                    <circle cx={p.x} cy={p.y} r="5" fill={p.color}>
                      <title>{`${p.label} · ${p.count} ${p.count === 1 ? "check-in" : "check-ins"}`}</title>
                    </circle>
                  </g>
                ))}
              </svg>
            </div>

            <div className="flex items-center justify-between text-[11px] font-semibold mt-2 px-1" style={{ color: COLORS.inkSoft }}>
              <span>{points[0]?.label}</span>
              <span>{points[points.length - 1]?.label}</span>
            </div>

            <p className="text-xs mt-3" style={{ color: COLORS.inkMute }}>
              {checkins.length} {checkins.length === 1 ? "check-in" : "check-ins"} across {rangeLabel.toLowerCase()}.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

// ============================================================================
// State Distribution stacked bars
// ============================================================================
function StateDistribution({ checkins, rangeDays, rangeLabel }: WaveProps) {
  const gran: Granularity = rangeDays <= 21 ? "day" : rangeDays <= 120 ? "week" : "month";

  const data = useMemo(() => {
    const buckets = new Map<number, Record<string, number>>();
    for (const c of checkins) {
      if (!c.state) continue;
      const b = bucketStartFor(gran, c.created_at);
      const bucket = buckets.get(b) ?? { grounded: 0, drifting: 0, chasing: 0, numbing: 0, frozen: 0 };
      bucket[c.state] = (bucket[c.state] ?? 0) + 1;
      buckets.set(b, bucket);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([t, mix]) => ({
        label: bucketLabelFor(gran, t),
        ...mix,
      }));
  }, [checkins, gran]);

  if (data.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="mb-3">
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: COLORS.inkSoft }}>
          State distribution, {rangeLabel.toLowerCase()}
        </p>
        <p className="font-serif italic text-sm mt-1" style={{ color: COLORS.inkMute }}>
          What percent of your check-ins landed where, {gran === "day" ? "day by day" : gran === "week" ? "week by week" : "month by month"}.
        </p>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 8 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.inkSoft }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "#FEFCF7", border: `1px solid ${COLORS.line}`, borderRadius: 8, fontSize: 12 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconType="circle"
              formatter={(v) => STATE_LABEL[v] ?? v}
            />
            <Bar dataKey="grounded" stackId="s" fill={STATE_COLORS.grounded} name="grounded" />
            <Bar dataKey="drifting" stackId="s" fill={STATE_COLORS.drifting} name="drifting" />
            <Bar dataKey="chasing" stackId="s" fill={STATE_COLORS.chasing} name="chasing" />
            <Bar dataKey="numbing" stackId="s" fill={STATE_COLORS.numbing} name="numbing" />
            <Bar dataKey="frozen" stackId="s" fill={STATE_COLORS.frozen} name="frozen" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ============================================================================
// Ranked chips (pulls, body)
// ============================================================================
interface RankingProps {
  title: string;
  eyebrow: string;
  caption: string;
  counts: Array<{ label: string; count: number }>;
  emptyMessage: string;
  accent: string;
}

function RankingChart({ title, eyebrow, caption, counts, emptyMessage, accent }: RankingProps) {
  const top = counts.slice(0, 12);
  const max = Math.max(1, ...top.map((c) => c.count));

  return (
    <Card className="p-5">
      <div className="mb-3">
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: COLORS.inkSoft }}>
          {eyebrow}
        </p>
        <p className="font-serif text-lg font-medium mt-0.5" style={{ color: COLORS.inkDeep }}>
          {title}
        </p>
        <p className="font-serif italic text-sm mt-1" style={{ color: COLORS.inkMute }}>
          {caption}
        </p>
      </div>
      {top.length === 0 ? (
        <p className="font-serif italic text-sm py-4" style={{ color: COLORS.inkMute }}>
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-2">
          {top.map((c) => (
            <div key={c.label} className="grid grid-cols-[minmax(0,1fr)_36px] items-center gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm truncate" style={{ color: COLORS.inkDeep }}>
                    {c.label}
                  </span>
                </div>
                <div className="h-2 rounded-full" style={{ background: COLORS.lineSoft }}>
                  <div
                    className="h-full rounded-full"
                    style={{ background: accent, width: `${(c.count / max) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-semibold text-right tabular-nums" style={{ color: COLORS.inkSoft }}>
                {c.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ============================================================================
// Toolkit usage sparklines
// ============================================================================
interface ToolkitProps {
  checkins: BurnoutCheckinRow[];
  delegation: DelegationTaskRow[];
  checklists: ChecklistRunRow[];
  compassion: CompassionEntryRow[];
  rangeDays: number;
  rangeLabel: string;
}

function ToolkitUsage({ checkins, delegation, checklists, compassion, rangeDays, rangeLabel }: ToolkitProps) {
  const gran: Granularity = rangeDays <= 21 ? "day" : rangeDays <= 120 ? "week" : "month";

  function seriesFor(items: Array<{ created_at: number }>): Array<{ label: string; count: number }> {
    const buckets = new Map<number, number>();
    for (const it of items) {
      const b = bucketStartFor(gran, it.created_at);
      buckets.set(b, (buckets.get(b) ?? 0) + 1);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([t, count]) => ({ label: bucketLabelFor(gran, t), count }));
  }

  const items = [
    { label: "Check-ins", data: seriesFor(checkins), accent: COLORS.sage, total: checkins.length },
    { label: "Delegation tasks", data: seriesFor(delegation), accent: COLORS.moss, total: delegation.length },
    { label: "Good Enough checklists", data: seriesFor(checklists), accent: COLORS.amber, total: checklists.length },
    { label: "Compassion entries", data: seriesFor(compassion), accent: COLORS.terracotta, total: compassion.length },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: COLORS.inkSoft }}>
          Toolkit usage
        </p>
        <p className="font-serif italic text-sm mt-1" style={{ color: COLORS.inkMute }}>
          Are you reaching for the tools that help you? A tiny trend line across {rangeLabel.toLowerCase()}.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.label} className="rounded-md border p-3" style={{ borderColor: COLORS.lineSoft }}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm font-medium" style={{ color: COLORS.inkDeep }}>
                {it.label}
              </span>
              <span className="text-sm font-bold tabular-nums" style={{ color: it.accent }}>
                {it.total}
              </span>
            </div>
            {it.data.length < 2 ? (
              <p className="font-serif italic text-xs" style={{ color: COLORS.inkMute }}>
                Not enough data yet for a trend line.
              </p>
            ) : (
              <div className="h-[40px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={it.data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={it.accent}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Tooltip
                      contentStyle={{ background: "#FEFCF7", border: `1px solid ${COLORS.line}`, borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ fontSize: 11 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// Root: HistoryCharts
// ============================================================================
interface HistoryChartsProps {
  checkins: BurnoutCheckinRow[];
  delegation: DelegationTaskRow[];
  checklists: ChecklistRunRow[];
  compassion: CompassionEntryRow[];
  rangeDays: number;
  rangeLabel: string;
}

export function HistoryCharts({
  checkins,
  delegation,
  checklists,
  compassion,
  rangeDays,
  rangeLabel,
}: HistoryChartsProps) {
  // Custom chip labels the user has added (used to label their custom chips
  // by the same lowercase label they were saved as).
  const customPullsQ = useQuery<ChipRow[]>({
    queryKey: ["/api/chip-library", "pull"],
    queryFn: () => listChips("pull"),
  });
  const customBodyQ = useQuery<ChipRow[]>({
    queryKey: ["/api/chip-library", "body"],
    queryFn: () => listChips("body"),
  });

  // Aggregate pulls
  const pullCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of checkins) {
      for (const p of safeParseArray(c.pulls)) {
        counts.set(p, (counts.get(p) ?? 0) + 1);
      }
    }
    // Turn ids into labels using curated + custom lookup
    const labelFor = (v: string) => {
      const curated = PULL_OPTIONS.find((o) => o.id === v);
      if (curated) return curated.label;
      return v; // custom chips are stored by their lowercase label
    };
    return Array.from(counts.entries())
      .map(([v, count]) => ({ label: labelFor(v), count }))
      .sort((a, b) => b.count - a.count);
  }, [checkins, customPullsQ.data]);

  const symptomCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of checkins) {
      for (const s of safeParseArray(c.symptoms)) {
        counts.set(s, (counts.get(s) ?? 0) + 1);
      }
    }
    const labelFor = (v: string) => {
      const curated = SYMPTOM_OPTIONS.find((o) => o.id === v);
      if (curated) return curated.label;
      return v;
    };
    return Array.from(counts.entries())
      .map(([v, count]) => ({ label: labelFor(v), count }))
      .sort((a, b) => b.count - a.count);
  }, [checkins, customBodyQ.data]);

  return (
    <section className="space-y-4" data-testid="section-history-charts">
      <HistoricWave checkins={checkins} rangeDays={rangeDays} rangeLabel={rangeLabel} />

      <StateDistribution checkins={checkins} rangeDays={rangeDays} rangeLabel={rangeLabel} />

      <div className="grid gap-4 md:grid-cols-2">
        <RankingChart
          title="What pulled you"
          eyebrow="Ranked"
          caption="Where your attention got captured, most to least."
          counts={pullCounts}
          emptyMessage="No pulls logged in this range."
          accent={COLORS.amber}
        />
        <RankingChart
          title="Body signals"
          eyebrow="Ranked"
          caption="What the body said, most to least."
          counts={symptomCounts}
          emptyMessage="No body signals logged in this range."
          accent={COLORS.terracotta}
        />
      </div>

      <ToolkitUsage
        checkins={checkins}
        delegation={delegation}
        checklists={checklists}
        compassion={compassion}
        rangeDays={rangeDays}
        rangeLabel={rangeLabel}
      />
    </section>
  );
}

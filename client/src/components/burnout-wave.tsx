// The Burnout Wave.
// A ribbon at the top of Today that plots every check-in the user has logged
// so far today, positioned by time on the x-axis and by state intensity on
// the y-axis. Includes a warm regulation message tuned to today's pattern.

import { EXPLAIN } from "@/lib/explainers";
import { InfoTip } from "@/components/info-tip";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Waves } from "lucide-react";
import type { BurnoutCheckin } from "@shared/schema";
import { startOfTodayMs, bandFor, formatTime } from "@/lib/burnout-utils";
import { apiRequest } from "@/lib/queryClient";
import { generateWaveMessage } from "@/lib/wave-message";
import {
  useViewingDate,
  humanLabel,
  startOfDayMs,
  endOfDayMs,
} from "@/lib/viewing-date";

// Palette (kept inline; matches FoundationCard tokens).
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

// Bands, top to bottom
const BANDS = [
  { key: "restored", label: "Restored", tint: "rgba(143, 160, 90, 0.09)", accent: COLORS.moss },
  { key: "steady", label: "Steady", tint: "rgba(122, 155, 126, 0.09)", accent: COLORS.sage },
  { key: "stretched", label: "Stretched", tint: "rgba(217, 165, 94, 0.10)", accent: COLORS.amber },
  { key: "overloaded", label: "Overloaded", tint: "rgba(216, 155, 122, 0.12)", accent: COLORS.terracotta },
] as const;

// Map intensity 1..5 to y coordinate on 130-tall viewbox.
function yFor(intensity: number, height = 130): number {
  const clamped = Math.max(1, Math.min(5, intensity));
  return 12 + ((clamped - 1) / 4) * (height - 24);
}

function dotColorFor(intensity: number): string {
  if (intensity < 2) return COLORS.moss;
  if (intensity < 3) return COLORS.sage;
  if (intensity < 4) return COLORS.amber;
  return COLORS.terracotta;
}

function xFor(ms: number, width = 1000): number {
  const d = new Date(ms);
  const hour = d.getHours() + d.getMinutes() / 60;
  const start = 6;
  const end = 24;
  const clamped = Math.max(start, Math.min(end, hour));
  const pct = (clamped - start) / (end - start);
  return 60 + pct * (width - 120);
}

interface Point {
  x: number;
  y: number;
  color: string;
  time: number;
  intensity: number;
  state: string | null;
  note: string | null;
}

function curvedPath(points: Point[]): string {
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
}

// Semantic accent color for the current band label chip
function chipColorsFor(intensity: number): { bg: string; text: string; dot: string } {
  if (intensity < 2) return { bg: COLORS.mossSoft, text: "#4A5A2A", dot: COLORS.moss };
  if (intensity < 3) return { bg: COLORS.sageSoft, text: "#3F5A44", dot: COLORS.sage };
  if (intensity < 4) return { bg: COLORS.amberSoft, text: "#7A521A", dot: COLORS.amber };
  return { bg: COLORS.terracottaSoft, text: "#8A3E22", dot: COLORS.terracotta };
}

export function BurnoutWave() {
  const { date, isToday } = useViewingDate();
  const since = isToday ? startOfTodayMs() : startOfDayMs(date);
  const until = isToday ? Date.now() : endOfDayMs(date);

  const burnout = useQuery<BurnoutCheckin[]>({
    queryKey: ["/api/burnout", "wave", date],
    queryFn: async () => {
      // Fetch the day's window. For historic days, filter by both since AND
      // an upper bound so we don't pull the whole future.
      const res = await apiRequest("GET", `/api/burnout?since=${since}`);
      const all = (await res.json()) as BurnoutCheckin[];
      return all.filter((c) => c.createdAt >= since && c.createdAt <= until);
    },
  });

  const checkins = burnout.data ?? [];
  const hasCheckins = checkins.length > 0;
  const latest = hasCheckins ? checkins[checkins.length - 1] : null;
  const latestBand = latest ? bandFor(latest.intensity) : null;
  const chip = latest ? chipColorsFor(latest.intensity) : null;
  const message = generateWaveMessage(checkins);

  const points: Point[] = checkins.map((c) => ({
    x: xFor(c.createdAt),
    y: yFor(c.intensity),
    color: dotColorFor(c.intensity),
    time: c.createdAt,
    intensity: c.intensity,
    state: c.state,
    note: c.note,
  }));

  const path = curvedPath(points);
  const areaPath = (() => {
    if (points.length < 2) return "";
    return `${path} L ${points[points.length - 1].x},130 L ${points[0].x},130 Z`;
  })();

  return (
    <Card data-testid="card-burnout-wave" className="overflow-hidden">
      <div
        className="px-6 pt-5 pb-5"
        style={{
          background: "linear-gradient(180deg, #FEFCF7 0%, #F4EEE1 100%)",
        }}
      >
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.14em] font-semibold flex items-center gap-2"
              style={{ color: COLORS.inkSoft }}
            >
              <Waves className="h-3.5 w-3.5" strokeWidth={2} />
              {isToday ? "Your Wave" : `Your Wave, ${humanLabel(date).toLowerCase()}`}
              <InfoTip label="your wave" testId="info-wave">
                <p>{EXPLAIN.wave}</p>
              </InfoTip>
            </p>
            <p
              className="font-serif italic text-sm mt-1"
              style={{ color: COLORS.inkMute }}
            >
              How the day has shifted, check-in by check-in.
            </p>
          </div>
          {latestBand && chip && (
            <span
              className="text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-2"
              style={{ background: chip.bg, color: chip.text }}
              data-testid="text-current-band"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: chip.dot }}
              />
              Currently: {latestBand.label}
            </span>
          )}
        </div>

        {burnout.isLoading ? (
          <Skeleton className="h-[160px] w-full rounded-lg" />
        ) : !hasCheckins ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
            <div>
              <p
                className="text-[10px] uppercase tracking-[0.14em] font-bold mb-1"
                style={{ color: COLORS.inkSoft }}
              >
                {message.eyebrow}
              </p>
              <p
                className="font-serif text-[15px] leading-relaxed max-w-2xl"
                style={{ color: COLORS.inkDeep }}
              >
                {message.body}
              </p>
            </div>
            <Link href="/burnout">
              <Button data-testid="button-do-checkin-wave" className="shrink-0">
                Do a 5-min check-in
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="relative h-[160px] mt-2 rounded-md overflow-hidden">
              {/* Colored band backgrounds with in-band labels */}
              <div className="absolute inset-0 flex flex-col pointer-events-none">
                {BANDS.map((band) => (
                  <div
                    key={band.key}
                    className="flex-1 flex items-center px-3 border-b last:border-b-0"
                    style={{
                      background: band.tint,
                      borderColor: COLORS.lineSoft,
                    }}
                  >
                    <span
                      className="font-serif italic text-[12px] font-semibold"
                      style={{ color: band.accent }}
                    >
                      {band.label}
                    </span>
                  </div>
                ))}
              </div>

              <svg
                viewBox="0 0 1000 130"
                preserveAspectRatio="none"
                className="w-full h-full block relative"
                style={{ minHeight: 160 }}
              >
                {/* Area under the curve */}
                {points.length >= 2 && (
                  <>
                    <defs>
                      <linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.sage} />
                        <stop offset="100%" stopColor={COLORS.terracotta} />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#waveFill)" opacity="0.18" />
                  </>
                )}

                {/* The curve */}
                {points.length >= 2 && (
                  <path
                    d={path}
                    fill="none"
                    stroke={COLORS.sage}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Historic dots (with a white ring for contrast) */}
                {points.slice(0, -1).map((p) => (
                  <g key={p.time}>
                    <circle cx={p.x} cy={p.y} r="8" fill="#FFFFFF" />
                    <circle cx={p.x} cy={p.y} r="6" fill={p.color}>
                      <title>{`${formatTime(p.time)} · ${p.state ?? "no state"}${p.note ? " · " + p.note : ""}`}</title>
                    </circle>
                  </g>
                ))}

                {/* Current dot: white ring + soft outer ring + solid inner */}
                {points.length > 0 && (() => {
                  const p = points[points.length - 1];
                  return (
                    <g>
                      <circle cx={p.x} cy={p.y} r="12" fill={p.color} opacity="0.22" />
                      <circle cx={p.x} cy={p.y} r="9" fill="#FFFFFF" />
                      <circle cx={p.x} cy={p.y} r="7" fill={p.color}>
                        <title>{`${formatTime(p.time)} · ${p.state ?? "no state"} (current)`}</title>
                      </circle>
                    </g>
                  );
                })()}
              </svg>
            </div>

            {/* X-axis time markers */}
            <div
              className="flex justify-between text-[11px] font-semibold mt-2 px-1"
              style={{ color: COLORS.inkSoft }}
            >
              <span>6 AM</span>
              <span>9 AM</span>
              <span>12 PM</span>
              <span>3 PM</span>
              <span>6 PM</span>
              <span>9 PM</span>
              <span>12 AM</span>
            </div>

            {/* Regulation message */}
            <div
              className="mt-4 p-4 rounded-lg"
              style={{
                background: "rgba(255,255,255,0.55)",
                border: `1px solid ${COLORS.lineSoft}`,
              }}
            >
              <p
                className="text-[10px] uppercase tracking-[0.14em] font-bold mb-1.5"
                style={{
                  color:
                    message.kind === "improving"
                      ? "#4A5A2A"
                      : message.kind === "persistent_overload"
                      ? "#8A3E22"
                      : message.kind === "degrading"
                      ? "#7A521A"
                      : COLORS.inkSoft,
                }}
              >
                {message.eyebrow}
              </p>
              <p
                className="font-serif text-[15px] leading-relaxed"
                style={{ color: COLORS.inkDeep }}
              >
                {message.body}
              </p>
            </div>

            <div className="flex items-center justify-between mt-3">
              <span
                className="text-xs font-medium"
                style={{ color: COLORS.inkMute }}
              >
                {checkins.length}{" "}
                {checkins.length === 1 ? "check-in" : "check-ins"} today
              </span>
              <Link href="/burnout">
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-do-another-checkin"
                >
                  Do another check-in
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

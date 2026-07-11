// The Burnout Wave.
// A ribbon at the top of Today that shows every check-in the user has
// logged so far today, positioned by time on the x-axis and by state
// intensity on the y-axis. The line curves between dots to reveal the
// arc of the day. Current check-in gets a soft pulsing ring.
//
// Falls back to a warm empty state when there are no check-ins yet.

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Waves } from "lucide-react";
import type { BurnoutCheckin } from "@shared/schema";
import { startOfTodayMs, bandFor, formatTime } from "@/lib/burnout-utils";
import { apiRequest } from "@/lib/queryClient";

// Palette (also used in the FoundationCard). Kept inline to avoid
// touching global Tailwind config in this session.
const COLORS = {
  moss: "#8FA05A",
  sage: "#7A9B7E",
  amber: "#D9A55E",
  terracotta: "#D89B7A",
  ink: "#2A2620",
  inkSoft: "#58524A",
  inkMute: "#8A8378",
  line: "#E5DDCC",
  bandLine: "#E5DDCC",
};

// Map an intensity value (1..5) to a y coordinate in the 130-tall viewbox.
// intensity 1 (restored)  -> y ~ 12
// intensity 5 (overloaded)-> y ~ 118
function yFor(intensity: number, height = 130): number {
  const clamped = Math.max(1, Math.min(5, intensity));
  return 12 + ((clamped - 1) / 4) * (height - 24);
}

// Dot color by band
function dotColorFor(intensity: number): string {
  if (intensity < 2) return COLORS.moss;
  if (intensity < 3) return COLORS.sage;
  if (intensity < 4) return COLORS.amber;
  return COLORS.terracotta;
}

// Time of day -> x coordinate. Anchors at 6am (x=60) through midnight (x=940).
function xFor(ms: number, width = 1000): number {
  const d = new Date(ms);
  const hour = d.getHours() + d.getMinutes() / 60;
  // Compress into visible span 6am..midnight
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

// Curved path (Catmull-Rom to Bezier approximation) for smooth line.
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

export function BurnoutWave() {
  const todayStart = startOfTodayMs();
  const burnout = useQuery<BurnoutCheckin[]>({
    queryKey: ["/api/burnout", "today"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/burnout?since=${todayStart}`);
      return res.json();
    },
  });

  const checkins = burnout.data ?? [];
  const hasCheckins = checkins.length > 0;
  const latest = hasCheckins ? checkins[checkins.length - 1] : null;
  const latestBand = latest ? bandFor(latest.intensity) : null;

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

  // Area path for the gentle fill under the curve
  const areaPath = (() => {
    if (points.length < 2) return "";
    return `${path} L ${points[points.length - 1].x},130 L ${points[0].x},130 Z`;
  })();

  return (
    <Card data-testid="card-burnout-wave" className="overflow-hidden">
      <div
        className="px-6 pt-5 pb-4"
        style={{
          background: "linear-gradient(180deg, #FEFCF7 0%, #F4EEE1 100%)",
        }}
      >
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.14em] font-medium flex items-center gap-2"
              style={{ color: COLORS.inkMute }}
            >
              <Waves className="h-3.5 w-3.5" strokeWidth={1.5} />
              Today's Burnout Wave
            </p>
            <p
              className="font-serif italic text-sm mt-1"
              style={{ color: COLORS.inkSoft }}
            >
              How the day has shifted, check-in by check-in.
            </p>
          </div>
          {latestBand && (
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-2"
              style={{
                background: "white",
                color: latestBand.key === "overloaded" ? "#A5583A"
                  : latestBand.key === "stretched" ? "#8A5A1F"
                  : latestBand.key === "steady" ? "#4E6E52"
                  : "#566A2E",
              }}
              data-testid="text-current-band"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: dotColorFor(latest!.intensity) }}
              />
              Currently: {latestBand.label}
            </span>
          )}
        </div>

        {burnout.isLoading ? (
          <Skeleton className="h-[130px] w-full rounded-lg" />
        ) : !hasCheckins ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4">
            <p
              className="font-serif italic"
              style={{ color: COLORS.inkSoft }}
            >
              You haven't paused yet today. When you do, the wave will start to draw itself.
            </p>
            <Link href="/burnout">
              <Button data-testid="button-do-checkin-wave">
                Do a 5-min check-in
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="relative h-[140px] mt-2">
              {/* Band labels behind the SVG */}
              <div className="absolute inset-0 flex flex-col pointer-events-none">
                {["Restored", "Steady", "Stretched", "Overloaded"].map((label) => (
                  <div
                    key={label}
                    className="flex-1 flex items-center px-2"
                  >
                    <span
                      className="font-serif italic text-[10px]"
                      style={{ color: "rgba(88, 82, 74, 0.4)" }}
                    >
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <svg
                viewBox="0 0 1000 130"
                preserveAspectRatio="none"
                className="w-full h-full block relative"
              >
                {/* Dashed band separators */}
                <line x1="0" y1="32.5" x2="1000" y2="32.5" stroke={COLORS.bandLine} strokeDasharray="2,4" />
                <line x1="0" y1="65" x2="1000" y2="65" stroke={COLORS.bandLine} strokeDasharray="2,4" />
                <line x1="0" y1="97.5" x2="1000" y2="97.5" stroke={COLORS.bandLine} strokeDasharray="2,4" />

                {/* Area under the curve */}
                {points.length >= 2 && (
                  <>
                    <defs>
                      <linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.sage} />
                        <stop offset="100%" stopColor={COLORS.terracotta} />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#waveFill)" opacity="0.15" />
                  </>
                )}

                {/* The curve */}
                {points.length >= 2 && (
                  <path
                    d={path}
                    fill="none"
                    stroke={COLORS.sage}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                )}

                {/* Dots (all except the last) */}
                {points.slice(0, -1).map((p) => (
                  <g key={p.time}>
                    <circle cx={p.x} cy={p.y} r="6" fill={p.color}>
                      <title>{`${formatTime(p.time)} · ${p.state ?? "no state"}${p.note ? " · " + p.note : ""}`}</title>
                    </circle>
                  </g>
                ))}

                {/* Current dot: larger with a soft ring */}
                {points.length > 0 && (() => {
                  const p = points[points.length - 1];
                  return (
                    <g>
                      <circle cx={p.x} cy={p.y} r="10" fill={p.color} opacity="0.25">
                        <title>{`${formatTime(p.time)} · ${p.state ?? "no state"} (current)`}</title>
                      </circle>
                      <circle cx={p.x} cy={p.y} r="7" fill={p.color} />
                    </g>
                  );
                })()}
              </svg>
            </div>

            {/* X-axis time markers */}
            <div
              className="flex justify-between text-[10px] font-medium mt-1"
              style={{ color: COLORS.inkMute }}
            >
              <span>6 AM</span>
              <span>9 AM</span>
              <span>12 PM</span>
              <span>3 PM</span>
              <span>6 PM</span>
              <span>9 PM</span>
              <span>12 AM</span>
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">
                {checkins.length} {checkins.length === 1 ? "check-in" : "check-ins"} today
              </span>
              <Link href="/burnout">
                <Button variant="outline" size="sm" data-testid="button-do-another-checkin">
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

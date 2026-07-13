import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Heart,
  ArrowRight,
} from "lucide-react";
import type {
  DelegationTask,
  ChecklistRun,
  CompassionEntry,
} from "@shared/schema";
import { DAILY_THOUGHTS } from "@/lib/quiet-hours-data";
import { FoundationCard } from "@/components/foundation-card";
import { BurnoutWave } from "@/components/burnout-wave";
import { SpoonMeter } from "@/components/spoon-meter";
import { PhaseSuggestionBanner } from "@/components/phase-suggestion";
import { DayNavigator, ViewingHistoryRibbon } from "@/components/day-navigator";
import { ViewingDateProvider, useViewingDate } from "@/lib/viewing-date";

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

// ---------- Streak nudges ----------
type Streaks = Record<string, { streak: number; endedYesterday: boolean }>;

interface Nudge {
  eyebrow: string;
  headline: string;
  body: string;
}

// Priority: numbing > drifting > chasing > frozen.
// We look for 3+ consecutive days including today, OR a streak of 3+ that
// just ended yesterday (worth noticing too).
function pickNudge(s: Streaks | undefined): Nudge | null {
  if (!s) return null;
  const priority = ["numbing", "drifting", "chasing", "frozen"] as const;
  for (const st of priority) {
    const info = s[st];
    if (!info || info.streak < 3) continue;
    const days = info.streak;
    const suffix = info.endedYesterday
      ? `for ${days} days in a row, ending yesterday.`
      : `for ${days} days in a row, including today.`;
    if (st === "numbing") {
      return {
        eyebrow: "A pattern worth noticing",
        headline: `You've logged Numbing ${suffix}`,
        body:
          "Not a verdict \u2014 just information. Numbing is what a tired nervous system reaches for when there's something underneath it doesn't want to feel yet. If you can, name what the something might be. You don't have to fix it. Just naming it changes the pull.",
      };
    }
    if (st === "drifting") {
      return {
        eyebrow: "A pattern worth noticing",
        headline: `You've logged Drifting ${suffix}`,
        body:
          "Something has been consistently pulling you off-course. It might help to look at the \u201cWhat kept pulling you\u201d chips on the Burnout page and pick just one to make a little less available tomorrow \u2014 close a tab, move an app off the home screen, one small thing.",
      };
    }
    if (st === "chasing") {
      return {
        eyebrow: "A pattern worth noticing",
        headline: `You've logged Chasing ${suffix}`,
        body:
          "A racing pattern like this often means the day's real priority isn't visible enough. Tomorrow, before anything else, try writing the one real thing on paper \u2014 not in an app \u2014 and doing only that for the first 30 minutes.",
      };
    }
    if (st === "frozen") {
      return {
        eyebrow: "A pattern worth noticing",
        headline: `You've logged Frozen ${suffix}`,
        body:
          "When freeze shows up repeatedly, it usually means the task is too big or the cost of doing it wrong feels too high. Look at your pulls on the Burnout page \u2014 the task behind the freeze is often hiding in there. Shrinking it, not pushing through it, is the move.",
      };
    }
  }
  return null;
}

// ---------- Cross-link card (like the original) ----------
function CrossCard({
  href,
  icon: Icon,
  eyebrow,
  title,
  body,
  status,
  loading,
  testid,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  eyebrow: string;
  title: string;
  body: string;
  status: string;
  loading?: boolean;
  testid: string;
}) {
  return (
    <Link href={href}>
      <Card
        className="h-full cursor-pointer hover-elevate"
        data-testid={testid}
      >
        <CardContent className="flex h-full flex-col gap-3 p-6">
          <Icon
            className="h-5 w-5 text-muted-foreground"
            strokeWidth={1.5}
          />
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {eyebrow}
            </p>
            <p className="mt-2 font-serif text-lg font-medium text-foreground">
              {title}
            </p>
          </div>
          <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>
          {loading ? (
            <Skeleton className="h-3 w-24" />
          ) : (
            <p className="text-xs text-muted-foreground">{status}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Today() {
  const delegation = useQuery<DelegationTask[]>({
    queryKey: ["/api/delegation"],
  });
  const checklists = useQuery<ChecklistRun[]>({
    queryKey: ["/api/checklists"],
  });
  const compassion = useQuery<CompassionEntry[]>({
    queryKey: ["/api/compassion"],
  });
  const streaks = useQuery<Streaks>({
    queryKey: ["/api/burnout/streaks"],
  });

  const openTasks =
    delegation.data?.filter((t) => !t.completed).length ?? 0;
  const activeRuns =
    checklists.data?.filter((c) => !c.shipped).length ?? 0;
  const scriptCount = 8; // static reframes library size
  const compassionCount = compassion.data?.length ?? 0;

  const thought = DAILY_THOUGHTS[dayOfYear() % DAILY_THOUGHTS.length];

  // Gentle nudge: pick the strongest non-grounded streak (≥ 3 days).
  // Numbing is prioritized because it maps most directly to the
  // activation-addiction pattern; then drifting, chasing, frozen.
  const nudge = pickNudge(streaks.data);

  return (
    <ViewingDateProvider>
      <TodayInner
        nudge={nudge}
        thought={thought}
        openTasks={openTasks}
        activeRuns={activeRuns}
        scriptCount={scriptCount}
        compassionCount={compassionCount}
      />
    </ViewingDateProvider>
  );
}

interface TodayInnerProps {
  nudge: Nudge | null;
  thought: string;
  openTasks: number;
  activeRuns: number;
  scriptCount: number;
  compassionCount: number;
}

function TodayInner({ nudge, thought, openTasks, activeRuns, scriptCount, compassionCount }: TodayInnerProps) {
  const { isToday } = useViewingDate();

  return (
    <div className="space-y-12">
      {/* ---------- Day navigator (previous / next / back to today) ---------- */}
      <DayNavigator />

      {/* ---------- Viewing-history ribbon (only visible off-today) ---------- */}
      <ViewingHistoryRibbon />

      {/* ---------- Header (today only) ---------- */}
      {isToday && (
        <header className="space-y-4">
          <h1
            className="font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            data-testid="text-hero-title"
          >
            Begin the day a little gentler than yesterday.
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
            This is a workplace toolkit for the parts of you that try to do
            everything, do it perfectly, and do it personally. Today, you only
            need to do this: notice the urge, name it, and choose differently,
            once.
          </p>
        </header>
      )}

      {/* ---------- Spoon meter (persistent, date-aware) ---------- */}
      <SpoonMeter />

      {/* ---------- Phase-shift suggestion (today only) ---------- */}
      {isToday && <PhaseSuggestionBanner />}

      {/* ---------- Burnout Wave (date-aware) ---------- */}
      <BurnoutWave />

      {/* ---------- Foundation (Bottom of the Pyramid, date-aware) ---------- */}
      <FoundationCard />

      {/* ---------- Everything below only shows on today ---------- */}
      {isToday && (
        <>
      {/* ---------- Four cross-link cards ---------- */}
      <div className="grid gap-4 md:grid-cols-2">
        <CrossCard
          href="/delegation"
          icon={LayoutGrid}
          eyebrow="The day's tasks"
          title="Sort what's in front of you"
          body="Place each task on the urgency × importance grid. Decide who really needs to do it."
          status={
            openTasks === 0
              ? "no tasks logged yet"
              : `${openTasks} open ${openTasks === 1 ? "task" : "tasks"}`
          }
          loading={delegation.isLoading}
          testid="link-cross-delegation"
        />
        <CrossCard
          href="/good-enough"
          icon={ListChecks}
          eyebrow="Stop the recursion"
          title="Set a 'good enough' bar"
          body="Define done before you start. So that perfectionism has nothing to push against."
          status={
            activeRuns === 0
              ? "6 templates ready"
              : `${activeRuns} in progress · 6 templates ready`
          }
          loading={checklists.isLoading}
          testid="link-cross-good-enough"
        />
        <CrossCard
          href="/reframes"
          icon={MessageSquare}
          eyebrow="When the inner critic shows up"
          title="Find the script you need"
          body="Pre-written lines for: being asked to take on more, watching someone work differently, mistakes, rumination."
          status={`${scriptCount} scripts in library`}
          testid="link-cross-reframes"
        />
        <CrossCard
          href="/compassion"
          icon={Heart}
          eyebrow="After it happened"
          title="Log a moment of softening"
          body="Track when something went a way you wouldn't have chosen — and how you spoke to yourself about it."
          status={
            compassionCount === 0
              ? "no entries yet"
              : `${compassionCount} ${compassionCount === 1 ? "entry" : "entries"} logged`
          }
          loading={compassion.isLoading}
          testid="link-cross-compassion"
        />
      </div>

      {/* ---------- Gentle nudge (streaks) ---------- */}
      {nudge && (
        <Card
          className="border-l-2 border-l-primary"
          data-testid="card-streak-nudge"
        >
          <CardContent className="space-y-2 p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {nudge.eyebrow}
            </p>
            <p className="font-serif text-base text-foreground">
              {nudge.headline}
            </p>
            <p className="font-serif text-sm italic text-muted-foreground">
              {nudge.body}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ---------- One thought for today ---------- */}
      <section className="space-y-3" data-testid="section-daily-thought">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          One thought for today
        </p>
        <Card className="border-card-border">
          <CardContent className="space-y-4 p-6 sm:p-8">
            <span className="inline-block rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {thought.category}
            </span>
            <p className="font-serif text-base italic leading-relaxed text-muted-foreground">
              {thought.setup}
            </p>
            <p
              className="font-serif text-lg leading-relaxed text-foreground"
              data-testid="text-daily-thought"
            >
              {thought.thought}
            </p>
            <Link href="/reframes">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3"
                data-testid="link-more-like-this"
              >
                More like this <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>
        </>
      )}
    </div>
  );
}

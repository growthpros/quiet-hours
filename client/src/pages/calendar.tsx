// Calendar: the week laid out day by day, plus the tasks that still need
// a day. Phase 1 of the beta plan (week view). Month view and dragging
// between days come next.

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MoveTaskMenu } from "@/components/move-task-menu";
import { listTasks, type TaskRow } from "@/lib/tasks-data";
import { listRecurringTemplates, type RecurringTemplateRow } from "@/lib/recurring-data";
import { localIsoDate } from "@/lib/local-date";
import { useWeekStart } from "@/lib/use-week-start";
import {
  groupWeek,
  UNSCHEDULED_LABEL,
  type CalendarDay,
  type DayItem,
} from "@/lib/calendar-week";

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function weekLabel(start: string, end: string): string {
  const a = parts(start);
  const b = parts(end);
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
  return a.getMonth() === b.getMonth()
    ? `${month(a)} ${a.getDate()} to ${b.getDate()}`
    : `${month(a)} ${a.getDate()} to ${month(b)} ${b.getDate()}`;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "");
}

function daySummary(d: CalendarDay): string {
  if (d.openCount === 0) return d.isPast ? "" : "Nothing planned";
  const parts = [`${d.openCount} ${d.openCount === 1 ? "task" : "tasks"}`];
  if (d.openSpoons > 0) parts.push(`${fmt(d.openSpoons)} spoons`);
  return parts.join(", ");
}

export default function Calendar() {
  const today = localIsoDate();
  const weekStartsOn = useWeekStart();
  const [weeksAhead, setWeeksAhead] = useState(0);

  const tasksQ = useQuery<TaskRow[]>({ queryKey: ["tasks"], queryFn: listTasks });
  const templatesQ = useQuery<RecurringTemplateRow[]>({
    queryKey: ["recurring-templates"],
    queryFn: listRecurringTemplates,
  });
  const templatesById = useMemo(() => {
    const map = new Map<number, RecurringTemplateRow>();
    for (const t of templatesQ.data ?? []) map.set(t.id, t);
    return map;
  }, [templatesQ.data]);

  const week = useMemo(
    () => groupWeek(tasksQ.data ?? [], today, weekStartsOn, weeksAhead, templatesQ.data ?? []),
    [tasksQ.data, templatesQ.data, today, weekStartsOn, weeksAhead],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" subtitle="Your week, one day at a time.">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setWeeksAhead((w) => w - 1)}
          aria-label="Previous week"
          data-testid="button-week-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[8.5rem] text-center text-sm text-foreground" data-testid="text-week-label">
          {weekLabel(week.start, week.end)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setWeeksAhead((w) => w + 1)}
          aria-label="Next week"
          data-testid="button-week-next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {weeksAhead !== 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setWeeksAhead(0)}
            data-testid="button-week-this"
          >
            This week
          </Button>
        )}
      </PageHeader>

      {tasksQ.isLoading ? (
        <p className="font-serif text-sm italic text-muted-foreground">Loading your week…</p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-7" data-testid="calendar-week">
            {week.days.map((d) => (
              <DayColumn key={d.iso} day={d} templatesById={templatesById} />
            ))}
          </div>

          <section className="space-y-3" data-testid="calendar-unscheduled">
            <h2 className="font-serif text-base text-foreground">Not scheduled yet</h2>
            {week.unscheduled.length === 0 ? (
              <p className="font-serif text-sm italic text-muted-foreground">
                Everything has a day. Tasks you give a timeframe without a day will wait here.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {week.unscheduled.map((g) => (
                  <Card key={g.group}>
                    <CardContent className="space-y-2 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {UNSCHEDULED_LABEL[g.group]}
                      </p>
                      {g.tasks.map((t) => (
                        <ItemRow
                          key={t.id}
                          item={{ task: t, status: "open" }}
                          template={null}
                        />
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function DayColumn({
  day,
  templatesById,
}: {
  day: CalendarDay;
  templatesById: Map<number, RecurringTemplateRow>;
}) {
  const date = parts(day.iso);
  return (
    <div
      className={`rounded-md border p-3 md:p-2 ${
        day.isToday ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      } ${day.isPast ? "opacity-80" : ""}`}
      data-testid={`calendar-day-${day.iso}`}
    >
      <Link
        href={`/tasks?date=${day.iso}`}
        className="block hover:underline"
        data-testid={`link-day-${day.iso}`}
      >
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {date.toLocaleDateString(undefined, { weekday: "short" })}
          {day.isToday && " · Today"}
        </p>
        <p className="font-serif text-lg text-foreground">{date.getDate()}</p>
      </Link>
      <p className="mb-2 min-h-[1rem] text-xs italic text-muted-foreground">{daySummary(day)}</p>
      <div className="space-y-1.5">
        {day.items.map((item) => (
          <ItemRow
            key={item.task.id}
            item={item}
            template={
              item.task.recurring_template_id
                ? templatesById.get(item.task.recurring_template_id) ?? null
                : null
            }
          />
        ))}
        {day.upcoming.map((t) => (
          <div
            key={`upcoming-${t.id}`}
            className="rounded border border-dashed border-border px-1.5 py-1"
            title="This repeat becomes a task on the day."
            data-testid={`calendar-upcoming-${t.id}-${day.iso}`}
          >
            <div className="min-w-0">
              <p className="break-words text-xs leading-snug text-foreground/80">
                <RepeatMark />
                {t.title}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {[
                  t.spoon_estimate ? `${fmt(Number(t.spoon_estimate))} spoon${Number(t.spoon_estimate) === 1 ? "" : "s"}` : null,
                  "coming up",
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemRow({ item, template }: { item: DayItem; template: RecurringTemplateRow | null }) {
  const { task, status } = item;
  const spoons = task.spoon_estimate != null ? Number(task.spoon_estimate) : null;
  return (
    <div
      className="flex items-start gap-0.5 rounded border border-border/60 bg-background px-1.5 py-1"
      data-testid={`calendar-task-${task.id}`}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`break-words text-xs leading-snug ${
            status === "done"
              ? "text-muted-foreground line-through decoration-muted-foreground/40"
              : status === "missed"
                ? "italic text-muted-foreground"
                : "text-foreground"
          }`}
        >
          {task.recurring_template_id != null && <RepeatMark />}
          {task.title}
        </p>
        {(spoons != null || status === "missed") && (
          <p className="text-[11px] text-muted-foreground">
            {[spoons != null ? `${fmt(spoons)} spoon${spoons === 1 ? "" : "s"}` : null, status === "missed" ? "missed" : null]
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
      </div>
      {status !== "done" && (
        // A smaller Move button so it fits beside the title in a narrow day.
        <div className="-mr-1 -mt-0.5 shrink-0 [&_button]:h-6 [&_button]:w-6 [&_svg]:h-3.5 [&_svg]:w-3.5">
          <MoveTaskMenu task={task} template={template} />
        </div>
      )}
    </div>
  );
}

// The repeat icon sits inline with the title, so long titles wrap under it
// instead of leaving an empty column.
function RepeatMark() {
  return (
    <Repeat
      className="mr-1 inline h-3 w-3 align-[-2px] text-muted-foreground"
      aria-label="Repeats"
    />
  );
}

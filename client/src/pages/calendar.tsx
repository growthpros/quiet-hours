// Calendar: the week laid out day by day, or the whole month, plus the
// tasks that still need a day. Tasks can be dragged between days; dragging
// follows the same rules as the Move menu (lib/task-move.ts).

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
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
import { canDropOn, dropRange, isoAddDays, whenForDate, type DropRange } from "@/lib/task-move";
import { useTaskMover } from "@/hooks/use-task-mover";
import { clearAddressQuery, parseDateParam } from "@/lib/date-param";
import { useWeekStart } from "@/lib/use-week-start";
import {
  addMonths,
  groupMonth,
  groupWeek,
  weeksAheadFor,
  UNSCHEDULED_LABEL,
  type CalendarDay,
  type CalendarMonth,
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

function dayLabel(iso: string): string {
  return parts(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
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

type View = "week" | "month";

interface ActiveDrag {
  task: TaskRow;
  range: DropRange | null;
}

// What dragging shares with each day and task on the page.
interface DragState {
  active: ActiveDrag | null;
  templatesById: Map<number, RecurringTemplateRow>;
}

export default function Calendar() {
  const today = localIsoDate();
  const weekStartsOn = useWeekStart();
  // The week or month shown is the one holding this date. The Tasks page
  // can open the Calendar on a given week with ?week=YYYY-MM-DD.
  const [anchor, setAnchor] = useState<string>(
    () => parseDateParam(window.location.search, window.location.hash, "week") ?? today,
  );
  const [view, setView] = useState<View>("week");
  useEffect(() => clearAddressQuery(), []);
  const weeksAhead = weeksAheadFor(today, anchor, weekStartsOn);
  const inThisMonth = anchor.slice(0, 7) === today.slice(0, 7);

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
  const month = useMemo(
    () =>
      view === "month"
        ? groupMonth(tasksQ.data ?? [], today, anchor, weekStartsOn, templatesQ.data ?? [])
        : null,
    [view, tasksQ.data, templatesQ.data, today, anchor, weekStartsOn],
  );

  // ---------- Dragging ----------
  const { moveTo } = useTaskMover();
  const [active, setActive] = useState<ActiveDrag | null>(null);
  // A drop can be followed by a click on the day underneath; ignore it so a
  // drop in the month view doesn't also open that week.
  const lastDropAt = useRef(0);
  const sensors = useSensors(
    // A small movement before a mouse drag starts, so clicks still work.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // On a phone, press and hold, so the page still scrolls normally.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const templateFor = (t: TaskRow) =>
    t.recurring_template_id != null ? templatesById.get(t.recurring_template_id) ?? null : null;

  const onDragStart = (e: DragStartEvent) => {
    const task = e.active.data.current?.task as TaskRow | undefined;
    if (task) setActive({ task, range: dropRange(task, templateFor(task), today) });
  };
  const onDragEnd = (e: DragEndEvent) => {
    lastDropAt.current = Date.now();
    const drag = active;
    setActive(null);
    const iso = e.over?.data.current?.iso as string | undefined;
    if (!drag || !iso || !canDropOn(drag.range, iso)) return;
    // Already on that day: nothing to do.
    if (drag.task.due_date === iso && drag.task.due_bucket == null) return;
    moveTo(drag.task, whenForDate(iso));
  };

  const announcements: Announcements = {
    onDragStart: ({ active: a }) =>
      `Picked up ${(a.data.current?.task as TaskRow | undefined)?.title ?? "task"}.`,
    onDragOver: ({ over }) =>
      over?.data.current?.iso ? `Over ${dayLabel(over.data.current.iso as string)}.` : "Not over a day.",
    onDragEnd: ({ over }) =>
      over?.data.current?.iso ? `Dropped on ${dayLabel(over.data.current.iso as string)}.` : "Put back.",
    onDragCancel: () => "Put back.",
  };

  const drag: DragState = { active, templatesById };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        subtitle={view === "week" ? "Your week, one day at a time." : "Your month at a glance."}
      >
        <div className="mr-2 flex items-center gap-1 rounded-md border border-border p-1" role="group" aria-label="Calendar view">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded px-3 py-1 text-xs uppercase tracking-[0.14em] transition ${
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
              data-testid={`button-view-${v}`}
            >
              {v === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setAnchor((a) => (view === "week" ? isoAddDays(a, -7) : addMonths(a, -1)))}
          aria-label={view === "week" ? "Previous week" : "Previous month"}
          data-testid="button-week-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[7rem] text-center text-sm text-foreground md:min-w-[8.5rem]" data-testid="text-week-label">
          {view === "week"
            ? weekLabel(week.start, week.end)
            : parts(anchor).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setAnchor((a) => (view === "week" ? isoAddDays(a, 7) : addMonths(a, 1)))}
          aria-label={view === "week" ? "Next week" : "Next month"}
          data-testid="button-week-next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {(view === "week" ? weeksAhead !== 0 : !inThisMonth) && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAnchor(today)}
            data-testid="button-week-this"
          >
            {view === "week" ? "This week" : "This month"}
          </Button>
        )}
        </div>
      </PageHeader>

      {tasksQ.isLoading ? (
        <p className="font-serif text-sm italic text-muted-foreground">Loading your calendar…</p>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActive(null)}
          accessibility={{ announcements }}
        >
          {view === "week" ? (
            <div className="grid gap-3 md:grid-cols-7" data-testid="calendar-week">
              {week.days.map((d) => (
                <DayColumn key={d.iso} day={d} drag={drag} />
              ))}
            </div>
          ) : (
            month && (
              <MonthGrid
                month={month}
                drag={drag}
                onOpenWeek={(iso) => {
                  if (Date.now() - lastDropAt.current < 300) return;
                  setAnchor(iso);
                  setView("week");
                }}
              />
            )
          )}

          <section className="space-y-3" data-testid="calendar-unscheduled">
            <h2 className="font-serif text-base text-foreground">Not scheduled yet</h2>
            {week.unscheduled.length === 0 ? (
              <p className="font-serif text-sm italic text-muted-foreground">
                Everything has a day. Tasks you give a timeframe without a day will wait here.
              </p>
            ) : (
              <>
                <p className="text-xs italic text-muted-foreground">
                  Drag one onto a day to give it a date.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {week.unscheduled.map((g) => (
                    <Card key={g.group}>
                      <CardContent className="space-y-2 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                          {UNSCHEDULED_LABEL[g.group]}
                        </p>
                        {g.tasks.map((t) => (
                          <ItemRow key={t.id} item={{ task: t, status: "open" }} drag={drag} />
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </section>

          <DragOverlay dropAnimation={null}>
            {active ? (
              <div className="max-w-[14rem] rounded border border-primary/40 bg-background px-2 py-1 text-xs shadow-md">
                {active.task.recurring_template_id != null && <RepeatMark />}
                {active.task.title}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

// A day that accepts dropped tasks. While a task is being dragged, days it
// can't move to fade, and the day under it gets a soft outline.
function DropDay({
  iso,
  drag,
  className,
  children,
  testId,
  onClick,
}: {
  iso: string;
  drag: DragState;
  className: string;
  children: ReactNode;
  testId: string;
  onClick?: () => void;
}) {
  const allowed = drag.active ? canDropOn(drag.active.range, iso) : true;
  const { setNodeRef, isOver } = useDroppable({ id: `day-${iso}`, data: { iso }, disabled: !allowed });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`${className} transition-opacity ${drag.active && !allowed ? "opacity-35" : ""} ${
        isOver && allowed ? "ring-2 ring-primary/40" : ""
      }`}
      data-testid={testId}
      data-drop-allowed={drag.active ? String(allowed) : undefined}
    >
      {children}
    </div>
  );
}

// A task that can be picked up. Only unfinished tasks with somewhere to go
// can be dragged (a daily repeat, for example, has nowhere to move).
function useTaskDrag(task: TaskRow, drag: DragState, status: DayItem["status"]) {
  const template =
    task.recurring_template_id != null ? drag.templatesById.get(task.recurring_template_id) ?? null : null;
  const movable = status !== "done" && dropRange(task, template, localIsoDate()) != null;
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { task },
    disabled: !movable,
  });
  return {
    template,
    movable,
    isDragging,
    dragProps: movable
      ? {
          ref: setNodeRef,
          ...listeners,
          ...attributes,
          "aria-roledescription": "Task you can drag to another day",
          style: { touchAction: "manipulation" } as const,
        }
      : {},
  };
}

// Stops a press on the Move button from also starting a drag.
const stopDrag = {
  onMouseDown: (e: React.SyntheticEvent) => e.stopPropagation(),
  onTouchStart: (e: React.SyntheticEvent) => e.stopPropagation(),
  onKeyDown: (e: React.SyntheticEvent) => e.stopPropagation(),
};

function MonthGrid({
  month,
  drag,
  onOpenWeek,
}: {
  month: CalendarMonth;
  drag: DragState;
  onOpenWeek: (iso: string) => void;
}) {
  return (
    <div data-testid="calendar-month">
      <div className="grid grid-cols-7 gap-1 pb-1 md:gap-2">
        {month.weeks[0].map(({ day }) => (
          <p
            key={day.iso}
            className="text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground md:text-left md:text-xs"
          >
            {parts(day.iso).toLocaleDateString(undefined, { weekday: "short" })}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {month.weeks.flat().map(({ day, inMonth }) => (
          <MonthCell key={day.iso} day={day} inMonth={inMonth} drag={drag} onOpenWeek={onOpenWeek} />
        ))}
      </div>
    </div>
  );
}

function MonthCell({
  day,
  inMonth,
  drag,
  onOpenWeek,
}: {
  day: CalendarDay;
  inMonth: boolean;
  drag: DragState;
  onOpenWeek: (iso: string) => void;
}) {
  // Repeats count toward the day but don't fill the square with titles.
  const titled = day.items.filter((i) => i.task.recurring_template_id == null);
  const repeatCount =
    day.items.filter((i) => i.task.recurring_template_id != null && i.status !== "done").length +
    day.upcoming.length;
  const shown = titled.slice(0, 3);
  const more = titled.length - shown.length;
  return (
    <DropDay
      iso={day.iso}
      drag={drag}
      onClick={() => onOpenWeek(day.iso)}
      testId={`month-day-${day.iso}`}
      className={`min-h-[3.25rem] min-w-0 cursor-pointer overflow-hidden rounded-md border p-1 text-left md:min-h-[7.5rem] md:p-1.5 ${
        day.isToday ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:bg-muted/40"
      } ${inMonth ? "" : "opacity-50"}`}
    >
      <div className="flex flex-col gap-0.5 md:flex-row md:items-baseline md:justify-between md:gap-1">
        <span
          className={`font-serif text-sm md:text-base ${inMonth ? "text-foreground" : "text-muted-foreground"}`}
          aria-label={dayLabel(day.iso)}
        >
          {parts(day.iso).getDate()}
        </span>
        {/* Phone: a dot with the count instead of titles */}
        {day.openCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground md:hidden">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60" />
            {day.openCount}
          </span>
        )}
      </div>
      <div className="hidden md:block">
        <p className="min-h-[0.875rem] text-[10px] italic leading-tight text-muted-foreground">
          {day.openCount > 0 ? daySummary(day) : ""}
        </p>
        <div className="mt-1 space-y-0.5">
          {shown.map((item) => (
            <MonthChip key={item.task.id} item={item} drag={drag} />
          ))}
          {more > 0 && <p className="text-[10px] text-muted-foreground">+{more} more</p>}
          {repeatCount > 0 && (
            <p className="text-[10px] text-muted-foreground">
              <RepeatMark />
              {repeatCount} {repeatCount === 1 ? "repeat" : "repeats"}
            </p>
          )}
        </div>
      </div>
    </DropDay>
  );
}

function MonthChip({ item, drag }: { item: DayItem; drag: DragState }) {
  const { dragProps, isDragging, movable } = useTaskDrag(item.task, drag, item.status);
  return (
    <div
      {...dragProps}
      className={`truncate rounded bg-background px-1 py-0.5 text-[11px] leading-tight ${
        item.status === "done"
          ? "text-muted-foreground line-through decoration-muted-foreground/40"
          : item.status === "missed"
            ? "italic text-muted-foreground"
            : "text-foreground"
      } ${movable ? "cursor-grab" : ""} ${isDragging ? "opacity-40" : ""}`}
      title={item.task.title}
      data-testid={`month-task-${item.task.id}`}
    >
      {item.task.title}
    </div>
  );
}

function DayColumn({ day, drag }: { day: CalendarDay; drag: DragState }) {
  const date = parts(day.iso);
  return (
    <DropDay
      iso={day.iso}
      drag={drag}
      testId={`calendar-day-${day.iso}`}
      className={`rounded-md border p-3 md:p-2 ${
        day.isToday ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      } ${day.isPast && !drag.active ? "opacity-80" : ""}`}
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
          <ItemRow key={item.task.id} item={item} drag={drag} />
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
    </DropDay>
  );
}

function ItemRow({ item, drag }: { item: DayItem; drag: DragState }) {
  const { task, status } = item;
  const { template, dragProps, isDragging, movable } = useTaskDrag(task, drag, status);
  const spoons = task.spoon_estimate != null ? Number(task.spoon_estimate) : null;
  return (
    <div
      {...dragProps}
      className={`flex items-start gap-0.5 rounded border border-border/60 bg-background px-1.5 py-1 ${
        movable ? "cursor-grab" : ""
      } ${isDragging ? "opacity-40" : ""}`}
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
        <div
          {...stopDrag}
          className="-mr-1 -mt-0.5 shrink-0 cursor-default [&_button]:h-6 [&_button]:w-6 [&_svg]:h-3.5 [&_svg]:w-3.5"
        >
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

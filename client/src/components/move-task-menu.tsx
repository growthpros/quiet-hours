// The Move menu on a task: send it to another day or timeframe in one or
// two taps, with Undo. Repeats only offer days before their next scheduled
// occurrence (see lib/task-move.ts).

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTaskMover } from "@/hooks/use-task-mover";
import { localIsoDate } from "@/lib/local-date";
import type { TaskRow } from "@/lib/tasks-data";
import type { RecurringTemplateRow } from "@/lib/recurring-data";
import {
  MOVE_CHOICES,
  MOVE_LABEL,
  isoAddDays,
  describeWhen,
  repeatMoveWindow,
  repeatQuickChoices,
  whenForChoice,
  whenForDate,
  whenForRepeatChoice,
  type MoveChoice,
} from "@/lib/task-move";

export function MoveTaskMenu({
  task,
  template,
  variant = "icon",
}: {
  task: TaskRow;
  template: RecurringTemplateRow | null;
  variant?: "icon" | "text";
}) {
  const [picking, setPicking] = useState(false);
  const [pickedDate, setPickedDate] = useState("");
  const today = localIsoDate();

  const isRepeat = task.recurring_template_id != null;
  const window =
    isRepeat && template
      ? repeatMoveWindow(template, task.due_date ?? today, today)
      : null;
  const choices: MoveChoice[] = isRepeat
    ? repeatQuickChoices(window, today)
    : MOVE_CHOICES;
  const minDate = isRepeat ? window?.earliest : today;
  const maxDate = isRepeat ? window?.latest : undefined;

  const { moveTo, isMoving, overrideDialog } = useTaskMover();
  const tomorrow = isoAddDays(today, 1);
  // A repeat can only go to tomorrow if tomorrow is inside its window.
  const moveOpts = {
    canMoveTomorrow: !isRepeat || (!!window && tomorrow >= window.earliest && tomorrow <= window.latest),
  };

  // A repeat with nowhere to go (for example a daily repeat) gets no menu.
  if (isRepeat && (!template || !window)) return null;

  const pick = (choice: MoveChoice) => {
    const to =
      isRepeat && (choice === "today" || choice === "tomorrow")
        ? whenForRepeatChoice(choice, today)
        : whenForChoice(choice, today);
    moveTo(task, to, moveOpts);
  };

  const pickedIsValid =
    !!pickedDate &&
    (!minDate || pickedDate >= minDate) &&
    (!maxDate || pickedDate <= maxDate);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {variant === "icon" ? (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Move"
              title="Move to another day"
              disabled={isMoving}
              data-testid={`button-task-move-${task.id}`}
            >
              <CalendarClock className="h-4 w-4" />
            </Button>
          ) : (
            <button
              type="button"
              disabled={isMoving}
              className="italic text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-50"
              data-testid={`button-task-move-${task.id}`}
            >
              Move
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {choices.map((c) => (
            <DropdownMenuItem
              key={c}
              onSelect={() => pick(c)}
              data-testid={`move-choice-${c}-${task.id}`}
            >
              {MOVE_LABEL[c]}
            </DropdownMenuItem>
          ))}
          {choices.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem
            onSelect={() => {
              setPickedDate(minDate ?? today);
              setPicking(true);
            }}
            data-testid={`move-choice-date-${task.id}`}
          >
            Pick a date…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">Move to a day</DialogTitle>
            <DialogDescription>
              {isRepeat && window
                ? `This repeat can move to any day before its next one, up to ${describeWhen(
                    whenForDate(window.latest),
                    today,
                  )}.`
                : "Pick the day this belongs to."}
            </DialogDescription>
          </DialogHeader>
          <Input
            type="date"
            value={pickedDate}
            min={minDate}
            max={maxDate}
            onChange={(e) => setPickedDate(e.target.value)}
            data-testid={`input-move-date-${task.id}`}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPicking(false)}>
              Cancel
            </Button>
            <Button
              disabled={!pickedIsValid || isMoving}
              onClick={() => {
                moveTo(task, whenForDate(pickedDate), moveOpts);
                setPicking(false);
              }}
              data-testid={`button-move-date-confirm-${task.id}`}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {overrideDialog}
    </>
  );
}

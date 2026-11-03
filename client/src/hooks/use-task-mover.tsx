// Moving a task to another day or timeframe, with Undo. Shared by the Move
// menu and by dragging on the Calendar, so both behave the same.
//
// The task list updates right away (an "optimistic" update) so a dragged
// task doesn't snap back while the save finishes. If the save fails, the
// list goes back to how it was and a message says so.
//
// Moving a task onto Today checks today's spoons first (lib/spoon-budget.ts).
// If it would go over, the over-budget prompt opens instead, so callers
// must render the `overrideDialog` this hook returns.
//
// A task's open steps that still share its timing move with it (see
// lib/task-steps.ts), and Undo puts them all back.

import { spoonsOf } from "@/lib/spoon-cost";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ToastAction } from "@/components/ui/toast";
import { OverrideModal } from "@/components/override-modal";
import { useToast } from "@/hooks/use-toast";
import { localIsoDate } from "@/lib/local-date";
import { moveTask, type TaskRow } from "@/lib/tasks-data";
import { describeWhen, isoAddDays, whenForDate, type When } from "@/lib/task-move";
import { isOnToday } from "@/lib/task-timeframe";
import { spoonsOverIfAdded } from "@/lib/spoon-budget";
import { useSpoonBudget } from "@/lib/use-spoon-budget";
import { childrenMap, countable, movesWith } from "@/lib/task-steps";

function applyWhen(rows: TaskRow[] | undefined, ids: number[], to: When): TaskRow[] | undefined {
  return rows?.map((r) =>
    ids.includes(r.id) ? { ...r, due_date: to.dueDate, due_bucket: to.dueBucket } : r,
  );
}

interface PendingMove {
  task: TaskRow;
  to: When;
  over: number;
  canMoveTomorrow: boolean;
}

export interface MoveOptions {
  /** Whether "Move to tomorrow instead" can be offered (repeats may not move there). */
  canMoveTomorrow?: boolean;
}

export function useTaskMover() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { ledger, usual } = useSpoonBudget();
  const [pending, setPending] = useState<PendingMove | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["/api/spoon/ledger"] });
  };

  // The steps that move along with a task.
  const companions = (task: TaskRow): number[] => {
    const all = qc.getQueryData<TaskRow[]>(["tasks"]) ?? [];
    return movesWith(task, childrenMap(all)).map((t) => t.id);
  };

  const undo = useMutation({
    mutationFn: async ({ id, also, previous }: { id: number; also: number[]; previous: When }) =>
      moveTask({ id, due_date: null, due_bucket: null }, previous, also),
    onMutate: async ({ id, also, previous }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const before = qc.getQueryData<TaskRow[]>(["tasks"]);
      qc.setQueryData<TaskRow[]>(["tasks"], (rows) => applyWhen(rows, [id, ...also], previous));
      return { before };
    },
    onSuccess: () => toast({ title: "Put back where it was." }),
    onError: (e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(["tasks"], ctx.before);
      toast({ title: "Couldn't undo", description: e instanceof Error ? e.message : String(e) });
    },
    onSettled: refresh,
  });

  const move = useMutation({
    mutationFn: async ({ task, to }: { task: TaskRow; to: When }) => {
      const also = companions(task);
      return { to, also, previous: await moveTask(task, to, also) };
    },
    onMutate: async ({ task, to }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const before = qc.getQueryData<TaskRow[]>(["tasks"]);
      const ids = [task.id, ...companions(task)];
      qc.setQueryData<TaskRow[]>(["tasks"], (rows) => applyWhen(rows, ids, to));
      return { before };
    },
    onSuccess: ({ to, also, previous }, { task }) => {
      toast({
        title: `Moved to ${describeWhen(to, localIsoDate())}.`,
        description: also.length > 0 ? `Its open steps that shared its timing moved too.` : undefined,
        action: (
          <ToastAction
            altText="Undo the move"
            onClick={() => undo.mutate({ id: task.id, also, previous })}
            data-testid={`button-undo-move-${task.id}`}
          >
            Undo
          </ToastAction>
        ),
      });
    },
    onError: (e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(["tasks"], ctx.before);
      toast({ title: "Couldn't move it", description: e instanceof Error ? e.message : String(e) });
    },
    onSettled: refresh,
  });

  const moveTo = (task: TaskRow, to: When, opts: MoveOptions = {}) => {
    const today = localIsoDate();
    const landsOnToday = to.dueDate === today || to.dueBucket === "today";
    const tasks = qc.getQueryData<TaskRow[]>(["tasks"]) ?? [];
    // What arrives: the task, or for a task with steps, the steps moving
    // with it (a task with steps adds nothing itself). Only pieces arriving
    // on Today add to Today's load.
    const ids = new Set([task.id, ...companions(task)]);
    const counted = new Set(countable(tasks).map((t) => t.id));
    const inList = tasks.some((t) => t.id === task.id);
    const moving = inList ? tasks.filter((t) => ids.has(t.id) && counted.has(t.id)) : [task];
    const spoons = moving
      .filter((t) => t.completed_at == null && !isOnToday(t, today))
      .reduce((sum, t) => sum + spoonsOf(t), 0);
    if (landsOnToday && spoons > 0) {
      const over = spoonsOverIfAdded(tasks, ledger, usual, today, spoons);
      if (over > 0) {
        setPending({
          task,
          to,
          over,
          canMoveTomorrow: opts.canMoveTomorrow ?? task.recurring_template_id == null,
        });
        return;
      }
    }
    move.mutate({ task, to });
  };

  const overrideDialog = (
    <OverrideModal
      open={pending !== null}
      spoonsOver={pending?.over ?? 0}
      action="move"
      onCancel={() => setPending(null)}
      onConfirmed={() => {
        if (pending) move.mutate({ task: pending.task, to: pending.to });
        setPending(null);
      }}
      onMoveTomorrow={
        pending?.canMoveTomorrow
          ? () => {
              move.mutate({ task: pending.task, to: whenForDate(isoAddDays(localIsoDate(), 1)) });
              setPending(null);
            }
          : undefined
      }
    />
  );

  return { moveTo, isMoving: move.isPending, overrideDialog };
}

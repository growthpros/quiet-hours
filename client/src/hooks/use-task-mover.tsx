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

function applyWhen(rows: TaskRow[] | undefined, id: number, to: When): TaskRow[] | undefined {
  return rows?.map((r) =>
    r.id === id ? { ...r, due_date: to.dueDate, due_bucket: to.dueBucket } : r,
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

  const undo = useMutation({
    mutationFn: async ({ id, previous }: { id: number; previous: When }) =>
      moveTask({ id, due_date: null, due_bucket: null }, previous),
    onMutate: async ({ id, previous }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const before = qc.getQueryData<TaskRow[]>(["tasks"]);
      qc.setQueryData<TaskRow[]>(["tasks"], (rows) => applyWhen(rows, id, previous));
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
    mutationFn: async ({ task, to }: { task: TaskRow; to: When }) => ({
      to,
      previous: await moveTask(task, to),
    }),
    onMutate: async ({ task, to }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const before = qc.getQueryData<TaskRow[]>(["tasks"]);
      qc.setQueryData<TaskRow[]>(["tasks"], (rows) => applyWhen(rows, task.id, to));
      return { before };
    },
    onSuccess: ({ to, previous }, { task }) => {
      toast({
        title: `Moved to ${describeWhen(to, localIsoDate())}.`,
        action: (
          <ToastAction
            altText="Undo the move"
            onClick={() => undo.mutate({ id: task.id, previous })}
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
    const spoons = spoonsOf(task);
    // Only a task arriving on Today adds to Today's load.
    if (landsOnToday && task.completed_at == null && !isOnToday(task, today) && spoons > 0) {
      const tasks = qc.getQueryData<TaskRow[]>(["tasks"]) ?? [];
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

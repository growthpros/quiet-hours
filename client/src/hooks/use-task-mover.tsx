// Moving a task to another day or timeframe, with Undo. Shared by the Move
// menu and by dragging on the Calendar, so both behave the same.
//
// The task list updates right away (an "optimistic" update) so a dragged
// task doesn't snap back while the save finishes. If the save fails, the
// list goes back to how it was and a message says so.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { localIsoDate } from "@/lib/local-date";
import { moveTask, type TaskRow } from "@/lib/tasks-data";
import { describeWhen, type When } from "@/lib/task-move";

type MovableTask = Pick<TaskRow, "id" | "due_date" | "due_bucket">;

function applyWhen(rows: TaskRow[] | undefined, id: number, to: When): TaskRow[] | undefined {
  return rows?.map((r) =>
    r.id === id ? { ...r, due_date: to.dueDate, due_bucket: to.dueBucket } : r,
  );
}

export function useTaskMover() {
  const qc = useQueryClient();
  const { toast } = useToast();

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
    mutationFn: async ({ task, to }: { task: MovableTask; to: When }) => ({
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

  return {
    moveTo: (task: MovableTask, to: When) => move.mutate({ task, to }),
    isMoving: move.isPending,
  };
}

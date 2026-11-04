// Steps and subtasks: how a task's pieces fit together.
//
// A task can have steps, and a step can have subtasks (two levels at most,
// enforced by the database too; see migration 017). The rules, all in one
// place so the Tasks page, Today, the Calendar and the spoon meter agree:
//
//   - Only the smallest pieces count. A task with steps doesn't add its
//     own spoons to any day; its steps do, each on its own day. A task's
//     total is the sum of its steps (and a step's, of its subtasks).
//   - Ticking off the last step ticks off the task too. Reopening a step
//     reopens a task that was ticked off.
//   - Ticking off a task with open steps ticks those steps off as well.
//   - A new step starts with its task's timing (a timeframe or a day).
//   - Moving a task moves the open steps that still share its timing.
//   - Archived ("let go") pieces don't count as steps.

import { spoonsOf, type SpoonTask } from "@/lib/spoon-cost";
import type { DueBucket, TaskRow } from "@/lib/tasks-data";

/** Task, step, subtask. */
export const MAX_DEPTH = 2;

/** What each level is called in the app. */
export const LEVEL_NAME: Record<1 | 2, { one: string; many: string }> = {
  1: { one: "step", many: "steps" },
  2: { one: "subtask", many: "subtasks" },
};

/** "1 step", "3 subtasks". */
export function countLabel(level: 1 | 2, n: number): string {
  const name = LEVEL_NAME[level];
  return `${n} ${n === 1 ? name.one : name.many}`;
}

/**
 * The fields these rules need. They're optional so the date and spoon
 * helpers can still be called with partial rows; a row without an id is
 * treated as having no steps.
 */
export type FamilyLike = Partial<
  Pick<TaskRow, "id" | "parent_task_id" | "archived_at" | "completed_at" | "position">
>;

type Family = Pick<TaskRow, "id" | "parent_task_id" | "archived_at" | "completed_at" | "position">;

function byPosition(a: Family, b: Family): number {
  const pa = a.position ?? Number.POSITIVE_INFINITY;
  const pb = b.position ?? Number.POSITIVE_INFINITY;
  return pa !== pb ? pa - pb : a.id - b.id;
}

/** Each parent's steps, in order. Archived rows are left out. */
export function childrenMap<T extends Family>(tasks: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const t of tasks) {
    if (t.parent_task_id == null || t.archived_at != null) continue;
    const list = map.get(t.parent_task_id) ?? [];
    list.push(t);
    map.set(t.parent_task_id, list);
  }
  map.forEach((list) => list.sort(byPosition));
  return map;
}

export function stepsOf<T extends Family>(t: Pick<T, "id">, kids: Map<number, T[]>): T[] {
  return kids.get(t.id) ?? [];
}

export function hasSteps(t: Pick<Family, "id">, kids: Map<number, unknown[]>): boolean {
  return (kids.get(t.id)?.length ?? 0) > 0;
}

/** Steps as shown: open ones first (in their order), then finished ones. */
export function displayOrder<T extends Family>(steps: T[]): T[] {
  return [...steps.filter((s) => s.completed_at == null), ...steps.filter((s) => s.completed_at != null)];
}

/**
 * The tasks that count toward a day: everything except tasks that have
 * steps (their steps count instead).
 */
export function countable<T extends FamilyLike>(tasks: T[]): T[] {
  const parents = new Set<number>();
  for (const t of tasks) {
    if (t.parent_task_id != null && t.archived_at == null) parents.add(t.parent_task_id);
  }
  if (parents.size === 0) return tasks;
  return tasks.filter((t) => t.id == null || !parents.has(t.id));
}

/** 0 for a task, 1 for a step, 2 for a subtask. */
export function levelOf(t: Pick<Family, "parent_task_id">, byId: Map<number, Pick<Family, "parent_task_id">>): 0 | 1 | 2 {
  if (t.parent_task_id == null) return 0;
  const parent = byId.get(t.parent_task_id);
  return parent?.parent_task_id != null ? 2 : 1;
}

/** The top-level task a step or subtask belongs to (itself for a task). */
export function rootOf<T extends Family>(t: T, byId: Map<number, T>): T {
  let cur = t;
  for (let i = 0; i < MAX_DEPTH && cur.parent_task_id != null; i++) {
    const up = byId.get(cur.parent_task_id);
    if (!up) break;
    cur = up;
  }
  return cur;
}

/** Every step and subtask under a task, steps first. */
export function descendants<T extends Family>(t: Pick<T, "id">, kids: Map<number, T[]>): T[] {
  const out: T[] = [];
  for (const s of stepsOf(t, kids)) {
    out.push(s, ...descendants(s, kids));
  }
  return out;
}

/** A task's spoons: its own if it has no steps, otherwise the sum of its pieces. */
export function familySpoons<T extends Family & SpoonTask>(t: T, kids: Map<number, T[]>): number {
  const steps = stepsOf(t, kids);
  if (steps.length === 0) return spoonsOf(t);
  return steps.reduce((sum, s) => sum + familySpoons(s, kids), 0);
}

/** How many of a task's direct steps are done. */
export function stepProgress(t: Pick<Family, "id">, kids: Map<number, Family[]>): { done: number; total: number } {
  const steps = kids.get(t.id) ?? [];
  return { done: steps.filter((s) => s.completed_at != null).length, total: steps.length };
}

/**
 * After a piece is ticked off: the tasks above it that are now finished
 * too (every one of their steps done). Nearest first.
 */
export function parentsFinishedBy<T extends Family>(id: number, tasks: T[]): T[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const kids = childrenMap(tasks);
  const done = new Set<number>([id]);
  const out: T[] = [];
  let cur = byId.get(id);
  while (cur?.parent_task_id != null) {
    const parent = byId.get(cur.parent_task_id);
    if (!parent || parent.completed_at != null) break;
    const allDone = stepsOf(parent, kids).every((s) => done.has(s.id) || s.completed_at != null);
    if (!allDone) break;
    done.add(parent.id);
    out.push(parent);
    cur = parent;
  }
  return out;
}

/** After a piece is reopened: the finished tasks above it, which reopen too. */
export function parentsReopenedBy<T extends Family>(id: number, tasks: T[]): T[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out: T[] = [];
  let cur = byId.get(id);
  while (cur?.parent_task_id != null) {
    const parent = byId.get(cur.parent_task_id);
    if (!parent || parent.completed_at == null) break;
    out.push(parent);
    cur = parent;
  }
  return out;
}

/** The open pieces under a task, which are ticked off along with it. */
export function openDescendants<T extends Family>(t: Pick<T, "id">, kids: Map<number, T[]>): T[] {
  return descendants(t, kids).filter((d) => d.completed_at == null);
}

type Timed = Family & Pick<TaskRow, "due_date" | "due_bucket">;

/**
 * When a task moves, its open pieces that still share its timing move
 * with it. Pieces given their own day or timeframe stay where they are.
 */
export function movesWith<T extends Timed>(t: T, kids: Map<number, T[]>): T[] {
  return openDescendants(t, kids).filter(
    (d) => d.due_date === t.due_date && d.due_bucket === t.due_bucket,
  );
}

/** A new step's timing: the same as its task's. */
export function newStepWhen(parent: Pick<TaskRow, "due_date" | "due_bucket">): {
  dueDate: string | null;
  dueBucket: DueBucket | null;
} {
  return parent.due_date
    ? { dueDate: parent.due_date, dueBucket: null }
    : { dueDate: null, dueBucket: parent.due_bucket ?? "today" };
}

/** The position for a step added at the end. */
export function nextPosition(parentId: number, kids: Map<number, Family[]>): number {
  const steps = kids.get(parentId) ?? [];
  return steps.reduce((max, s) => Math.max(max, s.position ?? 0), 0) + 1;
}

/**
 * The positions after moving one step up or down. Returns every step
 * with its new position, so the order is saved whole.
 */
export function reorder<T extends Family>(
  steps: T[],
  id: number,
  direction: "up" | "down",
): { id: number; position: number }[] {
  const list = [...steps];
  const i = list.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return [];
  [list[i], list[j]] = [list[j], list[i]];
  return list.map((s, k) => ({ id: s.id, position: k + 1 }));
}

/**
 * The top-level tasks to show for a list of matching rows. A step that
 * matches shows inside its task, so each task appears once. Kept in the
 * order of `all`.
 */
export function rootsFor<T extends Family>(matching: T[], all: T[]): T[] {
  const byId = new Map(all.map((t) => [t.id, t]));
  const rootIds = new Set(matching.map((t) => rootOf(t, byId).id));
  return all.filter((t) => rootIds.has(t.id));
}

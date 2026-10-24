// React Query setup + Supabase-backed data helpers.
// The default queryFn routes queryKeys like ["/api/delegation"] to Supabase
// via the functions in @/lib/data. This lets the existing pages keep their
// queryKeys unchanged.

import { QueryClient } from "@tanstack/react-query";
import {
  listDelegation,
  createDelegation,
  updateDelegation,
  deleteDelegation,
  listChecklists,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  listCompassion,
  createCompassion,
  deleteCompassion,
  listBurnout,
  createBurnout,
  deleteBurnout,
  clearBurnoutToday,
  fetchStreaks,
} from "@/lib/data";

// Camel/snake shim so pages that expect ChecklistRun.templateLabel etc. still work.
function toCamel<T extends object>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out as T;
}
function arrToCamel<T extends object>(rows: T[]): T[] {
  return rows.map(toCamel);
}

async function defaultQueryFn({ queryKey }: { queryKey: readonly unknown[] }) {
  const [path, ...rest] = queryKey as [string, ...unknown[]];
  const marker = rest[0];

  if (path === "/api/delegation") {
    return arrToCamel(await listDelegation());
  }
  if (path === "/api/checklists") {
    return arrToCamel(await listChecklists());
  }
  if (path === "/api/compassion") {
    return arrToCamel(await listCompassion());
  }
  if (path === "/api/burnout" && marker === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return arrToCamel(await listBurnout(start.getTime()));
  }
  if (path === "/api/burnout") {
    return arrToCamel(await listBurnout());
  }
  if (path === "/api/burnout/streaks") {
    return await fetchStreaks();
  }
  throw new Error(`Unknown query key: ${String(path)}`);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      staleTime: 30_000,
      retry: false,
    },
  },
});

// ---------- apiRequest shim ----------
// Pages call apiRequest("POST", "/api/burnout", body). We map each of those
// to the corresponding data function. Returns a Response-like { json() } for
// compatibility with existing custom queryFns that call res.json().
interface ShimResponse<T> {
  json: () => Promise<T>;
}

function fake<T>(payload: T): ShimResponse<T> {
  return { json: async () => payload };
}

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<ShimResponse<any>> {
  const M = method.toUpperCase();
  const b = (body as Record<string, unknown>) ?? {};

  // ---------- Delegation ----------
  if (path === "/api/delegation" && M === "GET") {
    return fake(arrToCamel(await listDelegation()));
  }
  if (path === "/api/delegation" && M === "POST") {
    const row = await createDelegation({
      title: b.title as string,
      notes: (b.notes as string | null) ?? null,
      urgency: b.urgency as number,
      importance: b.importance as number,
      assignee: (b.assignee as string | null) ?? null,
      releasedControl: b.releasedControl as number | undefined,
      completed: b.completed as number | undefined,
    });
    return fake(toCamel(row));
  }
  const delMatch = /^\/api\/delegation\/(\d+)$/.exec(path);
  if (delMatch && M === "PATCH") {
    const id = Number(delMatch[1]);
    const row = await updateDelegation(id, b as Parameters<typeof updateDelegation>[1]);
    return fake(toCamel(row));
  }
  if (delMatch && M === "DELETE") {
    await deleteDelegation(Number(delMatch[1]));
    return fake({ ok: true });
  }

  // ---------- Checklists ----------
  if (path === "/api/checklists" && M === "GET") {
    return fake(arrToCamel(await listChecklists()));
  }
  if (path === "/api/checklists" && M === "POST") {
    const row = await createChecklist({
      templateKey: b.templateKey as string,
      templateLabel: b.templateLabel as string,
      items: b.items as string,
    });
    return fake(toCamel(row));
  }
  const clMatch = /^\/api\/checklists\/(\d+)$/.exec(path);
  if (clMatch && M === "PATCH") {
    const id = Number(clMatch[1]);
    const row = await updateChecklist(id, b as Parameters<typeof updateChecklist>[1]);
    return fake(toCamel(row));
  }
  if (clMatch && M === "DELETE") {
    await deleteChecklist(Number(clMatch[1]));
    return fake({ ok: true });
  }

  // ---------- Compassion ----------
  if (path === "/api/compassion" && M === "GET") {
    return fake(arrToCamel(await listCompassion()));
  }
  if (path === "/api/compassion" && M === "POST") {
    const row = await createCompassion({
      trigger: b.trigger as string,
      firstThought: b.firstThought as string,
      intensityBefore: b.intensityBefore as number,
      reframe: b.reframe as string,
      intensityAfter: b.intensityAfter as number,
      outcome: (b.outcome as string | null) ?? null,
    });
    return fake(toCamel(row));
  }
  const coMatch = /^\/api\/compassion\/(\d+)$/.exec(path);
  if (coMatch && M === "DELETE") {
    await deleteCompassion(Number(coMatch[1]));
    return fake({ ok: true });
  }

  // ---------- Burnout ----------
  const burnoutSinceMatch = /^\/api\/burnout\?since=(\d+)$/.exec(path);
  if (burnoutSinceMatch && M === "GET") {
    return fake(arrToCamel(await listBurnout(Number(burnoutSinceMatch[1]))));
  }
  if (path === "/api/burnout" && M === "GET") {
    return fake(arrToCamel(await listBurnout()));
  }
  if (path === "/api/burnout" && M === "POST") {
    const row = await createBurnout({
      energy: b.energy as number,
      sensory: b.sensory as number,
      symptoms: (b.symptoms as string) ?? "[]",
      state: (b.state as string | null) ?? null,
      pulls: (b.pulls as string) ?? "[]",
      note: (b.note as string | null) ?? null,
    });
    return fake(toCamel(row));
  }
  const buMatch = /^\/api\/burnout\/(\d+)$/.exec(path);
  if (buMatch && M === "DELETE") {
    await deleteBurnout(Number(buMatch[1]));
    return fake({ ok: true });
  }
  if (path === "/api/burnout/clear-today" && M === "POST") {
    await clearBurnoutToday();
    return fake({ ok: true });
  }
  if (path === "/api/burnout/streaks" && M === "GET") {
    return fake(await fetchStreaks());
  }

  throw new Error(`Unknown API request: ${M} ${path}`);
}

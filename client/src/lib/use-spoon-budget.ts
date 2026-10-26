// Today's ledger and "your usual" budget, for anything that compares a
// day's plan with its spoons (adding or moving tasks, Calendar amber).

import { useQuery } from "@tanstack/react-query";
import { localIsoDate } from "@/lib/local-date";
import {
  getOrCreateLedgerForDate,
  listRecentAllotments,
  type SpoonLedgerRow,
} from "@/lib/spoon-data";
import { USUAL_WINDOW, usualBudget } from "@/lib/spoon-budget";

export function useSpoonBudget() {
  const today = localIsoDate();
  // Same key as the spoon meter, so they share one copy of today's ledger.
  const ledgerQ = useQuery<SpoonLedgerRow>({
    queryKey: ["/api/spoon/ledger", today],
    queryFn: () => getOrCreateLedgerForDate(today),
  });
  const recentQ = useQuery<number[]>({
    queryKey: ["/api/spoon/ledger", "recent"],
    queryFn: () => listRecentAllotments(USUAL_WINDOW),
  });
  return {
    today,
    ledger: ledgerQ.data ?? null,
    usual: usualBudget(recentQ.data ?? []),
    ready: ledgerQ.isSuccess && recentQ.isSuccess,
  };
}

// Today's ledger and "your usual" budget (the person's ordinary okay day),
// for anything that compares a day's plan with its spoons (adding or moving
// tasks, Calendar amber, the spoon meter).

import { useQuery } from "@tanstack/react-query";
import { localIsoDate } from "@/lib/local-date";
import { getOrCreateLedgerForDate, type SpoonLedgerRow } from "@/lib/spoon-data";
import { getOrCreateProfile, type UserProfileRow } from "@/lib/foundation-data";
import { cleanUsual } from "@/lib/daily-budget";

export function useSpoonBudget() {
  const today = localIsoDate();
  // Same key as the spoon meter, so they share one copy of today's ledger.
  const ledgerQ = useQuery<SpoonLedgerRow>({
    queryKey: ["/api/spoon/ledger", today],
    queryFn: () => getOrCreateLedgerForDate(today),
  });
  const profileQ = useQuery<UserProfileRow>({
    queryKey: ["/api/profile"],
    queryFn: getOrCreateProfile,
  });
  return {
    today,
    ledger: ledgerQ.data ?? null,
    usual: cleanUsual(profileQ.data?.usual_budget),
    /** False until the person has said what an ordinary okay day is. */
    usualSet: profileQ.data?.usual_budget != null,
    ready: ledgerQ.isSuccess && profileQ.isSuccess,
  };
}

// The person's chosen first day of the week (Sunday by default).
import { useQuery } from "@tanstack/react-query";
import { getOrCreateProfile, type UserProfileRow } from "@/lib/foundation-data";
import type { WeekStartDay } from "@/lib/task-timeframe";

export function useWeekStart(): WeekStartDay {
  const profileQ = useQuery<UserProfileRow>({
    queryKey: ["/api/profile"],
    queryFn: getOrCreateProfile,
  });
  const v = profileQ.data?.week_starts_on;
  return v === 1 || v === 6 ? v : 0;
}

// Gentle phase-transition suggestion.
// Shows above the Foundation card when the last-5 or last-7 check-ins
// clearly point to a different phase than the user is currently in.
// Never forces the shift, and never suggests the same target more than
// once every 3 days.

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { BurnoutCheckinRow } from "@/lib/supabase";
import { getOrCreateProfile, type UserProfileRow } from "@/lib/foundation-data";
import {
  analyzePhaseFromCheckins,
  acceptPhaseTransition,
  dismissPhaseTransition,
  recentlySuggested,
} from "@/lib/spoon-data";
import { apiRequest } from "@/lib/queryClient";

const PHASE_LABEL: Record<string, string> = {
  acute_recovery: "Acute recovery",
  rebuilding: "Rebuilding",
  steady: "Steady",
  stretch: "Stretch",
  burnout: "Burnout",
};

export function PhaseSuggestionBanner() {
  const qc = useQueryClient();

  const profileQ = useQuery<UserProfileRow>({
    queryKey: ["/api/profile"],
    queryFn: getOrCreateProfile,
  });

  // Pull the last 14 days of check-ins so we can slice the last 5 or 7.
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const checkinsQ = useQuery<BurnoutCheckinRow[]>({
    queryKey: ["/api/burnout", "recent-14d"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/burnout?since=${cutoff}`);
      return res.json();
    },
  });

  const suggestion = useMemo(() => {
    if (!checkinsQ.data || !profileQ.data) return null;
    return analyzePhaseFromCheckins(checkinsQ.data, profileQ.data.current_phase);
  }, [checkinsQ.data, profileQ.data]);

  // Check whether we've already suggested this target recently
  const suggestedRecentlyQ = useQuery<boolean>({
    queryKey: ["/api/phase/recently-suggested", suggestion?.toPhase],
    queryFn: async () => {
      if (!suggestion) return false;
      return recentlySuggested(suggestion.toPhase);
    },
    enabled: !!suggestion,
  });

  const accept = useMutation({
    mutationFn: async () => {
      if (!suggestion) throw new Error("no suggestion");
      return acceptPhaseTransition(suggestion);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      qc.invalidateQueries({ queryKey: ["/api/phase/recently-suggested"] });
      toast({ title: "Phase updated.", description: "Defaults and prompts will follow." });
    },
  });

  const dismiss = useMutation({
    mutationFn: async () => {
      if (!suggestion) throw new Error("no suggestion");
      return dismissPhaseTransition(suggestion);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/phase/recently-suggested"] });
    },
  });

  if (!suggestion || suggestedRecentlyQ.data === true) return null;

  return (
    <Card
      className="p-5"
      style={{
        background: "linear-gradient(135deg, #E3DAE7 0%, #EFE7F0 100%)",
        borderColor: "rgba(160, 143, 181, 0.4)",
      }}
      data-testid="card-phase-suggestion"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] font-bold mb-1" style={{ color: "#5D4A6E" }}>
            A phase shift, if you're ready
          </p>
          <p className="font-serif text-lg font-medium leading-tight" style={{ color: "#2A2620" }}>
            {suggestion.fromPhase
              ? `From ${PHASE_LABEL[suggestion.fromPhase] ?? "unset"} to ${PHASE_LABEL[suggestion.toPhase]}?`
              : `Try ${PHASE_LABEL[suggestion.toPhase]}?`}
          </p>
          <p className="font-serif italic text-sm mt-1" style={{ color: "#3D3A34" }}>
            {suggestion.reason}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => dismiss.mutate()}
            disabled={dismiss.isPending}
            data-testid="button-dismiss-phase-suggestion"
          >
            Not yet
          </Button>
          <Button
            size="sm"
            onClick={() => accept.mutate()}
            disabled={accept.isPending}
            data-testid="button-accept-phase-suggestion"
          >
            {accept.isPending ? "Updating" : "Yes, shift"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

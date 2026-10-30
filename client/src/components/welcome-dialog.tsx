// Welcome, shown once per new user on their first sign-in. We detect "new" by
// checking whether any tables have rows for this user yet. A tiny local
// storage marker prevents re-showing on the same browser.
//
// Three short steps (spoon model change 4): what Quiet Hours is, the
// ordinary okay day (see lib/daily-budget.ts), and the current phase (see
// lib/phases.ts). The last two save as soon as something is picked, and
// both can be skipped; Settings and the Foundation page change them later.

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { InfoTip } from "@/components/info-tip";
import { supabase } from "@/lib/supabase";
import { updateProfile, type UserProfileRow } from "@/lib/foundation-data";
import { DEFAULT_USUAL, USUAL_CHOICES } from "@/lib/daily-budget";
import { PHASES, type PhaseKey } from "@/lib/phases";
import { EXPLAIN } from "@/lib/explainers";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const KEY = "quiet_hours.welcomed.v1";

export function WelcomeDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [usual, setUsual] = useState<number | null>(null);
  const [phase, setPhase] = useState<PhaseKey | null>(null);

  useEffect(() => {
    if (!user) return;
    try {
      if (localStorage.getItem(KEY) === user.id) return;
    } catch (e) {
      // Without storage we fall back to the "no rows yet" check below.
      console.warn("Couldn't read the welcome marker", e);
    }
    (async () => {
      const [d, c, co, b] = await Promise.all([
        supabase.from("delegation_tasks").select("id", { count: "exact", head: true }),
        supabase.from("checklist_runs").select("id", { count: "exact", head: true }),
        supabase.from("compassion_entries").select("id", { count: "exact", head: true }),
        supabase.from("burnout_checkins").select("id", { count: "exact", head: true }),
      ]);
      const total = (d.count ?? 0) + (c.count ?? 0) + (co.count ?? 0) + (b.count ?? 0);
      if (total === 0) setOpen(true);
    })();
  }, [user]);

  const close = () => {
    if (user) {
      try {
        localStorage.setItem(KEY, user.id);
      } catch (e) {
        // Worst case the welcome shows again on this browser.
        console.warn("Couldn't save the welcome marker", e);
      }
    }
    setOpen(false);
  };

  const save = async (patch: Partial<Pick<UserProfileRow, "usual_budget" | "current_phase">>) => {
    try {
      await updateProfile(patch);
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      qc.invalidateQueries({ queryKey: ["user_profile"] });
    } catch (e) {
      toast({
        title: "Couldn't save that",
        description: "You can set it later in Settings or on the Foundation page.",
      });
      console.error("Welcome step didn't save", e);
    }
  };

  const choice = (active: boolean) =>
    cn(
      "w-full rounded-lg border p-3 text-left transition-colors",
      active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted",
    );

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-welcome">
        <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className={cn("h-1 rounded-full", n <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-lg">Welcome. A few things to know first.</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <p className="text-foreground">
                Quiet Hours is a gentle planner and toolkit for the parts of you that try to do everything, do it
                perfectly, and do it personally. It plans your days around the energy you actually have, and gives
                you a place to notice.
              </p>
              <div className="space-y-2 rounded-md bg-muted/50 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">What it is, and isn't</p>
                <ul className="space-y-1.5 font-serif text-sm italic text-muted-foreground">
                  <li>
                    It's a tool for noticing patterns and pacing your days. It's not a treatment, and not a
                    substitute for a therapist or clinician.
                  </li>
                  <li>
                    Your data is yours. Stored in a private database, visible only to you, exportable and deletable
                    any time in Settings.
                  </li>
                  <li>
                    There are no streaks and no scores, and reminders only come when you ask for them. The point is
                    to pause, not to optimize.
                  </li>
                  <li>
                    If today feels unmanageable, please reach out to someone. In the US: call or text 988. Global:
                    findahelpline.com.
                  </li>
                </ul>
              </div>
              <p className="font-serif italic text-muted-foreground">
                Take your time. Nothing here needs to be perfect, including how you use it.
              </p>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} data-testid="button-welcome-close">
                  I understand
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5 font-serif text-lg">
                On an ordinary okay day, how much can you get through?
                <InfoTip label="an ordinary okay day" testId="info-welcome-ordinary">
                  <p>{EXPLAIN.ordinaryDay}</p>
                </InfoTip>
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Each day's spoons start here, then adjust for how you are when you check in.
            </p>
            <div className="space-y-2">
              {USUAL_CHOICES.map((c) => (
                <button
                  key={c.spoons}
                  type="button"
                  className={choice(usual === c.spoons)}
                  onClick={() => {
                    setUsual(c.spoons);
                    void save({ usual_budget: c.spoons });
                  }}
                  data-testid={`welcome-usual-${c.spoons}`}
                >
                  <span className="text-sm text-foreground">{c.label}</span>{" "}
                  <span className="text-sm text-muted-foreground">({c.spoons} spoons)</span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              {usual == null ? (
                <Button variant="ghost" onClick={() => setStep(3)} data-testid="welcome-skip-usual">
                  Skip for now (uses {DEFAULT_USUAL})
                </Button>
              ) : (
                <span />
              )}
              <Button onClick={() => setStep(3)} disabled={usual == null} data-testid="welcome-next-usual">
                Next
              </Button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5 font-serif text-lg">
                Where are you right now?
                <InfoTip label="phases" testId="info-welcome-phases">
                  <p>{EXPLAIN.phases}</p>
                </InfoTip>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {PHASES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={choice(phase === p.key)}
                  onClick={() => {
                    setPhase(p.key);
                    void save({ current_phase: p.key });
                  }}
                  data-testid={`welcome-phase-${p.key}`}
                >
                  <span className="block font-serif text-sm font-medium text-foreground">{p.label}</span>
                  <span className="block text-xs text-muted-foreground">{p.desc}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1">
              {phase == null ? (
                <Button variant="ghost" onClick={close} data-testid="welcome-skip-phase">
                  Skip for now
                </Button>
              ) : (
                <span />
              )}
              <Button onClick={close} disabled={phase == null} data-testid="welcome-done">
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

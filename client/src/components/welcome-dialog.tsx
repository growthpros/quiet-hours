import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";

// Shows once per new user, on their first sign-in. We detect "new" by
// checking whether any tables have rows for this user yet. A tiny local
// storage marker prevents re-showing on the same browser.

const KEY = "quiet_hours.welcomed.v1";

export function WelcomeDialog() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      if (localStorage.getItem(KEY) === user.id) return;
    } catch {
      /* ignore */
    }
    // Show welcome if the user has no rows anywhere.
    (async () => {
      const [d, c, co, b] = await Promise.all([
        supabase.from("delegation_tasks").select("id", { count: "exact", head: true }),
        supabase.from("checklist_runs").select("id", { count: "exact", head: true }),
        supabase.from("compassion_entries").select("id", { count: "exact", head: true }),
        supabase.from("burnout_checkins").select("id", { count: "exact", head: true }),
      ]);
      const total =
        (d.count ?? 0) + (c.count ?? 0) + (co.count ?? 0) + (b.count ?? 0);
      if (total === 0) setOpen(true);
    })();
  }, [user]);

  const close = () => {
    if (user) {
      try {
        localStorage.setItem(KEY, user.id);
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">
            Welcome. A few things to know first.
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-foreground">
            Quiet Hours is a small, low-demand workplace toolkit for the parts
            of you that try to do everything, do it perfectly, and do it
            personally. It's not a productivity app. It's a place to notice.
          </p>
          <div className="space-y-2 rounded-md bg-muted/50 p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              What it is, and isn't
            </p>
            <ul className="space-y-1.5 font-serif text-sm italic text-muted-foreground">
              <li>
                It's a tool for noticing patterns — not a treatment, not a
                substitute for a therapist or clinician.
              </li>
              <li>
                Your data is yours. Stored in a private database, visible only
                to you, exportable and deletable any time in Settings.
              </li>
              <li>
                There are no streaks, no scores, no notifications. The point
                is not to optimize — it's to pause.
              </li>
              <li>
                If today feels unmanageable, please reach out to someone. In
                the US: call or text 988. Global: findahelpline.com.
              </li>
            </ul>
          </div>
          <p className="font-serif italic text-muted-foreground">
            Take your time. Nothing here needs to be perfect — including
            how you use it.
          </p>
          <div className="flex justify-end">
            <Button onClick={close} data-testid="button-welcome-close">
              I understand
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

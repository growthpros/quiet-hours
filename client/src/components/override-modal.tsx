// Override modal: shown when adding a task to Today, or moving or dragging
// one onto Today, would go past today's spoons. It never blocks. It offers
// two gentler choices first (move it to tomorrow, or make it smaller), then
// "sometimes you know best": a reason, optional free text, and the override
// is logged. On what would be the 3rd override in 7 days, a soft interrupt
// comes first (spec v3, section 5).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import { logOverride, overridesLast7Days } from "@/lib/spoon-data";

const CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "urgent", label: "It's genuinely urgent" },
  { key: "feeling_good", label: "I'm feeling good and want to push" },
  { key: "deadline", label: "I have a deadline and must finish tonight" },
  { key: "underestimated", label: "I underestimated the spoon cost" },
  { key: "high_intensity", label: "My nervous system is in high intensity mode" },
  { key: "avoiding_rest", label: "I'm avoiding rest on purpose" },
  { key: "dont_know", label: "I don't know, I just want to" },
  { key: "other", label: "Other" },
];

interface OverrideModalProps {
  open: boolean;
  spoonsOver: number;
  onCancel: () => void;
  onConfirmed: () => void; // called after the override is logged, so caller can commit whatever they were adding
  /** Offer "Move to tomorrow instead" (hidden when there's no handler). */
  onMoveTomorrow?: () => void;
  /** Offer "Make it smaller" (hidden when there's no handler). */
  onMakeSmaller?: () => void;
  /** What confirming does: "add" (default) or "move". */
  action?: "add" | "move";
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function OverrideModal({
  open,
  spoonsOver,
  onCancel,
  onConfirmed,
  onMoveTomorrow,
  onMakeSmaller,
  action = "add",
}: OverrideModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  // 'choose' shows the category grid (or the soft-interrupt banner if the
  // user has already overridden 3+ times in the last 7 days). 'reflect'
  // is the free-text step. 'categories' is reached from the soft-interrupt
  // banner when the user clicks 'Still override' and needs to still pick
  // a category. Regular flow: choose → reflect.
  const [step, setStep] = useState<"choose" | "categories" | "reflect">("choose");
  const [category, setCategory] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");

  const priorQ = useQuery<number>({
    queryKey: ["/api/overrides/last-7-days"],
    queryFn: overridesLast7Days,
    enabled: open,
  });

  const commit = useMutation({
    mutationFn: async () => {
      if (!category) throw new Error("Pick a category first.");
      return logOverride({
        spoonsOver,
        category,
        freeText: freeText.trim(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/overrides/last-7-days"] });
      // Reset local state so the next open starts fresh
      setStep("choose");
      setCategory(null);
      setFreeText("");
      onConfirmed();
    },
  });

  // Soft interrupt: this would be the 3rd (or later) override in 7 days,
  // shown only on first entry.
  // Once the user has clicked 'Still override', they've acknowledged the
  // pattern and shouldn't be re-blocked on this same modal instance.
  const prior = priorQ.data ?? 0;
  const showSoftInterrupt = step === "choose" && prior >= 2;
  const gentler = (onMoveTomorrow || onMakeSmaller) && (
    <div className="flex flex-wrap gap-2">
      {onMoveTomorrow && (
        <Button variant="outline" onClick={onMoveTomorrow} data-testid="override-move-tomorrow">
          Move to tomorrow instead
        </Button>
      )}
      {onMakeSmaller && (
        <Button variant="outline" onClick={onMakeSmaller} data-testid="override-make-smaller">
          Make it smaller
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {step === "reflect" ? "Say a little more?" : "Over your spoon limit"}
          </DialogTitle>
        </DialogHeader>

        {showSoftInterrupt ? (
          <div className="space-y-4">
            <div
              className="rounded-lg p-4 flex gap-3"
              style={{ background: "#F2E1C5", border: "1px solid #D9A55E" }}
            >
              <AlertTriangle className="h-5 w-5 mt-0.5" style={{ color: "#8A5A1F" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#8A5A1F" }}>
                  This would be your {ordinal(prior + 1)} override this week.
                </p>
                <p className="text-sm mt-1 font-serif" style={{ color: "#3D3A34" }}>
                  That's the pattern, not the plan. Want to look at what's been asking too much lately?
                </p>
                {action === "add" && (
                  <p className="text-xs mt-2 italic" style={{ color: "#6D655A" }}>
                    Heads up: if you cancel or step away to History, this task won't save. Come back and re-enter it if you want to add it.
                  </p>
                )}
              </div>
            </div>
            {gentler}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={onCancel} data-testid="override-cancel">
                {action === "add" ? "Cancel adding this" : "Leave it where it was"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  onCancel();
                  if (action === "add") {
                    toast({
                      title: "Task not saved.",
                      description: "Come back to Tasks when you're ready to try again.",
                    });
                  }
                  navigate("/history");
                }}
                data-testid="override-see-week"
              >
                See my week
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep("categories")}
                data-testid="override-still"
              >
                Still override
              </Button>
            </div>
          </div>
        ) : step === "choose" || step === "categories" ? (
          <>
            <p className="text-sm font-serif italic" style={{ color: "#3D3A34" }}>
              This puts you {spoonsOver} {Math.abs(spoonsOver) === 1 ? "spoon" : "spoons"} over today.
            </p>
            {gentler && <div className="mt-3">{gentler}</div>}
            <p className="mt-4 text-sm font-serif italic" style={{ color: "#3D3A34" }}>
              {gentler ? "Or keep it, sometimes you know best. What's going on?" : "Sometimes you know best. What's going on?"}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 mt-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    setCategory(c.key);
                    setStep("reflect");
                  }}
                  className="text-left rounded-lg border px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                  data-testid={`override-cat-${c.key}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <div
              className="rounded-md p-3 mb-3"
              style={{ background: "#F4EEE1", border: "1px solid #DFD5BF" }}
            >
              <p className="text-[10px] uppercase tracking-[0.14em] font-bold mb-1" style={{ color: "#3D3A34" }}>
                Why the free text matters
              </p>
              <p className="text-sm font-serif italic" style={{ color: "#3D3A34" }}>
                One sentence, a paragraph, or a voice memo. Over time, Quiet Hours notices threads across your notes that you'd never spot alone. The tap-answers give categories. The words give truth.
              </p>
            </div>

            <Textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="What's really going on right now?"
              rows={5}
              maxLength={500}
              autoFocus
              data-testid="override-free-text"
            />
            <div className="text-[11px] text-right" style={{ color: "#6D655A" }}>
              {freeText.length}/500
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setStep("choose");
                  setCategory(null);
                }}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => commit.mutate()}
                  disabled={commit.isPending || !category}
                  data-testid="override-skip-text"
                >
                  Skip and confirm
                </Button>
                <Button
                  onClick={() => commit.mutate()}
                  disabled={commit.isPending || !category}
                  data-testid="override-confirm"
                >
                  {commit.isPending ? "Saving" : action === "add" ? "Save and add" : "Save and move"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

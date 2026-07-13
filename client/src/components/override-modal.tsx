// Override modal: fired when a user tries to add commitments that would
// push them past today's spoon limit. Captures a category, always prompts
// for free text (framed with the value-exchange language), and logs the
// override event. When 3+ overrides land within 7 days, a compassionate
// soft interrupt is surfaced before the modal on the next trigger.
//
// Session 2 ships the component and the hook. Session 3 (tasks) wires it
// up to the actual add-task flow.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
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
}

export function OverrideModal({ open, spoonsOver, onCancel, onConfirmed }: OverrideModalProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"choose" | "reflect">("choose");
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

  // Soft interrupt: 3+ overrides in last 7 days
  const showSoftInterrupt = (priorQ.data ?? 0) >= 3;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {step === "choose" ? "Over your spoon limit" : "Say a little more?"}
          </DialogTitle>
        </DialogHeader>

        {showSoftInterrupt && step === "choose" ? (
          <div className="space-y-4">
            <div
              className="rounded-lg p-4 flex gap-3"
              style={{ background: "#F2E1C5", border: "1px solid #D9A55E" }}
            >
              <AlertTriangle className="h-5 w-5 mt-0.5" style={{ color: "#8A5A1F" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#8A5A1F" }}>
                  You've overridden your spoon limit {priorQ.data} times this week.
                </p>
                <p className="text-sm mt-1 font-serif" style={{ color: "#3D3A34" }}>
                  That's the pattern, not the plan. A third override is usually where the crash begins. Want to look at what's been asking too much lately?
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={onCancel}>
                Cancel adding this
              </Button>
              <Link href="/history">
                <Button variant="outline" onClick={onCancel}>
                  See my week
                </Button>
              </Link>
              <Button variant="outline" onClick={() => { /* just proceed to categories */ }}>
                Still override
              </Button>
            </div>
          </div>
        ) : step === "choose" ? (
          <>
            <p className="text-sm font-serif italic" style={{ color: "#3D3A34" }}>
              This puts you {spoonsOver} {Math.abs(spoonsOver) === 1 ? "spoon" : "spoons"} over. Sometimes you know best. What's going on?
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
                  {commit.isPending ? "Saving" : "Save and add"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

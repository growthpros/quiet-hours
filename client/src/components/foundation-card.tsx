// Foundation card (Bottom of the Pyramid) on the Today page.
// Shows the user's enabled pillars and today's progress toward each target.
// Tap a pillar to log or adjust its value. Tap "Add pillar" to create a
// custom pillar. Full editing lives on the Foundation Settings page.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Plus, Check } from "lucide-react";
import {
  listPillars,
  listTodayLogs,
  listLogsForDate,
  upsertTodayLog,
  seedDefaultPillarsIfNeeded,
  getOrCreateProfile,
  type FoundationPillarRow,
  type DailyFoundationLogRow,
  type UserProfileRow,
} from "@/lib/foundation-data";
import { useViewingDate, humanLabel } from "@/lib/viewing-date";
import { DEFAULT_SYMPTOM_CHIPS } from "@/lib/foundation-defaults";
import {
  listEarnBackActions,
  logEarnBack,
  type EarnBackActionRow,
} from "@/lib/spoon-data";

// Phase labels shown on the badge
const PHASE_LABELS: Record<string, string> = {
  acute_recovery: "Acute recovery",
  rebuilding: "Rebuilding",
  steady: "Steady",
  stretch: "Stretch",
  burnout: "Burnout",
};

function displayLabel(p: FoundationPillarRow): string {
  if (p.custom_label && p.custom_label.length > 0) return p.custom_label;
  const map: Record<string, string> = {
    meds: "Meds",
    hydration: "Hydration",
    protein: "Protein",
    movement: "Movement",
    meditation: "Meditation",
    sleep: "Sleep",
    symptoms: "Symptoms",
  };
  return map[p.pillar_key] ?? p.pillar_key;
}

function formatValue(pillar: FoundationPillarRow, log: DailyFoundationLogRow | undefined) {
  if (!log) {
    if (pillar.target_type === "checkbox") return "not yet";
    if (pillar.target_type === "multiselect") return "log now";
    if (pillar.target_value !== null) {
      return `0 / ${pillar.target_value}${pillar.unit ? " " + pillar.unit : ""}`;
    }
    return "not yet";
  }
  if (pillar.target_type === "checkbox") {
    return log.value_bool ? "done" : "not yet";
  }
  if (pillar.target_type === "multiselect") {
    if (!log.value_json) return "log now";
    try {
      const items = JSON.parse(log.value_json) as string[];
      if (items.length === 0) return "none";
      if (items.length === 1) return items[0];
      return `${items.length} logged`;
    } catch {
      return "logged";
    }
  }
  const v = Number(log.value_numeric ?? 0);
  const target = pillar.target_value;
  const unit = pillar.unit ? " " + pillar.unit : "";
  if (target !== null) {
    return `${v} / ${target}${unit}`;
  }
  return `${v}${unit}`;
}

function isMet(pillar: FoundationPillarRow, log: DailyFoundationLogRow | undefined) {
  if (!log) return false;
  if (pillar.target_type === "checkbox") return log.value_bool === true;
  if (pillar.target_type === "multiselect") {
    try {
      const items = JSON.parse(log.value_json ?? "[]") as string[];
      return items.length > 0;
    } catch {
      return false;
    }
  }
  const v = Number(log.value_numeric ?? 0);
  const target = Number(pillar.target_value ?? 0);
  return target > 0 && v >= target;
}

interface LogModalProps {
  pillar: FoundationPillarRow;
  currentLog: DailyFoundationLogRow | undefined;
  open: boolean;
  onClose: () => void;
}

function LogModal({ pillar, currentLog, open, onClose }: LogModalProps) {
  const qc = useQueryClient();
  const [numericValue, setNumericValue] = useState<string>(
    currentLog?.value_numeric != null ? String(currentLog.value_numeric) : "",
  );
  const [checkboxValue, setCheckboxValue] = useState<boolean>(
    currentLog?.value_bool ?? false,
  );
  const initialMulti: string[] = (() => {
    try {
      return JSON.parse(currentLog?.value_json ?? "[]") as string[];
    } catch {
      return [];
    }
  })();
  const [multiValue, setMultiValue] = useState<string[]>(initialMulti);
  const [customChip, setCustomChip] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      let previousValue: number | null = null;
      if (currentLog?.value_numeric != null) previousValue = Number(currentLog.value_numeric);

      let updated: DailyFoundationLogRow;
      if (pillar.target_type === "checkbox") {
        updated = await upsertTodayLog(pillar.id, { valueBool: checkboxValue });
      } else if (pillar.target_type === "multiselect") {
        updated = await upsertTodayLog(pillar.id, {
          valueJson: JSON.stringify(multiValue),
        });
      } else {
        const n = numericValue.trim() === "" ? 0 : Number(numericValue);
        if (Number.isNaN(n)) throw new Error("Enter a number.");
        updated = await upsertTodayLog(pillar.id, { valueNumeric: n });
      }

      // Auto-fire earn-back if the pillar is linked and the target is met
      // this update (and wasn't previously met, so we don't double-fire
      // when the user only changes the note or increments within-target).
      try {
        const actions = await listEarnBackActions();
        const linked = actions.find(
          (a: EarnBackActionRow) =>
            a.enabled && a.linked_pillar_key === pillar.pillar_key,
        );
        if (linked) {
          const target = pillar.target_value !== null ? Number(pillar.target_value) : null;
          let shouldFire = false;
          if (pillar.target_type === "checkbox") {
            shouldFire = checkboxValue && currentLog?.value_bool !== true;
          } else if (pillar.target_type === "multiselect") {
            shouldFire = false; // symptom logs don't earn spoons
          } else if (target != null) {
            const newN = numericValue.trim() === "" ? 0 : Number(numericValue);
            const wasMet = previousValue != null && previousValue >= target;
            shouldFire = newN >= target && !wasMet;
          }
          if (shouldFire) {
            await logEarnBack({
              action: linked,
              durationMinutes: linked.duration_min_minutes ?? null,
              note: `auto-fired from ${pillar.pillar_key}`,
            });
          }
        }
      } catch {
        // Silent: earn-back failure should not block Foundation logging.
      }

      return updated;
    },
    onSuccess: (_data) => {
      qc.invalidateQueries({ queryKey: ["/api/foundation/logs", "today"] });
      qc.invalidateQueries({ queryKey: ["/api/spoon/ledger", "today"] });
      qc.invalidateQueries({ queryKey: ["/api/earn-back/events", "today"] });
      const met = (() => {
        if (pillar.target_type === "checkbox") return checkboxValue;
        if (pillar.target_type === "multiselect") return multiValue.length > 0;
        const n = numericValue.trim() === "" ? 0 : Number(numericValue);
        return pillar.target_value !== null && n >= Number(pillar.target_value);
      })();
      if (met) {
        toast({
          title: `Nice, ${displayLabel(pillar).toLowerCase()} for today.`,
          description: "Small things, compounding.",
        });
      }
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {pillar.icon ? pillar.icon + " " : ""}
            {displayLabel(pillar)}
          </DialogTitle>
        </DialogHeader>

        {pillar.target_type === "checkbox" && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground font-serif italic">
              Just noting whether it happened today.
            </p>
            <div className="flex gap-2">
              <Button
                variant={checkboxValue ? "default" : "outline"}
                onClick={() => setCheckboxValue(true)}
                className="flex-1"
              >
                {checkboxValue && <Check className="mr-2 h-4 w-4" />}
                Done today
              </Button>
              <Button
                variant={!checkboxValue ? "default" : "outline"}
                onClick={() => setCheckboxValue(false)}
                className="flex-1"
              >
                Not yet
              </Button>
            </div>
          </div>
        )}

        {(pillar.target_type === "count" ||
          pillar.target_type === "minutes" ||
          pillar.target_type === "units") && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground font-serif italic">
              {pillar.target_value !== null ? (
                <>Today's target: {pillar.target_value}{pillar.unit ? " " + pillar.unit : ""}.</>
              ) : (
                <>Log whatever you've done today.</>
              )}
            </p>
            <Input
              type="number"
              inputMode="decimal"
              value={numericValue}
              onChange={(e) => setNumericValue(e.target.value)}
              placeholder="0"
              autoFocus
            />
            {pillar.target_value !== null && (
              <div className="flex gap-2 flex-wrap">
                {[0.25, 0.5, 0.75, 1].map((frac) => {
                  const val = Math.round(Number(pillar.target_value) * frac);
                  return (
                    <Button
                      key={frac}
                      size="sm"
                      variant="outline"
                      onClick={() => setNumericValue(String(val))}
                    >
                      {val}{pillar.unit ? " " + pillar.unit : ""}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {pillar.target_type === "multiselect" && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground font-serif italic">
              Tap what's true right now. Add your own if it's not here.
            </p>
            <div className="flex flex-wrap gap-2">
              {[...DEFAULT_SYMPTOM_CHIPS, ...multiValue.filter((v) => !DEFAULT_SYMPTOM_CHIPS.includes(v))].map((chip) => {
                const on = multiValue.includes(chip);
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setMultiValue(on ? multiValue.filter((c) => c !== chip) : [...multiValue, chip]);
                    }}
                    className={
                      "text-sm rounded-full border px-3 py-1.5 transition-colors " +
                      (on
                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]"
                        : "bg-transparent text-foreground border-border hover:bg-muted")
                    }
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <Input
                value={customChip}
                onChange={(e) => setCustomChip(e.target.value)}
                placeholder="Add your own"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customChip.trim().length > 0) {
                    e.preventDefault();
                    const c = customChip.trim().toLowerCase();
                    if (!multiValue.includes(c)) setMultiValue([...multiValue, c]);
                    setCustomChip("");
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const c = customChip.trim().toLowerCase();
                  if (c.length === 0) return;
                  if (!multiValue.includes(c)) setMultiValue([...multiValue, c]);
                  setCustomChip("");
                }}
              >
                Add
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main card ----------
export function FoundationCard() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<FoundationPillarRow | null>(null);
  const { date, isToday } = useViewingDate();

  const profileQ = useQuery<UserProfileRow>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      if (isToday) await seedDefaultPillarsIfNeeded();
      return getOrCreateProfile();
    },
  });

  const pillarsQ = useQuery<FoundationPillarRow[]>({
    queryKey: ["/api/foundation/pillars"],
    queryFn: listPillars,
    enabled: profileQ.data !== undefined,
  });

  const logsQ = useQuery<DailyFoundationLogRow[]>({
    queryKey: ["/api/foundation/logs", date],
    queryFn: () => listLogsForDate(date),
    enabled: profileQ.data !== undefined,
  });

  const enabledPillars = (pillarsQ.data ?? []).filter((p) => p.enabled);
  const logsByPillar = new Map<number, DailyFoundationLogRow>();
  for (const l of logsQ.data ?? []) logsByPillar.set(l.pillar_id, l);

  const phaseLabel = profileQ.data?.current_phase
    ? PHASE_LABELS[profileQ.data.current_phase]
    : "Set your phase";

  const isLoading = profileQ.isLoading || pillarsQ.isLoading || logsQ.isLoading;

  return (
    <>
      <Card
        className="overflow-hidden border-0 relative"
        style={{
          background: "linear-gradient(180deg, #F0D9C7 0%, #F5E2D3 100%)",
        }}
        data-testid="card-foundation"
      >
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            top: -30,
            right: -30,
            width: 140,
            height: 140,
            background: "rgba(216, 155, 122, 0.15)",
          }}
        />
        <div className="relative p-6">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <p className="font-serif text-lg font-medium text-[#2A2620]">
                {isToday ? "Bottom of the Pyramid" : `Foundation, ${humanLabel(date).toLowerCase()}`}
              </p>
              <p className="font-serif italic text-sm text-[#58524A] mt-0.5">
                {isToday
                  ? "The base has to be steady before anything else."
                  : "What your foundation looked like that day."}
              </p>
            </div>
            <Link href="/foundation">
              <span
                className="inline-block text-xs font-semibold px-3 py-1 rounded-full cursor-pointer"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  color: "#2A2620",
                }}
                data-testid="badge-phase"
              >
                {phaseLabel}
              </span>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : enabledPillars.length === 0 ? (
            <div className="rounded-xl bg-white/70 p-6 text-center">
              <p className="font-serif italic text-[#58524A] mb-3">
                No pillars enabled yet. Turn on what matters, edit the targets, or add your own.
              </p>
              <Link href="/foundation">
                <Button variant="outline" data-testid="link-setup-foundation">
                  Set up your Foundation
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-7">
              {enabledPillars.map((p) => {
                const log = logsByPillar.get(p.id);
                const met = isMet(p, log);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (isToday) setSelected(p);
                    }}
                    disabled={!isToday}
                    className={
                      "rounded-xl px-2 py-3 text-center transition-transform " +
                      (isToday ? "hover:-translate-y-0.5" : "cursor-default")
                    }
                    style={{
                      background: "rgba(255,255,255,0.75)",
                      border: met
                        ? "1px solid rgba(143, 160, 90, 0.5)"
                        : "1px solid transparent",
                      opacity: isToday ? 1 : 0.9,
                    }}
                    data-testid={`pillar-${p.pillar_key}`}
                  >
                    <span className="block text-xl leading-none mb-1">
                      {p.icon ?? "•"}
                    </span>
                    <span className="block text-[10px] uppercase tracking-wider text-[#58524A] font-semibold mb-0.5">
                      {displayLabel(p)}
                    </span>
                    <span
                      className={
                        "block font-serif text-sm " +
                        (met ? "text-[#566A2E] font-semibold" : "text-[#2A2620]")
                      }
                    >
                      {met && <Check className="inline h-3 w-3 mr-0.5 -mt-0.5" />}
                      {formatValue(p, log)}
                    </span>
                  </button>
                );
              })}
              {isToday && (
                <Link href="/foundation">
                  <button
                    type="button"
                    className="flex flex-col items-center justify-center rounded-xl px-2 py-3 h-full min-h-[76px] transition-colors hover:bg-white/40"
                    style={{
                      border: "1.5px dashed rgba(216, 155, 122, 0.5)",
                      color: "#58524A",
                    }}
                    data-testid="button-add-pillar"
                  >
                    <Plus className="h-5 w-5 mb-1" strokeWidth={1.5} />
                    <span className="text-[10px] uppercase tracking-wider font-semibold">
                      Add pillar
                    </span>
                  </button>
                </Link>
              )}
            </div>
          )}
        </div>
      </Card>

      {selected && isToday && (
        <LogModal
          pillar={selected}
          currentLog={logsByPillar.get(selected.id)}
          open={true}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

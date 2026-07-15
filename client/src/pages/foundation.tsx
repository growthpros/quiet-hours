// Foundation settings page.
// Session 1 scope: list all pillars with enable/disable toggles and target
// editing. Add custom pillars. Set current phase.
// Deeper phase-driven behavior and add-your-own-earn-back-actions come in
// Session 2.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  listPillars,
  updatePillar,
  createCustomPillar,
  deletePillar,
  seedDefaultPillarsIfNeeded,
  getOrCreateProfile,
  updateProfile,
  type FoundationPillarRow,
  type UserProfileRow,
} from "@/lib/foundation-data";

const PHASE_OPTIONS = [
  { key: "acute_recovery", label: "Acute recovery", desc: "The immediate now. Meds, hydration, protein, rest." },
  { key: "rebuilding", label: "Rebuilding", desc: "Adding gentle movement, longer walks, sleep window." },
  { key: "steady", label: "Steady", desc: "Full foundation, work rhythm, boundaries." },
  { key: "stretch", label: "Stretch", desc: "Higher activity, training goals, longer focus blocks." },
  { key: "burnout", label: "Burnout", desc: "Backing off. Foundation only. Nothing extra." },
];

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

export default function Foundation() {
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("•");
  const [newTarget, setNewTarget] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newType, setNewType] = useState<"checkbox" | "count" | "minutes" | "units">("count");

  const profileQ = useQuery<UserProfileRow>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      await seedDefaultPillarsIfNeeded();
      return getOrCreateProfile();
    },
  });

  const pillarsQ = useQuery<FoundationPillarRow[]>({
    queryKey: ["/api/foundation/pillars"],
    queryFn: listPillars,
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) =>
      updatePillar(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/foundation/pillars"] }),
  });

  const editTarget = useMutation({
    mutationFn: async ({ id, target }: { id: number; target: number | null }) =>
      updatePillar(id, { targetValue: target }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/foundation/pillars"] }),
  });

  const removePillar = useMutation({
    mutationFn: async (id: number) => deletePillar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/foundation/pillars"] });
      qc.invalidateQueries({ queryKey: ["/api/foundation/logs"] });
      toast({ title: "Pillar removed." });
    },
  });

  const addCustom = useMutation({
    mutationFn: async () => {
      const target = newType === "checkbox" ? null : (newTarget.trim() === "" ? null : Number(newTarget));
      const nextSort = (pillarsQ.data?.length ?? 0) + 1;
      return createCustomPillar({
        customLabel: newLabel.trim(),
        icon: newIcon.trim() || "•",
        targetType: newType,
        targetValue: target,
        unit: newUnit.trim() || null,
        sortOrder: nextSort,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/foundation/pillars"] });
      setNewLabel("");
      setNewIcon("•");
      setNewTarget("");
      setNewUnit("");
      toast({ title: "Pillar added." });
    },
  });

  const savePhase = useMutation({
    mutationFn: async (phase: string) =>
      updateProfile({ current_phase: phase as UserProfileRow["current_phase"] }),
    onSuccess: (data) => {
      qc.setQueryData(["/api/profile"], data);
      toast({ title: "Phase updated." });
    },
  });

  const isLoading = profileQ.isLoading || pillarsQ.isLoading;

  return (
    <div className="space-y-10">
      <div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="-ml-3 mb-4" data-testid="link-back-to-today">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Today
          </Button>
        </Link>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Foundation
        </h1>
        <p className="font-serif italic text-muted-foreground mt-1">
          The base has to be steady before anything else. Set what matters, edit the targets, or add your own.
        </p>
      </div>

      {/* Current phase */}
      <section className="space-y-3">
        <h2 className="font-serif text-lg font-medium">Current phase</h2>
        <p className="text-sm text-muted-foreground">
          Sets defaults and prompts across the app. You can change this anytime.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PHASE_OPTIONS.map((opt) => {
            const active = profileQ.data?.current_phase === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => savePhase.mutate(opt.key)}
                className={
                  "text-left rounded-lg border p-4 transition-colors " +
                  (active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted")
                }
                data-testid={`phase-${opt.key}`}
              >
                <p className="font-serif font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Pillars */}
      <section className="space-y-3">
        <h2 className="font-serif text-lg font-medium">Pillars</h2>
        <p className="text-sm text-muted-foreground">
          Toggle what applies. Edit any target. Nothing here is required.
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {(pillarsQ.data ?? []).map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-2xl">{p.icon ?? "•"}</span>
                  <div className="flex-1 min-w-[8rem]">
                    <p className="font-medium">{displayLabel(p)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.target_type === "checkbox" && "Simple yes-or-no each day."}
                      {p.target_type === "count" && p.target_value !== null &&
                        `Target: ${p.target_value}${p.unit ? " " + p.unit : ""}`}
                      {p.target_type === "minutes" && p.target_value !== null &&
                        `Target: ${p.target_value} min`}
                      {p.target_type === "units" && p.target_value !== null &&
                        `Target: ${p.target_value}${p.unit ? " " + p.unit : ""}`}
                      {p.target_type === "multiselect" && "Tap what applies each day."}
                    </p>
                  </div>

                  {p.target_type !== "checkbox" && p.target_type !== "multiselect" && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`target-${p.id}`} className="text-xs sr-only">
                        Target
                      </Label>
                      <Input
                        id={`target-${p.id}`}
                        type="number"
                        defaultValue={p.target_value ?? ""}
                        className="w-20"
                        onBlur={(e) => {
                          const raw = e.target.value.trim();
                          const val = raw === "" ? null : Number(raw);
                          if (val !== p.target_value) {
                            editTarget.mutate({ id: p.id, target: val });
                          }
                        }}
                        data-testid={`input-target-${p.pillar_key}`}
                      />
                      {p.unit && (
                        <span className="text-xs text-muted-foreground">{p.unit}</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Label htmlFor={`enabled-${p.id}`} className="text-xs">
                      {p.enabled ? "On" : "Off"}
                    </Label>
                    <Switch
                      id={`enabled-${p.id}`}
                      checked={p.enabled}
                      onCheckedChange={(v) =>
                        toggleEnabled.mutate({ id: p.id, enabled: v })
                      }
                      data-testid={`switch-enabled-${p.pillar_key}`}
                    />
                  </div>

                  {p.pillar_key === "custom" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Remove this pillar? Historic logs for it will also be removed.")) {
                          removePillar.mutate(p.id);
                        }
                      }}
                      data-testid={`button-delete-${p.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Add custom */}
      <section className="space-y-3">
        <h2 className="font-serif text-lg font-medium">Add your own pillar</h2>
        <p className="text-sm text-muted-foreground">
          Recovery Meeting, journaling, sunlight, blood sugar check. Whatever's a base for your wellbeing.
        </p>
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-[80px_1fr_140px_100px_100px_auto]">
            <div>
              <Label htmlFor="new-icon" className="text-xs">Icon</Label>
              <Input
                id="new-icon"
                value={newIcon}
                onChange={(e) => setNewIcon(e.target.value)}
                placeholder="🌱"
                maxLength={2}
              />
            </div>
            <div>
              <Label htmlFor="new-label" className="text-xs">Label</Label>
              <Input
                id="new-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Recovery meeting"
              />
            </div>
            <div>
              <Label htmlFor="new-type" className="text-xs">Type</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
                <SelectTrigger id="new-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checkbox">Yes / no</SelectItem>
                  <SelectItem value="count">Count</SelectItem>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="units">Units</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-target" className="text-xs">Target</Label>
              <Input
                id="new-target"
                type="number"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="1"
                disabled={newType === "checkbox"}
              />
            </div>
            <div>
              <Label htmlFor="new-unit" className="text-xs">Unit</Label>
              <Input
                id="new-unit"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="oz"
                disabled={newType === "checkbox"}
              />
            </div>
            <div className="self-end">
              <Button
                onClick={() => addCustom.mutate()}
                disabled={newLabel.trim().length === 0 || addCustom.isPending}
                data-testid="button-add-pillar"
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

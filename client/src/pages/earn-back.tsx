// Earn-back customization page.
// Toggle actions on/off, edit spoon values and daily caps, mark as featured
// (shows up on Today's quick-earn cluster), and add-your-own custom actions.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trash2, Star, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  listEarnBackActions,
  updateEarnBackAction,
  createEarnBackAction,
  deleteEarnBackAction,
  seedDefaultEarnBackIfNeeded,
  type EarnBackActionRow,
} from "@/lib/spoon-data";

export default function EarnBack() {
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("✨");
  const [newValue, setNewValue] = useState("1");
  const [newCap, setNewCap] = useState("3");
  const [newDuration, setNewDuration] = useState("");

  const actionsQ = useQuery<EarnBackActionRow[]>({
    queryKey: ["/api/earn-back/actions"],
    queryFn: async () => {
      await seedDefaultEarnBackIfNeeded();
      return listEarnBackActions();
    },
  });

  const patch = useMutation({
    mutationFn: async ({ id, ...rest }: { id: number; label?: string; spoonValue?: number; dailyCap?: number; durationMinMinutes?: number | null; featured?: boolean; enabled?: boolean }) => {
      const { id: _ignore, ...p } = { id, ...rest };
      return updateEarnBackAction(id, p);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/earn-back/actions"] }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => deleteEarnBackAction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/earn-back/actions"] });
      toast({ title: "Removed." });
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const nextSort = (actionsQ.data?.length ?? 0) + 1;
      const dur = newDuration.trim() === "" ? null : Number(newDuration);
      return createEarnBackAction({
        label: newLabel.trim(),
        icon: newIcon.trim() || "✨",
        spoonValue: Number(newValue),
        dailyCap: Number(newCap),
        durationMinMinutes: dur,
        featured: false,
        sortOrder: nextSort,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/earn-back/actions"] });
      setNewLabel("");
      setNewIcon("✨");
      setNewValue("1");
      setNewCap("3");
      setNewDuration("");
      toast({ title: "Added." });
    },
  });

  const isLoading = actionsQ.isLoading;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="-ml-3 mb-4" data-testid="link-back-to-today">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Today
          </Button>
        </Link>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Earn back
        </h1>
        <p className="font-serif italic text-muted-foreground mt-1">
          Small returns to your body. Each action earns per instance, up to its daily cap. A 15-minute meditation earns the same as a 5-minute one, to earn more, do it more times.
        </p>
      </div>

      {/* Featured note */}
      <Card className="p-4 border-l-4" style={{ borderLeftColor: "#8FA05A" }}>
        <p className="text-sm">
          <strong className="font-semibold">Featured actions</strong> (marked with a star) appear on your Today page as one-tap chips. Star up to 6 of them.
        </p>
      </Card>

      {/* List */}
      <section className="space-y-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))
        ) : (
          (actionsQ.data ?? []).map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-2xl">{a.icon ?? "•"}</span>
                <div className="flex-1 min-w-[10rem]">
                  <p className="font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.duration_min_minutes
                      ? `Needs at least ${a.duration_min_minutes} min per instance.`
                      : "Instance-only, no minimum duration."}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Value</Label>
                  <Input
                    type="number"
                    step="0.5"
                    defaultValue={a.spoon_value}
                    className="w-20"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v) && v !== Number(a.spoon_value)) {
                        patch.mutate({ id: a.id, spoonValue: v });
                      }
                    }}
                    data-testid={`input-value-${a.action_key}`}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Cap</Label>
                  <Input
                    type="number"
                    step="1"
                    defaultValue={a.daily_cap}
                    className="w-16"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v) && v !== Number(a.daily_cap)) {
                        patch.mutate({ id: a.id, dailyCap: v });
                      }
                    }}
                    data-testid={`input-cap-${a.action_key}`}
                  />
                </div>

                {a.duration_min_minutes != null && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Min min</Label>
                    <Input
                      type="number"
                      defaultValue={a.duration_min_minutes ?? ""}
                      className="w-16"
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const v = raw === "" ? null : Number(raw);
                        if (v !== a.duration_min_minutes) {
                          patch.mutate({ id: a.id, durationMinMinutes: v });
                        }
                      }}
                      data-testid={`input-duration-${a.action_key}`}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => patch.mutate({ id: a.id, featured: !a.featured })}
                  className="p-2 rounded-md hover:bg-muted transition-colors"
                  aria-label={a.featured ? "Un-feature" : "Feature on Today"}
                  data-testid={`toggle-featured-${a.action_key}`}
                >
                  <Star
                    className="h-4 w-4"
                    fill={a.featured ? "#D9A55E" : "transparent"}
                    stroke={a.featured ? "#D9A55E" : "currentColor"}
                  />
                </button>

                <div className="flex items-center gap-2">
                  <Label className="text-xs">{a.enabled ? "On" : "Off"}</Label>
                  <Switch
                    checked={a.enabled}
                    onCheckedChange={(v) => patch.mutate({ id: a.id, enabled: v })}
                    data-testid={`toggle-enabled-${a.action_key}`}
                  />
                </div>

                {a.action_key.startsWith("custom_") && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm("Remove this action? Past earn events keep the record.")) {
                        del.mutate(a.id);
                      }
                    }}
                    data-testid={`button-delete-${a.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </section>

      {/* Add custom */}
      <section className="space-y-3">
        <h2 className="font-serif text-lg font-medium">Add your own</h2>
        <p className="text-sm text-muted-foreground">
          Walking the dog, sitting outside for 10 min, calling my sister, playing with the cat. Whatever restores you.
        </p>
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-[60px_1fr_90px_80px_100px_auto]">
            <div>
              <Label htmlFor="new-icon" className="text-xs">Icon</Label>
              <Input id="new-icon" value={newIcon} onChange={(e) => setNewIcon(e.target.value)} maxLength={2} />
            </div>
            <div>
              <Label htmlFor="new-label" className="text-xs">Label</Label>
              <Input id="new-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Walked the dog" />
            </div>
            <div>
              <Label htmlFor="new-value" className="text-xs">Value</Label>
              <Input id="new-value" type="number" step="0.5" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="new-cap" className="text-xs">Daily cap</Label>
              <Input id="new-cap" type="number" step="1" value={newCap} onChange={(e) => setNewCap(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="new-duration" className="text-xs">Min min (optional)</Label>
              <Input id="new-duration" type="number" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} placeholder="none" />
            </div>
            <div className="self-end">
              <Button
                onClick={() => add.mutate()}
                disabled={newLabel.trim().length === 0 || add.isPending}
                data-testid="button-add-earn-back"
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

// Earn-back page: switch actions on or off, change what they're worth, star
// up to 6 for Today, rename any of them, and add your own. Spoon model
// change 3 added the updated starting list, plainer labels, ⓘ explanations
// and a check on the numbers (see lib/earn-back.ts).

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
import { InfoTip } from "@/components/info-tip";
import { EXPLAIN } from "@/lib/explainers";
import { earnBackActionError, updatedDefaults, MAX_EARN_BACK_VALUE, MAX_TIMES_A_DAY } from "@/lib/earn-back";
import {
  listEarnBackActions,
  updateEarnBackAction,
  createEarnBackAction,
  deleteEarnBackAction,
  seedDefaultEarnBackIfNeeded,
  applyUpdatedEarnBackDefaults,
  type EarnBackActionRow,
} from "@/lib/spoon-data";

function spoonsText(n: number): string {
  return `+${n} spoon${n === 1 ? "" : "s"}`;
}

function FieldLabel({ htmlFor, text, info }: { htmlFor?: string; text: string; info: string }) {
  return (
    <div className="flex items-center gap-0.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {text}
      </Label>
      <InfoTip label={text.toLowerCase()}>
        <p>{info}</p>
      </InfoTip>
    </div>
  );
}

export default function EarnBack() {
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("✨");
  const [newValue, setNewValue] = useState("0.5");
  const [newCap, setNewCap] = useState("2");
  const [newDuration, setNewDuration] = useState("");

  const actionsQ = useQuery<EarnBackActionRow[]>({
    queryKey: ["/api/earn-back/actions"],
    queryFn: async () => {
      await seedDefaultEarnBackIfNeeded();
      return listEarnBackActions();
    },
  });

  const fail = (title: string) => (e: unknown) =>
    toast({ title, description: e instanceof Error ? e.message : String(e) });

  const patch = useMutation({
    mutationFn: async ({ id, ...p }: { id: number; label?: string; spoonValue?: number; dailyCap?: number; durationMinMinutes?: number | null; featured?: boolean; enabled?: boolean }) =>
      updateEarnBackAction(id, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/earn-back/actions"] }),
    onError: fail("Couldn't save that"),
  });

  const del = useMutation({
    mutationFn: async (id: number) => deleteEarnBackAction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/earn-back/actions"] });
      toast({ title: "Removed." });
    },
    onError: fail("Couldn't remove it"),
  });

  const switchList = useMutation({
    mutationFn: applyUpdatedEarnBackDefaults,
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["/api/earn-back/actions"] });
      toast({ title: "Updated.", description: `${n} built-in item${n === 1 ? "" : "s"} now match the updated starting list.` });
    },
    onError: fail("Couldn't update the list"),
  });

  const addError = earnBackActionError({ label: newLabel, spoonValue: newValue, dailyCap: newCap, minutes: newDuration });
  const add = useMutation({
    mutationFn: async () => {
      if (addError) throw new Error(addError);
      const nextSort = (actionsQ.data?.length ?? 0) + 1;
      return createEarnBackAction({
        label: newLabel.trim(),
        icon: newIcon.trim() || "✨",
        spoonValue: Number(newValue),
        dailyCap: Number(newCap),
        durationMinMinutes: newDuration.trim() === "" ? null : Number(newDuration),
        featured: false,
        sortOrder: nextSort,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/earn-back/actions"] });
      setNewLabel("");
      setNewIcon("✨");
      setNewValue("0.5");
      setNewCap("2");
      setNewDuration("");
      toast({ title: "Added." });
    },
    onError: fail("Couldn't add it"),
  });

  // Saves a changed number on an existing row, after the same check as new items.
  const saveNumber = (a: EarnBackActionRow, field: "spoonValue" | "dailyCap" | "durationMinMinutes", raw: string) => {
    const current = {
      label: a.label,
      spoonValue: String(a.spoon_value),
      dailyCap: String(a.daily_cap),
      minutes: a.duration_min_minutes == null ? "" : String(a.duration_min_minutes),
    };
    const next = {
      ...current,
      ...(field === "spoonValue" ? { spoonValue: raw } : field === "dailyCap" ? { dailyCap: raw } : { minutes: raw }),
    };
    const unchanged =
      (field === "spoonValue" && raw === current.spoonValue) ||
      (field === "dailyCap" && raw === current.dailyCap) ||
      (field === "durationMinMinutes" && raw.trim() === current.minutes);
    if (unchanged) return;
    const err = earnBackActionError(next);
    if (err) {
      toast({ title: "Not saved", description: err });
      return;
    }
    if (field === "durationMinMinutes") patch.mutate({ id: a.id, durationMinMinutes: raw.trim() === "" ? null : Number(raw) });
    else patch.mutate({ id: a.id, [field]: Number(raw) });
  };

  const actions = actionsQ.data ?? [];
  const update = updatedDefaults(actions);
  const updateCount = update.changes.length + update.missing.length;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/">
          <Button variant="ghost" size="sm" className="-ml-3 mb-4" data-testid="link-back-to-today">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Today
          </Button>
        </Link>
        <h1 className="flex items-center gap-1.5 font-serif text-3xl font-semibold tracking-tight">
          Earn back
          <InfoTip label="earn back" testId="info-earn-back">
            <p>{EXPLAIN.earnBack}</p>
            <p className="text-muted-foreground">{EXPLAIN.estimateNote}</p>
          </InfoTip>
        </h1>
        <p className="font-serif italic text-muted-foreground mt-1">
          Small things that give some energy back. Each one adds its spoons every time you log it, up to its limit for the day.
        </p>
      </div>

      {!actionsQ.isLoading && updateCount > 0 && (
        <Card className="space-y-3 p-4 border-l-4" style={{ borderLeftColor: "#8FA05A" }} data-testid="card-updated-list">
          <p className="flex items-center gap-1 text-sm font-semibold">
            An updated starting list
            <InfoTip label="the updated starting list" testId="info-updated-list">
              <p>{EXPLAIN.updatedList}</p>
            </InfoTip>
          </p>
          <ul className="space-y-0.5 text-sm text-muted-foreground">
            {update.changes.map((c) => (
              <li key={c.id}>
                {c.label}: {spoonsText(c.spoonValue)}, {c.dailyCap === 1 ? "once a day" : `up to ${c.dailyCap} a day`}
                {c.durationMinMinutes ? `, from ${c.durationMinMinutes} min` : ""}
              </li>
            ))}
            {update.missing.map((m) => (
              <li key={m.actionKey}>
                New: {m.label}, {spoonsText(m.spoonValue)}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Only the built-in items change. Your own items, and what you've switched on, off or starred, stay as they are.
          </p>
          <Button size="sm" onClick={() => switchList.mutate()} disabled={switchList.isPending} data-testid="button-use-updated-list">
            Use the updated starting list
          </Button>
        </Card>
      )}

      <Card className="p-4 border-l-4" style={{ borderLeftColor: "#8FA05A" }}>
        <p className="text-sm">
          <strong className="font-semibold">Starred items</strong> appear on your Today page as one-tap chips. Star up to 6.
        </p>
      </Card>

      <section className="space-y-2">
        {actionsQ.isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
          : actions.map((a) => (
              <Card key={a.id} className="p-4" data-testid={`row-earn-back-${a.action_key}`}>
                <div className="flex flex-wrap items-end gap-3">
                  <span className="text-2xl self-center">{a.icon ?? "•"}</span>
                  <div className="flex-1 min-w-[12rem]">
                    <Label htmlFor={`label-${a.id}`} className="sr-only">
                      Name
                    </Label>
                    <Input
                      id={`label-${a.id}`}
                      defaultValue={a.label}
                      className="border-transparent bg-transparent px-1 font-medium shadow-none hover:border-border focus:border-border"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (!v) {
                          e.target.value = a.label;
                          return;
                        }
                        if (v !== a.label) patch.mutate({ id: a.id, label: v });
                      }}
                      data-testid={`input-label-${a.action_key}`}
                    />
                    <p className="px-1 text-xs text-muted-foreground">
                      {a.duration_min_minutes ? `Counts from ${a.duration_min_minutes} minutes.` : "Counts when it happens."}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <FieldLabel htmlFor={`value-${a.id}`} text="Spoons back" info={EXPLAIN.spoonsBack} />
                    <Input
                      id={`value-${a.id}`}
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min={0.5}
                      max={MAX_EARN_BACK_VALUE}
                      defaultValue={a.spoon_value}
                      className="w-20"
                      onBlur={(e) => saveNumber(a, "spoonValue", e.target.value)}
                      data-testid={`input-value-${a.action_key}`}
                    />
                  </div>

                  <div className="space-y-1">
                    <FieldLabel htmlFor={`cap-${a.id}`} text="Times a day" info={EXPLAIN.timesADay} />
                    <Input
                      id={`cap-${a.id}`}
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min={1}
                      max={MAX_TIMES_A_DAY}
                      defaultValue={a.daily_cap}
                      className="w-20"
                      onBlur={(e) => saveNumber(a, "dailyCap", e.target.value)}
                      data-testid={`input-cap-${a.action_key}`}
                    />
                  </div>

                  <div className="space-y-1">
                    <FieldLabel htmlFor={`minutes-${a.id}`} text="Minutes needed" info={EXPLAIN.minutesNeeded} />
                    <Input
                      id={`minutes-${a.id}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      defaultValue={a.duration_min_minutes ?? ""}
                      placeholder="none"
                      className="w-20"
                      onBlur={(e) => saveNumber(a, "durationMinMinutes", e.target.value)}
                      data-testid={`input-duration-${a.action_key}`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => patch.mutate({ id: a.id, featured: !a.featured })}
                    className="p-2 rounded-md hover:bg-muted transition-colors"
                    aria-label={a.featured ? "Remove the star" : "Star for Today"}
                    data-testid={`toggle-featured-${a.action_key}`}
                  >
                    <Star
                      className="h-4 w-4"
                      fill={a.featured ? "#D9A55E" : "transparent"}
                      stroke={a.featured ? "#D9A55E" : "currentColor"}
                    />
                  </button>

                  <div className="flex items-center gap-2 pb-2">
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
                        if (confirm("Remove this item? What you've already logged stays in your history.")) {
                          del.mutate(a.id);
                        }
                      }}
                      aria-label={`Remove ${a.label}`}
                      data-testid={`button-delete-${a.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-lg font-medium">Add your own</h2>
        <p className="text-sm text-muted-foreground">
          Anything that restores you or that you want to do more of: stretching, step work, a favorite audio track, walking the dog, calling a friend.
        </p>
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-[60px_1fr_100px_100px_120px_auto]">
            <div className="space-y-1">
              <Label htmlFor="new-icon" className="text-xs text-muted-foreground">
                Icon
              </Label>
              <Input id="new-icon" value={newIcon} onChange={(e) => setNewIcon(e.target.value)} maxLength={2} data-testid="input-new-icon" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-label" className="text-xs text-muted-foreground">
                Name
              </Label>
              <Input
                id="new-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Stretching"
                data-testid="input-new-label"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="new-value" text="Spoons back" info={EXPLAIN.spoonsBack} />
              <Input
                id="new-value"
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0.5}
                max={MAX_EARN_BACK_VALUE}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                data-testid="input-new-value"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="new-cap" text="Times a day" info={EXPLAIN.timesADay} />
              <Input
                id="new-cap"
                type="number"
                inputMode="numeric"
                step="1"
                min={1}
                max={MAX_TIMES_A_DAY}
                value={newCap}
                onChange={(e) => setNewCap(e.target.value)}
                data-testid="input-new-cap"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="new-duration" text="Minutes needed" info={EXPLAIN.minutesNeeded} />
              <Input
                id="new-duration"
                type="number"
                inputMode="numeric"
                min={1}
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                placeholder="none"
                data-testid="input-new-duration"
              />
            </div>
            <div className="self-end">
              <Button
                onClick={() => add.mutate()}
                disabled={!newLabel.trim() || add.isPending}
                data-testid="button-add-earn-back"
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
          </div>
          {newLabel.trim() && addError && (
            <p className="mt-2 text-xs text-muted-foreground" data-testid="text-add-error">
              {addError}
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}

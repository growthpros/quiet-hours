// Settings card: "On an ordinary okay day, how much can you get through?"
// Each day's spoons start from this number (see lib/daily-budget.ts).

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { InfoTip } from "@/components/info-tip";
import { EXPLAIN } from "@/lib/explainers";
import { getOrCreateProfile, updateProfile, type UserProfileRow } from "@/lib/foundation-data";
import { DEFAULT_USUAL, USUAL_CHOICES, USUAL_MAX, USUAL_MIN } from "@/lib/daily-budget";

const OWN = "own";

export function OrdinaryDayCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const profileQ = useQuery<UserProfileRow>({ queryKey: ["/api/profile"], queryFn: getOrCreateProfile });
  const saved = profileQ.data?.usual_budget;
  const savedNum = saved == null ? null : Number(saved);
  const isChoice = savedNum != null && USUAL_CHOICES.some((c) => c.spoons === savedNum);

  const [choice, setChoice] = useState<string>("");
  const [own, setOwn] = useState("");
  useEffect(() => {
    if (savedNum == null) return;
    if (isChoice) setChoice(String(savedNum));
    else {
      setChoice(OWN);
      setOwn(String(savedNum));
    }
  }, [savedNum, isChoice]);

  const save = useMutation({
    mutationFn: async (n: number) => updateProfile({ usual_budget: n }),
    onSuccess: (_d, n) => {
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      qc.invalidateQueries({ queryKey: ["user_profile"] });
      toast({ title: "Saved.", description: `An ordinary okay day is ${n} spoons.` });
    },
    onError: (e) => {
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : String(e) });
    },
  });

  const ownNum = Number(own);
  const ownValid = own.trim() !== "" && Number.isFinite(ownNum) && ownNum >= USUAL_MIN && ownNum <= USUAL_MAX;

  return (
    <Card data-testid="card-ordinary-day">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          Your ordinary okay day
          <InfoTip label="an ordinary okay day" testId="info-ordinary-day">
            <p>{EXPLAIN.ordinaryDay}</p>
            <p className="text-muted-foreground">{EXPLAIN.estimateNote}</p>
          </InfoTip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-serif text-sm italic text-muted-foreground">
          On an ordinary okay day, how much can you get through?
          {savedNum == null && ` Until you choose, the app uses ${DEFAULT_USUAL} spoons.`}
        </p>
        <RadioGroup
          value={choice}
          onValueChange={(v) => {
            setChoice(v);
            if (v !== OWN) save.mutate(Number(v));
          }}
          className="space-y-2"
        >
          {USUAL_CHOICES.map((c) => (
            <div key={c.spoons} className="flex items-center gap-2">
              <RadioGroupItem
                value={String(c.spoons)}
                id={`usual-${c.spoons}`}
                disabled={save.isPending}
                data-testid={`radio-usual-${c.spoons}`}
              />
              <Label htmlFor={`usual-${c.spoons}`} className="font-normal">
                {c.label} <span className="text-muted-foreground">({c.spoons} spoons)</span>
              </Label>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <RadioGroupItem value={OWN} id="usual-own" disabled={save.isPending} data-testid="radio-usual-own" />
            <Label htmlFor="usual-own" className="font-normal">
              My own number
            </Label>
          </div>
        </RadioGroup>
        {choice === OWN && (
          <div className="flex flex-wrap items-center gap-2 pl-6">
            <Input
              type="number"
              inputMode="decimal"
              min={USUAL_MIN}
              max={USUAL_MAX}
              step={0.5}
              value={own}
              onChange={(e) => setOwn(e.target.value)}
              className="w-24"
              aria-label="Spoons on an ordinary okay day"
              data-testid="input-usual-own"
            />
            <span className="text-sm text-muted-foreground">spoons</span>
            <Button
              size="sm"
              disabled={!ownValid || save.isPending}
              onClick={() => save.mutate(Math.round(ownNum * 2) / 2)}
              data-testid="button-usual-own-save"
            >
              Save
            </Button>
            <span className="w-full text-xs text-muted-foreground">
              Anything from {USUAL_MIN} to {USUAL_MAX}.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

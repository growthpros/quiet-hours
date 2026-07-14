// Settings card for choosing the check-in cadence.
// Voice: notice, don't grade. No urgent language. No red.

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import {
  getOrCreateProfile,
  updateProfile,
  type UserProfileRow,
  type CheckinCadence,
} from "@/lib/foundation-data";

interface CadenceOption {
  value: CheckinCadence;
  label: string;
  description: string;
}

const OPTIONS: CadenceOption[] = [
  {
    value: "off",
    label: "Off",
    description: "No nudges. Come back when you feel like it.",
  },
  {
    value: "morning",
    label: "Morning only",
    description:
      "One gentle nudge the first time you open the app after 5am.",
  },
  {
    value: "every_hour",
    label: "Every hour",
    description: "For days when noticing early keeps things smaller.",
  },
  {
    value: "every_2h",
    label: "Every 2 hours",
    description: "A quiet rhythm across a working day.",
  },
  {
    value: "every_3h",
    label: "Every 3 hours",
    description: "A lighter touch, three or four times a day.",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Pick your own interval, 15 to 720 minutes.",
  },
];

export function CheckInCadenceCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const profileQ = useQuery<UserProfileRow>({
    queryKey: ["user_profile"],
    queryFn: getOrCreateProfile,
    staleTime: 60_000,
  });

  const [cadence, setCadence] = useState<CheckinCadence>("off");
  const [customMinutes, setCustomMinutes] = useState<string>("60");
  const [dirty, setDirty] = useState(false);

  // Seed local state once the profile loads.
  useEffect(() => {
    if (!profileQ.data) return;
    setCadence(profileQ.data.checkin_cadence);
    setCustomMinutes(
      profileQ.data.checkin_cadence_minutes != null
        ? String(profileQ.data.checkin_cadence_minutes)
        : "60",
    );
    setDirty(false);
  }, [profileQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      const patch: {
        checkin_cadence: CheckinCadence;
        checkin_cadence_minutes: number | null;
      } = {
        checkin_cadence: cadence,
        checkin_cadence_minutes:
          cadence === "custom" ? Number(customMinutes) : null,
      };
      // Validate custom minutes before hitting the network.
      if (cadence === "custom") {
        const n = Number(customMinutes);
        if (!Number.isFinite(n) || n < 15 || n > 720) {
          throw new Error(
            "Custom minutes must be between 15 and 720.",
          );
        }
      }
      await updateProfile(patch);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_profile"] });
      setDirty(false);
      toast({ title: "Cadence saved." });
    },
    onError: (e) => {
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  const showCustomInput = cadence === "custom";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Check-in cadence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="font-serif text-sm italic text-muted-foreground">
          A gentle in-app nudge, on your rhythm. Never modal, never a
          notification. When you're in the app, a soft banner offers a
          five-minute burnout check-in. You can dismiss it, and it snoozes
          for the rest of the interval.
        </p>

        <RadioGroup
          value={cadence}
          onValueChange={(v) => {
            setCadence(v as CheckinCadence);
            setDirty(true);
          }}
          className="space-y-3"
        >
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              htmlFor={`cadence-${opt.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition hover:bg-muted/40"
              data-testid={`radio-cadence-${opt.value}`}
            >
              <RadioGroupItem
                value={opt.value}
                id={`cadence-${opt.value}`}
                className="mt-1"
              />
              <div className="space-y-0.5">
                <p className="font-serif text-base text-foreground">
                  {opt.label}
                </p>
                <p className="font-serif text-sm italic text-muted-foreground">
                  {opt.description}
                </p>
              </div>
            </label>
          ))}
        </RadioGroup>

        {showCustomInput && (
          <div className="space-y-2">
            <Label
              htmlFor="cadence-custom-minutes"
              className="text-sm text-foreground"
            >
              Interval (minutes)
            </Label>
            <Input
              id="cadence-custom-minutes"
              type="number"
              min={15}
              max={720}
              step={5}
              value={customMinutes}
              onChange={(e) => {
                setCustomMinutes(e.target.value);
                setDirty(true);
              }}
              className="max-w-[180px]"
              data-testid="input-cadence-custom-minutes"
            />
            <p className="text-xs italic text-muted-foreground">
              Anywhere from 15 minutes to 12 hours.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending || profileQ.isLoading}
            data-testid="button-save-cadence"
          >
            {save.isPending ? "Saving\u2026" : "Save"}
          </Button>
          {!dirty && !save.isPending && (
            <span className="font-serif text-xs italic text-muted-foreground">
              Up to date.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

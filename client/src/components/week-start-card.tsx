// Settings card for choosing which day the week starts.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { updateProfile, type WeekStart } from "@/lib/foundation-data";
import { useWeekStart } from "@/lib/use-week-start";

const OPTIONS: { value: WeekStart; label: string }[] = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 6, label: "Saturday" },
];

export function WeekStartCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const current = useWeekStart();

  const save = useMutation({
    mutationFn: async (v: WeekStart) => updateProfile({ week_starts_on: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      qc.invalidateQueries({ queryKey: ["user_profile"] });
      toast({ title: "Saved." });
    },
    onError: (e) => {
      toast({
        title: "Couldn't save",
        description: e instanceof Error ? e.message : String(e),
      });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Week starts on
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-serif text-sm italic text-muted-foreground">
          Used by the Calendar and the This week and Next week filters.
        </p>
        <RadioGroup
          value={String(current)}
          onValueChange={(v) => save.mutate(Number(v) as WeekStart)}
          className="flex flex-wrap gap-4"
        >
          {OPTIONS.map((o) => (
            <div key={o.value} className="flex items-center gap-2">
              <RadioGroupItem
                value={String(o.value)}
                id={`week-start-${o.value}`}
                disabled={save.isPending}
                data-testid={`radio-week-start-${o.value}`}
              />
              <Label htmlFor={`week-start-${o.value}`}>{o.label}</Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

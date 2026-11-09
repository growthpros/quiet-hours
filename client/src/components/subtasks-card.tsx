// Settings card: turn subtasks on or off (migration 018). Off by default, so
// steps stay simple; on adds "Add a subtask" to every step. The rules live
// in lib/task-steps.ts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { InfoTip } from "@/components/info-tip";
import { useToast } from "@/hooks/use-toast";
import { EXPLAIN } from "@/lib/explainers";
import { getOrCreateProfile, updateProfile, type UserProfileRow } from "@/lib/foundation-data";

export function SubtasksCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const profileQ = useQuery<UserProfileRow>({ queryKey: ["/api/profile"], queryFn: getOrCreateProfile });
  const on = profileQ.data?.show_subtasks === true;

  const save = useMutation({
    mutationFn: async (next: boolean) => updateProfile({ show_subtasks: next }),
    onSuccess: (_d, next) => {
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      qc.invalidateQueries({ queryKey: ["user_profile"] });
      toast({
        title: "Saved.",
        description: next ? "Steps can have subtasks now." : "New subtasks are off. Any you have stay.",
      });
    },
    onError: (e) => {
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : String(e) });
    },
  });

  return (
    <Card data-testid="card-subtasks">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          Subtasks
          <InfoTip label="subtasks" testId="info-subtasks">
            <p>{EXPLAIN.subtasks}</p>
          </InfoTip>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <Label htmlFor="switch-subtasks" className="text-sm font-normal text-foreground">
          Let steps have smaller pieces of their own
        </Label>
        <Switch
          id="switch-subtasks"
          checked={on}
          disabled={!profileQ.isSuccess || save.isPending}
          onCheckedChange={(v) => save.mutate(v)}
          data-testid="switch-subtasks"
        />
      </CardContent>
    </Card>
  );
}

// Settings card: keeping coach conversations (Talk it through, part 2;
// migration 020). Off by default. When a change would delete conversations
// (turning keeping off, or shortening 90 days to 30), the card says how many
// and asks first, then deletes them straight away rather than waiting for
// the nightly clean-up. The rules live in lib/coach-history.ts.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getOrCreateProfile, updateProfile, type UserProfileRow } from "@/lib/foundation-data";
import { conversation } from "@/lib/coach-data";
import {
  KEEP_CHOICES,
  deleteConversations,
  keepDays,
  listConversations,
  wouldDelete,
  type KeepSetting,
} from "@/lib/coach-history";

/** What the confirm box says before a change that deletes conversations. */
export function changeWarning(next: KeepSetting, count: number): string {
  const them = `${count} kept conversation${count === 1 ? "" : "s"}`;
  if (next === "off") return `This deletes your ${them}, pinned ones too. It can't be undone.`;
  return `This deletes ${them} older than ${keepDays(next)} days. Pinned ones stay. It can't be undone.`;
}

export function CoachKeepCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const profileQ = useQuery<UserProfileRow>({ queryKey: ["/api/profile"], queryFn: getOrCreateProfile });
  const listQ = useQuery({ queryKey: ["coach-conversations"], queryFn: listConversations });
  const setting: KeepSetting = profileQ.data?.coach_keep ?? "off";
  const [pending, setPending] = useState<{ next: KeepSetting; ids: number[] } | null>(null);
  const [askDeleteAll, setAskDeleteAll] = useState(false);
  const rows = listQ.data ?? [];

  const done = () => {
    qc.invalidateQueries({ queryKey: ["/api/profile"] });
    qc.invalidateQueries({ queryKey: ["user_profile"] });
    qc.invalidateQueries({ queryKey: ["coach-conversations"] });
  };
  const fail = (e: unknown) =>
    toast({ title: "Couldn't save", description: e instanceof Error ? e.message : String(e) });

  const change = useMutation({
    mutationFn: async ({ next, ids }: { next: KeepSetting; ids: number[] }) => {
      // Delete first: if that fails, the setting stays as it was.
      await deleteConversations(ids);
      await updateProfile({ coach_keep: next });
      return { next, ids };
    },
    onSuccess: ({ next, ids }) => {
      // A conversation on screen in Talk it through that was just deleted, or
      // any when keeping is turned off, is no longer kept.
      const uid = profileQ.data?.user_id ?? null;
      const cur = conversation.get(uid);
      if (next === "off" || (cur.conversationId != null && ids.includes(cur.conversationId))) {
        conversation.set(uid, { conversationId: null, savedCount: 0, keep: null });
      }
      done();
      toast({
        title: "Saved.",
        description:
          next === "off"
            ? "Coach conversations aren't kept."
            : `${ids.length ? `${ids.length} deleted. ` : ""}${KEEP_CHOICES.find((c) => c.value === next)!.label}.`,
      });
    },
    onError: fail,
  });

  const deleteAll = useMutation({
    mutationFn: async () => deleteConversations(rows.map((r) => r.id)),
    onSuccess: () => {
      conversation.set(profileQ.data?.user_id ?? null, { conversationId: null, savedCount: 0, keep: false });
      done();
      toast({ title: "All your kept conversations are deleted." });
    },
    onError: fail,
  });

  const choose = (next: KeepSetting) => {
    if (next === setting) return;
    const ids = wouldDelete(rows, next, Date.now()).map((r) => r.id);
    if (ids.length > 0) setPending({ next, ids });
    else change.mutate({ next, ids });
  };

  return (
    <Card data-testid="card-coach-keep">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Coach conversations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-serif text-sm italic text-muted-foreground">
          Talk it through can keep your conversations so you can come back to them. Only you can read them. Each
          message still goes to the AI to get a reply, whichever you choose.
        </p>
        <RadioGroup
          value={setting}
          onValueChange={(v) => choose(v as KeepSetting)}
          disabled={!profileQ.isSuccess || !listQ.isSuccess || change.isPending}
          aria-label="Keep coach conversations"
        >
          {KEEP_CHOICES.map((o) => (
            <div key={o.value} className="flex items-center gap-2">
              <RadioGroupItem value={o.value} id={`coach-keep-${o.value}`} data-testid={`coach-keep-${o.value}`} />
              <Label htmlFor={`coach-keep-${o.value}`} className="font-normal">
                {o.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
        {rows.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAskDeleteAll(true)}
            disabled={deleteAll.isPending}
            data-testid="button-delete-all-conversations"
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete all my conversations
          </Button>
        )}
      </CardContent>

      <AlertDialog open={pending != null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Change how long they're kept?</AlertDialogTitle>
            <AlertDialogDescription data-testid="coach-keep-warning">
              {pending ? changeWarning(pending.next, pending.ids.length) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Leave it as it is</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pending && change.mutate(pending)}
              data-testid="button-coach-keep-confirm"
            >
              Change it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={askDeleteAll} onOpenChange={setAskDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete all your conversations?</AlertDialogTitle>
            <AlertDialogDescription>
              {`All ${rows.length} kept conversation${rows.length === 1 ? "" : "s"}, pinned ones too. It can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAll.mutate()} data-testid="button-delete-all-conversations-confirm">
              Delete them all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// Keeping coach conversations on the Talk it through page (part 2):
//   - KeepSwitch: keep this conversation or not, starting from the Settings
//     choice, so someone who usually keeps can have one private talk.
//   - KeptConversations: the list to look back at, open and carry on, pin
//     (stays past its 30 or 90 days) or delete.
// The rules live in lib/coach-history.ts.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { conversation } from "@/lib/coach-data";
import {
  daysLeft,
  deleteConversations,
  listConversations,
  listDate,
  loadMessages,
  setPinned,
  type ConversationRow,
  type KeepSetting,
} from "@/lib/coach-history";
import { cn } from "@/lib/utils";

export function KeepSwitch({
  on,
  saved,
  disabled,
  onKeep,
  onStopKeeping,
}: {
  on: boolean;
  saved: boolean;
  disabled?: boolean;
  onKeep: () => Promise<void>;
  onStopKeeping: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
    } catch (e) {
      toast({ title: "Couldn't change that", description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor="switch-keep-this" className="text-sm font-normal">
        Keep this conversation
      </Label>
      <Switch
        id="switch-keep-this"
        checked={on}
        disabled={disabled || busy}
        onCheckedChange={(v) => {
          if (v) void run(onKeep);
          else if (saved) setAsking(true);
          else void run(onStopKeeping);
        }}
        data-testid="switch-keep-this"
      />
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Stop keeping this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              What's saved of it will be deleted. It stays on screen, and you can keep talking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void run(onStopKeeping)} data-testid="button-stop-keeping">
              Delete what's saved
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function KeptConversations({
  setting,
  userId,
  openId,
  unkeptOnScreen,
  onOpened,
}: {
  setting: KeepSetting;
  userId: string | null;
  openId: number | null;
  unkeptOnScreen: boolean;
  onOpened: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const listQ = useQuery({ queryKey: ["coach-conversations"], queryFn: listConversations });
  const [confirmOpen, setConfirmOpen] = useState<ConversationRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ConversationRow | null>(null);
  const now = Date.now();

  const fail = (title: string) => (e: unknown) =>
    toast({ title, description: e instanceof Error ? e.message : String(e) });

  const open = useMutation({
    mutationFn: async (c: ConversationRow) => ({ c, messages: await loadMessages(c.id) }),
    onSuccess: ({ c, messages }) => {
      conversation.set(userId, { messages, conversationId: c.id, savedCount: messages.length, keep: true });
      onOpened();
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: fail("Couldn't open that conversation"),
  });

  const pin = useMutation({
    mutationFn: async (c: ConversationRow) => setPinned(c.id, !c.pinned),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-conversations"] }),
    onError: fail("Couldn't change that"),
  });

  const remove = useMutation({
    mutationFn: async (c: ConversationRow) => deleteConversations([c.id]),
    onSuccess: (_d, c) => {
      // The one on screen stays on screen, no longer kept.
      if (c.id === openId) conversation.set(userId, { conversationId: null, savedCount: 0, keep: false });
      qc.invalidateQueries({ queryKey: ["coach-conversations"] });
      toast({ title: "Deleted." });
    },
    onError: fail("Couldn't delete that"),
  });

  const rows = listQ.data ?? [];

  return (
    <section className="space-y-3" data-testid="kept-conversations">
      <h2 className="font-serif text-lg">Kept conversations</h2>
      {listQ.isError && <p className="text-sm text-muted-foreground">Couldn't load them just now.</p>}
      {listQ.isSuccess && rows.length === 0 && (
        <p className="font-serif text-sm italic text-muted-foreground">
          Nothing kept yet. Conversations you keep show up here.
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((c) => {
          const left = daysLeft(c, setting, now);
          return (
            <li
              key={c.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2",
                c.id === openId && "border-primary/40",
              )}
              data-testid={`kept-${c.id}`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                disabled={open.isPending}
                onClick={() => (unkeptOnScreen ? setConfirmOpen(c) : open.mutate(c))}
                data-testid={`kept-open-${c.id}`}
              >
                <span className="block truncate text-sm">{c.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {listDate(Number(c.updated_at))}
                  {c.id === openId ? " · open now" : ""}
                  {c.pinned ? " · pinned" : left != null ? ` · goes in ${left} day${left === 1 ? "" : "s"}` : ""}
                </span>
              </button>
              <Button
                size="icon"
                variant="ghost"
                aria-pressed={c.pinned}
                aria-label={c.pinned ? "Unpin" : "Pin, so it stays"}
                title={c.pinned ? "Unpin" : "Pin, so it stays"}
                disabled={pin.isPending}
                onClick={() => pin.mutate(c)}
                data-testid={`kept-pin-${c.id}`}
              >
                {c.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete this conversation"
                title="Delete this conversation"
                onClick={() => setConfirmDelete(c)}
                data-testid={`kept-delete-${c.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>

      <AlertDialog open={confirmDelete != null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && remove.mutate(confirmDelete)}
              data-testid="button-kept-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmOpen != null} onOpenChange={(o) => !o && setConfirmOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Open this one?</AlertDialogTitle>
            <AlertDialogDescription>
              The conversation on screen isn't kept, so it will be gone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay here</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmOpen && open.mutate(confirmOpen)}>Open it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

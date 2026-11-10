// Talk it through: a calm chat that knows your day and helps you choose one
// next step (plan v1, part 1).
//
//   - The coach gets a short summary of today with each message
//     (lib/coach-summary.ts), never check-in notes or compassion entries.
//   - Nothing is saved. The conversation lives in this tab (lib/coach-data.ts).
//   - 40 messages a day in the beta, with a note from 30 on
//     (lib/coach-allowance.ts). The crisis resources are never limited.

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Send } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth-provider";
import { listTasks, type TaskRow } from "@/lib/tasks-data";
import { listBurnout } from "@/lib/data";
import { getOrCreateProfile, type UserProfileRow } from "@/lib/foundation-data";
import { useSpoonBudget } from "@/lib/use-spoon-budget";
import { useWeekStart } from "@/lib/use-week-start";
import { startOfLocalDay } from "@/lib/local-date";
import { daySummary } from "@/lib/coach-summary";
import { allowanceNote, canSend } from "@/lib/coach-allowance";
import { askCoach, coachSentToday, conversation, useConversation, type CoachMessage } from "@/lib/coach-data";
import { cn } from "@/lib/utils";

export const OPENER = "What's on your mind about today?";

export function CrisisCard() {
  return (
    <Card className="border-primary/30 bg-primary/5 p-4 text-sm" data-testid="coach-crisis">
      <p className="text-foreground">
        The coach is a planning companion, not a therapist or a substitute for care.
      </p>
      <p className="mt-2 text-muted-foreground">
        If you're not safe right now, in the US call or text{" "}
        <a href="tel:988" className="text-foreground underline underline-offset-2">988</a>
        {" "}or text HOME to{" "}
        <a href="sms:741741&body=HOME" className="text-foreground underline underline-offset-2">741741</a>.
        {" "}Anywhere else,{" "}
        <a href="https://findahelpline.com" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2">
          findahelpline.com
        </a>
        .
      </p>
    </Card>
  );
}

/** The coach writes short lists and the odd bold phrase; show them as such. */
function CoachText({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: JSX.Element[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-1 list-disc space-y-1 pl-5">
          {bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flush();
    if (line.trim() === "") continue;
    out.push(<p key={`p-${out.length}`}>{inline(line.replace(/^#+\s*/, ""))}</p>);
  }
  flush();
  return <div className="space-y-2">{out}</div>;
}

function inline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-medium">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
  );
}

export default function Talk() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const qc = useQueryClient();
  const messages = useConversation(userId);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { today, ledger, usual, ready: budgetReady } = useSpoonBudget();
  const weekStartsOn = useWeekStart();
  const tasksQ = useQuery<TaskRow[]>({ queryKey: ["tasks"], queryFn: listTasks });
  const profileQ = useQuery<UserProfileRow>({ queryKey: ["/api/profile"], queryFn: getOrCreateProfile });
  const checkinsQ = useQuery({
    queryKey: ["/api/burnout", "coach-today", today],
    queryFn: () => listBurnout(startOfLocalDay().getTime()),
  });
  const usageQ = useQuery({ queryKey: ["coach-usage", today], queryFn: () => coachSentToday(today) });

  const ready = budgetReady && tasksQ.isSuccess && profileQ.isSuccess && checkinsQ.isSuccess && usageQ.isSuccess;
  const sentToday = usageQ.data ?? 0;
  const continuing = messages.some((m) => m.role === "assistant");
  const allowed = canSend(sentToday, continuing);
  const note = allowanceNote(sentToday, continuing);
  const waitingOnRetry = messages.length > 0 && messages[messages.length - 1].role === "user";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length, pending]);

  async function send(history: CoachMessage[]) {
    setPending(true);
    setProblem(null);
    try {
      const answer = await askCoach({
        messages: history,
        summary: daySummary({
          tasks: tasksQ.data ?? [],
          ledger,
          usual,
          checkins: checkinsQ.data ?? [],
          phase: profileQ.data?.current_phase,
          todayIso: today,
          now: Date.now(),
          weekStartsOn,
        }),
        day: today,
      });
      qc.setQueryData(["coach-usage", today], answer.sentToday);
      if (answer.kind === "reply") {
        conversation.set(userId, [...history, { role: "assistant", content: answer.reply }]);
      } else {
        // Over the allowance: the message goes back in the box, unsent.
        const last = history[history.length - 1];
        conversation.set(userId, history.slice(0, -1));
        setDraft(last.content);
      }
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  function submit() {
    const text = draft.trim();
    if (!text || pending || !ready || !allowed || waitingOnRetry) return;
    const history: CoachMessage[] = [...messages, { role: "user", content: text }];
    conversation.set(userId, history);
    setDraft("");
    void send(history);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Talk it through"
        subtitle="A calm chat that knows your day and helps you choose one next step."
      />
      <CrisisCard />

      <div className="space-y-3" aria-live="polite" data-testid="coach-messages">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm">
          {OPENER}
        </div>
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
              m.role === "user"
                ? "ml-auto rounded-tr-sm bg-primary/10 whitespace-pre-wrap"
                : "rounded-tl-sm border border-border bg-card",
            )}
            data-testid={`coach-message-${m.role}`}
          >
            {m.role === "assistant" ? <CoachText text={m.content} /> : m.content}
          </div>
        ))}
        {pending && (
          <p className="font-serif text-sm italic text-muted-foreground" data-testid="coach-thinking">
            Thinking it over…
          </p>
        )}
        {problem && !pending && (
          <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm" data-testid="coach-problem">
            <p>{problem}</p>
            {waitingOnRetry && (
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void send(messages)}>
                Try again
              </Button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends on a keyboard; Shift+Enter adds a line. Phones add a line.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(hover: hover)").matches) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={allowed ? "Say what's on your mind" : "The coach is resting until midnight"}
          aria-label="Your message"
          rows={3}
          maxLength={4000}
          disabled={!allowed}
          data-testid="coach-input"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={messages.length === 0 || pending}
            onClick={() => {
              conversation.clear();
              setProblem(null);
            }}
            data-testid="coach-start-over"
          >
            <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Start over
          </Button>
          <Button type="submit" disabled={!draft.trim() || pending || !ready || !allowed || waitingOnRetry} data-testid="coach-send">
            <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Send
          </Button>
        </div>
        {note && (
          <p className="text-xs text-muted-foreground" data-testid="coach-allowance-note">
            {note}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          This conversation isn't saved. It's gone when you close this tab or press Start over.
        </p>
      </form>
    </div>
  );
}

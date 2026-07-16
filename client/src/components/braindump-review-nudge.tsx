// A soft nudge on the Today page: if any past brain dump still has parsed
// items waiting to be reviewed, offer a Continue reviewing button that
// jumps straight to Brain Dump.
//
// Voice: same rules as everywhere else, gentle. Never modal, never red.

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";
import { listBrainDumps, remainingItemCount, type BrainDumpRow } from "@/lib/tasks-data";

export function BrainDumpReviewNudge() {
  const q = useQuery<BrainDumpRow[]>({
    queryKey: ["brain_dumps"],
    queryFn: listBrainDumps,
    staleTime: 60_000,
  });

  const totalRemaining = (q.data ?? []).reduce(
    (acc, d) => acc + remainingItemCount(d),
    0,
  );
  if (totalRemaining === 0) return null;

  return (
    <Card
      className="border-l-2 border-l-primary"
      data-testid="card-braindump-nudge"
    >
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span
            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            aria-hidden
          >
            <Wand2 className="h-3.5 w-3.5" />
          </span>
          <div className="space-y-1">
            <p className="font-serif text-base text-foreground">
              A dump is waiting on you.
            </p>
            <p className="font-serif text-sm italic text-muted-foreground">
              {totalRemaining} parsed item{totalRemaining === 1 ? "" : "s"} still to sort. No pressure, but they're there when you are.
            </p>
          </div>
        </div>
        <Link href="/brain-dump">
          <Button
            size="sm"
            variant="default"
            data-testid="button-braindump-nudge-review"
          >
            Continue reviewing
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// Shown in place of a list when it couldn't be loaded, so a failure never
// looks like "you have nothing here." House rules: calm wording, no red,
// and a way to try again.

import { RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function LoadError({
  what,
  error,
  onRetry,
  retrying,
}: {
  /** What didn't load, as it reads in a sentence: "your tasks". */
  what: string;
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
}) {
  const detail = error instanceof Error ? error.message : error ? String(error) : "";
  return (
    <Card role="alert" className="space-y-3 p-6 text-center" data-testid="load-error">
      <p className="font-serif text-base text-foreground">Couldn't load {what}.</p>
      <p className="text-sm text-muted-foreground">
        Nothing has been lost. This is usually the connection. Try again in a moment.
      </p>
      <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying} data-testid="button-load-retry">
        <RefreshCw className={`mr-1.5 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
        {retrying ? "Trying again" : "Try again"}
      </Button>
      {detail && (
        <details className="text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer">What went wrong</summary>
          <p className="mt-1 break-words">{detail}</p>
        </details>
      )}
    </Card>
  );
}

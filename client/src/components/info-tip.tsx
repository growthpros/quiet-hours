// A small ⓘ next to a label. Tap or click to read what the label means;
// tap outside or press Escape to close. Works on phones, where hover
// tooltips don't.

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function InfoTip({
  label,
  children,
  testId,
}: {
  /** What the ⓘ explains, for screen readers ("What Effort means"). */
  label: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What ${label} means`}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => e.stopPropagation()}
          data-testid={testId ?? `info-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
        >
          <Info className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 max-w-[calc(100vw-2rem)] space-y-2 text-sm normal-case leading-snug tracking-normal"
        side="top"
        collisionPadding={16}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

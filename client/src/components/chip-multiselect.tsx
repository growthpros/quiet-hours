// Reusable chip-multiselect with "add your own" support backed by the
// user's personal chip library.
//
// - curated: an array of { id, label } chips that always appear (unless the
//   user has explicitly hidden that curated id).
// - category: which chip library to draw from (pull / body / symptom / etc.)
// - selected: currently-selected ids (curated) + labels (custom, lowercase).
// - onChange: called with the new selection array.
//
// Custom chips are stored lowercase and reused across future check-ins.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { listChips, addChip, deleteChip, type ChipCategory, type ChipRow } from "@/lib/chip-library-data";

export interface CuratedChip {
  id: string;
  label: string;
}

interface Props {
  curated: CuratedChip[];
  category: ChipCategory;
  selected: string[];
  onChange: (next: string[]) => void;
  compact?: boolean;
  testIdPrefix?: string;
}

export function ChipMultiSelect({
  curated,
  category,
  selected,
  onChange,
  compact,
  testIdPrefix = "chip",
}: Props) {
  const qc = useQueryClient();
  const [newChip, setNewChip] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const chipsQ = useQuery<ChipRow[]>({
    queryKey: ["/api/chip-library", category],
    queryFn: () => listChips(category),
  });

  const add = useMutation({
    mutationFn: async (label: string) => addChip(category, label),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["/api/chip-library", category] });
      if (!selected.includes(row.label)) onChange([...selected, row.label]);
      setNewChip("");
      setShowAdd(false);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => deleteChip(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/chip-library", category] });
    },
  });

  // Curated chips first, then user's custom chips.
  // A curated chip's identity is its `id`. A custom chip's identity is its
  // label (stored lowercase).
  const customChips = chipsQ.data ?? [];

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const sizeClasses = compact
    ? "px-3 py-1 text-xs"
    : "px-3 py-1.5 text-sm";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {curated.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={cn(
                "rounded-full border hover-elevate",
                sizeClasses,
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
              data-testid={`${testIdPrefix}-${c.id}`}
            >
              {c.label}
            </button>
          );
        })}
        {customChips.map((row) => {
          const on = selected.includes(row.label);
          return (
            <span
              key={row.id}
              className="inline-flex items-center gap-0.5 group"
            >
              <button
                type="button"
                onClick={() => toggle(row.label)}
                className={cn(
                  "rounded-full border hover-elevate",
                  sizeClasses,
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground",
                )}
                data-testid={`${testIdPrefix}-custom-${row.id}`}
              >
                {row.label}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remove "${row.label}" from your saved chips? Past check-ins keep it.`)) {
                    if (on) onChange(selected.filter((v) => v !== row.label));
                    remove.mutate(row.id);
                  }
                }}
                className="text-muted-foreground/40 hover:text-destructive p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Delete ${row.label}`}
                data-testid={`${testIdPrefix}-delete-${row.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}

        {!showAdd ? (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className={cn(
              "rounded-full border border-dashed hover-elevate flex items-center gap-1",
              sizeClasses,
              "border-border text-muted-foreground",
            )}
            data-testid={`${testIdPrefix}-add-your-own`}
          >
            <Plus className="h-3 w-3" strokeWidth={2} />
            Add your own
          </button>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Input
              autoFocus
              value={newChip}
              onChange={(e) => setNewChip(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newChip.trim().length > 0) {
                  e.preventDefault();
                  add.mutate(newChip);
                }
                if (e.key === "Escape") {
                  setShowAdd(false);
                  setNewChip("");
                }
              }}
              placeholder="Type and press Enter"
              className="h-8 w-40 text-sm"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAdd(false);
                setNewChip("");
              }}
            >
              Cancel
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}

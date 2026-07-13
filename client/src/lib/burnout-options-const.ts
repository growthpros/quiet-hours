// Curated chip options for the burnout check-in flow.
// Extracted so they can be referenced by both the check-in page and the
// History charts without a circular import.

export const PULL_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "phone", label: "Phone / apps" },
  { id: "news", label: "News / feeds" },
  { id: "side-project", label: "A side project" },
  { id: "other-work", label: "Work that isn't today's work" },
  { id: "scrolling", label: "Scrolling" },
  { id: "replaying", label: "Replaying something" },
  { id: "other", label: "Something else" },
];

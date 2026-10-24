// Local dates: "what day is it for this person?"
//
// People think in their own local day. A task due "today" means today on
// their clock, not in UTC. UTC-based shortcuts like
// `date.toISOString().slice(0, 10)` give the wrong day in the evening in
// the US and in the morning in the UK and Australia, so use these helpers
// for any day-level logic instead.

// The person's local calendar date as YYYY-MM-DD.
export function localIsoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Midnight at the start of the person's local day.
export function startOfLocalDay(d: Date = new Date()): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

// The same local time-of-day, n calendar days later (negative for earlier).
// Uses calendar days, so it stays correct across daylight-saving changes.
export function addLocalDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

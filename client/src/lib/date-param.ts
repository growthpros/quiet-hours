// The Calendar links each day to the Tasks page as /tasks?date=YYYY-MM-DD.
// With hash routing the query can land in either the real query string or
// the hash, so check both. Returns null unless it's a real calendar date.

export function parseDateParam(search: string, hash = ""): string | null {
  const fromHash = hash.includes("?") ? hash.slice(hash.indexOf("?")) : "";
  for (const q of [search, fromHash]) {
    const v = new URLSearchParams(q).get("date");
    if (v && isRealDate(v)) return v;
  }
  return null;
}

function isRealDate(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

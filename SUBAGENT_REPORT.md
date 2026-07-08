# Quiet Hours — Frontend Build Report

## Summary
Built the complete React frontend for "Quiet Hours" against the pre-existing backend, schema, palette, and Fraunces/Inter fonts. `npm run build` compiles clean (client + server). All six sections work end-to-end and were verified with Playwright at desktop (1280px) and mobile (375px), in both light and dark mode. No shared/schema.ts, server/*, index.html, index.css, or tailwind.config.ts were modified.

## Files created
- `client/src/App.tsx` (replaced) — hash routes for all 6 pages, ThemeProvider + SidebarProvider, desktop sidebar (`hidden md:block`) + mobile bottom nav, scrollable main.
- `client/src/lib/quiet-hours-data.ts` — 8 REFRAMES (with real copy across all 4 categories, scripts on the specified 3), 6 CHECKLIST_TEMPLATES with concrete required/optional items, 8 COMPASSION_PROMPTS.
- `client/src/lib/burnout-utils.ts` — shared band logic, marker %, summary/avg helpers, symptom options + labels, time formatting, startOfTodayMs (used by Today + Burnout).
- `client/src/components/theme-provider.tsx` — light/dark via useState seeded from matchMedia, toggles `dark` class on documentElement. No localStorage.
- `client/src/components/brand-mark.tsx` — inline SVG crescent moon + horizon line in currentColor.
- `client/src/components/app-sidebar.tsx` — shadcn Sidebar, brand mark, 6 nav items (Sun/Split/ListChecks/Quote/HeartHandshake/Waves), theme toggle in footer. Exports NAV_ITEMS.
- `client/src/components/bottom-nav.tsx` — mobile 6-tab bottom nav (md:hidden).
- `client/src/components/page-header.tsx` — reusable header (Fraunces title + subtitle + action slot).
- `client/src/pages/today.tsx` — greeting, day-of-year reframe card, 4 live stat cards, burnout check card (invite vs. summary w/ gradient band + marker), cross-links.
- `client/src/pages/delegation.tsx` — Add-task Dialog with live quadrant preview, 2×2 grid, Delegate release checkbox + flipping italic helper + assignee-on-blur, Drop soft banner, per-quadrant empty states.
- `client/src/pages/good-enough.tsx` — template picker (6 + Start blank custom form), in-progress runs w/ required progress bar, detail view grouped Must-have / Nice-to-have, accent completion panel + Ship it (toast), Recently shipped collapsible.
- `client/src/pages/reframes.tsx` — stacked-column header so search gets full width, category chips, 2-col card grid, per-reframe copy buttons (check for 1.5s + toast), "You can say" script block.
- `client/src/pages/compassion.tsx` — New-entry Dialog (rotating italic placeholder), 3 stat cards + Recharts before/after LineChart (≥2 entries), entry list with before→after arrow + italic pull-quote + outcome, warm empty state.
- `client/src/pages/burnout.tsx` — 5-step check-in card (progress segments, energy/sensory scales, symptom chips, note w/ 240 cap, review w/ local intensity), success state; summary column with 2×2 KPIs, gradient band + interpretation, timeline LineChart, most-noticed symptom bars, check-in list, Clear-today with AlertDialog confirm.

## Verified interactive flows
- Burnout check-in end-to-end → intensity computed correctly (energy 2 / sensory 4 = 4.0 "Overloaded"), summary + gradient marker + symptom bars + list populate; second check-in produces timeline chart.
- Delegation: add task lands in correct quadrant via preview logic; release checkbox flips helper text; empty states render.
- Good Enough: start template → run appears → check must-haves → completion panel → Ship it → toast + hidden from active list.
- Compassion: save entry → stats (drop 5.0, 100% helped), pull-quote, outcome render.
- Theme toggle, mobile bottom nav (all 6 tabs), dark mode across pages.

## Screenshots (in /tmp)
Desktop: qh-today-desktop.png, qh-deleg-desktop.png / qh-deleg-after.png / qh-deleg-released.png / qh-deleg-dialog.png, qh-ge-desktop.png / qh-ge-detail.png / qh-ge-ready.png / qh-ge-shipped.png, qh-reframes-desktop.png, qh-compassion-desktop.png / qh-compassion-one.png, qh-burnout-desktop.png / qh-burnout-review.png / qh-burnout-after.png / qh-burnout-two.png.
Mobile: qh-m-today.png, qh-m-burnout.png, qh-m-reframes.png.
Dark: qh-dark-burnout.png, qh-dark-reframes.png.

## Decisions worth flagging
- Burnout & Today "today" queries use a custom queryFn with `apiRequest("GET", ...?since=)` (queryKey `["/api/burnout","today"]`) because the default queryFn joins the key with "/" and can't carry query params. All other queries use the default queryFn.
- Desktop sidebar is wrapped in `hidden md:block`; mobile uses a dedicated bottom nav per spec. SidebarProvider still wraps everything so sidebar context/state works.
- Reframe categories exported as types from quiet-hours-data.ts and reused by Today and Reframes.
- Custom checklist form lets the user mark each item required/optional and posts `templateKey: "custom"`.
- Test data created during QA was cleared afterward; the app ships with empty states. The SQLite db file is gitignored.

## Known issues
- None functional. Vite emits the usual "chunk > 500 kB" advisory (Recharts) — cosmetic only, not an error.
- Do NOT deploy/publish — left for the main agent per instructions.

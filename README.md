# Quiet Hours

A gentle, low-demand workplace toolkit for the parts of you that try to do
everything, do it perfectly, and do it personally. Built for people navigating
OCPD-adjacent perfectionism, neurodivergent burnout, and activation-addiction
patterns.

Live at [https://quiet-hours-chi-ruby.vercel.app](https://quiet-hours-chi-ruby.vercel.app).

## Sections

- **Today** — greeting, cross-links, burnout check card, and one thought for today
- **Delegation** — urgency × importance matrix with a "releasing control" checkbox
- **Good Enough** — checklists that define done before you start, with inner-critic scaffolding
- **Reframes** — cognitive-reframing scripts across over-responsibility, differences, perfectionism, rumination
- **Compassion** — before/after intensity log for self-compassion moments
- **Burnout** — 5-minute check-in (energy, sensory, state, symptoms, note) and a daily summary that emphasizes state over score
- **History** — reflection mirror + browsable feed across all four data streams
- **Settings** — export data, delete everything, sign out, crisis resources

## Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS v3, shadcn/ui, wouter (hash routing), TanStack Query, Recharts
- **Backend / data:** Supabase (Postgres + auth + row-level security)
- **Auth:** magic-link email
- **Hosted on:** Vercel

## Running locally

```bash
npm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project
npm run dev
```

The dev server runs on port 5000.

## Setting up a fresh Supabase project

1. Create a new project on [supabase.com](https://supabase.com).
2. In the SQL Editor, paste and run the contents of `supabase/migration.sql`.
   That creates the four tables (delegation_tasks, checklist_runs,
   compassion_entries, burnout_checkins) with row-level security policies so
   each user only sees their own rows.
3. In Auth → URL Configuration, add your deployment URL as the Site URL and
   as an allowed redirect URL. For the deployed version that's
   `https://quiet-hours-chi-ruby.vercel.app`.
4. Grab the project URL and publishable/anon key from Settings → API and put
   them in `.env` (locally) or in Vercel env vars (production).

## Deploying to Vercel

The project is set up with `vercel.json` that treats it as a plain SPA:

- Build command: `npm run build`
- Output: `dist/public`
- SPA rewrite: all paths serve `index.html`

Env vars needed on Vercel (both Production and Preview):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Design notes

- No streaks, no scores that stay on-screen, no notifications, no
  gamification. The point is to notice, not to optimize.
- All data is per-user, enforced at the Postgres level via RLS. Even if the
  app code has a bug, one user can't see another user's data.
- Users can export everything as JSON or delete their whole account at any
  time from Settings.
- Crisis resources (988, Crisis Text Line, findahelpline.com) are visible in
  the footer on every page and on the sign-in screen.

## File layout

```
client/
  index.html              # Fonts loaded here (Fraunces + Inter)
  src/
    App.tsx               # Auth gate + hash routing
    index.css             # Design tokens (warm parchment + sage + clay)
    components/
      auth-provider.tsx   # Supabase auth context
      welcome-dialog.tsx  # First-run "this is / isn't" dialog
      site-footer.tsx     # Crisis resources on every page
      app-sidebar.tsx     # Desktop sidebar nav
      bottom-nav.tsx      # Mobile bottom nav
      ...
    lib/
      supabase.ts         # Supabase client + row types
      data.ts             # Data access layer (list/create/update/delete)
      queryClient.ts      # React Query setup + apiRequest shim
      quiet-hours-data.ts # Static content: reframes, checklists, thoughts
    pages/
      today.tsx
      delegation.tsx
      good-enough.tsx
      reframes.tsx
      compassion.tsx
      burnout.tsx
      history.tsx
      settings.tsx
      sign-in.tsx
supabase/
  migration.sql           # Initial schema (run once per fresh project)
server/                   # LEGACY — from the original SQLite/Express build.
                          # Not used in production; safe to delete.
shared/                   # LEGACY — Drizzle schema from the SQLite era.
                          # Not used in production; safe to delete.
```

The `server/` and `shared/` directories are leftovers from the initial
SQLite/Express build before migrating to Supabase. They aren't referenced by
the frontend or the build, but I left them in case you want to see how the
data model evolved.

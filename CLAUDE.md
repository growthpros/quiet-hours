# Quiet Hours: house rules

Quiet Hours is a neurodivergent-designed planner and burnout check-in app, built by Caroline Hinton (Growth Partner Pros). Caroline is the product owner, not a developer. These rules apply to every session that works on this repo, in any tool.

## The short version

1. Never touch the production database without Caroline's explicit OK in the current conversation.
2. One change per branch, one pull request per change. Merging to `main` deploys to the live app automatically.
3. A change is done only when `npm run verify` passes, a test proves it, and it has been checked on a preview deployment.
4. Explain the why, in plain language. Caroline is learning, not coding.

## How the app is built

- **Frontend:** React 18, Vite, TypeScript (strict), Tailwind, shadcn/ui, wouter (hash routing), TanStack Query.
- **Data and sign-in:** Supabase (Postgres, row-level security, magic-link auth). The browser talks to Supabase directly; there is no app server.
- **AI features:** two Supabase Edge Functions in `supabase/functions/` (`parse-brain-dump`, `break-down-task`) that call the Anthropic API.
- **Hosting:** Vercel, connected to this repo. `main` deploys to production. Every other branch gets a preview deployment.
- **Email:** Resend, used by Supabase Auth for magic links.

## Environments

| | Supabase project | Used by |
| --- | --- | --- |
| Production | `quiet-hours` (`cjkmehvdsqdpdrmqhvza`), growthpros's Org | The live app (`main`) |
| Test | `quiet-hours-test` (`kavamvoavpecwsmozaij`), Quiet Hours Test org | Vercel preview deployments |

The test project holds no real data. Use it freely. Production holds real users' wellbeing data. Treat it that way.

## Working rules

**Branches and pull requests**

- Branch from the latest `main`. Name branches for the change, like `fix/rollover-null-check`.
- Keep each pull request to one change. Say in the description what was wrong, what changed, and how it was verified.
- Never merge without Caroline's approval.

**Definition of done**

- `npm run verify` passes (type check, tests, production build). GitHub runs the same check on every pull request.
- A bug fix comes with a test that fails before the fix and passes after it.
- The change has been checked on the branch's preview deployment.
- Never call something fixed because a string appears in the built bundle. That proves the code shipped, not that it works.

**Database changes**

- Every schema change is a new numbered file in `supabase/migrations/` (next is `014_...`). Never edit an applied migration.
- Apply it to the test project first and check it there.
- Apply to production only after the pull request is approved, and only with Caroline's OK. If the app code depends on the change, apply it to production before merging.
- Every new table that holds user data needs:
  - row-level security with owner-only policies
  - `user_id uuid not null references auth.users(id) on delete cascade` (or a cascade through a parent table), so "Delete my account" (`delete_my_account`, migration 013) removes it
  - an entry in `USER_DATA_TABLES` in `client/src/lib/data.ts`, so Export includes it. `data.test.ts` fails if it's missing.

**Dates**

- Users think in their own local day. Any "what day is it" logic must use the user's local date, never UTC.
- Use the helpers in `client/src/lib/local-date.ts` (`localIsoDate`, `startOfLocalDay`, `addLocalDays`). Don't write your own copy.
- `no-utc-dates.test.ts` fails if UTC shortcuts like `toISOString().slice(0, 10)` appear in app code.
- Inside `recurring-resolver.ts`, the pattern math works on plain YYYY-MM-DD dates in UTC on purpose. That's correct as long as the starting "today" comes from `localIsoDate()`.

**Tasks and time**

- "On today," "missed" and the Tasks page timeframes live in `client/src/lib/task-timeframe.ts`. Use them; don't write new filters.
- A task has one answer to "when": a timeframe (`due_bucket`) or a specific day (`due_date`), never both. Moving rules live in `client/src/lib/task-move.ts`.
- A repeat occurrence keeps a specific date and can only move to a day before its next scheduled occurrence (`repeatMoveWindow`).

**Errors**

- Don't swallow errors silently. If a failure is safe to ignore, log it and say why in a comment.

## Commands

- `npm run verify`: everything, run before calling any change done
- `npm run check`: TypeScript type check
- `npm test`: unit tests (Vitest). Tests live next to the code as `*.test.ts`.
- `npm run build`: production build into `dist/public`
- Local development: `npx vite`, with a `.env` holding the **test** project's URL and publishable key (see `.env.example`). Don't use `npm run dev`: it starts a leftover server (see below).

## Leftovers to ignore

`server/`, `shared/`, `drizzle.config.ts`, and the Express, SQLite and Passport packages are left over from the original template. Nothing in production uses them. Don't build on them. Removing them is planned as its own change.

## Product and voice rules

These apply to every word in the app and in anything written for Caroline.

- No em dashes, ever. Use commas, periods, colons or line breaks.
- No exclamation marks in app copy.
- No red in the UI, except a system-level failure toast.
- Notice, don't grade. Invitations, not commands. Never urgent, never shaming.
- Never reference specific medical procedures or Caroline's personal health history in the app, the spec or docs.
- App title: "Quiet Hours, a gentle toolkit for calmer days and burnout recovery".
- Design: warm parchment base, Fraunces serif plus Inter sans. Section accents: terracotta (Foundation), sage (Recovery), dusty blue (Focus), lavender (Compassion), moss (Success), amber (Alert).

## Where else things live

- Product spec (v3), session specs, testing checklists and mockups: Caroline's Google Drive, folder "Quiet Hours".
- Health report from the October 2026 audit: Caroline's Claude doc "Quiet Hours Health Report v1".

# Quiet Hours build log

This is the running history of how Quiet Hours is being built: what changed, why, who decided, and how each change was checked. It starts with the original build and picks up in detail from the October 2026 audit.

Every pull request adds an entry here before it's merged (see "Definition of done" in `CLAUDE.md`). Entries run oldest to newest, so the newest is at the bottom. Decisions also go in the table below, so they're easy to find without reading every entry.

**Entry template:**

```
### YYYY-MM-DD: Short title (#PR)

What and why: the problem, in plain words, and what changed.
Decisions: what Caroline decided, or "none".
Database: migration number and where it was applied, or "no change".
Checked: tests, test database run, preview, live check.
```

## Decisions

| Date | Decision | Decided by |
| --- | --- | --- |
| 2026-10-24 | Fix and finish the app with Claude, one change at a time: a short plan for Caroline to approve, a branch, tests that prove it, a check on the test database, then a pull request with a green check and a preview link. Caroline tests, merges and deletes the branch. | Caroline |
| 2026-10-24 | A separate test database, `quiet-hours-test`, in its own free Supabase organization ("Quiet Hours Test"). Preview deployments use it; only the live app uses the real database. | Caroline |
| 2026-10-24 | The real database is changed only with Caroline's explicit OK in the conversation. For those steps she points the Supabase connector at growthpros's Org, then back to the test org. | Caroline |
| 2026-10-24 | Leftover tasks on Today say "carried over," not "rolled from yesterday." | Caroline |
| 2026-10-24 | Approved the wording for Delete my account, including "Couldn't delete your account. Nothing was removed." | Caroline |
| 2026-10-24 | Beta waits until Quiet Hours stops being a blob: calendar views and the Google Calendar connection have to be in first. | Caroline |
| 2026-10-24 | Beta includes: calendar week and month views, the hour-by-hour day timeline with countdowns, subtasks, clients and projects, the time report, PDF invoices, one-way Google Calendar sync, part of the full onboarding, and the readiness items. | Caroline |
| 2026-10-24 | After beta: two-way Google sync, the therapist or coach report, payments and tiers, the rest of onboarding. | Caroline |
| 2026-10-24 | Beta is free. Payments come after beta. | Caroline |
| 2026-10-24 | Two or three trusted people get an early look once Phase 2 (subtasks) is live. Who they are is still open. | Caroline |
| 2026-10-24 | Timeline alerts use push notifications, so they arrive when the app is closed. | Caroline |
| 2026-10-24 | Invoices carry each tester's own business details, with an optional logo upload. | Caroline |
| 2026-10-24 | The Google Cloud project is owned by caroline.hinton@growthpartnerpros.com. The privacy policy and home page will live on humanfitai.com, which still needs building. | Caroline |
| 2026-10-25 | The Tasks page opens on Today, with This week, Next week and This month. Filtering the list stays important even with a calendar. | Caroline |
| 2026-10-25 | Keep the Tomorrow choice, and add it to the Tasks page filter. | Caroline |
| 2026-10-25 | A repeat can move only to a day before its next scheduled occurrence, so how far it can move depends on how often it repeats. | Caroline |
| 2026-10-25 | The Tasks page filter can show one specific date ("Pick a date…"). | Caroline |
| 2026-10-25 | The new page is called "Calendar." | Caroline |
| 2026-10-25 | Each person chooses which day their week starts: Sunday, Monday or Saturday. Sunday is the default. | Caroline |
| 2026-10-25 | Smaller task text on the Calendar. | Caroline |
| 2026-10-25 | Upcoming repeats show on the Tasks page too, with a note that links to the Calendar on the same week. (A note on its own was considered and set aside, because the Tasks page would look lighter than the day really is.) | Caroline |
| 2026-10-25 | A views and mobile pass happens as its own change right after Phase 1. | Caroline |
| 2026-10-25 | Month view: repeats show as a count instead of titles, tapping a day opens that week, and dragging follows the same rules as Move. Uses the dnd-kit library for dragging. | Caroline |
| 2026-10-25 | The phone check for month view and dragging happens on the live app after merging, because signing in to previews on a phone was blocked (see the entry for #34). | Caroline |
| 2026-10-25 | US only at launch. | Caroline |
| 2026-10-25 | This build log lives in the code and is updated with every pull request. | Caroline |

## History

### July 2026: The original build (#1 to #26)

Built with Perplexity Computer between July 11 and July 27, 2026, in "sessions":

- **Session 1 (#1 to #4):** Foundation daily log, the Burnout Wave, History charts.
- **Session 2 (#5 to #7, #14):** spoons, earn-back actions, over-budget log, recovery phases, past-day view on Today, check-in reminders.
- **Sign-in fixes (#8 to #13):** blank-page crashes and a magic-link loop, ending with the switch to Supabase's implicit sign-in flow.
- **Session 3.1 and 3.2 (#15 to #24):** Tasks, Brain dump, AI sorting of brain dumps and AI task breakdown (Supabase Edge Functions calling Anthropic), rollover, plus a run of fixes.
- **Session 3.3 (#25, #26):** repeats (templates, the engine that creates them, Missed and Archived filters, the Ask-me prompt).

There were no automated tests and no record of what had been checked. The pattern was that each fix brought new bugs. Work paused for about three months.

### 2026-10-24: Audit and test setup (no pull request)

**What and why:**
Caroline asked whether the app could be put back on track with Claude. Claude read the whole codebase and both databases and wrote the **Quiet Hours Health Report v1** (a Claude doc). Main findings:

- 26 TypeScript errors, no tests, and no check on pull requests.
- Delete my account cleared only 4 of 20 tables.
- Rollover never ran (a filter that skipped every task).
- Dates were worked out in UTC, so repeats landed on the wrong day in US evenings and Australian mornings.
- The spoon meter added up every unfinished task, which is how one brain dump pushed Committed to 74.
- Preview deployments had no database of their own.

**Setup:**
Created the `quiet-hours-test` Supabase project in a new free organization, with a fake test user. Pointed Vercel preview deployments at it. Added preview addresses to the test project's sign-in settings.

**Decisions:**
The working rhythm, the test database and the rule for touching the real database (see the table).

### 2026-10-24: Safety net (#27)

**What and why:**
Gave the app a way to prove changes work before anything else. Cleared all 26 type errors (the built app stayed byte-identical, so no behavior changed). Added Vitest and the first 9 tests, for the repeat pattern logic. Added `npm run verify` (type check, tests, build), `CLAUDE.md` (the house rules) and a GitHub check that runs verify on every pull request.

**Decisions:**
None.

**Database:**
No change.

**Checked:**
Verify passes. Breaking the weekly-repeat logic on purpose made 2 tests fail.

### 2026-10-24: Rollover adds "carried over" (#28)

**What and why:**
Leftover Today tasks never got their carried-over note. The filter skipped every task that had never been carried over, and "yesterday" was worked out in UTC. Fixed both, and added `local-date.ts`, the one helper for "what day is it for this person."

**Decisions:**
The note says "carried over."

**Database:**
No change.

**Checked:**
The new time-zone tests failed in London and Sydney before the fix and passed after. On the test database, the old filter carried over 0 tasks and the new one exactly the right 1, and running it again the same day carried over 0.

### 2026-10-24: Local dates everywhere (#29)

**What and why:**
The repeat engine used UTC for "today," so in US evenings it made tomorrow's repeat early and marked tonight's as missed, and in Australian mornings it skipped today's. The same shortcut was in the spoon budget check, two filter defaults and the export file name, and the app had seven copies of "today's date." All now use the shared helper. A guard test fails if a UTC shortcut comes back.

**Decisions:**
None.

**Database:**
No change.

**Checked:**
The real repeat engine on the test database: at 9:30pm in Charleston it made 2 wrong repeats before and 1 right one after; at 8:30am in Sydney it made none before and 1 after.

### 2026-10-24: Delete my account and Export cover everything (#30)

**What and why:**
Delete cleared 4 of 20 tables and left the login; Export had the same 4. Added `delete_my_account()`, which deletes the person's own login, and every table is linked to the login so everything goes with it. Export now reads all 20 tables. A guard test fails if a new table is missing from Export.

**Decisions:**
The Delete wording.

**Database:**
Migration 013, applied to the test database, then to the real database on Oct 24 with Caroline's OK, before merging.

**Checked:**
On the test database with two fake users: Export had all 20 tables with only the right person's rows; a signed-out visitor was refused; after deleting, test user 2 couldn't sign in and had 0 rows left anywhere; test user 1 was untouched.

### 2026-10-25: Today means today (#31)

**What and why:**
The spoon meter's Committed number, Today's count and the add-task budget check all counted every unfinished task, even archived ones. One shared rule in `task-timeframe.ts` now decides what's "on today," and Today, the spoon meter and the Tasks page all use it. The Tasks page opens on Today.

**Decisions:**
Tasks page opens on Today with This week, Next week and This month.

**Database:**
No change.

**Checked:**
23 new tests. On the test database, Committed went from 61.5 to 5.5 spoons and the Today count from 10 to 4, with all 12 tasks sorted into the right timeframes.

### 2026-10-25: Move button, Tomorrow and Pick a date (#32)

**What and why:**
Every unfinished task gets a Move menu (Today, Tomorrow, This week, Next week, This month, This quarter, Later, Pick a date) with Undo. A move sets a timeframe or a day, never both. Missed tasks use the same menu. The missed-repeats prompt no longer offers "Move to today" when today already has a copy, which used to fail for daily repeats.

**Decisions:**
Keep Tomorrow, add it and Pick a date to the filter, and the repeat rule (only before its next occurrence).

**Database:**
No change.

**Checked:**
21 new tests covering every repeat schedule in the approved table. On the test database, every move choice saved and showed under the right filter, Undo restored it, and a duplicate copy of a repeat was refused with a plain message.

### 2026-10-25: Calendar week view and week start (#33)

**What and why:**
The first Calendar page: seven days side by side on a computer, stacked on a phone, with each day's tasks, spoons and total. Future repeats show as dashed "coming up" cards, since a repeat only becomes a task on its day. "Not scheduled yet" lists tasks with a timeframe but no day. Tapping a day opens the Tasks page on that date. Settings gets "Week starts on." After Caroline's testing: smaller task text, upcoming repeats on the Tasks page too, and the Tasks page's Calendar link opens on the same week.

**Decisions:**
The name Calendar, each person's own week start, smaller text, repeats shown on the Tasks page.

**Database:**
Migration 014 (`week_starts_on`), applied to the test database, then to the real database on Oct 25 with Caroline's OK, before merging.

**Checked:**
105 tests. On the test database, the week start saved and read back for each choice and the database refused an invalid value. Caroline checked it on the preview. Live check after merging.

### 2026-10-25: Product description for counsel (outside the code)

**What and why:**
Claude filled in the Quiet Hours product description for Caroline's research project and counsel from the app's code and settings (v2, a markdown file). It covers what each check-in asks and stores, where AI is used, the absence of analytics, where data is stored and for how long, and what Google's review of the Calendar connection requires. Since then, the live database's region was confirmed as us-east-1, the same as the test database.

**Decisions:**
None.

**Database:**
No change. Read-only look at the database layout.

**Checked:**
Facts taken from the code and database, with sources listed for the Google section.

### 2026-10-25: Calendar month view and dragging (#34)

**What and why:**
A Week / Month switch. The month shows whole weeks for the person's week start, each day's total, up to three titles and a repeat count; tapping a day opens that week; on a phone each day shows a dot and count. Tasks can be dragged between days in either view (press and hold on a phone) and from "Not scheduled yet" onto a day, following the Move rules. The Move menu and dragging share one move-with-Undo. New dependency: `@dnd-kit/core`.

**Decisions:**
The month view and dragging plan; testing the phone part on the live app.

**Database:**
No change.

**Checked:**
112 tests. In a real browser against the test database: drag and Undo, faded days for a weekly repeat, dragging from Not scheduled yet, the Move button still opening its menu, the month grid and a drag in it. At phone size: the month fits and press-and-hold dragging worked with a simulated finger. Caroline checked it in her browser. Signing in to the preview on her phone failed: the preview asks for a Vercel login, the sign-in email opened in a different browser on the phone, and the retries used up the test database's limit of 2 emails an hour.

### 2026-10-25: This build log

**What and why:**
Caroline asked whether there was a step-by-step history of the build and its decisions, like Perplexity's notes. There wasn't one place for it, so this file was started and filled in back to the July build. `CLAUDE.md` now requires an entry with every pull request.

**Decisions:**
The log lives in the code and is updated with every pull request.

**Database:**
No change.

**Checked:**
Each entry was taken from its pull request's description and from the conversation where the decision was made.

### 2026-10-25: Brain dump AI instructions name no medical procedure

**What and why:**
The instructions the app sends to the AI when sorting a brain dump named one specific medical procedure, which breaks the house rule against referencing specific medical procedures in the app. The line now tells the AI not to mention medical procedures, conditions or other health details unless the person's own text does.

**Decisions:**
None (follows the existing voice rule).

**Database:**
No change. The AI feature runs as a Supabase Edge Function, so the live copy only changes when the function is redeployed to the real project, which needs Caroline's OK.

**Checked:**
A search of the code finds no other mention. No test added: the change is wording inside the AI's instructions, and a test that searched for the procedure's name would have to name it.

## Open items

Things noticed along the way that aren't scheduled yet:

- Em dashes in the app's own words, including the Today compassion card and the check-in state descriptions. Part of the voice pass in "Ready for testers."
- On a phone, the bottom bar has 11 buttons and wraps onto two rows, and empty past days take a full card. Part of the views and mobile pass.
- Leftover template code (`server/`, `shared/`, Express, SQLite, Passport) still to remove.
- The test database still sends sign-in email through Supabase's built-in service (2 an hour). Connecting it to Resend would fix that.
- Phone testing of previews needs the sign-in email to open in the same browser that's signed in to Vercel.
- Unused profile columns from the original build (diagnosis, OCPD awareness, age range, gender). Raised as a question for counsel.
- Fonts load from Google's servers, which see visitors' IP addresses. Hosting them with the app would stop that.
- The Archived filter on the Tasks page compares dates using UTC. It's minor, but it should use the local date like everything else.
- The two or three early-look testers are still to be chosen.
- The test database has no Edge Functions (and no Anthropic key), so AI brain dump sorting and task breakdown don't work on previews.
- Spoon numbers (the daily budget formula, task costs and earn-back values) were invented in the original build. Research is under way, and a spoon model step will follow before subtasks.

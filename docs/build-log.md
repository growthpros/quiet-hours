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
| 2026-10-25 | Spoon totals recalculate when tasks move in or out of Today, and moving or dragging a task onto Today checks the budget, the same as adding one. | Caroline |
| 2026-10-25 | Future days are compared with "your usual" (the middle of the last 14 check-in budgets); each day's real budget still comes from that morning's check-in. | Caroline |
| 2026-10-25 | The spoon numbers (daily budget formula, task costs, earn-back values) get researched before they're changed. | Caroline |
| 2026-10-26 | Task spoons are worked out from time × effort (from the spoon research), and anyone can type their own number instead. | Caroline |
| 2026-10-26 | When no effort is picked, a task counts as Medium. If the math comes out higher than expected, that's a nudge to pick the effort that fits. | Caroline |
| 2026-10-29 | Earn-back starting list: a short walk outside and a nap of 10 minutes or more add 1 spoon; everything else adds half a spoon. Existing accounts switch over with a button. No limit on the day's total; each item keeps its own times-a-day limit. | Caroline |
| 2026-10-29 | Anyone can add their own restorative or habit-building items (examples: stretching, step work, an audio track) and rename any item. | Caroline |
| 2026-10-29 | A gentle note when, on 3 days in a week, earn-back was at least a quarter of the day's spoons and the day ran past an ordinary okay day. | Caroline |
| 2026-10-29 | Phone bottom bar: Today, Tasks, Calendar, Brain dump, Check-in and More. More lists every other page, Settings included. | Caroline |
| 2026-10-29 | The views and mobile pass goes in as small pull requests: the phone bar, loading errors, a "Test version" strip on previews, then Calendar and Today on a phone. | Caroline |
| 2026-10-29 | Quiet Hours is aimed at neurodivergent people and uses their own language, "burnout" included. (The general-audience HumanFit configuration from the deep-research project is the one that avoids clinical terms. The neurodivergent tools in the humanfit folder of the Tools project are a separate thing.) | Caroline |
| 2026-10-29 | Names: "Check-in" in the menu and page title, with "A five-minute burnout check-in" under it. "Your Wave" on Today and History. Phases, heaviest first: Burnout recovery, Reduced capacity, Building back, Steady, Stretch, each with an ⓘ. | Caroline |
| 2026-10-29 | The app suggests lighter phases only down to Reduced capacity. Only the person moves themselves into Burnout recovery. | Caroline |
| 2026-10-29 | Onboarding adds two skippable steps after the welcome: the ordinary okay day and the current phase. The welcome's outdated lines ("not a productivity app," "no notifications") are rewritten. | Caroline |
| 2026-10-29 | Keep using caroline@carolinehinton.com as the one account. Delete the old account from the original build, data and all; the old data isn't needed. | Caroline |
| 2026-11-03 | Subtasks (Phase 2) go in as three pull requests: steps you add yourself, then subtasks with their setting, then "Break this down" making steps. | Caroline |
| 2026-11-03 | Two levels at most: a task has **Steps**, and a step can have **Subtasks**. | Caroline |
| 2026-11-03 | Subtasks are off by default. A setting turns them on, which adds "Break this down" and "Add a subtask" to every step. | Caroline |
| 2026-11-03 | Ticking off the last step ticks off its task too, with a quiet note and Undo. | Caroline |
| 2026-11-03 | Adding a step offers one-tap quick picks for time and effort. Finished steps move below open ones, and ticking off a step that isn't the last shows a gentle "One down. N steps to go." | Caroline |
| 2026-11-03 | Ticking something off always asks how long it actually took, with room for a note. Time blindness makes estimating hard; the answers let the app and the AI learn how long each kind of task really takes. | Caroline |
| 2026-11-03 | The AI features are set up on the test database too, so they can be tried on previews. Caroline added a separate Anthropic key to the test project (Nov 8); brain dump sorting and "Break this down" both work there. | Caroline |
| 2026-11-09 | Order of the next work: test database email through Resend, then "things like this usually take you…", then tidy-ups. | Caroline |
| 2026-11-09 | "Things like this" matches on words in the title (instant, free, nothing leaves the app), not AI. AI grouping can come later if words aren't good enough. | Caroline |
| 2026-11-09 | "Talk it through" is built from the Calm Commander coaching doc: its ideas and prompts, rebuilt, none of its code. It goes in as four pull requests: the coach, Just one thing, suggested tasks, keeping conversations. Plan doc: "Talk it through: plan v1". | Caroline |
| 2026-11-09 | Talk it through lives on its own page and opens from moments like a hard check-in, an overloaded day, or a task you keep moving. | Caroline |
| 2026-11-09 | Beta allowance: 40 coach messages per person per day, a note from 30, reset at local midnight, counts only. A monthly spend limit on the Anthropic workspace (starting at $50) as a backstop. | Caroline |
| 2026-11-09 | The Nov 9 edits to the two coach prompts (only what the person and the summary say, sized to their energy, short replies, believe "that doesn't fit", crisis lines outside the US). | Caroline |
| 2026-11-09 | Keeping conversations: each person chooses; Don't keep is the default; kept ones last 30 days, 90 days or until deleted; any one can be deleted. Every tier can keep conversations. | Caroline |
| 2026-11-09 | Three tiers later, set apart mainly by what the coach can do, each with a message ceiling. Names still open. | Caroline |
| 2026-11-09 | On the phone's bottom bar, Talk it through ("Talk") takes Check-in's place, and Check-in moves into More. | Caroline |
| 2026-11-03 | "Break this down" on a task suggests steps; on a step, it suggests subtasks. Suggestions can be edited before saving, and people can add and edit steps and subtasks themselves. | Caroline |
| 2026-10-27 | Each day's spoons start from the person's "ordinary okay day" (8, 12, 16, 20 or 24 spoons, or their own number from 4 to 30; 12 until they choose), scaled by energy and reduced by other load, as in the spoon research. | Caroline |
| 2026-10-27 | The ordinary-day question lives in Settings, with an invitation on the spoon meter until it's set. The onboarding version comes with change 4. | Caroline |
| 2026-10-27 | "Wired but tired" counts as a body signal (5%). The research's "fatigue counts 0" rule doesn't apply, because there's no plain fatigue chip. | Caroline |
| 2026-10-27 | Labels get an ⓘ that explains them, starting with everything the spoon model touches. | Caroline |
| 2026-10-26 | The spoon model changes go in as four small changes, in order: task spoons, daily budget, earn-back, then wording ("Check-in", "Your Wave", and the renamed phases). | Caroline |

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

### 2026-10-25: Spoon budget rules and amber days (Phase 1, step 6)

**What and why:**
Comparing the code with spec v3 and the Round 2 answers showed the over-budget rules weren't working as intended:

- With no check-in yet, there was no budget, so the over-budget prompt never appeared.
- The add-task check left out spoons from tasks finished today.
- Only adding a task checked the budget; moving or dragging one onto Today didn't.
- The repeated-override pause appeared on the 4th override instead of the 3rd.
- New tasks with a specific date also got the Today timeframe, breaking the "one answer to when" rule.

What changed:

- New `lib/spoon-budget.ts`: today's budget is the check-in plus earned back, or "your usual" before the check-in; spent today includes finished tasks; one function decides how far over a change would go.
- The over-budget prompt now appears when adding, moving or dragging a task onto Today. It offers "Move to tomorrow instead" first, plus "Make it smaller" when adding, then the reasons as before. The pause comes on what would be the 3rd override in 7 days.
- Calendar days that go over get a soft amber tint and a line like "About 13 of your usual 9.5 spoons." Past days get no amber.
- New tasks with a date no longer also get the Today timeframe.
- Before the morning check-in, Today's spoon meter says the app is planning with "your usual" and invites the check-in for today's real number.

**Decisions:**
See the Decisions table (recalculating on moves, "your usual," researching the numbers).

**Database:**
No change.

**Checked:**
127 tests, including the new budget rules and new-task timeframes. In a real browser against the test database: amber on an over day; dragging onto a full Today opened the prompt, "Move to tomorrow instead" moved it to tomorrow, and keeping it logged the override and turned Today amber; adding a task counted the spoons finished earlier; "Move to tomorrow instead" when adding saved a date with no timeframe; the pause appeared on the 3rd override.

### 2026-10-26: Task spoons from time × effort (spoon model, change 1)

**What and why:**
A task only counted toward the day if someone typed a spoon number. A task with a time but no spoons, like a one-hour "Plan my week," counted as zero, so the meter and the over-budget prompt never noticed it. The spoon numbers themselves were also guesses from the original build.

What changed:

- New `lib/spoon-cost.ts` works out spoons the way the spoon research recommends:
  - 1, 2 or 3 spoons an hour for Low, Medium or High effort
  - hours past 2 count 1.25 times
  - "with people, on camera, or somewhere noisy or busy" counts 1.5 times
  - "something I'm dreading" adds 1
  - rounded up to the half spoon, never less than half a spoon
- A number the person types always wins. Empty now means "work it out."
- When no effort is picked, it counts as Medium, and the form says so.
- The task form and the repeat editor share a new "How much will it take?" box: Time, Effort (with examples), the two yes/no questions, and Spoons. The Spoons box shows the worked-out number, the math underneath, and a "Use the math" link when someone has typed their own.
- Every total uses the same rule: the spoon meter, the over-budget prompt (adding, moving, dragging), Calendar days and amber, upcoming repeats, and the Tasks page.
- "Complexity" is now called "Effort." Task chips read "high effort."
- The highest spoon number is now 60 instead of 10 or 20, because a long, hard day works out to more than the old limit (an 8-hour, high-effort task is 28.5).
- The AI brain dump and task breakdown now suggest time, effort and "with people," not spoons, so every task's spoons come from the same math. Older brain dumps that carry an AI spoon guess are ignored.

**Decisions:**
See the Decisions table (time × effort with your own number winning, Medium when no effort is picked, the four-change order).

**Database:**
Migration 015 adds `social_load` and `dread` to tasks and repeat templates, lets a repeat's spoon number be empty, and raises the limit to 60. Applied to the test database. Typed numbers already saved are unchanged, so existing repeats keep their numbers until someone clears the Spoons box. The real database needs it before merging, with Caroline's OK. The two AI functions need redeploying to the real project after merging, also with her OK (their new answers leave out the spoon guess the current live app still reads).

**Checked:**
139 tests, including the research table and examples, typed numbers winning, and the meter, budget and Calendar counting tasks that only have a time. These budget tests fail on the old code. In a real browser against the test database: the meter counted a one-hour task with no spoons as 2; a one-hour, medium, with-people, dreaded call showed "4 spoons" with the math, a typed 3 showed "The math says 4 spoons," "Use the math" cleared it, and the saved task kept an empty spoon number with both boxes ticked; the next task went half a spoon over and opened the prompt; the repeat editor showed the math; the form fit a phone screen.

### 2026-10-26: AI features redeployed, code matches what's live

**What and why:**
The two AI features (brain dump sorting and task breakdown) run on Supabase, so merging code doesn't update them. They were redeployed to the real project after #38, which also shipped the #36 wording fix. Before deploying, the live copies were compared with the code. Two small differences favored the live copies, so the code now matches them:

- Brain dump asks the AI for "compact" JSON, which keeps long brain dumps from running out of room.
- When task breakdown hits a problem, it sends the real reason back with a normal response, the same way brain dump does, so the app shows that reason instead of a generic error.

**Decisions:**
None (Caroline gave her OK to deploy).

**Database:**
No change. Functions deployed to the real project: parse-brain-dump version 5, break-down-task version 3. Sign-in is still required to use them.

**Checked:**
The deployed files were read back from the real project and match this pull request line for line. Previews still can't run the AI features (the test database has no functions), so the first real use is on the live app.

### 2026-10-27: Daily spoons from your ordinary okay day (spoon model, change 2)

**What and why:**
The check-in started everyone at 12 spoons and added or took away whole spoons: Bright added 2, Frozen took away 4, and each body signal took away half a spoon. Only the first check-in of the day counted. None of it was tied to the person.

What changed:

- **Ordinary okay day.** A new Settings card asks "On an ordinary okay day, how much can you get through?" The choices run from about 4 hours (8 spoons) to about 12 hours (24 spoons), or the person's own number from 4 to 30. Until they choose, the app uses 12, and the spoon meter invites them to set it.
- **The check-in works from that number:**
  - Energy scales it: Depleted 60%, Low 80%, Steady 100%, Present 105%, Bright 110%.
  - Other load takes a share off, never more than 30% in total:
    - Sensory: Noticeable 5%, A lot 10%, Overloaded 20%
    - State: Drifting or Chasing 5%, Numbing 10%, Frozen 15%
    - Body signals: 5% each, up to 15%
    - Yesterday over 110% of its budget: 10%
  - Today stays between 40% and 110% of the ordinary day.
- **Later check-ins** can lower today's number, never raise it.
- **Showing the math.** After a check-in, the app shows what it did (for example "Today starts with 9 spoons," with the math and the other load). The meter shows the same line, like "Ordinary day 16 · Low energy 80% · Other load −30% = 9 spoons."
- **Future days.** "Your usual" for future days and before the check-in is now the ordinary okay day. It used to be the middle of the last 14 budgets, which would only echo the ordinary day back once budgets come from it.
- **ⓘ explanations.** A tap-to-open ⓘ (it works on phones, where hover tooltips don't) now sits on:
  - the four check-in questions
  - the meter's numbers and its math line
  - the ordinary-day card
  - Effort, the two yes/no questions and Spoons in the task form
  - the Calendar's over-budget line

  All the wording lives in one file, `lib/explainers.ts`.
- A failed spoon budget after a check-in is now logged instead of silently ignored.

**Decisions:**
See the Decisions table.

**Database:**
Migration 016 adds `usual_budget` to profiles (empty means 12) and `budget_basis` to each day's spoons (what went into the number, so the meter can show it). Applied to the test database. Needed on the real database before merging, with Caroline's OK. Past days and any budget already set today are unchanged.

**Checked:**
147 tests, including the research example (ordinary day 12, Low energy, a lot of sensory input, drifting, a headache = 7.5), the caps, the big-day rule and later check-ins only lowering. In a real browser against the test database:

- The meter invited setting the ordinary day.
- The ⓘ in Settings opened, 16 saved, and an own number of 40 couldn't be saved.
- After a big day, a Low, a lot of sensory input, drifting, headache check-in gave 9 spoons with the math.
- A calmer second check-in kept 9.
- A Depleted, overloaded, frozen third check-in lowered it to 6.5, and the saved math matched.
- The meter showed the math line and every ⓘ opened.
- In the task form, the ⓘ opened without closing the form or ticking the checkbox next to it.
- On a phone-width screen, the ⓘ boxes stayed on screen with no sideways scrolling.

### 2026-10-29: Old account removed from the real database (no pull request)

**What and why:**
On her phone, Caroline's live account looked empty. Her computer had been on a preview, which uses the test database, and her real data from the original build (280 tasks, 10 repeats and 26 check-ins, July to September) sat under a different email from the one she uses now. She chose to keep her current account and delete the old one.

**Decisions:**
See the Decisions table.

**Database:**
With Caroline's explicit OK, the old login was deleted on the real database. Every table that holds a person's data is set to delete with the login (the same path as "Delete my account," migration 013), so all of its data went with it. No schema change.

**Checked:**
Before deleting, the email was matched exactly and all 19 data tables were confirmed to delete with the login. Afterward, nothing was left for the old account, and Caroline's current account was unchanged.

### 2026-10-29: Earn-back list and pattern note (spoon model, change 3)

**What and why:**
The starting earn-back values came from the original build. The research found them generous: together they allowed about 26 spoons back in a day, more than twice an ordinary day. Caroline chose to keep earn-back open-ended with no limit on the day's total, but to bring each item's value in line with the research and to notice when earn-back keeps making room for more work.

What changed:

- **Starting list for new accounts:**
  - Short walk outside (was "Walked"): +1, from 10 minutes, twice a day
  - Napped: +1, from 10 minutes, once a day
  - Meditated: +0.5, from 10 minutes, twice a day
  - Deep breathing: +0.5, from 3 minutes, twice a day
  - Body-double session, Said no, Delegated, Removed a task, Under-scheduled: +0.5 each
  - Protein snack and Hydration target: +0.5, unchanged
- **Existing accounts** see an "updated starting list" card on the Earn-back page that lists exactly what would change. "Use the updated starting list" updates only the built-in items. The person's own items, and what they've switched on, off or starred, stay as they are.
- **Adding your own** now has plain labels with ⓘ ("Spoons back," "Times a day," "Minutes needed"), examples including stretching, step work and an audio track, and a check that stops blank or out-of-range numbers. Any item can be renamed by tapping its name.
- **Pattern note:** when, on 3 days in the last 7, earn-back was at least a quarter of the day's spoons and the day carried more than an ordinary okay day, the spoon meter says so once: "On 3 days this week, earned-back spoons made room for more than an ordinary okay day. Worth noticing how those days felt." "Got it" puts it away for a week.
- Plainer wording when an item has reached its limit for the day.
- The earn-back panel on Today (the "More" button) points to the updated list when there is one ("See what would change"). Caroline found the old values there in testing and couldn't tell how to switch.

**Decisions:**
See the Decisions table.

**Database:**
No change.

**Checked:**
156 tests, including the starting list, switching over (built-in items only, the person's own items untouched), adding your own, and the pattern rule (the third qualifying day shows it; under a quarter, or not past an ordinary day, doesn't count). In a real browser against the test database:

- Three heavy earn-back days showed the note, and "Got it" kept it away after a reload.
- The updated-list card listed each change. Switching updated the built-in items, kept "Said no" switched off and starred, left a custom "Stretching" at its own values, and the card went away.
- Adding "Step work" with 0 spoons showed the check; with 1 spoon, twice a day, from 20 minutes, it saved. Renaming worked. A value of 9 on an existing item wasn't saved.
- The page fit a phone screen with no sideways scrolling.

### 2026-10-29: Wording pass (spoon model, change 4)

**What and why:**
Last of the four spoon model changes: names that fit the people the app is for, explanations behind the labels, and the app's own voice rules applied everywhere.

What changed:

- **Check-in.** The menu and page say "Check-in" (it fits the phone's bottom bar), with "How are you right now? A five-minute burnout check-in." under the title. The address stays /burnout, so old links work.
- **Your Wave** replaces "Burnout Wave" on Today and History, with an ⓘ explaining what the dots and line show. History's chart and filter say "Check-ins."
- **Phases**, heaviest first, with the same saved keys so nobody's phase changes:
  - Burnout recovery (was Burnout)
  - Reduced capacity (was Acute recovery)
  - Building back (was Rebuilding)
  - Steady
  - Stretch

  Each has a plain description, shown on the Foundation page, in onboarding, in an ⓘ on the Today badge, and in suggestions.
- **Phase suggestions** (now in `lib/phases.ts`, with tests):
  - They step down only as far as Reduced capacity, and then mention that Burnout recovery is there if it fits.
  - They no longer move anyone into it.
  - Fixed: from the heaviest phase, a calm week used to suggest jumping straight to Steady. It now suggests one step at a time.
- **Onboarding.** The welcome's two outdated lines are rewritten. It now describes a gentle planner and toolkit, and says reminders only come when you ask for them. Two skippable steps follow: the ordinary okay day, then "Where are you right now?" with the five phases. Each saves as soon as it's picked.
- **Voice.**
  - All 46 em dashes in the app's own words are gone, each rewritten to fit its sentence. Dash placeholders became words like "Not set" and "None yet."
  - A new guard test (`no-em-dashes.test.ts`) fails if an em dash comes back.
  - The three "Nice." lines no longer grade: "Meditation, logged for today."

**Decisions:**
See the Decisions table.

**Database:**
No change.

**Checked:**
163 tests, including the phase names and the suggestion rules (never into Burnout recovery; one step at a time), and the em dash guard. In a real browser against the test database:

- As a brand-new account, the welcome showed the new text. Choosing 16 spoons and Building back saved both, and the Today badge and its ⓘ showed Building back.
- Today shows "Your Wave," and the menu and the page say "Check-in."
- Five heavy check-ins suggested Reduced capacity, with the Burnout recovery line. In Reduced capacity, nothing was suggested.
- The Foundation page lists the five phases in order.
- The phone's bottom bar shows "Check-in" with no sideways scrolling.

### 2026-10-29: Phone bottom bar with More (views and mobile pass, 1 of 4)

**What and why:**
On a phone, the bottom bar crammed 11 buttons onto two rows, and Settings wasn't on it at all, so the only way there was typing the address. That surfaced when Caroline needed to check which account her phone was signed in to.

What changed:

- **The bar holds six buttons:** Today, Tasks, Calendar, Brain dump, Check-in and More, all on one row.
- **More** opens a panel from the bottom listing every other page with its icon and full name: Repeats, Delegation, Good Enough, Reframes, Compassion, History, Foundation, Earn back and Settings, plus the light and dark mode switch. Choosing one closes the panel.
- **More is highlighted** while you're on one of its pages, so you can tell where you are.
- **The computer's sidebar is unchanged.**
- **A new test** (`nav.test.ts`) reads the app's list of pages and fails if any of them can't be reached on a phone.

**Decisions:**
See the Decisions table.

**Database:**
No change.

**Checked:**
166 tests. In a phone-sized browser (360 and 390 pixels wide, the narrowest common phones):

- All six labels fit with nothing cut off, on one row about 55 pixels tall, with no sideways scrolling.
- More listed the nine pages. Tapping Settings opened it, closed the panel, and highlighted More.
- Tapping Brain dump opened it and marked it as the current page.
- The end of a long page (Settings) clears the bar.

### 2026-11-02: Loading failures say so (views and mobile pass, 2 of 4)

**What and why:**
When tasks failed to load, the Tasks page and the Calendar showed an empty list, which looks exactly like having nothing to do. That broke the house rule against hiding errors, and it made the phone account mix-up harder to tell apart from a loading problem.

What changed:

- **When tasks don't load,** both pages show a calm message instead of an empty list: "Couldn't load your tasks." (or "your calendar"), "Nothing has been lost. This is usually the connection. Try again in a moment.", a **Try again** button, and a small "What went wrong" with the technical reason. No red.
- **The Tasks page tabs** show their counts only once tasks have loaded, so a failure doesn't read as "Active (0)."
- **A new guard test** (`load-error.test.ts`) fails if either page stops handling a loading failure.

**Decisions:**
None (follows the house rule on errors).

**Database:**
No change.

**Checked:**
The guard test fails without the fix and passes with it, and `npm run verify` passes. In a real browser against the test database, with requests for tasks blocked to simulate a dropped connection:

- Both pages showed the message, with no empty-list text and no counts on the tabs.
- After unblocking, Try again loaded the Calendar with its task, and the Tasks page showed it too.

### 2026-11-02: "Test version" strip on previews (views and mobile pass, 3 of 4)

**What and why:**
Previews and the live app looked identical. Caroline spent an evening looking at practice data on a preview while her phone showed her real, nearly empty account, and neither screen said which was which.

What changed:

- **Every copy of the app that uses the test database** (previews and local development) shows a thin dusty-blue strip across the top: "Test version. Practice data only, not your real account. Open the live app." It shows on the sign-in page too.
- **The browser tab** starts with "Test version" as well.
- **It keys off the database, not the web address,** because the database is what decides whether the data is real. The live app connects to the real database, so it can't show the strip.

**Decisions:**
None (Caroline asked for the strip when the views and mobile pass was planned).

**Database:**
No change.

**Checked:**
New tests for the database check: the test project shows the strip, and the real project or a missing or broken address never does. `npm run verify` passes. In a real browser:

- The test copy showed the strip on the sign-in page and while signed in, at the top on phone and computer, with "Test version" in the tab and no sideways scrolling.
- A build pointed at the real database showed no strip and a normal tab title. Only its sign-in page was loaded, so nothing was read from the real database.

### 2026-11-03: Calendar and Today on a phone (views and mobile pass, 4 of 4)

**What and why:**
On a phone the Calendar's week stacks one day per card, and every day took a full card even with nothing on it. A week with a few tasks was a long scroll of mostly empty boxes. The Today page had the same problem in a smaller way: wide gaps and padding built for a computer screen, and the phase badge on the Foundation card wrapped onto two lines and squeezed the title beside it.

What changed (phones only; on a computer the seven-column week and the Today page look the same as before):

- **A day with nothing on it shrinks to one line:** the day, the date, and "Nothing planned". A day that's already gone shows just the day and date. A day with a finished task, or a repeat coming up, keeps its card.
- **Every day's header is one line:** day, date and the "2 tasks, 2.5 spoons" summary sit side by side instead of stacked.
- **Today has a little less space** between sections and inside the cards.
- **The phase badge stays on one line,** with its ⓘ beside it. The card's subtitle moved under the title row so it has the card's full width.

With the sample week below, the Calendar week is about a fifth shorter on a phone (1,556 to 1,260 pixels tall at 390 wide), and Today is about 270 pixels shorter.

**Decisions:**
None new. Empty days ahead also shrink to one line, not just past days, so the week reads the same way all the way through. Easy to change if Caroline would rather keep full cards for days ahead.

**Database:**
No change.

**Checked:**
New tests for which days count as empty (a past or future day with nothing on it is empty; a day with a finished task or a repeat coming up is not). `npm run verify` passes. In a real browser with a sample week (tasks today, tomorrow and in two days, one finished yesterday):

- At 360 and 390 wide: empty days show as one line, days with tasks keep their cards, nothing overlaps, and no sideways scrolling. The phase badge reads "Reduced capacity" on one line.
- At 1280 wide: the week's seven columns, the month view and Today look as they did.

### 2026-11-03: Pages and pop-ups fit a phone (#47)

**What and why:**
While checking steps on a phone, the Tasks page turned out to be wider than the screen: its right edge was cut off (the end of the subtitle, the All tab, the delete buttons, the footer). The page couldn't be scrolled sideways, so it just looked clipped. Part 4 of the mobile pass missed it because its screenshots were of Today and the Calendar.

Caroline then tried New task on her phone and the page seemed to freeze: she couldn't reach the title field, and her phone's browser force-quit once. The New task box was taller than the screen (about 1,000 pixels on a screen showing about 660 with the keyboard up) and couldn't scroll, so its top was above the screen's edge with no way to reach it.

What changed:

- **The box every page sits in grew to fit its widest piece** instead of the screen. That box comes from the scroll area around all pages, so the fix is in one place and covers every page.
- **The Tasks page's five tabs** (Active, Missed, Done, Archived, All) were wider than a phone. On a phone they now sit in two rows; on a computer, one row as before.
- **Pop-up boxes on a phone** (New task, editing, confirmations, all of them) now start near the top of the screen and scroll inside themselves, so every field and button can be reached and the keyboard doesn't cover the first field. On a computer they're centred as before.
- **Task buttons on a phone** sit in a row under the title, so titles and details use the card's full width instead of one or two words a line.

**Decisions:**
None.

**Database:**
No change.

**Checked:**
New guard tests (they fail without the fixes). `npm run verify` passes. In a real browser:

- At 360 and 390 wide, every page in the app was measured: nothing runs past the screen's edge (the only thing that does is the soft decorative circle on the Foundation card, which the card trims on purpose).
- At 390 wide with the screen shortened to what's left above a phone keyboard, New task opens with its title field in view, typing and backspace work, and the box scrolls to its buttons.
- At 1280 wide, the Tasks tabs and task buttons are one row and boxes are centred, as before.

The "Couldn't break it down" message on previews is the known gap: the test database has no AI functions (see Open items).

### 2026-11-03: Steps you add yourself (Phase 2, 1 of 3) (#48)

**What and why:**
Big tasks are easier to start in small pieces. A task can now have steps: smaller pieces, each with its own tick box, timing and spoons. This is the first of three changes. Subtasks (steps inside a step) and "Break this down" making steps come next.

What changed:

- **Steps sit inside their task's card** on the Tasks page, with "1 of 3 steps done · 4.5 spoons in all". "Add a step" adds one at the end. Each step can be ticked off, moved to another day, edited (time, effort and so on), deleted, or moved up or down the list.
- **Adding a step offers quick picks** for time (15 min, 30 min, 1 hr, 2 hr) and effort (Low, Medium, High), one tap each, with "About 2 spoons" worked out as you pick. Without a time, a step has no spoons and doesn't count toward its day, which is why ticking off Caroline's first test steps "didn't change much".
- **Finished steps move below the open ones**, crossed out, so what's left stays on top. Ticking off a step that isn't the last shows "One down. 2 steps to go."
- **Ticking anything off asks how long it actually took**, with quick picks (15 min to 2 hr), the estimate beside it if there was one, and room for a note about what made it that long or short. It used to ask only when there was an estimate. Skip ticks it off without a time; closing the box leaves it open. A task with steps doesn't ask, because each step already did.
- **Fixed: Skip in that box used to close it without ticking anything off.**
- **Only the smallest pieces count.** A task with steps counts through its steps: on Today, on the Calendar, in the spoon meter and in the tab counts. The task's own estimate isn't counted while it has steps, so nothing counts twice. Its total is the sum of its steps.
- **Each step has its own timing.** A new step starts with its task's (a timeframe or a day) and can be moved on its own. On the Calendar each step shows on its own day with "Part of" and the task's name. The task itself doesn't show there once it has steps.
- **Ticking off the last step ticks off the task**, with "That was the last one" and Undo. Ticking off a task ticks off its open steps too, also with Undo. Reopening a step reopens its task.
- **Moving a task moves the open steps that still share its timing.** Steps given their own day stay where they are. Undo puts them all back.
- **Deleting a task with steps asks first**, because its steps go with it. Letting a task go archives its steps with it.
- Steps don't offer "Make this repeat" or "Break this down" yet.

**Decisions:**
See the five 2026-11-03 rows in the Decisions table.

**Database:**
Migration 017 adds `tasks.parent_task_id` and `tasks.position`. Deleting a task deletes its steps (so Delete my account and Export still cover everything through `tasks`). A check in the database makes sure a step belongs to one of the person's own tasks and nothing goes deeper than task, step, subtask. Applied to the test database. Needs applying to the real database before this is merged, because the app saves the new columns.

**Checked:**
New tests for the rules (and a guard test for the how-long box, which fails without the change): what counts toward a day, totals, what ticking off and reopening changes (two levels deep), timing for new and moved steps, order, and grouping on the Tasks page. Tests for today's spoons, spent spoons and the Calendar with steps. `npm run verify` passes. On the test database, the database check refused a third level, a step on another person's task, and moves that would go too deep, and deleting a task removed its steps. In a real browser at 360, 390 and 1280 wide, with a task and two steps:

- Adding a step gave it the task's timing; moving it up the list reordered it.
- Quick picks: 1 hr Medium showed "About 2 spoons", 15 min Low "About 0.5 spoons", 30 min with no effort "About 1 spoon (effort counts as medium until you pick)"; all three saved with their time and effort. Ticking one off showed "One down. 2 steps to go." and moved it below the others.
- The how-long box opened for a step with no estimate, and Skip ticked it off. On a step estimated at 30 minutes, picking 45 min showed "0.25h longer than estimated" and saved 0.75 hours with the note. Closing the box left a task open. Ticking off a task with steps didn't ask and ticked off its open step.
- Ticking off every step ticked off the task with "That was the last one" and Undo; Undo reopened the task.
- Ticking off the task ticked off its steps; reopening a step from Done reopened the task.
- Deleting the task asked first, naming its 3 steps.
- Today said "1 for today" (the one step due today). The Calendar showed the steps with "Part of Plan the launch" and not the task.
- Nothing ran past the screen's edge, and no errors on the page.

### 2026-11-08: "Break this down" makes steps (Phase 2, 3 of 3) (#49)

**What and why:**
Caroline used "Break this down" on the live app after steps arrived, and the AI's pieces came back as separate tasks instead of rolling up under the task. That was the old behaviour, planned as change 3; it moved ahead of subtasks (change 2) because she's using it now.

What changed:

- **The AI's suggestions open in a review box first.** Nothing is saved until you add them. Each suggestion shows its title (two lines, so long ones can be read), time, effort and "About N spoons". You can edit any of them, remove ones you don't want, and move them up or down.
- **"Where they go":** with the task (its own timing, the default), Today, This week, Next week, or a specific day. You can still move any step on its own afterwards.
- **"Add 4 steps"** adds them as steps of the task, after any steps it already has, with the total shown ("4 steps · 5 spoons in all"). They then work like any other step.
- **Steps of a billable task are billable.** Otherwise the AI's guess is used.
- The AI function itself is unchanged, so nothing needs deploying.

**Decisions:**
None new. This is the third change agreed on Nov 3 (see the Decisions table).

**Database:**
No change.

**Checked:**
New tests for the review box rules: where steps go (one answer to when), turning suggestions into editable drafts (blank titles dropped, nonsense times and efforts dropped, at most 10, billable from the task), and moving drafts. `npm run verify` passes. In a real browser at phone size, against the test database's AI (which works now):

- "Plan the launch email" got 5 suggestions with times and efforts ("5 steps · 6 spoons in all"). The box fit the screen.
- Editing a title, removing one, moving one up, changing a time and choosing This week, then "Add 4 steps": the 4 steps saved under the task in the order shown, each in This week with its time and effort, and "Added 4 steps to "Plan the launch email"." No separate tasks were made.
- Nothing ran past the screen's edge, and no errors on the page.

### 2026-11-09: Subtasks (Phase 2, 2 of 3) (#50)

**What and why:**
The last piece of Phase 2. A step can now have subtasks, for when a step is still too big to start. They're off by default so steps stay simple on a phone (Caroline's decision, Nov 3).

What changed:

- **A "Subtasks" switch in Settings,** off by default, with an ⓘ. Turning it on adds "Add a subtask" and "Break this down" to every step.
- **Add a subtask** works like adding a step: a title, quick picks for time and effort, and "About N spoons".
- **Break this down on a step** suggests subtasks, in the same review box as for a task. The AI is told which task the step belongs to, so its suggestions fit (sent as notes, so the AI function didn't change).
- **The same rules, one level down:** a step's total is the sum of its subtasks, and only the smallest pieces count toward a day. Ticking off the last subtask ticks off its step, and if that was the last step, the task too.
- **Turning the switch off** hides both buttons. Subtasks you already have stay and keep counting, so totals never change out of sight.
- **Fixed before it shipped:** a subtask's card crashed the page, because it asked for the name of a level below subtasks. Caught in the browser check; there's a test for it now.

**Decisions:**
See the 2026-11-03 rows in the Decisions table (two levels, subtasks off by default, the switch adds both buttons).

**Database:**
Migration 018 adds `user_profiles.show_subtasks` (off by default). Applied to the test database. Needs applying to the real database before this is merged.

**Checked:**
New tests for who can have smaller pieces and for naming the level below. `npm run verify` passes. In a real browser at 360 wide, on the test database:

- With the switch off, a step had no "Add a subtask" or "Break this down"; the task still had "Add a step".
- Turning the switch on saved it. The step then offered both.
- Adding "Pick the subject line" (15 min) showed "0 of 1 subtask done · 0.5 spoons in all" on the step, and the task's total went up to match.
- Break this down on the step opened "Smaller subtasks for "Write the launch email"" with 5 suggestions; adding them saved all 5 under the step, with the step's timing.
- Ticking off every subtask ticked off the step, then the task (its other step was already done), with "That was the last one."
- Turning the switch off again kept the subtasks showing and hid the add button.
- Nothing ran past the screen's edge, and no errors on the page.

### 2026-11-09: Test database email through Resend (no pull request)

**What and why:**
The test database sent sign-in emails through Supabase's built-in service, which allows 2 an hour. Testing a preview a few times locked Caroline out. Caroline set the test project to send through Resend, like the live app, with its own key ("Quiet Hours test", sending only, carolinehinton.com) and the sender name "Quiet Hours Test". The email limit is 30 an hour.

**Database:**
No change. Settings only, in the Supabase dashboard (custom SMTP and rate limits).

**Checked:**
Caroline signed in on a preview several times in a row without being blocked. Resend shows the sign-in email from "Quiet Hours Test" for the test project, delivered.

### 2026-11-09: "Things like this usually take you…" (#51)

**What and why:**
Time blindness makes estimating hard. Since Nov 3, every tick-off asks how long it actually took. This uses those answers to help with the next estimate (spec v3, "How long will this really take?").

What changed:

- **Under Time, in New task and Edit:** once at least 3 finished tasks or steps share a meaningful word with the title ("email", "proposal"), a line says what they usually took: *"Things like this have usually taken you about 1.25 hours (going by 3 you've finished with "email" in the title)."* With "Use 1.25 hours" to fill it in.
- **If the estimate is more than 30% under that,** it adds "That's a little longer than your estimate," with "Keep mine" to hide it. Close or longer estimates get no note.
- **Overall pattern:** once there are 5 finished things with both an estimate and a time, a line like *"Overall, things take you about 1.4 times what you estimate."*
- **In "Add a step"** too, under the quick picks (the similar-things line only).
- "Usual" is the middle time of the most similar ones (up to 10), to the quarter hour, so one very long day doesn't skew it. Open, let-go and untimed things don't count, and a task being edited isn't compared with itself.
- It never blocks or grades. Until there's enough history, nothing shows.

**Decisions:**
See the two 2026-11-09 rows in the Decisions table.

**Database:**
No change.

**Checked:**
New tests in `estimate-history.test.ts` (word matching, needing 3 similar, the middle time, when the note shows and when it stays quiet, what's ignored, the overall pattern and its wording). `npm run verify` passes. In a real browser at phone size with 5 finished tasks (3 about email):

- New task "Email the new client": with no time, "usually about 1.25 hours" and "Overall, things take you about 2 times what you estimate."; at 0.5 hours, the note and "Keep mine" appeared; "Use 1.25 hours" filled in 1.25 and the note went away; "Keep mine" hid it; an unrelated title ("Repaint the shed") showed only the overall line.
- Add a step "Email the attendees": the line appeared, and "Use" changed the step to about 2.5 spoons.
- Nothing ran past the screen's edge, and no errors on the page.

### 2026-11-09: Remove the original template's server (tidy-up) (#52)

**What and why:**
The app started from a template with its own small server (Express, a SQLite database and Passport sign-in). Since the move to Supabase, nothing used it, but it was still in the code, in the packages installed for every build, and in the house rules as "leftovers to ignore". Removing it means less to read, faster installs, and no chance of building on the wrong thing.

What changed:

- Removed `server/`, `shared/` and `drizzle.config.ts`.
- Removed 19 packages the server needed (Express, SQLite, Drizzle, Passport, session storage and their type packages). About 2,700 lines came out of the package lock file.
- **The one thing the app still borrowed:** four older pages (Delegation, Good Enough, Compassion and Check-in, plus Today and the Wave) took the shapes of their data from `shared/schema.ts`. Those shapes now live in `client/src/lib/app-types.ts`, written out to match exactly.
- `npm run dev` now starts the app's own dev server (Vite) instead of the old one. CLAUDE.md and the README say so, and the README no longer has em dashes.
- `npm run build` is now just `vite build`. The old build script ran through a helper (`tsx`) that Vercel's first build of this change couldn't find once the server packages were gone, so the preview failed to build. Building with Vite directly needs no helper.

**Decisions:**
None new (the Nov 9 order: Resend, then "things like this", then tidy-ups).

**Database:**
No change.

**Checked:**
`npm run verify` passes (217 tests). A clean install from the lock file works, and the Vercel preview builds. In a real browser on the preview at phone size, every page in the app (all 14) opened with its content and no errors on the page.

### 2026-11-11: Talk it through, the coach (part 1 of 4) (#53)

**What and why:**
"Talk it through" is the coach from the plan doc "Talk it through: plan v1": a calm chat that knows your day and helps you choose one next step. It carries over Calm Commander's ideas and coaching prompt, rebuilt on what Quiet Hours already does. This first part is the coach itself. Nothing is saved yet; keeping conversations is part 4.

What changed:

- **A new page, Talk it through.** It has the chat, a "Start over" button, a line saying the conversation isn't saved, and the crisis resources always in view (988, text HOME to 741741, findahelpline.com) with "a planning companion, not a therapist or a substitute for care."
- **The phone's bottom bar** now reads Today, Tasks, Calendar, Brain dump, Talk, More. Check-in moved into More. Computers show the full name in the side menu.
- **A new AI function, `coach`,** with the Talk it through prompt and Caroline's Nov 9 edits. The app sends the whole conversation each time, because the AI keeps no memory between messages. Very long conversations send only the most recent 40 messages.
- **The day summary** (`coach-summary.ts`) goes with each message, so the coach's advice fits the day. It covers spoons, the latest check-in (state, energy, sensory and how many body signals, not which ones), the phase, today's tasks and steps with spoons and time, missed ones, this week's tasks, and the estimate pattern. Notes, compassion entries and profile details are never sent. It uses the same rules as the Today page and the spoon meter.
- **40 messages a day in the beta**, with a note from 30 on ("You've got 10 messages left today. They reset at midnight."). At 40, a conversation under way can carry on for up to 10 more, so nobody is cut off mid-way; a new one waits for midnight in the person's own time zone. The crisis resources are never limited. The server enforces the same numbers, and a test fails if the app's copy and the server's copy drift apart.
- **The count is the only thing stored** (`coach_usage`, migration 019): one number per person per day. People can read their own counts. Only the coach function can add to them, after a reply came back, so nobody can reset their own count and a failed reply doesn't use one up. It's deleted with the account and included in Export.
- **Nothing anyone says is logged.** When the AI request fails, only its status number is logged.
- **The coach's replies follow the voice rules.** Besides the prompt, the function swaps any dash between phrases for a comma and any exclamation mark for a period, since the preview showed the coach writing "right now - frozen, low energy - ".
- The check-in's energy and sensory words moved into `burnout-utils.ts`, so the Check-in page and the summary share one copy.

**Decisions:**
Talk it through's place on the phone's bottom bar, the "Talk" label, and the coach's plan decisions from Nov 9 (see the table).

**Database:**
Migration 019 (`coach_usage` and `coach_count_message`) applied to the test database on Nov 9 with Caroline's OK. The security check showed only the three older items already in Open items. Production needs migration 019 and the `coach` function deployed before this merges, with Caroline's OK.

**Checked:**
`npm run verify` passes (238 tests). On the preview against the test database, as the test user with a seeded day (four tasks on today, one this week, a Frozen check-in):

- The coach named the real tasks, noticed the Frozen check-in, kept replies short and suggested small steps. Told "none of those fit, I'm at my desk," it believed that and offered desk-sized ones.
- The request carried the day summary and never the check-in note or the names of body signals.
- From the app, writing a count was refused by row-level security, and calling the counter was refused.
- With the count set to 30: the "10 left" note. At 39, a new conversation went through to 40, then the "keep going with this conversation" note, and the next message went through to 41. After Start over: "That's all the coach messages for today" and the box turned off.
- The server, called directly, refused a new conversation past the limit, a made-up date, a conversation out of order, and anyone signed out.
- The next day the count started again at zero.
- The page fit a phone (390 wide) and a computer (1280 wide), with no errors on the page.
- The first summary said "9 committed, 7 free", and the coach read that as a shortfall. The line now says "Today's open tasks need 9 ... so 7 are left over after today's tasks."

## Open items

Things noticed along the way that aren't scheduled yet:

- Phone testing of previews needs the sign-in email to open in the same browser that's signed in to Vercel.
- Unused profile columns from the original build (diagnosis, OCPD awareness, age range, gender). Raised as a question for counsel.
- Fonts load from Google's servers, which see visitors' IP addresses. Hosting them with the app would stop that.
- The Archived filter on the Tasks page compares dates using UTC. It's minor, but it should use the local date like everything else.
- The two or three early-look testers are still to be chosen.
- The real database still has three accounts with no data that were each used once in July (two gmail.com addresses and caroline@growthpartnerpros.com, which never signed in). Decide whether to remove them before beta.
- Security check on the test database (Nov 3) flagged three older items: `set_updated_at` doesn't fix its search path; `delete_my_account` runs with extra rights (on purpose, but flagged); leaked-password protection is off (sign-in uses magic links, so it matters less).
- The spoon model is done (changes 1 to 4). Learning from history (suggesting a lower ordinary day after hard stretches) waits for 2 weeks of check-ins.
- The Repeats page can show "Nothing repeats yet" for a repeat created outside the app until the page is reloaded. Seen only in testing; repeats made in the app show right away.
- Not built yet from the spoon rules in spec v3: the 2nd-override heads-up, the link to the last crash in the pause, phases changing Foundation, the hours meter, and the two check-in safety rules. "Make it smaller" for moved tasks waits for subtasks.
- Talk it through parts 2 to 4 (Just one thing, suggested tasks, keeping conversations), and opening the coach from a hard check-in, an overloaded day or a task you keep moving.
- The coach still sometimes asks two questions in one reply and uses "just" in a soft way ("just look at it"). Worth watching in beta before changing the prompt again.
- The monthly spend limit on the Anthropic workspace needs setting before beta testers use the coach.

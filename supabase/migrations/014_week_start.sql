-- 014: let each person choose which day their week starts.
-- 0 = Sunday (the app's original convention, and the default),
-- 1 = Monday, 6 = Saturday. Used by the Calendar and the Tasks page
-- "This week" and "Next week" filters. Repeat schedules are unaffected.

alter table public.user_profiles
  add column if not exists week_starts_on smallint not null default 0
    check (week_starts_on in (0, 1, 6));

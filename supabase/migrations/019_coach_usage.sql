-- 019: the coach's daily message count ("Talk it through", part 1).
--
-- The beta gives everyone 40 coach messages a day (Caroline's decision,
-- Nov 9). This table holds one number per person per day: how many messages
-- they've sent the coach. Never what anyone said. The conversations
-- themselves aren't saved anywhere in part 1.
--
-- "day" is the person's own local date (the app sends it from
-- localIsoDate()), so the count resets at their midnight, not UTC's.
--
-- Who can do what:
--   - A person can read their own counts (row-level security), so the app
--     can show "about 10 left today".
--   - Nobody can write them from the app. Only the coach function counts a
--     message, after the coach has replied, using the server's own key. That
--     way nobody can reset their own count, and a failed reply doesn't use
--     one up.
--   - Deleting the account removes the counts (on delete cascade), and
--     Export includes them (USER_DATA_TABLES in client/src/lib/data.ts).

create table if not exists public.coach_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  messages integer not null default 0 check (messages >= 0),
  primary key (user_id, day)
);

comment on table public.coach_usage is
  'How many messages each person sent the coach on each of their local days. Counts only, never content.';

alter table public.coach_usage enable row level security;

drop policy if exists "coach_usage: read own" on public.coach_usage;
create policy "coach_usage: read own"
  on public.coach_usage
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No insert, update or delete policies: the app can't change counts.

-- Counts one message for a person on their local day and returns the new
-- total. Called only by the coach function with the server's key.
-- The day must be within a day of today in UTC, which covers every time
-- zone, so a made-up date can't be used to start a fresh count.
create or replace function public.coach_count_message(p_user uuid, p_day date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  utc_today date := (now() at time zone 'utc')::date;
  total integer;
begin
  if p_user is null then
    raise exception 'No person given' using errcode = '22004';
  end if;
  if p_day < utc_today - 1 or p_day > utc_today + 1 then
    raise exception 'That day is not today' using errcode = '22008';
  end if;

  insert into public.coach_usage as u (user_id, day, messages)
  values (p_user, p_day, 1)
  on conflict (user_id, day) do update set messages = u.messages + 1
  returning u.messages into total;

  return total;
end;
$$;

revoke all on function public.coach_count_message(uuid, date) from public;
revoke all on function public.coach_count_message(uuid, date) from anon;
revoke all on function public.coach_count_message(uuid, date) from authenticated;
grant execute on function public.coach_count_message(uuid, date) to service_role;

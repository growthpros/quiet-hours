-- 020: keeping coach conversations ("Talk it through", part 2).
--
-- Caroline's decisions (Nov 9, plan doc "Talk it through: plan v1"):
--   - Each person chooses whether to keep their conversations. Off by default.
--   - Kept ones last 30 days, 90 days, or until the person deletes them.
--   - Any one conversation can be deleted, or all of them at once.
--   - A pinned conversation stays past its 30 or 90 days.
--
-- How long is measured: from the conversation's last message, so one the
-- person keeps coming back to doesn't vanish mid-use.
--
-- The rule follows the person's current setting, so shortening 90 days to
-- 30 applies to older conversations too (the app says so, and asks, first).
--
-- What's stored: the words of kept conversations, and nothing for ones that
-- aren't kept. These are the most sensitive rows in the app, so:
--   - row-level security: only the person can read, add or delete their own;
--   - messages can't be edited after the fact (no update policy);
--   - deleting the account removes everything (on delete cascade);
--   - Export includes both tables (USER_DATA_TABLES in client/src/lib/data.ts);
--   - a nightly clean-up inside the database deletes conversations past
--     their time, so "30 days" means 30 days even if nobody opens the app.

-- The setting: 'off', '30', '90' or 'forever' (until I delete).
alter table public.user_profiles
  add column if not exists coach_keep text not null default 'off'
  check (coach_keep in ('off', '30', '90', 'forever'));

create table if not exists public.coach_conversations (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- The first line of the person's first message, for the list.
  title text not null check (char_length(title) between 1 and 200),
  pinned boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null
);

comment on table public.coach_conversations is
  'Coach conversations the person chose to keep. Deleted after 30 or 90 days unless pinned, or kept until they delete them.';

create index if not exists coach_conversations_user_updated
  on public.coach_conversations (user_id, updated_at desc);

create table if not exists public.coach_messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.coach_conversations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  created_at bigint not null
);

comment on table public.coach_messages is
  'The messages of kept coach conversations, the person''s and the coach''s.';

create index if not exists coach_messages_conversation
  on public.coach_messages (conversation_id, id);

alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;

-- Conversations: the person can read, start, pin and delete their own.
drop policy if exists "coach_conversations: read own" on public.coach_conversations;
create policy "coach_conversations: read own" on public.coach_conversations
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "coach_conversations: add own" on public.coach_conversations;
create policy "coach_conversations: add own" on public.coach_conversations
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "coach_conversations: change own" on public.coach_conversations;
create policy "coach_conversations: change own" on public.coach_conversations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "coach_conversations: delete own" on public.coach_conversations;
create policy "coach_conversations: delete own" on public.coach_conversations
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Messages: read and add to their own conversations only; never edited.
drop policy if exists "coach_messages: read own" on public.coach_messages;
create policy "coach_messages: read own" on public.coach_messages
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "coach_messages: add own" on public.coach_messages;
create policy "coach_messages: add own" on public.coach_messages
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.coach_conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

drop policy if exists "coach_messages: delete own" on public.coach_messages;
create policy "coach_messages: delete own" on public.coach_messages
  for delete to authenticated using ((select auth.uid()) = user_id);

-- The nightly clean-up. Deletes, for each person:
--   - setting '30' or '90': unpinned conversations whose last message is
--     older than that many days;
--   - setting 'off': everything (the app already deletes these when keeping
--     is turned off; this is the safety net).
-- Setting 'forever' keeps everything. Messages go with their conversation.
-- Returns how many conversations were deleted.
create or replace function public.coach_cleanup()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  gone integer;
begin
  delete from public.coach_conversations c
  using public.user_profiles p
  where p.user_id = c.user_id
    and (
      p.coach_keep = 'off'
      or (p.coach_keep = '30' and not c.pinned and c.updated_at < now_ms - 30::bigint * 86400000)
      or (p.coach_keep = '90' and not c.pinned and c.updated_at < now_ms - 90::bigint * 86400000)
    );
  get diagnostics gone = row_count;
  return gone;
end;
$$;

revoke all on function public.coach_cleanup() from public;
revoke all on function public.coach_cleanup() from anon;
revoke all on function public.coach_cleanup() from authenticated;

-- Run it every night at 3:17 UTC (late evening to early morning across the
-- US, UK and Australia). Scheduling the same name again replaces the job,
-- so this file can run twice safely.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
select cron.schedule('coach-cleanup', '17 3 * * *', $$select public.coach_cleanup()$$);

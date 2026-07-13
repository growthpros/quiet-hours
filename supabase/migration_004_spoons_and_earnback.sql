-- ============================================================================
-- Quiet Hours, migration 004: Spoons + earn-back
--
-- Adds:
--   spoon_ledger        : per user per day, running totals
--   earn_back_actions   : per user rules (label, emoji, value, cap, enabled)
--   earn_back_events    : per user log of each earn-back instance
--   override_events     : per user log of spoon-limit overrides (category + free text)
--   phase_transitions   : per user log of accepted/dismissed phase suggestions
--
-- All additive. No changes to existing tables.
-- Row-level security policies mirror the existing patterns.
-- ============================================================================

-- ---------- Spoon ledger (per user per day) ----------
create table if not exists public.spoon_ledger (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  allotted numeric not null default 0,
  committed numeric not null default 0,
  spent numeric not null default 0,
  earned_back numeric not null default 0,
  created_at bigint not null,
  updated_at bigint not null,
  unique (user_id, log_date)
);
create index if not exists spoon_ledger_user_date_idx
  on public.spoon_ledger(user_id, log_date desc);

alter table public.spoon_ledger enable row level security;
create policy "own rows: spoon_ledger select"
  on public.spoon_ledger for select using (auth.uid() = user_id);
create policy "own rows: spoon_ledger insert"
  on public.spoon_ledger for insert with check (auth.uid() = user_id);
create policy "own rows: spoon_ledger update"
  on public.spoon_ledger for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Earn-back rules (per user) ----------
create table if not exists public.earn_back_actions (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null,
  label text not null,
  icon text,
  spoon_value numeric not null default 1,
  daily_cap int not null default 3,
  duration_min_minutes int,
  linked_pillar_key text,
  featured boolean not null default false,
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at bigint not null,
  unique (user_id, action_key)
);
create index if not exists earn_back_actions_user_idx
  on public.earn_back_actions(user_id, sort_order);

alter table public.earn_back_actions enable row level security;
create policy "own rows: earn_back_actions select"
  on public.earn_back_actions for select using (auth.uid() = user_id);
create policy "own rows: earn_back_actions insert"
  on public.earn_back_actions for insert with check (auth.uid() = user_id);
create policy "own rows: earn_back_actions update"
  on public.earn_back_actions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: earn_back_actions delete"
  on public.earn_back_actions for delete using (auth.uid() = user_id);

-- ---------- Earn-back events (per user, per instance) ----------
create table if not exists public.earn_back_events (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id bigint not null references public.earn_back_actions(id) on delete cascade,
  log_date date not null,
  spoons_awarded numeric not null default 0,
  at_cap boolean not null default false,
  note text,
  created_at bigint not null
);
create index if not exists earn_back_events_user_date_idx
  on public.earn_back_events(user_id, log_date desc);
create index if not exists earn_back_events_action_idx
  on public.earn_back_events(action_id);

alter table public.earn_back_events enable row level security;
create policy "own rows: earn_back_events select"
  on public.earn_back_events for select using (auth.uid() = user_id);
create policy "own rows: earn_back_events insert"
  on public.earn_back_events for insert with check (auth.uid() = user_id);
create policy "own rows: earn_back_events update"
  on public.earn_back_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: earn_back_events delete"
  on public.earn_back_events for delete using (auth.uid() = user_id);

-- ---------- Override events (spoon-limit overrides with truth-catching text) ----------
create table if not exists public.override_events (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  spoons_over numeric not null,
  category text not null,
  free_text text,
  created_at bigint not null
);
create index if not exists override_events_user_date_idx
  on public.override_events(user_id, log_date desc);

alter table public.override_events enable row level security;
create policy "own rows: override_events select"
  on public.override_events for select using (auth.uid() = user_id);
create policy "own rows: override_events insert"
  on public.override_events for insert with check (auth.uid() = user_id);
create policy "own rows: override_events update"
  on public.override_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: override_events delete"
  on public.override_events for delete using (auth.uid() = user_id);

-- ---------- Phase transitions (log of accepted/dismissed suggestions) ----------
create table if not exists public.phase_transitions (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_phase text,
  to_phase text not null,
  suggested boolean not null default true,
  accepted boolean not null default false,
  reason text,
  created_at bigint not null
);
create index if not exists phase_transitions_user_idx
  on public.phase_transitions(user_id, created_at desc);

alter table public.phase_transitions enable row level security;
create policy "own rows: phase_transitions select"
  on public.phase_transitions for select using (auth.uid() = user_id);
create policy "own rows: phase_transitions insert"
  on public.phase_transitions for insert with check (auth.uid() = user_id);
create policy "own rows: phase_transitions update"
  on public.phase_transitions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

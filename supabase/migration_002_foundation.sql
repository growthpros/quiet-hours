-- ============================================================================
-- Quiet Hours, migration 002: Foundation (Bottom of the Pyramid) + Profile
--
-- Additive only. No existing tables are touched.
-- All new tables use row-level security so each user sees only their own rows.
-- ============================================================================

-- ---------- User profile ----------
-- One row per user. Auto-created on first sign-in.
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  diagnosis text check (diagnosis in ('adhd','autism','audhd','overwhelmed','prefer_not_to_say')) default null,
  ocpd_aware boolean not null default false,
  current_phase text check (current_phase in ('acute_recovery','rebuilding','steady','stretch','burnout')) default null,
  age_range text default null,
  gender text not null default '[]',
  insights_opt_in boolean not null default true,
  learning_style text check (learning_style in ('jump_in','guided_first_time','show_me_everything')) default 'guided_first_time',
  seeded_pillars boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null
);
alter table public.user_profiles enable row level security;
create policy "own rows: user_profiles select"
  on public.user_profiles for select
  using (auth.uid() = user_id);
create policy "own rows: user_profiles insert"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);
create policy "own rows: user_profiles update"
  on public.user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- Foundation pillars (per user) ----------
create table if not exists public.foundation_pillars (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  pillar_key text not null,
  custom_label text,
  icon text,
  target_type text not null check (target_type in ('checkbox','count','minutes','units','multiselect')),
  target_value numeric,
  unit text,
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at bigint not null
);
create index if not exists foundation_pillars_user_idx
  on public.foundation_pillars(user_id, sort_order);
alter table public.foundation_pillars enable row level security;
create policy "own rows: foundation_pillars select"
  on public.foundation_pillars for select
  using (auth.uid() = user_id);
create policy "own rows: foundation_pillars insert"
  on public.foundation_pillars for insert
  with check (auth.uid() = user_id);
create policy "own rows: foundation_pillars update"
  on public.foundation_pillars for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "own rows: foundation_pillars delete"
  on public.foundation_pillars for delete
  using (auth.uid() = user_id);

-- ---------- Daily foundation logs ----------
-- One row per (user, pillar, day). Upsert on that composite key.
create table if not exists public.daily_foundation_logs (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  pillar_id bigint not null references public.foundation_pillars(id) on delete cascade,
  log_date date not null,
  value_numeric numeric,
  value_bool boolean,
  value_json text,
  notes text,
  created_at bigint not null,
  updated_at bigint not null,
  unique (user_id, pillar_id, log_date)
);
create index if not exists daily_foundation_logs_user_date_idx
  on public.daily_foundation_logs(user_id, log_date desc);
alter table public.daily_foundation_logs enable row level security;
create policy "own rows: daily_foundation_logs select"
  on public.daily_foundation_logs for select
  using (auth.uid() = user_id);
create policy "own rows: daily_foundation_logs insert"
  on public.daily_foundation_logs for insert
  with check (auth.uid() = user_id);
create policy "own rows: daily_foundation_logs update"
  on public.daily_foundation_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "own rows: daily_foundation_logs delete"
  on public.daily_foundation_logs for delete
  using (auth.uid() = user_id);

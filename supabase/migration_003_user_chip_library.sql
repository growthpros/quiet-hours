-- ============================================================================
-- Quiet Hours, migration 003: Personal chip library.
-- Backs "add your own" chips in burnout check-in and other multi-select flows.
-- Additive only.
-- ============================================================================

create table if not exists public.user_chip_library (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('pull','body','symptom','other')),
  label text not null,
  hidden boolean not null default false,
  created_at bigint not null,
  unique (user_id, category, label)
);
create index if not exists user_chip_library_user_cat_idx
  on public.user_chip_library(user_id, category);

alter table public.user_chip_library enable row level security;

create policy "own rows: user_chip_library select"
  on public.user_chip_library for select
  using (auth.uid() = user_id);
create policy "own rows: user_chip_library insert"
  on public.user_chip_library for insert
  with check (auth.uid() = user_id);
create policy "own rows: user_chip_library update"
  on public.user_chip_library for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "own rows: user_chip_library delete"
  on public.user_chip_library for delete
  using (auth.uid() = user_id);

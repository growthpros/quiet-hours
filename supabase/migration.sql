-- ============================================================================
-- Quiet Hours — initial schema
--
-- Every table has a user_id column that references auth.users(id).
-- Row-level security ensures each user can only ever see their own rows,
-- enforced at the database — not just in application code.
-- ============================================================================

-- ---------- Delegation tasks ----------
create table public.delegation_tasks (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  urgency int not null check (urgency between 1 and 5),
  importance int not null check (importance between 1 and 5),
  quadrant text not null check (quadrant in ('do','schedule','delegate','drop')),
  assignee text,
  released_control int not null default 0,
  completed int not null default 0,
  created_at bigint not null
);
create index delegation_tasks_user_created_idx
  on public.delegation_tasks(user_id, created_at desc);
alter table public.delegation_tasks enable row level security;

create policy "own rows: delegation_tasks select"
  on public.delegation_tasks for select
  using (auth.uid() = user_id);
create policy "own rows: delegation_tasks insert"
  on public.delegation_tasks for insert
  with check (auth.uid() = user_id);
create policy "own rows: delegation_tasks update"
  on public.delegation_tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "own rows: delegation_tasks delete"
  on public.delegation_tasks for delete
  using (auth.uid() = user_id);


-- ---------- Checklist runs ----------
create table public.checklist_runs (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null,
  template_label text not null,
  items text not null, -- JSON string: [{id,label,required,done}]
  completed int not null default 0,
  shipped int not null default 0,
  created_at bigint not null
);
create index checklist_runs_user_created_idx
  on public.checklist_runs(user_id, created_at desc);
alter table public.checklist_runs enable row level security;

create policy "own rows: checklist_runs select"
  on public.checklist_runs for select
  using (auth.uid() = user_id);
create policy "own rows: checklist_runs insert"
  on public.checklist_runs for insert
  with check (auth.uid() = user_id);
create policy "own rows: checklist_runs update"
  on public.checklist_runs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "own rows: checklist_runs delete"
  on public.checklist_runs for delete
  using (auth.uid() = user_id);


-- ---------- Compassion entries ----------
create table public.compassion_entries (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger text not null,
  first_thought text not null,
  intensity_before int not null check (intensity_before between 1 and 10),
  reframe text not null,
  intensity_after int not null check (intensity_after between 1 and 10),
  outcome text,
  created_at bigint not null
);
create index compassion_entries_user_created_idx
  on public.compassion_entries(user_id, created_at desc);
alter table public.compassion_entries enable row level security;

create policy "own rows: compassion_entries select"
  on public.compassion_entries for select
  using (auth.uid() = user_id);
create policy "own rows: compassion_entries insert"
  on public.compassion_entries for insert
  with check (auth.uid() = user_id);
create policy "own rows: compassion_entries update"
  on public.compassion_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "own rows: compassion_entries delete"
  on public.compassion_entries for delete
  using (auth.uid() = user_id);


-- ---------- Burnout check-ins ----------
create table public.burnout_checkins (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  energy int not null check (energy between 1 and 5),
  sensory int not null check (sensory between 1 and 5),
  intensity real not null,
  symptoms text not null default '[]', -- JSON
  state text check (state in ('grounded','drifting','chasing','numbing','frozen')),
  pulls text not null default '[]',    -- JSON
  note text,
  created_at bigint not null
);
create index burnout_checkins_user_created_idx
  on public.burnout_checkins(user_id, created_at);
alter table public.burnout_checkins enable row level security;

create policy "own rows: burnout_checkins select"
  on public.burnout_checkins for select
  using (auth.uid() = user_id);
create policy "own rows: burnout_checkins insert"
  on public.burnout_checkins for insert
  with check (auth.uid() = user_id);
create policy "own rows: burnout_checkins update"
  on public.burnout_checkins for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "own rows: burnout_checkins delete"
  on public.burnout_checkins for delete
  using (auth.uid() = user_id);

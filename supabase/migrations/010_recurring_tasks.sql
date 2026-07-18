-- Session 3.3: Recurring tasks
--
-- Adds recurring_task_templates as the source of truth for repeating tasks.
-- Instances are generated on-demand into the tasks table and marked with
-- tasks.recurring_template_id so reporting can distinguish recurring
-- history from ad-hoc tasks.
--
-- Design decisions locked with Caroline on Jul 17:
--   1. On-demand generation from the client, no cron.
--   2. Per-template on_miss policy (let_it_go / ask_me / always_roll).
--   3. Missed instances are preserved as rows with completed_at=null and
--      the original scheduled due_date, so reports can query them.
--   4. End condition may be an end_date, a stops-after-N-occurrences, both,
--      or neither.
--   5. Yearly recurrence deferred; will be handled via Google Calendar sync
--      in Session 5.

begin;

-- ---------- Enums ----------

do $$ begin
  if not exists (select 1 from pg_type where typname = 'recurring_pattern_type') then
    create type recurring_pattern_type as enum ('daily', 'weekly', 'monthly', 'custom');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'recurring_monthly_kind') then
    create type recurring_monthly_kind as enum ('day_of_month', 'nth_weekday');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'recurring_on_miss') then
    -- let_it_go     = missed instance stays as a Not Completed history row
    -- ask_me        = app prompts user on next load per-item
    -- always_roll   = missed instance silently moves to today's bucket
    create type recurring_on_miss as enum ('let_it_go', 'ask_me', 'always_roll');
  end if;
end $$;

-- ---------- recurring_task_templates ----------

create table if not exists public.recurring_task_templates (
  id                     bigserial primary key,
  user_id                uuid not null references auth.users(id) on delete cascade,

  -- Task-shape fields copied to each generated instance
  title                  text not null,
  notes                  text,
  spoon_estimate         int not null default 3 check (spoon_estimate between 1 and 10),
  estimated_hours        numeric(5,2) not null default 0.5 check (estimated_hours >= 0),
  complexity             text not null default 'low' check (complexity in ('low','medium','high')),
  billable               boolean not null default false,
  client_id              bigint references public.clients(id) on delete set null,
  project_id             bigint references public.projects(id) on delete set null,
  tag_ids                bigint[] not null default '{}',

  -- Recurrence pattern
  pattern_type           recurring_pattern_type not null,
  interval_n             int not null default 1 check (interval_n >= 1),

  -- Used when pattern_type = 'weekly'. 0=Sun..6=Sat. Empty array means
  -- "every N weeks on the start_date's weekday".
  days_of_week           int[] not null default '{}',

  -- Used when pattern_type = 'monthly'.
  monthly_kind           recurring_monthly_kind,
  day_of_month           int check (day_of_month between 1 and 31),
  nth_weekday            int check (nth_weekday between 1 and 5),
  nth_weekday_day        int check (nth_weekday_day between 0 and 6),

  -- Window / end conditions
  start_date             date not null,
  end_date               date,
  end_after_n            int check (end_after_n >= 1),
  occurrences_generated  int not null default 0,

  -- Bookkeeping so resolver only considers new dates
  last_generated_for     date,

  -- Miss policy
  on_miss                recurring_on_miss not null default 'ask_me',

  -- Pause without deleting
  active                 boolean not null default true,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- Sanity: weekly needs at least one weekday OR falls back to start_date's weekday.
  -- Monthly needs a kind chosen and its matching fields set.
  constraint monthly_shape check (
    pattern_type <> 'monthly'
    or (
      monthly_kind = 'day_of_month' and day_of_month is not null
      and nth_weekday is null and nth_weekday_day is null
    )
    or (
      monthly_kind = 'nth_weekday' and nth_weekday is not null and nth_weekday_day is not null
      and day_of_month is null
    )
  )
);

create index if not exists recurring_task_templates_user_active_idx
  on public.recurring_task_templates(user_id, active);

create index if not exists recurring_task_templates_user_start_idx
  on public.recurring_task_templates(user_id, start_date);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists set_updated_at_recurring on public.recurring_task_templates;
create trigger set_updated_at_recurring
  before update on public.recurring_task_templates
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------

alter table public.recurring_task_templates enable row level security;

drop policy if exists "own templates: select" on public.recurring_task_templates;
create policy "own templates: select"
  on public.recurring_task_templates
  for select
  using (user_id = auth.uid());

drop policy if exists "own templates: insert" on public.recurring_task_templates;
create policy "own templates: insert"
  on public.recurring_task_templates
  for insert
  with check (user_id = auth.uid());

drop policy if exists "own templates: update" on public.recurring_task_templates;
create policy "own templates: update"
  on public.recurring_task_templates
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "own templates: delete" on public.recurring_task_templates;
create policy "own templates: delete"
  on public.recurring_task_templates
  for delete
  using (user_id = auth.uid());

-- ---------- tasks.recurring_template_id ----------

alter table public.tasks
  add column if not exists recurring_template_id bigint
    references public.recurring_task_templates(id) on delete set null;

create index if not exists tasks_recurring_template_idx
  on public.tasks(recurring_template_id)
  where recurring_template_id is not null;

-- Prevents duplicate instances for the same template + date. Used by the
-- resolver's "before inserting, verify no instance exists" check and by
-- the case where a user converts an existing task to recurring and we
-- adopt it as the first instance.
create unique index if not exists tasks_recurring_template_due_date_unique
  on public.tasks(recurring_template_id, due_date)
  where recurring_template_id is not null;

commit;

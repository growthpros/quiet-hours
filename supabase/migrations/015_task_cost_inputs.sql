-- Task spoons from time × effort (spoon model change 1).
--
-- The app now works out a task's spoons from its time, effort level, and
-- two yes/no questions. A number the person types still wins, and lives
-- in spoon_estimate as before. Empty spoon_estimate now means "work it
-- out", so repeat templates need to allow it to be empty too.
--
-- Existing typed numbers are left exactly as they are.

alter table public.tasks
  add column if not exists social_load boolean not null default false,
  add column if not exists dread boolean not null default false;

alter table public.recurring_task_templates
  add column if not exists social_load boolean not null default false,
  add column if not exists dread boolean not null default false;

alter table public.recurring_task_templates
  alter column spoon_estimate drop not null,
  alter column spoon_estimate drop default;

-- Long, hard days can cost more than the old caps allowed (an 8-hour,
-- high-effort task works out to 28.5). Raise the cap to 60 on both tables.
do $$
declare
  con record;
begin
  for con in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where conrelid in ('public.tasks'::regclass, 'public.recurring_task_templates'::regclass)
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%spoon_estimate%'
  loop
    execute format('alter table %s drop constraint %I', con.tbl, con.conname);
  end loop;
end $$;

alter table public.tasks
  add constraint tasks_spoon_estimate_check
  check (spoon_estimate is null or (spoon_estimate >= 0 and spoon_estimate <= 60));
alter table public.recurring_task_templates
  add constraint recurring_templates_spoon_estimate_check
  check (spoon_estimate is null or (spoon_estimate >= 0 and spoon_estimate <= 60));

comment on column public.tasks.spoon_estimate is
  'The person''s own spoon number. Empty means the app works it out from estimated_hours, complexity, social_load and dread.';
comment on column public.tasks.social_load is
  'With people, on camera, masking, or somewhere noisy or busy. Counts 1.5x.';
comment on column public.tasks.dread is
  'Something the person is dreading. Adds 1 spoon.';
comment on column public.recurring_task_templates.spoon_estimate is
  'The person''s own spoon number for each repeat. Empty means the app works it out.';

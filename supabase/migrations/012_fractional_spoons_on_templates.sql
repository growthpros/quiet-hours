-- Session 3.3 patch: allow fractional spoons on recurring templates.
--
-- The tasks.spoon_estimate column has been numeric with a 0..20 check
-- since Session 3.2, so 0.25 / 0.5 / etc. are already valid for tasks.
-- Migration 010 mistakenly declared recurring_task_templates.spoon_estimate
-- as int with a 1..10 check, blocking 0.5-spoon habits like 'text a friend'.
-- This aligns the templates column with tasks.

alter table public.recurring_task_templates
  alter column spoon_estimate type numeric(4,2)
  using spoon_estimate::numeric(4,2);

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.recurring_task_templates'::regclass
    and pg_get_constraintdef(oid) ilike '%spoon_estimate%';
  if con_name is not null then
    execute format('alter table public.recurring_task_templates drop constraint %I', con_name);
  end if;
end $$;

alter table public.recurring_task_templates
  add constraint recurring_templates_spoon_estimate_check
  check (spoon_estimate is null or (spoon_estimate >= 0 and spoon_estimate <= 10));

alter table public.recurring_task_templates
  alter column spoon_estimate set default 0.5;

-- Steps and subtasks (Phase 2).
--
-- A task can have steps, and a step can have subtasks: two levels at most.
-- parent_task_id points a step at its task (or a subtask at its step).
-- Deleting a task deletes its steps and their subtasks with it, so
-- "Delete my account" (migration 013) still removes everything through
-- tasks.user_id, and Export already includes every row of tasks.
--
-- position orders steps under their parent. Empty sorts after numbered
-- ones, then by id.
--
-- The trigger below keeps two promises the app relies on:
--   1. A step belongs to one of the person's own tasks. Row-level security
--      means another person's task can't be seen here, so it can't be used.
--   2. Nothing goes deeper than task, step, subtask.

alter table public.tasks
  add column if not exists parent_task_id bigint
    references public.tasks(id) on delete cascade,
  add column if not exists position integer;

create index if not exists tasks_parent_idx
  on public.tasks (parent_task_id)
  where parent_task_id is not null;

comment on column public.tasks.parent_task_id is
  'The task this is a step of (or the step this is a subtask of). Empty for a top-level task.';
comment on column public.tasks.position is
  'Order among the steps of one parent. Empty sorts last.';

create or replace function public.check_task_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_owner uuid;
  parent_parent bigint;
  grandparent_parent bigint;
  depth int;
  height int;
begin
  if new.parent_task_id is null then
    return new;
  end if;

  if new.parent_task_id = new.id then
    raise exception 'A task can''t be a step of itself.' using errcode = '23514';
  end if;

  select t.user_id, t.parent_task_id
    into parent_owner, parent_parent
    from public.tasks t
   where t.id = new.parent_task_id;

  if not found or parent_owner is distinct from new.user_id then
    raise exception 'A step has to belong to one of your own tasks.' using errcode = '23514';
  end if;

  -- How deep this row would sit: 1 = step, 2 = subtask.
  if parent_parent is null then
    depth := 1;
  else
    select t.parent_task_id into grandparent_parent
      from public.tasks t where t.id = parent_parent;
    if grandparent_parent is not null then
      raise exception 'Steps go two levels deep at most.' using errcode = '23514';
    end if;
    depth := 2;
  end if;

  -- How many levels already sit under this row.
  if exists (
    select 1 from public.tasks c
      join public.tasks g on g.parent_task_id = c.id
     where c.parent_task_id = new.id
  ) then
    height := 2;
  elsif exists (select 1 from public.tasks c where c.parent_task_id = new.id) then
    height := 1;
  else
    height := 0;
  end if;

  if depth + height > 2 then
    raise exception 'Steps go two levels deep at most.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_check_parent on public.tasks;
create trigger tasks_check_parent
  before insert or update of parent_task_id on public.tasks
  for each row execute function public.check_task_parent();

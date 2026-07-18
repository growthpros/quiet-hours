-- Session 3.3: Task archive column
--
-- Adds tasks.archived_at so users can "let go" of a done or missed
-- task, removing it from the Tasks page while keeping its full row
-- data for reports. Applied to production db Jul 17.

alter table public.tasks
  add column if not exists archived_at timestamptz;

create index if not exists tasks_archived_at_idx
  on public.tasks(user_id, archived_at)
  where archived_at is not null;

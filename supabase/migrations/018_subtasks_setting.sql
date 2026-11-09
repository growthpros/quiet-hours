-- Subtasks setting (Phase 2, change 2).
--
-- A task can have steps, and a step can have subtasks (migration 017).
-- Subtasks are off by default (Caroline's decision): steps stay simple on a
-- phone. Turning this on adds "Add a subtask" to every step, and later
-- "Break this down" on steps too. Subtasks that already exist keep showing
-- and counting either way; the setting only controls adding new ones.

alter table public.user_profiles
  add column if not exists show_subtasks boolean not null default false;

comment on column public.user_profiles.show_subtasks is
  'Whether steps offer "Add a subtask" (and later "Break this down"). Off by default.';

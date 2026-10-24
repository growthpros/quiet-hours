-- 013: let a signed-in person delete their own account.
--
-- Every table that holds a person's data references auth.users with
-- ON DELETE CASCADE (task_tags cascades through tasks and tags), so deleting
-- the login removes everything that belongs to them in one step.
--
-- Safety:
--   - It only ever deletes the caller's own login (auth.uid()).
--   - It refuses to run when no one is signed in.
--   - Signed-out visitors (the anon role) can't call it at all.
--   - security definer is needed because users can't touch auth.users
--     directly; search_path is pinned so the function can't be hijacked.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
revoke all on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;

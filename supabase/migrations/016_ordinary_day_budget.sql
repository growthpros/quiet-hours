-- Daily budget from the person's ordinary okay day (spoon model change 2).
--
-- usual_budget: "On an ordinary okay day, how much can you get through?",
-- in spoons, 4 to 30. Empty means the person hasn't said, and the app
-- uses 12.
--
-- budget_basis: what went into the day's budget (ordinary day, energy,
-- each piece of other load), saved with the day so the spoon meter can
-- show the math. Empty for days set before this change.

alter table public.user_profiles
  add column if not exists usual_budget numeric(4,1)
    check (usual_budget is null or (usual_budget >= 4 and usual_budget <= 30));

alter table public.spoon_ledger
  add column if not exists budget_basis jsonb;

comment on column public.user_profiles.usual_budget is
  'Spoons on an ordinary okay day, 4 to 30. Empty means use 12.';
comment on column public.spoon_ledger.budget_basis is
  'What went into the day''s budget, for showing the math. Empty before migration 016.';

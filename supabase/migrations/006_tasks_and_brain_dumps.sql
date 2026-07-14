-- Tasks: the working to-do list.
-- Separate from delegation_tasks (which is the urgency/importance triage grid).
CREATE TABLE IF NOT EXISTS public.tasks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  spoon_estimate numeric CHECK (spoon_estimate IS NULL OR (spoon_estimate >= 0 AND spoon_estimate <= 20)),
  completed_at bigint,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_owner_select ON public.tasks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tasks_owner_insert ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY tasks_owner_update ON public.tasks
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY tasks_owner_delete ON public.tasks
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS tasks_user_created_idx ON public.tasks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tasks_user_completed_idx ON public.tasks (user_id, completed_at);

-- Brain dumps: freeform capture. Unsorted, low-friction.
CREATE TABLE IF NOT EXISTS public.brain_dumps (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at bigint NOT NULL
);

ALTER TABLE public.brain_dumps ENABLE ROW LEVEL SECURITY;

CREATE POLICY brain_dumps_owner_select ON public.brain_dumps
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY brain_dumps_owner_insert ON public.brain_dumps
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY brain_dumps_owner_delete ON public.brain_dumps
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS brain_dumps_user_created_idx ON public.brain_dumps (user_id, created_at DESC);

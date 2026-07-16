-- Session 3.2 schema expansion. See PR description for full rationale.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS estimated_hours numeric CHECK (estimated_hours IS NULL OR (estimated_hours >= 0 AND estimated_hours <= 200)),
  ADD COLUMN IF NOT EXISTS actual_hours numeric CHECK (actual_hours IS NULL OR (actual_hours >= 0 AND actual_hours <= 200)),
  ADD COLUMN IF NOT EXISTS complexity text CHECK (complexity IS NULL OR complexity = ANY (ARRAY['low','medium','high'])),
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS due_bucket text CHECK (due_bucket IS NULL OR due_bucket = ANY (ARRAY['today','this_week','next_week','this_month','this_quarter','later'])),
  ADD COLUMN IF NOT EXISTS billable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_id bigint,
  ADD COLUMN IF NOT EXISTS project_id bigint,
  ADD COLUMN IF NOT EXISTS completion_reason text,
  ADD COLUMN IF NOT EXISTS rolled_from_date date;

UPDATE public.tasks SET due_bucket = 'today' WHERE due_bucket IS NULL AND completed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.clients (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, name text NOT NULL, notes text, archived boolean DEFAULT false, created_at bigint NOT NULL, updated_at bigint NOT NULL);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY clients_owner_select ON public.clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY clients_owner_insert ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY clients_owner_update ON public.clients FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY clients_owner_delete ON public.clients FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.projects (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, client_id bigint REFERENCES public.clients(id) ON DELETE SET NULL, name text NOT NULL, notes text, archived boolean DEFAULT false, created_at bigint NOT NULL, updated_at bigint NOT NULL);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY projects_owner_select ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY projects_owner_insert ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY projects_owner_update ON public.projects FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY projects_owner_delete ON public.projects FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.tags (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, name text NOT NULL, created_at bigint NOT NULL, UNIQUE (user_id, name));
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_owner_select ON public.tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tags_owner_insert ON public.tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY tags_owner_delete ON public.tags FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.task_tags (task_id bigint NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE, tag_id bigint NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE, PRIMARY KEY (task_id, tag_id));
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_tags_owner_select ON public.task_tags FOR SELECT USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));
CREATE POLICY task_tags_owner_insert ON public.task_tags FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));
CREATE POLICY task_tags_owner_delete ON public.task_tags FOR DELETE USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.user_id = auth.uid()));

ALTER TABLE public.tasks ADD CONSTRAINT tasks_client_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_project_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_due_bucket_idx ON public.tasks (user_id, due_bucket, completed_at);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON public.tasks (user_id, due_date, completed_at);
CREATE INDEX IF NOT EXISTS tasks_billable_idx ON public.tasks (user_id, billable, completed_at);

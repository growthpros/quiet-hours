-- Missing owner_update policy on brain_dumps.
CREATE POLICY brain_dumps_owner_update ON public.brain_dumps
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

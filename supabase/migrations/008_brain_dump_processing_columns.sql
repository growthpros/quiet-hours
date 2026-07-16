ALTER TABLE public.brain_dumps
  ADD COLUMN IF NOT EXISTS parsed_items jsonb,
  ADD COLUMN IF NOT EXISTS processed_indices integer[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skipped_indices integer[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS parsed_at bigint;

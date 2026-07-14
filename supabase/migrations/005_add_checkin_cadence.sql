-- Add check-in cadence preferences to user_profiles.
-- checkin_cadence values:
--   'off'        no nudges
--   'morning'    one nudge per day, first open after 05:00 local
--   'every_hour' every 60 minutes since last check-in
--   'every_2h'   every 120 minutes since last check-in
--   'every_3h'   every 180 minutes since last check-in
--   'custom'     use checkin_cadence_minutes
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS checkin_cadence text
    CHECK (checkin_cadence = ANY (ARRAY['off','morning','every_hour','every_2h','every_3h','custom']))
    DEFAULT 'off';

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS checkin_cadence_minutes integer
    CHECK (checkin_cadence_minutes IS NULL OR (checkin_cadence_minutes >= 15 AND checkin_cadence_minutes <= 720));

UPDATE public.user_profiles SET checkin_cadence = 'off' WHERE checkin_cadence IS NULL;

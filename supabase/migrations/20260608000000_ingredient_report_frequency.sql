-- Per-assignment report frequency.
--
-- Some ingredients only need checking on specific days (e.g. a weekly
-- dry-goods count) rather than every shift. Store an optional set of
-- weekdays on each employee_ingredients assignment:
--
--   report_weekdays = NULL  → report every day (the existing default).
--   report_weekdays = '{1,4}'::smallint[] → only Monday and Thursday.
--
-- Weekday numbers follow JavaScript's Date.getDay():
--   0 = Sunday, 1 = Monday, … 6 = Saturday.
-- This matches the client so the "due today" check is a direct
-- membership test with no offset juggling.

ALTER TABLE public.employee_ingredients
  ADD COLUMN IF NOT EXISTS report_weekdays smallint[];

COMMENT ON COLUMN public.employee_ingredients.report_weekdays IS
  'Weekdays (0=Sun..6=Sat, JS getDay) on which this ingredient must be reported. NULL = every day.';

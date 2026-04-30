-- Fix chithoa's April 17 row.
--
-- Admin had added extra hours but the row was still flagged as
-- is_day_off=true with no allowance_rate_override, so the table
-- rendered it as an off-day at 0%. Apply the same rule the new
-- saveEditRow logic enforces going forward: any row carrying
-- total_hours > 0 should be is_day_off=false and have an override of
-- (special-day rate + 40%) when the rate column was empty.

DO $$
DECLARE
  v_user_id   UUID;
  v_special   NUMERIC;
  v_target    DATE := DATE '2026-04-17';
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE username ILIKE 'chithoa'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'chithoa not found; skipping';
    RETURN;
  END IF;

  -- Look up the special-day rate that covers Apr 17 (any matching period).
  SELECT MAX(rate_percent) INTO v_special
  FROM public.special_day_rates
  WHERE special_date = v_target;

  v_special := COALESCE(v_special, 0);

  UPDATE public.salary_entries
     SET is_day_off              = FALSE,
         off_percent              = 0,
         allowance_rate_override  = COALESCE(allowance_rate_override, v_special + 40),
         is_admin_reviewed        = TRUE
   WHERE user_id    = v_user_id
     AND entry_date = v_target
     AND total_hours IS NOT NULL
     AND total_hours > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.salary_records sr
       WHERE sr.user_id = v_user_id
         AND sr.period_id = public.salary_entries.period_id
         AND sr.status = 'published'
     );

  RAISE NOTICE 'chithoa April 17: row(s) un-offed and rate set to special+40 where applicable';
END $$;

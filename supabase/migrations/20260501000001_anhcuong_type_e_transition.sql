-- Transition anhcuong from Type A → Type E (daily).
--
-- anhcuong worked a partial month under Type A (fixed monthly base) and
-- then switched to day-by-day pay. To preserve his accrued Type A days
-- AND let him keep logging through April 25 → May 1, we:
--   1. Locate his profile + the period covering this window.
--   2. Insert one salary_entry per date 25..30 + 01-May, each carrying
--      the agreed allowance_rate_override (Sat=15%, Sun=30%, weekday=0,
--      special days 30%/50%).
--   3. Ensure a draft salary_record exists so the admin page can render.
--   4. Flip his shift_type to 'daily'. The Type A renderer keeps showing
--      his existing rows (Type E reuses Type A's UI) and the new override
--      rates surface immediately.
--
-- All operations are idempotent: re-running this migration on a DB
-- where it already applied is a no-op.

DO $$
DECLARE
  v_user_id    UUID;
  v_base       BIGINT;
  v_period_id  UUID;
  v_day        RECORD;
BEGIN
  -- Locate anhcuong (case-insensitive on username).
  SELECT user_id, base_salary
    INTO v_user_id, v_base
  FROM public.profiles
  WHERE username ILIKE 'anhcuong'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'anhcuong not found; skipping transition migration';
    RETURN;
  END IF;

  -- Pick the period whose range covers 2026-04-25; fall back to most
  -- recent period if no exact match (defensive — periods rarely shift).
  SELECT id INTO v_period_id
  FROM public.working_periods
  WHERE start_date <= DATE '2026-04-25' AND end_date >= DATE '2026-04-25'
  ORDER BY start_date DESC
  LIMIT 1;

  IF v_period_id IS NULL THEN
    SELECT id INTO v_period_id
    FROM public.working_periods
    ORDER BY end_date DESC
    LIMIT 1;
  END IF;

  IF v_period_id IS NULL THEN
    RAISE NOTICE 'No working_period available; skipping';
    RETURN;
  END IF;

  -- Ensure a draft salary_record so the admin/employee pages can render
  -- the period for anhcuong.
  INSERT INTO public.salary_records (user_id, period_id, status)
  VALUES (v_user_id, v_period_id, 'draft')
  ON CONFLICT (user_id, period_id) DO NOTHING;

  -- Daily entries Apr 25 → May 1 with rate overrides.
  --   Apr 25 (Sat)  : +15%   weekend rate
  --   Apr 26 (Sun)  : +30%   weekend rate
  --   Apr 27–29 (T2-4): 0%   normal weekday
  --   Apr 30 (Thu)  : +30%   end-of-month special
  --   May  1 (Fri)  : +50%   Quốc tế Lao động (public holiday)
  FOR v_day IN
    SELECT *
    FROM (VALUES
      (DATE '2026-04-25', 15),
      (DATE '2026-04-26', 30),
      (DATE '2026-04-27',  0),
      (DATE '2026-04-28',  0),
      (DATE '2026-04-29',  0),
      (DATE '2026-04-30', 30),
      (DATE '2026-05-01', 50)
    ) AS t(d, rate)
  LOOP
    INSERT INTO public.salary_entries (
      user_id, period_id, entry_date, sort_order,
      is_day_off, off_percent,
      allowance_rate_override,
      is_admin_reviewed
    ) VALUES (
      v_user_id, v_period_id, v_day.d, 0,
      FALSE, 0,
      CASE WHEN v_day.rate > 0 THEN v_day.rate::numeric ELSE NULL END,
      TRUE
    )
    ON CONFLICT (user_id, period_id, entry_date, sort_order) DO UPDATE
      SET allowance_rate_override = EXCLUDED.allowance_rate_override,
          is_day_off              = FALSE,
          is_admin_reviewed       = TRUE;
  END LOOP;

  -- Convert profile to Type E.
  UPDATE public.profiles
     SET shift_type = 'daily'
   WHERE user_id = v_user_id;

  RAISE NOTICE 'anhcuong → Type E (period %, base %)', v_period_id, v_base;
END $$;

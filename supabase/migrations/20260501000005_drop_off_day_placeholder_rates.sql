-- Stop mirroring working_periods.off_days into special_day_rates.
--
-- The previous behaviour was to insert a row per off-day with
-- rate_percent=0 and label "Quán nghỉ" so the rates list "knew" about
-- those dates. But Type A reads rates as the seed source for visible
-- rows, and these 0% placeholders were polluting the table — admins
-- saw two empty global off-day rows that contribute nothing.
--
-- Off-days are still represented:
--   - in working_periods.off_days (the canonical store)
--   - and surfaced via the dedicated offDays prop wherever a renderer
--     actually needs them (Type C scheduledOffDays etc.).
--
-- This migration:
--   1. Deletes special_day_rates rows that are placeholder off-days
--      (rate_percent=0 AND day_type='public_holiday' AND label
--      'Quán nghỉ').
--   2. Removes any Type A salary_entries that auto-seeded onto those
--      dates and have no employee/admin intent (same preservation
--      rules as the Mar 26 cleanup).
--
-- The hook that used to insert these rows has been removed in the
-- corresponding code commit, so future periods won't recreate them.

DO $$
DECLARE
  v_rate_deleted    INTEGER := 0;
  v_entries_deleted INTEGER := 0;
BEGIN
  WITH placeholder_rates AS (
    SELECT period_id, special_date
    FROM public.special_day_rates
    WHERE day_type = 'public_holiday'
      AND rate_percent = 0
      AND description_vi = 'Quán nghỉ'
  ),
  type_a_users AS (
    SELECT user_id FROM public.profiles WHERE shift_type = 'basic'
  ),
  published AS (
    SELECT user_id, period_id
    FROM public.salary_records
    WHERE status = 'published'
  ),
  deletable_entries AS (
    SELECT se.id
    FROM public.salary_entries se
    JOIN type_a_users tu ON tu.user_id = se.user_id
    JOIN placeholder_rates pr
      ON pr.period_id = se.period_id
     AND pr.special_date = se.entry_date
    WHERE se.is_day_off = FALSE
      AND COALESCE(se.off_percent, 0) = 0
      AND se.clock_in IS NULL
      AND se.clock_out IS NULL
      AND se.total_hours IS NULL
      AND se.note IS NULL
      AND se.allowance_rate_override IS NULL
      AND se.last_employee_edit_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM published p
        WHERE p.user_id = se.user_id AND p.period_id = se.period_id
      )
  ),
  del_e AS (
    DELETE FROM public.salary_entries
    WHERE id IN (SELECT id FROM deletable_entries)
    RETURNING 1
  )
  SELECT count(*) INTO v_entries_deleted FROM del_e;

  WITH del_r AS (
    DELETE FROM public.special_day_rates
    WHERE day_type = 'public_holiday'
      AND rate_percent = 0
      AND description_vi = 'Quán nghỉ'
    RETURNING 1
  )
  SELECT count(*) INTO v_rate_deleted FROM del_r;

  RAISE NOTICE 'off-day placeholders cleared: % rate rows, % Type A entries',
    v_rate_deleted, v_entries_deleted;
END $$;

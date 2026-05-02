-- Type E (daily) — keep only special-rate days inside the period.
--
-- Earlier code seeded every date in [period_start, period_end] for
-- shift_type='daily', matching Type B. The contract has been refined:
-- inside the period the monthly baseSalary already covers daily wages,
-- so only special_day_rates entries should materialise (just like
-- Type A). Past the period end the employee earns dailyBase per day,
-- so those rows stay.
--
-- This migration removes the stale in-period auto-seed leftovers for
-- every Type E profile, applying the same preservation rules as the
-- earlier Type A cleanup: any row carrying employee/admin intent
-- (clock times, total_hours, override, off-day, off_percent, note,
-- last_employee_edit_at) stays, and rows whose date matches a
-- special_day_rates entry stay. Published periods are never touched.

DO $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  WITH type_e_users AS (
    SELECT user_id FROM public.profiles WHERE shift_type = 'daily'
  ),
  rate_dates AS (
    SELECT period_id, special_date
    FROM public.special_day_rates
    WHERE rate_percent > 0
      AND day_type <> 'public_holiday'
  ),
  published AS (
    SELECT user_id, period_id
    FROM public.salary_records
    WHERE status = 'published'
  ),
  deletable AS (
    SELECT se.id
    FROM public.salary_entries se
    JOIN type_e_users tu  ON tu.user_id = se.user_id
    JOIN public.working_periods wp ON wp.id = se.period_id
    WHERE se.entry_date BETWEEN wp.start_date AND wp.end_date
      AND se.is_day_off = FALSE
      AND COALESCE(se.off_percent, 0) = 0
      AND se.clock_in IS NULL
      AND se.clock_out IS NULL
      AND se.total_hours IS NULL
      AND se.note IS NULL
      AND se.allowance_rate_override IS NULL
      AND se.last_employee_edit_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM rate_dates rd
        WHERE rd.period_id = se.period_id
          AND rd.special_date = se.entry_date
      )
      AND NOT EXISTS (
        SELECT 1 FROM published p
        WHERE p.user_id = se.user_id AND p.period_id = se.period_id
      )
  )
  DELETE FROM public.salary_entries
  WHERE id IN (SELECT id FROM deletable);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Type E in-period cleanup: % auto-seed rows deleted', v_deleted;
END $$;

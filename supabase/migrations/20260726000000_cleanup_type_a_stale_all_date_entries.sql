-- Clean up stale all-date salary_entries for Type A (basic) and Type E (daily)
-- employees that were wrongly seeded by old versions of create-new-accounts
-- and manage-employee. Those functions used to seed EVERY date in a period,
-- but Type A/E should only have entries matching special_day_rates with
-- rate_percent > 0.
--
-- This covers ALL periods (not just the Mar 26 – Apr 24 range that migration
-- 20260501000002 handled). Plain weekday rows with no employee/admin data
-- will be removed.

DO $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  WITH type_a_e_users AS (
    SELECT user_id
    FROM public.profiles
    WHERE shift_type IN ('basic', 'daily')
  ),
  rate_dates AS (
    SELECT period_id, special_date
    FROM public.special_day_rates
    WHERE rate_percent > 0
  ),
  published AS (
    SELECT user_id, period_id
    FROM public.salary_records
    WHERE status = 'published'
  ),
  deletable AS (
    SELECT se.id
    FROM public.salary_entries se
    JOIN type_a_e_users tu ON tu.user_id = se.user_id
    WHERE se.is_day_off = FALSE
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
  RAISE NOTICE 'Type A/E stale all-date cleanup: % rows deleted', v_deleted;
END $$;

-- Reverse the "Type A default to working" seed for the Mar 26 → Apr 24 cycle.
--
-- Migration 20260425000000 inserted a salary_entry for every date in
-- every period for every Type A employee so that every day would count
-- as worked by default. Product direction has changed: Type A should
-- only carry rows that match a `special_day_rates` entry for the
-- period — i.e. only days where an allowance rate actually applies.
-- Plain weekdays (rate 0%) shouldn't materialise as rows.
--
-- Scope:
--   - Period(s) whose range overlaps Mar 26 → Apr 24 (the cycle the
--     user is cleaning up).
--   - Profiles with shift_type = 'basic' (Type A). Type E (daily) is
--     intentionally excluded — Type E reuses the Type A renderer but
--     keeps every day-by-day entry the admin inserts.
--
-- Preservation rules — we never touch a row that has employee/admin
-- intent stamped on it:
--   - clock_in / clock_out / total_hours not null
--   - note not null
--   - allowance_rate_override not null
--   - is_day_off = true   (admin explicitly toggled it off)
--   - off_percent > 0
--   - last_employee_edit_at not null  (employee touched it)
--   - the date is in special_day_rates for the period
--   - the salary_record is published (frozen — never mutate)
--
-- Anything else is a pure auto-seed leftover and gets deleted.

DO $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  WITH target_periods AS (
    SELECT id
    FROM public.working_periods
    WHERE start_date <= DATE '2026-04-24'
      AND end_date   >= DATE '2026-03-26'
  ),
  type_a_users AS (
    SELECT user_id
    FROM public.profiles
    WHERE shift_type = 'basic'
  ),
  rate_dates AS (
    SELECT period_id, special_date
    FROM public.special_day_rates
    WHERE period_id IN (SELECT id FROM target_periods)
  ),
  published AS (
    SELECT user_id, period_id
    FROM public.salary_records
    WHERE status = 'published'
      AND period_id IN (SELECT id FROM target_periods)
  ),
  deletable AS (
    SELECT se.id
    FROM public.salary_entries se
    JOIN target_periods tp ON tp.id = se.period_id
    JOIN type_a_users tu ON tu.user_id = se.user_id
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
  RAISE NOTICE 'Type A cleanup (Mar 26 – Apr 24): % auto-seed rows deleted', v_deleted;
END $$;

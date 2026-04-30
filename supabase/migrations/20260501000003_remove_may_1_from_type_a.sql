-- Scope May 1 (Quốc tế Lao động) to Type E only.
--
-- The Apr 25 → May 1 transition migration added May 1 as a
-- special_day_rates row at 50%. That makes the date auto-seed for
-- every Type A employee whose page is opened, which is wrong — May 1
-- is anhcuong's individual transition day, not a company-wide special
-- rate.
--
-- Fix: drop the May 1 special_day_rates row entirely, and delete any
-- May 1 salary_entries that already auto-seeded onto Type A profiles.
-- anhcuong's row stays intact because it carries
-- `allowance_rate_override = 50` directly — the override is the source
-- of truth for that row's rate, independent of special_day_rates.
--
-- Preservation rules (same as the Mar 26 cleanup): we only delete
-- pristine auto-seed rows. Anything an admin/employee touched stays.

DO $$
DECLARE
  v_rate_deleted INTEGER := 0;
  v_entries_deleted INTEGER := 0;
BEGIN
  -- Drop May 1 special-rate rows across all periods.
  DELETE FROM public.special_day_rates
   WHERE special_date = DATE '2026-05-01';
  GET DIAGNOSTICS v_rate_deleted = ROW_COUNT;

  -- Delete May 1 entries on Type A profiles that have no admin/employee intent.
  WITH type_a_users AS (
    SELECT user_id FROM public.profiles WHERE shift_type = 'basic'
  ),
  published AS (
    SELECT user_id, period_id
    FROM public.salary_records
    WHERE status = 'published'
  ),
  deletable AS (
    SELECT se.id
    FROM public.salary_entries se
    JOIN type_a_users tu ON tu.user_id = se.user_id
    WHERE se.entry_date = DATE '2026-05-01'
      AND se.is_day_off = FALSE
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
  )
  DELETE FROM public.salary_entries
   WHERE id IN (SELECT id FROM deletable);
  GET DIAGNOSTICS v_entries_deleted = ROW_COUNT;

  RAISE NOTICE 'May 1 cleanup: % special_day_rates rows, % Type A salary_entries removed',
    v_rate_deleted, v_entries_deleted;
END $$;

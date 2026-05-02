-- Clear stale draft salary totals poisoned by the optimistic-row
-- duplication bug.
--
-- useSalaryEntries used to leave id-less optimistic rows in React state
-- next to the realtime echo of the same (entry_date, sort_order). Every
-- saveDraft fired during such a session double-counted those rows in
-- the stored total_salary / salary_breakdown. The bug was fixed in
-- 60f73c2; this migration wipes the stale snapshots so the next admin
-- open recomputes cleanly.
--
-- Scope:
--   - Only `status = 'draft'` rows. Published records are immutable
--     payroll history and must never be mutated by a migration.
--   - total_salary -> 0 and salary_breakdown -> NULL. The next time the
--     admin opens the employee, computeTotalSalary{A,B,C,D,E} runs
--     against the real DB entries and saveDraft writes the correct
--     values.
--
-- This is purely a cache reset; the underlying salary_entries are
-- untouched.

DO $$
DECLARE
  v_cleared INTEGER := 0;
BEGIN
  WITH cleared AS (
    UPDATE public.salary_records
       SET total_salary     = 0,
           salary_breakdown = NULL
     WHERE status = 'draft'
       AND (total_salary <> 0 OR salary_breakdown IS NOT NULL)
    RETURNING 1
  )
  SELECT count(*) INTO v_cleared FROM cleared;

  RAISE NOTICE 'Cleared stale draft salary totals: % rows', v_cleared;
END $$;

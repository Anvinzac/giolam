-- Remove auto-seeded salary_entries for Type C (notice_only) and Type D
-- (lunar_rate) employees. These were wrongly prepopulated with default
-- clock_in=08:00, clock_out=17:30 for every date — leaving no way to
-- distinguish untouched days from actual attendance.
--
-- Preservation rules — keep rows where employee/admin intent is present:
--   - total_hours not null
--   - note not null
--   - is_day_off = true
--   - off_percent > 0
--   - last_employee_edit_at not null
--   - allowance_rate_override not null
--   - salary_record is published (frozen)
--
-- All remaining rows for Type C/D are pure auto-seed and get deleted.

DO $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  WITH published AS (
    SELECT user_id, period_id
    FROM public.salary_records
    WHERE status = 'published'
  ),
  deletable AS (
    SELECT se.id
    FROM public.salary_entries se
    JOIN public.profiles p ON p.user_id = se.user_id
    WHERE p.shift_type IN ('notice_only', 'lunar_rate')
      AND se.is_day_off = FALSE
      AND COALESCE(se.off_percent, 0) = 0
      AND se.total_hours IS NULL
      AND se.note IS NULL
      AND se.allowance_rate_override IS NULL
      AND se.last_employee_edit_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM published pub
        WHERE pub.user_id = se.user_id AND pub.period_id = se.period_id
      )
  )
  DELETE FROM public.salary_entries
  WHERE id IN (SELECT id FROM deletable);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Type C/D auto-seed cleanup: % rows deleted', v_deleted;
END $$;

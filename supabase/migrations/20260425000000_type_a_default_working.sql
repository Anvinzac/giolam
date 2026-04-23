-- Type A (basic) default to "working"
--
-- For Type A employees, a day with no salary_entry row used to render as
-- empty on the table and contribute nothing to the total. The product
-- requirement is that every day counts as worked by default (so the daily
-- base + allowance rate accrues automatically) unless explicitly marked off.
--
-- Implementation: for every Type A employee × every unpublished period,
-- ensure a draft salary_record exists and that every date in the period
-- has a salary_entry row with is_day_off = false, sort_order = 0, and
-- is_admin_reviewed = true. Existing rows (including off-days the user
-- already toggled) are preserved.

DO $$
DECLARE
  period_rec RECORD;
  profile_rec RECORD;
  record_status TEXT;
  rows_affected INTEGER;
  inserted_records INTEGER := 0;
  inserted_entries INTEGER := 0;
BEGIN
  FOR period_rec IN
    SELECT id, start_date, end_date
    FROM public.working_periods
    ORDER BY start_date
  LOOP
    FOR profile_rec IN
      SELECT user_id
      FROM public.profiles
      WHERE shift_type = 'basic'
    LOOP
      -- Skip if this employee's record for this period is already published —
      -- we never touch locked/published data.
      SELECT status INTO record_status
      FROM public.salary_records
      WHERE user_id = profile_rec.user_id
        AND period_id = period_rec.id;

      IF record_status = 'published' THEN
        CONTINUE;
      END IF;

      -- Ensure a draft salary_record exists
      INSERT INTO public.salary_records (user_id, period_id, status)
      VALUES (profile_rec.user_id, period_rec.id, 'draft')
      ON CONFLICT (user_id, period_id) DO NOTHING;
      GET DIAGNOSTICS rows_affected = ROW_COUNT;
      inserted_records := inserted_records + rows_affected;

      -- Insert a "working" entry for every date in the period that doesn't
      -- already have one at sort_order = 0. Pre-existing rows win so any
      -- manually-toggled day-off stays intact.
      INSERT INTO public.salary_entries (
        user_id, period_id, entry_date, sort_order,
        is_day_off, off_percent, is_admin_reviewed
      )
      SELECT
        profile_rec.user_id,
        period_rec.id,
        d::date,
        0,
        false,
        0,
        true
      FROM generate_series(
        period_rec.start_date::date,
        period_rec.end_date::date,
        '1 day'::interval
      ) AS d
      ON CONFLICT (user_id, period_id, entry_date, sort_order) DO NOTHING;
      GET DIAGNOSTICS rows_affected = ROW_COUNT;
      inserted_entries := inserted_entries + rows_affected;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Type A backfill: % new salary_records, % new salary_entries',
    inserted_records, inserted_entries;
END $$;

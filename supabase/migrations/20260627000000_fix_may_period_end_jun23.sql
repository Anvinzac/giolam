-- Payroll periods are 30 days: 25th → 23rd of the following month.
-- The active May 2026 period was incorrectly set to end on 2026-06-24 (31 days),
-- which created a 4th salary-table page with a single day. Trim to 2026-06-23.

DO $$
DECLARE
  period_rec RECORD;
  removed_entries INTEGER := 0;
  removed_rates INTEGER := 0;
  updated_snapshots INTEGER := 0;
BEGIN
  SELECT id, start_date, end_date
  INTO period_rec
  FROM public.working_periods
  WHERE start_date = DATE '2026-05-25'
    AND end_date = DATE '2026-06-24'
  ORDER BY created_at DESC
  LIMIT 1;

  IF period_rec.id IS NULL THEN
    RAISE NOTICE 'No May 25 – Jun 24 period found; skipping.';
    RETURN;
  END IF;

  RAISE NOTICE 'Fixing period % (% → 2026-06-23)', period_rec.id, period_rec.end_date;

  DELETE FROM public.salary_entries
  WHERE period_id = period_rec.id
    AND entry_date = DATE '2026-06-24';
  GET DIAGNOSTICS removed_entries = ROW_COUNT;

  DELETE FROM public.special_day_rates
  WHERE period_id = period_rec.id
    AND special_date = DATE '2026-06-24';
  GET DIAGNOSTICS removed_rates = ROW_COUNT;

  UPDATE public.working_periods
  SET
    end_date = DATE '2026-06-23',
    off_days = ARRAY(
      SELECT d::date
      FROM unnest(off_days) AS d
      WHERE d::date <> DATE '2026-06-24'
    )
  WHERE id = period_rec.id;

  UPDATE public.salary_published_snapshots s
  SET
    period_info = jsonb_set(s.period_info, '{end_date}', to_jsonb('2026-06-23'::text)),
    entries = COALESCE(
      (
        SELECT jsonb_agg(elem ORDER BY elem->>'entry_date', (elem->>'sort_order')::int)
        FROM jsonb_array_elements(s.entries) AS elem
        WHERE elem->>'entry_date' IS DISTINCT FROM '2026-06-24'
      ),
      '[]'::jsonb
    ),
    rates = COALESCE(
      (
        SELECT jsonb_agg(elem ORDER BY elem->>'special_date')
        FROM jsonb_array_elements(s.rates) AS elem
        WHERE elem->>'special_date' IS DISTINCT FROM '2026-06-24'
      ),
      '[]'::jsonb
    )
  WHERE s.period_id = period_rec.id
    AND (
      s.period_info->>'end_date' = '2026-06-24'
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(s.entries) AS elem
        WHERE elem->>'entry_date' = '2026-06-24'
      )
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(s.rates) AS elem
        WHERE elem->>'special_date' = '2026-06-24'
      )
    );
  GET DIAGNOSTICS updated_snapshots = ROW_COUNT;

  RAISE NOTICE 'Removed % salary entries, % special rates; updated % published snapshots.',
    removed_entries, removed_rates, updated_snapshots;
END $$;

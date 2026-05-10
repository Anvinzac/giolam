-- Create the current period if it doesn't exist
INSERT INTO working_periods (start_date, end_date, off_days)
SELECT '2026-04-25', '2026-05-24', ARRAY['2026-05-04'::date, '2026-05-19'::date]
WHERE NOT EXISTS (
  SELECT 1 FROM working_periods WHERE start_date = '2026-04-25' AND end_date = '2026-05-24'
);

-- Verify all periods
SELECT id, start_date, end_date, is_archived, off_days FROM working_periods ORDER BY start_date DESC;

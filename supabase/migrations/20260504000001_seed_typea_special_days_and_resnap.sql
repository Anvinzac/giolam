-- For every published salary_record belonging to a Type A (basic) employee,
-- insert a placeholder salary_entries row for each special_day_rate in the
-- period that doesn't already have one. This mirrors the runtime seeding the
-- admin page does (useSalaryEntries with seedAllDays=true) but persists it
-- for ALL employees instead of only the ones an admin happens to open.
--
-- Then refresh every existing salary_published_snapshots.entries blob from
-- the now-complete salary_entries so the employee view reflects the seeded
-- rows.

-- Step 1: seed missing placeholder entries for basic-type, published periods.
INSERT INTO public.salary_entries (
  user_id,
  period_id,
  entry_date,
  sort_order,
  is_day_off,
  off_percent,
  note,
  clock_in,
  clock_out,
  total_hours,
  allowance_rate_override,
  base_daily_wage,
  allowance_amount,
  extra_wage,
  total_daily_wage
)
SELECT
  sr.user_id,
  sr.period_id,
  sdr.special_date,
  0,
  TRUE,
  0,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  0,
  0,
  0,
  0
FROM public.salary_records sr
JOIN public.profiles p ON p.user_id = sr.user_id
JOIN public.special_day_rates sdr ON sdr.period_id = sr.period_id
WHERE sr.status = 'published'
  AND p.shift_type = 'basic'
  AND sdr.rate_percent > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.salary_entries se
    WHERE se.user_id    = sr.user_id
      AND se.period_id  = sr.period_id
      AND se.entry_date = sdr.special_date
  );

-- Step 2: refresh every snapshot's frozen entries blob from the live table.
UPDATE public.salary_published_snapshots s
   SET entries = COALESCE((
     SELECT jsonb_agg(to_jsonb(se.*) ORDER BY se.entry_date, se.sort_order)
     FROM public.salary_entries se
     WHERE se.user_id   = s.user_id
       AND se.period_id = s.period_id
   ), '[]'::jsonb),
       updated_at = now();

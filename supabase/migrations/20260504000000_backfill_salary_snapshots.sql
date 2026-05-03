-- Backfill salary_published_snapshots for salary_records that were published
-- before the snapshot table existed. Without this, EmployeeSalaryView (which
-- now reads only from salary_published_snapshots) shows "no published salary"
-- for every pre-existing publish.
--
-- Safe to re-run: ON CONFLICT (user_id, period_id) DO NOTHING preserves any
-- snapshot already written by a fresh publish.

INSERT INTO public.salary_published_snapshots (
  salary_record_id,
  user_id,
  period_id,
  published_at,
  total_salary,
  breakdown,
  entries,
  allowances,
  rates,
  period_info,
  profile_info
)
SELECT
  sr.id,
  sr.user_id,
  sr.period_id,
  COALESCE(sr.published_at, sr.updated_at, sr.created_at, now()),
  sr.total_salary,
  sr.salary_breakdown,
  COALESCE((
    SELECT jsonb_agg(to_jsonb(se.*) ORDER BY se.entry_date, se.sort_order)
    FROM public.salary_entries se
    WHERE se.user_id = sr.user_id AND se.period_id = sr.period_id
  ), '[]'::jsonb),
  COALESCE((
    SELECT jsonb_agg(to_jsonb(ea.*))
    FROM public.employee_allowances ea
    WHERE ea.user_id = sr.user_id AND ea.period_id = sr.period_id
  ), '[]'::jsonb),
  COALESCE((
    SELECT jsonb_agg(to_jsonb(sdr.*))
    FROM public.special_day_rates sdr
    WHERE sdr.period_id = sr.period_id
  ), '[]'::jsonb),
  (
    SELECT jsonb_build_object(
      'id', wp.id,
      'start_date', wp.start_date,
      'end_date', wp.end_date,
      'off_days', wp.off_days
    )
    FROM public.working_periods wp
    WHERE wp.id = sr.period_id
  ),
  (
    SELECT jsonb_build_object(
      'shift_type', p.shift_type,
      'base_salary', p.base_salary,
      'hourly_rate', p.hourly_rate,
      'default_clock_in', p.default_clock_in,
      'default_clock_out', p.default_clock_out
    )
    FROM public.profiles p
    WHERE p.user_id = sr.user_id
  )
FROM public.salary_records sr
WHERE sr.status = 'published'
ON CONFLICT (user_id, period_id) DO NOTHING;

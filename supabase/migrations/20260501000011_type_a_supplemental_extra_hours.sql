-- Normalize Type A supplemental extra-hour rows.
--
-- Duplicate Type A rows (sort_order > 0) represent extra work added onto an
-- existing day, not a second full base-salary day. Older admin edit logic
-- incorrectly wrote allowance_rate_override as (day_rate + 40), which made
-- those rows overpay and obscured the intended "hourly value + that day's
-- allowance rate" calculation.

WITH special_rates AS (
  SELECT
    period_id,
    special_date,
    MAX(rate_percent) AS special_rate
  FROM public.special_day_rates
  GROUP BY period_id, special_date
),
day_rates AS (
  SELECT
    se.id,
    COALESCE(se.allowance_rate_override, sr.special_rate, 0) AS current_rate,
    COALESCE(sr.special_rate, 0) AS special_rate
  FROM public.salary_entries se
  JOIN public.profiles p
    ON p.user_id = se.user_id
   AND p.shift_type = 'basic'
  LEFT JOIN special_rates sr
    ON sr.period_id = se.period_id
   AND sr.special_date = se.entry_date
  WHERE se.sort_order > 0
    AND COALESCE(se.total_hours, 0) > 0
)
UPDATE public.salary_entries se
SET
  is_day_off = FALSE,
  off_percent = 0,
  allowance_rate_override = CASE
    WHEN dr.current_rate = dr.special_rate + 40 THEN NULL
    ELSE se.allowance_rate_override
  END,
  is_admin_reviewed = TRUE
FROM day_rates dr
WHERE dr.id = se.id
  AND NOT EXISTS (
    SELECT 1
    FROM public.salary_records sr
    WHERE sr.user_id = se.user_id
      AND sr.period_id = se.period_id
      AND sr.status = 'published'
  );

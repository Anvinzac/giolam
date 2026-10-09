-- Keep shifts.period_id consistent with shift_date.
-- Shifts approved before a period existed were filed under the previous
-- period, so creating the new period made the current-period shift table
-- look empty. period_id now always follows the period containing shift_date.

CREATE OR REPLACE FUNCTION public.working_period_for_date(_d date)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.working_periods
  WHERE _d BETWEEN start_date AND end_date
  ORDER BY start_date DESC
  LIMIT 1
$$;

-- On shift insert/update: file under the period covering shift_date.
-- If no period covers the date yet, keep whatever period_id was given.
CREATE OR REPLACE FUNCTION public.shifts_set_period_from_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pid uuid;
BEGIN
  pid := public.working_period_for_date(NEW.shift_date);
  IF pid IS NOT NULL THEN
    NEW.period_id := pid;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS shifts_set_period_from_date ON public.shifts;
CREATE TRIGGER shifts_set_period_from_date
  BEFORE INSERT OR UPDATE OF shift_date, period_id ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.shifts_set_period_from_date();

-- On period create / date change: re-file shifts inside its range.
CREATE OR REPLACE FUNCTION public.working_periods_refile_shifts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shifts s
  SET period_id = NEW.id
  WHERE s.shift_date BETWEEN NEW.start_date AND NEW.end_date
    AND s.period_id IS DISTINCT FROM NEW.id
    AND public.working_period_for_date(s.shift_date) = NEW.id;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS working_periods_refile_shifts ON public.working_periods;
CREATE TRIGGER working_periods_refile_shifts
  AFTER INSERT OR UPDATE OF start_date, end_date ON public.working_periods
  FOR EACH ROW EXECUTE FUNCTION public.working_periods_refile_shifts();

-- One-time backfill of existing mis-filed shifts.
UPDATE public.shifts s
SET period_id = public.working_period_for_date(s.shift_date)
WHERE public.working_period_for_date(s.shift_date) IS NOT NULL
  AND s.period_id IS DISTINCT FROM public.working_period_for_date(s.shift_date);

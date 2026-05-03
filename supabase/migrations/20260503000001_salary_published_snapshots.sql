-- Salary Published Snapshots
-- Freezes the data an employee sees when an admin publishes a salary record.
-- Subsequent admin edits to salary_entries / allowances / rates / profile do NOT
-- affect the employee view until the admin republishes (which overwrites the
-- snapshot for that user_id+period_id pair).

CREATE TABLE public.salary_published_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salary_record_id UUID NOT NULL REFERENCES public.salary_records(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES public.working_periods(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_salary BIGINT NOT NULL DEFAULT 0,
  breakdown JSONB,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowances JSONB NOT NULL DEFAULT '[]'::jsonb,
  rates JSONB NOT NULL DEFAULT '[]'::jsonb,
  period_info JSONB,
  profile_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_id)
);

CREATE INDEX idx_salary_published_snapshots_user
  ON public.salary_published_snapshots(user_id);
CREATE INDEX idx_salary_published_snapshots_user_period
  ON public.salary_published_snapshots(user_id, period_id);

ALTER TABLE public.salary_published_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own salary snapshots"
  ON public.salary_published_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all salary snapshots"
  ON public.salary_published_snapshots FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_salary_published_snapshots_updated_at
  BEFORE UPDATE ON public.salary_published_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

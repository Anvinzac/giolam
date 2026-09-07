CREATE TABLE IF NOT EXISTS public.salary_published_snapshots (
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

CREATE INDEX IF NOT EXISTS idx_salary_published_snapshots_user ON public.salary_published_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_salary_published_snapshots_user_period ON public.salary_published_snapshots(user_id, period_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_published_snapshots TO authenticated;
GRANT ALL ON public.salary_published_snapshots TO service_role;

ALTER TABLE public.salary_published_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own salary snapshots" ON public.salary_published_snapshots;
CREATE POLICY "Users can view own salary snapshots" ON public.salary_published_snapshots FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all salary snapshots" ON public.salary_published_snapshots;
CREATE POLICY "Admins can manage all salary snapshots" ON public.salary_published_snapshots FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_salary_published_snapshots_updated_at ON public.salary_published_snapshots;
CREATE TRIGGER update_salary_published_snapshots_updated_at BEFORE UPDATE ON public.salary_published_snapshots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
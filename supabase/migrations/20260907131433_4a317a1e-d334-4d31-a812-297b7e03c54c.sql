ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.salary_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill user_id from the published snapshot that references each record
UPDATE public.salary_records sr
SET user_id = s.user_id
FROM public.salary_published_snapshots s
WHERE s.salary_record_id = sr.id AND sr.user_id IS NULL;

ALTER TABLE public.salary_records ALTER COLUMN user_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS salary_records_user_period_key ON public.salary_records(user_id, period_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_user_period ON public.salary_records(user_id, period_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_status ON public.salary_records(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_records TO authenticated;
GRANT ALL ON public.salary_records TO service_role;

ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own published salary records" ON public.salary_records;
CREATE POLICY "Users can view own published salary records" ON public.salary_records FOR SELECT USING (auth.uid() = user_id AND status = 'published');

DROP POLICY IF EXISTS "Admins can manage all salary records" ON public.salary_records;
CREATE POLICY "Admins can manage all salary records" ON public.salary_records FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_salary_records_updated_at ON public.salary_records;
CREATE TRIGGER update_salary_records_updated_at BEFORE UPDATE ON public.salary_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
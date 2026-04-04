-- Persist recurring allowance defaults per employee so new periods can be
-- initialized from stable employee settings instead of requiring re-entry.

CREATE TABLE IF NOT EXISTS public.employee_allowance_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  allowance_key TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  amount BIGINT NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, allowance_key)
);

CREATE INDEX IF NOT EXISTS idx_employee_allowance_defaults_user
  ON public.employee_allowance_defaults(user_id);

ALTER TABLE public.employee_allowance_defaults ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employee_allowance_defaults'
      AND policyname = 'Users can view own allowance defaults'
  ) THEN
    CREATE POLICY "Users can view own allowance defaults"
      ON public.employee_allowance_defaults FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employee_allowance_defaults'
      AND policyname = 'Admins can manage all allowance defaults'
  ) THEN
    CREATE POLICY "Admins can manage all allowance defaults"
      ON public.employee_allowance_defaults FOR ALL
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_employee_allowance_defaults_updated_at
  ON public.employee_allowance_defaults;

CREATE TRIGGER update_employee_allowance_defaults_updated_at
  BEFORE UPDATE ON public.employee_allowance_defaults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.employee_allowance_defaults (user_id, allowance_key, label, amount, is_enabled)
SELECT DISTINCT ON (ea.user_id, ea.allowance_key)
  ea.user_id,
  ea.allowance_key,
  ea.label,
  ea.amount,
  ea.is_enabled
FROM public.employee_allowances ea
LEFT JOIN public.working_periods wp
  ON wp.id = ea.period_id
ORDER BY
  ea.user_id,
  ea.allowance_key,
  wp.start_date DESC NULLS LAST,
  ea.updated_at DESC,
  ea.created_at DESC
ON CONFLICT (user_id, allowance_key) DO UPDATE SET
  label = EXCLUDED.label,
  amount = EXCLUDED.amount,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = now();

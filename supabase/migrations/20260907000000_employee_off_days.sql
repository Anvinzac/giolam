-- Per-employee off-day schedule (admin marks who is off on a given date).
CREATE TABLE IF NOT EXISTS public.employee_off_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  off_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (user_id, off_date)
);

CREATE INDEX IF NOT EXISTS employee_off_days_date_idx ON public.employee_off_days (off_date);
CREATE INDEX IF NOT EXISTS employee_off_days_user_idx ON public.employee_off_days (user_id);

ALTER TABLE public.employee_off_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage employee off days"
  ON public.employee_off_days
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own off days"
  ON public.employee_off_days
  FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

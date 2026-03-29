
-- Create special_day_rates table
CREATE TABLE public.special_day_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id uuid NOT NULL REFERENCES public.working_periods(id) ON DELETE CASCADE,
  special_date date NOT NULL,
  day_type text NOT NULL,
  description_vi text NOT NULL DEFAULT '',
  rate_percent numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.special_day_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage special_day_rates" ON public.special_day_rates FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can view special_day_rates" ON public.special_day_rates FOR SELECT TO authenticated USING (true);

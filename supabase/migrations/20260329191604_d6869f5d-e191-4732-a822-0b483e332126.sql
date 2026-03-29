
-- Create salary_entries table
CREATE TABLE public.salary_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  period_id uuid NOT NULL REFERENCES public.working_periods(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_day_off boolean NOT NULL DEFAULT false,
  off_percent numeric NOT NULL DEFAULT 0,
  note text,
  clock_in time without time zone,
  clock_out time without time zone,
  total_hours numeric,
  allowance_rate_override numeric,
  base_daily_wage numeric NOT NULL DEFAULT 0,
  allowance_amount numeric NOT NULL DEFAULT 0,
  extra_wage numeric NOT NULL DEFAULT 0,
  total_daily_wage numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_id, entry_date, sort_order)
);

-- Create employee_allowances table
CREATE TABLE public.employee_allowances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  period_id uuid NOT NULL REFERENCES public.working_periods(id) ON DELETE CASCADE,
  allowance_key text NOT NULL,
  label text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_id, allowance_key)
);

-- Create salary_records table
CREATE TABLE public.salary_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  period_id uuid NOT NULL REFERENCES public.working_periods(id) ON DELETE CASCADE,
  total_salary numeric NOT NULL DEFAULT 0,
  salary_breakdown jsonb,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_id)
);

-- Enable RLS
ALTER TABLE public.salary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

-- RLS for salary_entries
CREATE POLICY "Admins can manage salary_entries" ON public.salary_entries FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own salary_entries" ON public.salary_entries FOR SELECT USING (auth.uid() = user_id);

-- RLS for employee_allowances
CREATE POLICY "Admins can manage employee_allowances" ON public.employee_allowances FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own employee_allowances" ON public.employee_allowances FOR SELECT USING (auth.uid() = user_id);

-- RLS for salary_records
CREATE POLICY "Admins can manage salary_records" ON public.salary_records FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own salary_records" ON public.salary_records FOR SELECT USING (auth.uid() = user_id);

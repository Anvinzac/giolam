-- Salary Management System Migration
-- Adds tables for special day rates, employee allowances, salary entries, and salary records

-- Add salary columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS base_salary BIGINT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_rate BIGINT DEFAULT 25000;

-- ============================================================
-- special_day_rates: Global rate table per period
-- ============================================================
CREATE TABLE public.special_day_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID REFERENCES public.working_periods(id) ON DELETE CASCADE NOT NULL,
  special_date DATE NOT NULL,
  day_type TEXT NOT NULL CHECK (day_type IN ('saturday','sunday','day_before_new_moon','day_before_full_moon','new_moon','full_moon','public_holiday','custom')),
  description_vi TEXT NOT NULL DEFAULT '',
  rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(period_id, special_date, day_type)
);

-- ============================================================
-- employee_allowances: 3 toggleable per-employee allowances
-- ============================================================
CREATE TABLE public.employee_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period_id UUID REFERENCES public.working_periods(id) ON DELETE CASCADE NOT NULL,
  allowance_key TEXT NOT NULL CHECK (allowance_key IN ('chuyen_can','nang_luc','gui_xe')),
  label TEXT NOT NULL DEFAULT '',
  amount BIGINT NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_id, allowance_key)
);

-- ============================================================
-- salary_entries: Per-day salary line items (admin editable)
-- ============================================================
CREATE TABLE public.salary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period_id UUID REFERENCES public.working_periods(id) ON DELETE CASCADE NOT NULL,
  entry_date DATE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_day_off BOOLEAN NOT NULL DEFAULT false,
  off_percent NUMERIC(5,2) DEFAULT 0,
  note TEXT,
  clock_in TIME,
  clock_out TIME,
  total_hours NUMERIC(5,2),
  allowance_rate_override NUMERIC(5,2),
  base_daily_wage BIGINT DEFAULT 0,
  allowance_amount BIGINT DEFAULT 0,
  extra_wage BIGINT DEFAULT 0,
  total_daily_wage BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_id, entry_date, sort_order)
);

-- ============================================================
-- salary_records: Salary snapshot per employee per period
-- ============================================================
CREATE TABLE public.salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period_id UUID REFERENCES public.working_periods(id) ON DELETE CASCADE NOT NULL,
  total_salary BIGINT NOT NULL DEFAULT 0,
  salary_breakdown JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_id)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_special_day_rates_period ON public.special_day_rates(period_id);
CREATE INDEX idx_employee_allowances_user_period ON public.employee_allowances(user_id, period_id);
CREATE INDEX idx_salary_entries_user_period ON public.salary_entries(user_id, period_id);
CREATE INDEX idx_salary_entries_date ON public.salary_entries(entry_date);
CREATE INDEX idx_salary_records_user_period ON public.salary_records(user_id, period_id);
CREATE INDEX idx_salary_records_status ON public.salary_records(status);

-- ============================================================
-- Enable RLS
-- ============================================================
ALTER TABLE public.special_day_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies: special_day_rates
-- ============================================================
CREATE POLICY "Everyone can view special day rates"
  ON public.special_day_rates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage special day rates"
  ON public.special_day_rates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- RLS Policies: employee_allowances
-- ============================================================
CREATE POLICY "Users can view own allowances"
  ON public.employee_allowances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all allowances"
  ON public.employee_allowances FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- RLS Policies: salary_entries
-- ============================================================
CREATE POLICY "Users can view own published salary entries"
  ON public.salary_entries FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.salary_records sr
      WHERE sr.user_id = salary_entries.user_id
        AND sr.period_id = salary_entries.period_id
        AND sr.status = 'published'
    )
  );

CREATE POLICY "Admins can manage all salary entries"
  ON public.salary_entries FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- RLS Policies: salary_records
-- ============================================================
CREATE POLICY "Users can view own published salary records"
  ON public.salary_records FOR SELECT
  USING (auth.uid() = user_id AND status = 'published');

CREATE POLICY "Admins can manage all salary records"
  ON public.salary_records FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Updated_at triggers
-- ============================================================
CREATE TRIGGER update_special_day_rates_updated_at
  BEFORE UPDATE ON public.special_day_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_allowances_updated_at
  BEFORE UPDATE ON public.employee_allowances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_salary_entries_updated_at
  BEFORE UPDATE ON public.salary_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_salary_records_updated_at
  BEFORE UPDATE ON public.salary_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

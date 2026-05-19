
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

-- Shift types enum
CREATE TYPE public.shift_type AS ENUM ('basic', 'overtime', 'notice_only');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  default_clock_in TIME,
  default_clock_out TIME,
  shift_type public.shift_type NOT NULL DEFAULT 'basic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Working periods table
CREATE TABLE public.working_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  off_days DATE[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shifts table
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period_id UUID REFERENCES public.working_periods(id) ON DELETE CASCADE NOT NULL,
  shift_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  clock_in TIME,
  clock_out TIME,
  main_clock_in TIME,
  main_clock_out TIME,
  overtime_clock_in TIME,
  overtime_clock_out TIME,
  notice TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, shift_date)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Working periods policies
CREATE POLICY "Everyone can view working periods" ON public.working_periods FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage working periods" ON public.working_periods FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Shifts policies
CREATE POLICY "Users can view own shifts" ON public.shifts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shifts" ON public.shifts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shifts" ON public.shifts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shifts" ON public.shifts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all shifts" ON public.shifts FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  -- Default role is employee
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create branches table
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Admins can manage branches" ON public.branches FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create departments table
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(name, branch_id)
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Add department_id, username, must_change_password to profiles
ALTER TABLE public.profiles
  ADD COLUMN department_id uuid REFERENCES public.departments(id),
  ADD COLUMN username text UNIQUE,
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

-- Seed the branch and departments
INSERT INTO public.branches (id, name) VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Phạm Ngọc Thạch');

INSERT INTO public.departments (id, name, branch_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Kitchen', 'a0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000002', 'Reception', 'a0000000-0000-0000-0000-000000000001');

-- Create enum for registration status
CREATE TYPE public.registration_status AS ENUM ('pending', 'approved', 'rejected', 'modified');

-- Create shift_registrations table
CREATE TABLE public.shift_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  shift_date DATE NOT NULL,
  clock_in TIME WITHOUT TIME ZONE,
  clock_out TIME WITHOUT TIME ZONE,
  status registration_status NOT NULL DEFAULT 'pending',
  admin_clock_in TIME WITHOUT TIME ZONE,
  admin_clock_out TIME WITHOUT TIME ZONE,
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, shift_date)
);

-- Enable RLS
ALTER TABLE public.shift_registrations ENABLE ROW LEVEL SECURITY;

-- Employees can view their own registrations
CREATE POLICY "Users can view own registrations"
ON public.shift_registrations FOR SELECT
USING (auth.uid() = user_id);

-- Employees can insert own registrations
CREATE POLICY "Users can insert own registrations"
ON public.shift_registrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Employees can update own pending registrations
CREATE POLICY "Users can update own pending registrations"
ON public.shift_registrations FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Employees can delete own pending registrations
CREATE POLICY "Users can delete own pending registrations"
ON public.shift_registrations FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all registrations
CREATE POLICY "Admins can view all registrations"
ON public.shift_registrations FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update all registrations (approve/reject/modify)
CREATE POLICY "Admins can update all registrations"
ON public.shift_registrations FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_shift_registrations_updated_at
BEFORE UPDATE ON public.shift_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_registrations;-- Allow admins to update any profile
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));
-- Re-add enum value (idempotent)
ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'unapproved';

-- Create function to expire past pending registrations (uses plpgsql to defer enum resolution)
CREATE OR REPLACE FUNCTION public.expire_past_pending_registrations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.shift_registrations
  SET status = 'unapproved', updated_at = now()
  WHERE status = 'pending' AND shift_date < CURRENT_DATE;
END;
$$;

-- Enable pg_cron and pg_net for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule daily cleanup at midnight
SELECT cron.schedule(
  'expire-pending-registrations',
  '0 0 * * *',
  $$SELECT public.expire_past_pending_registrations();$$
);

-- Allow users to update their own unapproved registrations (so they can re-register)
DROP POLICY IF EXISTS "Users can update own pending registrations" ON public.shift_registrations;
CREATE POLICY "Users can update own pending or unapproved registrations"
ON public.shift_registrations
FOR UPDATE
USING (auth.uid() = user_id AND status IN ('pending', 'unapproved'));
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
-- Fix missing salary entry dates for Type B and Type C employees
-- Ensures all dates in a period have entries for overtime and notice_only shift types

DO $$
DECLARE
  period_rec RECORD;
  profile_rec RECORD;
  date_rec RECORD;
  existing_count INTEGER;
  inserted_count INTEGER := 0;
BEGIN
  -- Loop through all periods
  FOR period_rec IN 
    SELECT id, start_date, end_date 
    FROM public.working_periods 
    ORDER BY start_date DESC
  LOOP
    -- Loop through Type B (overtime) and Type C (notice_only) employees
    FOR profile_rec IN 
      SELECT user_id, shift_type 
      FROM public.profiles 
      WHERE shift_type IN ('overtime', 'notice_only')
    LOOP
      -- Generate all dates in the period
      FOR date_rec IN 
        SELECT generate_series(
          period_rec.start_date::date,
          period_rec.end_date::date,
          '1 day'::interval
        )::date AS entry_date
      LOOP
        -- Check if entry exists for this user, period, and date
        SELECT COUNT(*) INTO existing_count
        FROM public.salary_entries
        WHERE user_id = profile_rec.user_id
          AND period_id = period_rec.id
          AND entry_date = date_rec.entry_date;
        
        -- If no entry exists, create one with sort_order 0
        IF existing_count = 0 THEN
          INSERT INTO public.salary_entries (
            user_id,
            period_id,
            entry_date,
            sort_order,
            is_day_off,
            off_percent,
            note,
            clock_in,
            clock_out,
            total_hours,
            allowance_rate_override,
            base_daily_wage,
            allowance_amount,
            extra_wage,
            total_daily_wage
          ) VALUES (
            profile_rec.user_id,
            period_rec.id,
            date_rec.entry_date,
            0,
            false,
            0,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            0,
            0,
            0,
            0
          );
          
          inserted_count := inserted_count + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Migration complete. Inserted % missing salary entries.', inserted_count;
END $$;
-- ============================================================
-- Employee Self-Service Time Entry
-- Allows employees to input their own working time on
-- unpublished periods. Admins see a visual "pending review"
-- flag and can one-click accept or auto-accept via edit.
-- ============================================================

-- ------------------------------------------------------------
-- Schema additions on salary_entries
-- ------------------------------------------------------------
ALTER TABLE public.salary_entries
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_admin_reviewed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_employee_edit_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_salary_entries_pending
  ON public.salary_entries(period_id, is_admin_reviewed)
  WHERE is_admin_reviewed = false;

-- ------------------------------------------------------------
-- Replace salary_entries SELECT policy so employees can always
-- see their own rows (drafts + published).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own published salary entries" ON public.salary_entries;

CREATE POLICY "Users view own entries"
  ON public.salary_entries FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Allow employees to insert their own entries while the period
-- is not yet published.
-- ------------------------------------------------------------
CREATE POLICY "Users insert own when unpublished"
  ON public.salary_entries FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.salary_records sr
      WHERE sr.user_id = salary_entries.user_id
        AND sr.period_id = salary_entries.period_id
        AND sr.status = 'published'
    )
  );

-- ------------------------------------------------------------
-- Allow employees to update their own entries while the period
-- is not yet published.
-- ------------------------------------------------------------
CREATE POLICY "Users update own when unpublished"
  ON public.salary_entries FOR UPDATE
  USING (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.salary_records sr
      WHERE sr.user_id = salary_entries.user_id
        AND sr.period_id = salary_entries.period_id
        AND sr.status = 'published'
    )
  )
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Allow employees to delete only rows they own that have not
-- yet been admin-reviewed and only while the period is unpublished.
-- ------------------------------------------------------------
CREATE POLICY "Users delete own unreviewed"
  ON public.salary_entries FOR DELETE
  USING (
    auth.uid() = user_id
    AND is_admin_reviewed = false
    AND NOT EXISTS (
      SELECT 1 FROM public.salary_records sr
      WHERE sr.user_id = salary_entries.user_id
        AND sr.period_id = salary_entries.period_id
        AND sr.status = 'published'
    )
  );

-- ------------------------------------------------------------
-- Relax salary_records SELECT so employees can read their own
-- draft records (needed for the employee entry page to know
-- which periods are still editable).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own published salary records" ON public.salary_records;

CREATE POLICY "Users view own records"
  ON public.salary_records FOR SELECT
  USING (auth.uid() = user_id);

-- Allow employees to create a draft salary_record for themselves
-- (so the admin RLS subqueries resolve and admin can see them
-- in their list). Only when the period is unpublished.
CREATE POLICY "Users insert own draft record"
  ON public.salary_records FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'draft'
  );

-- ------------------------------------------------------------
-- Realtime: publish salary_entries changes so admin/employee
-- pages can live-sync edits from each other.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'salary_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.salary_entries;
  END IF;
END $$;
-- Type A (basic) default to "working"
--
-- For Type A employees, a day with no salary_entry row used to render as
-- empty on the table and contribute nothing to the total. The product
-- requirement is that every day counts as worked by default (so the daily
-- base + allowance rate accrues automatically) unless explicitly marked off.
--
-- Implementation: for every Type A employee × every unpublished period,
-- ensure a draft salary_record exists and that every date in the period
-- has a salary_entry row with is_day_off = false, sort_order = 0, and
-- is_admin_reviewed = true. Existing rows (including off-days the user
-- already toggled) are preserved.

DO $$
DECLARE
  period_rec RECORD;
  profile_rec RECORD;
  record_status TEXT;
  rows_affected INTEGER;
  inserted_records INTEGER := 0;
  inserted_entries INTEGER := 0;
BEGIN
  FOR period_rec IN
    SELECT id, start_date, end_date
    FROM public.working_periods
    ORDER BY start_date
  LOOP
    FOR profile_rec IN
      SELECT user_id
      FROM public.profiles
      WHERE shift_type = 'basic'
    LOOP
      -- Skip if this employee's record for this period is already published —
      -- we never touch locked/published data.
      SELECT status INTO record_status
      FROM public.salary_records
      WHERE user_id = profile_rec.user_id
        AND period_id = period_rec.id;

      IF record_status = 'published' THEN
        CONTINUE;
      END IF;

      -- Ensure a draft salary_record exists
      INSERT INTO public.salary_records (user_id, period_id, status)
      VALUES (profile_rec.user_id, period_rec.id, 'draft')
      ON CONFLICT (user_id, period_id) DO NOTHING;
      GET DIAGNOSTICS rows_affected = ROW_COUNT;
      inserted_records := inserted_records + rows_affected;

      -- Insert a "working" entry for every date in the period that doesn't
      -- already have one at sort_order = 0. Pre-existing rows win so any
      -- manually-toggled day-off stays intact.
      INSERT INTO public.salary_entries (
        user_id, period_id, entry_date, sort_order,
        is_day_off, off_percent, is_admin_reviewed
      )
      SELECT
        profile_rec.user_id,
        period_rec.id,
        d::date,
        0,
        false,
        0,
        true
      FROM generate_series(
        period_rec.start_date::date,
        period_rec.end_date::date,
        '1 day'::interval
      ) AS d
      ON CONFLICT (user_id, period_id, entry_date, sort_order) DO NOTHING;
      GET DIAGNOSTICS rows_affected = ROW_COUNT;
      inserted_entries := inserted_entries + rows_affected;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Type A backfill: % new salary_records, % new salary_entries',
    inserted_records, inserted_entries;
END $$;
-- Add 'daily' (Loại E) and 'lunar_rate' (Loại D) shift types.
--
-- The TypeScript enum already includes 'lunar_rate' and 'daily', but the
-- Postgres `shift_type` enum was last expanded out-of-band. Adding the
-- values here so future deploys are reproducible from the migration
-- history.
--
-- Type E (daily) is a transitional shape used when a Type A employee
-- finishes a fixed-salary stint and continues on day-by-day pay: it
-- reuses the Type A renderer (preloaded special-rate rows + per-row
-- allowance overrides) but is treated as a distinct category for
-- reporting and onboarding flows.
--
-- ALTER TYPE ADD VALUE must run outside any user transaction; supabase
-- migrations honour that. The new values are unusable in the same
-- transaction they're added — that's fine, the data backfill lives in
-- a separate migration with a later timestamp.

ALTER TYPE public.shift_type ADD VALUE IF NOT EXISTS 'lunar_rate';
ALTER TYPE public.shift_type ADD VALUE IF NOT EXISTS 'daily';
-- Transition anhcuong from Type A → Type E (daily).
--
-- anhcuong worked a partial month under Type A (fixed monthly base) and
-- then switched to day-by-day pay. To preserve his accrued Type A days
-- AND let him keep logging through April 25 → May 1, we:
--   1. Locate his profile + the period covering this window.
--   2. Insert one salary_entry per date 25..30 + 01-May, each carrying
--      the agreed allowance_rate_override (Sat=15%, Sun=30%, weekday=0,
--      special days 30%/50%).
--   3. Ensure a draft salary_record exists so the admin page can render.
--   4. Flip his shift_type to 'daily'. The Type A renderer keeps showing
--      his existing rows (Type E reuses Type A's UI) and the new override
--      rates surface immediately.
--
-- All operations are idempotent: re-running this migration on a DB
-- where it already applied is a no-op.

DO $$
DECLARE
  v_user_id    UUID;
  v_base       BIGINT;
  v_period_id  UUID;
  v_day        RECORD;
BEGIN
  -- Locate anhcuong (case-insensitive on username).
  SELECT user_id, base_salary
    INTO v_user_id, v_base
  FROM public.profiles
  WHERE username ILIKE 'anhcuong'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'anhcuong not found; skipping transition migration';
    RETURN;
  END IF;

  -- Pick the period whose range covers 2026-04-25; fall back to most
  -- recent period if no exact match (defensive — periods rarely shift).
  SELECT id INTO v_period_id
  FROM public.working_periods
  WHERE start_date <= DATE '2026-04-25' AND end_date >= DATE '2026-04-25'
  ORDER BY start_date DESC
  LIMIT 1;

  IF v_period_id IS NULL THEN
    SELECT id INTO v_period_id
    FROM public.working_periods
    ORDER BY end_date DESC
    LIMIT 1;
  END IF;

  IF v_period_id IS NULL THEN
    RAISE NOTICE 'No working_period available; skipping';
    RETURN;
  END IF;

  -- Ensure a draft salary_record so the admin/employee pages can render
  -- the period for anhcuong.
  INSERT INTO public.salary_records (user_id, period_id, status)
  VALUES (v_user_id, v_period_id, 'draft')
  ON CONFLICT (user_id, period_id) DO NOTHING;

  -- Daily entries Apr 25 → May 1 with rate overrides.
  --   Apr 25 (Sat)  : +15%   weekend rate
  --   Apr 26 (Sun)  : +30%   weekend rate
  --   Apr 27–29 (T2-4): 0%   normal weekday
  --   Apr 30 (Thu)  : +30%   end-of-month special
  --   May  1 (Fri)  : +50%   Quốc tế Lao động (public holiday)
  FOR v_day IN
    SELECT *
    FROM (VALUES
      (DATE '2026-04-25', 15),
      (DATE '2026-04-26', 30),
      (DATE '2026-04-27',  0),
      (DATE '2026-04-28',  0),
      (DATE '2026-04-29',  0),
      (DATE '2026-04-30', 30),
      (DATE '2026-05-01', 50)
    ) AS t(d, rate)
  LOOP
    INSERT INTO public.salary_entries (
      user_id, period_id, entry_date, sort_order,
      is_day_off, off_percent,
      allowance_rate_override,
      is_admin_reviewed
    ) VALUES (
      v_user_id, v_period_id, v_day.d, 0,
      FALSE, 0,
      CASE WHEN v_day.rate > 0 THEN v_day.rate::numeric ELSE NULL END,
      TRUE
    )
    ON CONFLICT (user_id, period_id, entry_date, sort_order) DO UPDATE
      SET allowance_rate_override = EXCLUDED.allowance_rate_override,
          is_day_off              = FALSE,
          is_admin_reviewed       = TRUE;
  END LOOP;

  -- Convert profile to Type E.
  UPDATE public.profiles
     SET shift_type = 'daily'
   WHERE user_id = v_user_id;

  RAISE NOTICE 'anhcuong → Type E (period %, base %)', v_period_id, v_base;
END $$;
-- Reverse the "Type A default to working" seed for the Mar 26 → Apr 24 cycle.
--
-- Migration 20260425000000 inserted a salary_entry for every date in
-- every period for every Type A employee so that every day would count
-- as worked by default. Product direction has changed: Type A should
-- only carry rows that match a `special_day_rates` entry for the
-- period — i.e. only days where an allowance rate actually applies.
-- Plain weekdays (rate 0%) shouldn't materialise as rows.
--
-- Scope:
--   - Period(s) whose range overlaps Mar 26 → Apr 24 (the cycle the
--     user is cleaning up).
--   - Profiles with shift_type = 'basic' (Type A). Type E (daily) is
--     intentionally excluded — Type E reuses the Type A renderer but
--     keeps every day-by-day entry the admin inserts.
--
-- Preservation rules — we never touch a row that has employee/admin
-- intent stamped on it:
--   - clock_in / clock_out / total_hours not null
--   - note not null
--   - allowance_rate_override not null
--   - is_day_off = true   (admin explicitly toggled it off)
--   - off_percent > 0
--   - last_employee_edit_at not null  (employee touched it)
--   - the date is in special_day_rates for the period
--   - the salary_record is published (frozen — never mutate)
--
-- Anything else is a pure auto-seed leftover and gets deleted.

DO $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  WITH target_periods AS (
    SELECT id
    FROM public.working_periods
    WHERE start_date <= DATE '2026-04-24'
      AND end_date   >= DATE '2026-03-26'
  ),
  type_a_users AS (
    SELECT user_id
    FROM public.profiles
    WHERE shift_type = 'basic'
  ),
  rate_dates AS (
    SELECT period_id, special_date
    FROM public.special_day_rates
    WHERE period_id IN (SELECT id FROM target_periods)
  ),
  published AS (
    SELECT user_id, period_id
    FROM public.salary_records
    WHERE status = 'published'
      AND period_id IN (SELECT id FROM target_periods)
  ),
  deletable AS (
    SELECT se.id
    FROM public.salary_entries se
    JOIN target_periods tp ON tp.id = se.period_id
    JOIN type_a_users tu ON tu.user_id = se.user_id
    WHERE se.is_day_off = FALSE
      AND COALESCE(se.off_percent, 0) = 0
      AND se.clock_in IS NULL
      AND se.clock_out IS NULL
      AND se.total_hours IS NULL
      AND se.note IS NULL
      AND se.allowance_rate_override IS NULL
      AND se.last_employee_edit_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM rate_dates rd
        WHERE rd.period_id = se.period_id
          AND rd.special_date = se.entry_date
      )
      AND NOT EXISTS (
        SELECT 1 FROM published p
        WHERE p.user_id = se.user_id AND p.period_id = se.period_id
      )
  )
  DELETE FROM public.salary_entries
  WHERE id IN (SELECT id FROM deletable);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Type A cleanup (Mar 26 – Apr 24): % auto-seed rows deleted', v_deleted;
END $$;
-- Scope May 1 (Quốc tế Lao động) to Type E only.
--
-- The Apr 25 → May 1 transition migration added May 1 as a
-- special_day_rates row at 50%. That makes the date auto-seed for
-- every Type A employee whose page is opened, which is wrong — May 1
-- is anhcuong's individual transition day, not a company-wide special
-- rate.
--
-- Fix: drop the May 1 special_day_rates row entirely, and delete any
-- May 1 salary_entries that already auto-seeded onto Type A profiles.
-- anhcuong's row stays intact because it carries
-- `allowance_rate_override = 50` directly — the override is the source
-- of truth for that row's rate, independent of special_day_rates.
--
-- Preservation rules (same as the Mar 26 cleanup): we only delete
-- pristine auto-seed rows. Anything an admin/employee touched stays.

DO $$
DECLARE
  v_rate_deleted INTEGER := 0;
  v_entries_deleted INTEGER := 0;
BEGIN
  -- Drop May 1 special-rate rows across all periods.
  DELETE FROM public.special_day_rates
   WHERE special_date = DATE '2026-05-01';
  GET DIAGNOSTICS v_rate_deleted = ROW_COUNT;

  -- Delete May 1 entries on Type A profiles that have no admin/employee intent.
  WITH type_a_users AS (
    SELECT user_id FROM public.profiles WHERE shift_type = 'basic'
  ),
  published AS (
    SELECT user_id, period_id
    FROM public.salary_records
    WHERE status = 'published'
  ),
  deletable AS (
    SELECT se.id
    FROM public.salary_entries se
    JOIN type_a_users tu ON tu.user_id = se.user_id
    WHERE se.entry_date = DATE '2026-05-01'
      AND se.is_day_off = FALSE
      AND COALESCE(se.off_percent, 0) = 0
      AND se.clock_in IS NULL
      AND se.clock_out IS NULL
      AND se.total_hours IS NULL
      AND se.note IS NULL
      AND se.allowance_rate_override IS NULL
      AND se.last_employee_edit_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM published p
        WHERE p.user_id = se.user_id AND p.period_id = se.period_id
      )
  )
  DELETE FROM public.salary_entries
   WHERE id IN (SELECT id FROM deletable);
  GET DIAGNOSTICS v_entries_deleted = ROW_COUNT;

  RAISE NOTICE 'May 1 cleanup: % special_day_rates rows, % Type A salary_entries removed',
    v_rate_deleted, v_entries_deleted;
END $$;
-- Fix chithoa's April 17 row.
--
-- Admin had added extra hours but the row was still flagged as
-- is_day_off=true with no allowance_rate_override, so the table
-- rendered it as an off-day at 0%. Apply the same rule the new
-- saveEditRow logic enforces going forward: any row carrying
-- total_hours > 0 should be is_day_off=false and have an override of
-- (special-day rate + 40%) when the rate column was empty.

DO $$
DECLARE
  v_user_id   UUID;
  v_special   NUMERIC;
  v_target    DATE := DATE '2026-04-17';
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE username ILIKE 'chithoa'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'chithoa not found; skipping';
    RETURN;
  END IF;

  -- Look up the special-day rate that covers Apr 17 (any matching period).
  SELECT MAX(rate_percent) INTO v_special
  FROM public.special_day_rates
  WHERE special_date = v_target;

  v_special := COALESCE(v_special, 0);

  UPDATE public.salary_entries
     SET is_day_off              = FALSE,
         off_percent              = 0,
         allowance_rate_override  = COALESCE(allowance_rate_override, v_special + 40),
         is_admin_reviewed        = TRUE
   WHERE user_id    = v_user_id
     AND entry_date = v_target
     AND total_hours IS NOT NULL
     AND total_hours > 0
     AND NOT EXISTS (
       SELECT 1 FROM public.salary_records sr
       WHERE sr.user_id = v_user_id
         AND sr.period_id = public.salary_entries.period_id
         AND sr.status = 'published'
     );

  RAISE NOTICE 'chithoa April 17: row(s) un-offed and rate set to special+40 where applicable';
END $$;
-- Stop mirroring working_periods.off_days into special_day_rates.
--
-- The previous behaviour was to insert a row per off-day with
-- rate_percent=0 and label "Quán nghỉ" so the rates list "knew" about
-- those dates. But Type A reads rates as the seed source for visible
-- rows, and these 0% placeholders were polluting the table — admins
-- saw two empty global off-day rows that contribute nothing.
--
-- Off-days are still represented:
--   - in working_periods.off_days (the canonical store)
--   - and surfaced via the dedicated offDays prop wherever a renderer
--     actually needs them (Type C scheduledOffDays etc.).
--
-- This migration:
--   1. Deletes special_day_rates rows that are placeholder off-days
--      (rate_percent=0 AND day_type='public_holiday' AND label
--      'Quán nghỉ').
--   2. Removes any Type A salary_entries that auto-seeded onto those
--      dates and have no employee/admin intent (same preservation
--      rules as the Mar 26 cleanup).
--
-- The hook that used to insert these rows has been removed in the
-- corresponding code commit, so future periods won't recreate them.

DO $$
DECLARE
  v_rate_deleted    INTEGER := 0;
  v_entries_deleted INTEGER := 0;
BEGIN
  WITH placeholder_rates AS (
    SELECT period_id, special_date
    FROM public.special_day_rates
    WHERE day_type = 'public_holiday'
      AND rate_percent = 0
      AND description_vi = 'Quán nghỉ'
  ),
  type_a_users AS (
    SELECT user_id FROM public.profiles WHERE shift_type = 'basic'
  ),
  published AS (
    SELECT user_id, period_id
    FROM public.salary_records
    WHERE status = 'published'
  ),
  deletable_entries AS (
    SELECT se.id
    FROM public.salary_entries se
    JOIN type_a_users tu ON tu.user_id = se.user_id
    JOIN placeholder_rates pr
      ON pr.period_id = se.period_id
     AND pr.special_date = se.entry_date
    WHERE se.is_day_off = FALSE
      AND COALESCE(se.off_percent, 0) = 0
      AND se.clock_in IS NULL
      AND se.clock_out IS NULL
      AND se.total_hours IS NULL
      AND se.note IS NULL
      AND se.allowance_rate_override IS NULL
      AND se.last_employee_edit_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM published p
        WHERE p.user_id = se.user_id AND p.period_id = se.period_id
      )
  ),
  del_e AS (
    DELETE FROM public.salary_entries
    WHERE id IN (SELECT id FROM deletable_entries)
    RETURNING 1
  )
  SELECT count(*) INTO v_entries_deleted FROM del_e;

  WITH del_r AS (
    DELETE FROM public.special_day_rates
    WHERE day_type = 'public_holiday'
      AND rate_percent = 0
      AND description_vi = 'Quán nghỉ'
    RETURNING 1
  )
  SELECT count(*) INTO v_rate_deleted FROM del_r;

  RAISE NOTICE 'off-day placeholders cleared: % rate rows, % Type A entries',
    v_rate_deleted, v_entries_deleted;
END $$;
-- Type B employee submissions no longer require per-row admin approval.
--
-- Product direction: overtime (Type B) employees should be able to submit
-- their clock-out times without generating a yellow "pending review" queue
-- for admins. Keep the final salary record publish flow as-is, but treat
-- day-to-day Type B row edits as already reviewed.

-- Clear any existing pending flags on overtime rows so current accounts stop
-- showing stale admin-review badges as soon as this migration is applied.
UPDATE public.salary_entries se
SET is_admin_reviewed = true
FROM public.profiles p
WHERE p.user_id = se.user_id
  AND p.shift_type = 'overtime'
  AND se.is_admin_reviewed = false;

-- Employees may still need to remove their own duplicate overtime rows even
-- though those rows are now auto-reviewed. Allow deletes for:
--   1. any still-unreviewed row they own, or
--   2. their own overtime duplicate rows (sort_order > 0),
-- while the period remains unpublished.
DROP POLICY IF EXISTS "Users delete own unreviewed" ON public.salary_entries;

CREATE POLICY "Users delete own editable rows"
  ON public.salary_entries FOR DELETE
  USING (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.salary_records sr
      WHERE sr.user_id = salary_entries.user_id
        AND sr.period_id = salary_entries.period_id
        AND sr.status = 'published'
    )
    AND (
      is_admin_reviewed = false
      OR (
        submitted_by = auth.uid()
        AND sort_order > 0
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = salary_entries.user_id
            AND p.shift_type = 'overtime'
        )
      )
    )
  );
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
-- Type E (daily) — keep only special-rate days inside the period.
--
-- Earlier code seeded every date in [period_start, period_end] for
-- shift_type='daily', matching Type B. The contract has been refined:
-- inside the period the monthly baseSalary already covers daily wages,
-- so only special_day_rates entries should materialise (just like
-- Type A). Past the period end the employee earns dailyBase per day,
-- so those rows stay.
--
-- This migration removes the stale in-period auto-seed leftovers for
-- every Type E profile, applying the same preservation rules as the
-- earlier Type A cleanup: any row carrying employee/admin intent
-- (clock times, total_hours, override, off-day, off_percent, note,
-- last_employee_edit_at) stays, and rows whose date matches a
-- special_day_rates entry stay. Published periods are never touched.

DO $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  WITH type_e_users AS (
    SELECT user_id FROM public.profiles WHERE shift_type = 'daily'
  ),
  rate_dates AS (
    SELECT period_id, special_date
    FROM public.special_day_rates
    WHERE rate_percent > 0
      AND day_type <> 'public_holiday'
  ),
  published AS (
    SELECT user_id, period_id
    FROM public.salary_records
    WHERE status = 'published'
  ),
  deletable AS (
    SELECT se.id
    FROM public.salary_entries se
    JOIN type_e_users tu  ON tu.user_id = se.user_id
    JOIN public.working_periods wp ON wp.id = se.period_id
    WHERE se.entry_date BETWEEN wp.start_date AND wp.end_date
      AND se.is_day_off = FALSE
      AND COALESCE(se.off_percent, 0) = 0
      AND se.clock_in IS NULL
      AND se.clock_out IS NULL
      AND se.total_hours IS NULL
      AND se.note IS NULL
      AND se.allowance_rate_override IS NULL
      AND se.last_employee_edit_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM rate_dates rd
        WHERE rd.period_id = se.period_id
          AND rd.special_date = se.entry_date
      )
      AND NOT EXISTS (
        SELECT 1 FROM published p
        WHERE p.user_id = se.user_id AND p.period_id = se.period_id
      )
  )
  DELETE FROM public.salary_entries
  WHERE id IN (SELECT id FROM deletable);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RAISE NOTICE 'Type E in-period cleanup: % auto-seed rows deleted', v_deleted;
END $$;
-- Clear stale draft salary totals poisoned by the optimistic-row
-- duplication bug.
--
-- useSalaryEntries used to leave id-less optimistic rows in React state
-- next to the realtime echo of the same (entry_date, sort_order). Every
-- saveDraft fired during such a session double-counted those rows in
-- the stored total_salary / salary_breakdown. The bug was fixed in
-- 60f73c2; this migration wipes the stale snapshots so the next admin
-- open recomputes cleanly.
--
-- Scope:
--   - Only `status = 'draft'` rows. Published records are immutable
--     payroll history and must never be mutated by a migration.
--   - total_salary -> 0 and salary_breakdown -> NULL. The next time the
--     admin opens the employee, computeTotalSalary{A,B,C,D,E} runs
--     against the real DB entries and saveDraft writes the correct
--     values.
--
-- This is purely a cache reset; the underlying salary_entries are
-- untouched.

DO $$
DECLARE
  v_cleared INTEGER := 0;
BEGIN
  WITH cleared AS (
    UPDATE public.salary_records
       SET total_salary     = 0,
           salary_breakdown = NULL
     WHERE status = 'draft'
       AND (total_salary <> 0 OR salary_breakdown IS NOT NULL)
    RETURNING 1
  )
  SELECT count(*) INTO v_cleared FROM cleared;

  RAISE NOTICE 'Cleared stale draft salary totals: % rows', v_cleared;
END $$;
-- Allow custom allowance keys (e.g. 'custom_<timestamp>') beyond the original
-- whitelist of 'chuyen_can'/'nang_luc'/'gui_xe'. The CHECK constraint was
-- silently rejecting inserts from the "Thêm phụ cấp" UI, so newly added
-- allowance rows never saved, never displayed, and never contributed to the
-- total salary.

ALTER TABLE public.employee_allowances
  DROP CONSTRAINT IF EXISTS employee_allowances_allowance_key_check;
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
-- Backfill salary_published_snapshots for salary_records that were published
-- before the snapshot table existed. Without this, EmployeeSalaryView (which
-- now reads only from salary_published_snapshots) shows "no published salary"
-- for every pre-existing publish.
--
-- Safe to re-run: ON CONFLICT (user_id, period_id) DO NOTHING preserves any
-- snapshot already written by a fresh publish.

INSERT INTO public.salary_published_snapshots (
  salary_record_id,
  user_id,
  period_id,
  published_at,
  total_salary,
  breakdown,
  entries,
  allowances,
  rates,
  period_info,
  profile_info
)
SELECT
  sr.id,
  sr.user_id,
  sr.period_id,
  COALESCE(sr.published_at, sr.updated_at, sr.created_at, now()),
  sr.total_salary,
  sr.salary_breakdown,
  COALESCE((
    SELECT jsonb_agg(to_jsonb(se.*) ORDER BY se.entry_date, se.sort_order)
    FROM public.salary_entries se
    WHERE se.user_id = sr.user_id AND se.period_id = sr.period_id
  ), '[]'::jsonb),
  COALESCE((
    SELECT jsonb_agg(to_jsonb(ea.*))
    FROM public.employee_allowances ea
    WHERE ea.user_id = sr.user_id AND ea.period_id = sr.period_id
  ), '[]'::jsonb),
  COALESCE((
    SELECT jsonb_agg(to_jsonb(sdr.*))
    FROM public.special_day_rates sdr
    WHERE sdr.period_id = sr.period_id
  ), '[]'::jsonb),
  (
    SELECT jsonb_build_object(
      'id', wp.id,
      'start_date', wp.start_date,
      'end_date', wp.end_date,
      'off_days', wp.off_days
    )
    FROM public.working_periods wp
    WHERE wp.id = sr.period_id
  ),
  (
    SELECT jsonb_build_object(
      'shift_type', p.shift_type,
      'base_salary', p.base_salary,
      'hourly_rate', p.hourly_rate,
      'default_clock_in', p.default_clock_in,
      'default_clock_out', p.default_clock_out
    )
    FROM public.profiles p
    WHERE p.user_id = sr.user_id
  )
FROM public.salary_records sr
WHERE sr.status = 'published'
ON CONFLICT (user_id, period_id) DO NOTHING;
-- For every published salary_record belonging to a Type A (basic) employee,
-- insert a placeholder salary_entries row for each special_day_rate in the
-- period that doesn't already have one. This mirrors the runtime seeding the
-- admin page does (useSalaryEntries with seedAllDays=true) but persists it
-- for ALL employees instead of only the ones an admin happens to open.
--
-- Then refresh every existing salary_published_snapshots.entries blob from
-- the now-complete salary_entries so the employee view reflects the seeded
-- rows.

-- Step 1: seed missing placeholder entries for basic-type, published periods.
INSERT INTO public.salary_entries (
  user_id,
  period_id,
  entry_date,
  sort_order,
  is_day_off,
  off_percent,
  note,
  clock_in,
  clock_out,
  total_hours,
  allowance_rate_override,
  base_daily_wage,
  allowance_amount,
  extra_wage,
  total_daily_wage
)
SELECT
  sr.user_id,
  sr.period_id,
  sdr.special_date,
  0,
  TRUE,
  0,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  0,
  0,
  0,
  0
FROM public.salary_records sr
JOIN public.profiles p ON p.user_id = sr.user_id
JOIN public.special_day_rates sdr ON sdr.period_id = sr.period_id
WHERE sr.status = 'published'
  AND p.shift_type = 'basic'
  AND sdr.rate_percent > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.salary_entries se
    WHERE se.user_id    = sr.user_id
      AND se.period_id  = sr.period_id
      AND se.entry_date = sdr.special_date
  );

-- Step 2: refresh every snapshot's frozen entries blob from the live table.
UPDATE public.salary_published_snapshots s
   SET entries = COALESCE((
     SELECT jsonb_agg(to_jsonb(se.*) ORDER BY se.entry_date, se.sort_order)
     FROM public.salary_entries se
     WHERE se.user_id   = s.user_id
       AND se.period_id = s.period_id
   ), '[]'::jsonb),
       updated_at = now();
-- Add is_archived column to working_periods
ALTER TABLE public.working_periods ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Index for faster active period lookups
CREATE INDEX IF NOT EXISTS idx_working_periods_active ON public.working_periods(is_archived, start_date);
-- Stock Inventory Management Tables

-- Ingredients catalog (seeded from schema-export categories, excluding menu items)
CREATE TABLE IF NOT EXISTS public.ingredients (
  id text PRIMARY KEY,
  name text NOT NULL,
  emoji text NOT NULL,
  unit text NOT NULL,
  category text NOT NULL,
  subcategory text,
  reference_price numeric,
  supplier text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view ingredients" ON public.ingredients FOR SELECT USING (true);
CREATE POLICY "Admins can manage ingredients" ON public.ingredients FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Employee-ingredient assignments (which employee is responsible for which ingredients)
CREATE TABLE IF NOT EXISTS public.employee_ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ingredient_id text REFERENCES public.ingredients(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(employee_id, ingredient_id)
);

ALTER TABLE public.employee_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ingredient assignments" ON public.employee_ingredients FOR SELECT USING (auth.uid() = employee_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage ingredient assignments" ON public.employee_ingredients FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Stock reports (remaining quantity + warning from employees)
CREATE TABLE IF NOT EXISTS public.stock_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id text REFERENCES public.ingredients(id) ON DELETE CASCADE NOT NULL,
  reported_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  remaining_quantity numeric,
  warning_message text,
  is_low_stock boolean NOT NULL DEFAULT false,
  reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.stock_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports" ON public.stock_reports FOR SELECT USING (auth.uid() = reported_by);
CREATE POLICY "Users can create own reports" ON public.stock_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Admins can view all reports" ON public.stock_reports FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can resolve reports" ON public.stock_reports FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Updated_at trigger for ingredients
CREATE OR REPLACE TRIGGER update_ingredients_updated_at 
  BEFORE UPDATE ON public.ingredients 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_ingredients_employee ON public.employee_ingredients(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_ingredients_ingredient ON public.employee_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_reports_ingredient ON public.stock_reports(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_reports_reported_by ON public.stock_reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_stock_reports_reported_at ON public.stock_reports(reported_at DESC);
-- Seed ingredients from schema-export categories (excluding menu items)
-- Vegetables (v1-v42)
INSERT INTO public.ingredients (id, name, emoji, unit, category, subcategory, reference_price) VALUES
  ('v1', 'Cà Rốt', '🥕', 'kg', 'vegetables', 'root-vegetables', 18),
  ('v2', 'Khoai Tây', '🥔', 'kg', 'vegetables', 'root-vegetables', 15),
  ('v3', 'Củ Cải Trắng', '🤍', 'kg', 'vegetables', 'root-vegetables', 12),
  ('v4', 'Rau Muống', '🥬', 'kg', 'vegetables', 'leafy-greens', 20),
  ('v5', 'Rau Ngót', '🌿', 'kg', 'vegetables', 'leafy-greens', 18),
  ('v6', 'Cải Bẹ Xanh', '🥬', 'kg', 'vegetables', 'leafy-greens', 15),
  ('v7', 'Xà Lách', '🥬', 'kg', 'vegetables', 'leafy-greens', 12),
  ('v8', 'Rau Cải', '🥬', 'kg', 'vegetables', 'leafy-greens', 15),
  ('v9', 'Rau Mùi', '🌿', 'kg', 'vegetables', 'allium-vegetables', 25),
  ('v10', 'Hành Lá', '🧅', 'kg', 'vegetables', 'allium-vegetables', 18),
  ('v11', 'Tỏi', '🧄', 'kg', 'vegetables', 'allium-vegetables', 35),
  ('v12', 'Hành Tím', '🧅', 'kg', 'vegetables', 'allium-vegetables', 25),
  ('v13', 'Ớt', '🌶️', 'kg', 'vegetables', 'allium-vegetables', 30),
  ('v14', 'Sả', '🌿', 'kg', 'vegetables', 'stem-vegetables', 20),
  ('v15', 'Cần Tây', '🌱', 'kg', 'vegetables', 'stem-vegetables', 25),
  ('v16', 'Măng', '🎋', 'kg', 'vegetables', 'stem-vegetables', 30),
  ('v17', 'Bí Đao', '🥒', 'kg', 'vegetables', 'root-vegetables', 15),
  ('v18', 'Bầu', '🥒', 'kg', 'vegetables', 'root-vegetables', 12),
  ('v19', 'Mướp', '🥒', 'kg', 'vegetables', 'root-vegetables', 15),
  ('v20', 'Cà Chua', '🍅', 'kg', 'vegetables', 'root-vegetables', 20),
  ('v21', 'Cà Tím', '🍆', 'kg', 'vegetables', 'root-vegetables', 18),
  ('v22', 'Đậu Cô Ve', '🫘', 'kg', 'vegetables', 'root-vegetables', 25),
  ('v23', 'Đậu Que', '🫛', 'kg', 'vegetables', 'root-vegetables', 20),
  ('v24', 'Bắp Cải', '🥬', 'kg', 'vegetables', 'leafy-greens', 15),
  ('v25', 'Su Hào', '🥬', 'kg', 'vegetables', 'root-vegetables', 18),
  ('v26', 'Củ Sả', '🌿', 'kg', 'vegetables', 'stem-vegetables', 22),
  ('v27', 'Ngò Gai', '🌿', 'kg', 'vegetables', 'allium-vegetables', 25),
  ('v28', 'Rau Răm', '🌿', 'kg', 'vegetables', 'allium-vegetables', 20),
  ('v29', 'Tía Tô', '🌿', 'kg', 'vegetables', 'allium-vegetables', 25),
  ('v30', 'Kinh Giới', '🌿', 'kg', 'vegetables', 'allium-vegetables', 20),
  ('v31', 'Lá Lốt', '🍃', 'kg', 'vegetables', 'leafy-greens', 30),
  ('v32', 'Hành Phi', '🧅', 'kg', 'vegetables', 'allium-vegetables', 40),
  ('v33', 'Dọc Mùng', '🌱', 'kg', 'vegetables', 'stem-vegetables', 15),
  ('v34', 'Giá Đỗ', '🌱', 'kg', 'vegetables', 'stem-vegetables', 12),
  ('v35', 'Bông Cải Trắng', '🥦', 'kg', 'vegetables', 'leafy-greens', 25),
  ('v36', 'Bông Cải Xanh', '🥦', 'kg', 'vegetables', 'leafy-greens', 30),
  ('v37', 'Khoai Môn', '🥔', 'kg', 'vegetables', 'root-vegetables', 20),
  ('v38', 'Khoai Lang', '🍠', 'kg', 'vegetables', 'root-vegetables', 15),
  ('v39', 'Khổ Qua', '🥒', 'kg', 'vegetables', 'root-vegetables', 18),
  ('v40', 'Ổi Non', '🌱', 'kg', 'vegetables', 'leafy-greens', 25),
  ('v41', 'Đọt Choai', '🌱', 'kg', 'vegetables', 'leafy-greens', 20),
  ('v42', 'Rau Má', '🌿', 'kg', 'vegetables', 'leafy-greens', 15);

-- Sauces (s1-s20)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('s1', 'Nước Mắm', '🫙', 'chai', 'sauces', 35),
  ('s2', 'Xì Dầu', '🫙', 'chai', 'sauces', 25),
  ('s3', 'Tương Ớt', '🌶️', 'chai', 'sauces', 20),
  ('s4', 'Dầu Hào', '🫙', 'chai', 'sauces', 30),
  ('s5', 'Tương Đen', '🫙', 'chai', 'sauces', 25),
  ('s6', 'Giấm Gạo', '🫙', 'chai', 'sauces', 15),
  ('s7', 'Muối', '🧂', 'gói', 'sauces', 8),
  ('s8', 'Hạt Nêm', '🧂', 'gói', 'sauces', 12),
  ('s9', 'Bột Ngọt', '🧂', 'gói', 'sauces', 15),
  ('s10', 'Tương Cà', '🍅', 'chai', 'sauces', 22),
  ('s11', 'Mayonnaise', '🫙', 'hộp', 'sauces', 45),
  ('s12', 'Sa Tế', '🌶️', 'hộp', 'sauces', 35),
  ('s13', 'Mè Rang', '🥜', 'gói', 'sauces', 20),
  ('s14', 'Bơ Lạc', '🥜', 'hộp', 'sauces', 30),
  ('s15', 'Nước Cốt Dừa', '🥥', 'hộp', 'sauces', 25),
  ('s16', 'Rượu Nấu Ăn', '🍶', 'chai', 'sauces', 40),
  ('s17', 'Dầu Mè', '🫙', 'chai', 'sauces', 55),
  ('s18', 'Tương Xào', '🫙', 'chai', 'sauces', 35),
  ('s19', 'Sốt Chua Ngọt', '🫙', 'chai', 'sauces', 30),
  ('s20', 'Sốt Марина', '🫙', 'chai', 'sauces', 40);

-- Spices (sp1-sp20)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('sp1', 'Tiêu', '🧂', 'gói', 'spices', 45),
  ('sp2', 'Hành Khô', '🧅', 'gói', 'spices', 30),
  ('sp3', 'Tỏi Khô', '🧄', 'gói', 'spices', 35),
  ('sp4', 'Ngò Khô', '🌿', 'gói', 'spices', 25),
  ('sp5', 'Quế', '🌿', 'gói', 'spices', 40),
  ('sp6', 'Hoa Hồi', '⭐', 'gói', 'spices', 50),
  ('sp7', 'Đinh Hương', '🌸', 'gói', 'spices', 55),
  ('sp8', 'Bột Cà Ri', '🟡', 'gói', 'spices', 35),
  ('sp9', 'Bột Ớt', '🌶️', 'gói', 'spices', 30),
  ('sp10', 'Bột Tỏi', '🧄', 'gói', 'spices', 35),
  ('sp11', 'Bột Hành', '🧅', 'gói', 'spices', 25),
  ('sp12', 'Bột Nghệ', '🟡', 'gói', 'spices', 30),
  ('sp13', 'Gừng', '🫚', 'kg', 'spices', 40),
  ('sp14', 'Nghệ Tươi', '🟡', 'kg', 'spices', 35),
  ('sp15', 'Riềng', '🌿', 'gói', 'spices', 25),
  ('sp16', 'Lá Chanh', '🍃', 'gói', 'spices', 20),
  ('sp17', 'Thảo Quả', '🌰', 'gói', 'spices', 45),
  ('sp18', 'Mật Ong', '🍯', 'chai', 'spices', 60),
  ('sp19', 'Đường', '🍬', 'gói', 'spices', 15),
  ('sp20', 'Bột Quế', '🌿', 'gói', 'spices', 40);

-- Grains (g1-g15)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('g1', 'Gạo', '🌾', 'kg', 'grains', 22),
  ('g2', 'Bánh Phở', '🍜', 'kg', 'grains', 30),
  ('g3', 'Bánh Canh', '🍜', 'kg', 'grains', 25),
  ('g4', 'Bún Tươi', '🍜', 'kg', 'grains', 18),
  ('g5', 'Hủ Tiếu', '🍜', 'kg', 'grains', 20),
  ('g6', 'Miến', '🍜', 'gói', 'grains', 25),
  ('g7', 'Mì Gói', '🍜', 'gói', 'grains', 12),
  ('g8', 'Yến Mạch', '🌾', 'kg', 'grains', 45),
  ('g9', 'Bột Năng', '🌾', 'gói', 'grains', 20),
  ('g10', 'Bột Gạo', '🌾', 'gói', 'grains', 22),
  ('g11', 'Bột Mì', '🌾', 'gói', 'grains', 25),
  ('g12', 'Đậu Xanh', '🫘', 'kg', 'grains', 30),
  ('g13', 'Đậu Đỏ', '🫘', 'kg', 'grains', 35),
  ('g14', 'Đậu Đen', '🫘', 'kg', 'grains', 30),
  ('g15', 'Đậu Phộng', '🥜', 'kg', 'grains', 40);

-- Oils (o1-o10)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('o1', 'Dầu Ăn', '🫒', 'lít', 'oils', 35),
  ('o2', 'Dầu Oliu', '🫒', 'lít', 'oils', 80),
  ('o3', 'Mỡ Heo', '🐷', 'kg', 'oils', 50),
  ('o4', 'Dầu Đậu Nành', '🫒', 'lít', 'oils', 30),
  ('o5', 'Dầu Hạt Cải', '🫒', 'lít', 'oils', 35),
  ('o6', 'Dầu Dừa', '🥥', 'lít', 'oils', 45),
  ('o7', 'Dầu Vừng', '🌰', 'lít', 'oils', 60),
  ('o8', 'Bơ Thực Vật', '🧈', 'kg', 'oils', 55),
  ('o9', 'Shortening', '🧈', 'kg', 'oils', 40),
  ('o10', 'Dầu Chiên', '🫒', 'lít', 'oils', 30);

-- Proteins (p1-p10)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('p1', 'Thịt Heo', '🥩', 'kg', 'proteins', 90),
  ('p2', 'Thịt Bò', '🥩', 'kg', 'proteins', 150),
  ('p3', 'Gà Nguyên Con', '🐔', 'kg', 'proteins', 75),
  ('p4', 'Tôm Sú', '🦐', 'kg', 'proteins', 180),
  ('p5', 'Cá Lóc', '🐟', 'kg', 'proteins', 120),
  ('p6', 'Trứng Gà', '🥚', 'tá', 'proteins', 45),
  ('p7', 'Trứng Vịt', '🥚', 'tá', 'proteins', 50),
  ('p8', 'Cá basa', '🐟', 'kg', 'proteins', 80),
  ('p9', 'Mực', '🦑', 'kg', 'proteins', 130),
  ('p10', 'Cua', '🦀', 'kg', 'proteins', 160);

-- Dairy (d1-d8)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('d1', 'Sữa Tươi', '🥛', 'hộp', 'dairy', 25),
  ('d2', 'Sữa Đặc', '🥛', 'hộp', 'dairy', 30),
  ('d3', 'Kem Tươi', '🧁', 'hộp', 'dairy', 45),
  ('d4', 'Phô Mai', '🧀', 'gói', 'dairy', 35),
  ('d5', 'Bơ', '🧈', 'gói', 'dairy', 40),
  ('d6', 'Sữa Chua', '🥛', 'hộp', 'dairy', 20),
  ('d7', 'Sữa Bột', '🥛', 'hộp', 'dairy', 55),
  ('d8', 'Phô Mai Que', '🧀', 'gói', 'dairy', 30);

-- Gas (ga1-ga5)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('ga1', 'Gas Bếp', '⛽', 'bình', 'gas', 250),
  ('ga2', 'Gas Dự Phòng', '⛽', 'bình', 'gas', 180),
  ('ga3', 'Bếp Ga Du Lịch', '🔥', 'bình', 'gas', 60),
  ('ga4', 'Van Ga', '🔧', 'cái', 'gas', 45),
  ('ga5', 'Dây Ga', '🔧', 'cái', 'gas', 35);

-- Equipment (e1-e10)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('e1', 'Túi Nylon', '🛍️', 'cuộn', 'equipment', 25),
  ('e2', 'Hộp Đựng', '📦', 'gói', 'equipment', 40),
  ('e3', 'Găng Tay', '🧤', 'hộp', 'equipment', 30),
  ('e4', 'Khăn Lau', '🧻', 'gói', 'equipment', 20),
  ('e5', 'Chổi Lau', '🧹', 'cái', 'equipment', 45),
  ('e6', 'Xoong Chảo', '🍳', 'cái', 'equipment', 120),
  ('e7', 'Dao Kéo', '🔪', 'cái', 'equipment', 60),
  ('e8', 'Thớt', '🪵', 'cái', 'equipment', 45),
  ('e9', 'Muỗng Nĩa', '🥄', 'gói', 'equipment', 25),
  ('e10', 'Giấy Bạc', '📄', 'cuộn', 'equipment', 35);

-- Tissue & Cleaning (t1-t10)
INSERT INTO public.ingredients (id, name, emoji, unit, category, reference_price) VALUES
  ('t1', 'Giấy Vệ Sinh', '🧻', 'cuộn', 'tissue', 20),
  ('t2', 'Khăn Giấy', '🧻', 'gói', 'tissue', 15),
  ('t3', 'Nước Rửa Chén', '🧴', 'chai', 'tissue', 25),
  ('t4', 'Nước Lau Sàn', '🧴', 'chai', 'tissue', 30),
  ('t5', 'Xà Phòng', '🧼', 'bánh', 'tissue', 18),
  ('t6', 'Nước Tẩy', '🧴', 'chai', 'tissue', 35),
  ('t7', 'Bông Rửa', '🧽', 'gói', 'tissue', 15),
  ('t8', 'Túi Rác', '🗑️', 'cuộn', 'tissue', 20),
  ('t9', 'Cồn', '🧴', 'chai', 'tissue', 25),
  ('t10', 'Nước Hoa', '🌸', 'chai', 'tissue', 40);

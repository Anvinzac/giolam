-- 1. Period archive
ALTER TABLE public.working_periods ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_working_periods_active ON public.working_periods(is_archived, start_date);

-- 2. Stock inventory tables
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
GRANT SELECT ON public.ingredients TO authenticated;
GRANT SELECT ON public.ingredients TO anon;
GRANT ALL ON public.ingredients TO service_role;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view ingredients" ON public.ingredients;
CREATE POLICY "Everyone can view ingredients" ON public.ingredients FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage ingredients" ON public.ingredients;
CREATE POLICY "Admins can manage ingredients" ON public.ingredients FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.employee_ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ingredient_id text REFERENCES public.ingredients(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(employee_id, ingredient_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_ingredients TO authenticated;
GRANT ALL ON public.employee_ingredients TO service_role;
ALTER TABLE public.employee_ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own ingredient assignments" ON public.employee_ingredients;
CREATE POLICY "Users can view own ingredient assignments" ON public.employee_ingredients FOR SELECT USING (auth.uid() = employee_id OR has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can manage ingredient assignments" ON public.employee_ingredients;
CREATE POLICY "Admins can manage ingredient assignments" ON public.employee_ingredients FOR ALL USING (has_role(auth.uid(), 'admin'));

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_reports TO authenticated;
GRANT ALL ON public.stock_reports TO service_role;
ALTER TABLE public.stock_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own reports" ON public.stock_reports;
CREATE POLICY "Users can view own reports" ON public.stock_reports FOR SELECT USING (auth.uid() = reported_by);
DROP POLICY IF EXISTS "Users can create own reports" ON public.stock_reports;
CREATE POLICY "Users can create own reports" ON public.stock_reports FOR INSERT WITH CHECK (auth.uid() = reported_by);
DROP POLICY IF EXISTS "Admins can view all reports" ON public.stock_reports;
CREATE POLICY "Admins can view all reports" ON public.stock_reports FOR SELECT USING (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can resolve reports" ON public.stock_reports;
CREATE POLICY "Admins can resolve reports" ON public.stock_reports FOR UPDATE USING (has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_ingredients_updated_at ON public.ingredients;
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_employee_ingredients_employee ON public.employee_ingredients(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_ingredients_ingredient ON public.employee_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_reports_ingredient ON public.stock_reports(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_reports_reported_by ON public.stock_reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_stock_reports_reported_at ON public.stock_reports(reported_at DESC);

-- 3. Admin shift policies
DROP POLICY IF EXISTS "Admins can insert all shifts" ON public.shifts;
CREATE POLICY "Admins can insert all shifts" ON public.shifts FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can update all shifts" ON public.shifts;
CREATE POLICY "Admins can update all shifts" ON public.shifts FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can delete all shifts" ON public.shifts;
CREATE POLICY "Admins can delete all shifts" ON public.shifts FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- 4. Shift slot on shifts
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS shift_slot TEXT;
UPDATE public.shifts SET shift_slot = CASE WHEN clock_in::text LIKE '08:%' THEN 'morning' ELSE 'afternoon' END WHERE shift_slot IS NULL AND clock_in IS NOT NULL;
UPDATE public.shifts SET shift_slot = 'morning' WHERE shift_slot IS NULL;
ALTER TABLE public.shifts ALTER COLUMN shift_slot SET NOT NULL;
ALTER TABLE public.shifts ALTER COLUMN shift_slot SET DEFAULT 'morning';
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_user_id_shift_date_key;
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_user_id_shift_date_shift_slot_key;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_user_id_shift_date_shift_slot_key UNIQUE (user_id, shift_date, shift_slot);

-- 5. Shift slot on registrations
ALTER TABLE public.shift_registrations ADD COLUMN IF NOT EXISTS shift_slot TEXT;
UPDATE public.shift_registrations SET shift_slot = CASE WHEN clock_in::text LIKE '08:%' THEN 'morning' ELSE 'afternoon' END WHERE shift_slot IS NULL AND clock_in IS NOT NULL;
UPDATE public.shift_registrations SET shift_slot = 'morning' WHERE shift_slot IS NULL;
ALTER TABLE public.shift_registrations ALTER COLUMN shift_slot SET NOT NULL;
ALTER TABLE public.shift_registrations ALTER COLUMN shift_slot SET DEFAULT 'morning';
ALTER TABLE public.shift_registrations DROP CONSTRAINT IF EXISTS shift_registrations_user_id_shift_date_key;
ALTER TABLE public.shift_registrations DROP CONSTRAINT IF EXISTS shift_registrations_user_id_shift_date_shift_slot_key;
ALTER TABLE public.shift_registrations ADD CONSTRAINT shift_registrations_user_id_shift_date_shift_slot_key UNIQUE (user_id, shift_date, shift_slot);

-- 6. Read policies for roster display
DROP POLICY IF EXISTS "Authenticated users can view all shifts" ON public.shifts;
CREATE POLICY "Authenticated users can view all shifts" ON public.shifts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

-- 7. Assigned status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'registration_status'::regtype AND enumlabel = 'assigned') THEN
    ALTER TYPE registration_status ADD VALUE 'assigned';
  END IF;
END $$;

-- 8. Admin registration insert/delete
DROP POLICY IF EXISTS "Admins can insert all registrations" ON public.shift_registrations;
CREATE POLICY "Admins can insert all registrations" ON public.shift_registrations FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can delete all registrations" ON public.shift_registrations;
CREATE POLICY "Admins can delete all registrations" ON public.shift_registrations FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- 9. Shift register roster flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS include_in_shift_register boolean NOT NULL DEFAULT true;
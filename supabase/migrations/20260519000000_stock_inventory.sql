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

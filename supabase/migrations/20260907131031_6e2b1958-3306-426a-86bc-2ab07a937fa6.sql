-- custom_depletion_notices
CREATE TABLE IF NOT EXISTS public.custom_depletion_notices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ingredient_name text NOT NULL,
  note text,
  reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_depletion_notices TO authenticated;
GRANT ALL ON public.custom_depletion_notices TO service_role;
ALTER TABLE public.custom_depletion_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone signed in can read notices" ON public.custom_depletion_notices;
CREATE POLICY "Anyone signed in can read notices" ON public.custom_depletion_notices FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Users can insert own notices" ON public.custom_depletion_notices;
CREATE POLICY "Users can insert own notices" ON public.custom_depletion_notices FOR INSERT WITH CHECK (auth.uid() = reported_by);
DROP POLICY IF EXISTS "Authors update own notices" ON public.custom_depletion_notices;
CREATE POLICY "Authors update own notices" ON public.custom_depletion_notices FOR UPDATE USING (auth.uid() = reported_by) WITH CHECK (auth.uid() = reported_by);
DROP POLICY IF EXISTS "Admins resolve notices" ON public.custom_depletion_notices;
CREATE POLICY "Admins resolve notices" ON public.custom_depletion_notices FOR UPDATE USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Authors delete own notices" ON public.custom_depletion_notices;
CREATE POLICY "Authors delete own notices" ON public.custom_depletion_notices FOR DELETE USING (auth.uid() = reported_by);
DROP POLICY IF EXISTS "Admins delete notices" ON public.custom_depletion_notices;
CREATE POLICY "Admins delete notices" ON public.custom_depletion_notices FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_custom_depletion_notices_reported_at ON public.custom_depletion_notices (reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_depletion_notices_unresolved ON public.custom_depletion_notices (reported_at DESC) WHERE resolved_at IS NULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_depletion_notices;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- needs-purchase flag
ALTER TABLE public.custom_depletion_notices
  ADD COLUMN IF NOT EXISTS needs_purchase boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantity text,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_by uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_cdn_open_purchase ON public.custom_depletion_notices (reported_at DESC) WHERE needs_purchase = true AND resolved_at IS NULL AND dismissed_at IS NULL;

-- report frequency
ALTER TABLE public.employee_ingredients ADD COLUMN IF NOT EXISTS report_weekdays smallint[];
COMMENT ON COLUMN public.employee_ingredients.report_weekdays IS 'Weekdays (0=Sun..6=Sat, JS getDay) on which this ingredient must be reported. NULL = every day.';

-- takeaway seeds
INSERT INTO public.ingredients (id, name, emoji, unit, category) VALUES
  ('ta1', 'Hộp', '📦', 'bao', 'takeaway'),
  ('ta2', 'Nắp', '🔘', 'bao', 'takeaway'),
  ('ta3', 'Chén Chấm', '🥣', 'bao', 'takeaway'),
  ('ta4', 'Chén Canh', '🍜', 'bao', 'takeaway'),
  ('ta5', 'Đũa', '🥢', 'bao', 'takeaway'),
  ('ta6', 'Muỗng', '🥄', 'bao', 'takeaway'),
  ('ta7', 'Bao Xanh', '🛍️', 'bao', 'takeaway'),
  ('ta8', 'Bao Lớn', '🛍️', 'bao', 'takeaway'),
  ('ta9', 'Bao BMI', '🛍️', 'bao', 'takeaway')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emoji = EXCLUDED.emoji, unit = EXCLUDED.unit, category = EXCLUDED.category;

-- extra / wash reclassification + seeds
UPDATE public.ingredients SET name = 'giấy vệ sinh', emoji = '🧻', unit = 'cuộn', category = 'extra', subcategory = NULL WHERE id = 't1';
UPDATE public.ingredients SET name = 'giấy ăn', emoji = '🧻', unit = 'gói', category = 'extra', subcategory = NULL WHERE id = 't2';
UPDATE public.ingredients SET name = 'Nước rửa chén', emoji = '🧴', unit = 'chai', category = 'wash', subcategory = NULL WHERE id = 't3';
UPDATE public.ingredients SET name = 'lau sàn', emoji = '🧴', unit = 'chai', category = 'extra', subcategory = NULL WHERE id = 't4';
UPDATE public.ingredients SET name = 'Bùi nhùi', emoji = '🧽', unit = 'gói', category = 'wash', subcategory = NULL WHERE id = 't7';
UPDATE public.ingredients SET name = 'bao rác WC', emoji = '🗑️', unit = 'cuộn', category = 'extra', subcategory = NULL WHERE id = 't8';
UPDATE public.ingredients SET name = 'cồn rửa tay', emoji = '🧴', unit = 'chai', category = 'extra', subcategory = NULL WHERE id = 't9';
UPDATE public.ingredients SET name = 'Khăn lau', emoji = '🧻', unit = 'gói', category = 'wash', subcategory = NULL WHERE id = 'e4';
UPDATE public.ingredients SET name = 'Cây lau sàn', emoji = '🧹', unit = 'cái', category = 'wash', subcategory = NULL WHERE id = 'e5';
INSERT INTO public.ingredients (id, name, emoji, unit, category) VALUES
  ('ex_lau_kinh', 'lau kính', '🧴', 'chai', 'extra'),
  ('ex_nuoc_rua_tay', 'nước rửa tay', '🧴', 'chai', 'extra'),
  ('wa_choi', 'Chổi', '🧹', 'cái', 'wash')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emoji = EXCLUDED.emoji, unit = EXCLUDED.unit, category = EXCLUDED.category, subcategory = NULL;

-- remove proteins category
DELETE FROM public.ingredients WHERE category = 'proteins';
-- Take-away (mang về) category + its items.
--
-- Disposable / serving supplies used for take-away orders. New category
-- key 'takeaway'; the admin category filter derives its chip list from
-- existing rows, so seeding these makes the category appear on its own.
-- IDs use the 'ta' prefix ('t' is already taken by tissue).

INSERT INTO public.ingredients (id, name, emoji, unit, category) VALUES
  ('ta1', 'Hộp',       '📦', 'cái',  'takeaway'),
  ('ta2', 'Nắp',       '🔘', 'cái',  'takeaway'),
  ('ta3', 'Chén Chấm', '🥣', 'cái',  'takeaway'),
  ('ta4', 'Chén Canh', '🍜', 'cái',  'takeaway'),
  ('ta5', 'Đũa',       '🥢', 'đôi',  'takeaway'),
  ('ta6', 'Muỗng',     '🥄', 'cái',  'takeaway'),
  ('ta7', 'Bao Xanh',  '🛍️', 'xấp',  'takeaway'),
  ('ta8', 'Bao Lớn',   '🛍️', 'xấp',  'takeaway'),
  ('ta9', 'Bao BMI',   '🛍️', 'xấp',  'takeaway')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  unit = EXCLUDED.unit,
  category = EXCLUDED.category;

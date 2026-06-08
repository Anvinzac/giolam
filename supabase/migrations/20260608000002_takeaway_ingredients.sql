-- Take-away (mang về) category + its items.
--
-- Disposable / serving supplies used for take-away orders. New category
-- key 'takeaway'; the admin category filter derives its chip list from
-- existing rows, so seeding these makes the category appear on its own.
-- IDs use the 'ta' prefix ('t' is already taken by tissue).
-- Unit is 'bao' for all — each pack holds 50 pieces.

INSERT INTO public.ingredients (id, name, emoji, unit, category) VALUES
  ('ta1', 'Hộp',       '📦', 'bao', 'takeaway'),
  ('ta2', 'Nắp',       '🔘', 'bao', 'takeaway'),
  ('ta3', 'Chén Chấm', '🥣', 'bao', 'takeaway'),
  ('ta4', 'Chén Canh', '🍜', 'bao', 'takeaway'),
  ('ta5', 'Đũa',       '🥢', 'bao', 'takeaway'),
  ('ta6', 'Muỗng',     '🥄', 'bao', 'takeaway'),
  ('ta7', 'Bao Xanh',  '🛍️', 'bao', 'takeaway'),
  ('ta8', 'Bao Lớn',   '🛍️', 'bao', 'takeaway'),
  ('ta9', 'Bao BMI',   '🛍️', 'bao', 'takeaway')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  unit = EXCLUDED.unit,
  category = EXCLUDED.category;

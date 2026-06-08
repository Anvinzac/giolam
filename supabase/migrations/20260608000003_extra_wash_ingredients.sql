-- Extra and dish-washing/cleaning supply categories.
--
-- Existing seeded supplies are reclassified by their stable IDs where they
-- already match the requested item. Missing requested items are seeded with
-- stable IDs so the admin category chips appear as soon as this migration runs.

UPDATE public.ingredients SET
  name = 'giấy vệ sinh',
  emoji = '🧻',
  unit = 'cuộn',
  category = 'extra',
  subcategory = NULL
WHERE id = 't1';

UPDATE public.ingredients SET
  name = 'giấy ăn',
  emoji = '🧻',
  unit = 'gói',
  category = 'extra',
  subcategory = NULL
WHERE id = 't2';

UPDATE public.ingredients SET
  name = 'Nước rửa chén',
  emoji = '🧴',
  unit = 'chai',
  category = 'wash',
  subcategory = NULL
WHERE id = 't3';

UPDATE public.ingredients SET
  name = 'lau sàn',
  emoji = '🧴',
  unit = 'chai',
  category = 'extra',
  subcategory = NULL
WHERE id = 't4';

UPDATE public.ingredients SET
  name = 'Bùi nhùi',
  emoji = '🧽',
  unit = 'gói',
  category = 'wash',
  subcategory = NULL
WHERE id = 't7';

UPDATE public.ingredients SET
  name = 'bao rác WC',
  emoji = '🗑️',
  unit = 'cuộn',
  category = 'extra',
  subcategory = NULL
WHERE id = 't8';

UPDATE public.ingredients SET
  name = 'cồn rửa tay',
  emoji = '🧴',
  unit = 'chai',
  category = 'extra',
  subcategory = NULL
WHERE id = 't9';

UPDATE public.ingredients SET
  name = 'Khăn lau',
  emoji = '🧻',
  unit = 'gói',
  category = 'wash',
  subcategory = NULL
WHERE id = 'e4';

UPDATE public.ingredients SET
  name = 'Cây lau sàn',
  emoji = '🧹',
  unit = 'cái',
  category = 'wash',
  subcategory = NULL
WHERE id = 'e5';

INSERT INTO public.ingredients (id, name, emoji, unit, category) VALUES
  ('ex_lau_kinh', 'lau kính', '🧴', 'chai', 'extra'),
  ('ex_nuoc_rua_tay', 'nước rửa tay', '🧴', 'chai', 'extra'),
  ('wa_choi', 'Chổi', '🧹', 'cái', 'wash')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  unit = EXCLUDED.unit,
  category = EXCLUDED.category,
  subcategory = NULL;

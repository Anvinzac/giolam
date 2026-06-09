-- Remove the "proteins" (meat / seafood) ingredient category.
--
-- The restaurant is fully vegetarian, so these items don't belong in
-- the inventory catalog. Deleting the ingredient rows cascades to their
-- employee_ingredients assignments and stock_reports (both FKs are
-- ON DELETE CASCADE), clearing the category end to end.

DELETE FROM public.ingredients WHERE category = 'proteins';

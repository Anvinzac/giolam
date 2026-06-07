-- "Cần mua" (needs-purchase) flag for custom depletion notices.
--
-- When an employee reports a custom ingredient they can tick "cần mua"
-- and enter a quantity. Those notices form a shopping list in a
-- dedicated section of the common notice board, which an admin resolves
-- two ways:
--   - done      → resolved_at  (already exists; "đã mua / xong")
--   - dismissed → dismissed_at (new; "bỏ qua")
-- A notice is "open" when both timestamps are NULL.

ALTER TABLE public.custom_depletion_notices
  ADD COLUMN IF NOT EXISTS needs_purchase boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantity text,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_by uuid REFERENCES auth.users(id);

-- Fast lookup for the open shopping list.
CREATE INDEX IF NOT EXISTS idx_cdn_open_purchase
  ON public.custom_depletion_notices (reported_at DESC)
  WHERE needs_purchase = true AND resolved_at IS NULL AND dismissed_at IS NULL;

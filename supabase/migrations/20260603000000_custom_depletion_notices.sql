-- Custom-named ingredient depletion notices.
--
-- Employees can already report assigned-ingredient stock via
-- stock_reports, but anything outside their assignment list had no
-- channel. This table is the "common notice board" — every employee
-- can post a free-text ingredient name when something runs out, and
-- everyone (employees + admins) can read the board, so kitchen staff
-- can flag depletions without waiting for assignments to be wired up.

CREATE TABLE IF NOT EXISTS public.custom_depletion_notices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ingredient_name text NOT NULL,
  note text,
  reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.custom_depletion_notices ENABLE ROW LEVEL SECURITY;

-- Common board: anyone signed in can read every notice.
CREATE POLICY "Anyone signed in can read notices"
  ON public.custom_depletion_notices
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authors post their own notices.
CREATE POLICY "Users can insert own notices"
  ON public.custom_depletion_notices
  FOR INSERT
  WITH CHECK (auth.uid() = reported_by);

-- Authors can mark / unmark resolved on their own notice; admins can
-- resolve any notice (mirrors stock_reports admin policy).
CREATE POLICY "Authors update own notices"
  ON public.custom_depletion_notices
  FOR UPDATE
  USING (auth.uid() = reported_by)
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Admins resolve notices"
  ON public.custom_depletion_notices
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Authors can delete their own; admins can delete anything.
CREATE POLICY "Authors delete own notices"
  ON public.custom_depletion_notices
  FOR DELETE
  USING (auth.uid() = reported_by);

CREATE POLICY "Admins delete notices"
  ON public.custom_depletion_notices
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_custom_depletion_notices_reported_at
  ON public.custom_depletion_notices (reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_depletion_notices_unresolved
  ON public.custom_depletion_notices (reported_at DESC)
  WHERE resolved_at IS NULL;

-- Stream board changes so the page can update without polling.
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_depletion_notices;

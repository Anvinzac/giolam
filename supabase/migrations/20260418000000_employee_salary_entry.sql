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

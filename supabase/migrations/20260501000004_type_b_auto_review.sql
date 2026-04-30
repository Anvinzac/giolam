-- Type B employee submissions no longer require per-row admin approval.
--
-- Product direction: overtime (Type B) employees should be able to submit
-- their clock-out times without generating a yellow "pending review" queue
-- for admins. Keep the final salary record publish flow as-is, but treat
-- day-to-day Type B row edits as already reviewed.

-- Clear any existing pending flags on overtime rows so current accounts stop
-- showing stale admin-review badges as soon as this migration is applied.
UPDATE public.salary_entries se
SET is_admin_reviewed = true
FROM public.profiles p
WHERE p.user_id = se.user_id
  AND p.shift_type = 'overtime'
  AND se.is_admin_reviewed = false;

-- Employees may still need to remove their own duplicate overtime rows even
-- though those rows are now auto-reviewed. Allow deletes for:
--   1. any still-unreviewed row they own, or
--   2. their own overtime duplicate rows (sort_order > 0),
-- while the period remains unpublished.
DROP POLICY IF EXISTS "Users delete own unreviewed" ON public.salary_entries;

CREATE POLICY "Users delete own editable rows"
  ON public.salary_entries FOR DELETE
  USING (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.salary_records sr
      WHERE sr.user_id = salary_entries.user_id
        AND sr.period_id = salary_entries.period_id
        AND sr.status = 'published'
    )
    AND (
      is_admin_reviewed = false
      OR (
        submitted_by = auth.uid()
        AND sort_order > 0
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = salary_entries.user_id
            AND p.shift_type = 'overtime'
        )
      )
    )
  );

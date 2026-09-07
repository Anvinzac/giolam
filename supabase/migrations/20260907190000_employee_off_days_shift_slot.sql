-- Split each off day into noon / evening slots; Kitchen peers can view the board.

ALTER TABLE public.employee_off_days
  ADD COLUMN IF NOT EXISTS shift_slot TEXT;

UPDATE public.employee_off_days
SET shift_slot = 'noon'
WHERE shift_slot IS NULL;

ALTER TABLE public.employee_off_days
  ALTER COLUMN shift_slot SET DEFAULT 'noon',
  ALTER COLUMN shift_slot SET NOT NULL;

ALTER TABLE public.employee_off_days
  DROP CONSTRAINT IF EXISTS employee_off_days_user_id_off_date_key;

ALTER TABLE public.employee_off_days
  DROP CONSTRAINT IF EXISTS employee_off_days_user_date_slot_key;

ALTER TABLE public.employee_off_days
  ADD CONSTRAINT employee_off_days_user_date_slot_key
  UNIQUE (user_id, off_date, shift_slot);

ALTER TABLE public.employee_off_days
  DROP CONSTRAINT IF EXISTS employee_off_days_shift_slot_check;

ALTER TABLE public.employee_off_days
  ADD CONSTRAINT employee_off_days_shift_slot_check
  CHECK (shift_slot IN ('noon', 'evening'));

-- Kitchen employees can read the full off board (admin still manages writes).
DROP POLICY IF EXISTS "Kitchen can view all off days" ON public.employee_off_days;
CREATE POLICY "Kitchen can view all off days"
  ON public.employee_off_days
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.profiles me
      WHERE me.user_id = auth.uid()
        AND me.department_id = 'd0000000-0000-0000-0000-000000000001'::uuid
    )
  );

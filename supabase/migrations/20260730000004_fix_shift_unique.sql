-- Fix unique constraint on shifts to allow same user on both morning and afternoon
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_user_id_shift_date_key;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_user_id_shift_date_shift_slot_key UNIQUE (user_id, shift_date, shift_slot);

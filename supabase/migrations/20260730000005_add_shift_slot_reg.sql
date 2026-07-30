ALTER TABLE public.shift_registrations ADD COLUMN IF NOT EXISTS shift_slot TEXT;

UPDATE public.shift_registrations
SET shift_slot = CASE WHEN clock_in::text LIKE '08:%' THEN 'morning' ELSE 'afternoon' END
WHERE shift_slot IS NULL AND clock_in IS NOT NULL;

UPDATE public.shift_registrations SET shift_slot = 'morning' WHERE shift_slot IS NULL;

ALTER TABLE public.shift_registrations ALTER COLUMN shift_slot SET NOT NULL;
ALTER TABLE public.shift_registrations ALTER COLUMN shift_slot SET DEFAULT 'morning';

ALTER TABLE public.shift_registrations DROP CONSTRAINT IF EXISTS shift_registrations_user_id_shift_date_key;
ALTER TABLE public.shift_registrations ADD CONSTRAINT shift_registrations_user_id_shift_date_shift_slot_key UNIQUE (user_id, shift_date, shift_slot);

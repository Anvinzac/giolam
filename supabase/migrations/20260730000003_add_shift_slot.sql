ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS shift_slot TEXT;

UPDATE public.shifts
SET shift_slot = CASE WHEN clock_in::text LIKE '08:%' THEN 'morning' ELSE 'afternoon' END
WHERE shift_slot IS NULL AND clock_in IS NOT NULL;

UPDATE public.shifts SET shift_slot = 'morning' WHERE shift_slot IS NULL;

ALTER TABLE public.shifts ALTER COLUMN shift_slot SET NOT NULL;
ALTER TABLE public.shifts ALTER COLUMN shift_slot SET DEFAULT 'morning';

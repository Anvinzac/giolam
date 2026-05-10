-- Add is_archived column to working_periods
ALTER TABLE public.working_periods ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Index for faster active period lookups
CREATE INDEX IF NOT EXISTS idx_working_periods_active ON public.working_periods(is_archived, start_date);

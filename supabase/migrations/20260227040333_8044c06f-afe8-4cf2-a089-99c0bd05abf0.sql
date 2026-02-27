
-- Re-add enum value (idempotent)
ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'unapproved';

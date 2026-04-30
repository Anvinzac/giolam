-- Add 'daily' (Loại E) and 'lunar_rate' (Loại D) shift types.
--
-- The TypeScript enum already includes 'lunar_rate' and 'daily', but the
-- Postgres `shift_type` enum was last expanded out-of-band. Adding the
-- values here so future deploys are reproducible from the migration
-- history.
--
-- Type E (daily) is a transitional shape used when a Type A employee
-- finishes a fixed-salary stint and continues on day-by-day pay: it
-- reuses the Type A renderer (preloaded special-rate rows + per-row
-- allowance overrides) but is treated as a distinct category for
-- reporting and onboarding flows.
--
-- ALTER TYPE ADD VALUE must run outside any user transaction; supabase
-- migrations honour that. The new values are unusable in the same
-- transaction they're added — that's fine, the data backfill lives in
-- a separate migration with a later timestamp.

ALTER TYPE public.shift_type ADD VALUE IF NOT EXISTS 'lunar_rate';
ALTER TYPE public.shift_type ADD VALUE IF NOT EXISTS 'daily';

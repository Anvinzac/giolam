-- Run this in Supabase Dashboard -> SQL Editor for project `rrjmkqpexcjsqkxenpet`
-- Fixes: "Could not find the 'base_salary' column of 'profiles' in the schema cache"

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS base_salary BIGINT DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hourly_rate BIGINT DEFAULT 25000;

-- Ensure admins can update any profile (safe to run multiple times).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can update all profiles'
  ) THEN
    CREATE POLICY "Admins can update all profiles"
      ON public.profiles
      FOR UPDATE
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Ask PostgREST to reload its schema cache (usually resolves within seconds).
NOTIFY pgrst, 'reload schema';

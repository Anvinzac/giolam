
-- Create function to expire past pending registrations (uses plpgsql to defer enum resolution)
CREATE OR REPLACE FUNCTION public.expire_past_pending_registrations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.shift_registrations
  SET status = 'unapproved', updated_at = now()
  WHERE status = 'pending' AND shift_date < CURRENT_DATE;
END;
$$;


-- Allow users to update their own unapproved registrations (so they can re-register)
DROP POLICY IF EXISTS "Users can update own pending registrations" ON public.shift_registrations;
CREATE POLICY "Users can update own pending or unapproved registrations"
ON public.shift_registrations
FOR UPDATE
USING (auth.uid() = user_id AND status IN ('pending', 'unapproved'));

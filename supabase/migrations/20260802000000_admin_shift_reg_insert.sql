-- Allow admins to insert into shift_registrations (needed when assigning shifts for other employees)
CREATE POLICY "Admins can insert all registrations"
ON public.shift_registrations FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Allow admins to delete all registrations (needed when removing assigned shifts)
CREATE POLICY "Admins can delete all registrations"
ON public.shift_registrations FOR DELETE
USING (has_role(auth.uid(), 'admin'));

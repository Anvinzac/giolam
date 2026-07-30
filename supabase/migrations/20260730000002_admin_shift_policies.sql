-- Allow admins to manage all shifts
CREATE POLICY "Admins can insert all shifts" ON public.shifts FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all shifts" ON public.shifts FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete all shifts" ON public.shifts FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

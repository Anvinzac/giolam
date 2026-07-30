CREATE POLICY "Authenticated users can view all shifts" ON public.shifts FOR SELECT TO authenticated USING (true);

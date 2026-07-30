-- Allow authenticated users to view all shifts (needed for shift registration name display)
CREATE POLICY "Authenticated users can view all shifts" ON public.shifts FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to view all profiles (needed for shift name display)
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);


-- Create branches table
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Admins can manage branches" ON public.branches FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create departments table
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(name, branch_id)
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Admins can manage departments" ON public.departments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Add department_id, username, must_change_password to profiles
ALTER TABLE public.profiles
  ADD COLUMN department_id uuid REFERENCES public.departments(id),
  ADD COLUMN username text UNIQUE,
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;

-- Seed the branch and departments
INSERT INTO public.branches (id, name) VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Phạm Ngọc Thạch');

INSERT INTO public.departments (id, name, branch_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Kitchen', 'a0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000002', 'Reception', 'a0000000-0000-0000-0000-000000000001');

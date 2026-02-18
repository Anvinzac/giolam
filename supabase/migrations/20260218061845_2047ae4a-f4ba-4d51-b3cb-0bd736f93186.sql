
-- Create enum for registration status
CREATE TYPE public.registration_status AS ENUM ('pending', 'approved', 'rejected', 'modified');

-- Create shift_registrations table
CREATE TABLE public.shift_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  shift_date DATE NOT NULL,
  clock_in TIME WITHOUT TIME ZONE,
  clock_out TIME WITHOUT TIME ZONE,
  status registration_status NOT NULL DEFAULT 'pending',
  admin_clock_in TIME WITHOUT TIME ZONE,
  admin_clock_out TIME WITHOUT TIME ZONE,
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, shift_date)
);

-- Enable RLS
ALTER TABLE public.shift_registrations ENABLE ROW LEVEL SECURITY;

-- Employees can view their own registrations
CREATE POLICY "Users can view own registrations"
ON public.shift_registrations FOR SELECT
USING (auth.uid() = user_id);

-- Employees can insert own registrations
CREATE POLICY "Users can insert own registrations"
ON public.shift_registrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Employees can update own pending registrations
CREATE POLICY "Users can update own pending registrations"
ON public.shift_registrations FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Employees can delete own pending registrations
CREATE POLICY "Users can delete own pending registrations"
ON public.shift_registrations FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all registrations
CREATE POLICY "Admins can view all registrations"
ON public.shift_registrations FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update all registrations (approve/reject/modify)
CREATE POLICY "Admins can update all registrations"
ON public.shift_registrations FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_shift_registrations_updated_at
BEFORE UPDATE ON public.shift_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

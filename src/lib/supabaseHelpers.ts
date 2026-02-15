import { supabase } from "@/integrations/supabase/client";

export async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();
  return data;
}

export async function getUserRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  return data?.role || 'employee';
}

export async function getCurrentPeriod() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase
    .from('working_periods')
    .select('*')
    .lte('start_date', today)
    .gte('end_date', today)
    .single();
  return data;
}

export async function getShiftsForPeriod(periodId: string) {
  const { data } = await supabase
    .from('shifts')
    .select('*')
    .eq('period_id', periodId)
    .order('shift_date', { ascending: true });
  return data || [];
}

export async function upsertShift(shift: {
  user_id: string;
  period_id: string;
  shift_date: string;
  is_active: boolean;
  clock_in?: string | null;
  clock_out?: string | null;
  main_clock_in?: string | null;
  main_clock_out?: string | null;
  overtime_clock_in?: string | null;
  overtime_clock_out?: string | null;
  notice?: string | null;
}) {
  const { data, error } = await supabase
    .from('shifts')
    .upsert(shift, { onConflict: 'user_id,shift_date' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

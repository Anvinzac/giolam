import { supabase } from "@/integrations/supabase/client";

// Format a Date as YYYY-MM-DD using LOCAL time (not UTC).
// Using toISOString() here would shift dates by one day in UTC+7 (Vietnam).
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
  const today = localDateStr(new Date());
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
  shift_slot?: string;
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
    .upsert({ ...shift, shift_slot: shift.shift_slot || 'morning' }, { onConflict: 'user_id,shift_date,shift_slot' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

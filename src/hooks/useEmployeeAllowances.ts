import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeAllowance, AllowanceKey, DEFAULT_ALLOWANCE_LABELS } from '@/types/salary';

const KEYS: AllowanceKey[] = ['chuyen_can', 'nang_luc', 'gui_xe'];

export function useEmployeeAllowances(userId: string | null, periodId: string | null) {
  const [allowances, setAllowances] = useState<EmployeeAllowance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !periodId) { setLoading(false); return; }

    const init = async () => {
      setLoading(true);

      // Try to fetch existing allowances for this period
      const { data } = await (supabase
        .from('employee_allowances' as any) as any)
        .select('*')
        .eq('user_id', userId)
        .eq('period_id', periodId);

      if (data && data.length > 0) {
        setAllowances(data as EmployeeAllowance[]);
        setLoading(false);
        return;
      }

      // Try to carry forward from previous period
      const { data: periods } = await supabase
        .from('working_periods')
        .select('id')
        .lt('start_date', (await supabase.from('working_periods').select('start_date').eq('id', periodId).single()).data?.start_date)
        .order('start_date', { ascending: false })
        .limit(1);

      let prevAllowances: EmployeeAllowance[] = [];
      if (periods && periods.length > 0) {
        const { data: prev } = await (supabase
          .from('employee_allowances' as any) as any)
          .select('*')
          .eq('user_id', userId)
          .eq('period_id', periods[0].id);
        if (prev && prev.length > 0) {
          prevAllowances = prev as EmployeeAllowance[];
        }
      }

      // Create allowances for current period
      const newAllowances: Omit<EmployeeAllowance, 'id'>[] = KEYS.map(key => {
        const prev = prevAllowances.find(a => a.allowance_key === key);
        return {
          user_id: userId,
          period_id: periodId,
          allowance_key: key,
          label: prev?.label || DEFAULT_ALLOWANCE_LABELS[key],
          amount: prev?.amount || 0,
          is_enabled: prev?.is_enabled || false,
        };
      });

      const { data: inserted } = await (supabase
        .from('employee_allowances' as any) as any)
        .insert(newAllowances)
        .select();

      if (inserted) setAllowances(inserted as EmployeeAllowance[]);
      setLoading(false);
    };

    init();
  }, [userId, periodId]);

  const toggleAllowance = useCallback(async (key: AllowanceKey) => {
    const current = allowances.find(a => a.allowance_key === key);
    if (!current?.id) return;
    const newEnabled = !current.is_enabled;
    setAllowances(prev => prev.map(a =>
      a.allowance_key === key ? { ...a, is_enabled: newEnabled } : a
    ));
    await (supabase.from('employee_allowances' as any) as any).update({ is_enabled: newEnabled }).eq('id', current.id);
  }, [allowances]);

  const updateAllowance = useCallback(async (
    key: AllowanceKey,
    updates: { label?: string; amount?: number }
  ) => {
    const current = allowances.find(a => a.allowance_key === key);
    if (!current?.id) return;
    setAllowances(prev => prev.map(a =>
      a.allowance_key === key ? { ...a, ...updates } : a
    ));
    await (supabase.from('employee_allowances' as any) as any).update(updates).eq('id', current.id);
  }, [allowances]);

  return { allowances, loading, toggleAllowance, updateAllowance };
}

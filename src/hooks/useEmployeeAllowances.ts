import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeAllowance, AllowanceKey, DEFAULT_ALLOWANCE_LABELS } from '@/types/salary';

const KEYS: AllowanceKey[] = ['chuyen_can', 'nang_luc', 'gui_xe'];
type AllowanceDefault = {
  id?: string;
  user_id: string;
  allowance_key: AllowanceKey;
  label: string;
  amount: number;
  is_enabled: boolean;
};

const ensureBuiltInDefaults = (defaults: AllowanceDefault[], userId: string) => {
  const byKey = new Map(defaults.map(item => [item.allowance_key, item]));
  const builtIns = KEYS.map((key) => byKey.get(key) || {
    user_id: userId,
    allowance_key: key,
    label: DEFAULT_ALLOWANCE_LABELS[key],
    amount: 0,
    is_enabled: false,
  });
  const customs = defaults.filter(item => !KEYS.includes(item.allowance_key));
  return [...builtIns, ...customs];
};

export function useEmployeeAllowances(userId: string | null, periodId: string | null) {
  const [allowances, setAllowances] = useState<EmployeeAllowance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !periodId) { setLoading(false); return; }

    const init = async () => {
      setLoading(true);

      // Try to fetch existing allowances for this period
      const { data } = await supabase
        .from('employee_allowances')
        .select('*')
        .eq('user_id', userId)
        .eq('period_id', periodId);

      if (data && data.length > 0) {
        setAllowances(data as EmployeeAllowance[]);
        setLoading(false);
        return;
      }

      const syncDefaults = async (defaults: AllowanceDefault[]) => {
        if (defaults.length === 0) return defaults;
        const { data: upserted } = await supabase
          .from('employee_allowance_defaults')
          .upsert(defaults, { onConflict: 'user_id,allowance_key' })
          .select();
        return (upserted as AllowanceDefault[] | null) || defaults;
      };

      const { data: storedDefaults } = await supabase
        .from('employee_allowance_defaults')
        .select('*')
        .eq('user_id', userId);

      let defaultAllowances = (storedDefaults as AllowanceDefault[] | null) || [];

      if (defaultAllowances.length === 0) {
        // Temporary compatibility path for older data until defaults exist.
        const currentPeriodStart = (await supabase
          .from('working_periods')
          .select('start_date')
          .eq('id', periodId)
          .single()).data?.start_date;

        const { data: periods } = await supabase
          .from('working_periods')
          .select('id')
          .lt('start_date', currentPeriodStart)
          .order('start_date', { ascending: false })
          .limit(1);

        if (periods && periods.length > 0) {
          const { data: prev } = await supabase
            .from('employee_allowances')
            .select('*')
            .eq('user_id', userId)
            .eq('period_id', periods[0].id);
          if (prev && prev.length > 0) {
            defaultAllowances = (prev as EmployeeAllowance[]).map(prevAllowance => ({
              user_id: prevAllowance.user_id,
              allowance_key: prevAllowance.allowance_key,
              label: prevAllowance.label,
              amount: prevAllowance.amount,
              is_enabled: prevAllowance.is_enabled,
            }));
          }
        }
      }

      defaultAllowances = ensureBuiltInDefaults(defaultAllowances, userId);
      defaultAllowances = await syncDefaults(defaultAllowances);

      // Create allowances for current period from employee defaults
      const newAllowances: Omit<EmployeeAllowance, 'id'>[] = defaultAllowances.map(defaultAllowance => {
        return {
          user_id: userId,
          period_id: periodId,
          allowance_key: defaultAllowance.allowance_key,
          label: defaultAllowance.label,
          amount: defaultAllowance.amount,
          is_enabled: defaultAllowance.is_enabled,
        };
      });

      const { data: inserted } = await supabase
        .from('employee_allowances')
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
    await supabase.from('employee_allowances').update({ is_enabled: newEnabled }).eq('id', current.id);
    await supabase.from('employee_allowance_defaults').upsert({
      user_id: current.user_id,
      allowance_key: current.allowance_key,
      label: current.label,
      amount: current.amount,
      is_enabled: newEnabled,
    }, { onConflict: 'user_id,allowance_key' });
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
    await supabase.from('employee_allowances').update(updates).eq('id', current.id);
    await supabase.from('employee_allowance_defaults').upsert({
      user_id: current.user_id,
      allowance_key: current.allowance_key,
      label: updates.label ?? current.label,
      amount: updates.amount ?? current.amount,
      is_enabled: current.is_enabled,
    }, { onConflict: 'user_id,allowance_key' });
  }, [allowances]);

  const addAllowance = useCallback(async (label: string, amount: number) => {
    if (!userId || !periodId) return;
    const uniqueKey = `custom_${Date.now()}`;
    const newAllowance: Omit<EmployeeAllowance, 'id'> = {
      user_id: userId,
      period_id: periodId,
      allowance_key: uniqueKey as AllowanceKey,
      label,
      amount,
      is_enabled: true,
    };
    const { data: inserted } = await supabase
      .from('employee_allowances')
      .insert([newAllowance])
      .select();
    await supabase
      .from('employee_allowance_defaults')
      .upsert({
        user_id: userId,
        allowance_key: uniqueKey,
        label,
        amount,
        is_enabled: true,
      }, { onConflict: 'user_id,allowance_key' });
    if (inserted) {
      setAllowances(prev => [...prev, inserted[0] as EmployeeAllowance]);
    }
  }, [userId, periodId]);

  return { allowances, loading, toggleAllowance, updateAllowance, addAllowance };
}

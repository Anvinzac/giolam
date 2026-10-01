import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SpecialDayRate } from '@/types/salary';
import { generateDefaultSpecialDays } from '@/lib/salaryCalculations';

export function useSpecialDayRates(
  periodId: string | null,
  periodStart?: string,
  periodEnd?: string,
  offDays: string[] = []
) {
  const [rates, setRates] = useState<SpecialDayRate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRates = useCallback(async () => {
    if (!periodId) { setLoading(false); return; }
    setLoading(true);

    const { data, error } = await supabase
      .from('special_day_rates')
      .select('*')
      .eq('period_id', periodId)
      .order('sort_order', { ascending: true });

    if (error) { console.error('Failed to fetch rates:', error); setLoading(false); return; }

    if (data && data.length > 0) {
      // The database is the source of truth for special_day_rates.
      // Do NOT filter or delete entries based on the lunarUtils.ts
      // calculation — it has a known off-by-one bug for some months
      // (e.g. Aug 2026) and would silently remove valid, manually
      // corrected rows. All stored rates are used as-is.
      setRates(data as SpecialDayRate[]);
      setLoading(false);
      return;
    }

    // Auto-generate defaults if none exist
    if (periodStart && periodEnd) {
      const defaults = generateDefaultSpecialDays(periodStart, periodEnd, periodId, offDays);
      if (defaults.length > 0) {
        const { data: inserted, error: insertErr } = await supabase
          .from('special_day_rates')
          .insert(defaults)
          .select();
        if (!insertErr && inserted) {
          setRates(inserted as SpecialDayRate[]);
        }
      }
    }
    setLoading(false);
  }, [periodId, periodStart, periodEnd, offDays]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const updateRate = useCallback(async (id: string, updates: Partial<SpecialDayRate>) => {
    setRates(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    const { error } = await supabase
      .from('special_day_rates')
      .update(updates)
      .eq('id', id);
    if (error) console.error('Failed to update rate:', error);
  }, []);

  const addRate = useCallback(async (rate: Omit<SpecialDayRate, 'id'>) => {
    const { data, error } = await supabase
      .from('special_day_rates')
      .insert(rate)
      .select()
      .single();
    if (error) { console.error('Failed to add rate:', error); return; }
    if (data) setRates(prev => [...prev, data as SpecialDayRate].sort((a, b) => a.special_date.localeCompare(b.special_date)));
  }, []);

  const removeRate = useCallback(async (id: string) => {
    setRates(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase
      .from('special_day_rates')
      .delete()
      .eq('id', id);
    if (error) console.error('Failed to remove rate:', error);
  }, []);

  return { rates, loading, updateRate, addRate, removeRate, refreshRates: fetchRates };
}

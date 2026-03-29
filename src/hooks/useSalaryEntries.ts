import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SalaryEntry } from '@/types/salary';

export function useSalaryEntries(userId: string | null, periodId: string | null) {
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<Map<string, Partial<SalaryEntry>>>(new Map());

  useEffect(() => {
    if (!userId || !periodId) { setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('salary_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('period_id', periodId)
        .order('entry_date', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) console.error('Failed to fetch salary entries:', error);
      setEntries((data || []) as SalaryEntry[]);
      setLoading(false);
    };

    fetch();
  }, [userId, periodId]);

  const flushUpdates = useCallback(async () => {
    const updates = new Map(pendingUpdatesRef.current);
    pendingUpdatesRef.current.clear();
    if (updates.size === 0) return;

    setIsSaving(true);
    for (const [key, upd] of updates.entries()) {
      const [entryDate, sortOrderStr] = key.split('|');
      const sortOrder = parseInt(sortOrderStr);

      // Try upsert
      const { error } = await supabase
        .from('salary_entries')
        .upsert(
          {
            user_id: userId!,
            period_id: periodId!,
            entry_date: entryDate,
            sort_order: sortOrder,
            ...upd,
          },
          { onConflict: 'user_id,period_id,entry_date,sort_order' }
        );
      if (error) console.error('Failed to save entry:', error);
    }
    setIsSaving(false);
  }, [userId, periodId]);

  const updateEntry = useCallback((
    entryDate: string,
    sortOrder: number,
    updates: Partial<SalaryEntry>
  ) => {
    // Optimistic local update
    setEntries(prev => {
      const idx = prev.findIndex(e => e.entry_date === entryDate && e.sort_order === sortOrder);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...updates };
        return copy;
      }
      // New entry
      return [...prev, {
        user_id: userId!,
        period_id: periodId!,
        entry_date: entryDate,
        sort_order: sortOrder,
        is_day_off: false,
        off_percent: 0,
        note: null,
        clock_in: null,
        clock_out: null,
        total_hours: null,
        allowance_rate_override: null,
        base_daily_wage: 0,
        allowance_amount: 0,
        extra_wage: 0,
        total_daily_wage: 0,
        ...updates,
      }].sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.sort_order - b.sort_order);
    });

    // Queue for debounced save
    const key = `${entryDate}|${sortOrder}`;
    const existing = pendingUpdatesRef.current.get(key) || {};
    pendingUpdatesRef.current.set(key, { ...existing, ...updates });

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushUpdates, 1500);
  }, [userId, periodId, flushUpdates]);

  const addDuplicateRow = useCallback(async (entryDate: string) => {
    if (!userId || !periodId) return;
    const existing = entries.filter(e => e.entry_date === entryDate);
    const maxSort = existing.reduce((max, e) => Math.max(max, e.sort_order), 0);
    const newEntry: Omit<SalaryEntry, 'id'> = {
      user_id: userId,
      period_id: periodId,
      entry_date: entryDate,
      sort_order: maxSort + 1,
      is_day_off: false,
      off_percent: 0,
      note: null,
      clock_in: null,
      clock_out: null,
      total_hours: null,
      allowance_rate_override: null,
      base_daily_wage: 0,
      allowance_amount: 0,
      extra_wage: 0,
      total_daily_wage: 0,
    };

    const { data, error } = await supabase
      .from('salary_entries')
      .insert(newEntry)
      .select()
      .single();
    if (error) { console.error('Failed to add duplicate row:', error); return; }
    if (data) {
      setEntries(prev =>
        [...prev, data as SalaryEntry].sort(
          (a, b) => a.entry_date.localeCompare(b.entry_date) || a.sort_order - b.sort_order
        )
      );
    }
  }, [userId, periodId, entries]);

  const removeEntry = useCallback(async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    const { error } = await supabase.from('salary_entries').delete().eq('id', id);
    if (error) console.error('Failed to remove entry:', error);
  }, []);

  return { entries, loading, updateEntry, addDuplicateRow, removeEntry, isSaving };
}

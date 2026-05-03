import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SalaryRecord, SalaryBreakdown } from '@/types/salary';

export function useSalaryRecord(userId: string | null, periodId: string | null) {
  const [record, setRecord] = useState<SalaryRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !periodId) { setLoading(false); return; }

    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('salary_records')
        .select('*')
        .eq('user_id', userId)
        .eq('period_id', periodId)
        .single();

      if (data) {
        setRecord(data as unknown as SalaryRecord);
      } else {
        // Create draft
        const { data: created } = await supabase
          .from('salary_records')
          .insert({
            user_id: userId,
            period_id: periodId,
            total_salary: 0,
            status: 'draft',
          })
          .select()
          .single();
        if (created) setRecord(created as unknown as SalaryRecord);
      }
      setLoading(false);
    };

    fetch();
  }, [userId, periodId]);

  const saveDraft = useCallback(async (
    totalSalary: number,
    breakdown: SalaryBreakdown
  ) => {
    if (!userId || !periodId) return;
    const { data } = await supabase
      .from('salary_records')
      .upsert(
        {
          user_id: userId,
          period_id: periodId,
          total_salary: totalSalary,
          salary_breakdown: breakdown as unknown as Record<string, unknown>,
          status: 'draft',
        },
        { onConflict: 'user_id,period_id' }
      )
      .select()
      .single();
    if (data) setRecord(data as unknown as SalaryRecord);
  }, [userId, periodId]);

  const publish = useCallback(async (
    totalSalary: number,
    breakdown: SalaryBreakdown
  ) => {
    if (!userId || !periodId) return;
    const publishedAt = new Date().toISOString();

    const { data: rec } = await supabase
      .from('salary_records')
      .upsert(
        {
          user_id: userId,
          period_id: periodId,
          total_salary: totalSalary,
          salary_breakdown: breakdown as unknown as Record<string, unknown>,
          status: 'published',
          published_at: publishedAt,
        },
        { onConflict: 'user_id,period_id' }
      )
      .select()
      .single();
    if (!rec) return;
    setRecord(rec as unknown as SalaryRecord);

    // Freeze a snapshot of every input the employee view needs, so admin
    // edits after publish do not retroactively change what the employee
    // sees. Re-publishing overwrites the snapshot via UNIQUE(user_id,period_id).
    const profileLookup = await supabase.from('profiles')
      .select('shift_type, base_salary, hourly_rate, default_clock_in, default_clock_out')
      .eq('user_id', userId).single();

    // Type A (basic): seed placeholder rows for any special day in the period
    // that doesn't yet have an entry. Mirrors useSalaryEntries(seedAllDays:true)
    // — without this, employees whose admin page wasn't opened recently miss
    // the special-day rows in their snapshot.
    if ((profileLookup.data as { shift_type?: string } | null)?.shift_type === 'basic') {
      const [{ data: existingEntries }, { data: specialRates }] = await Promise.all([
        supabase.from('salary_entries').select('entry_date').eq('user_id', userId).eq('period_id', periodId),
        supabase.from('special_day_rates').select('special_date, rate_percent').eq('period_id', periodId),
      ]);
      const existingDates = new Set((existingEntries || []).map((e: { entry_date: string }) => e.entry_date));
      const missing = (specialRates || [])
        .filter((r: { rate_percent: number }) => r.rate_percent > 0)
        .map((r: { special_date: string }) => r.special_date)
        .filter((d: string) => !existingDates.has(d));
      if (missing.length > 0) {
        await supabase.from('salary_entries').insert(
          missing.map(d => ({
            user_id: userId,
            period_id: periodId,
            entry_date: d,
            sort_order: 0,
            is_day_off: true,
            off_percent: 0,
            base_daily_wage: 0,
            allowance_amount: 0,
            extra_wage: 0,
            total_daily_wage: 0,
          }))
        );
      }
    }

    const [entriesRes, allowancesRes, ratesRes, periodRes] = await Promise.all([
      supabase.from('salary_entries').select('*').eq('user_id', userId).eq('period_id', periodId)
        .order('entry_date').order('sort_order'),
      supabase.from('employee_allowances').select('*').eq('user_id', userId).eq('period_id', periodId),
      supabase.from('special_day_rates').select('*').eq('period_id', periodId),
      supabase.from('working_periods').select('id, start_date, end_date, off_days').eq('id', periodId).single(),
    ]);
    const profileRes = profileLookup;

    await supabase.from('salary_published_snapshots').upsert(
      {
        salary_record_id: (rec as { id: string }).id,
        user_id: userId,
        period_id: periodId,
        published_at: publishedAt,
        total_salary: totalSalary,
        breakdown: breakdown as unknown as Record<string, unknown>,
        entries: entriesRes.data || [],
        allowances: allowancesRes.data || [],
        rates: ratesRes.data || [],
        period_info: periodRes.data || null,
        profile_info: profileRes.data || null,
      } as Record<string, unknown>,
      { onConflict: 'user_id,period_id' }
    );
  }, [userId, periodId]);

  const isPublished = record?.status === 'published';

  return { record, loading, saveDraft, publish, isPublished };
}

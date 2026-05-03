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
    const [entriesRes, allowancesRes, ratesRes, periodRes, profileRes] = await Promise.all([
      supabase.from('salary_entries').select('*').eq('user_id', userId).eq('period_id', periodId)
        .order('entry_date').order('sort_order'),
      supabase.from('employee_allowances').select('*').eq('user_id', userId).eq('period_id', periodId),
      supabase.from('special_day_rates').select('*').eq('period_id', periodId),
      supabase.from('working_periods').select('id, start_date, end_date, off_days').eq('id', periodId).single(),
      supabase.from('profiles')
        .select('shift_type, base_salary, hourly_rate, default_clock_in, default_clock_out')
        .eq('user_id', userId).single(),
    ]);

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

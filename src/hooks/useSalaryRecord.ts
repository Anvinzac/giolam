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
      .upsert([
        {
          user_id: userId,
          period_id: periodId,
          total_salary: totalSalary,
          salary_breakdown: breakdown as unknown as Record<string, unknown>,
          status: 'draft',
        },
      ], { onConflict: 'user_id,period_id' }
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
    const { data } = await supabase
      .from('salary_records')
      .upsert([
        {
          user_id: userId,
          period_id: periodId,
          total_salary: totalSalary,
          salary_breakdown: breakdown as unknown as Record<string, unknown>,
          status: 'published',
          published_at: new Date().toISOString(),
        },
      ], { onConflict: 'user_id,period_id' }
      )
      .select()
      .single();
    if (data) setRecord(data as unknown as SalaryRecord);
  }, [userId, periodId]);

  const isPublished = record?.status === 'published';

  return { record, loading, saveDraft, publish, isPublished };
}

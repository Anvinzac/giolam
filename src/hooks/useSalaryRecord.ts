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

    // Step 1: make sure a salary_records row exists so the snapshot's FK has
    // a target — but DO NOT touch its total_salary, salary_breakdown, or
    // status yet. On a republish, the admin dashboard reads salary_records;
    // overwriting those fields here would surface the new total before the
    // snapshot lands, and on snapshot failure leave admin ahead of employee.
    let recordId = record?.id;
    if (!recordId) {
      const { data: existing } = await supabase
        .from('salary_records')
        .select('id')
        .eq('user_id', userId)
        .eq('period_id', periodId)
        .maybeSingle();
      if (existing) {
        recordId = (existing as { id: string }).id;
      } else {
        const { data: created, error: insertErr } = await supabase
          .from('salary_records')
          .insert({ user_id: userId, period_id: periodId, total_salary: 0, status: 'draft' })
          .select('id')
          .single();
        if (insertErr || !created) {
          throw new Error(`Failed to create salary record: ${insertErr?.message || 'unknown error'}`);
        }
        recordId = (created as { id: string }).id;
      }
    }

    // Step 2: freeze the snapshot. If anything below fails, salary_records
    // is still draft (or whatever its prior status was) — the admin dashboard
    // will not surface a published total the employee can't actually see.
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
        const { error: seedErr } = await supabase.from('salary_entries').insert(
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
        if (seedErr) throw new Error(`Failed to seed special-day rows: ${seedErr.message}`);
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

    const { error: snapErr } = await supabase.from('salary_published_snapshots').upsert(
      {
        salary_record_id: recordId,
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
    if (snapErr) {
      throw new Error(`Failed to write snapshot: ${snapErr.message}`);
    }

    // Step 3: snapshot is committed — flip salary_records to the new total
    // and published status atomically. Both surfaces (admin dashboard +
    // employee snapshot) now show the same number. If this UPDATE fails,
    // the employee already sees the new snapshot but admin dashboard shows
    // the prior total — strictly safer than the reverse.
    const { data: pubRec, error: pubErr } = await supabase
      .from('salary_records')
      .update({
        total_salary: totalSalary,
        salary_breakdown: breakdown,
        status: 'published',
        published_at: publishedAt,
      } as never)
      .eq('user_id', userId)
      .eq('period_id', periodId)
      .select()
      .single();
    if (pubErr) {
      throw new Error(`Snapshot saved but failed to mark published: ${pubErr.message}`);
    }
    setRecord(pubRec as unknown as SalaryRecord);
  }, [userId, periodId, record?.id]);

  const isPublished = record?.status === 'published';

  return { record, loading, saveDraft, publish, isPublished };
}

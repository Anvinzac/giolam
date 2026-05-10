import { supabase } from '@/integrations/supabase/client';

interface ArchivePeriodResult {
  success: boolean;
  newPeriodId?: string;
  error?: string;
}

/**
 * Archive the current period and create a new one with copied settings.
 *
 * - Marks the current period as archived
 * - Creates a new period starting the day after the current period ends
 * - Copies special_day_rates and off_days pattern
 * - Returns the new period ID on success
 */
export async function archiveAndCreateNextPeriod(
  currentPeriodId: string,
  currentEndDate: string,
  currentOffDays: string[],
  newEndDate: string,
): Promise<ArchivePeriodResult> {
  try {
    // 1. Mark current period as archived
    const { error: archiveErr } = await supabase
      .from('working_periods')
      .update({ is_archived: true })
      .eq('id', currentPeriodId);

    if (archiveErr) {
      return { success: false, error: `Không thể lưu trữ kỳ cũ: ${archiveErr.message}` };
    }

    // 2. Calculate new period start date (day after current end)
    const startDateObj = new Date(currentEndDate + 'T00:00:00');
    startDateObj.setDate(startDateObj.getDate() + 1);
    const newStartDate = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`;

    // 3. Create new period
    const { data: newPeriod, error: newPeriodErr } = await supabase
      .from('working_periods')
      .insert({
        start_date: newStartDate,
        end_date: newEndDate,
        off_days: currentOffDays,
      })
      .select()
      .single();

    if (newPeriodErr || !newPeriod) {
      return { success: false, error: `Không thể tạo kỳ mới: ${newPeriodErr?.message || 'unknown error'}` };
    }

    const newPeriodId = (newPeriod as { id: string }).id;

    // 4. Copy special_day_rates from old period to new period
    // First, get all rates from the old period
    const { data: oldRates, error: ratesFetchErr } = await supabase
      .from('special_day_rates')
      .select('*')
      .eq('period_id', currentPeriodId);

    if (ratesFetchErr) {
      console.warn('Could not copy special day rates:', ratesFetchErr);
      // Don't fail the whole operation if rate copy fails
    } else if (oldRates && oldRates.length > 0) {
      // Calculate the date offset between old and new periods
      const oldStart = new Date(currentEndDate + 'T00:00:00');
      oldStart.setDate(oldStart.getDate() - 1); // rough estimate; we'll map by relative position
      const newStart = new Date(newStartDate + 'T00:00:00');

      const newRates = oldRates.map(rate => {
        const oldDate = new Date((rate as any).special_date + 'T00:00:00');
        const daysDiff = Math.floor((oldDate.getTime() - new Date(currentEndDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
        const newDate = new Date(newStart.getTime() + daysDiff * 24 * 60 * 60 * 1000);
        const newDateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;

        return {
          period_id: newPeriodId,
          special_date: newDateStr,
          day_type: (rate as any).day_type,
          description_vi: (rate as any).description_vi,
          rate_percent: (rate as any).rate_percent,
          sort_order: (rate as any).sort_order,
        };
      });

      const { error: ratesInsertErr } = await supabase
        .from('special_day_rates')
        .insert(newRates);

      if (ratesInsertErr) {
        console.warn('Could not insert copied special day rates:', ratesInsertErr);
      }
    }

    return { success: true, newPeriodId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Lỗi không xác định',
    };
  }
}

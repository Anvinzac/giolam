import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SalaryEntry, EmployeeAllowance, SpecialDayRate } from '@/types/salary';
import {
  calcDailyBase,
  calcHoursFromTimes,
  roundToThousand,
  computeTotalSalaryTypeA,
  computeTotalSalaryTypeB,
  computeTotalSalaryTypeC,
  computeTotalSalaryTypeD,
  computeTotalSalaryTypeE,
} from '@/lib/salaryCalculations';

/**
 * Fixed Rate correction table for Aug-2026 lunar-date mix-up.
 * 
 * Shows each employee's old salary (with wrong rates) vs new salary (with corrected rates)
 * and the difference (positive = need to pay more, negative = need to take back).
 * 
 * Correct rates:
 *   Aug 11: 0% (normal day)
 *   Aug 12: 15% (Ngày chay - day before new moon)
 *   Aug 13: 40% (Mùng 1 - new moon)
 * 
 * Wrong rates (that were applied):
 *   Aug 11: 15% (should be 0%)
 *   Aug 12: 40% (should be 15%)
 *   Aug 13: 0% (should be 40%)
 */

interface FixedRateEmployee {
  user_id: string;
  full_name: string;
  username?: string | null;
  shift_type: string;
  base_salary: number;
  hourly_rate: number;
  default_clock_in: string | null;
  default_clock_out: string | null;
}

interface FixedRateTableProps {
  employees: FixedRateEmployee[];
  periodId: string | null;
  periodStart: string;
  periodEnd: string;
}

interface CorrectionRow {
  user_id: string;
  fullName: string;
  username?: string | null;
  shiftType: string;
  oldSalary: number;
  newSalary: number;
  difference: number;
}

const fmtVnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;
const fmtSigned = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtVnd(Math.abs(v))}`;
const valueClass = (v: number) =>
  v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-muted-foreground/40';

/**
 * Get the correct rate for a date in August 2026.
 * Correct rates: Aug 12 = 15%, Aug 13 = 40%, all others = 0% (for lunar days)
 */
function getCorrectRate(date: string): number {
  if (date === '2026-08-12') return 15;
  if (date === '2026-08-13') return 40;
  return 0;
}

/**
 * Get the wrong rate that was applied (based on the buggy lunar calculation).
 * Wrong rates: Aug 11 = 15%, Aug 12 = 40%, Aug 13 = 0%
 */
function getWrongRate(date: string): number {
  if (date === '2026-08-11') return 15;
  if (date === '2026-08-12') return 40;
  return 0;
}

/**
 * Calculate the allowance premium for a single entry at a given rate.
 */
function calcEntryPremium(
  entry: SalaryEntry,
  emp: FixedRateEmployee,
  ratePercent: number,
): number {
  if (ratePercent <= 0) return 0;
  if (entry.is_day_off) return 0;
  if (entry.allowance_rate_override !== null && entry.allowance_rate_override !== undefined) return 0;

  const dailyBase = calcDailyBase(emp.base_salary);

  if (emp.shift_type === 'basic' || emp.shift_type === 'daily') {
    if (entry.sort_order > 0) {
      const extraWage = entry.total_hours ? roundToThousand(entry.total_hours * emp.hourly_rate) : 0;
      return roundToThousand((extraWage * ratePercent) / 100);
    }
    return roundToThousand((dailyBase * ratePercent) / 100);
  }

  if (emp.shift_type === 'overtime') {
    const baseIn = entry.clock_in || emp.default_clock_in || '17:00';
    const clockHours = entry.clock_out && baseIn && baseIn !== entry.clock_out
      ? calcHoursFromTimes(baseIn, entry.clock_out)
      : null;
    const hours = clockHours ?? entry.total_hours ?? 0;
    const extraWage = roundToThousand(hours * emp.hourly_rate);
    const allowanceBase = entry.sort_order > 0 ? extraWage : dailyBase + extraWage;
    return roundToThousand((allowanceBase * ratePercent) / 100);
  }

  if (emp.shift_type === 'notice_only') {
    const hours = entry.total_hours ?? calcHoursFromTimes(entry.clock_in, entry.clock_out) ?? 0;
    const baseWage = roundToThousand(hours * emp.hourly_rate);
    return roundToThousand((baseWage * ratePercent) / 100);
  }

  return 0;
}

/**
 * Calculate Type D lunar bonus for Aug 13: +8.000đ/h (35k - 27k)
 */
function calcTypeDBonusAug13(entries: SalaryEntry[]): number {
  const LUNAR_BONUS_PER_HOUR = 8000;
  let sum = 0;
  for (const e of entries) {
    if (e.entry_date !== '2026-08-13') continue;
    const hours = e.total_hours ?? calcHoursFromTimes(e.clock_in, e.clock_out) ?? 0;
    sum += roundToThousand(hours * LUNAR_BONUS_PER_HOUR);
  }
  return sum;
}

export default function FixedRateTable({
  employees,
  periodId,
  periodStart,
  periodEnd,
}: FixedRateTableProps) {
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [allowances, setAllowances] = useState<EmployeeAllowance[]>([]);
  const [rates, setRates] = useState<SpecialDayRate[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if period covers Aug 11-13
  const coversCorrectionDates = periodStart <= '2026-08-13' && periodEnd >= '2026-08-11';

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!periodId || employees.length === 0 || !coversCorrectionDates) {
        if (isMounted) { setEntries([]); setAllowances([]); setRates([]); setLoading(false); }
        return;
      }
      setLoading(true);
      const [entriesRes, allowancesRes, ratesRes] = await Promise.all([
        supabase.from('salary_entries').select('*').eq('period_id', periodId),
        supabase.from('employee_allowances').select('*').eq('period_id', periodId),
        supabase.from('special_day_rates').select('*').eq('period_id', periodId),
      ]);
      if (!isMounted) return;
      setEntries((entriesRes.data || []) as SalaryEntry[]);
      setAllowances((allowancesRes.data || []) as EmployeeAllowance[]);
      setRates((ratesRes.data || []) as SpecialDayRate[]);
      setLoading(false);
    };
    fetchData();
    return () => { isMounted = false; };
  }, [periodId, employees, coversCorrectionDates]);

  const rows = useMemo<CorrectionRow[]>(() => {
    if (!coversCorrectionDates) return [];

    const out: CorrectionRow[] = [];

    for (const emp of employees) {
      const empEntries = entries.filter(e => e.user_id === emp.user_id);
      const empAllowances = allowances.filter(a => a.user_id === emp.user_id);

      // Calculate old salary (with wrong rates applied)
      // We need to simulate what the salary would be with wrong rates
      // The wrong rates were: Aug 11 = 15%, Aug 12 = 40%, Aug 13 = 0%
      // But the database has correct rates, so we need to calculate the difference

      // Calculate the premium difference for Aug 11, 12, 13
      let premiumDiff = 0;
      const isTypeD = emp.shift_type === 'lunar_rate';

      // Type D uses a flat hourly rate (27k normal, 35k on lunar days) —
      // no percentage-based allowance applies, so Aug 11 and Aug 12 corrections are 0.
      // Only Aug 13 (new moon) matters for Type D: +8.000đ/h (35k − 27k).
      if (!isTypeD) {
        // Aug 11: wrong = 15%, correct = 0% → take back 15%
        const aug11Entries = empEntries.filter(e => e.entry_date === '2026-08-11');
        for (const e of aug11Entries) {
          premiumDiff -= calcEntryPremium(e, emp, 15);
        }

        // Aug 12: wrong = 40%, correct = 15% → take back 25%
        const aug12Entries = empEntries.filter(e => e.entry_date === '2026-08-12');
        for (const e of aug12Entries) {
          premiumDiff -= calcEntryPremium(e, emp, 25); // 40% - 15% = 25% to take back
        }
      }

      // Aug 13: wrong = 0%, correct = depends on type
      const aug13Entries = empEntries.filter(e => e.entry_date === '2026-08-13');
      if (isTypeD) {
        // Type D gets +8.000đ/h lunar bonus (35k flat rate instead of 27k)
        premiumDiff += calcTypeDBonusAug13(aug13Entries);
      } else {
        for (const e of aug13Entries) {
          premiumDiff += calcEntryPremium(e, emp, 40);
        }
      }

      // Calculate current salary using the compute functions
      let currentSalary = 0;
      switch (emp.shift_type) {
        case 'basic':
          currentSalary = computeTotalSalaryTypeA(empEntries, empAllowances, emp.base_salary, emp.hourly_rate, rates, periodStart, periodEnd).total;
          break;
        case 'daily':
          currentSalary = computeTotalSalaryTypeE(empEntries, empAllowances, emp.base_salary, emp.hourly_rate, rates, periodEnd).total;
          break;
        case 'overtime':
          currentSalary = computeTotalSalaryTypeB(empEntries, empAllowances, emp.base_salary, emp.hourly_rate, rates, emp.default_clock_in, [], periodStart, periodEnd).total;
          break;
        case 'notice_only':
          currentSalary = computeTotalSalaryTypeC(empEntries, empAllowances, emp.hourly_rate, rates).total;
          break;
        case 'lunar_rate':
          currentSalary = computeTotalSalaryTypeD(empEntries, empAllowances, 27000, 35000, rates).total;
          break;
      }

      // New salary = current + difference
      const newSalary = currentSalary + premiumDiff;

      // Only include if there's a difference or the employee worked on correction dates
      const hasCorrectionDayEntries = empEntries.some(e =>
        e.entry_date === '2026-08-11' || e.entry_date === '2026-08-12' || e.entry_date === '2026-08-13'
      );
      if (premiumDiff !== 0 || hasCorrectionDayEntries) {
        out.push({
          user_id: emp.user_id,
          fullName: emp.full_name,
          username: emp.username,
          shiftType: emp.shift_type,
          oldSalary: currentSalary,
          newSalary,
          difference: premiumDiff,
        });
      }
    }

    // Sort by absolute difference descending
    out.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    return out;
  }, [entries, allowances, rates, employees, periodStart, periodEnd, coversCorrectionDates]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        oldSalary: acc.oldSalary + r.oldSalary,
        newSalary: acc.newSalary + r.newSalary,
        difference: acc.difference + r.difference,
      }),
      { oldSalary: 0, newSalary: 0, difference: 0 }
    );
  }, [rows]);

  if (!coversCorrectionDates) {
    return (
      <div className="glass-card p-6 text-center text-muted-foreground text-sm">
        Kỳ này không chứa các ngày 11–13/08 cần điều chỉnh
      </div>
    );
  }

  if (loading) {
    return <div className="glass-card p-6 text-center text-muted-foreground text-sm">Đang tải…</div>;
  }

  if (rows.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-muted-foreground text-sm">
        Không có nhân viên nào cần điều chỉnh
      </div>
    );
  }

  return (
    <div className="glass-card p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Fixed Rate — Điều chỉnh lương 11–13/08/2026
        </h3>
        <span className="text-[11px] text-muted-foreground">
          Sai: 11/08=15%, 12/08=40%, 13/08=0% · Đúng: 11/08=0%, 12/08=15%, 13/08=40%
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/40">
              <th className="text-left py-1.5 pr-2 font-semibold">Nhân viên</th>
              <th className="text-right py-1.5 pr-2 font-semibold">Lương cũ</th>
              <th className="text-right py-1.5 pr-2 font-semibold">Lương mới</th>
              <th className="text-right py-1.5 font-semibold">Chênh lệch</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.user_id} className="border-b border-border/20">
                <td className="py-1.5 pr-2 text-foreground">
                  {r.fullName}
                  {r.shiftType === 'lunar_rate' && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground">Loại D</span>
                  )}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-muted-foreground">
                  {fmtVnd(r.oldSalary)}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-foreground">
                  {fmtVnd(r.newSalary)}
                </td>
                <td className={`py-1.5 text-right tabular-nums font-semibold ${valueClass(r.difference)}`}>
                  {fmtSigned(r.difference)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border/40">
              <td className="pt-2 pr-2 text-right text-[12px] text-muted-foreground font-medium">Tổng cộng</td>
              <td className="pt-2 pr-2 text-right text-[12px] tabular-nums text-muted-foreground">
                {fmtVnd(totals.oldSalary)}
              </td>
              <td className="pt-2 pr-2 text-right text-[12px] tabular-nums font-semibold">
                {fmtVnd(totals.newSalary)}
              </td>
              <td className={`pt-2 text-right text-[13px] font-bold tabular-nums ${valueClass(totals.difference)}`}>
                {fmtSigned(totals.difference)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/20">
        <span className="text-rose-400">−</span> = cần trừ lại (nhân viên nhận thừa) ·{' '}
        <span className="text-emerald-400">+</span> = cần trả thêm (nhân viên nhận thiếu) ·{' '}
        Loại D tính theo lương giờ (35.000đ/h ngày 13/08)
      </p>
    </div>
  );
}

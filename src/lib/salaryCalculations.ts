import {
  SpecialDayRate,
  SalaryEntry,
  EmployeeAllowance,
  SalaryBreakdown,
  DayType,
  DEFAULT_RATES,
  DAY_TYPE_LABELS,
} from '@/types/salary';
import { isFullMoon, isNewMoon, isDayBeforeFullMoon, isDayBeforeNewMoon } from './lunarUtils';

/** Round to nearest 1000 VND */
export function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000;
}

/** Type A: baseSalary / 28, rounded to 1000 */
export function calcDailyBase(baseSalary: number): number {
  return roundToThousand(baseSalary / 28);
}

/** dailyBase × ratePercent / 100 */
export function calcAllowance(dailyBase: number, ratePercent: number): number {
  return roundToThousand(dailyBase * ratePercent / 100);
}

/** Negative deduction: dailyBase × offPercent / 100 */
export function calcDayOffDeduction(dailyBase: number, offPercent: number): number {
  return roundToThousand(dailyBase * offPercent / 100);
}

/** Calculate decimal hours between two HH:MM times */
export function calcHoursFromTimes(clockIn: string | null, clockOut: string | null): number | null {
  if (!clockIn || !clockOut) return null;
  const [h1, m1] = clockIn.split(':').map(Number);
  const [h2, m2] = clockOut.split(':').map(Number);
  const mins1 = h1 * 60 + m1;
  const mins2 = h2 * 60 + m2;
  const diff = mins2 - mins1;
  if (diff <= 0) return null;
  return Math.round(diff / 30) * 0.5; // round to nearest 0.5h
}

/** hours × hourlyRate */
export function calcExtraWage(hours: number, hourlyRate: number): number {
  return roundToThousand(hours * hourlyRate);
}

/** Get the DayType for a given date, or null for normal days */
export function getSpecialDayType(date: Date): DayType | null {
  // Use a stable mid-day date for checking properties to avoid TZ edge cases
  const checkDate = new Date(date);
  checkDate.setHours(12, 0, 0, 0);

  // Lunar dates take priority
  if (isFullMoon(checkDate)) return 'full_moon';
  if (isNewMoon(checkDate)) return 'new_moon';
  if (isDayBeforeFullMoon(checkDate)) return 'day_before_full_moon';
  if (isDayBeforeNewMoon(checkDate)) return 'day_before_new_moon';
  
  const day = checkDate.getDay();
  if (day === 6) return 'saturday';
  if (day === 0) return 'sunday';
  return null;
}

/** Generate Vietnamese description like "Thứ Bảy + 15%" */
export function getVietnameseDescription(dayType: DayType, ratePercent: number): string {
  const label = DAY_TYPE_LABELS[dayType] || dayType;
  return `${label} + ${ratePercent}%`;
}

/** Generate default special days for a period date range */
export function generateDefaultSpecialDays(
  startDate: string,
  endDate: string,
  periodId: string,
  offDays: string[] = []
): SpecialDayRate[] {
  const rates: SpecialDayRate[] = [];
  const start = new Date(startDate + 'T12:00:00'); // Use mid-day to seed
  const end = new Date(endDate + 'T12:00:00');
  const seen = new Map<string, SpecialDayRate>(); 
  const offDaySet = new Set(offDays);
  let sortIdx = 0;

  let d = new Date(start);
  while (d <= end) {
    const dateStr = toISODateString(d);
    if (offDaySet.has(dateStr)) {
      seen.set(dateStr, {
        period_id: periodId,
        special_date: dateStr,
        day_type: 'public_holiday',
        description_vi: 'Quán nghỉ',
        rate_percent: DEFAULT_RATES.public_holiday,
        sort_order: sortIdx++,
      });
      d.setDate(d.getDate() + 1);
      d.setHours(12, 0, 0, 0); // Keep at mid-day
      continue;
    }

    // Hardcoded special day: Phục Sinh (April 3rd) at 30%
    if (d.getMonth() === 3 && d.getDate() === 3) {
      seen.set(dateStr, {
        period_id: periodId,
        special_date: dateStr,
        day_type: 'custom',
        description_vi: 'Phục Sinh + 30%',
        rate_percent: 30,
        sort_order: sortIdx++,
      });
      d.setDate(d.getDate() + 1);
      d.setHours(12, 0, 0, 0);
      continue;
    }

    const dayType = getSpecialDayType(d);
    
    if (dayType) {
      const rate = DEFAULT_RATES[dayType];
      const existing = seen.get(dateStr);

      // Keep higher rate if multiple (e.g. Sunday + Holiday)
      if (!existing || existing.rate_percent < rate) {
        const entry: SpecialDayRate = {
          period_id: periodId,
          special_date: dateStr,
          day_type: dayType,
          description_vi: getVietnameseDescription(dayType, rate),
          rate_percent: rate,
          sort_order: sortIdx++,
        };
        seen.set(dateStr, entry);
      }
    }
    
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0); // Keep at mid-day
  }

  return Array.from(seen.values()).sort(
    (a, b) => a.special_date.localeCompare(b.special_date)
  );
}

/** Look up the rate for a given entry date from the rates array */
export function getRateForDate(
  entryDate: string,
  rates: SpecialDayRate[],
  overrideRate: number | null
): number {
  if (overrideRate !== null && overrideRate !== undefined) return overrideRate;
  const found = rates.find(r => r.special_date === entryDate);
  return found?.rate_percent ?? 0;
}

export function computeTotalSalaryTypeA(
  entries: SalaryEntry[],
  allowances: EmployeeAllowance[],
  baseSalary: number,
  rates: SpecialDayRate[]
): SalaryBreakdown {
  const dailyBase = calcDailyBase(baseSalary);
  let totalDailyWages = 0;
  let totalAllowancesFromRates = 0;
  let totalDeductions = 0;
  let offDays = 0;

  for (const e of entries) {
    const rate = getRateForDate(e.entry_date, rates, e.allowance_rate_override);
    const allowanceAmt = roundToThousand((dailyBase * rate) / 100);
    let rowTotal = dailyBase + allowanceAmt;
    let deduction = 0;
    if (e.is_day_off) {
      if (e.off_percent > 0) {
        deduction = calcDayOffDeduction(dailyBase, e.off_percent);
        rowTotal = -deduction;
      } else {
        // Full day off, 0 logic or deduction
        rowTotal = 0;
      }
      offDays++;
    }

    // Accumulate actual row calculations (if it matches Type A)
    // Wait, Type A is simpler:
    // allowance = roundToThousand(dailyBase * rate / 100)
    // deduction = e.is_day_off && e.off_percent > 0 ? calcDayOffDeduction(...) : 0;
    totalAllowancesFromRates += allowanceAmt;
    if (e.is_day_off && e.off_percent > 0) {
      totalDeductions += deduction;
    }
  }

  // Type A total: baseSalary + special day premiums - deductions
  // (baseSalary already covers all regular workdays; entries only track special days)
  totalDailyWages = baseSalary + totalAllowancesFromRates - totalDeductions;

  // Calculate gui_xe automatically: (28 - off_days) * 10000
  const guiXeAmount = (28 - offDays) * 10000;

  const allowanceItems = allowances.map(a => ({
    key: a.allowance_key,
    label: a.label,
    amount: a.allowance_key === 'gui_xe' ? guiXeAmount : a.amount,
    enabled: a.is_enabled
  }));

  const enabledAllowancesSum = allowances.reduce((sum, a) => {
    if (a.allowance_key === 'gui_xe') return sum + (a.is_enabled ? guiXeAmount : 0);
    return a.is_enabled ? sum + a.amount : sum;
  }, 0);

  const total = totalDailyWages + enabledAllowancesSum;

  return { base_salary: baseSalary, daily_base: dailyBase, total_daily_wages: totalDailyWages, total_allowances_from_rates: totalAllowancesFromRates, total_deductions: totalDeductions, allowances: allowanceItems, total };
}

export function computeTotalSalaryTypeB(
  entries: SalaryEntry[],
  allowances: EmployeeAllowance[],
  baseSalary: number,
  hourlyRate: number,
  rates: SpecialDayRate[],
  globalClockIn: string
): SalaryBreakdown {
  const dailyBase = calcDailyBase(baseSalary);
  let totalDailyWages = 0;
  let totalAllowancesFromRates = 0;
  let offDays = 0;

  for (const e of entries) {
    const rate = getRateForDate(e.entry_date, rates, e.allowance_rate_override);
    const allowance = roundToThousand(dailyBase * rate / 100);
    const hours = e.total_hours ?? calcHoursFromTimes(e.clock_in || globalClockIn, e.clock_out) ?? 0;
    const extraWage = roundToThousand(hours * hourlyRate);
    const rowTotal = e.is_day_off ? 0 : dailyBase + allowance + extraWage;

    totalDailyWages += rowTotal;
    totalAllowancesFromRates += allowance;

    if (e.is_day_off) {
      offDays++;
    }
  }

  // Calculate gui_xe automatically: (28 - off_days) * 10000
  const guiXeAmount = (28 - offDays) * 10000;

  const allowanceItems = allowances.map(a => ({
    key: a.allowance_key,
    label: a.label,
    amount: a.allowance_key === 'gui_xe' ? guiXeAmount : a.amount,
    enabled: a.is_enabled
  }));

  const enabledAllowancesSum = allowances.reduce((sum, a) => {
    if (a.allowance_key === 'gui_xe') return sum + (a.is_enabled ? guiXeAmount : 0);
    return a.is_enabled ? sum + a.amount : sum;
  }, 0);

  const total = totalDailyWages + enabledAllowancesSum;

  return { base_salary: baseSalary, daily_base: dailyBase, total_daily_wages: totalDailyWages, total_allowances_from_rates: totalAllowancesFromRates, total_deductions: 0, allowances: allowanceItems, total };
}

export function computeTotalSalaryTypeC(
  entries: SalaryEntry[],
  allowances: EmployeeAllowance[],
  hourlyRate: number,
  rates: SpecialDayRate[]
): SalaryBreakdown {
  let totalDailyWages = 0;
  let totalAllowancesFromRates = 0;
  let workingDays = 0;

  for (const e of entries) {
    const rate = getRateForDate(e.entry_date, rates, e.allowance_rate_override);
    const hours = e.total_hours ?? calcHoursFromTimes(e.clock_in, e.clock_out) ?? 0;
    const baseWage = roundToThousand(hours * hourlyRate);
    const allowanceAmt = roundToThousand((baseWage * rate) / 100);
    const rowTotal = e.is_day_off ? 0 : baseWage + allowanceAmt;

    totalDailyWages += rowTotal;
    totalAllowancesFromRates += allowanceAmt;

    // Count working days (non-day-off entries with clock times)
    if (!e.is_day_off && (e.clock_in || e.clock_out)) {
      workingDays++;
    }
  }

  // Calculate gui_xe automatically: 10000 * working days
  const guiXeAmount = workingDays * 10000;

  const allowanceItems = allowances.map(a => ({
    key: a.allowance_key,
    label: a.label,
    amount: a.allowance_key === 'gui_xe' ? guiXeAmount : a.amount,
    enabled: a.is_enabled
  }));

  const enabledAllowancesSum = allowances.reduce((sum, a) => {
    if (a.allowance_key === 'gui_xe') return sum + (a.is_enabled ? guiXeAmount : 0);
    return a.is_enabled ? sum + a.amount : sum;
  }, 0);

  const total = totalDailyWages + enabledAllowancesSum;

  return { base_salary: 0, daily_base: 0, total_daily_wages: totalDailyWages, total_allowances_from_rates: totalAllowancesFromRates, total_deductions: 0, allowances: allowanceItems, total };
}

/** Format a number as VND with dot separators */
export function formatVND(amount: number): string {
  if (amount === 0) return '0 đ';
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNeg ? '-' : ''}${formatted} đ`;
}

/** Convert Date to "YYYY-MM-DD" in local timezone */
export function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Vietnamese day names */
export const VIET_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Format date as "DD/MM" */
export function formatDateViet(dateStr: string): string {
  if (!dateStr) return '';
  // Ensure we parse as local date to avoid timezone shifts
  const d = new Date(dateStr + 'T00:00:00');
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}/${mm}`;
}

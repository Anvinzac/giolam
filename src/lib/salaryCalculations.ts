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
  // Lunar dates take priority
  if (isFullMoon(date)) return 'full_moon';
  if (isNewMoon(date)) return 'new_moon';
  if (isDayBeforeFullMoon(date)) return 'day_before_full_moon';
  if (isDayBeforeNewMoon(date)) return 'day_before_new_moon';
  const day = date.getDay();
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
  periodId: string
): SpecialDayRate[] {
  const rates: SpecialDayRate[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const seen = new Map<string, SpecialDayRate>(); // dateStr -> best rate
  let sortIdx = 0;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayType = getSpecialDayType(d);
    if (!dayType) continue;

    const dateStr = d.toISOString().split('T')[0];
    const rate = DEFAULT_RATES[dayType];
    const existing = seen.get(dateStr);

    // Keep the higher rate if date overlaps (e.g. Sunday + New Moon)
    if (existing && existing.rate_percent >= rate) continue;

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

/** Compute total salary from entries + allowances */
export function computeTotalSalary(
  entries: SalaryEntry[],
  allowances: EmployeeAllowance[],
  baseSalary: number
): SalaryBreakdown {
  const dailyBase = calcDailyBase(baseSalary);

  let totalDailyWages = 0;
  let totalAllowancesFromRates = 0;
  let totalDeductions = 0;

  for (const e of entries) {
    totalDailyWages += e.total_daily_wage;
    totalAllowancesFromRates += e.allowance_amount;
    if (e.is_day_off && e.off_percent > 0) {
      totalDeductions += calcDayOffDeduction(dailyBase, e.off_percent);
    }
  }

  const allowanceItems = allowances.map(a => ({
    key: a.allowance_key,
    label: a.label,
    amount: a.amount,
    enabled: a.is_enabled,
  }));

  const enabledAllowancesSum = allowances
    .filter(a => a.is_enabled)
    .reduce((sum, a) => sum + a.amount, 0);

  const total = totalDailyWages + enabledAllowancesSum;

  return {
    base_salary: baseSalary,
    daily_base: dailyBase,
    total_daily_wages: totalDailyWages,
    total_allowances_from_rates: totalAllowancesFromRates,
    total_deductions: totalDeductions,
    allowances: allowanceItems,
    total,
  };
}

/** Format a number as VND with dot separators */
export function formatVND(amount: number): string {
  if (amount === 0) return '0 đ';
  const isNeg = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${isNeg ? '-' : ''}${formatted} đ`;
}

/** Vietnamese day names */
export const VIET_DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Format date as "DD/MM (T2)" */
export function formatDateViet(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dayName = VIET_DAYS[d.getDay()];
  return `${dd}/${mm} (${dayName})`;
}

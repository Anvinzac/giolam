// Per-assignment report frequency helpers.
//
// employee_ingredients.report_weekdays stores the weekdays (JS getDay:
// 0=Sun..6=Sat) on which an ingredient must be reported. NULL/empty
// means "every day".

export const WEEKDAYS: { value: number; short: string; long: string }[] = [
  { value: 1, short: 'T2', long: 'Thứ Hai' },
  { value: 2, short: 'T3', long: 'Thứ Ba' },
  { value: 3, short: 'T4', long: 'Thứ Tư' },
  { value: 4, short: 'T5', long: 'Thứ Năm' },
  { value: 5, short: 'T6', long: 'Thứ Sáu' },
  { value: 6, short: 'T7', long: 'Thứ Bảy' },
  { value: 0, short: 'CN', long: 'Chủ Nhật' },
];

/** Is this assignment due on the given date (defaults to today)? */
export function isDueToday(
  reportWeekdays: number[] | null | undefined,
  date: Date = new Date(),
): boolean {
  if (!reportWeekdays || reportWeekdays.length === 0) return true; // daily
  return reportWeekdays.includes(date.getDay());
}

/** Short human label for a frequency, e.g. "Hàng ngày" or "T2, T5". */
export function frequencyLabel(reportWeekdays: number[] | null | undefined): string {
  if (!reportWeekdays || reportWeekdays.length === 0) return 'Hàng ngày';
  if (reportWeekdays.length === 7) return 'Hàng ngày';
  // Order chips Mon→Sun for readability regardless of stored order.
  const ordered = WEEKDAYS.filter(w => reportWeekdays.includes(w.value));
  return ordered.map(w => w.short).join(', ');
}

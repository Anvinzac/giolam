import { SalaryEntry, SalaryPage } from '@/types/salary';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const DAYS_PER_PAGE = 10;

/**
 * Split entries into ~10-day pages for balance across the month.
 * Typical 30-day payroll periods land as 3×10. Slightly longer leftovers
 * (e.g. 31 → 10+10+11) stay on one final page, but a near-full leftover
 * (e.g. 29 → leftover 19) must become its own pair of unequal pages
 * (10+9) instead of folding into a 19-day monster page.
 */
export function splitIntoPages(
  startDate: string,
  endDate: string,
  entries: SalaryEntry[]
): SalaryPage[] {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const pages: SalaryPage[] = [];

  // Core working period dates
  const dateSet = new Set<string>();
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dateSet.add(formatLocalDate(d));
  }

  // Also include dates for existing entries outside the period (individual bonus days)
  for (const e of entries) {
    if (e.entry_date) {
      dateSet.add(e.entry_date);
    }
  }

  // Sort all included dates chronologically
  const allDates = Array.from(dateSet).sort();

  if (allDates.length === 0) return pages;

  let i = 0;
  while (i < allDates.length) {
    const remaining = allDates.length - i;
    // If the remaining days are 14 or less, we fold them into this final page.
    const take = remaining <= 14 ? remaining : DAYS_PER_PAGE;
    const pageDates = allDates.slice(i, i + take);
    
    pages.push({
      pageIndex: pages.length,
      startDate: pageDates[0],
      endDate: pageDates[pageDates.length - 1],
      pageDates,
      entries: getEntriesForDates(pageDates, entries),
    });
    
    i += take;
  }

  return pages;
}

function getEntriesForDates(dates: string[], entries: SalaryEntry[]): SalaryEntry[] {
  const dateSet = new Set(dates);
  return entries
    .filter(e => dateSet.has(e.entry_date))
    .sort((a, b) => {
      const dateComp = a.entry_date.localeCompare(b.entry_date);
      return dateComp !== 0 ? dateComp : a.sort_order - b.sort_order;
    });
}

/** Generate all dates in a range as YYYY-MM-DD strings */
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(formatLocalDate(d));
  }
  return dates;
}

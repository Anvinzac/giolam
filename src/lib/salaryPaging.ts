import { SalaryEntry, SalaryPage } from '@/types/salary';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Split entries into fixed 10-day pages for balance across the month.
 * For a 30-day month: 3 pages of 10 days each
 */
export function splitIntoPages(
  startDate: string,
  endDate: string,
  entries: SalaryEntry[]
): SalaryPage[] {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const pages: SalaryPage[] = [];

  // Generate all dates in period
  const allDates: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    allDates.push(formatLocalDate(d));
  }

  if (allDates.length === 0) return pages;

  // Split into 10-day pages
  const DAYS_PER_PAGE = 10;
  for (let i = 0; i < allDates.length; i += DAYS_PER_PAGE) {
    const pageDates = allDates.slice(i, i + DAYS_PER_PAGE);
    pages.push({
      pageIndex: pages.length,
      startDate: pageDates[0],
      endDate: pageDates[pageDates.length - 1],
      entries: getEntriesForDates(pageDates, entries),
    });
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

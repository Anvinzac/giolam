import { SalaryEntry, SalaryPage } from '@/types/salary';

/**
 * Split entries into pages following these rules:
 * - If start date is Friday(5)-Sunday(0): first page extends to next Sunday (7-10 days)
 * - If start date is Monday(1)-Thursday(4): first page to nearest Sunday (<7 days)
 * - Middle pages: Monday to Sunday (7 days)
 * - Last page absorbs remainder if it would be less than 7 days
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
    allDates.push(d.toISOString().split('T')[0]);
  }

  if (allDates.length === 0) return pages;

  // Determine first page boundary
  const startDay = start.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  let firstPageEndIdx: number;

  if (startDay === 5 || startDay === 6 || startDay === 0) {
    // Friday-Sunday: extend to NEXT Sunday
    // Find next Sunday after at least 7 days
    const daysToNextSunday = startDay === 0 ? 7 : (7 - startDay + 7);
    firstPageEndIdx = Math.min(daysToNextSunday, allDates.length - 1);
  } else {
    // Monday-Thursday: end at nearest Sunday (< 7 days)
    const daysToSunday = startDay === 0 ? 0 : (7 - startDay);
    firstPageEndIdx = Math.min(daysToSunday, allDates.length - 1);
  }

  // Build pages
  let currentIdx = 0;

  // First page
  const firstPageDates = allDates.slice(0, firstPageEndIdx + 1);
  if (firstPageDates.length > 0) {
    pages.push({
      pageIndex: pages.length,
      startDate: firstPageDates[0],
      endDate: firstPageDates[firstPageDates.length - 1],
      entries: getEntriesForDates(firstPageDates, entries),
    });
    currentIdx = firstPageEndIdx + 1;
  }

  // Middle + last pages (7-day chunks, Mon-Sun)
  while (currentIdx < allDates.length) {
    const remaining = allDates.length - currentIdx;

    // If remaining is <= 11 days and we already have pages, make it the last page
    if (remaining <= 11 && pages.length > 0) {
      const lastPageDates = allDates.slice(currentIdx);
      pages.push({
        pageIndex: pages.length,
        startDate: lastPageDates[0],
        endDate: lastPageDates[lastPageDates.length - 1],
        entries: getEntriesForDates(lastPageDates, entries),
      });
      break;
    }

    // Standard 7-day page
    const pageEndIdx = Math.min(currentIdx + 6, allDates.length - 1);
    const pageDates = allDates.slice(currentIdx, pageEndIdx + 1);
    pages.push({
      pageIndex: pages.length,
      startDate: pageDates[0],
      endDate: pageDates[pageDates.length - 1],
      entries: getEntriesForDates(pageDates, entries),
    });
    currentIdx = pageEndIdx + 1;
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
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

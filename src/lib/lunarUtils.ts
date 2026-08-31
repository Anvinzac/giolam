// Using a more precise UTC seed for lunar calculations
// 2000-01-06T18:14:00Z was a new moon
export function getLunarPhase(date: Date): number {
  const knownNewMoon = new Date("2000-01-06T18:14:00Z");
  const lunarCycle = 29.53058867; // days
  const diff = (date.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24);
  const phase = ((diff % lunarCycle) + lunarCycle) % lunarCycle;
  return phase / lunarCycle;
}

/**
 * Astronomical phase for a calendar day always lands one civil day late
 * versus the shop calendar (Rằm / Mùng 1 / Ngày chay). After the heavy
 * phase math, attribute the event to the previous calendar day by reading
 * tomorrow's phase for today's label.
 */
function phaseForCalendarDay(date: Date): number {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return getLunarPhase(d);
}

export function isFullMoon(date: Date): boolean {
  const phase = phaseForCalendarDay(date);
  // Full moon is at 0.5 phase — increased threshold to prevent missing boundary days
  return Math.abs(phase - 0.5) < 0.025;
}

export function isNewMoon(date: Date): boolean {
  const phase = phaseForCalendarDay(date);
  // New moon is at 0.0 or 1.0 phase
  return phase < 0.025 || phase > 0.975;
}

export function isDayBeforeFullMoon(date: Date): boolean {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return isFullMoon(next);
}

export function isDayBeforeNewMoon(date: Date): boolean {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return isNewMoon(next);
}

export function getMoonEmoji(date: Date): string | null {
  if (isFullMoon(date)) return '🌕';
  if (isNewMoon(date)) return '🌑';
  if (isDayBeforeFullMoon(date)) return '🌔';
  if (isDayBeforeNewMoon(date)) return '🌘';
  return null;
}

function formatLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Closed days on the shift-registration table (not lunar events).
const MOON_LABEL_OVERRIDES: Record<string, string | null> = {
  '2026-08-31': 'Nghỉ',
  '2026-09-01': 'Nghỉ',
};

export function getMoonLabel(date: Date): string | null {
  const key = formatLocalYmd(date);
  if (Object.prototype.hasOwnProperty.call(MOON_LABEL_OVERRIDES, key)) {
    return MOON_LABEL_OVERRIDES[key];
  }
  if (isFullMoon(date)) return 'Full Moon';
  if (isNewMoon(date)) return 'New Moon';
  if (isDayBeforeFullMoon(date)) return 'Chay (Rằm)';
  if (isDayBeforeNewMoon(date)) return 'Chay (Mùng 1)';
  return null;
}

/**
 * Get today's date in Vietnam timezone (UTC+7) as a local Date object.
 * The app stores shift dates using Vietnam local dates, so we must
 * generate week dates in the same timezone regardless of the browser's
 * local timezone.
 */
export function getVietnamToday(): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  const day = Number(parts.find(p => p.type === 'day')?.value);
  return new Date(year, month - 1, day);
}

export function getWeekDates(weekStartDate: Date): Date[] {
  const dates: Date[] = [];
  const start = new Date(weekStartDate);
  // Adjust to Monday
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function formatTime(time: string | null | undefined): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m}`;
}

export function isAM(time: string | null | undefined): boolean {
  if (!time) return true;
  const hour = parseInt(time.split(':')[0]);
  return hour < 12;
}

export function timeToString(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

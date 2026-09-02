// Using a more precise UTC seed for lunar calculations
// 2000-01-06T18:14:00Z was a new moon
const KNOWN_NEW_MOON_MS = Date.parse('2000-01-06T18:14:00Z');
const LUNAR_CYCLE_DAYS = 29.53058867;

export function getLunarPhase(date: Date): number {
  const diff = (date.getTime() - KNOWN_NEW_MOON_MS) / (1000 * 60 * 60 * 24);
  const phase = ((diff % LUNAR_CYCLE_DAYS) + LUNAR_CYCLE_DAYS) % LUNAR_CYCLE_DAYS;
  return phase / LUNAR_CYCLE_DAYS;
}

function formatLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function atNoon(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function newMoonDistance(date: Date): number {
  const phase = getLunarPhase(atNoon(date));
  return Math.min(phase, 1 - phase);
}

function fullMoonDistance(date: Date): number {
  return Math.abs(getLunarPhase(atNoon(date)) - 0.5);
}

/** Exactly one civil day per lunation: closer than both neighbors. */
function isLocalMinimum(date: Date, distance: (d: Date) => number): boolean {
  const here = distance(date);
  return here < distance(addDays(date, -1)) && here <= distance(addDays(date, 1));
}

/**
 * Shop calendar follows Vietnamese âm lịch.
 * A wide phase threshold tagged two days as Rằm (e.g. 28/7 and 29/7) and
 * a blanket −1 shift made Ngày chay land a day early around midnight new
 * moons (11/8). Pick the unique nearest day instead: Mùng 1 = closest noon
 * to new moon; Rằm = the day before the closest noon to full moon.
 */
export function isNewMoon(date: Date): boolean {
  return isLocalMinimum(date, newMoonDistance);
}

export function isFullMoon(date: Date): boolean {
  return isLocalMinimum(addDays(date, 1), fullMoonDistance);
}

export function isDayBeforeFullMoon(date: Date): boolean {
  return isFullMoon(addDays(date, 1));
}

export function isDayBeforeNewMoon(date: Date): boolean {
  return isNewMoon(addDays(date, 1));
}

export function getMoonEmoji(date: Date): string | null {
  if (isFullMoon(date)) return '🌕';
  if (isNewMoon(date)) return '🌑';
  if (isDayBeforeFullMoon(date)) return '🌔';
  if (isDayBeforeNewMoon(date)) return '🌘';
  return null;
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

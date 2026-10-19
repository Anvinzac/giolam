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

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Shop calendar follows Vietnamese âm lịch (Hồ Ngọc Đức's algorithm, UTC+7):
 * Mùng 1 is the Vietnam civil day containing the astronomical new moon,
 * Rằm is lunar day 15 (Mùng 1 + 14). Ngày chay is the day before each.
 */
const VN_TIMEZONE = 7;

function julianDayNumber(date: Date): number {
  const dd = date.getDate();
  const mm = date.getMonth() + 1;
  const yy = date.getFullYear();
  const a = Math.floor((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  return dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

function newMoonJulianDay(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let c1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  c1 = c1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  c1 = c1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  c1 = c1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  c1 = c1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  c1 = c1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  c1 = c1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  return jd1 + c1 - deltat;
}

function newMoonDay(k: number): number {
  return Math.floor(newMoonJulianDay(k) + 0.5 + VN_TIMEZONE / 24);
}

/** Julian day number of Mùng 1 of the lunar month containing `jdn`. */
function lunarMonthStart(jdn: number): number {
  const k = Math.floor((jdn - 2415021.076998695) / 29.530588853);
  for (let i = k + 1; i >= k - 1; i--) {
    const start = newMoonDay(i);
    if (start <= jdn) return start;
  }
  return newMoonDay(k - 2);
}

export function isNewMoon(date: Date): boolean {
  const jdn = julianDayNumber(date);
  return lunarMonthStart(jdn) === jdn;
}

export function isFullMoon(date: Date): boolean {
  const jdn = julianDayNumber(date);
  return lunarMonthStart(jdn) + 14 === jdn;
}

/** Ngày chay (Rằm): always the day before the calculated full-moon day. */
export function isDayBeforeFullMoon(date: Date): boolean {
  return isFullMoon(addDays(date, 1));
}

/** Ngày chay (Mùng 1): always the day before the calculated new-moon day. */
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

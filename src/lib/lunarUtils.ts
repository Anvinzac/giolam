// Using a more precise UTC seed for lunar calculations
// 2000-01-06T18:14:00Z was a new moon
export function getLunarPhase(date: Date): number {
  const knownNewMoon = new Date("2000-01-06T18:14:00Z");
  const lunarCycle = 29.53058867; // days
  const diff = (date.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24);
  const phase = ((diff % lunarCycle) + lunarCycle) % lunarCycle;
  return phase / lunarCycle;
}

export function isFullMoon(date: Date): boolean {
  // Use local midnight to check the phase for that day
  const d = new Date(date);
  d.setHours(12, 0, 0, 0); // Check mid-day to be safe
  const phase = getLunarPhase(d);
  // Full moon is at 0.5 phase — tight threshold for exactly 1 day
  return Math.abs(phase - 0.5) < 0.017;
}

export function isNewMoon(date: Date): boolean {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const phase = getLunarPhase(d);
  // New moon is at 0.0 or 1.0 phase — tight threshold for exactly 1 day
  return phase < 0.017 || phase > 0.983;
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

export function getMoonLabel(date: Date): string | null {
  if (isFullMoon(date)) return 'Full Moon';
  if (isNewMoon(date)) return 'New Moon';
  if (isDayBeforeFullMoon(date)) return 'Chay (Rằm)';
  if (isDayBeforeNewMoon(date)) return 'Chay (Mùng 1)';
  return null;
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

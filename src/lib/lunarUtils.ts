// Simplified lunar phase calculation
// Returns 0 = new moon, 0.5 = full moon (approximate)
export function getLunarPhase(date: Date): number {
  const knownNewMoon = new Date(2000, 0, 6, 18, 14); // Known new moon
  const lunarCycle = 29.53058867; // days
  const diff = (date.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24);
  const phase = ((diff % lunarCycle) + lunarCycle) % lunarCycle;
  return phase / lunarCycle;
}

export function isFullMoon(date: Date): boolean {
  const phase = getLunarPhase(date);
  return Math.abs(phase - 0.5) < 0.03;
}

export function isNewMoon(date: Date): boolean {
  const phase = getLunarPhase(date);
  return phase < 0.03 || phase > 0.97;
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
  if (isDayBeforeFullMoon(date)) return 'Eve of Full Moon';
  if (isDayBeforeNewMoon(date)) return 'Eve of New Moon';
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
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function timeToString(hours: number, minutes: number): string {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

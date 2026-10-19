import { describe, it, expect } from 'vitest';
import { isFullMoon, isNewMoon, isDayBeforeFullMoon, isDayBeforeNewMoon } from './lunarUtils';

function d(iso: string) {
  return new Date(iso + 'T12:00:00');
}

describe('Vietnamese lunar shop calendar 2026', () => {
  it('uses Rằm tháng 6 on 28/7, not the astronomical full moon on 29/7', () => {
    expect(isFullMoon(d('2026-07-28'))).toBe(true);
    expect(isFullMoon(d('2026-07-29'))).toBe(false);
    expect(isDayBeforeFullMoon(d('2026-07-27'))).toBe(true);
    expect(isDayBeforeFullMoon(d('2026-07-28'))).toBe(false);
  });

  it('puts Mùng 1 tháng 7 on 13/8 (new moon just after midnight UTC+7), ngày chay 12/8', () => {
    expect(isNewMoon(d('2026-08-13'))).toBe(true);
    expect(isNewMoon(d('2026-08-12'))).toBe(false);
    expect(isDayBeforeNewMoon(d('2026-08-12'))).toBe(true);
    expect(isDayBeforeNewMoon(d('2026-08-11'))).toBe(false);
  });

  it('puts September Mùng 1 on 11/9 with ngày chay on 10/9', () => {
    expect(isNewMoon(d('2026-09-11'))).toBe(true);
    expect(isNewMoon(d('2026-09-12'))).toBe(false);
    expect(isDayBeforeNewMoon(d('2026-09-10'))).toBe(true);
    expect(isDayBeforeNewMoon(d('2026-09-11'))).toBe(false);
  });

  it('keeps March Rằm on 3/3', () => {
    expect(isFullMoon(d('2026-03-03'))).toBe(true);
    expect(isFullMoon(d('2026-03-04'))).toBe(false);
  });

  it('puts Rằm tháng 9 on 24/10 with ngày chay on 23/10', () => {
    expect(isNewMoon(d('2026-10-10'))).toBe(true);
    expect(isFullMoon(d('2026-09-25'))).toBe(true);
    expect(isFullMoon(d('2026-10-24'))).toBe(true);
    expect(isFullMoon(d('2026-10-25'))).toBe(false);
    expect(isDayBeforeFullMoon(d('2026-10-23'))).toBe(true);
  });
});

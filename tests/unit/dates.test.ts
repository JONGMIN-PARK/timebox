import { expect, it } from 'vitest';
import { dateInTimezone, calendarDaysBetween } from '../../packages/shared/src/dates';

it('uses the Korean calendar date before 09:00', () => {
  expect(dateInTimezone(new Date('2026-09-26T23:30:00Z'), 'Asia/Seoul')).toBe('2026-09-27');
});
it('uses the date of the configured timezone', () => {
  const now = new Date('2026-09-27T01:00:00Z');
  expect(dateInTimezone(now, 'America/Los_Angeles')).toBe('2026-09-26');
  expect(dateInTimezone(now, 'Asia/Seoul')).toBe('2026-09-27');
});
it('counts calendar days independently of DST and host timezone', () => {
  expect(calendarDaysBetween('2026-03-07', '2026-03-09')).toBe(2);
  expect(calendarDaysBetween('2026-09-27', '2026-09-26')).toBe(-1);
});

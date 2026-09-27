import { describe, expect, it } from 'vitest';
import type { TimeBlock } from '@timebox/shared';
import {
  analyzeDay,
  findAvailableStart,
  overlapLanes,
} from '../../packages/client/src/components/scheduler/planning';
const block = (
  id: number,
  startTime: string,
  endTime: string,
  category = 'deep_work',
  completed = false,
) => ({ id, startTime, endTime, category, completed }) as TimeBlock;

describe('timebox planning', () => {
  it('does not count overlapping time twice', () => {
    const result = analyzeDay([block(1, '09:00', '10:00'), block(2, '09:30', '11:00')], 540, 720);
    expect(result.planned).toBe(120);
    expect(result.free).toEqual([{ start: 660, end: 720 }]);
    expect([...result.conflicts]).toEqual([1, 2]);
  });
  it('clips metrics to the chosen planning window', () => {
    expect(analyzeDay([block(1, '07:00', '09:00', 'deep_work', true)], 480, 600)).toMatchObject({
      planned: 60,
      focus: 60,
      completed: 60,
      capacity: 120,
    });
  });
  it('rounds a free slot up to the snapping grid', () => {
    expect(findAvailableStart([block(1, '08:00', '08:07')], 30, 15, 480, 600)).toBe(495);
  });
  it('returns no slot instead of scheduling over an occupied day', () => {
    expect(findAvailableStart([block(1, '08:00', '22:00')], 30, 10)).toBeNull();
  });
  it('accepts adjacent blocks without conflicts', () => {
    expect(
      analyzeDay([block(1, '09:00', '10:00'), block(2, '10:00', '11:00')]).conflicts.size,
    ).toBe(0);
  });
  it('keeps every block in a chain of overlaps visible', () => {
    const lanes = overlapLanes([
      block(1, '09:00', '10:00'),
      block(2, '09:30', '11:00'),
      block(3, '10:30', '11:30'),
      block(4, '12:00', '13:00'),
    ]);
    expect(lanes.get(1)).toEqual({ column: 0, columns: 2 });
    expect(lanes.get(2)).toEqual({ column: 1, columns: 2 });
    expect(lanes.get(3)).toEqual({ column: 0, columns: 2 });
    expect(lanes.get(4)).toEqual({ column: 0, columns: 1 });
  });
});

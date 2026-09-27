import { describe, expect, it } from 'vitest';
import {
  createMutationQueue,
  rollbackEntities,
} from '../../packages/client/src/lib/entityMutations';

describe('optimistic writes', () => {
  it('rolls back A without erasing successful edits and additions to B', () => {
    const before = [
      { id: 1, title: 'A' },
      { id: 2, title: 'B' },
    ];
    const current = [
      { id: 1, title: 'A optimistic' },
      { id: 2, title: 'B saved' },
      { id: 3, title: 'new' },
    ];
    expect(rollbackEntities(current, before, [1])).toEqual([before[0], current[1], current[2]]);
  });
  it('restores a failed deletion without resurrecting another deletion', () => {
    expect(rollbackEntities([], [{ id: 1 }, { id: 2 }], [1])).toEqual([{ id: 1 }]);
  });
  it('serializes the same entity but lets unrelated writes finish', async () => {
    const queue = createMutationQueue();
    let release!: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const events: string[] = [];
    const first = queue.run([1], async () => {
      events.push('A start');
      await wait;
      events.push('A end');
    });
    const second = queue.run([1], async () => {
      events.push('A second');
    });
    await queue.run([2], async () => {
      events.push('B');
    });
    expect(events).toEqual(['A start', 'B']);
    release();
    await Promise.all([first, second]);
    expect(events).toEqual(['A start', 'B', 'A end', 'A second']);
  });
  it('continues a queue after a failed request', async () => {
    const queue = createMutationQueue();
    await expect(
      queue.run([1], async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
    expect(await queue.run([1], async () => 'saved')).toBe('saved');
  });
});

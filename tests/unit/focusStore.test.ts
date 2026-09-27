import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  return values;
});
let useFocusStore: typeof import('../../packages/client/src/stores/focusStore').useFocusStore;
beforeEach(async () => {
  vi.resetModules();
  useFocusStore = (await import('../../packages/client/src/stores/focusStore')).useFocusStore;
});

afterEach(() => {
  useFocusStore.getState().reset();
  vi.useRealTimers();
  storage.clear();
});
it('keeps accurate remaining time across pauses and background time', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-27T00:00:00Z'));
  const state = useFocusStore.getState();
  state.start({ id: 1, date: '2026-09-27', title: 'Focus' }, 30);
  vi.setSystemTime(new Date('2026-09-27T00:10:00Z'));
  state.pause();
  expect(useFocusStore.getState().session).toMatchObject({
    remainingMs: 20 * 60_000,
    deadline: null,
  });
  vi.setSystemTime(new Date('2026-09-27T01:10:00Z'));
  state.resume();
  expect(useFocusStore.getState().session!.deadline).toBe(Date.parse('2026-09-27T01:30:00Z'));
});
it('persists a session and clamps an expired timer to zero', () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  useFocusStore.getState().start({ id: 1, date: '2026-09-27', title: 'Focus' }, 1);
  expect(JSON.parse(storage.get('timebox-focus-session')!).state.session.blockId).toBe(1);
  vi.setSystemTime(120_000);
  useFocusStore.getState().pause();
  expect(useFocusStore.getState().session!.remainingMs).toBe(0);
  useFocusStore.getState().resume();
  expect(useFocusStore.getState().session!.deadline).toBeNull();
});

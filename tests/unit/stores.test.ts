import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  return {
    projectGet: vi.fn(),
    projectUpdate: vi.fn(),
    blockGet: vi.fn(),
    blockCreate: vi.fn(),
    blockUpdate: vi.fn(),
    todoUpdate: vi.fn(),
  };
});
vi.mock('../../packages/client/src/lib/apiService', () => ({
  projectTaskApi: { getAll: mocks.projectGet, update: mocks.projectUpdate },
  timeblockApi: { getAll: mocks.blockGet, create: mocks.blockCreate, update: mocks.blockUpdate },
  todoApi: { update: mocks.todoUpdate },
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
});

it("ignores project A's late response after switching to B", async () => {
  const { useProjectTaskStore: store } =
    await import('../../packages/client/src/stores/projectTaskStore');
  const a = deferred<{ success: boolean; data: Array<{ id: number; title: string }> }>();
  const b = deferred<{ success: boolean; data: Array<{ id: number; title: string }> }>();
  mocks.projectGet.mockImplementation((id: number) => (id === 1 ? a.promise : b.promise));
  const first = store.getState().fetchTasks(1);
  const second = store.getState().fetchTasks(2);
  await vi.waitFor(() => expect(mocks.projectGet).toHaveBeenCalledTimes(2));
  b.resolve({ success: true, data: [{ id: 20, title: 'B' }] });
  await second;
  a.resolve({ success: true, data: [{ id: 10, title: 'A' }] });
  await first;
  expect(store.getState()).toMatchObject({
    projectId: 2,
    tasks: [{ id: 20, title: 'B' }],
    loading: false,
  });
});
it("ignores the previous day's response after selecting a new date", async () => {
  const { useTimeBlockStore: store } =
    await import('../../packages/client/src/stores/timeblockStore');
  const a = deferred<{ success: boolean; data: Array<{ id: number }> }>();
  const b = deferred<{ success: boolean; data: Array<{ id: number }> }>();
  store.setState({ selectedDate: '2026-09-26' });
  mocks.blockGet.mockImplementation((date: string) =>
    date === '2026-09-26' ? a.promise : b.promise,
  );
  const first = store.getState().fetchBlocks('2026-09-26');
  store.getState().setSelectedDate('2026-09-27');
  await vi.waitFor(() => expect(mocks.blockGet).toHaveBeenCalledTimes(2));
  b.resolve({ success: true, data: [{ id: 2 }] });
  await vi.waitFor(() => expect(store.getState().blocks).toEqual([{ id: 2 }]));
  a.resolve({ success: true, data: [{ id: 1 }] });
  await first;
  expect(store.getState().blocks).toEqual([{ id: 2 }]);
});
it("preserves B's successful Todo update when A fails", async () => {
  const { useTodoStore: store } = await import('../../packages/client/src/stores/todoStore');
  store.setState({
    todos: [
      { id: 1, title: 'A', sortOrder: 0 },
      { id: 2, title: 'B', sortOrder: 1 },
    ] as never,
  });
  const a = deferred<{ success: boolean; error?: string }>();
  mocks.todoUpdate.mockImplementation((id: number) =>
    id === 1
      ? a.promise
      : Promise.resolve({ success: true, data: { id: 2, title: 'B saved', sortOrder: 1 } }),
  );
  const first = store.getState().updateTodo(1, { title: 'A pending' });
  await store.getState().updateTodo(2, { title: 'B saved' });
  a.resolve({ success: false, error: 'offline' });
  await first;
  expect(store.getState().todos.map((item) => item.title)).toEqual(['A', 'B saved']);
});
it('keeps a failed timebox addition out of the list and returns failure to the editor', async () => {
  const { useTimeBlockStore: store } =
    await import('../../packages/client/src/stores/timeblockStore');
  mocks.blockCreate.mockResolvedValue({ success: false, error: 'offline' });
  const result = await store.getState().addBlock({ title: 'Unsent' });
  expect(result).toBeUndefined();
  expect(store.getState().blocks).toEqual([]);
});
it('does not add a saved block to another selected date', async () => {
  const { useTimeBlockStore: store } =
    await import('../../packages/client/src/stores/timeblockStore');
  store.setState({ selectedDate: '2026-09-26' });
  const save = deferred<{ success: boolean; data: { id: number; date: string } }>();
  mocks.blockCreate.mockReturnValue(save.promise);
  mocks.blockGet.mockResolvedValue({ success: true, data: [] });
  const first = store.getState().addBlock({ title: 'Yesterday', date: '2026-09-26' });
  await vi.waitFor(() => expect(mocks.blockCreate).toHaveBeenCalled());
  store.getState().setSelectedDate('2026-09-27');
  save.resolve({ success: true, data: { id: 10, date: '2026-09-26' } });
  await first;
  expect(store.getState().blocks).toEqual([]);
});

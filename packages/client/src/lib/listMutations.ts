import { createMutationQueue, rollbackEntities } from './entityMutations';
import type { ApiRes } from './apiService';

/** A scoped optimistic write cannot update a different date/project after navigation. */
export function createListMutations<T extends { id: number }>(
  read: () => T[],
  commit: (items: T[]) => void,
  report: (message: string) => void,
) {
  const queue = createMutationQueue();
  return {
    queue,
    mutate(
      ids: number[],
      belongsToView: () => boolean,
      optimistic: (items: T[]) => T[],
      request: () => Promise<ApiRes<unknown>>,
      message: string,
    ) {
      return queue.run(ids, async () => {
        const before = read();
        if (belongsToView()) commit(optimistic(before));
        try {
          const result = await request();
          if (!result.success) throw new Error(result.error || message);
          if (
            belongsToView() &&
            result.data &&
            typeof result.data === 'object' &&
            'id' in result.data
          ) {
            const saved = result.data as T;
            commit(read().map((item) => (item.id === saved.id ? saved : item)));
          }
          return true;
        } catch (error) {
          if (belongsToView()) {
            commit(rollbackEntities(read(), before, ids));
            report(error instanceof Error ? error.message : message);
          }
          return false;
        }
      });
    },
  };
}

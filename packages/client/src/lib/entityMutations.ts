/** Serialize writes touching the same entities while allowing unrelated writes in parallel. */
export function createMutationQueue() {
  const pending = new Map<number, Promise<unknown>>();
  let revision = 0;
  return {
    get revision() {
      return revision;
    },
    async idle() {
      await Promise.all([...pending.values()]);
    },
    run<T>(ids: number[], work: () => Promise<T>): Promise<T> {
      revision++;
      const dependencies = ids.map((id) => pending.get(id)).filter(Boolean);
      const result = Promise.all(dependencies).then(work);
      const settled = result.catch(() => undefined);
      ids.forEach((id) => pending.set(id, settled));
      void settled.then(() => {
        revision++;
        ids.forEach((id) => {
          if (pending.get(id) === settled) pending.delete(id);
        });
      });
      return result;
    },
  };
}

/** Restore only affected entities; preserve successful changes made to all other entities. */
export function rollbackEntities<T extends { id: number }>(
  current: T[],
  before: T[],
  ids: number[],
): T[] {
  const affected = new Set(ids);
  const original = new Map(
    before.filter((item) => affected.has(item.id)).map((item) => [item.id, item]),
  );
  const result = current.flatMap((item) => {
    if (!affected.has(item.id)) return [item];
    const previous = original.get(item.id);
    original.delete(item.id);
    return previous ? [previous] : [];
  });
  for (const item of original.values()) {
    const oldIndex = before.findIndex((previous) => previous.id === item.id);
    result.splice(Math.min(oldIndex, result.length), 0, item);
  }
  return result;
}

let temporaryId = 0;
export function nextTemporaryId() {
  return --temporaryId;
}

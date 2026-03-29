import type { Todo } from "@timebox/shared";

/** 마감일·시각 기준 정렬용 ms. 날짜만 있으면 해당일 00:00:00. 없음/invalid → +Infinity */
export function todoDueSortMs(todo: { dueDate: string | null | undefined }): number {
  const d = todo.dueDate;
  if (!d) return Number.POSITIVE_INFINITY;
  const ms = new Date(d.includes("T") ? d : `${d}T00:00:00`).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/** 같은 날이면 시각 오름차순(이른 시간이 위). 없는 날짜는 맨 아래. */
export function compareTodosByDueDateTime(a: Pick<Todo, "dueDate" | "sortOrder" | "id">, b: typeof a): number {
  const da = todoDueSortMs(a);
  const db = todoDueSortMs(b);
  if (da !== db) return da - db;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id - b.id;
}

export function sortTodosForDisplay<T extends Pick<Todo, "dueDate" | "sortOrder" | "id">>(list: T[]): T[] {
  return [...list].sort(compareTodosByDueDateTime);
}

/**
 * 스토어 배열: 일반 할 일 → 휴지통 순. 각 그룹은 마감일·시간 오름차순.
 * reorder API로 수동 순서를 맞출 때는 사용하지 않음.
 */
export function normalizeTodoStoreOrder(todos: Todo[]): Todo[] {
  const active = todos.filter((t) => !t.deletedAt);
  const trashed = todos.filter((t) => t.deletedAt);
  return [...sortTodosForDisplay(active), ...sortTodosForDisplay(trashed)];
}

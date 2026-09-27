import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { todos, events, ddays, timeBlocks, categories } from '../db/schema.js';
import { getProjectRole } from '../lib/projectAccess.js';
import type { BackupRepository } from './backup.js';

export function personalBackupRepository(userId: number): BackupRepository {
  return {
    transaction: (work) =>
      db.transaction((tx) =>
        work({
          clear: async () => {
            await tx.delete(todos).where(eq(todos.userId, userId));
            await tx.delete(events).where(eq(events.userId, userId));
            await tx.delete(ddays).where(eq(ddays.userId, userId));
            await tx.delete(timeBlocks).where(eq(timeBlocks.userId, userId));
          },
          canAccessProject: async (projectId) =>
            (await getProjectRole(userId, projectId, tx)) !== null,
          hasCategory: async (categoryId) =>
            !!(
              await tx
                .select({ id: categories.id })
                .from(categories)
                .where(eq(categories.id, categoryId))
            )[0],
          insertTodo: async (todo) => {
            const [row] = await tx
              .insert(todos)
              .values({ ...todo, userId })
              .returning({ id: todos.id });
            return row.id;
          },
          setTodoParent: async (id, parentId) => {
            await tx
              .update(todos)
              .set({ parentId })
              .where(and(eq(todos.id, id), eq(todos.userId, userId)));
          },
          insertEvent: async (event) => {
            await tx.insert(events).values({ ...event, userId });
          },
          insertDDay: async (dday) => {
            await tx.insert(ddays).values({ ...dday, userId });
          },
          insertBlock: async (block) => {
            const [row] = await tx
              .insert(timeBlocks)
              .values({ ...block, userId })
              .returning({ id: timeBlocks.id });
            return row.id;
          },
          setBlockMeta: async (id, meta) => {
            await tx
              .update(timeBlocks)
              .set({ meta })
              .where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, userId)));
          },
        }),
      ),
  };
}

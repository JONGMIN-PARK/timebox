import { z } from 'zod';
import { ValidationError } from '../lib/errors.js';

const id = z.number().int().positive();
const text = z.string().trim().min(1);
const timestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), 'Invalid timestamp');
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Invalid calendar date');
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/);
const audit = { createdAt: timestamp.optional(), updatedAt: timestamp.optional() };
const todoSchema = z
  .object({
    id: id.optional(),
    title: text,
    completed: z.boolean().default(false),
    status: z.enum(['waiting', 'active', 'completed']).optional(),
    progress: z.number().int().min(0).max(100).optional(),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    category: text.default('personal'),
    dueDate: date.nullable().default(null),
    sortOrder: z.number().int().default(0),
    parentId: id.nullable().default(null),
    projectId: id.nullable().default(null),
    memo: z.string().nullable().default(null),
    deletedAt: timestamp.nullable().default(null),
    ...audit,
  })
  .transform((todo) => ({
    ...todo,
    status: todo.status ?? (todo.completed ? 'completed' : 'active'),
    progress: todo.progress ?? (todo.completed ? 100 : 0),
  }));
const eventSchema = z
  .object({
    title: text,
    description: z.string().nullable().default(null),
    startTime: timestamp,
    endTime: timestamp,
    allDay: z.boolean().default(false),
    categoryId: id.nullable().default(null),
    recurrenceRule: z.string().nullable().default(null),
    color: z.string().nullable().default('#3b82f6'),
    projectId: id.nullable().default(null),
    ...audit,
  })
  .refine(
    (event) => Date.parse(event.endTime) >= Date.parse(event.startTime),
    'Event end precedes start',
  );
const ddaySchema = z.object({
  title: text,
  targetDate: date,
  color: z.string().nullable().default('#3b82f6'),
  icon: z.string().nullable().default(null),
  ...audit,
});
const blockSchema = z
  .object({
    id: id.optional(),
    date,
    startTime: time,
    endTime: time,
    title: text,
    category: text.default('other'),
    color: z.string().nullable().default(null),
    notes: z.string().nullable().default(null),
    meta: z
      .string()
      .refine((value) => {
        try {
          const parsed: unknown = JSON.parse(value);
          return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
        } catch {
          return false;
        }
      }, 'Invalid block metadata')
      .nullable()
      .default(null),
    completed: z.boolean().default(false),
    ...audit,
  })
  .refine((block) => block.endTime > block.startTime, 'Time block end must follow start');
const backupSchema = z
  .object({
    version: z.literal(1),
    todos: z.array(todoSchema).optional(),
    events: z.array(eventSchema).optional(),
    ddays: z.array(ddaySchema).optional(),
    timeBlocks: z.array(blockSchema).optional(),
  })
  .refine(
    (data) => [data.todos, data.events, data.ddays, data.timeBlocks].some(Array.isArray),
    'Backup contains no data collections',
  );

export type BackupData = z.infer<typeof backupSchema>;
export type BackupTodo = NonNullable<BackupData['todos']>[number];
type BackupEvent = NonNullable<BackupData['events']>[number];
type BackupDDay = NonNullable<BackupData['ddays']>[number];
type BackupBlock = NonNullable<BackupData['timeBlocks']>[number];

export interface BackupTransaction {
  clear(): Promise<void>;
  canAccessProject(projectId: number): Promise<boolean>;
  hasCategory(categoryId: number): Promise<boolean>;
  insertTodo(todo: Omit<BackupTodo, 'id'>): Promise<number>;
  setTodoParent(id: number, parentId: number): Promise<void>;
  insertEvent(event: BackupEvent): Promise<void>;
  insertDDay(dday: BackupDDay): Promise<void>;
  insertBlock(block: Omit<BackupBlock, 'id'>): Promise<number>;
  setBlockMeta(id: number, meta: string): Promise<void>;
}
export interface BackupRepository {
  transaction<T>(work: (tx: BackupTransaction) => Promise<T>): Promise<T>;
}

/** Validate every record and reference before destructive work starts. */
export function parseBackup(data: unknown, mode: unknown) {
  if (mode !== undefined && mode !== 'merge' && mode !== 'replace')
    throw new ValidationError('Invalid backup mode');
  const parsed = backupSchema.safeParse(data);
  if (!parsed.success)
    throw new ValidationError(
      `Invalid backup: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  const backup = parsed.data;
  if (
    mode === 'replace' &&
    [backup.todos, backup.events, backup.ddays, backup.timeBlocks].some(
      (value) => !Array.isArray(value),
    )
  ) {
    throw new ValidationError('Replace requires all four backup collections');
  }
  const todos = backup.todos ?? [];
  const byId = new Map<number, BackupTodo>();
  for (const todo of todos) {
    if (todo.parentId !== null && todo.id === undefined)
      throw new ValidationError('Child todo is missing its ID');
    if (todo.id !== undefined) {
      if (byId.has(todo.id)) throw new ValidationError('Duplicate todo ID in backup');
      byId.set(todo.id, todo);
    }
  }
  const visited = new Set<number>();
  for (const todo of todos) {
    if (todo.parentId !== null && !byId.has(todo.parentId))
      throw new ValidationError('Missing parent todo in backup');
    const path = new Set<number>();
    let node: BackupTodo | undefined = todo;
    while (node?.id !== undefined && !visited.has(node.id)) {
      if (path.has(node.id)) throw new ValidationError('Cyclic todo hierarchy in backup');
      path.add(node.id);
      node = node.parentId === null ? undefined : byId.get(node.parentId);
    }
    path.forEach((value) => visited.add(value));
  }
  const blockIds = new Map<number, BackupBlock>();
  for (const block of backup.timeBlocks ?? []) {
    if (block.id !== undefined) {
      if (blockIds.has(block.id)) throw new ValidationError('Duplicate time block ID in backup');
      blockIds.set(block.id, block);
    }
  }
  for (const block of backup.timeBlocks ?? []) {
    if (!block.meta) continue;
    const metadata = JSON.parse(block.meta) as Record<string, unknown>;
    if (metadata.linkToBlockId != null) {
      const linked =
        typeof metadata.linkToBlockId === 'number'
          ? blockIds.get(metadata.linkToBlockId)
          : undefined;
      if (!linked || linked.date !== block.date)
        throw new ValidationError('Invalid linked time block in backup');
    }
  }
  return backup;
}

export async function restorePersonalBackup(
  repository: BackupRepository,
  data: unknown,
  mode: unknown,
) {
  const backup = parseBackup(data, mode);
  return repository.transaction(async (tx) => {
    const projectIds = new Set(
      [...(backup.todos ?? []), ...(backup.events ?? [])].flatMap((item) =>
        item.projectId === null ? [] : [item.projectId],
      ),
    );
    for (const projectId of projectIds) {
      if (!(await tx.canAccessProject(projectId)))
        throw new ValidationError(`No access to project ${projectId}`);
    }
    const categoryIds = new Map<number, boolean>();
    for (const event of backup.events ?? []) {
      if (event.categoryId !== null && !categoryIds.has(event.categoryId))
        categoryIds.set(event.categoryId, await tx.hasCategory(event.categoryId));
    }
    if (mode === 'replace') await tx.clear();
    const ids = new Map<number, number>();
    for (const todo of backup.todos ?? []) {
      const { id: oldId, ...values } = todo;
      const newId = await tx.insertTodo({ ...values, parentId: null });
      if (oldId !== undefined) ids.set(oldId, newId);
    }
    for (const todo of backup.todos ?? []) {
      if (todo.parentId !== null && todo.id !== undefined)
        await tx.setTodoParent(ids.get(todo.id)!, ids.get(todo.parentId)!);
    }
    for (const event of backup.events ?? [])
      await tx.insertEvent({
        ...event,
        categoryId:
          event.categoryId !== null && categoryIds.get(event.categoryId) ? event.categoryId : null,
      });
    for (const dday of backup.ddays ?? []) await tx.insertDDay(dday);
    const blockIds = new Map<number, number>();
    const inserted: Array<{ id: number; meta: string }> = [];
    for (const block of backup.timeBlocks ?? []) {
      const { id: oldId, ...values } = block;
      const newId = await tx.insertBlock(values);
      if (oldId !== undefined) blockIds.set(oldId, newId);
      if (block.meta) inserted.push({ id: newId, meta: block.meta });
    }
    for (const block of inserted) {
      const metadata = JSON.parse(block.meta) as Record<string, unknown>;
      if (typeof metadata.linkToBlockId === 'number') {
        metadata.linkToBlockId = blockIds.get(metadata.linkToBlockId);
        await tx.setBlockMeta(block.id, JSON.stringify(metadata));
      }
    }
    return {
      todos: backup.todos?.length ?? 0,
      events: backup.events?.length ?? 0,
      ddays: backup.ddays?.length ?? 0,
      timeBlocks: backup.timeBlocks?.length ?? 0,
    };
  });
}

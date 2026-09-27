import { describe, expect, it, vi } from 'vitest';
import {
  parseBackup,
  restorePersonalBackup,
  type BackupRepository,
  type BackupTransaction,
} from '../../packages/server/src/services/backup';

const backup = {
  version: 1,
  todos: [
    {
      id: 7,
      title: 'Parent',
      status: 'waiting',
      progress: 35,
      memo: 'keep',
      deletedAt: '2026-09-26T00:00:00Z',
    },
    { id: 8, title: 'Child', parentId: 7 },
  ],
  events: [],
  ddays: [],
  timeBlocks: [],
};
function repository(fail = false) {
  let committed: Array<Record<string, unknown>> = [{ id: 1, title: 'Existing' }];
  const transaction = vi.fn(async (work: (tx: BackupTransaction) => Promise<unknown>) => {
    const draft = structuredClone(committed);
    let sequence = 100;
    const tx: BackupTransaction = {
      clear: async () => {
        draft.splice(0);
      },
      canAccessProject: async () => true,
      hasCategory: async () => true,
      insertTodo: async (todo) => {
        if (fail && todo.title === 'Child') throw new Error('DB insert failed');
        const id = ++sequence;
        draft.push({ ...todo, id });
        return id;
      },
      setTodoParent: async (id, parentId) => {
        draft.find((row) => row.id === id)!.parentId = parentId;
      },
      insertEvent: async (event) => {
        draft.push({ ...event });
      },
      insertDDay: async (row) => {
        draft.push({ ...row });
      },
      insertBlock: async (row) => {
        const id = ++sequence;
        draft.push({ ...row, id });
        return id;
      },
      setBlockMeta: async (id, meta) => {
        draft.find((row) => row.id === id)!.meta = meta;
      },
    };
    const result = await work(tx);
    committed = draft;
    return result;
  });
  return { repository: { transaction } as BackupRepository, transaction, rows: () => committed };
}

describe('personal backup restore', () => {
  it('validates the complete input before opening a transaction', async () => {
    const repo = repository();
    await expect(
      restorePersonalBackup(
        repo.repository,
        { ...backup, ddays: [{ title: 'Invalid', targetDate: '2026-02-30' }] },
        'replace',
      ),
    ).rejects.toThrow('Invalid');
    expect(repo.transaction).not.toHaveBeenCalled();
    expect(repo.rows()).toEqual([{ id: 1, title: 'Existing' }]);
  });
  it('rejects partial replace backups and unsupported versions', () => {
    expect(() => parseBackup({ version: 1, todos: [] }, 'replace')).toThrow('four');
    expect(() => parseBackup({ ...backup, version: 99 }, 'merge')).toThrow('Invalid');
  });
  it('restores the original data when an insert fails after deletion', async () => {
    const repo = repository(true);
    await expect(restorePersonalBackup(repo.repository, backup, 'replace')).rejects.toThrow(
      'DB insert failed',
    );
    expect(repo.rows()).toEqual([{ id: 1, title: 'Existing' }]);
  });
  it('remaps parent IDs and preserves status, progress, memo and trash', async () => {
    const repo = repository();
    expect(await restorePersonalBackup(repo.repository, backup, 'replace')).toEqual({
      todos: 2,
      events: 0,
      ddays: 0,
      timeBlocks: 0,
    });
    expect(repo.rows()[0]).toMatchObject({
      id: 101,
      status: 'waiting',
      progress: 35,
      memo: 'keep',
      deletedAt: '2026-09-26T00:00:00Z',
    });
    expect(repo.rows()[1]).toMatchObject({ id: 102, parentId: 101 });
  });
  it('supports old backups without status or progress', () => {
    expect(
      parseBackup({ version: 1, todos: [{ title: 'Legacy', completed: true }] }, 'merge').todos![0],
    ).toMatchObject({ status: 'completed', progress: 100 });
  });
  it('rejects duplicate IDs, missing parents and cyclic references', () => {
    for (const todos of [
      [
        { id: 1, title: 'A' },
        { id: 1, title: 'B' },
      ],
      [{ id: 1, title: 'A', parentId: 2 }],
      [
        { id: 1, title: 'A', parentId: 2 },
        { id: 2, title: 'B', parentId: 1 },
      ],
    ]) {
      expect(() => parseBackup({ version: 1, todos }, 'merge')).toThrow();
    }
  });
  it('rejects unauthorized project references before clearing data', async () => {
    const cleared = vi.fn();
    const repo: BackupRepository = {
      transaction: (work) =>
        work({
          canAccessProject: async () => false,
          clear: cleared,
        } as unknown as BackupTransaction),
    };
    await expect(
      restorePersonalBackup(
        repo,
        { ...backup, todos: [{ title: 'Secret', projectId: 4 }] },
        'replace',
      ),
    ).rejects.toThrow('No access');
    expect(cleared).not.toHaveBeenCalled();
  });
});

it('remaps links between restored time blocks', async () => {
  const repo = repository();
  const timeBlocks = [
    {
      id: 50,
      date: '2026-09-27',
      title: 'A',
      startTime: '09:00',
      endTime: '10:00',
      meta: JSON.stringify({ linkToBlockId: 51, protected: true }),
    },
    { id: 51, date: '2026-09-27', title: 'B', startTime: '10:00', endTime: '11:00' },
  ];
  await restorePersonalBackup(repo.repository, { ...backup, todos: [], timeBlocks }, 'replace');
  expect(JSON.parse(repo.rows()[0].meta as string)).toEqual({
    linkToBlockId: 102,
    protected: true,
  });
});

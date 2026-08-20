import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getNeonSql, hasDatabase, withNeonRetry } from '@/lib/neon-sql';
import { normalizeTask } from '@/lib/internal';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'internal-tasks.json');

function useDatabase() {
  return hasDatabase();
}

function sql() {
  return getNeonSql();
}

function readFileStore() {
  if (!existsSync(FILE)) return [];
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeFileStore(tasks) {
  writeFileSync(FILE, JSON.stringify(tasks, null, 2));
}

/** Detach tasks from a deleted board — tasks stay, board_id cleared. */
export async function clearTasksBoardId(boardId) {
  const id = String(boardId || '').trim();
  if (!id) return 0;

  if (useDatabase()) {
    const rows = await withNeonRetry(() => sql()`
      SELECT id, data FROM internal_tasks WHERE data->>'board_id' = ${id}
    `);
    if (!rows?.length) return 0;

    for (const row of rows) {
      const raw = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      const next = normalizeTask({ ...raw, board_id: null }, raw?.created_by || '');
      await withNeonRetry(() => sql()`
        UPDATE internal_tasks
        SET data = ${JSON.stringify(next)}::jsonb, updated_at = ${next.updated_at}
        WHERE id = ${row.id}
      `);
    }
    return rows.length;
  }

  const tasks = readFileStore();
  let count = 0;
  const next = tasks.map(task => {
    if (task.board_id !== id) return task;
    count += 1;
    return normalizeTask({ ...task, board_id: null }, task.created_by || '');
  });
  if (count) writeFileStore(next);
  return count;
}

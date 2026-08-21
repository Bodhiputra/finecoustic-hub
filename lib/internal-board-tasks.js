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
    const now = new Date().toISOString();
    const rows = await withNeonRetry(() => sql()`
      UPDATE internal_tasks
      SET
        data = jsonb_set(
          jsonb_set(data, '{board_id}', 'null'::jsonb, false),
          '{updated_at}',
          to_jsonb(${now}::text),
          false
        ),
        updated_at = ${now}::timestamptz
      WHERE data->>'board_id' = ${id}
      RETURNING id
    `);
    return rows?.length || 0;
  }

  const tasks = readFileStore();
  let count = 0;
  const now = new Date().toISOString();
  const next = tasks.map(task => {
    if (task.board_id !== id) return task;
    count += 1;
    return normalizeTask({ ...task, board_id: null, updated_at: now }, task.created_by || '');
  });
  if (count) writeFileStore(next);
  return count;
}

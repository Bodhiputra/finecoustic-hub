import { getNeonSql, hasDatabase } from './neon-sql';

let columnReady = false;

async function ensureSessionGenColumn() {
  if (columnReady || !hasDatabase()) return;
  const sql = getNeonSql();
  await sql`ALTER TABLE appdev_users ADD COLUMN IF NOT EXISTS session_gen TEXT NOT NULL DEFAULT ''`;
  columnReady = true;
}

/** Edge-safe lookup — used by middleware when validating appdev cookies. */
export async function getUserSessionGen(userId) {
  const id = String(userId || '').trim();
  if (!id || !hasDatabase()) return '';

  try {
    await ensureSessionGenColumn();
    const sql = getNeonSql();
    const rows = await sql`
      SELECT session_gen FROM appdev_users WHERE id = ${id} LIMIT 1
    `;
    if (!rows.length) return null;
    return String(rows[0]?.session_gen || '').trim();
  } catch {
    return '';
  }
}

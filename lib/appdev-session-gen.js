import { neon } from '@neondatabase/serverless';

let columnReady = false;

async function ensureSessionGenColumn() {
  if (columnReady || !process.env.DATABASE_URL) return;
  const sql = neon(process.env.DATABASE_URL);
  await sql`ALTER TABLE appdev_users ADD COLUMN IF NOT EXISTS session_gen TEXT NOT NULL DEFAULT ''`;
  columnReady = true;
}

/** Edge-safe lookup — used by middleware when validating appdev cookies. */
export async function getUserSessionGen(userId) {
  const id = String(userId || '').trim();
  if (!id || !process.env.DATABASE_URL) return '';

  try {
    await ensureSessionGenColumn();
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT session_gen FROM appdev_users WHERE id = ${id} LIMIT 1
    `;
    if (!rows.length) return null;
    return String(rows[0]?.session_gen || '').trim();
  } catch {
    return '';
  }
}

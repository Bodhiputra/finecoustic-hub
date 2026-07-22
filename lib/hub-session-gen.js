import { neon } from '@neondatabase/serverless';

let columnReady = false;

/** Short TTL cache — middleware validates session on every navigation. */
const sessionGenCache = new Map();
const SESSION_GEN_CACHE_MS = 60_000;

function readSessionGenCache(userId) {
  if (!sessionGenCache.has(userId)) return undefined;
  const hit = sessionGenCache.get(userId);
  if (Date.now() - hit.ts > SESSION_GEN_CACHE_MS) {
    sessionGenCache.delete(userId);
    return undefined;
  }
  return hit.gen;
}

function writeSessionGenCache(userId, gen) {
  sessionGenCache.set(userId, { gen, ts: Date.now() });
}

export function clearHubSessionGenCache(userId) {
  if (userId) sessionGenCache.delete(String(userId));
  else sessionGenCache.clear();
}

async function ensureColumns() {
  if (columnReady || !process.env.DATABASE_URL) return;
  const sql = neon(process.env.DATABASE_URL);
  await sql`ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS session_gen TEXT NOT NULL DEFAULT ''`;
  columnReady = true;
}

/** Edge-safe lookup for hub session validation in middleware. */
export async function getHubUserSessionGen(userId) {
  const id = String(userId || '').trim();
  if (!id || !process.env.DATABASE_URL) return '';

  const cached = readSessionGenCache(id);
  if (cached !== undefined) return cached;

  try {
    await ensureColumns();
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT session_gen FROM hub_users WHERE id = ${id} LIMIT 1
    `;
    if (!rows.length) {
      writeSessionGenCache(id, null);
      return null;
    }
    const gen = String(rows[0]?.session_gen || '').trim();
    writeSessionGenCache(id, gen);
    return gen;
  } catch {
    return '';
  }
}

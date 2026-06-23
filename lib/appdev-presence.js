import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { personKey } from '@/lib/appdev';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'appdev-presence.json');
/** User is online if seen within this window. */
export const PRESENCE_TTL_MS = 90_000;

let tableReady = false;
let tableReadyPromise = null;

function useDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function sql() {
  return neon(process.env.DATABASE_URL);
}

async function ensureTable() {
  if (tableReady) return;
  if (!tableReadyPromise) {
    tableReadyPromise = sql()`
      CREATE TABLE IF NOT EXISTS appdev_presence (
        name_key TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(() => {
        tableReady = true;
      })
      .catch(err => {
        tableReadyPromise = null;
        throw err;
      });
  }
  await tableReadyPromise;
}

function readFilePresence() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FILE)) {
    writeFileSync(FILE, JSON.stringify({ sessions: [] }, null, 2));
  }
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return Array.isArray(raw?.sessions) ? raw.sessions : [];
}

function writeFilePresence(sessions) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ sessions }, null, 2));
}

function pruneSessions(sessions, now = Date.now()) {
  const cutoff = now - PRESENCE_TTL_MS;
  return sessions.filter(s => new Date(s.last_seen).getTime() >= cutoff);
}

export async function touchPresence(displayName) {
  const name = String(displayName || '').trim();
  const key = personKey(name);
  if (!key) return null;

  const now = new Date().toISOString();

  if (useDatabase()) {
    await ensureTable();
    await sql()`
      INSERT INTO appdev_presence (name_key, display_name, last_seen)
      VALUES (${key}, ${name}, ${now})
      ON CONFLICT (name_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        last_seen = EXCLUDED.last_seen
    `;
    await sql()`
      DELETE FROM appdev_presence
      WHERE last_seen < ${new Date(Date.now() - PRESENCE_TTL_MS).toISOString()}
    `;
    return { displayName: name, lastSeen: now };
  }

  const sessions = pruneSessions(readFilePresence());
  const idx = sessions.findIndex(s => personKey(s.display_name) === key);
  const entry = { display_name: name, last_seen: now };
  if (idx === -1) sessions.push(entry);
  else sessions[idx] = entry;
  writeFilePresence(sessions);
  return { displayName: name, lastSeen: now };
}

export async function listOnlinePresence() {
  const cutoff = new Date(Date.now() - PRESENCE_TTL_MS).toISOString();

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT display_name, last_seen
      FROM appdev_presence
      WHERE last_seen >= ${cutoff}
      ORDER BY last_seen DESC
    `;
    return rows.map(r => ({
      displayName: r.display_name,
      lastSeen: r.last_seen,
    }));
  }

  return pruneSessions(readFilePresence())
    .sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen))
    .map(s => ({
      displayName: s.display_name,
      lastSeen: s.last_seen,
    }));
}

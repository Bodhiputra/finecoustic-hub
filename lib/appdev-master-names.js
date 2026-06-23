import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { personKey } from '@/lib/appdev';
import { HARDCODED_MASTER_NAMES } from '@/lib/appdev-constants';

/** Admin display names — team password cannot use these; master password only. */
export { HARDCODED_MASTER_NAMES } from '@/lib/appdev-constants';

const HARDCODED_MASTER_KEYS = new Set(HARDCODED_MASTER_NAMES.map(name => personKey(name)));

function isHardcodedMasterName(displayName) {
  return HARDCODED_MASTER_KEYS.has(personKey(displayName));
}

/** Master password may only be used with these reserved admin names. */
export function isAllowedAdminLoginName(displayName) {
  return isHardcodedMasterName(displayName);
}

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'appdev-master-names.json');

let tableReady = false;
let tableReadyPromise = null;
const memKeys = new Set();

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
      CREATE TABLE IF NOT EXISTS appdev_master_names (
        name_key TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

function readFileStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FILE)) {
    writeFileSync(FILE, JSON.stringify({ names: [] }, null, 2));
  }
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  const names = Array.isArray(raw?.names) ? raw.names : [];
  return new Set(names.map(n => personKey(n)).filter(Boolean));
}

function writeFileStore(keys) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ names: [...keys] }, null, 2));
}

async function readDbKeys() {
  await ensureTable();
  const rows = await sql()`SELECT name_key FROM appdev_master_names`;
  return new Set(rows.map(r => r.name_key));
}

export async function claimMasterName(displayName) {
  const name = String(displayName || '').trim().slice(0, 80);
  const key = personKey(name);
  if (!key) return false;

  if (useDatabase()) {
    await ensureTable();
    await sql()`
      INSERT INTO appdev_master_names (name_key, display_name, claimed_at)
      VALUES (${key}, ${name}, NOW())
      ON CONFLICT (name_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        claimed_at = NOW()
    `;
  } else {
    const keys = readFileStore();
    keys.add(key);
    writeFileStore(keys);
    memKeys.add(key);
  }
  return true;
}

export async function isMasterOnlyName(displayName) {
  if (isHardcodedMasterName(displayName)) return true;

  const key = personKey(displayName);
  if (!key) return false;

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`SELECT 1 FROM appdev_master_names WHERE name_key = ${key} LIMIT 1`;
    return rows.length > 0;
  }

  if (memKeys.size) return memKeys.has(key);
  const keys = readFileStore();
  for (const k of keys) memKeys.add(k);
  return memKeys.has(key);
}

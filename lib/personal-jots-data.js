import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getNeonSql, hasDatabase } from '@/lib/neon-sql';
import { normalizePersonalJot } from '@/lib/personal-jots-shared';
import { personKey } from '@/lib/appdev';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'hub-personal-jots.json');

let tablesReady = false;
let tablesReadyPromise = null;

function sql() {
  return getNeonSql();
}

function useDatabase() {
  return hasDatabase();
}

async function ensureTables() {
  if (tablesReady) return;
  if (!tablesReadyPromise) {
    tablesReadyPromise = sql()`
      CREATE TABLE IF NOT EXISTS hub_personal_jots (
        id TEXT PRIMARY KEY,
        owner_key TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'Untitled',
        content TEXT NOT NULL DEFAULT '',
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(async () => {
        await sql()`CREATE INDEX IF NOT EXISTS hub_personal_jots_owner_idx ON hub_personal_jots (owner_key)`;
        tablesReady = true;
      })
      .catch(err => {
        tablesReadyPromise = null;
        throw err;
      });
  }
  await tablesReadyPromise;
}

function readFileStore() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FILE)) writeFileSync(FILE, JSON.stringify({ jots: [] }, null, 2));
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return Array.isArray(raw?.jots) ? raw.jots.map(normalizePersonalJot) : [];
}

function writeFileStore(jots) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ jots }, null, 2));
}

function rowToJot(row) {
  return normalizePersonalJot({
    id: row.id,
    owner_key: row.owner_key,
    title: row.title,
    content: row.content,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

function sortJots(items) {
  return [...items].sort(
    (a, b) => (b.updated_at || '').localeCompare(a.updated_at || '') || a.title.localeCompare(b.title)
  );
}

export async function listPersonalJotsForOwner(ownerKey) {
  const key = String(ownerKey || '').trim();
  if (!key) return [];

  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      SELECT * FROM hub_personal_jots
      WHERE owner_key = ${key}
      ORDER BY updated_at DESC, title ASC
    `;
    return sortJots(rows.map(rowToJot));
  }

  return sortJots(readFileStore().filter(j => j.owner_key === key));
}

export async function getPersonalJotById(id, ownerKey) {
  const jotId = String(id || '').trim();
  const key = String(ownerKey || '').trim();
  if (!jotId || !key) return null;

  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      SELECT * FROM hub_personal_jots
      WHERE id = ${jotId} AND owner_key = ${key}
      LIMIT 1
    `;
    return rows[0] ? rowToJot(rows[0]) : null;
  }

  return readFileStore().find(j => j.id === jotId && j.owner_key === key) || null;
}

export async function createPersonalJot(input, actor) {
  const ownerKey = personKey(actor?.displayName);
  if (!ownerKey) {
    const err = new Error('forbidden');
    err.status = 403;
    throw err;
  }

  const now = new Date().toISOString();
  const jot = normalizePersonalJot({
    id: randomUUID(),
    owner_key: ownerKey,
    title: input?.title || 'Untitled',
    content: input?.content || '',
    sort_order: Number(input?.sort_order) || 0,
    created_at: now,
    updated_at: now,
  });

  if (useDatabase()) {
    await ensureTables();
    await sql()`
      INSERT INTO hub_personal_jots (id, owner_key, title, content, sort_order, created_at, updated_at)
      VALUES (
        ${jot.id}, ${jot.owner_key}, ${jot.title}, ${jot.content}, ${jot.sort_order}, ${jot.created_at}, ${jot.updated_at}
      )
    `;
  } else {
    const all = readFileStore();
    all.push(jot);
    writeFileStore(all);
  }

  return jot;
}

export async function updatePersonalJot(id, patch, ownerKey) {
  const existing = await getPersonalJotById(id, ownerKey);
  if (!existing) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }

  const next = normalizePersonalJot({
    ...existing,
    ...patch,
    id: existing.id,
    owner_key: existing.owner_key,
    updated_at: new Date().toISOString(),
  });

  if (useDatabase()) {
    await ensureTables();
    await sql()`
      UPDATE hub_personal_jots SET
        title = ${next.title},
        content = ${next.content},
        sort_order = ${next.sort_order},
        updated_at = ${next.updated_at}
      WHERE id = ${next.id} AND owner_key = ${next.owner_key}
    `;
  } else {
    const all = readFileStore();
    const idx = all.findIndex(j => j.id === next.id);
    if (idx === -1) {
      const err = new Error('not_found');
      err.status = 404;
      throw err;
    }
    all[idx] = next;
    writeFileStore(all);
  }

  return next;
}

export async function deletePersonalJot(id, ownerKey) {
  const existing = await getPersonalJotById(id, ownerKey);
  if (!existing) return false;

  if (useDatabase()) {
    await ensureTables();
    const rows = await sql()`
      DELETE FROM hub_personal_jots
      WHERE id = ${id} AND owner_key = ${ownerKey}
      RETURNING id
    `;
    return rows.length > 0;
  }

  const all = readFileStore();
  const next = all.filter(j => j.id !== id);
  if (next.length === all.length) return false;
  writeFileStore(next);
  return true;
}

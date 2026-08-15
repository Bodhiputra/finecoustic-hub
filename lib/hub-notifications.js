import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getNeonSql, hasDatabase } from '@/lib/neon-sql';
import { personKey } from '@/lib/appdev';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'hub-notifications.json');
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let tableReady = false;
let tableReadyPromise = null;

function sql() {
  return getNeonSql();
}

function useDatabase() {
  return hasDatabase();
}

async function ensureTable() {
  if (tableReady) return;
  if (!tableReadyPromise) {
    tableReadyPromise = sql()`
      CREATE TABLE IF NOT EXISTS hub_notifications (
        id TEXT PRIMARY KEY,
        recipient_key TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        type TEXT NOT NULL,
        entity_type TEXT NOT NULL DEFAULT 'general',
        entity_id TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        actor_name TEXT NOT NULL DEFAULT '',
        payload JSONB NOT NULL DEFAULT '{}',
        dedupe_key TEXT,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(async () => {
        await sql()`CREATE INDEX IF NOT EXISTS hub_notifications_recipient_idx ON hub_notifications (recipient_key, created_at DESC)`;
        await sql()`CREATE UNIQUE INDEX IF NOT EXISTS hub_notifications_dedupe_idx ON hub_notifications (dedupe_key) WHERE dedupe_key IS NOT NULL`;
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
  if (!existsSync(FILE)) writeFileSync(FILE, JSON.stringify({ items: [] }, null, 2));
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return Array.isArray(raw?.items) ? raw.items : [];
}

function writeFileStore(items) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ items }, null, 2));
}

function pruneOld(items, now = Date.now()) {
  const cutoff = now - MAX_AGE_MS;
  return items.filter(n => new Date(n.created_at).getTime() >= cutoff);
}

function normalizeItem(row) {
  return {
    id: row.id,
    type: row.type,
    entity_type: row.entity_type || 'general',
    entity_id: row.entity_id || '',
    title: row.title || '',
    actor_name: row.actor_name || '',
    payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    read_at: row.read_at || null,
    created_at: row.created_at,
  };
}

export async function createHubNotification({
  recipientName,
  type,
  entityType = 'general',
  entityId = '',
  title = '',
  actorName = '',
  payload = {},
  dedupeKey = null,
}) {
  const name = String(recipientName || '').trim();
  const key = personKey(name);
  if (!key || !type) return null;

  const now = new Date().toISOString();
  const item = {
    id: randomUUID(),
    recipient_key: key,
    recipient_name: name,
    type: String(type),
    entity_type: String(entityType || 'general'),
    entity_id: String(entityId || ''),
    title: String(title || '').slice(0, 240),
    actor_name: String(actorName || '').slice(0, 80),
    payload: payload && typeof payload === 'object' ? payload : {},
    dedupe_key: dedupeKey ? String(dedupeKey) : null,
    read_at: null,
    created_at: now,
  };

  if (useDatabase()) {
    await ensureTable();
    try {
      await sql()`
        INSERT INTO hub_notifications (
          id, recipient_key, recipient_name, type, entity_type, entity_id,
          title, actor_name, payload, dedupe_key, read_at, created_at
        ) VALUES (
          ${item.id}, ${item.recipient_key}, ${item.recipient_name}, ${item.type},
          ${item.entity_type}, ${item.entity_id}, ${item.title}, ${item.actor_name},
          ${JSON.stringify(item.payload)}, ${item.dedupe_key}, NULL, ${item.created_at}
        )
      `;
    } catch (e) {
      if (String(e?.message || '').includes('hub_notifications_dedupe_idx')) return null;
      throw e;
    }
  } else {
    const items = pruneOld(readFileStore());
    if (item.dedupe_key && items.some(n => n.dedupe_key === item.dedupe_key)) return null;
    items.push(item);
    writeFileStore(items);
  }

  return normalizeItem(item);
}

export async function notifyMany(recipientNames, fields) {
  const names = [...new Set((recipientNames || []).map(n => String(n || '').trim()).filter(Boolean))];
  const created = [];
  for (const name of names) {
    const n = await createHubNotification({ ...fields, recipientName: name });
    if (n) created.push(n);
  }
  return created;
}

export async function listHubNotificationsForUser(displayName, { limit = 40 } = {}) {
  const key = personKey(displayName);
  if (!key) return [];

  let items;
  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT id, type, entity_type, entity_id, title, actor_name, payload, read_at, created_at
      FROM hub_notifications
      WHERE recipient_key = ${key}
      ORDER BY created_at DESC
      LIMIT ${Math.max(limit, 60)}
    `;
    items = rows.map(normalizeItem);
  } else {
    items = pruneOld(readFileStore())
      .filter(n => n.recipient_key === key)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(normalizeItem);
  }

  return items.slice(0, limit);
}

export async function countHubUnreadForUser(displayName) {
  const key = personKey(displayName);
  if (!key) return 0;

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT COUNT(*)::int AS c FROM hub_notifications
      WHERE recipient_key = ${key} AND read_at IS NULL
    `;
    return rows[0]?.c || 0;
  }

  return pruneOld(readFileStore()).filter(n => n.recipient_key === key && !n.read_at).length;
}

export async function markHubNotificationRead(id, displayName) {
  const key = personKey(displayName);
  if (!key || !id) return false;

  const now = new Date().toISOString();

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      UPDATE hub_notifications SET read_at = ${now}
      WHERE id = ${id} AND recipient_key = ${key} AND read_at IS NULL
      RETURNING id
    `;
    return rows.length > 0;
  }

  const items = readFileStore();
  let changed = false;
  for (const n of items) {
    if (n.id === id && n.recipient_key === key && !n.read_at) {
      n.read_at = now;
      changed = true;
      break;
    }
  }
  if (changed) writeFileStore(items);
  return changed;
}

export async function markAllHubNotificationsRead(displayName) {
  const key = personKey(displayName);
  if (!key) return 0;
  const now = new Date().toISOString();

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      UPDATE hub_notifications SET read_at = ${now}
      WHERE recipient_key = ${key} AND read_at IS NULL
      RETURNING id
    `;
    return rows.length;
  }

  const items = readFileStore();
  let count = 0;
  for (const n of items) {
    if (n.recipient_key === key && !n.read_at) {
      n.read_at = now;
      count += 1;
    }
  }
  if (count) writeFileStore(items);
  return count;
}

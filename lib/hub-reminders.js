import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getNeonSql, hasDatabase } from '@/lib/neon-sql';
import { personKey } from '@/lib/appdev';
import { createHubNotification } from '@/lib/hub-notifications';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'hub-reminders.json');

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
      CREATE TABLE IF NOT EXISTS hub_reminders (
        id TEXT PRIMARY KEY,
        user_key TEXT NOT NULL,
        user_name TEXT NOT NULL,
        title TEXT NOT NULL,
        due_at TIMESTAMPTZ NOT NULL,
        entity_type TEXT NOT NULL DEFAULT 'general',
        entity_id TEXT NOT NULL DEFAULT '',
        notified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(() => sql()`CREATE INDEX IF NOT EXISTS hub_reminders_user_due_idx ON hub_reminders (user_key, due_at)`)
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
  if (!existsSync(FILE)) writeFileSync(FILE, JSON.stringify({ items: [] }, null, 2));
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return Array.isArray(raw?.items) ? raw.items : [];
}

function writeFileStore(items) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ items }, null, 2));
}

function normalizeReminder(row) {
  return {
    id: row.id,
    user_key: row.user_key,
    user_name: row.user_name,
    title: row.title,
    due_at: row.due_at,
    entity_type: row.entity_type || 'general',
    entity_id: row.entity_id || '',
    notified_at: row.notified_at || null,
    created_at: row.created_at,
  };
}

export async function createReminder({ userName, title, dueAt, entityType = 'general', entityId = '' }) {
  const name = String(userName || '').trim();
  const key = personKey(name);
  const due = String(dueAt || '').trim();
  const label = String(title || '').trim();
  if (!key || !label || !due) {
    const err = new Error('invalid_payload');
    err.status = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const item = {
    id: randomUUID(),
    user_key: key,
    user_name: name,
    title: label.slice(0, 240),
    due_at: due,
    entity_type: String(entityType || 'general'),
    entity_id: String(entityId || ''),
    notified_at: null,
    created_at: now,
  };

  if (useDatabase()) {
    await ensureTable();
    await sql()`
      INSERT INTO hub_reminders (
        id, user_key, user_name, title, due_at, entity_type, entity_id, notified_at, created_at
      ) VALUES (
        ${item.id}, ${item.user_key}, ${item.user_name}, ${item.title}, ${item.due_at},
        ${item.entity_type}, ${item.entity_id}, NULL, ${item.created_at}
      )
    `;
  } else {
    const items = readFileStore();
    items.push(item);
    writeFileStore(items);
  }

  return normalizeReminder(item);
}

export async function listRemindersForUser(userName, { includePast = false } = {}) {
  const key = personKey(userName);
  if (!key) return [];

  const now = new Date().toISOString();
  let items;

  if (useDatabase()) {
    await ensureTable();
    const rows = includePast
      ? await sql()`
          SELECT * FROM hub_reminders WHERE user_key = ${key}
          ORDER BY due_at ASC
        `
      : await sql()`
          SELECT * FROM hub_reminders
          WHERE user_key = ${key} AND due_at >= ${now}::timestamptz - INTERVAL '7 days'
          ORDER BY due_at ASC
        `;
    items = rows.map(normalizeReminder);
  } else {
    items = readFileStore()
      .filter(r => r.user_key === key)
      .filter(r => includePast || new Date(r.due_at) >= new Date(now) - 7 * 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
      .map(normalizeReminder);
  }

  return items;
}

export async function deleteReminder(id, userName) {
  const key = personKey(userName);
  if (!key || !id) return false;

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      DELETE FROM hub_reminders WHERE id = ${id} AND user_key = ${key} RETURNING id
    `;
    return rows.length > 0;
  }

  const items = readFileStore();
  const next = items.filter(r => !(r.id === id && r.user_key === key));
  if (next.length === items.length) return false;
  writeFileStore(next);
  return true;
}

/** Fire notifications for due reminders (call on notification list fetch). */
export async function processDueReminders(userName) {
  const key = personKey(userName);
  if (!key) return 0;

  const now = new Date();
  let dueItems;

  if (useDatabase()) {
    await ensureTable();
    dueItems = await sql()`
      SELECT * FROM hub_reminders
      WHERE user_key = ${key}
        AND notified_at IS NULL
        AND due_at <= ${now.toISOString()}::timestamptz
    `;
  } else {
    dueItems = readFileStore().filter(
      r => r.user_key === key && !r.notified_at && new Date(r.due_at) <= now
    );
  }

  let count = 0;
  for (const row of dueItems) {
    const reminder = normalizeReminder(row);
    const n = await createHubNotification({
      recipientName: reminder.user_name,
      type: 'reminder_due',
      entityType: reminder.entity_type,
      entityId: reminder.entity_id,
      title: reminder.title,
      dedupeKey: `reminder:${reminder.id}`,
    });
    if (n) count += 1;

    const notifiedAt = new Date().toISOString();
    if (useDatabase()) {
      await sql()`UPDATE hub_reminders SET notified_at = ${notifiedAt} WHERE id = ${reminder.id}`;
    } else {
      const items = readFileStore();
      const item = items.find(r => r.id === reminder.id);
      if (item) {
        item.notified_at = notifiedAt;
        writeFileStore(items);
      }
    }
  }

  return count;
}

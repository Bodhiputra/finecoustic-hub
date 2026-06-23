import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { personKey } from '@/lib/appdev';
import { isMasterOnlyName } from '@/lib/appdev-master-names';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'appdev-users.json');

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
      CREATE TABLE IF NOT EXISTS appdev_users (
        id TEXT PRIMARY KEY,
        name_key TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL DEFAULT '', -- legacy column; auth uses shared APPDEV_PASSWORD
        blocked BOOLEAN NOT NULL DEFAULT FALSE,
        session_gen TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(async () => {
        await sql()`ALTER TABLE appdev_users ADD COLUMN IF NOT EXISTS session_gen TEXT NOT NULL DEFAULT ''`;
        tableReady = true;
      })
      .catch(err => {
        tableReadyPromise = null;
        throw err;
      });
  }
  await tableReadyPromise;
}

function readFileUsers() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(FILE)) {
    writeFileSync(FILE, JSON.stringify({ users: [] }, null, 2));
  }
  const raw = JSON.parse(readFileSync(FILE, 'utf8'));
  return Array.isArray(raw?.users) ? raw.users : [];
}

function writeFileUsers(users) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ users }, null, 2));
}

function normalizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name_key: row.name_key,
    display_name: row.display_name,
    blocked: Boolean(row.blocked),
    created_at: row.created_at,
  };
}

export async function findUserByName(displayName) {
  const key = personKey(displayName);
  if (!key) return null;

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT id, name_key, display_name, blocked, created_at
      FROM appdev_users
      WHERE name_key = ${key}
      LIMIT 1
    `;
    return normalizeUser(rows[0]);
  }

  const users = readFileUsers();
  return normalizeUser(users.find(u => u.name_key === key)) || null;
}

export async function findUserById(id) {
  if (!id) return null;

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT id, name_key, display_name, blocked, created_at
      FROM appdev_users
      WHERE id = ${id}
      LIMIT 1
    `;
    return normalizeUser(rows[0]);
  }

  const users = readFileUsers();
  return normalizeUser(users.find(u => u.id === id)) || null;
}

export async function listUsers() {
  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT id, name_key, display_name, blocked, created_at
      FROM appdev_users
      ORDER BY created_at DESC
    `;
    return rows.map(row => ({
      id: row.id,
      display_name: row.display_name,
      blocked: Boolean(row.blocked),
      created_at: row.created_at,
    }));
  }

  return readFileUsers()
    .map(u => ({
      id: u.id,
      display_name: u.display_name,
      blocked: Boolean(u.blocked),
      created_at: u.created_at,
    }))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

/** Display names of registered, non-blocked users — assignee picker pool. */
export async function listAssignablePeople() {
  const users = await listUsers();
  return users.filter(u => !u.blocked).map(u => u.display_name);
}

export async function createUser(displayName) {
  const name = String(displayName || '').trim().slice(0, 80);
  const key = personKey(name);
  if (!key) return { ok: false, reason: 'invalid_name' };
  if (await isMasterOnlyName(name)) return { ok: false, reason: 'name_reserved' };
  if (await findUserByName(name)) return { ok: false, reason: 'name_taken' };

  const user = {
    id: randomUUID(),
    name_key: key,
    display_name: name,
    blocked: false,
    session_gen: randomUUID(),
    created_at: new Date().toISOString(),
  };

  if (useDatabase()) {
    await ensureTable();
    await sql()`
      INSERT INTO appdev_users (id, name_key, display_name, password_hash, blocked, session_gen, created_at)
      VALUES (${user.id}, ${user.name_key}, ${user.display_name}, '', FALSE, ${user.session_gen}, ${user.created_at})
    `;
  } else {
    const users = readFileUsers();
    users.push(user);
    writeFileUsers(users);
  }

  return {
    ok: true,
    user: { id: user.id, display_name: user.display_name, session_gen: user.session_gen },
  };
}

/** Registered name lookup — team password is checked separately at login. */
export async function verifyRegisteredUser(displayName) {
  const user = await findUserByName(displayName);
  if (!user) return { ok: false, reason: 'not_registered' };
  if (user.blocked) return { ok: false, reason: 'blocked' };
  return {
    ok: true,
    user: { id: user.id, display_name: user.display_name },
  };
}

export async function setUserBlocked(id, blocked) {
  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      UPDATE appdev_users
      SET blocked = ${Boolean(blocked)}
      WHERE id = ${id}
      RETURNING id, display_name, blocked, created_at
    `;
    if (!rows.length) return null;
    return {
      id: rows[0].id,
      display_name: rows[0].display_name,
      blocked: Boolean(rows[0].blocked),
      created_at: rows[0].created_at,
    };
  }

  const users = readFileUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  users[idx].blocked = Boolean(blocked);
  writeFileUsers(users);
  return {
    id: users[idx].id,
    display_name: users[idx].display_name,
    blocked: users[idx].blocked,
    created_at: users[idx].created_at,
  };
}

export async function getUserSessionGen(userId) {
  if (!userId) return '';

  if (useDatabase()) {
    const { getUserSessionGen: getGen } = await import('./appdev-session-gen.js');
    return getGen(userId);
  }

  const users = readFileUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return null;
  return String(user.session_gen || '').trim();
}

/** New login/sign-up — invalidates other devices using the same name. */
export async function rotateUserSession(userId) {
  if (!userId) return '';

  const sessionGen = randomUUID();

  if (useDatabase()) {
    await ensureTable();
    await sql()`
      UPDATE appdev_users SET session_gen = ${sessionGen} WHERE id = ${userId}
    `;
    return sessionGen;
  }

  const users = readFileUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return '';
  users[idx].session_gen = sessionGen;
  writeFileUsers(users);
  return sessionGen;
}

export async function deleteUser(id) {
  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`DELETE FROM appdev_users WHERE id = ${id} RETURNING id`;
    return rows.length > 0;
  }

  const users = readFileUsers();
  const next = users.filter(u => u.id !== id);
  if (next.length === users.length) return false;
  writeFileUsers(next);
  return true;
}

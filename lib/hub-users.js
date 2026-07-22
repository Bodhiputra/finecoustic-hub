import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { personKey } from '@/lib/appdev';
import { isMasterOnlyName } from '@/lib/appdev-master-names';
import { hashPassword, validatePasswordStrength } from '@/lib/hub-password';
import { isTeamPassword } from '@/lib/hub-team-password';
import { clearHubSessionGenCache } from '@/lib/hub-session-gen';
import { PROTECTED_ASSIGNEE } from '@/lib/appdev-constants';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'hub-users.json');

const ROLES = ['manager', 'member', 'intern'];

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
      CREATE TABLE IF NOT EXISTS hub_users (
        id TEXT PRIMARY KEY,
        name_key TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'member',
        blocked BOOLEAN NOT NULL DEFAULT FALSE,
        must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
        session_gen TEXT NOT NULL DEFAULT '',
        sync_token TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
      .then(async () => {
        await sql()`ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE`;
        await sql()`ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS sync_token TEXT NOT NULL DEFAULT ''`;
        await sql()`ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'`;
        await sql()`ALTER TABLE hub_users ADD COLUMN IF NOT EXISTS session_gen TEXT NOT NULL DEFAULT ''`;
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
    role: row.role || 'member',
    blocked: Boolean(row.blocked),
    must_change_password: Boolean(row.must_change_password),
    session_gen: row.session_gen || '',
    sync_token: row.sync_token || '',
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  };
}

function defaultRoleForName(displayName) {
  return personKey(displayName) === personKey(PROTECTED_ASSIGNEE) ? 'manager' : 'member';
}

export async function findHubUserByName(displayName) {
  const key = personKey(displayName);
  if (!key) return null;

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT id, name_key, display_name, password_hash, role, blocked,
             must_change_password, session_gen, sync_token, created_at, updated_at
      FROM hub_users WHERE name_key = ${key} LIMIT 1
    `;
    if (!rows.length) return null;
    return { ...normalizeUser(rows[0]), password_hash: rows[0].password_hash };
  }

  const users = readFileUsers();
  const user = users.find(u => u.name_key === key);
  return user ? { ...normalizeUser(user), password_hash: user.password_hash } : null;
}

export async function findHubUserById(id) {
  if (!id) return null;

  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT id, name_key, display_name, password_hash, role, blocked,
             must_change_password, session_gen, sync_token, created_at, updated_at
      FROM hub_users WHERE id = ${id} LIMIT 1
    `;
    if (!rows.length) return null;
    return { ...normalizeUser(rows[0]), password_hash: rows[0].password_hash };
  }

  const users = readFileUsers();
  const user = users.find(u => u.id === id);
  return user ? { ...normalizeUser(user), password_hash: user.password_hash } : null;
}

export async function listHubUsers() {
  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      SELECT id, display_name, role, blocked, must_change_password, created_at, updated_at
      FROM hub_users ORDER BY created_at DESC
    `;
    return rows.map(row => normalizeUser(row));
  }

  return readFileUsers()
    .map(u => normalizeUser(u))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function createHubUser(displayName, password) {
  const name = String(displayName || '').trim().slice(0, 80);
  const key = personKey(name);
  if (!key) return { ok: false, reason: 'invalid_name' };
  if (await isMasterOnlyName(name)) return { ok: false, reason: 'name_reserved' };
  if (await findHubUserByName(name)) return { ok: false, reason: 'name_taken' };

  if (!isTeamPassword(password)) {
    return { ok: false, reason: 'invalid_team_password' };
  }

  const strength = validatePasswordStrength(password);
  if (!strength.ok) return { ok: false, reason: strength.reason };

  const now = new Date().toISOString();
  const user = {
    id: randomUUID(),
    name_key: key,
    display_name: name,
    password_hash: hashPassword(password),
    role: defaultRoleForName(name),
    blocked: false,
    must_change_password: false,
    session_gen: randomUUID(),
    sync_token: randomUUID().replace(/-/g, ''),
    created_at: now,
    updated_at: now,
  };

  if (useDatabase()) {
    await ensureTable();
    await sql()`
      INSERT INTO hub_users (
        id, name_key, display_name, password_hash, role, blocked,
        must_change_password, session_gen, sync_token, created_at, updated_at
      ) VALUES (
        ${user.id}, ${user.name_key}, ${user.display_name}, ${user.password_hash},
        ${user.role}, FALSE, FALSE, ${user.session_gen}, ${user.sync_token},
        ${user.created_at}, ${user.updated_at}
      )
    `;
  } else {
    const users = readFileUsers();
    users.push(user);
    writeFileUsers(users);
  }

  return {
    ok: true,
    user: {
      id: user.id,
      display_name: user.display_name,
      role: user.role,
      session_gen: user.session_gen,
      must_change_password: false,
    },
  };
}

export async function verifyHubUserCredentials(displayName, password) {
  const user = await findHubUserByName(displayName);
  if (!user) return { ok: false, reason: 'not_registered' };
  if (user.blocked) return { ok: false, reason: 'blocked' };
  if (!isTeamPassword(password)) {
    return { ok: false, reason: 'invalid_password' };
  }
  return {
    ok: true,
    user: {
      id: user.id,
      display_name: user.display_name,
      role: user.role,
      must_change_password: user.must_change_password,
    },
  };
}

export async function rotateHubUserSession(userId) {
  if (!userId) return '';
  const sessionGen = randomUUID();

  if (useDatabase()) {
    await ensureTable();
    await sql()`UPDATE hub_users SET session_gen = ${sessionGen}, updated_at = NOW() WHERE id = ${userId}`;
    clearHubSessionGenCache(userId);
    return sessionGen;
  }

  const users = readFileUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return '';
  users[idx].session_gen = sessionGen;
  users[idx].updated_at = new Date().toISOString();
  writeFileUsers(users);
  clearHubSessionGenCache(userId);
  return sessionGen;
}

export async function updateHubUserProfile(userId, { displayName } = {}) {
  const user = await findHubUserById(userId);
  if (!user) return { ok: false, reason: 'not_found' };

  const name = String(displayName ?? user.display_name).trim().slice(0, 80);
  const key = personKey(name);
  if (!key) return { ok: false, reason: 'invalid_name' };
  if (await isMasterOnlyName(name) && personKey(user.display_name) !== key) {
    return { ok: false, reason: 'name_reserved' };
  }

  const existing = await findHubUserByName(name);
  if (existing && existing.id !== userId) return { ok: false, reason: 'name_taken' };

  if (useDatabase()) {
    await ensureTable();
    await sql()`
      UPDATE hub_users
      SET display_name = ${name}, name_key = ${key}, updated_at = NOW()
      WHERE id = ${userId}
    `;
  } else {
    const users = readFileUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return { ok: false, reason: 'not_found' };
    users[idx].display_name = name;
    users[idx].name_key = key;
    users[idx].updated_at = new Date().toISOString();
    writeFileUsers(users);
  }

  return { ok: true, display_name: name };
}

export async function setHubUserBlocked(id, blocked) {
  if (useDatabase()) {
    await ensureTable();
    const rows = await sql()`
      UPDATE hub_users SET blocked = ${Boolean(blocked)}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, display_name, role, blocked, must_change_password, created_at, updated_at
    `;
    if (!rows.length) return null;
    return normalizeUser(rows[0]);
  }

  const users = readFileUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  users[idx].blocked = Boolean(blocked);
  users[idx].updated_at = new Date().toISOString();
  writeFileUsers(users);
  return normalizeUser(users[idx]);
}

export async function deleteHubUser(id) {
  if (!id) return false;

  if (useDatabase()) {
    await ensureTable();
    const deleted = await sql()`
      DELETE FROM hub_users WHERE id = ${id} RETURNING id
    `;
    if (deleted.length) clearHubSessionGenCache(id);
    return deleted.length > 0;
  }

  const users = readFileUsers();
  const next = users.filter(u => u.id !== id);
  if (next.length === users.length) return false;
  writeFileUsers(next);
  clearHubSessionGenCache(id);
  return true;
}

export async function getHubUserSessionGen(userId) {
  if (!userId) return '';

  if (useDatabase()) {
    const { getHubUserSessionGen: getGen } = await import('./hub-session-gen.js');
    return getGen(userId);
  }

  const users = readFileUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return null;
  return String(user.session_gen || '').trim();
}

export async function getHubUserSyncToken(userId) {
  const user = await findHubUserById(userId);
  if (!user) return '';
  if (user.sync_token) return user.sync_token;

  const syncToken = randomUUID().replace(/-/g, '');
  if (useDatabase()) {
    await ensureTable();
    await sql()`UPDATE hub_users SET sync_token = ${syncToken} WHERE id = ${userId}`;
  } else {
    const users = readFileUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx].sync_token = syncToken;
      writeFileUsers(users);
    }
  }
  return syncToken;
}

export function isManagerRole(role) {
  return role === 'manager';
}

export { ROLES };

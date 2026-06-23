import { neon } from '@neondatabase/serverless';

export const MAX_LOGIN_FAILURES = 5;
export const LOCKOUT_MS = 5 * 60 * 1000;

const memStore = new Map();
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
      CREATE TABLE IF NOT EXISTS login_rate_limits (
        key TEXT PRIMARY KEY,
        failures INT NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

function storeKey(ip, realm) {
  return `${realm}:${ip}`;
}

export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

async function readMem(key) {
  const row = memStore.get(key);
  if (!row) return { failures: 0, lockedUntil: 0 };
  if (row.lockedUntil && row.lockedUntil <= Date.now()) {
    memStore.delete(key);
    return { failures: 0, lockedUntil: 0 };
  }
  return row;
}

async function readDb(key) {
  await ensureTable();
  const rows = await sql()`
    SELECT failures, locked_until
    FROM login_rate_limits
    WHERE key = ${key}
  `;
  if (!rows.length) return { failures: 0, lockedUntil: 0 };
  const lockedUntil = rows[0].locked_until ? new Date(rows[0].locked_until).getTime() : 0;
  if (lockedUntil && lockedUntil <= Date.now()) {
    await sql()`DELETE FROM login_rate_limits WHERE key = ${key}`;
    return { failures: 0, lockedUntil: 0 };
  }
  return { failures: rows[0].failures || 0, lockedUntil };
}

async function writeMem(key, failures, lockedUntil) {
  if (failures <= 0 && !lockedUntil) {
    memStore.delete(key);
    return;
  }
  memStore.set(key, { failures, lockedUntil });
}

async function writeDb(key, failures, lockedUntil) {
  await ensureTable();
  const lockedUntilIso = lockedUntil ? new Date(lockedUntil).toISOString() : null;
  if (failures <= 0 && !lockedUntil) {
    await sql()`DELETE FROM login_rate_limits WHERE key = ${key}`;
    return;
  }
  await sql()`
    INSERT INTO login_rate_limits (key, failures, locked_until, updated_at)
    VALUES (${key}, ${failures}, ${lockedUntilIso}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      failures = EXCLUDED.failures,
      locked_until = EXCLUDED.locked_until,
      updated_at = NOW()
  `;
}

async function readState(key) {
  return useDatabase() ? readDb(key) : readMem(key);
}

async function writeState(key, failures, lockedUntil) {
  return useDatabase() ? writeDb(key, failures, lockedUntil) : writeMem(key, failures, lockedUntil);
}

export function attemptsLeftFromFailures(failures) {
  return Math.max(0, MAX_LOGIN_FAILURES - failures);
}

export async function getLoginRateLimitStatus(ip, realm) {
  const key = storeKey(ip, realm);
  const { failures, lockedUntil } = await readState(key);
  if (lockedUntil && lockedUntil > Date.now()) {
    return {
      allowed: false,
      failures,
      attemptsLeft: 0,
      retryAfterSec: Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000)),
    };
  }
  return {
    allowed: true,
    failures,
    attemptsLeft: attemptsLeftFromFailures(failures),
    retryAfterSec: 0,
  };
}

export async function checkLoginRateLimit(ip, realm) {
  const status = await getLoginRateLimitStatus(ip, realm);
  return {
    allowed: status.allowed,
    retryAfterSec: status.retryAfterSec,
    attemptsLeft: status.attemptsLeft,
    failures: status.failures,
  };
}

export async function recordLoginFailure(ip, realm) {
  const key = storeKey(ip, realm);
  const { failures } = await readState(key);
  const nextFailures = failures + 1;
  const lockedUntil = nextFailures >= MAX_LOGIN_FAILURES ? Date.now() + LOCKOUT_MS : 0;
  await writeState(key, lockedUntil ? MAX_LOGIN_FAILURES : nextFailures, lockedUntil);
  return {
    locked: Boolean(lockedUntil),
    retryAfterSec: lockedUntil ? Math.ceil(LOCKOUT_MS / 1000) : 0,
    attemptsLeft: lockedUntil ? 0 : attemptsLeftFromFailures(nextFailures),
  };
}

export async function recordLoginSuccess(ip, realm) {
  const key = storeKey(ip, realm);
  await writeState(key, 0, 0);
}

#!/usr/bin/env node
/**
 * Pre-deploy auth smoke tests.
 * Usage: node scripts/test-auth.mjs [baseUrl]
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const base = process.argv[2] || 'http://localhost:3000';

function loadEnvLocal() {
  const envPath = join(root, '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const {
  signToken,
  verifyToken,
  verifyAppdevToken,
  SESSION_REALMS,
  resolveSessionAccess,
} = await import('../lib/session-token.js');
const { getAppdevPasswordVersion } = await import('../lib/appdev-pwv.js');

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function fail(label, detail = '') {
  failed += 1;
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
}

function assert(condition, label, detail = '') {
  if (condition) ok(label);
  else fail(label, detail);
}

function parseCookies(setCookieHeaders) {
  const jar = {};
  for (const header of setCookieHeaders || []) {
    const part = header.split(';')[0];
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    jar[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return jar;
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function signup(name, password = process.env.APPDEV_PASSWORD || '') {
  const res = await fetch(`${base}/api/auth/appdev/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: name, password }),
  });
  const data = await res.json().catch(() => ({}));
  const cookies = parseCookies(res.headers.getSetCookie?.() || []);
  return { res, data, cookies };
}

async function login(endpoint, password, displayName = 'Test User') {
  const res = await fetch(`${base}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password,
      ...(endpoint.includes('appdev') ? { displayName } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  const cookies = parseCookies(res.headers.getSetCookie?.() || []);
  return { res, data, cookies };
}

async function getWithCookies(path, jar) {
  return fetch(`${base}${path}`, {
    headers: { Cookie: cookieHeader(jar) },
  });
}

console.log('\n=== Session token unit tests ===');

const hubToken = await signToken(SESSION_REALMS.HUB);
const appdevToken = await signToken(SESSION_REALMS.APPDEV, undefined, {
  pwv: await getAppdevPasswordVersion(),
  displayName: 'Test User',
});
const adminToken = await signToken(SESSION_REALMS.ADMIN);

assert(await verifyToken(hubToken, SESSION_REALMS.HUB), 'hub token verifies');
assert(await verifyToken(appdevToken, SESSION_REALMS.APPDEV), 'appdev token verifies');
assert(await verifyAppdevToken(appdevToken), 'appdev token verifies with pwv');
assert(!(await verifyAppdevToken(await signToken(SESSION_REALMS.APPDEV))), 'appdev token without pwv rejected');
assert(await verifyToken(adminToken, SESSION_REALMS.ADMIN), 'admin token verifies');
assert(!(await verifyToken(hubToken, SESSION_REALMS.ADMIN)), 'hub token rejected as admin');
assert(!(await verifyToken('forged.payload', SESSION_REALMS.ADMIN)), 'forged token rejected');
assert(!(await verifyToken('1', SESSION_REALMS.ADMIN)), 'legacy admin=1 style rejected');

const access = await resolveSessionAccess({
  get: name => {
    if (name === 'finehub_admin') return { value: adminToken };
    if (name === 'finehub_session') return { value: hubToken };
    if (name === 'appdev_session') return { value: appdevToken };
    return undefined;
  },
});
assert(access.isAdmin && access.hasHub && access.hasAppdev, 'admin resolves full access');

const adminOnlyAccess = await resolveSessionAccess({
  get: name => (name === 'finehub_admin' ? { value: adminToken } : undefined),
});
assert(adminOnlyAccess.isAdmin && !adminOnlyAccess.hasAppdev, 'admin cookie alone does not grant appdev');

const hubOnlyAccess = await resolveSessionAccess({
  get: name => (name === 'finehub_session' ? { value: hubToken } : undefined),
});
assert(hubOnlyAccess.hasHub && !hubOnlyAccess.hasAppdev, 'hub session does not grant appdev access');

const forgedAccess = await resolveSessionAccess({
  get: name => (name === 'finehub_admin' ? { value: '1' } : undefined),
});
assert(!forgedAccess.isAdmin && !forgedAccess.hasHub && !forgedAccess.hasAppdev, 'forged admin cookie blocked');

console.log(`\n=== HTTP auth tests (${base}) ===`);

let serverUp = true;
try {
  const ping = await fetch(base, { redirect: 'manual' });
  assert(ping.status > 0, `server reachable (${ping.status})`);
} catch (err) {
  serverUp = false;
  fail('server reachable', err.message);
}

if (serverUp) {
  const master = process.env.HUB_MASTER_PASSWORD || '';
  const appdevPw = process.env.APPDEV_PASSWORD || '';
  const hubPw = process.env.OPS_HUB_PASSWORD || '';
  const sessionSecret = process.env.SESSION_SECRET || '';

  assert(Boolean(sessionSecret), 'SESSION_SECRET set in env');
  assert(Boolean(master), 'HUB_MASTER_PASSWORD set in env');

  if (master) {
    const masterLogin = await login('/api/auth/appdev/login', master, 'FCS-建宏');
    assert(masterLogin.res.ok, 'master login succeeds', String(masterLogin.res.status));
    assert(masterLogin.data.admin === true, 'master login returns admin flag');
    assert(Boolean(masterLogin.cookies.finehub_admin), 'admin cookie issued');
    assert(Boolean(masterLogin.cookies.appdev_session), 'appdev cookie issued');
    assert(
      masterLogin.cookies.appdev_session !== appdevPw,
      'appdev cookie is signed (not raw password)'
    );
    assert(
      masterLogin.cookies.finehub_admin !== '1',
      'admin cookie is signed (not literal 1)'
    );

    const wrongAdminName = await login('/api/auth/appdev/login', master, 'FCS-Jian');
    assert(wrongAdminName.res.status === 403, 'master login rejects non-admin name');
    assert(wrongAdminName.data.error === 'admin_name_required', 'wrong admin name error code');

    const logoutRes = await fetch(`${base}/api/auth/appdev/logout`, {
      method: 'POST',
      headers: { Cookie: cookieHeader(masterLogin.cookies) },
    });
    assert(logoutRes.ok, 'appdev logout succeeds');
    const logoutCookies = parseCookies(logoutRes.headers.getSetCookie?.() || []);
    const afterLogout = { ...masterLogin.cookies };
    for (const [k, v] of Object.entries(logoutCookies)) {
      if (v === '') delete afterLogout[k];
    }
    const meAfterLogout = await fetch(`${base}/api/auth/me`, {
      headers: { Cookie: cookieHeader(afterLogout) },
    });
    const meAfterLogoutData = await meAfterLogout.json();
    assert(!meAfterLogoutData.appdev, 'appdev access cleared after logout');
    assert(!meAfterLogoutData.admin, 'admin flag cleared after appdev logout');

    const masterLogin2 = await login('/api/auth/appdev/login', master, 'FCS-建宏');
    const me = await fetch(`${base}/api/auth/me`, {
      headers: { Cookie: cookieHeader(masterLogin2.cookies) },
    });
    const meData = await me.json();
    assert(me.ok && meData.admin === true, '/api/auth/me reports admin');

    const board = await getWithCookies('/api/appdev/issues', masterLogin2.cookies);
    assert(board.ok, 'admin can access appdev API', String(board.status));

    const usersApi = await getWithCookies('/api/appdev/admin/users', masterLogin2.cookies);
    assert(usersApi.ok, 'admin can list appdev users', String(usersApi.status));
  }

  if (appdevPw) {
    const devName = `AuthTest-${Date.now()}`;

    const created = await signup(devName);
    assert(created.res.ok, 'appdev signup succeeds', String(created.res.status));
    assert(!created.data.admin, 'signup user is not admin');

    const duplicate = await signup(devName);
    assert(duplicate.res.status === 409, 'duplicate signup returns 409 name_taken');

    const devLogin = await login('/api/auth/appdev/login', appdevPw, devName);
    assert(devLogin.res.ok, 'appdev user login with team password');
    assert(
      devLogin.cookies.appdev_session !== appdevPw,
      'appdev session cookie is signed'
    );

    const firstSession = { ...devLogin.cookies };
    const meFirst = await getWithCookies('/api/auth/me', firstSession);
    const meFirstData = await meFirst.json();
    assert(meFirst.ok && meFirstData.appdev, 'first session is active');

    const relogin = await login('/api/auth/appdev/login', appdevPw, devName);
    assert(relogin.res.ok, 'second login on same name succeeds');

    const meStale = await getWithCookies('/api/auth/me', firstSession);
    const meStaleData = await meStale.json();
    assert(!meStaleData.appdev, 'first device session revoked after login elsewhere');

    const boardStale = await getWithCookies('/api/appdev/issues', firstSession);
    assert(boardStale.status === 401, 'stale session blocked from appdev API', String(boardStale.status));

    const meSecond = await getWithCookies('/api/auth/me', relogin.cookies);
    const meSecondData = await meSecond.json();
    assert(meSecond.ok && meSecondData.appdev, 'second session is active');

    const masterNameBlocked = await login('/api/auth/appdev/login', appdevPw, 'FCS-建宏');
    assert(masterNameBlocked.res.status === 403, 'FCS-建宏 + team password blocked');

    const bad = await login('/api/auth/appdev/login', 'definitely-wrong-password', devName);
    assert(bad.res.status === 401, 'wrong password returns 401');
  }

  if (hubPw) {
    const hubLogin = await login('/api/auth/login', hubPw);
    assert(hubLogin.res.ok, 'hub password login succeeds');
    assert(hubLogin.cookies.finehub_session !== hubPw, 'hub session cookie is signed');
  }

  console.log('\n=== Rate limit test (uses test IP header) ===');
  const rateIp = `test-${Date.now()}`;
  let locked = false;
  for (let i = 1; i <= 6; i += 1) {
    const res = await fetch(`${base}/api/auth/appdev/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': rateIp,
      },
      body: JSON.stringify({
        password: 'wrong-password-for-rate-test',
        displayName: 'Rate Limit Test',
      }),
    });
    if (i < 5) {
      if (res.status !== 401) fail(`attempt ${i} expected 401`, String(res.status));
    } else if (res.status === 429) {
      locked = true;
      ok(`attempt ${i} triggers lockout (429)`);
    } else {
      fail(`attempt ${i} expected 429 lockout`, String(res.status));
    }
  }
  if (locked) {
    const blocked = await fetch(`${base}/api/auth/appdev/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': rateIp,
      },
      body: JSON.stringify({
        password: process.env.APPDEV_PASSWORD || 'x',
        displayName: 'Rate Limit Test',
      }),
    });
    assert(blocked.status === 429, 'locked IP blocked even with correct password');
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);

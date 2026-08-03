#!/usr/bin/env node
/**
 * Flush production preorder survey rows via hub-authenticated API.
 * Usage:
 *   HUB_MASTER_PASSWORD=... node scripts/remote-flush-preorder-survey.mjs https://finehub.vercel.app
 */

const base = (process.argv[2] || 'https://finehub.vercel.app').replace(/\/$/, '');
const password = (process.env.HUB_MASTER_PASSWORD || process.env.OPS_HUB_PASSWORD || '').trim();
const displayName = (process.env.HUB_ADMIN_NAME || 'FCS-建宏').trim();

if (!password) {
  console.error('Set HUB_MASTER_PASSWORD for hub admin login.');
  process.exit(1);
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

const loginRes = await fetch(`${base}/api/auth/hub/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password, displayName }),
});

const loginJson = await loginRes.json().catch(() => ({}));
if (!loginRes.ok) {
  console.error('Hub login failed:', loginJson.error || loginRes.status);
  process.exit(1);
}

const cookies = parseCookies(loginRes.headers.getSetCookie?.() || []);
const flushRes = await fetch(`${base}/api/preorder-survey/flush`, {
  method: 'POST',
  headers: {
    Cookie: cookieHeader(cookies),
  },
});

const flushJson = await flushRes.json().catch(() => ({}));
if (!flushRes.ok) {
  console.error('Flush failed:', flushJson.error || flushRes.status);
  process.exit(1);
}

console.log('Flush OK:', flushJson);

/** HMAC-signed session tokens — Edge + Node compatible (Web Crypto). */

export const SESSION_REALMS = {
  HUB: 'hub',
  APPDEV: 'appdev',
  ADMIN: 'admin',
};

const DEFAULT_MAX_AGE_SEC = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let keyPromise = null;

function getSecret() {
  const secret = (process.env.SESSION_SECRET || '').trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production');
  }
  return 'finehub-dev-secret-not-for-production';
}

function importKey() {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      'raw',
      encoder.encode(getSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    );
  }
  return keyPromise;
}

function base64urlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const binary = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function signToken(realm, maxAgeSec = DEFAULT_MAX_AGE_SEC, extra = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    r: realm,
    exp: now + maxAgeSec,
    iat: now,
    n: crypto.randomUUID(),
  };
  const displayName = String(extra.displayName || '').trim().slice(0, 80);
  if (displayName) payload.d = displayName;
  const userId = String(extra.userId || '').trim();
  if (userId) payload.u = userId;
  const sessionGen = String(extra.sessionGen || '').trim();
  if (sessionGen) payload.sg = sessionGen;
  const pwv = String(extra.pwv || '').trim();
  if (pwv) payload.pwv = pwv;
  if (extra.mustChangePassword) payload.mcp = 1;

  const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await importKey();
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  return `${payloadB64}.${base64urlEncode(new Uint8Array(sig))}`;
}

export async function verifyToken(token, expectedRealm) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const dot = token.indexOf('.');
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await importKey();
    const sig = base64urlDecode(sigB64);
    const valid = await crypto.subtle.verify('HMAC', key, sig, encoder.encode(payloadB64));
    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(base64urlDecode(payloadB64)));
    if (payload.r !== expectedRealm) return null;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Signature + password version only (no session generation check). */
export async function verifyAppdevTokenLight(token) {
  const { getAppdevPasswordVersion } = await import('./appdev-pwv.js');
  const payload = await verifyToken(token, SESSION_REALMS.APPDEV);
  if (!payload) return null;
  if (payload.pwv !== (await getAppdevPasswordVersion())) return null;
  return payload;
}

async function hubSessionGenMatchesDb(payload) {
  const userId = String(payload.u || '').trim();
  if (!userId || !process.env.DATABASE_URL) return true;

  try {
    const { getHubUserSessionGen } = await import('./hub-session-gen.js');
    const activeGen = await getHubUserSessionGen(userId);
    if (activeGen === null) return false;
    if (!activeGen) return true;
    const tokenGen = String(payload.sg || '').trim();
    return Boolean(tokenGen && tokenGen === activeGen);
  } catch {
    return false;
  }
}

export async function verifyHubTokenForGate(token) {
  const payload = await verifyToken(token, SESSION_REALMS.HUB);
  if (!payload) return null;
  if (!(await hubSessionGenMatchesDb(payload))) return null;
  return payload;
}

async function sessionGenMatchesDb(payload) {
  const userId = String(payload.u || '').trim();
  if (!userId || !process.env.DATABASE_URL) return true;

  try {
    const { getUserSessionGen } = await import('./appdev-session-gen.js');
    const activeGen = await getUserSessionGen(userId);
    if (activeGen === null) return false;
    if (!activeGen) return true;
    const tokenGen = String(payload.sg || '').trim();
    return Boolean(tokenGen && tokenGen === activeGen);
  } catch {
    return false;
  }
}

/** Middleware / cookie gate — includes DB session generation when DATABASE_URL is set. */
export async function verifyAppdevTokenForGate(token) {
  const payload = await verifyAppdevTokenLight(token);
  if (!payload) return null;
  if (!(await sessionGenMatchesDb(payload))) return null;
  return payload;
}

/** Alias kept for tests and legacy imports — gate checks only (Edge-safe). */
export async function verifyAppdevToken(token) {
  return verifyAppdevTokenForGate(token);
}

export async function resolveSessionAccess(cookies) {
  const adminToken = cookies.get('finehub_admin')?.value;
  const hubToken = cookies.get('finehub_session')?.value;
  const appdevToken = cookies.get('appdev_session')?.value;

  const isAdmin = Boolean(await verifyToken(adminToken, SESSION_REALMS.ADMIN));

  let hasHub = isAdmin;
  if (!hasHub && hubToken) {
    const gated = await verifyHubTokenForGate(hubToken);
    if (gated) {
      hasHub = true;
    } else {
      const legacy = await verifyToken(hubToken, SESSION_REALMS.HUB);
      if (legacy && !legacy.u) hasHub = true;
    }
  }

  const hasAppdev = Boolean(await verifyAppdevTokenForGate(appdevToken));

  return { isAdmin, hasHub, hasAppdev };
}

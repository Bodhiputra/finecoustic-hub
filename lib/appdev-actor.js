import { cookies } from 'next/headers';
import {
  APPDEV_COOKIE,
  ADMIN_COOKIE,
  isAppdevAuthEnabled,
} from '@/lib/auth';
import { verifyAppdevTokenForGate, verifyAppdevTokenLight, verifyToken, SESSION_REALMS } from '@/lib/session-token';
import { findUserById } from '@/lib/appdev-users';

/** Server-trusted appdev actor — single token verify + at most one user lookup. */
export async function resolveAppdevActor() {
  if (!isAppdevAuthEnabled()) {
    return { ok: true, displayName: '', isAdmin: true, authDisabled: true };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(APPDEV_COOKIE)?.value;
  const payload = token ? await verifyAppdevTokenForGate(token) : null;

  if (!payload?.d) {
    const light = token ? await verifyAppdevTokenLight(token) : null;
    if (light?.u) {
      const user = await findUserById(light.u);
      if (!user) {
        return { ok: false, reason: 'account_deleted', isAdmin: false, displayName: '' };
      }
      if (user.blocked) {
        return { ok: false, reason: 'blocked', isAdmin: false, displayName: '' };
      }
      return { ok: false, reason: 'session_revoked', isAdmin: false, displayName: '' };
    }
    return { ok: false, reason: 'unauthorized', isAdmin: false, displayName: '' };
  }

  const isAdmin = Boolean(await verifyToken(cookieStore.get(ADMIN_COOKIE)?.value, SESSION_REALMS.ADMIN));

  if (payload.u) {
    const user = await findUserById(payload.u);
    if (!user) {
      return { ok: false, reason: 'account_deleted', isAdmin: false, displayName: '' };
    }
    if (user.blocked) {
      return { ok: false, reason: 'blocked', isAdmin: false, displayName: '' };
    }
  }

  return {
    ok: true,
    displayName: payload.d,
    userId: payload.u || '',
    isAdmin,
    authDisabled: false,
  };
}

export async function readAppdevSessionFromCookies(cookieStore) {
  const token = cookieStore.get(APPDEV_COOKIE)?.value;
  return token ? verifyAppdevTokenForGate(token) : null;
}

export async function readAppdevDisplayNameFromCookies(cookieStore) {
  const payload = await readAppdevSessionFromCookies(cookieStore);
  return String(payload?.d || '').trim();
}

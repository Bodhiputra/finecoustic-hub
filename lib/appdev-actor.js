import { cookies } from 'next/headers';
import {
  APPDEV_COOKIE,
  isAppdevAuthEnabled,
  isAdminSession,
  isAppdevAuthenticated,
} from '@/lib/auth';
import { verifyAppdevTokenForGate, verifyAppdevTokenLight } from '@/lib/session-token';
import { findUserById, getUserSessionGen } from '@/lib/appdev-users';

async function verifyAppdevSessionToken(token) {
  const payload = await verifyAppdevTokenForGate(token);
  if (!payload) return null;

  const userId = String(payload.u || '').trim();
  if (userId && !process.env.DATABASE_URL) {
    const activeGen = await getUserSessionGen(userId);
    if (activeGen === null) return null;
    if (activeGen) {
      const tokenGen = String(payload.sg || '').trim();
      if (!tokenGen || tokenGen !== activeGen) return null;
    }
  }

  return payload;
}

export async function readAppdevSessionFromCookies(cookieStore) {
  const token = cookieStore.get(APPDEV_COOKIE)?.value;
  return verifyAppdevSessionToken(token);
}

export async function readAppdevDisplayNameFromCookies(cookieStore) {
  const payload = await readAppdevSessionFromCookies(cookieStore);
  return String(payload?.d || '').trim();
}

/** Server-trusted appdev actor — never use client-sent names for permissions. */
export async function resolveAppdevActor() {
  if (!isAppdevAuthEnabled()) {
    return { ok: true, displayName: '', isAdmin: true, authDisabled: true };
  }

  const cookieStore = await cookies();
  const rawToken = cookieStore.get(APPDEV_COOKIE)?.value;
  const lightPayload = await verifyAppdevTokenLight(rawToken);

  const authed = await isAppdevAuthenticated();
  if (!authed) {
    if (lightPayload?.u) {
      const user = await findUserById(lightPayload.u);
      if (!user) {
        return { ok: false, reason: 'account_deleted', isAdmin: false, displayName: '' };
      }
      if (user.blocked) {
        return { ok: false, reason: 'blocked', isAdmin: false, displayName: '' };
      }
      return { ok: false, reason: 'session_revoked', isAdmin: false, displayName: '' };
    }
    return { ok: false, reason: 'unauthorized' };
  }

  const isAdmin = await isAdminSession();
  if (isAdmin) {
    const displayName = await readAppdevDisplayNameFromCookies(cookieStore);
    if (!displayName) {
      return { ok: false, reason: 'unauthorized', isAdmin: true, displayName: '' };
    }
    return {
      ok: true,
      displayName,
      isAdmin: true,
      authDisabled: false,
    };
  }

  const payload = await readAppdevSessionFromCookies(cookieStore);
  if (!payload?.d) {
    return { ok: false, reason: 'unauthorized', isAdmin: false, displayName: '' };
  }

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
    isAdmin: false,
    authDisabled: false,
  };
}

import { cookies } from 'next/headers';
import {
  resolveSessionAccess,
  signToken,
  verifyToken,
  SESSION_REALMS,
} from '@/lib/session-token';
import { getAppdevPasswordVersion } from '@/lib/appdev-pwv';

export const HUB_COOKIE = 'finehub_session';
export const APPDEV_COOKIE = 'appdev_session';
export const ADMIN_COOKIE = 'finehub_admin';

export function getHubPassword() {
  return (process.env.OPS_HUB_PASSWORD || '').trim();
}

export function getAppdevPassword() {
  return (process.env.APPDEV_PASSWORD || '').trim();
}

export function isHubAuthEnabled() {
  return Boolean(getHubPassword());
}

export function isAppdevAuthEnabled() {
  return Boolean(getAppdevPassword());
}

export async function isAdminSession() {
  const cookieStore = await cookies();
  return Boolean(await verifyToken(cookieStore.get(ADMIN_COOKIE)?.value, SESSION_REALMS.ADMIN));
}

export async function isHubAuthenticated() {
  if (!isHubAuthEnabled()) return true;
  const cookieStore = await cookies();
  const access = await resolveSessionAccess({
    get: name => cookieStore.get(name),
  });
  return access.hasHub;
}

export async function isAppdevAuthenticated() {
  if (!isAppdevAuthEnabled()) return true;
  const cookieStore = await cookies();
  const access = await resolveSessionAccess({
    get: name => cookieStore.get(name),
  });
  return access.hasAppdev;
}

export function authCookieOptions(name, path, maxAge = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path,
    maxAge,
  };
}

export async function setHubSessionCookie(res) {
  res.cookies.set(HUB_COOKIE, await signToken(SESSION_REALMS.HUB), authCookieOptions(HUB_COOKIE, '/'));
}

export async function setAppdevSessionCookie(res, { displayName = '', userId = '', sessionGen = '' } = {}) {
  const name = String(displayName || '').trim().slice(0, 80);
  const extra = {
    pwv: await getAppdevPasswordVersion(),
  };
  if (name) extra.displayName = name;
  if (userId) extra.userId = userId;
  if (sessionGen) extra.sessionGen = sessionGen;
  res.cookies.set(
    APPDEV_COOKIE,
    await signToken(SESSION_REALMS.APPDEV, undefined, extra),
    authCookieOptions(APPDEV_COOKIE, '/')
  );
}

export async function setAdminSessionCookie(res) {
  res.cookies.set(
    ADMIN_COOKIE,
    await signToken(SESSION_REALMS.ADMIN),
    authCookieOptions(ADMIN_COOKIE, '/')
  );
}

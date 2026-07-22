import {
  ADMIN_COOKIE,
  APPDEV_COOKIE,
  HUB_COOKIE,
  authCookieOptions,
  getAppdevPassword,
  getHubPassword,
  isAdminSession,
  setAdminSessionCookie,
  setAppdevSessionCookie,
  setHubSessionCookie,
} from '@/lib/auth';

export function getMasterPassword() {
  return (process.env.HUB_MASTER_PASSWORD || '').trim();
}

export function isMasterPassword(attempt) {
  const master = getMasterPassword();
  if (!master) return false;
  return String(attempt || '').trim() === master;
}

export async function grantFullAccessCookies(res, { displayName = '' } = {}) {
  if (getHubPassword() || displayName) {
    await setHubSessionCookie(res, { displayName });
  }
  if (getAppdevPassword()) await setAppdevSessionCookie(res, { displayName });
  await setAdminSessionCookie(res);
}

export function clearAdminCookie(res) {
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export function clearHubSessionCookie(res) {
  res.cookies.set(HUB_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set('ops_hub_session', '', { httpOnly: true, path: '/', maxAge: 0 });
}

export function clearAppdevSessionCookie(res) {
  res.cookies.set(APPDEV_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/** Sign out from appdev; master sessions also drop hub + admin cookies. */
export async function clearAppdevLogoutCookies(res) {
  const admin = await isAdminSession();
  clearAppdevSessionCookie(res);
  if (admin) {
    clearAdminCookie(res);
    clearHubSessionCookie(res);
  }
}

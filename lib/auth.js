import { cookies } from 'next/headers';

export const AUTH_COOKIE = 'ops_hub_session';

export function getExpectedPassword() {
  return process.env.OPS_HUB_PASSWORD || '';
}

export function isAuthEnabled() {
  return Boolean(getExpectedPassword());
}

export async function isAuthenticated() {
  if (!isAuthEnabled()) return true;
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  return token === getExpectedPassword();
}

export function authCookieOptions(maxAge = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

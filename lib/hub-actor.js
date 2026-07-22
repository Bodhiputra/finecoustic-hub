import { cookies } from 'next/headers';
import { HUB_COOKIE, isAdminSession } from '@/lib/auth';
import { verifyHubTokenForGate } from '@/lib/session-token';
import { findHubUserById } from '@/lib/hub-users';
import { isManagerRole } from '@/lib/hub-users';

export async function readHubSessionFromCookies(cookieStore) {
  const token = cookieStore.get(HUB_COOKIE)?.value;
  return verifyHubTokenForGate(token);
}

/** Server-trusted hub actor — never trust client-sent names for permissions. */
export async function resolveHubActor() {
  const cookieStore = await cookies();
  const isAdmin = await isAdminSession();
  const payload = await readHubSessionFromCookies(cookieStore);

  if (!payload?.u && !isAdmin) {
    return { ok: false, reason: 'unauthorized', displayName: '', isAdmin: false };
  }

  if (payload?.u) {
    const user = await findHubUserById(payload.u);
    if (!user) {
      return { ok: false, reason: 'account_deleted', displayName: '', isAdmin: false };
    }
    if (user.blocked) {
      return { ok: false, reason: 'blocked', displayName: '', isAdmin: false };
    }
    return {
      ok: true,
      userId: user.id,
      displayName: user.display_name,
      role: user.role,
      isManager: isAdmin || isManagerRole(user.role),
      isAdmin,
      mustChangePassword: Boolean(user.must_change_password || payload.mcp),
    };
  }

  if (isAdmin && payload?.d) {
    return {
      ok: true,
      userId: '',
      displayName: payload.d,
      role: 'manager',
      isManager: true,
      isAdmin: true,
      mustChangePassword: false,
    };
  }

  return { ok: false, reason: 'unauthorized', displayName: '', isAdmin: false };
}

export async function requireHubActor() {
  const actor = await resolveHubActor();
  if (!actor.ok) {
    const err = new Error(actor.reason || 'unauthorized');
    err.status = 401;
    throw err;
  }
  return actor;
}

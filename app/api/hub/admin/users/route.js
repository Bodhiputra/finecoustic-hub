import { NextResponse } from 'next/server';
import { requireHubActor } from '@/lib/hub-actor';
import {
  createHubUserByAdmin,
  deleteHubUser,
  listHubUsers,
  ROLES,
  setHubUserBlocked,
  updateHubUserDepartmentAccess,
} from '@/lib/hub-users';
import { HUB_ASSIGNABLE_DEPARTMENT_IDS, HUB_DEPARTMENT_IDS, normalizeDepartmentAccess } from '@/lib/hub-departments';

export async function GET() {
  let actor;
  try {
    actor = await requireHubActor();
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: e.status || 401 });
  }
  if (!actor.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const users = await listHubUsers();
  return NextResponse.json({ users });
}

export async function POST(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: e.status || 401 });
  }
  if (!actor.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const displayName = String(body.displayName ?? '').trim();
  const password = String(body.password ?? '');
  const role = String(body.role ?? 'associate');
  const department_access = normalizeDepartmentAccess(
    body.department_access || body.departmentAccess,
    role
  );

  if (!displayName || !password.trim()) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  if (!HUB_ASSIGNABLE_DEPARTMENT_IDS.some(id => department_access[id])) {
    return NextResponse.json({ error: 'department_required' }, { status: 400 });
  }

  const result = await createHubUserByAdmin(displayName, password, { role, department_access });
  if (!result.ok) {
    if (result.reason === 'name_taken') {
      return NextResponse.json({ error: 'name_taken' }, { status: 409 });
    }
    if (result.reason === 'name_reserved') {
      return NextResponse.json({ error: 'name_master_only' }, { status: 403 });
    }
    if (result.reason === 'too_short') {
      return NextResponse.json({ error: 'password_too_short' }, { status: 400 });
    }
    return NextResponse.json({ error: result.reason || 'create_failed' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, user: result.user }, { status: 201 });
}

export async function PATCH(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: e.status || 401 });
  }
  if (!actor.isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = String(body.userId || '');
  const action = String(body.action || '');

  if (action === 'block') {
    const user = await setHubUserBlocked(userId, true);
    if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, user });
  }

  if (action === 'unblock') {
    const user = await setHubUserBlocked(userId, false);
    if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, user });
  }

  if (action === 'delete') {
    if (userId === actor.userId) {
      return NextResponse.json({ error: 'cannot_delete_self' }, { status: 400 });
    }
    const deleted = await deleteHubUser(userId);
    if (!deleted) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'departments') {
    const access = body.department_access || body.departmentAccess;
    if (!access || typeof access !== 'object') {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }
    const user = await updateHubUserDepartmentAccess(userId, access);
    if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, user });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}

export { ROLES, HUB_DEPARTMENT_IDS, HUB_ASSIGNABLE_DEPARTMENT_IDS };

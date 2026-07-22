import { NextResponse } from 'next/server';
import { requireHubActor } from '@/lib/hub-actor';
import { deleteHubUser, listHubUsers, setHubUserBlocked } from '@/lib/hub-users';

export async function GET() {
  let actor;
  try {
    actor = await requireHubActor();
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: e.status || 401 });
  }
  if (!actor.isManager) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const users = await listHubUsers();
  return NextResponse.json({ users });
}

export async function PATCH(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: e.status || 401 });
  }
  if (!actor.isManager) {
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

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}

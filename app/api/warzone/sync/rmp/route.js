import { NextResponse } from 'next/server';
import { requireHubActor } from '@/lib/hub-actor';
import { importRmpTasks, exportTasksForRmp } from '@/lib/warzone-data';
import { findHubUserById, getHubUserSyncToken } from '@/lib/hub-users';

export async function GET(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: e.status || 401 });
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') || '';
  if (token) {
    if (!actor.userId) {
      return NextResponse.json({ error: 'legacy_session' }, { status: 400 });
    }
    const syncToken = await getHubUserSyncToken(actor.userId);
    if (token !== syncToken) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 403 });
    }
  }

  const tasks = await exportTasksForRmp(actor);
  return NextResponse.json({ tasks, source: 'hub' });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || '');
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];

  if (!token) {
    return NextResponse.json({ error: 'token_required' }, { status: 400 });
  }

  let actor = null;
  try {
    actor = await requireHubActor();
  } catch {
    actor = null;
  }

  if (actor?.userId) {
    const syncToken = await getHubUserSyncToken(actor.userId);
    if (token !== syncToken) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 403 });
    }
  } else {
    const { listHubUsers } = await import('@/lib/hub-users');
    const users = await listHubUsers();
    let matched = null;
    for (const u of users) {
      const full = await findHubUserById(u.id);
      const syncToken = await getHubUserSyncToken(u.id);
      if (syncToken === token) {
        matched = full;
        break;
      }
    }
    if (!matched) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 403 });
    }
    actor = {
      ok: true,
      userId: matched.id,
      displayName: matched.display_name,
      isManager: matched.role === 'manager',
    };
  }

  const result = await importRmpTasks(tasks, actor);
  return NextResponse.json({ ok: true, ...result });
}

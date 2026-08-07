import { NextResponse } from 'next/server';
import {
  countUnreadForUser,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/appdev-notifications';
import { syncDueDateNotificationsForBoard } from '@/lib/appdev-data';
import { resolveAppdevActor } from '@/lib/appdev-actor';

export async function GET() {
  try {
    const actor = await resolveAppdevActor();
    if (!actor.ok) {
      return NextResponse.json({ error: actor.reason || 'Unauthorized' }, { status: 401 });
    }

    await syncDueDateNotificationsForBoard();

    const [items, unread] = await Promise.all([
      listNotificationsForUser(actor.displayName),
      countUnreadForUser(actor.displayName),
    ]);

    return NextResponse.json({ items, unread });
  } catch (err) {
    console.error('[appdev] GET notifications failed:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const actor = await resolveAppdevActor();
    if (!actor.ok) {
      return NextResponse.json({ error: actor.reason || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    if (body?.markAll) {
      const count = await markAllNotificationsRead(actor.displayName, {
        excludePersistent: Boolean(body?.excludePersistent),
      });
      const unread = await countUnreadForUser(actor.displayName);
      return NextResponse.json({ ok: true, marked: count, unread });
    }

    const id = String(body?.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    await markNotificationRead(id, actor.displayName);
    const unread = await countUnreadForUser(actor.displayName);
    return NextResponse.json({ ok: true, unread });
  } catch (err) {
    console.error('[appdev] PATCH notifications failed:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { listHubOnlinePresence, touchHubPresence } from '@/lib/hub-presence';
import { requireHubActor } from '@/lib/hub-actor';

export async function GET() {
  try {
    await requireHubActor();
    const online = await listHubOnlinePresence();
    return NextResponse.json({ online });
  } catch (err) {
    if (err.status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[hub] presence GET failed:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const actor = await requireHubActor();
    const name = String(actor.displayName || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'No display name' }, { status: 400 });
    }

    await touchHubPresence(name);
    const online = await listHubOnlinePresence();
    return NextResponse.json({ ok: true, online });
  } catch (err) {
    if (err.status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[hub] presence POST failed:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

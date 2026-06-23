import { NextResponse } from 'next/server';
import { listOnlinePresence, touchPresence } from '@/lib/appdev-presence';
import { resolveAppdevActor } from '@/lib/appdev-actor';

export async function GET() {
  try {
    const actor = await resolveAppdevActor();
    if (!actor.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const online = await listOnlinePresence();
    return NextResponse.json({ online });
  } catch (err) {
    console.error('[appdev] presence GET failed:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const actor = await resolveAppdevActor();
    if (!actor.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const name = String(actor.displayName || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'No display name' }, { status: 400 });
    }

    await touchPresence(name);
    const online = await listOnlinePresence();
    return NextResponse.json({ ok: true, online });
  } catch (err) {
    console.error('[appdev] presence POST failed:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { requireHubActor } from '@/lib/hub-actor';
import { updateHubUserProfile } from '@/lib/hub-users';

export async function PATCH(request) {
  let actor;
  try {
    actor = await requireHubActor();
  } catch (e) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: e.status || 401 });
  }

  if (!actor.userId) {
    return NextResponse.json({ error: 'legacy_session' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const displayName = body.displayName;

  if (body.currentPassword != null || body.newPassword != null) {
    return NextResponse.json({ error: 'personal_password_disabled' }, { status: 400 });
  }

  if (displayName != null) {
    const profile = await updateHubUserProfile(actor.userId, { displayName });
    if (!profile.ok) {
      return NextResponse.json({ error: profile.reason || 'update_failed' }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}

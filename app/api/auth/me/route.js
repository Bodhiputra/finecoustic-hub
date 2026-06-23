import { NextResponse } from 'next/server';
import {
  isAppdevAuthenticated,
  isHubAuthenticated,
  isAdminSession,
} from '@/lib/auth';
import { resolveAppdevActor } from '@/lib/appdev-actor';

export async function GET() {
  const [hub, appdev, admin, actor] = await Promise.all([
    isHubAuthenticated(),
    isAppdevAuthenticated(),
    isAdminSession(),
    resolveAppdevActor(),
  ]);

  return NextResponse.json({
    hub,
    appdev: appdev && actor.ok,
    admin,
    displayName: actor.ok ? actor.displayName : '',
    signOutReason: actor.ok ? '' : actor.reason || '',
  });
}

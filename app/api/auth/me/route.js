import { NextResponse } from 'next/server';
import {
  isAppdevAuthenticated,
  isHubAuthenticated,
  isAdminSession,
} from '@/lib/auth';
import { resolveAppdevActor } from '@/lib/appdev-actor';

import { resolveHubActor } from '@/lib/hub-actor';

export async function GET() {
  const [hub, appdev, admin, appdevActor, hubActor] = await Promise.all([
    isHubAuthenticated(),
    isAppdevAuthenticated(),
    isAdminSession(),
    resolveAppdevActor(),
    resolveHubActor(),
  ]);

  const displayName = hubActor.ok ? hubActor.displayName : appdevActor.ok ? appdevActor.displayName : '';

  return NextResponse.json({
    hub,
    appdev: appdev && appdevActor.ok,
    admin,
    displayName,
    hubUser: hubActor.ok
      ? {
          id: hubActor.userId,
          role: hubActor.role,
          isManager: hubActor.isManager,
          mustChangePassword: hubActor.mustChangePassword,
        }
      : null,
    signOutReason: appdevActor.ok ? '' : appdevActor.reason || '',
  });
}

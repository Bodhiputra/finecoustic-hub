import { NextResponse } from 'next/server';
import {
  isAppdevAuthenticated,
  isHubAuthenticated,
  isAdminSession,
} from '@/lib/auth';
import { resolveAppdevActor } from '@/lib/appdev-actor';

import { resolveHubActor } from '@/lib/hub-actor';
import { hubPermissionsForClient } from '@/lib/hub-permissions';

function hubUserPayload(hubActor) {
  if (!hubActor.ok) return null;
  return {
    id: hubActor.userId,
    role: hubActor.role,
    isManager: hubActor.isManager,
    isAdmin: hubActor.isAdmin,
    mustChangePassword: hubActor.mustChangePassword,
    departmentAccess: hubPermissionsForClient(hubActor)?.departmentAccess
      || hubActor.departmentAccess,
    permissions: hubPermissionsForClient(hubActor),
  };
}

export async function GET(request) {
  const scope = new URL(request.url).searchParams.get('scope') || '';

  if (scope === 'hub') {
    const [hub, hubActor] = await Promise.all([isHubAuthenticated(), resolveHubActor()]);
    return NextResponse.json({
      hub,
      displayName: hubActor.ok ? hubActor.displayName : '',
      hubUser: hubUserPayload(hubActor),
    });
  }

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
    hubUser: hubUserPayload(hubActor),
    signOutReason: appdevActor.ok ? '' : appdevActor.reason || '',
  });
}

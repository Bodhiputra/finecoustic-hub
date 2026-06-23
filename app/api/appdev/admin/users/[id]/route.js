import { NextResponse } from 'next/server';
import { isAdminSession } from '@/lib/auth';
import { refreshBoardPeopleRegistry } from '@/lib/appdev-data';
import { setUserBlocked, deleteUser } from '@/lib/appdev-users';

async function requireAdmin() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function PATCH(request, { params }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const blocked = Boolean(body.blocked);

  const user = await setUserBlocked(decodeURIComponent(id), blocked);
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await refreshBoardPeopleRegistry().catch(() => {});
  return NextResponse.json({ user });
}

export async function DELETE(_request, { params }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const ok = await deleteUser(decodeURIComponent(id));
  if (!ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await refreshBoardPeopleRegistry().catch(() => {});
  return NextResponse.json({ ok: true });
}

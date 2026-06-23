import { NextResponse } from 'next/server';
import { isAdminSession } from '@/lib/auth';
import { listUsers } from '@/lib/appdev-users';

async function requireAdmin() {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const users = await listUsers();
  return NextResponse.json({ users });
}

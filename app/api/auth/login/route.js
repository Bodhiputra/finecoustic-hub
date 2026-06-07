import { NextResponse } from 'next/server';
import { authCookieOptions, getExpectedPassword } from '@/lib/auth';

export async function POST(request) {
  const password = getExpectedPassword();
  if (!password) {
    return NextResponse.json({ ok: true, auth: false });
  }

  const body = await request.json().catch(() => ({}));
  if (body.password !== password) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('ops_hub_session', password, authCookieOptions());
  return res;
}

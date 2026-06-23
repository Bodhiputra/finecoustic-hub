import { NextResponse } from 'next/server';
import { getAppdevPassword, setAppdevSessionCookie } from '@/lib/auth';
import {
  checkLoginRateLimit,
  getClientIp,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/login-rate-limit';
import { createUser } from '@/lib/appdev-users';

const REALM = 'appdev-signup';

export async function POST(request) {
  const ip = getClientIp(request);
  const limit = await checkLoginRateLimit(ip, REALM);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: 'Too many failed attempts',
        retryAfterSec: limit.retryAfterSec,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const displayName = String(body.displayName ?? '').trim().slice(0, 80);
  const password = String(body.password ?? '').trim();
  const expectedTeam = getAppdevPassword();

  if (!expectedTeam) {
    return NextResponse.json({ ok: true, auth: false });
  }

  if (!displayName) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 });
  }
  if (password !== expectedTeam) {
    await recordLoginFailure(ip, REALM);
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 });
  }

  const result = await createUser(displayName);
  if (!result.ok) {
    await recordLoginFailure(ip, REALM);
    if (result.reason === 'name_taken') {
      return NextResponse.json({ error: 'name_taken' }, { status: 409 });
    }
    if (result.reason === 'name_reserved') {
      return NextResponse.json({ error: 'name_master_only' }, { status: 403 });
    }
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }

  await recordLoginSuccess(ip, REALM);
  const res = NextResponse.json({
    ok: true,
    displayName: result.user.display_name,
  });
  await setAppdevSessionCookie(res, {
    displayName: result.user.display_name,
    userId: result.user.id,
    sessionGen: result.user.session_gen,
  });
  return res;
}

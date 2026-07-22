import { NextResponse } from 'next/server';
import {
  checkLoginRateLimit,
  getClientIp,
  getLoginRateLimitStatus,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/login-rate-limit';
import { createHubUser } from '@/lib/hub-users';
import { setHubSessionCookie } from '@/lib/auth';
import { rotateHubUserSession } from '@/lib/hub-users';
import { isTeamPassword, isTeamPasswordConfigured } from '@/lib/hub-team-password';

const REALM = 'hub-signup';

export async function POST(request) {
  const ip = getClientIp(request);
  const limit = await checkLoginRateLimit(ip, REALM);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many failed attempts', retryAfterSec: limit.retryAfterSec, attemptsLeft: 0 },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
    );
  }

  if (!isTeamPasswordConfigured()) {
    return NextResponse.json({ error: 'team_password_not_configured' }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const displayName = String(body.displayName ?? '').trim().slice(0, 80);
  const password = String(body.password ?? '');

  if (!displayName || !password.trim()) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  if (!isTeamPassword(password)) {
    await recordLoginFailure(ip, REALM);
    return NextResponse.json({ error: 'invalid_team_password' }, { status: 401 });
  }

  const result = await createHubUser(displayName, password);
  if (!result.ok) {
    if (result.reason === 'name_taken') {
      return NextResponse.json({ error: 'name_taken' }, { status: 409 });
    }
    if (result.reason === 'name_reserved') {
      return NextResponse.json({ error: 'name_master_only' }, { status: 403 });
    }
    if (result.reason === 'invalid_team_password') {
      return NextResponse.json({ error: 'invalid_team_password' }, { status: 401 });
    }
    return NextResponse.json({ error: 'signup_failed' }, { status: 400 });
  }

  await recordLoginSuccess(ip, REALM);
  const sessionGen = await rotateHubUserSession(result.user.id);
  const res = NextResponse.json({ ok: true, displayName: result.user.display_name });
  await setHubSessionCookie(res, {
    displayName: result.user.display_name,
    userId: result.user.id,
    sessionGen,
  });
  return res;
}

export async function GET(request) {
  const ip = getClientIp(request);
  const status = await getLoginRateLimitStatus(ip, REALM);
  return NextResponse.json(status);
}

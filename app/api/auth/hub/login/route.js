import { NextResponse } from 'next/server';
import {
  checkLoginRateLimit,
  getClientIp,
  getLoginRateLimitStatus,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/login-rate-limit';
import { verifyHubUserCredentials, rotateHubUserSession } from '@/lib/hub-users';
import { setHubSessionCookie } from '@/lib/auth';
import { grantFullAccessCookies, isMasterPassword } from '@/lib/hub-admin';
import { claimMasterName, isAllowedAdminLoginName, isMasterOnlyName } from '@/lib/appdev-master-names';
import { isTeamPasswordConfigured } from '@/lib/hub-team-password';

const REALM = 'hub-login';

export async function GET(request) {
  const ip = getClientIp(request);
  const status = await getLoginRateLimitStatus(ip, REALM);
  return NextResponse.json(status);
}

export async function POST(request) {
  const ip = getClientIp(request);
  const limit = await checkLoginRateLimit(ip, REALM);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many failed attempts', retryAfterSec: limit.retryAfterSec, attemptsLeft: 0 },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const displayName = String(body.displayName ?? '').trim().slice(0, 80);
  const attempt = String(body.password ?? '');

  if (!displayName) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }

  if (!isTeamPasswordConfigured()) {
    return NextResponse.json({ error: 'team_password_not_configured' }, { status: 503 });
  }

  if (isMasterPassword(attempt)) {
    if (!isAllowedAdminLoginName(displayName)) {
      await recordLoginFailure(ip, REALM);
      return NextResponse.json({ error: 'admin_name_required' }, { status: 403 });
    }
    await recordLoginSuccess(ip, REALM);
    await claimMasterName(displayName);
    const res = NextResponse.json({
      ok: true,
      admin: true,
      displayName,
      mustChangePassword: false,
    });
    await grantFullAccessCookies(res, { displayName });
    return res;
  }

  if (await isMasterOnlyName(displayName)) {
    return NextResponse.json({ error: 'name_master_only' }, { status: 403 });
  }

  const login = await verifyHubUserCredentials(displayName, attempt);
  if (!login.ok) {
    const failure = await recordLoginFailure(ip, REALM);
    if (failure.locked) {
      return NextResponse.json(
        { error: 'Too many failed attempts', retryAfterSec: failure.retryAfterSec, attemptsLeft: 0 },
        { status: 429, headers: { 'Retry-After': String(failure.retryAfterSec) } }
      );
    }
    if (login.reason === 'not_registered') {
      return NextResponse.json({ error: 'not_registered', attemptsLeft: failure.attemptsLeft }, { status: 403 });
    }
    if (login.reason === 'blocked') {
      return NextResponse.json({ error: 'account_blocked' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Invalid password', attemptsLeft: failure.attemptsLeft },
      { status: 401 }
    );
  }

  await recordLoginSuccess(ip, REALM);
  const sessionGen = await rotateHubUserSession(login.user.id);
  const res = NextResponse.json({
    ok: true,
    displayName: login.user.display_name,
    mustChangePassword: false,
  });
  await setHubSessionCookie(res, {
    displayName: login.user.display_name,
    userId: login.user.id,
    sessionGen,
  });
  return res;
}

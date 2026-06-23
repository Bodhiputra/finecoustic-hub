import { NextResponse } from 'next/server';
import { getAppdevPassword, setAppdevSessionCookie } from '@/lib/auth';
import { grantFullAccessCookies, isMasterPassword } from '@/lib/hub-admin';
import {
  checkLoginRateLimit,
  getClientIp,
  getLoginRateLimitStatus,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/login-rate-limit';
import { claimMasterName, isAllowedAdminLoginName, isMasterOnlyName } from '@/lib/appdev-master-names';
import { verifyRegisteredUser, rotateUserSession } from '@/lib/appdev-users';

const REALM = 'appdev';

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
      {
        error: 'Too many failed attempts',
        retryAfterSec: limit.retryAfterSec,
        attemptsLeft: 0,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const attempt = String(body.password ?? '').trim();
  const displayName = String(body.displayName ?? '').trim().slice(0, 80);
  const expectedTeam = getAppdevPassword();

  if (!expectedTeam) {
    return NextResponse.json({ ok: true, auth: false });
  }

  if (!displayName) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }
  if (!attempt) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 });
  }

  if (isMasterPassword(attempt)) {
    if (!isAllowedAdminLoginName(displayName)) {
      const failure = await recordLoginFailure(ip, REALM);
      if (failure.locked) {
        return NextResponse.json(
          {
            error: 'Too many failed attempts',
            retryAfterSec: failure.retryAfterSec,
            attemptsLeft: 0,
          },
          { status: 429, headers: { 'Retry-After': String(failure.retryAfterSec) } }
        );
      }
      return NextResponse.json({ error: 'admin_name_required' }, { status: 403 });
    }
    await recordLoginSuccess(ip, REALM);
    await claimMasterName(displayName);
    const res = NextResponse.json({ ok: true, admin: true, displayName });
    await grantFullAccessCookies(res, { displayName });
    return res;
  }

  if (await isMasterOnlyName(displayName)) {
    const failure = await recordLoginFailure(ip, REALM);
    if (failure.locked) {
      return NextResponse.json(
        {
          error: 'Too many failed attempts',
          retryAfterSec: failure.retryAfterSec,
          attemptsLeft: 0,
        },
        { status: 429, headers: { 'Retry-After': String(failure.retryAfterSec) } }
      );
    }
    return NextResponse.json({ error: 'name_master_only' }, { status: 403 });
  }

  if (attempt !== expectedTeam) {
    const failure = await recordLoginFailure(ip, REALM);
    if (failure.locked) {
      return NextResponse.json(
        {
          error: 'Too many failed attempts',
          retryAfterSec: failure.retryAfterSec,
          attemptsLeft: 0,
        },
        { status: 429, headers: { 'Retry-After': String(failure.retryAfterSec) } }
      );
    }
    return NextResponse.json(
      { error: 'Invalid password', attemptsLeft: failure.attemptsLeft },
      { status: 401 }
    );
  }

  const login = await verifyRegisteredUser(displayName);
  if (!login.ok) {
    if (login.reason === 'blocked') {
      return NextResponse.json({ error: 'account_blocked' }, { status: 403 });
    }
    if (login.reason === 'not_registered') {
      return NextResponse.json({ error: 'not_registered' }, { status: 403 });
    }
    const failure = await recordLoginFailure(ip, REALM);
    if (failure.locked) {
      return NextResponse.json(
        {
          error: 'Too many failed attempts',
          retryAfterSec: failure.retryAfterSec,
          attemptsLeft: 0,
        },
        { status: 429, headers: { 'Retry-After': String(failure.retryAfterSec) } }
      );
    }
    return NextResponse.json(
      { error: 'Invalid credentials', attemptsLeft: failure.attemptsLeft },
      { status: 401 }
    );
  }

  await recordLoginSuccess(ip, REALM);
  const sessionGen = await rotateUserSession(login.user.id);
  const res = NextResponse.json({ ok: true, displayName: login.user.display_name });
  await setAppdevSessionCookie(res, {
    displayName: login.user.display_name,
    userId: login.user.id,
    sessionGen,
  });
  return res;
}

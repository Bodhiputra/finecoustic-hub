import { NextResponse } from 'next/server';
import { getHubPassword, setHubSessionCookie } from '@/lib/auth';
import { grantFullAccessCookies, isMasterPassword } from '@/lib/hub-admin';
import {
  checkLoginRateLimit,
  getClientIp,
  getLoginRateLimitStatus,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/login-rate-limit';
import { claimMasterName, isAllowedAdminLoginName, isMasterOnlyName } from '@/lib/appdev-master-names';

const REALM = 'hub';

export async function GET(request) {
  if (!getHubPassword()) {
    return NextResponse.json({ allowed: true, attemptsLeft: null, auth: false });
  }

  const ip = getClientIp(request);
  const status = await getLoginRateLimitStatus(ip, REALM);
  return NextResponse.json(status);
}

export async function POST(request) {
  const password = getHubPassword();
  if (!password) {
    return NextResponse.json({ ok: true, auth: false });
  }

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

  if (!displayName) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
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

  if (attempt !== password) {
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

  if (await isMasterOnlyName(displayName)) {
    return NextResponse.json({ error: 'name_master_only' }, { status: 403 });
  }

  await recordLoginSuccess(ip, REALM);
  const res = NextResponse.json({ ok: true, displayName });
  await setHubSessionCookie(res);
  return res;
}

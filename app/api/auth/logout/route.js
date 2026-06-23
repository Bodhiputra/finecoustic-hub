import { NextResponse } from 'next/server';
import { clearAdminCookie, clearHubSessionCookie } from '@/lib/hub-admin';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearHubSessionCookie(res);
  clearAdminCookie(res);
  return res;
}

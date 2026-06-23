import { NextResponse } from 'next/server';
import { clearAppdevLogoutCookies } from '@/lib/hub-admin';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  await clearAppdevLogoutCookies(res);
  return res;
}

import { NextResponse } from 'next/server';

/** Legacy shared-password hub login — removed. Use /api/auth/hub/login. */
export async function GET() {
  return NextResponse.json({ deprecated: true, use: '/api/auth/hub/login' });
}

export async function POST() {
  return NextResponse.json(
    { error: 'legacy_login_disabled', use: '/api/auth/hub/login' },
    { status: 410 }
  );
}

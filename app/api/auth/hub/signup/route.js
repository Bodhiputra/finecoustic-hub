import { NextResponse } from 'next/server';

/** Public hub signup is disabled — accounts are created by a manager at /hub/admin. */
export async function POST() {
  return NextResponse.json({ error: 'public_signup_disabled' }, { status: 403 });
}

export async function GET() {
  return NextResponse.json({ publicSignup: false });
}

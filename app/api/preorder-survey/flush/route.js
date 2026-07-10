import { NextResponse } from 'next/server';
import { clearPreorderSurveyResponses } from '@/lib/preorder-survey';

/** Hub-authenticated wipe (middleware enforces finehub_session). */
export async function POST() {
  try {
    const result = await clearPreorderSurveyResponses();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[preorder-survey] flush failed', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

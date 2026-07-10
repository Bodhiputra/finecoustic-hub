import { NextResponse } from 'next/server';
import { listPreorderSurveyResponses } from '@/lib/preorder-survey';

/** Hub-authenticated read (middleware enforces finehub_session). */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const intent = searchParams.get('intent');
  const limit = Number(searchParams.get('limit') || 200);

  try {
    const rows = await listPreorderSurveyResponses({
      limit: Number.isFinite(limit) ? limit : 200,
      intent: intent === 'reserve' || intent === 'decline' ? intent : undefined,
    });
    return NextResponse.json({ ok: true, count: rows.length, rows });
  } catch (err) {
    console.error('[preorder-survey] list failed', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

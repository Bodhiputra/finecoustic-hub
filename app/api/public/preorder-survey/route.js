import { NextResponse } from 'next/server';
import {
  DuplicatePreorderSurveyError,
  insertPreorderSurveyResponse,
} from '@/lib/preorder-survey';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'Unauthorized' }, {
    status: 401,
    headers: corsHeaders(),
  });
}

function badRequest(message) {
  return NextResponse.json({ ok: false, error: message }, {
    status: 400,
    headers: corsHeaders(),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request) {
  const expectedSecret = (process.env.PREORDER_SURVEY_SECRET || '').trim();

  let payload;
  try {
    payload = await request.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (expectedSecret && payload.secret !== expectedSecret) {
    return unauthorized();
  }

  const intent = String(payload.intent || '').trim();
  if (intent !== 'reserve' && intent !== 'decline') {
    return badRequest('intent must be reserve or decline');
  }

  try {
    const row = await insertPreorderSurveyResponse(payload);
    return NextResponse.json({ ok: true, id: row.id, created_at: row.created_at }, {
      headers: corsHeaders(),
    });
  } catch (err) {
    if (err instanceof DuplicatePreorderSurveyError) {
      return NextResponse.json({
        ok: false,
        error: 'duplicate',
        intent: err.intent,
        message: `This email has already submitted the ${err.intent} questionnaire.`,
        existing_id: err.existingId ?? null,
      }, {
        status: 409,
        headers: corsHeaders(),
      });
    }

    console.error('[preorder-survey] insert failed', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

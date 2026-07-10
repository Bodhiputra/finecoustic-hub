import { NextResponse } from 'next/server';
import { customerHasTag } from '@/lib/shopify-customer';

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

  const email = String(payload.email || '').trim();
  if (!email) {
    return badRequest('email is required');
  }

  const tag = String(payload.tag || 'nomadpreorder').trim();

  try {
    const reserved = await customerHasTag(email, tag);
    return NextResponse.json({ ok: true, reserved }, {
      headers: corsHeaders(),
    });
  } catch (err) {
    console.error('[preorder-reserved] lookup failed', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, {
      status: 500,
      headers: corsHeaders(),
    });
  }
}

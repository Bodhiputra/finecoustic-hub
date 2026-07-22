import { NextResponse } from 'next/server';
import { registerPreorderLead, readRegisterParams } from '@/lib/preorder-register';
import { corsHeaders, jsonWithCors } from '@/lib/public-api-cors';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

async function handleRequest(request) {
  const expectedSecret = (process.env.PREORDER_SURVEY_SECRET || '').trim();
  let body = null;

  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      return jsonWithCors({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
    }
  }

  const params = readRegisterParams(request.nextUrl.searchParams, body);
  const result = await registerPreorderLead({
    ...params,
    expectedSecret,
  });

  return jsonWithCors(result.body, { status: result.status });
}

export async function GET(request) {
  return handleRequest(request);
}

export async function POST(request) {
  return handleRequest(request);
}

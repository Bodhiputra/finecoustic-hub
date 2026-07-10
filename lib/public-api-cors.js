import { NextResponse } from 'next/server';

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function jsonWithCors(body, { status = 200 } = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...corsHeaders(),
      'Cache-Control': 'no-store',
    },
  });
}

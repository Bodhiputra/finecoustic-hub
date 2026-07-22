import { registerPreorderLead, readRegisterParams } from '@/lib/preorder-register';
import { jsonWithCors } from '@/lib/public-api-cors';

/**
 * Shopify App Proxy target for hero preorder lead capture.
 * Storefront: GET /apps/fc-preorder/register?email=...&accepts_marketing=1&secret=...
 */
export async function GET(request) {
  const expectedSecret = (process.env.PREORDER_SURVEY_SECRET || '').trim();
  const params = readRegisterParams(request.nextUrl.searchParams, null);
  const result = await registerPreorderLead({
    ...params,
    expectedSecret,
  });

  return jsonWithCors(result.body, { status: result.status });
}

export async function POST(request) {
  const expectedSecret = (process.env.PREORDER_SURVEY_SECRET || '').trim();
  let body = null;

  try {
    body = await request.json();
  } catch {
    return jsonWithCors({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const params = readRegisterParams(request.nextUrl.searchParams, body);
  const result = await registerPreorderLead({
    ...params,
    expectedSecret,
  });

  return jsonWithCors(result.body, { status: result.status });
}

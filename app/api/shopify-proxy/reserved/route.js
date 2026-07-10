import { lookupPreorderReserved, readReservedParams } from '@/lib/preorder-reserved';
import { jsonWithCors } from '@/lib/public-api-cors';

/**
 * Shopify App Proxy target for guest preorder tag lookup.
 * Storefront: GET /apps/fc-preorder/reserved?email=...&tag=...&secret=...
 * Shopify forwards here (server-to-server — avoids Vercel browser checkpoint).
 */
export async function GET(request) {
  const expectedSecret = (process.env.PREORDER_SURVEY_SECRET || '').trim();
  const params = readReservedParams(request.nextUrl.searchParams, null);
  const result = await lookupPreorderReserved({
    ...params,
    expectedSecret,
  });

  return jsonWithCors(result.body, { status: result.status });
}

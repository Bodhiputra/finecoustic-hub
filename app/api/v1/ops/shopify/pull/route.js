import { postOpsShopifyPull } from '@/lib/api/ops-shopify-handlers';

export async function POST() {
  return postOpsShopifyPull();
}

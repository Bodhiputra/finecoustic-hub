import { getB2bRetailerPool, postB2bRetailerPool } from '@/lib/api/b2b-retailer-pool-handlers';

export async function GET(request) {
  return getB2bRetailerPool(request);
}

export async function POST(request) {
  return postB2bRetailerPool(request);
}

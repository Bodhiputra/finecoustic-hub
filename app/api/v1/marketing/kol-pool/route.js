import { getKolPool, postKolPool } from '@/lib/api/kol-pool-handlers';

export async function GET(request) {
  return getKolPool(request);
}

export async function POST(request) {
  return postKolPool(request);
}

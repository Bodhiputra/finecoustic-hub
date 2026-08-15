import { postKolPoolSync } from '@/lib/api/kol-pool-handlers';

export async function POST() {
  return postKolPoolSync();
}

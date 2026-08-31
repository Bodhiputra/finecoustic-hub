import { after } from 'next/server';
import { postKolPoolSync } from '@/lib/api/kol-pool-handlers';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST() {
  return postKolPoolSync(after);
}

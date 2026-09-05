import { getKolTrackingCodes, postKolTrackingCode } from '@/lib/api/kol-tracking-codes-handlers';

export async function GET(request) {
  return getKolTrackingCodes(request);
}

export async function POST(request) {
  return postKolTrackingCode(request);
}

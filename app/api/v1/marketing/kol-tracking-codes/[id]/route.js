import { deleteKolTrackingCodeById } from '@/lib/api/kol-tracking-codes-handlers';

export async function DELETE(_request, context) {
  return deleteKolTrackingCodeById(_request, context);
}

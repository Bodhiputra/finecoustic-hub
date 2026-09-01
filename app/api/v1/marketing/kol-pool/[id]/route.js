import { deleteKolPoolRecordHandler, patchKolPoolRecord } from '@/lib/api/kol-pool-handlers';

export async function PATCH(request, context) {
  return patchKolPoolRecord(request, context);
}

export async function DELETE(_request, context) {
  return deleteKolPoolRecordHandler(_request, context);
}

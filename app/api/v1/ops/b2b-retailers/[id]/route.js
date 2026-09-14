import {
  deleteB2bRetailerPoolRecordHandler,
  patchB2bRetailerPoolRecord,
} from '@/lib/api/b2b-retailer-pool-handlers';

export async function PATCH(request, context) {
  return patchB2bRetailerPoolRecord(request, context);
}

export async function DELETE(request, context) {
  return deleteB2bRetailerPoolRecordHandler(request, context);
}

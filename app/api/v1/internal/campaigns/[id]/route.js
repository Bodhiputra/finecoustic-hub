import {
  createInternalBoard,
  deleteInternalCampaign,
  getInternalCampaign,
  patchInternalCampaign,
} from '@/lib/api/internal-campaigns-handlers';

export async function GET(request, context) {
  return getInternalCampaign(request, context);
}

export async function PATCH(request, context) {
  return patchInternalCampaign(request, context);
}

export async function DELETE(request, context) {
  return deleteInternalCampaign(request, context);
}

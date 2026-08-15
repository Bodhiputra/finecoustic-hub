import { deleteCampaignKol, patchCampaignKolEntry } from '@/lib/api/campaign-kol-handlers';

export async function PATCH(request, context) {
  return patchCampaignKolEntry(request, context);
}

export async function DELETE(request, context) {
  return deleteCampaignKol(request, context);
}

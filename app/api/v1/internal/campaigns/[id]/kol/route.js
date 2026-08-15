import { getCampaignKol, postCampaignKol } from '@/lib/api/campaign-kol-handlers';

export async function GET(request, context) {
  return getCampaignKol(request, context);
}

export async function POST(request, context) {
  return postCampaignKol(request, context);
}

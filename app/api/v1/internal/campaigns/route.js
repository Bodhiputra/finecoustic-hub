import {
  createInternalCampaign,
  listInternalCampaigns,
} from '@/lib/api/internal-campaigns-handlers';

export async function GET(request) {
  return listInternalCampaigns(request);
}

export async function POST(request) {
  return createInternalCampaign(request);
}

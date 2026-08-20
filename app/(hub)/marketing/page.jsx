import { redirect } from 'next/navigation';
import { legacyMarketingCampaignRedirect } from '@/lib/campaign-urls';
import { marketingToolQueryRedirect } from '@/lib/marketing-routes';

export const dynamic = 'force-dynamic';

/** Marketing index — workspace UI lives in marketing/layout.jsx. */
export default async function MarketingPage({ searchParams }) {
  const sp = await searchParams;
  const legacyUrl = legacyMarketingCampaignRedirect(sp);
  if (legacyUrl) redirect(legacyUrl);

  const toolRedirect = marketingToolQueryRedirect(sp?.tool);
  if (toolRedirect) redirect(toolRedirect);

  if (!sp?.board && !sp?.flow && !sp?.tool) {
    redirect('/marketing/kol-pool');
  }

  return null;
}

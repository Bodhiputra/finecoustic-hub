import { redirect } from 'next/navigation';
import { campaignListHomeUrl, marketingKolOutreachUrl } from '@/lib/campaign-urls';

export const dynamic = 'force-dynamic';

/** Campaign workspace UI lives in campaigns/layout.jsx — keep redirects only. */
export default async function CampaignsPage({ searchParams }) {
  const sp = await searchParams;
  if (sp?.kol) {
    redirect(marketingKolOutreachUrl());
  }

  if (!sp?.flow && !sp?.board) {
    redirect(campaignListHomeUrl());
  }

  return null;
}

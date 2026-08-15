import InternalDepartmentLoader from '@/components/internal/InternalDepartmentLoader';
import { redirect } from 'next/navigation';
import { legacyMarketingCampaignRedirect } from '@/lib/campaign-urls';

export const dynamic = 'force-dynamic';

export default async function MarketingPage({ searchParams }) {
  const sp = await searchParams;
  const legacyUrl = legacyMarketingCampaignRedirect(sp);
  if (legacyUrl) redirect(legacyUrl);

  return <InternalDepartmentLoader departmentId="marketing" searchParams={searchParams} />;
}

import MarketingHub from '@/components/MarketingHub';
import { isHubAuthEnabled } from '@/lib/auth';
import { listPreorderSurveyResponses } from '@/lib/preorder-survey';

export const dynamic = 'force-dynamic';

export default async function MarketingPage() {
  const rows = await listPreorderSurveyResponses({ limit: 500 });
  return (
    <MarketingHub
      authEnabled={isHubAuthEnabled()}
      view="overview"
      initialRows={rows}
    />
  );
}

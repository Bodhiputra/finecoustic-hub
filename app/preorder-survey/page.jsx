import MarketingHub from '@/components/MarketingHub';
import { isHubAuthEnabled } from '@/lib/auth';
import { listPreorderSurveyResponses } from '@/lib/preorder-survey';

export const dynamic = 'force-dynamic';

export default async function PreorderSurveyPage() {
  const rows = await listPreorderSurveyResponses({ limit: 500 });
  return (
    <MarketingHub
      authEnabled={isHubAuthEnabled()}
      view="preorder-survey"
      initialRows={rows}
    />
  );
}

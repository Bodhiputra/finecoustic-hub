'use client';

import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/Icon';
import PreorderSurveyDashboard from '@/components/PreorderSurveyDashboard';
import { HubLayout } from '@/components/HubSidebarContext';
import { useLocale } from '@/components/LocaleProvider';

export const MARKETING_VIEW_META = {
  'preorder-survey': {
    titleKey: 'hub.warzone.fbsPreorderSurvey',
    descKey: 'hub.warzone.fbsPreorderSurveyDesc',
  },
};

export function getMarketingViewMeta(view) {
  return MARKETING_VIEW_META[view] || null;
}

const NAV_ITEMS = [
  { id: 'preorder-survey', href: '/marketing?tool=preorder-survey', labelKey: 'hub.warzone.fbsPreorderSurvey' },
];

export function MarketingHubContent({ view = 'preorder-survey', initialRows = [] }) {
  return (
    <>
      {view === 'preorder-survey' && (
        <PreorderSurveyDashboard initialRows={initialRows} />
      )}
    </>
  );
}

export default function MarketingHub({
  authEnabled,
  view = 'preorder-survey',
  initialRows = [],
  embedded = false,
}) {
  const { t } = useLocale();
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  const meta = getMarketingViewMeta(view) || getMarketingViewMeta('preorder-survey');
  const title = meta?.titleKey ? t(meta.titleKey) : '';
  const subtitle = meta?.descKey ? t(meta.descKey) : '';
  const content = <MarketingHubContent view={view} initialRows={initialRows} />;

  if (embedded) return content;

  return (
    <HubLayout
      sidebarLabel="Marketing"
      topNavTitle={title}
      topNavSubtitle={subtitle}
      authEnabled={authEnabled}
      onLogout={handleLogout}
      sidebar={
        <>
          <div className="brand">
            <Link href="/" className="brand-back" aria-label="Hub home">
              <Icon name="arrowLeft" size={16} />
            </Link>
            <Image className="brand-logo" src="/FLogo.png" alt="Finecoustic" width={36} height={36} />
            <div>
              <strong>Finecoustic</strong>
              <small>Marketing</small>
            </div>
          </div>
          <nav className="sidebar-nav" aria-label="Sections">
            {NAV_ITEMS.map(({ id, href, labelKey }) => (
              <Link
                key={id}
                href={href}
                className={`nav${view === id ? ' active' : ''}`}
                aria-current={view === id ? 'page' : undefined}
              >
                {t(labelKey)}
              </Link>
            ))}
          </nav>
        </>
      }
    >
      <main className="main">
        {content}
      </main>
    </HubLayout>
  );
}

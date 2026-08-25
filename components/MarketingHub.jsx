'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { HubLayout } from '@/components/HubSidebarContext';
import { useLocale } from '@/components/LocaleProvider';

const KolPoolWorkspace = dynamic(() => import('@/components/marketing/KolPoolWorkspace'));
const KolOutreachWorkspace = dynamic(() => import('@/components/marketing/KolOutreachWorkspace'));
const PreorderSurveyDashboard = dynamic(() => import('@/components/PreorderSurveyDashboard'));

export const MARKETING_VIEW_META = {
  'kol-pool': {
    titleKey: 'hub.kol.title',
    descKey: 'hub.kol.subtitle',
  },
  'kol-outreach': {
    titleKey: 'hub.campaignKol.title',
    descKey: 'hub.campaignKol.subtitle',
  },
  'preorder-survey': {
    titleKey: 'hub.internal.fbsPreorderSurvey',
    descKey: 'hub.internal.fbsPreorderSurveyDesc',
  },
};

export function getMarketingViewMeta(view) {
  return MARKETING_VIEW_META[view] || null;
}

const NAV_ITEMS = [
  { id: 'preorder-survey', href: '/marketing/preorder-survey', labelKey: 'hub.internal.fbsPreorderSurvey' },
];

export function MarketingHubContent({
  view = 'preorder-survey',
  initialRows = [],
  initialKolPool = null,
  outreachTasks = [],
  onOutreachTasksChanged,
  canCreate = true,
  displayName = '',
  teamMembers = [],
}) {
  return (
    <>
      {view === 'kol-pool' ? (
        <KolPoolWorkspace
          initialRecords={initialKolPool?.records || []}
          initialMeta={initialKolPool?.meta}
          initialCounts={initialKolPool?.counts}
          initialConfigured={Boolean(initialKolPool?.configured)}
        />
      ) : null}
      {view === 'kol-outreach' ? (
        <KolOutreachWorkspace
          tasks={outreachTasks}
          onTasksChanged={onOutreachTasksChanged}
          initialPoolRecords={initialKolPool?.records || []}
          canCreate={canCreate}
          displayName={displayName}
          teamMembers={teamMembers}
        />
      ) : null}
      {view === 'preorder-survey' ? (
        <PreorderSurveyDashboard initialRows={initialRows} />
      ) : null}
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
  const content = <MarketingHubContent view={view} initialRows={initialRows} />;

  if (embedded) return content;

  return (
    <HubLayout
      sidebarLabel="Marketing"
      topNavTitle={title}
      authEnabled={authEnabled}
      onLogout={handleLogout}
      sidebar={
        <>
          <div className="brand">
            <Link href="/" className="brand-back" aria-label="Teams home">
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

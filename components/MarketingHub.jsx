'use client';

import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/Icon';
import ThemeToggle from '@/components/ThemeToggle';
import PreorderSurveyDashboard from '@/components/PreorderSurveyDashboard';
import { calcSurveyStats } from '@/lib/preorder-survey-ui';

const VIEW_META = {
  overview: ['Marketing', 'Campaigns, surveys, and storefront feedback'],
  'preorder-survey': ['Preorder survey', 'Hako Nomad questionnaire responses from the storefront'],
};

const NAV_ITEMS = [
  { id: 'overview', href: '/marketing', label: 'Overview' },
  { id: 'preorder-survey', href: '/preorder-survey', label: 'Preorder survey' },
];

export default function MarketingHub({
  authEnabled,
  view = 'overview',
  initialRows = [],
}) {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  const [title, subtitle] = VIEW_META[view] || VIEW_META.overview;
  const stats = calcSurveyStats(initialRows);

  return (
    <div className="layout">
      <aside className="sidebar" aria-label="Main navigation">
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
          {NAV_ITEMS.map(({ id, href, label }) => (
            <Link
              key={id}
              href={href}
              className={`nav${view === id ? ' active' : ''}`}
              aria-current={view === id ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-text">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            {authEnabled && (
              <button type="button" className="btn-ghost" onClick={handleLogout}>
                <Icon name="logOut" size={15} />
                Sign out
              </button>
            )}
          </div>
        </header>

        {view === 'overview' && (
          <section className="view active">
            <div className="kpi-grid">
              <div className="kpi kpi-primary">
                <label>Survey responses</label>
                <strong>{stats.total}</strong>
                <span>Loaded from Neon / local store</span>
              </div>
              <div className="kpi kpi-ok">
                <label>Reserve path</label>
                <strong>{stats.reserve}</strong>
                <span>{stats.checkoutRate}% started checkout</span>
              </div>
              <div className="kpi kpi-warn">
                <label>Decline path</label>
                <strong>{stats.decline}</strong>
                <span>{stats.marketingOptIn} marketing opt-ins</span>
              </div>
            </div>

            <article className="panel panel-full">
              <header className="panel-head">
                <h2>Sections</h2>
                <p className="panel-desc">Open a marketing tool. More will land here over time.</p>
              </header>
              <div className="hub-grid marketing-section-grid">
                <Link href="/preorder-survey" className="hub-card hub-card-active">
                  <div className="hub-card-icon" aria-hidden="true">
                    <Icon name="layout" size={18} />
                  </div>
                  <div className="hub-card-head">
                    <h2>Preorder survey</h2>
                  </div>
                  <p>
                    Filterable responses, reserve vs decline stats, and per-question answer
                    breakdowns from the Shopify questionnaire.
                  </p>
                </Link>
              </div>
            </article>
          </section>
        )}

        {view === 'preorder-survey' && (
          <PreorderSurveyDashboard initialRows={initialRows} />
        )}
      </main>
    </div>
  );
}

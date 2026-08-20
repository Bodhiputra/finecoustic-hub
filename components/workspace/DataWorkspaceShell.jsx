'use client';

import Icon from '@/components/Icon';

/**
 * Reusable marketing/ops data workspace chrome — header, tabs, search, table slot.
 * Keeps KOL pool, KOL outreach, expenses, etc. visually aligned without duplicating markup.
 */
export default function DataWorkspaceShell({
  className = '',
  title,
  subtitle,
  meta,
  actions = null,
  tabs = [],
  activeTab,
  onTabChange,
  tabsAriaLabel,
  searchQuery = '',
  onSearchChange,
  searchPlaceholder,
  resultCount = 0,
  resultCountLabel,
  empty = null,
  children,
}) {
  return (
    <div className={`kol-pool-workspace ${className}`.trim()}>
      <header className="kol-pool-header wrap-row">
        <div className="kol-pool-header-copy">
          {title ? <h2 className="kol-pool-title">{title}</h2> : null}
          {subtitle ? <p className="kol-pool-subtitle">{subtitle}</p> : null}
          {meta ? <p className="kol-pool-meta">{meta}</p> : null}
        </div>
        {actions ? <div className="kol-pool-header-actions wrap-row">{actions}</div> : null}
      </header>

      {tabs.length > 0 ? (
        <nav className="kol-pool-tabs wrap-row" aria-label={tabsAriaLabel}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`kol-pool-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => onTabChange?.(tab.id)}
            >
              {tab.label}
              {typeof tab.count === 'number' ? (
                <span className="kol-pool-tab-count">{tab.count}</span>
              ) : null}
            </button>
          ))}
        </nav>
      ) : null}

      {onSearchChange ? (
        <div className="kol-pool-toolbar wrap-row">
          <label className="kol-pool-search">
            <Icon name="search" size={16} />
            <input
              type="search"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </label>
          {resultCountLabel ? (
            <span className="kol-pool-result-count">{resultCountLabel.replace('{count}', String(resultCount))}</span>
          ) : null}
        </div>
      ) : null}

      {empty && !children ? (
        <p className="internal-empty personal-hub-hint">{empty}</p>
      ) : (
        children
      )}
    </div>
  );
}

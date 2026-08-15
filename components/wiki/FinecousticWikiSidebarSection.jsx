'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import SidebarSection from '@/components/internal/SidebarSection';
import { useLocale } from '@/components/LocaleProvider';
import { API_V1, knowledgePagesQuery, unwrapData } from '@/lib/api/routes';
import {
  ABOUT_FINEACOUSTIC,
  getAboutFinecousticLandingPath,
} from '@/lib/internal';
import {
  FINEACOUSTIC_WIKI_DEPARTMENT,
  finecousticWikiUrl,
  KNOWLEDGE_PAGES_CHANGED,
} from '@/lib/knowledge';

/**
 * Company wiki nav — used on hub home (footer) and /about department sidebar.
 */
export default function FinecousticWikiSidebarSection({
  variant = 'home',
  pageParam: pageParamProp = '',
  className = '',
}) {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageParam = pageParamProp || searchParams.get('page') || '';
  const [pages, setPages] = useState([]);

  const onAbout = pathname === ABOUT_FINEACOUSTIC.path;
  const sectionActive = onAbout && !pageParam;
  const defaultOpen = variant === 'dept' || onAbout || pages.length > 0;

  const loadPages = useCallback(() => {
    return fetch(knowledgePagesQuery({ department: FINEACOUSTIC_WIKI_DEPARTMENT }), {
      credentials: 'same-origin',
    })
      .then(r => (r.ok ? r.json() : null))
      .then(body => {
        if (!body) return;
        const data = unwrapData(body);
        setPages(Array.isArray(data?.pages) ? data.pages : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  useEffect(() => {
    const onChanged = () => loadPages();
    window.addEventListener(KNOWLEDGE_PAGES_CHANGED, onChanged);
    return () => window.removeEventListener(KNOWLEDGE_PAGES_CHANGED, onChanged);
  }, [loadPages]);

  const rootPages = useMemo(
    () => pages
      .filter(page => !page.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)),
    [pages]
  );

  async function createWikiPage() {
    const res = await fetch(API_V1.knowledgePages, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        department: FINEACOUSTIC_WIKI_DEPARTMENT,
        parent_id: null,
        title: t('hub.wiki.untitled'),
        content: '',
      }),
    });
    if (!res.ok) return;
    const body = await res.json();
    const data = unwrapData(body);
    if (!data?.page) return;
    await loadPages();
    window.dispatchEvent(new CustomEvent(KNOWLEDGE_PAGES_CHANGED));
    router.push(finecousticWikiUrl(ABOUT_FINEACOUSTIC.path, { pageId: data.page.id }));
  }

  return (
    <div className={`internal-sidebar-wiki-footer${className ? ` ${className}` : ''}`}>
      <SidebarSection
        title={t('hub.internal.allAboutFinecoustic')}
        defaultOpen={defaultOpen}
        actionLabel={variant === 'dept' ? t('hub.wiki.newPage') : undefined}
        onAction={variant === 'dept' ? createWikiPage : undefined}
      >
        <nav className="sidebar-nav sidebar-nav-sub" aria-label={t('hub.internal.allAboutFinecoustic')}>
          <Link
            href={getAboutFinecousticLandingPath()}
            className={`nav nav-sub${sectionActive ? ' active' : ''}`}
            aria-current={sectionActive ? 'page' : undefined}
            title={t('hub.wiki.subtitle')}
          >
            <Icon name={ABOUT_FINEACOUSTIC.icon} size={14} />
            <span className="nav-label">{t('hub.wiki.overview')}</span>
          </Link>
          {rootPages.length === 0 && (
            <p className="knowledge-sidebar-empty">{t('hub.wiki.sidebarEmpty')}</p>
          )}
          {rootPages.map(page => (
            <Link
              key={page.id}
              href={finecousticWikiUrl(ABOUT_FINEACOUSTIC.path, { pageId: page.id })}
              className={`nav nav-sub knowledge-sidebar-page${pageParam === page.id ? ' active' : ''}`}
              aria-current={pageParam === page.id ? 'page' : undefined}
            >
              <Icon name="book" size={14} />
              <span className="nav-label">{page.title}</span>
            </Link>
          ))}
        </nav>
      </SidebarSection>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import KnowledgeEditor from '@/components/knowledge/KnowledgeEditor';
import { useLocale } from '@/components/LocaleProvider';
import { useHubPermissions } from '@/hooks/useHubPermissions';
import { API_V1, knowledgePagesQuery, unwrapData } from '@/lib/api/routes';
import { FINEACOUSTIC_GROUND_RULES } from '@/lib/finecoustic-rules';
import {
  dispatchKnowledgePagesChanged,
  KNOWLEDGE_PAGES_CHANGED,
  patchKnowledgePagesList,
} from '@/lib/knowledge';
import { knowledgeContentToHtml, normalizeKnowledgeHtml } from '@/lib/knowledge-content';

function seedDraftsFromPages(list) {
  const nextDrafts = {};
  for (const page of list) {
    nextDrafts[page.id] = {
      title: page.title,
      content: knowledgeContentToHtml(page.content),
    };
  }
  return nextDrafts;
}

export default function FinecousticAboutPage({
  pageId = '',
  initialPages = null,
}) {
  const { t } = useLocale();
  const { permissions } = useHubPermissions();
  const canEditWiki = permissions?.canEditWiki ?? false;
  const [pages, setPages] = useState(() => (Array.isArray(initialPages) ? initialPages : []));
  const [loading, setLoading] = useState(initialPages == null);
  const [editingId, setEditingId] = useState(null);
  const [drafts, setDrafts] = useState(() =>
    Array.isArray(initialPages) ? seedDraftsFromPages(initialPages) : {}
  );
  const [saveState, setSaveState] = useState({});
  const [activeSectionId, setActiveSectionId] = useState('');
  const canEdit = canEditWiki;

  const applyPages = useCallback(list => {
    const next = Array.isArray(list) ? list : [];
    setPages(next);
    setDrafts(seedDraftsFromPages(next));
  }, []);

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(knowledgePagesQuery({ department: 'finecoustic' }), {
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const body = await res.json();
      const data = unwrapData(body);
      applyPages(Array.isArray(data?.pages) ? data.pages : []);
    } finally {
      setLoading(false);
    }
  }, [applyPages]);

  useEffect(() => {
    if (initialPages == null) return;
    applyPages(initialPages);
    setLoading(false);
  }, [initialPages, applyPages]);

  useEffect(() => {
    if (initialPages != null) return;
    loadPages();
  }, [initialPages, loadPages]);

  useEffect(() => {
    const onChanged = event => {
      const detail = event?.detail;
      if (detail?.page || detail?.deletedId) {
        setPages(prev => patchKnowledgePagesList(prev, detail));
        if (detail.page) {
          setDrafts(prev => ({
            ...prev,
            [detail.page.id]: {
              title: detail.page.title,
              content: knowledgeContentToHtml(detail.page.content),
            },
          }));
        }
        return;
      }
      loadPages();
    };
    window.addEventListener(KNOWLEDGE_PAGES_CHANGED, onChanged);
    return () => window.removeEventListener(KNOWLEDGE_PAGES_CHANGED, onChanged);
  }, [loadPages]);

  const sortedPages = useMemo(
    () => [...pages].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)),
    [pages]
  );

  useEffect(() => {
    if (!sortedPages.length) return;
    setActiveSectionId(prev => prev || pageId || sortedPages[0].id);
  }, [sortedPages, pageId]);

  useEffect(() => {
    if (!pageId) return;
    requestAnimationFrame(() => {
      document.getElementById(`wiki-section-${pageId}`)
        ?.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  }, [pageId, sortedPages.length]);

  useEffect(() => {
    if (!sortedPages.length) return undefined;

    const sections = sortedPages
      .map(page => document.getElementById(`wiki-section-${page.id}`))
      .filter(Boolean);
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (!visible.length) return;
        const id = visible[0].target.id.replace('wiki-section-', '');
        setActiveSectionId(id);
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] }
    );

    sections.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [sortedPages, loading]);

  function scrollToSection(sectionId) {
    setActiveSectionId(sectionId);
    document.getElementById(`wiki-section-${sectionId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function persistPage(page) {
    const draft = drafts[page.id];
    if (!draft) return;
    setSaveState(s => ({ ...s, [page.id]: 'saving' }));
    const content = normalizeKnowledgeHtml(draft.content);
    const res = await fetch(API_V1.knowledgePage(page.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ title: draft.title, content }),
    });
    if (!res.ok) {
      setSaveState(s => ({ ...s, [page.id]: 'error' }));
      return;
    }
    const body = await res.json();
    const data = unwrapData(body);
    const saved = data?.page;
    setSaveState(s => ({ ...s, [page.id]: 'saved' }));
    setEditingId(null);
    if (saved?.id) {
      setPages(prev => patchKnowledgePagesList(prev, { page: saved }));
      setDrafts(prev => ({
        ...prev,
        [saved.id]: {
          title: saved.title,
          content: knowledgeContentToHtml(saved.content),
        },
      }));
      dispatchKnowledgePagesChanged({ page: saved });
    }
  }

  function updateDraft(pageIdKey, patch) {
    setSaveState(s => ({ ...s, [pageIdKey]: 'idle' }));
    setDrafts(prev => ({ ...prev, [pageIdKey]: { ...prev[pageIdKey], ...patch } }));
  }

  function renderPageBody(page) {
    const draft = drafts[page.id] || { title: page.title, content: '' };
    const editing = editingId === page.id;
    const state = saveState[page.id] || 'idle';
    const isRules = /ground rules/i.test(page.title);
    const readHtml = knowledgeContentToHtml(page.content);

    if (editing) {
      return (
        <div className="fc-about-edit">
          <input
            type="text"
            className="fc-about-edit-title"
            value={draft.title}
            onChange={e => updateDraft(page.id, { title: e.target.value })}
            aria-label={t('hub.wiki.pageTitle')}
          />
          <KnowledgeEditor
            pageKey={page.id}
            content={draft.content}
            placeholder={t('hub.wiki.contentPlaceholder')}
            onChange={html => updateDraft(page.id, { content: html })}
          />
          <div className="fc-about-edit-actions">
            <span className="fc-about-save-status" aria-live="polite">
              {state === 'saving' && t('hub.wiki.saving')}
              {state === 'saved' && t('hub.wiki.saved')}
              {state === 'error' && t('hub.wiki.saveError')}
            </span>
            <button
              type="button"
              className="appdev-btn-ghost"
              onClick={() => {
                setEditingId(null);
                updateDraft(page.id, {
                  title: page.title,
                  content: knowledgeContentToHtml(page.content),
                });
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="appdev-btn-primary"
              onClick={() => persistPage(page)}
              disabled={state === 'saving'}
            >
              {t('hub.wiki.save')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        {isRules ? (
          <div className="fc-about-rules">
            {FINEACOUSTIC_GROUND_RULES.map((rule, index) => (
              <article key={rule.id} className="fc-about-rule">
                <span className="fc-about-rule-num">{index + 1}</span>
                <div>
                  <h3>{rule.title}</h3>
                  <p>{rule.body}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div
            className="hub-prose fc-about-prose"
            dangerouslySetInnerHTML={{ __html: readHtml }}
          />
        )}

        {canEdit ? (
          <button
            type="button"
            className="fc-about-edit-trigger appdev-btn-ghost"
            onClick={() => setEditingId(page.id)}
          >
            {t('hub.wiki.edit')}
          </button>
        ) : null}
      </>
    );
  }

  if (loading) {
    return <p className="fc-about-loading">{t('hub.wiki.loading')}</p>;
  }

  if (sortedPages.length === 0) {
    return (
      <div className="fc-about fc-about--notion">
        <div className="fc-about-empty">
          <Icon name="book" size={28} />
          <p>{t('hub.wiki.empty')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fc-about fc-about--notion">
      <div className="fc-about-notion-layout">
        <aside className="fc-about-sections" aria-label={t('hub.wiki.sectionsLabel')}>
          <p className="fc-about-sections-label">{t('hub.wiki.sectionsLabel')}</p>
          <nav className="fc-about-sections-nav">
            {sortedPages.map(page => (
              <button
                key={page.id}
                type="button"
                className={`fc-about-section-link${activeSectionId === page.id ? ' is-active' : ''}`}
                aria-current={activeSectionId === page.id ? 'true' : undefined}
                onClick={() => scrollToSection(page.id)}
              >
                {page.title}
              </button>
            ))}
          </nav>
        </aside>

        <div className="fc-about-doc">
          {sortedPages.map(page => (
            <section
              key={page.id}
              id={`wiki-section-${page.id}`}
              className="fc-about-doc-section"
              aria-labelledby={`wiki-section-title-${page.id}`}
            >
              <h2 id={`wiki-section-title-${page.id}`} className="fc-about-doc-section-title">
                {page.title}
              </h2>
              <div className="fc-about-doc-section-body">
                {renderPageBody(page)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

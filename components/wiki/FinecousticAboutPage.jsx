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
import {
  knowledgeContentToHtml,
  normalizeKnowledgeHtml,
  wikiPageSummary,
} from '@/lib/knowledge-content';

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
    setActiveSectionId(prev => {
      if (pageId && sortedPages.some(page => page.id === pageId)) return pageId;
      if (prev && sortedPages.some(page => page.id === prev)) return prev;
      return sortedPages[0].id;
    });
  }, [sortedPages, pageId]);

  useEffect(() => {
    if (pageId && pageId !== activeSectionId && sortedPages.some(page => page.id === pageId)) {
      setActiveSectionId(pageId);
    }
  }, [pageId, activeSectionId, sortedPages]);

  const activePage = useMemo(
    () => sortedPages.find(page => page.id === activeSectionId) || sortedPages[0] || null,
    [sortedPages, activeSectionId]
  );

  function selectSection(sectionId) {
    if (sectionId === activeSectionId) return;
    setEditingId(null);
    setActiveSectionId(sectionId);
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
      <div className="kol-guidelines-page fc-about-playbook">
        <div className="fc-about-empty">
          <Icon name="book" size={28} />
          <p>{t('hub.wiki.empty')}</p>
        </div>
      </div>
    );
  }

  if (!activePage) return null;

  const activeSummary = wikiPageSummary(activePage.content);

  return (
    <div className="kol-guidelines-page fc-about-playbook">
      <header className="kol-guidelines-header">
        <p className="kol-guidelines-subtitle">{t('hub.wiki.subtitle')}</p>
      </header>

      <div className="kol-guidelines-layout">
        <aside className="kol-guidelines-nav" aria-label={t('hub.wiki.sectionsLabel')}>
          <p className="kol-guidelines-nav-label">{t('hub.wiki.sectionsLabel')}</p>
          <nav className="kol-guidelines-nav-list">
            {sortedPages.map((page, index) => {
              const summary = wikiPageSummary(page.content);
              return (
                <button
                  key={page.id}
                  type="button"
                  className={`kol-guidelines-nav-link${activePage.id === page.id ? ' is-active' : ''}`}
                  onClick={() => selectSection(page.id)}
                  aria-current={activePage.id === page.id ? 'page' : undefined}
                >
                  <span className="kol-guidelines-nav-num">{index + 1}</span>
                  <span className="kol-guidelines-nav-copy">
                    <span className="kol-guidelines-nav-title">{page.title}</span>
                    {summary ? (
                      <span className="kol-guidelines-nav-summary">{summary}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <article className="kol-guidelines-panel" aria-labelledby="fc-about-panel-title">
          <header className="kol-guidelines-panel-head">
            <h2 id="fc-about-panel-title" className="kol-guidelines-panel-title">
              {editingId === activePage.id
                ? drafts[activePage.id]?.title || activePage.title
                : activePage.title}
            </h2>
            {activeSummary && editingId !== activePage.id ? (
              <p className="kol-guidelines-panel-summary">{activeSummary}</p>
            ) : null}
          </header>

          <div className="kol-guidelines-panel-body fc-about-panel-body">
            {renderPageBody(activePage)}
          </div>
        </article>
      </div>
    </div>
  );
}

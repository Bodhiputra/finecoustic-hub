'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import KnowledgeEditor from '@/components/knowledge/KnowledgeEditor';
import { useLocale } from '@/components/LocaleProvider';
import { useConfirm } from '@/hooks/useConfirm';
import { API_V1, unwrapData } from '@/lib/api/routes';
import { knowledgeContentToHtml, normalizeKnowledgeHtml } from '@/lib/knowledge-content';
import { knowledgeBankUrl, KNOWLEDGE_PAGES_CHANGED } from '@/lib/knowledge';

export default function KnowledgeBank({
  departmentId,
  deptBase,
  pageId = '',
  i18nPrefix = 'knowledge',
  pageUrl = knowledgeBankUrl,
  welcomeClassName = 'knowledge-bank-welcome',
}) {
  const { t } = useLocale();
  const { requestConfirm, confirmDialog } = useConfirm();
  const router = useRouter();
  const tk = useCallback(key => t(`hub.${i18nPrefix}.${key}`), [t, i18nPrefix]);
  const [activePage, setActivePage] = useState(null);
  const [loading, setLoading] = useState(Boolean(pageId));
  const [draft, setDraft] = useState({ title: '', content: '' });
  const [savedSnapshot, setSavedSnapshot] = useState({ title: '', content: '' });
  const [saveState, setSaveState] = useState('idle');

  const isDirty = useMemo(() => {
    const titleDirty = draft.title !== savedSnapshot.title;
    const contentDirty =
      normalizeKnowledgeHtml(draft.content) !== normalizeKnowledgeHtml(savedSnapshot.content);
    return titleDirty || contentDirty;
  }, [draft, savedSnapshot]);

  useEffect(() => {
    if (!pageId) {
      setActivePage(null);
      setDraft({ title: '', content: '' });
      setSavedSnapshot({ title: '', content: '' });
      setSaveState('idle');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    fetch(API_V1.knowledgePage(pageId), { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (cancelled || !body) return;
        const data = unwrapData(body);
        const page = data?.page;
        if (!page || page.department !== departmentId) return;
        const html = knowledgeContentToHtml(page.content);
        setActivePage(page);
        setDraft({ title: page.title, content: html });
        setSavedSnapshot({ title: page.title, content: html });
        setSaveState('idle');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pageId, departmentId]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const notifyPagesChanged = useCallback(() => {
    window.dispatchEvent(new CustomEvent(KNOWLEDGE_PAGES_CHANGED));
  }, []);

  const persist = useCallback(async () => {
    if (!activePage || !isDirty) return;
    setSaveState('saving');
    const content = normalizeKnowledgeHtml(draft.content);
    const res = await fetch(API_V1.knowledgePage(activePage.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ title: draft.title, content }),
    });
    if (!res.ok) {
      setSaveState('error');
      return;
    }
    const body = await res.json();
    const data = unwrapData(body);
    if (data?.page) {
      const html = knowledgeContentToHtml(data.page.content);
      setActivePage(data.page);
      setDraft({ title: data.page.title, content: html });
      setSavedSnapshot({ title: data.page.title, content: html });
      notifyPagesChanged();
    }
    setSaveState('saved');
  }, [activePage, draft, isDirty, notifyPagesChanged]);

  const handleContentChange = useCallback(html => {
    setSaveState('idle');
    setDraft(d => ({ ...d, content: html }));
  }, []);

  async function deleteActivePage() {
    if (!activePage) return;
    const ok = await requestConfirm({
      title: tk('delete'),
      message: tk('deleteConfirm'),
      confirmLabel: tk('delete'),
      cancelLabel: t('common.cancel'),
    });
    if (!ok) return;
    const res = await fetch(API_V1.knowledgePage(activePage.id), {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (!res.ok) return;
    notifyPagesChanged();
    router.push(pageUrl(deptBase));
  }

  if (!pageId) {
    return (
      <div className={welcomeClassName}>
        <Icon name="book" size={32} />
        <h3>{tk('welcomeTitle')}</h3>
        <p>{tk('welcomePickPage')}</p>
      </div>
    );
  }

  if (loading) {
    return <p className="knowledge-bank-muted knowledge-bank-loading">{tk('loading')}</p>;
  }

  if (!activePage) {
    return <p className="knowledge-bank-muted knowledge-bank-loading">{tk('empty')}</p>;
  }

  return (
    <article className="knowledge-note">
      <header className="knowledge-note-toolbar">
        <input
          type="text"
          className="knowledge-note-title"
          value={draft.title}
          onChange={e => {
            setSaveState('idle');
            setDraft(d => ({ ...d, title: e.target.value }));
          }}
          placeholder={tk('untitled')}
          aria-label={tk('pageTitle')}
        />
        <div className="knowledge-note-actions">
          <span className="knowledge-note-save" aria-live="polite">
            {saveState === 'saving' && tk('saving')}
            {saveState === 'saved' && tk('saved')}
            {saveState === 'error' && tk('saveError')}
            {saveState === 'idle' && isDirty && tk('unsaved')}
          </span>
          <button
            type="button"
            className="appdev-btn-primary knowledge-note-save-btn"
            onClick={persist}
            disabled={!isDirty || saveState === 'saving'}
          >
            {saveState === 'saving' ? tk('saving') : tk('save')}
          </button>
          <button
            type="button"
            className="btn-ghost knowledge-note-delete"
            onClick={deleteActivePage}
          >
            {tk('delete')}
          </button>
        </div>
      </header>

      <KnowledgeEditor
        key={pageId}
        pageKey={pageId}
        content={draft.content}
        placeholder={tk('contentPlaceholder')}
        onChange={handleContentChange}
      />

      {confirmDialog}
    </article>
  );
}

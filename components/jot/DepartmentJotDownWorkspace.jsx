'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { useLocale } from '@/components/LocaleProvider';
import { useToast } from '@/hooks/useToast';
import { API_V1, knowledgePagesQuery, unwrapData } from '@/lib/api/routes';
import { departmentJotDownUrl } from '@/lib/knowledge';
import { jotContentToPlainText } from '@/lib/jot-down-content';
import { KNOWLEDGE_PAGES_CHANGED } from '@/lib/knowledge';

function jotPreview(content) {
  const line = String(content || '').split('\n').map(s => s.trim()).find(Boolean);
  return line ? line.slice(0, 120) : '';
}

function pageToJot(page) {
  return {
    id: page.id,
    title: page.title || '',
    content: jotContentToPlainText(page.content),
    updated_at: page.updated_at || null,
  };
}

export default function DepartmentJotDownWorkspace({
  departmentId,
  deptBase,
  initialJots = [],
  activeJotId = '',
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const router = useRouter();
  const [jots, setJots] = useState(() => initialJots.map(pageToJot));
  const [activeId, setActiveId] = useState(activeJotId || initialJots[0]?.id || '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef(null);

  const activeJot = useMemo(
    () => jots.find(j => j.id === activeId) || null,
    [jots, activeId]
  );

  useEffect(() => {
    setJots(initialJots.map(pageToJot));
  }, [initialJots]);

  useEffect(() => {
    if (activeJotId && jots.some(j => j.id === activeJotId)) {
      setActiveId(activeJotId);
    }
  }, [activeJotId, jots]);

  useEffect(() => {
    if (!activeJot) {
      setTitle('');
      setContent('');
      return;
    }
    setTitle(activeJot.title || '');
    setContent(activeJot.content || '');
  }, [activeJot?.id, activeJot?.title, activeJot?.content]);

  const reloadPages = useCallback(async () => {
    const res = await fetch(knowledgePagesQuery({ department: departmentId }), {
      credentials: 'same-origin',
    });
    if (!res.ok) return;
    const data = unwrapData(await res.json());
    const pages = Array.isArray(data?.pages) ? data.pages : [];
    setJots(pages.map(pageToJot));
  }, [departmentId]);

  useEffect(() => {
    const onChanged = () => reloadPages();
    window.addEventListener(KNOWLEDGE_PAGES_CHANGED, onChanged);
    return () => window.removeEventListener(KNOWLEDGE_PAGES_CHANGED, onChanged);
  }, [reloadPages]);

  const persist = useCallback(async (id, patch) => {
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch(API_V1.knowledgePage(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      const data = unwrapData(await res.json());
      const page = data?.page;
      if (page?.id) {
        const jot = pageToJot(page);
        setJots(prev => {
          const next = prev.map(j => (j.id === jot.id ? jot : j));
          return [...next].sort(
            (a, b) => (b.updated_at || '').localeCompare(a.updated_at || '') || a.title.localeCompare(b.title)
          );
        });
        window.dispatchEvent(new CustomEvent(KNOWLEDGE_PAGES_CHANGED));
      }
    } finally {
      setBusy(false);
    }
  }, [t, toast]);

  function scheduleSave(id, draftTitle, draftContent) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      persist(id, { title: draftTitle, content: draftContent });
    }, 500);
  }

  function selectJot(id) {
    if (id === activeId) return;
    router.push(departmentJotDownUrl(deptBase, { jotId: id }));
  }

  async function createJot() {
    setBusy(true);
    try {
      const res = await fetch(API_V1.knowledgePages, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          department: departmentId,
          parent_id: null,
          title: t('hub.jotDown.untitled'),
          content: '',
        }),
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      const data = unwrapData(await res.json());
      const page = data?.page;
      if (!page?.id) return;
      const jot = pageToJot(page);
      setJots(prev => [jot, ...prev]);
      window.dispatchEvent(new CustomEvent(KNOWLEDGE_PAGES_CHANGED));
      router.push(departmentJotDownUrl(deptBase, { jotId: jot.id }));
    } finally {
      setBusy(false);
    }
  }

  async function removeJot(id) {
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch(API_V1.knowledgePage(id), {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        toast.error(t('common.somethingWrong'));
        return;
      }
      const next = jots.filter(j => j.id !== id);
      setJots(next);
      window.dispatchEvent(new CustomEvent(KNOWLEDGE_PAGES_CHANGED));
      if (activeId === id) {
        router.push(next[0]?.id ? departmentJotDownUrl(deptBase, { jotId: next[0].id }) : departmentJotDownUrl(deptBase));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="personal-jot-workspace">
      <header className="personal-jot-toolbar">
        <button type="button" className="appdev-btn-primary" onClick={createJot} disabled={busy}>
          <Icon name="plus" size={16} />
          {t('hub.jotDown.newNote')}
        </button>
      </header>

      <div className="personal-jot-layout">
        <aside className="personal-jot-list" aria-label={t('hub.jotDown.title')}>
          {jots.length === 0 ? (
            <p className="knowledge-sidebar-empty">{t('hub.jotDown.empty')}</p>
          ) : (
            <ul>
              {jots.map(jot => (
                <li key={jot.id}>
                  <button
                    type="button"
                    className={`personal-jot-list-item${jot.id === activeId ? ' is-active' : ''}`}
                    onClick={() => selectJot(jot.id)}
                  >
                    <strong>{jot.title || t('hub.jotDown.untitled')}</strong>
                    {jotPreview(jot.content) ? (
                      <span>{jotPreview(jot.content)}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="personal-jot-editor">
          {!activeJot ? (
            <p className="internal-empty">{t('hub.jotDown.pickOrCreate')}</p>
          ) : (
            <>
              <div className="personal-jot-editor-head">
                <input
                  type="text"
                  className="personal-jot-title-input"
                  value={title}
                  onChange={e => {
                    const next = e.target.value;
                    setTitle(next);
                    scheduleSave(activeJot.id, next, content);
                  }}
                  placeholder={t('hub.jotDown.titlePlaceholder')}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="hub-icon-btn is-danger"
                  onClick={() => removeJot(activeJot.id)}
                  disabled={busy}
                  aria-label={t('hub.jotDown.delete')}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
              <textarea
                className="personal-jot-body"
                value={content}
                onChange={e => {
                  const next = e.target.value;
                  setContent(next);
                  scheduleSave(activeJot.id, title, next);
                }}
                placeholder={t('hub.jotDown.bodyPlaceholder')}
                disabled={busy}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useLocale } from '@/components/LocaleProvider';
import { usePrompt } from '@/hooks/usePrompt';
import { normalizeKnowledgeHtml } from '@/lib/knowledge-content';

function ToolBtn({ active, disabled, onClick, title, children }) {
  return (
    <button
      type="button"
      className={`knowledge-editor-btn${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export default function KnowledgeEditor({ pageKey, content, placeholder, onChange }) {
  const { t } = useLocale();
  const { requestPrompt, promptDialog } = usePrompt();
  const skipUpdate = useRef(true);
  const [, setRevision] = useState(0);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          horizontalRule: true,
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        }),
        Placeholder.configure({ placeholder }),
      ],
      content,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: 'knowledge-editor-prose',
          spellcheck: 'true',
        },
      },
      onCreate: () => {
        requestAnimationFrame(() => {
          skipUpdate.current = false;
        });
      },
      onUpdate: ({ editor: ed }) => {
        if (skipUpdate.current) return;
        onChange(normalizeKnowledgeHtml(ed.getHTML()));
      },
    },
    [pageKey]
  );

  useEffect(() => {
    if (!editor) return undefined;
    const bump = () => setRevision(n => n + 1);
    editor.on('selectionUpdate', bump);
    editor.on('transaction', bump);
    return () => {
      editor.off('selectionUpdate', bump);
      editor.off('transaction', bump);
    };
  }, [editor]);

  if (!editor) {
    return (
      <>
        <div className="knowledge-editor knowledge-editor-loading">{placeholder}</div>
        {promptDialog}
      </>
    );
  }

  async function setLink() {
    const prev = editor.getAttributes('link').href || '';
    const url = await requestPrompt({
      title: t('hub.knowledge.toolLink'),
      label: t('hub.knowledge.linkPrompt'),
      defaultValue: prev || 'https://',
      confirmLabel: t('common.confirm'),
      cancelLabel: t('common.cancel'),
    });
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }

  function insertSymbol(symbol) {
    editor.chain().focus().insertContent(symbol).run();
  }

  function blockType() {
    if (editor.isActive('heading', { level: 1 })) return 'h1';
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    if (editor.isActive('heading', { level: 3 })) return 'h3';
    return 'p';
  }

  function onBlockTypeChange(event) {
    const value = event.target.value;
    const chain = editor.chain().focus();
    if (value === 'p') chain.setParagraph().run();
    else if (value === 'h1') chain.setHeading({ level: 1 }).run();
    else if (value === 'h2') chain.setHeading({ level: 2 }).run();
    else if (value === 'h3') chain.setHeading({ level: 3 }).run();
  }

  return (
    <div className="knowledge-editor">
      <div className="knowledge-editor-toolbar" role="toolbar" aria-label={t('hub.knowledge.editorToolbar')}>
        <div className="knowledge-editor-toolbar-group">
          <label className="sr-only" htmlFor={`kb-block-${pageKey}`}>
            {t('hub.knowledge.toolHeading')}
          </label>
          <select
            id={`kb-block-${pageKey}`}
            className="knowledge-editor-select"
            value={blockType()}
            onChange={onBlockTypeChange}
            aria-label={t('hub.knowledge.toolHeading')}
          >
            <option value="p">{t('hub.knowledge.toolParagraph')}</option>
            <option value="h1">{t('hub.knowledge.toolH1')}</option>
            <option value="h2">{t('hub.knowledge.toolH2')}</option>
            <option value="h3">{t('hub.knowledge.toolH3')}</option>
          </select>
        </div>

        <div className="knowledge-editor-toolbar-group" role="group" aria-label={t('hub.knowledge.toolFormatting')}>
          <ToolBtn
            title={t('hub.knowledge.toolBold')}
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <strong>B</strong>
          </ToolBtn>
          <ToolBtn
            title={t('hub.knowledge.toolItalic')}
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </ToolBtn>
          <ToolBtn
            title={t('hub.knowledge.toolCode')}
            active={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            {'</>'}
          </ToolBtn>
        </div>

        <div className="knowledge-editor-toolbar-group" role="group" aria-label={t('hub.knowledge.toolLists')}>
          <ToolBtn
            title={t('hub.knowledge.toolBulletList')}
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            •≡
          </ToolBtn>
          <ToolBtn
            title={t('hub.knowledge.toolNumberedList')}
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1.
          </ToolBtn>
        </div>

        <div className="knowledge-editor-toolbar-group" role="group" aria-label={t('hub.knowledge.toolInsert')}>
          <ToolBtn title={t('hub.knowledge.toolLink')} active={editor.isActive('link')} onClick={setLink}>
            Link
          </ToolBtn>
          <ToolBtn
            title={t('hub.knowledge.toolDivider')}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            —
          </ToolBtn>
          <ToolBtn title={t('hub.knowledge.toolArrowRight')} onClick={() => insertSymbol('→ ')}>
            →
          </ToolBtn>
          <ToolBtn title={t('hub.knowledge.toolArrowLeft')} onClick={() => insertSymbol('← ')}>
            ←
          </ToolBtn>
          <ToolBtn title={t('hub.knowledge.toolCheck')} onClick={() => insertSymbol('✓ ')}>
            ✓
          </ToolBtn>
          <ToolBtn title={t('hub.knowledge.toolBullet')} onClick={() => insertSymbol('• ')}>
            •
          </ToolBtn>
        </div>
      </div>

      <EditorContent editor={editor} className="knowledge-editor-content" />
      {promptDialog}
    </div>
  );
}

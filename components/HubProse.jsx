import { markdownToHtml } from '@/lib/markdown';

/** Readable rich text for non-technical hub users (from markdown source). */
export default function HubProse({ markdown = '', className = '' }) {
  const trimmed = String(markdown || '').trim();
  if (!trimmed) return null;

  return (
    <div
      className={['hub-prose', className].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: markdownToHtml(trimmed) }}
    />
  );
}

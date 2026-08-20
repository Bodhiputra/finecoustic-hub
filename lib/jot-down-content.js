import { isLikelyHtml } from '@/lib/knowledge-content';

/** Plain-text jot body for textarea editing (legacy HTML/markdown → text). */
export function jotContentToPlainText(content) {
  const raw = String(content || '');
  if (!raw.trim()) return '';
  if (!isLikelyHtml(raw)) return raw;
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = raw;
    return (div.textContent || div.innerText || '').replace(/\u00a0/g, ' ').trim();
  }
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

import { markdownToHtml } from '@/lib/markdown';

/** True when content was saved as HTML (rich editor), not legacy markdown. */
export function isLikelyHtml(content) {
  const s = String(content || '').trim();
  if (!s) return true;
  return s.startsWith('<') || s.includes('</');
}

/** Load legacy markdown pages into the rich editor as HTML. */
export function knowledgeContentToHtml(content) {
  if (!content) return '';
  if (isLikelyHtml(content)) return content;
  return markdownToHtml(content);
}

/** Normalize empty editor output for compare / save. */
export function normalizeKnowledgeHtml(html) {
  const s = String(html || '').trim();
  if (!s || s === '<p></p>' || s === '<p><br></p>' || s === '<p><br class="ProseMirror-trailingBreak"></p>') {
    return '';
  }
  return s;
}

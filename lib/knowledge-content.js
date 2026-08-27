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

/** First plain-text paragraph excerpt for playbook nav summaries. */
export function wikiPageSummary(content, maxLen = 120) {
  const html = knowledgeContentToHtml(content);
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!match) return '';
  const text = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

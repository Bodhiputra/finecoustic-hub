/** Client-safe personal jot-down helpers. */

export const PERSONAL_JOT_DOWN_TOOL = 'jot-down';

export function personalJotDownUrl({ jotId } = {}) {
  const params = new URLSearchParams({ tool: PERSONAL_JOT_DOWN_TOOL });
  if (jotId) params.set('jot', jotId);
  return `/me?${params.toString()}`;
}

export function normalizePersonalJot(raw = {}) {
  return {
    id: String(raw.id || ''),
    owner_key: String(raw.owner_key || ''),
    title: String(raw.title || '').trim().slice(0, 120) || 'Untitled',
    content: String(raw.content || '').slice(0, 50000),
    sort_order: Number.isFinite(raw.sort_order) ? raw.sort_order : 0,
    created_at: raw.created_at || null,
    updated_at: raw.updated_at || null,
  };
}

/** Department jot-down pages (shared per department; company wiki uses Finecoustic home). */

export const JOT_DOWN_TOOL = 'jot-down';
/** @deprecated use JOT_DOWN_TOOL */
export const KNOWLEDGE_BANK_TOOL = 'knowledge-bank';
export const KNOWLEDGE_PAGES_CHANGED = 'knowledge-pages-changed';

export function departmentJotDownUrl(deptBase, { jotId, pageId } = {}) {
  const params = new URLSearchParams();
  params.set('tool', JOT_DOWN_TOOL);
  const id = jotId || pageId;
  if (id) params.set('jot', id);
  return `${deptBase}?${params.toString()}`;
}

/** @deprecated use departmentJotDownUrl */
export function knowledgeBankUrl(deptBase, { pageId, jotId } = {}) {
  return departmentJotDownUrl(deptBase, { jotId: jotId || pageId });
}

/** All About Finecoustic — company wiki on hub home (?wiki=1), not a separate /about route. */
export const FINEACOUSTIC_WIKI_DEPARTMENT = 'finecoustic';
export const FINEACOUSTIC_WIKI_QUERY = 'wiki';

export function finecousticWikiHomeUrl({ pageId } = {}) {
  const params = new URLSearchParams();
  params.set(FINEACOUSTIC_WIKI_QUERY, '1');
  if (pageId) params.set('page', pageId);
  return `/?${params.toString()}`;
}

/** @deprecated deptBase ignored — wiki always opens on hub home */
export function finecousticWikiUrl(_deptBase, { pageId } = {}) {
  return finecousticWikiHomeUrl({ pageId });
}

export function isFinecousticWikiHomeView(searchParams) {
  if (!searchParams) return false;
  const get = key => (typeof searchParams.get === 'function' ? searchParams.get(key) : searchParams[key]);
  return get(FINEACOUSTIC_WIKI_QUERY) === '1';
}

export function isFinecousticWikiDepartment(departmentId = '') {
  return departmentId === FINEACOUSTIC_WIKI_DEPARTMENT;
}

/** Patch local wiki page lists without a full refetch. */
export function patchKnowledgePagesList(pages, detail) {
  if (!Array.isArray(pages) || !detail) return pages;
  if (detail.deletedId) return pages.filter(p => p.id !== detail.deletedId);
  if (!detail.page?.id) return pages;
  const idx = pages.findIndex(p => p.id === detail.page.id);
  if (idx >= 0) {
    const next = [...pages];
    next[idx] = detail.page;
    return next;
  }
  return [...pages, detail.page];
}

export function dispatchKnowledgePagesChanged(detail = null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(KNOWLEDGE_PAGES_CHANGED, { detail }));
}

export function isJotDownTool(tool = '') {
  return tool === JOT_DOWN_TOOL || tool === KNOWLEDGE_BANK_TOOL;
}

/** @deprecated use isJotDownTool */
export function isKnowledgeBankTool(tool = '') {
  return isJotDownTool(tool);
}

export function normalizePage(raw = {}, actorName = '') {
  const now = new Date().toISOString();
  return {
    id: String(raw.id || ''),
    department: String(raw.department || 'operations'),
    parent_id: raw.parent_id ? String(raw.parent_id) : null,
    title: String(raw.title || 'Untitled').trim() || 'Untitled',
    content: String(raw.content ?? ''),
    sort_order: Number.isFinite(raw.sort_order) ? raw.sort_order : 0,
    created_by: String(raw.created_by || actorName || ''),
    updated_by: String(raw.updated_by || raw.created_by || actorName || ''),
    created_at: raw.created_at || now,
    updated_at: raw.updated_at || now,
  };
}

/** Build nested tree from flat page list (roots first, sorted). */
export function buildPageTree(pages) {
  const byParent = new Map();
  for (const page of pages) {
    const key = page.parent_id || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(page);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
  }

  function walk(parentId, depth = 0) {
    const key = parentId || '';
    return (byParent.get(key) || []).map(page => ({
      page,
      depth,
      children: walk(page.id, depth + 1),
    }));
  }

  return walk(null);
}

/** Flatten tree for sidebar / search (depth-first). */
export function flattenPageTree(nodes, acc = []) {
  for (const node of nodes) {
    acc.push({ page: node.page, depth: node.depth });
    flattenPageTree(node.children, acc);
  }
  return acc;
}

export function collectDescendantIds(pages, rootId) {
  const byParent = new Map();
  for (const p of pages) {
    const key = p.parent_id || '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(p.id);
  }
  const ids = new Set();
  const stack = [...(byParent.get(rootId) || [])];
  while (stack.length) {
    const id = stack.pop();
    ids.add(id);
    stack.push(...(byParent.get(id) || []));
  }
  ids.add(rootId);
  return ids;
}

/** Knowledge bank — per-department wiki pages (Notion-style). */

export const KNOWLEDGE_BANK_TOOL = 'knowledge-bank';
export const KNOWLEDGE_PAGES_CHANGED = 'knowledge-pages-changed';

export function knowledgeBankUrl(deptBase, { pageId } = {}) {
  const params = new URLSearchParams();
  params.set('tool', KNOWLEDGE_BANK_TOOL);
  if (pageId) params.set('page', pageId);
  return `${deptBase}?${params.toString()}`;
}

/** All About Finecoustic — company wiki at /about (no knowledge-bank tool param). */
export const FINEACOUSTIC_WIKI_DEPARTMENT = 'finecoustic';

export function finecousticWikiUrl(deptBase = '/about', { pageId } = {}) {
  const params = new URLSearchParams();
  if (pageId) params.set('page', pageId);
  const qs = params.toString();
  return qs ? `${deptBase}?${qs}` : deptBase;
}

export function isFinecousticWikiDepartment(departmentId = '') {
  return departmentId === FINEACOUSTIC_WIKI_DEPARTMENT;
}

export function isKnowledgeBankTool(tool = '') {
  return tool === KNOWLEDGE_BANK_TOOL;
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

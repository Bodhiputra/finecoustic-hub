import { BOARD_STATUSES, normalizeDepartmentId } from '@/lib/internal';

export const DEFAULT_BOARD_STATUSES = ['todo', 'in_progress', 'in_review', 'done'];

export function normalizeStatusColumns(raw) {
  const list = Array.isArray(raw) ? raw : DEFAULT_BOARD_STATUSES;
  const out = [];
  for (const item of list) {
    const id = String(item || '').trim().toLowerCase();
    if (!id || out.includes(id)) continue;
    out.push(id);
  }
  return out.length ? out : [...DEFAULT_BOARD_STATUSES];
}

export function normalizeCampaign(raw) {
  const c = raw || {};
  const now = new Date().toISOString();
  return {
    id: String(c.id || ''),
    department: normalizeDepartmentId(c.department || 'marketing'),
    name: String(c.name || '').trim().slice(0, 120),
    description: String(c.description || '').trim().slice(0, 2000),
    flow_enabled: Boolean(c.flow_enabled),
    sort_order: Number.isFinite(c.sort_order) ? c.sort_order : 0,
    created_by: String(c.created_by || '').trim().slice(0, 80),
    created_at: c.created_at || now,
    updated_at: c.updated_at || c.created_at || now,
  };
}

export function normalizeBoard(raw) {
  const b = raw || {};
  const now = new Date().toISOString();
  return {
    id: String(b.id || ''),
    campaign_id: b.campaign_id ? String(b.campaign_id) : null,
    department: normalizeDepartmentId(b.department || 'marketing'),
    name: String(b.name || '').trim().slice(0, 120),
    description: String(b.description || '').trim().slice(0, 2000),
    kanban_only: b.kanban_only !== false,
    status_columns: normalizeStatusColumns(b.status_columns),
    sort_order: Number.isFinite(b.sort_order) ? b.sort_order : 0,
    created_by: String(b.created_by || '').trim().slice(0, 80),
    created_at: b.created_at || now,
    updated_at: b.updated_at || b.created_at || now,
  };
}

/** Board columns for kanban — falls back to hub defaults. */
export function boardStatusColumns(board) {
  if (board?.status_columns?.length) return board.status_columns;
  return [...BOARD_STATUSES];
}

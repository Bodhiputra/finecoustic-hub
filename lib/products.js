export const PRODUCT_STATUSES = ['active', 'discontinued', 'npd'];

export const ITEM_KINDS = ['issue', 'refinement'];

export const ISSUE_SOURCES = ['kol', 'customer', 'b2b', 'survey', 'support', 'team', 'other'];

export const ISSUE_STATUSES = ['open', 'investigating', 'resolved', 'wont_fix'];

export const ISSUE_BOARD_COLUMNS = [
  { id: 'open', labelKey: 'hub.products.issueColOpen' },
  { id: 'investigating', labelKey: 'hub.products.issueColAnswering' },
  { id: 'resolved', labelKey: 'hub.products.issueColCleared', statusIds: ['resolved', 'wont_fix'] },
];

export const REFINEMENT_STATUSES = ['idea', 'planned', 'done'];

export const PRODUCT_TABS = ['overview', 'issues', 'refinements'];

export function issueBoardColumnId(status) {
  const col = ISSUE_BOARD_COLUMNS.find(c => c.statusIds?.includes(status) || c.id === status);
  return col?.id || 'open';
}

export function issueStatusLabel(status, t) {
  const keys = {
    open: 'hub.products.issueStatusOpen',
    investigating: 'hub.products.issueStatusAnswering',
    resolved: 'hub.products.issueStatusCleared',
    wont_fix: 'hub.products.issueStatusWontFix',
  };
  const key = keys[status];
  return key ? t(key) : status.replace(/_/g, ' ');
}

export function issueSourceLabel(source) {
  const labels = {
    kol: 'KOL',
    customer: 'End user',
    b2b: 'B2B',
    survey: 'Survey',
    support: 'Support',
    team: 'Team',
    other: 'Other',
  };
  return labels[source] || source;
}

export function normalizeProduct(input) {
  const sku = String(input?.sku || '').trim().toUpperCase();
  const status = PRODUCT_STATUSES.includes(input?.status) ? input.status : 'active';
  const specs = input?.specs && typeof input.specs === 'object' && !Array.isArray(input.specs)
    ? input.specs
    : {};
  if (typeof input?.specs_md === 'string') {
    specs.md = input.specs_md;
  } else if (typeof specs.md !== 'string') {
    specs.md = String(specs.md || input?.specs_md || '');
  }

  return {
    sku,
    name: String(input?.name || sku).trim().slice(0, 200),
    description: String(input?.description || '').slice(0, 4000),
    specs,
    price_display: String(input?.price_display || '').slice(0, 80),
    image_url: String(input?.image_url || '').slice(0, 2000),
    launched_at: input?.launched_at || null,
    status,
    sort_order: Number(input?.sort_order) || 0,
    created_by: String(input?.created_by || ''),
    created_at: input?.created_at || new Date().toISOString(),
    updated_at: input?.updated_at || input?.created_at || new Date().toISOString(),
  };
}

export function normalizeProductItem(input) {
  const kind = ITEM_KINDS.includes(input?.kind) ? input.kind : 'issue';
  const issueStatuses = ISSUE_STATUSES;
  const refinementStatuses = REFINEMENT_STATUSES;
  const defaultStatus = kind === 'refinement' ? 'idea' : 'open';
  const statusList = kind === 'refinement' ? refinementStatuses : issueStatuses;
  const status = statusList.includes(input?.status) ? input.status : defaultStatus;
  const source = ISSUE_SOURCES.includes(input?.source) ? input.source : 'other';

  return {
    id: String(input?.id || ''),
    product_sku: String(input?.product_sku || '').trim().toUpperCase(),
    kind,
    title: String(input?.title || 'Untitled').trim().slice(0, 240),
    body: String(input?.body || '').slice(0, 8000),
    source,
    status,
    assignee: String(input?.assignee || '').slice(0, 80),
    source_ref: input?.source_ref ? String(input.source_ref).slice(0, 120) : null,
    comments: Array.isArray(input?.comments) ? input.comments : [],
    created_by: String(input?.created_by || ''),
    created_at: input?.created_at || new Date().toISOString(),
    updated_at: input?.updated_at || input?.created_at || new Date().toISOString(),
  };
}

export function productUrl(sku, { tab = '' } = {}) {
  const params = new URLSearchParams();
  if (sku) params.set('product', sku);
  if (tab && PRODUCT_TABS.includes(tab)) params.set('tab', tab);
  const qs = params.toString();
  return qs ? `/products?${qs}` : '/products';
}

export function openIssueCount(items) {
  return items.filter(
    item => item.kind === 'issue' && item.status !== 'resolved' && item.status !== 'wont_fix'
  ).length;
}

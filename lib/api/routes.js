/** Client-facing REST API paths (v1). */

export const API_V1 = {
  internalTasks: '/api/v1/internal/tasks',
  internalTask: id => `/api/v1/internal/tasks/${encodeURIComponent(id)}`,
  internalTaskComments: id => `/api/v1/internal/tasks/${encodeURIComponent(id)}/comments`,
  internalUpload: '/api/v1/internal/upload',
  internalCampaigns: '/api/v1/internal/campaigns',
  internalCampaign: id => `/api/v1/internal/campaigns/${encodeURIComponent(id)}`,
  internalCampaignBoards: id => `/api/v1/internal/campaigns/${encodeURIComponent(id)}/boards`,
  internalBoard: id => `/api/v1/internal/boards/${encodeURIComponent(id)}`,
  internalBoards: '/api/v1/internal/boards',
  knowledgePages: '/api/v1/knowledge/pages',
  knowledgePage: id => `/api/v1/knowledge/pages/${encodeURIComponent(id)}`,
  products: '/api/v1/products',
  product: sku => `/api/v1/products/${encodeURIComponent(sku)}`,
  productItems: sku => `/api/v1/products/${encodeURIComponent(sku)}/items`,
  productComments: sku => `/api/v1/products/${encodeURIComponent(sku)}/comments`,
  productItem: id => `/api/v1/products/items/${encodeURIComponent(id)}`,
  productItemComments: id => `/api/v1/products/items/${encodeURIComponent(id)}/comments`,
  calendarHolidays: year =>
    `/api/v1/calendar/holidays?year=${encodeURIComponent(year)}`,
  authMe: '/api/v1/auth/me',
  hubTeamMembers: '/api/v1/hub/team-members',
  hubNotifications: '/api/v1/hub/notifications',
  opsShopifyPull: '/api/v1/ops/shopify/pull',
  opsShopifyPush: '/api/v1/ops/shopify/push',
  marketingKolPool: '/api/v1/marketing/kol-pool',
  marketingKolPoolSync: '/api/v1/marketing/kol-pool/sync',
  marketingKolPoolRecord: id => `/api/v1/marketing/kol-pool/${encodeURIComponent(id)}`,
  internalCampaignKol: id => `/api/v1/internal/campaigns/${encodeURIComponent(id)}/kol`,
  internalCampaignKolEntry: (campaignId, entryId) =>
    `/api/v1/internal/campaigns/${encodeURIComponent(campaignId)}/kol/${encodeURIComponent(entryId)}`,
  hubReminders: '/api/v1/hub/reminders',
  hubReminder: id => `/api/v1/hub/reminders/${encodeURIComponent(id)}`,
  opsExpenses: '/api/v1/ops/expenses',
  opsExpense: id => `/api/v1/ops/expenses/${encodeURIComponent(id)}`,
  personalJots: '/api/v1/personal/jots',
  personalJot: id => `/api/v1/personal/jots/${encodeURIComponent(id)}`,
};

export function knowledgePagesQuery({ department } = {}) {
  const params = new URLSearchParams();
  if (department) params.set('department', department);
  const qs = params.toString();
  return qs ? `${API_V1.knowledgePages}?${qs}` : API_V1.knowledgePages;
}

export function internalTasksQuery({ department, bucket, board_id, campaign_id, flow_only } = {}) {
  const params = new URLSearchParams();
  if (department) params.set('department', department);
  if (bucket) params.set('bucket', bucket);
  if (board_id) params.set('board_id', board_id);
  if (campaign_id) params.set('campaign_id', campaign_id);
  if (flow_only) params.set('flow_only', '1');
  const qs = params.toString();
  return qs ? `${API_V1.internalTasks}?${qs}` : API_V1.internalTasks;
}

export function internalBoardsQuery({ department, scope } = {}) {
  const params = new URLSearchParams();
  if (department) params.set('department', department);
  if (scope) params.set('scope', scope);
  const qs = params.toString();
  return qs ? `${API_V1.internalBoards}?${qs}` : API_V1.internalBoards;
}

/** Parse v1 `{ data }` or legacy `{ tasks|task }` bodies. */
export function unwrapData(body, legacyKey) {
  if (body?.data !== undefined) return body.data;
  if (legacyKey && body?.[legacyKey] !== undefined) return body[legacyKey];
  return body;
}

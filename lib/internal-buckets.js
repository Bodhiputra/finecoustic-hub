/** Client-safe bucket view ids — shared by server loaders and client task filters. */
export const INTERNAL_BUCKET_VIEWS = new Set(['today', 'overdue', 'in_progress', 'bank', 'milestones']);

export function parseInternalBucket(viewParam = '') {
  return INTERNAL_BUCKET_VIEWS.has(viewParam) ? viewParam : '';
}
